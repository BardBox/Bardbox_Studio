-- =============================================================
-- 02_functions.sql
-- Business logic lives here: auto-assign, task creation, override.
-- Run after 01_schema.sql.
-- =============================================================

-- ---------------------------------------------------------------
-- auto_assign_task(task_id)
-- Assigns the given task to the active person in the relevant role
-- with the fewest open tasks. Respects max_concurrent_tasks.
-- Skips if task is already manually_assigned.
-- ---------------------------------------------------------------
create or replace function public.auto_assign_task(p_task_id bigint)
returns uuid
language plpgsql
security definer
as $$
declare
  v_task_type text;
  v_is_manual boolean;
  v_target_role text;
  v_assignee uuid;
begin
  select task_type, manually_assigned
    into v_task_type, v_is_manual
  from public.tasks
  where id = p_task_id;

  if v_is_manual then
    return null;  -- don't override human decision
  end if;

  v_target_role := case when v_task_type = 'design' then 'designer' else 'smo' end;

  -- Pick the active profile with the fewest open tasks, tie-break randomly.
  select p.id
    into v_assignee
  from public.profiles p
  left join public.tasks t
    on t.assignee_id = p.id
   and t.status not in ('done','approved')
  where p.role = v_target_role
    and p.is_active = true
  group by p.id, p.max_concurrent_tasks
  having count(t.id) < coalesce(p.max_concurrent_tasks, 10)
  order by count(t.id) asc, random()
  limit 1;

  if v_assignee is null then
    -- no one under cap; assign to the least-loaded anyway and let manager decide
    select p.id
      into v_assignee
    from public.profiles p
    left join public.tasks t
      on t.assignee_id = p.id
     and t.status not in ('done','approved')
    where p.role = v_target_role
      and p.is_active = true
    group by p.id
    order by count(t.id) asc, random()
    limit 1;
  end if;

  update public.tasks
    set assignee_id = v_assignee,
        updated_at = now()
  where id = p_task_id;

  insert into public.activity_log (task_id, actor_id, action, details)
  values (p_task_id, null, 'auto_assigned', jsonb_build_object('assignee_id', v_assignee));

  return v_assignee;
end;
$$;


-- ---------------------------------------------------------------
-- Trigger: create design + post tasks when a content_row is inserted.
-- Applies buffer_config to compute design deadline.
-- ---------------------------------------------------------------
create or replace function public.create_tasks_for_content_row()
returns trigger
language plpgsql
as $$
declare
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at   timestamptz;
  v_design_due   timestamptz;
  v_post_due     timestamptz;
  v_design_id    bigint;
  v_post_id      bigint;
begin
  select bc.design_buffer_days, bc.review_buffer_days
    into v_design_buffer, v_review_buffer
  from public.buffer_config bc
  where lower(bc.platform) = lower(new.platform)
    and lower(bc.content_type) = lower(new.content_type)
  limit 1;

  v_design_buffer := coalesce(v_design_buffer, 3);
  v_review_buffer := coalesce(v_review_buffer, 1);

  v_posting_at := (new.posting_date + coalesce(new.posting_time, '10:00:00'::time))
                  at time zone 'Asia/Kolkata';
  v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
  v_post_due   := v_posting_at;

  insert into public.tasks (content_row_id, task_type, internal_deadline)
  values (new.id, 'design', v_design_due)
  returning id into v_design_id;

  perform public.auto_assign_task(v_design_id);

  insert into public.tasks (content_row_id, task_type, internal_deadline)
  values (new.id, 'post', v_post_due)
  returning id into v_post_id;

  perform public.auto_assign_task(v_post_id);

  insert into public.activity_log (content_row_id, action, details)
  values (new.id, 'tasks_created',
          jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

  return new;
end;
$$;

drop trigger if exists content_row_create_tasks on public.content_rows;
create trigger content_row_create_tasks
  after insert on public.content_rows
  for each row execute function public.create_tasks_for_content_row();


-- ---------------------------------------------------------------
-- Trigger: when posting_date changes on a content_row,
-- recompute task deadlines (but don't touch assignees).
-- ---------------------------------------------------------------
create or replace function public.recompute_task_deadlines()
returns trigger
language plpgsql
as $$
declare
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at   timestamptz;
begin
  if new.posting_date = old.posting_date and new.posting_time is not distinct from old.posting_time then
    return new;
  end if;

  select bc.design_buffer_days, bc.review_buffer_days
    into v_design_buffer, v_review_buffer
  from public.buffer_config bc
  where lower(bc.platform) = lower(new.platform)
    and lower(bc.content_type) = lower(new.content_type)
  limit 1;

  v_design_buffer := coalesce(v_design_buffer, 3);
  v_review_buffer := coalesce(v_review_buffer, 1);

  v_posting_at := (new.posting_date + coalesce(new.posting_time, '10:00:00'::time))
                  at time zone 'Asia/Kolkata';

  update public.tasks
    set internal_deadline = v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval
  where content_row_id = new.id and task_type = 'design';

  update public.tasks
    set internal_deadline = v_posting_at
  where content_row_id = new.id and task_type = 'post';

  return new;
end;
$$;

drop trigger if exists content_row_recompute on public.content_rows;
create trigger content_row_recompute
  after update on public.content_rows
  for each row execute function public.recompute_task_deadlines();


-- ---------------------------------------------------------------
-- Manager override: manually assign a task to a specific person.
-- Sets manually_assigned = true so auto-reassign won't clobber it.
-- ---------------------------------------------------------------
create or replace function public.override_assignee(
  p_task_id bigint,
  p_assignee_id uuid,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  v_old uuid;
begin
  select assignee_id into v_old from public.tasks where id = p_task_id;

  update public.tasks
    set assignee_id = p_assignee_id,
        manually_assigned = true,
        updated_at = now()
  where id = p_task_id;

  insert into public.activity_log (task_id, actor_id, action, details)
  values (p_task_id, p_actor_id, 'manually_reassigned',
          jsonb_build_object('from', v_old, 'to', p_assignee_id));
end;
$$;


-- ---------------------------------------------------------------
-- Mark task done + propagate status to parent content_row.
-- ---------------------------------------------------------------
create or replace function public.complete_task(p_task_id bigint, p_actor_id uuid default null)
returns void
language plpgsql
security definer
as $$
declare
  v_task_type text;
  v_row_id bigint;
  v_other_status text;
begin
  update public.tasks
    set status = 'done',
        completed_at = now(),
        updated_at = now()
  where id = p_task_id
  returning task_type, content_row_id into v_task_type, v_row_id;

  -- update the parent content_row status based on task progress
  if v_task_type = 'design' then
    update public.content_rows set status = 'approved'
    where id = v_row_id and status in ('draft','in_design','in_review');
  elsif v_task_type = 'post' then
    update public.content_rows set status = 'posted' where id = v_row_id;
  end if;

  insert into public.activity_log (task_id, content_row_id, actor_id, action)
  values (p_task_id, v_row_id, p_actor_id, 'task_completed');
end;
$$;
