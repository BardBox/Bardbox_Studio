-- ============================================================
-- 08_design_flow.sql
-- ============================================================
-- =============================================================
-- 08_design_flow.sql
-- Phase 3: design link on tasks, manual task creation flag,
--           create_tasks_for_rows RPC, refreshed views.
-- Run after 07_task_requests_clients.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Add design_url to tasks
-- ---------------------------------------------------------------
alter table public.tasks
  add column if not exists design_url text;

-- ---------------------------------------------------------------
-- 2. Add auto_create_tasks flag to content_rows
--    true  = trigger creates tasks on insert (default, in_app)
--    false = tasks created manually later (imported rows)
-- ---------------------------------------------------------------
alter table public.content_rows
  add column if not exists auto_create_tasks boolean not null default true;

-- ---------------------------------------------------------------
-- 3. Replace create_tasks_for_content_row trigger function
--    to respect the auto_create_tasks flag
-- ---------------------------------------------------------------
create or replace function public.create_tasks_for_content_row()
returns trigger
language plpgsql
as $$
declare
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at    timestamptz;
  v_design_due    timestamptz;
  v_post_due      timestamptz;
  v_design_id     bigint;
  v_post_id       bigint;
begin
  -- Skip task creation for imported rows (manager creates tasks manually)
  if not new.auto_create_tasks then
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

-- Recreate trigger (function replaced in-place, but recreate to be safe)
drop trigger if exists content_row_create_tasks on public.content_rows;
create trigger content_row_create_tasks
  after insert on public.content_rows
  for each row execute function public.create_tasks_for_content_row();


-- ---------------------------------------------------------------
-- 4. RPC: create_tasks_for_rows(p_ids BIGINT[])
--    Called by the manager when manually creating tasks for
--    selected imported content rows.
--    Idempotent: skips rows that already have tasks.
-- ---------------------------------------------------------------
create or replace function public.create_tasks_for_rows(p_ids bigint[])
returns table(content_row_id bigint, design_task_id bigint, post_task_id bigint)
language plpgsql
security definer
as $$
declare
  v_row          public.content_rows%rowtype;
  v_design_buffer int;
  v_review_buffer int;
  v_posting_at   timestamptz;
  v_design_due   timestamptz;
  v_post_due     timestamptz;
  v_design_id    bigint;
  v_post_id      bigint;
begin
  foreach v_row.id in array p_ids loop
    select * into v_row from public.content_rows where id = v_row.id;
    if not found then continue; end if;

    -- Skip if tasks already exist for this row
    if exists (select 1 from public.tasks t where t.content_row_id = v_row.id) then
      select t.id into v_design_id from public.tasks t
        where t.content_row_id = v_row.id and t.task_type = 'design' limit 1;
      select t.id into v_post_id from public.tasks t
        where t.content_row_id = v_row.id and t.task_type = 'post' limit 1;
      content_row_id := v_row.id;
      design_task_id := v_design_id;
      post_task_id   := v_post_id;
      return next;
      continue;
    end if;

    select bc.design_buffer_days, bc.review_buffer_days
      into v_design_buffer, v_review_buffer
    from public.buffer_config bc
    where lower(bc.platform) = lower(v_row.platform)
      and lower(bc.content_type) = lower(v_row.content_type)
    limit 1;

    v_design_buffer := coalesce(v_design_buffer, 3);
    v_review_buffer := coalesce(v_review_buffer, 1);

    v_posting_at := (v_row.posting_date + coalesce(v_row.posting_time, '10:00:00'::time))
                    at time zone 'Asia/Kolkata';
    v_design_due := v_posting_at - ((v_design_buffer + v_review_buffer) || ' days')::interval;
    v_post_due   := v_posting_at;

    insert into public.tasks (content_row_id, task_type, internal_deadline)
    values (v_row.id, 'design', v_design_due)
    returning id into v_design_id;

    perform public.auto_assign_task(v_design_id);

    insert into public.tasks (content_row_id, task_type, internal_deadline)
    values (v_row.id, 'post', v_post_due)
    returning id into v_post_id;

    perform public.auto_assign_task(v_post_id);

    -- Mark row as having tasks, so trigger won't double-create if row is ever updated
    update public.content_rows
      set auto_create_tasks = true
    where id = v_row.id;

    insert into public.activity_log (content_row_id, action, details)
    values (v_row.id, 'tasks_created',
            jsonb_build_object('design_task_id', v_design_id, 'post_task_id', v_post_id));

    content_row_id := v_row.id;
    design_task_id := v_design_id;
    post_task_id   := v_post_id;
    return next;
  end loop;
end;
$$;


-- ---------------------------------------------------------------
-- 5. Refresh task_pipeline_health to include design_url and
--    rejection_notes (both added in prior/this migration)
-- ---------------------------------------------------------------
-- Drop all dependent views first (CASCADE handles pipeline_summary and pending_approvals)
drop view if exists public.task_pipeline_health cascade;

create view public.task_pipeline_health as
select
  t.id                    as task_id,
  t.task_type,
  t.status                as task_status,
  t.internal_deadline,
  t.assignee_id,
  t.manually_assigned,
  t.completed_at,
  t.design_url,
  t.rejection_notes,
  cr.id                   as content_row_id,
  cr.client_name,
  cr.platform,
  cr.content_type,
  cr.brief,
  cr.caption,
  cr.posting_date,
  cr.posting_time,
  cr.status               as row_status,
  p.full_name             as assignee_name,
  p.role                  as assignee_role,
  round(extract(epoch from (t.internal_deadline - now())) / 3600.0, 1) as hours_until_deadline,
  case
    when t.status in ('done','approved') then 'completed'
    when t.internal_deadline < now() then 'overdue'
    when (t.internal_deadline - now()) < interval '48 hours' then 'critical'
    when (t.internal_deadline - now()) < interval '7 days' then 'approaching'
    else 'comfortable'
  end as pressure_level
from public.tasks t
join public.content_rows cr on cr.id = t.content_row_id
left join public.profiles p on p.id = t.assignee_id;


-- ---------------------------------------------------------------
-- 6. Refresh pending_approvals (inherits design_url + rejection_notes
--    from the updated task_pipeline_health view)
-- ---------------------------------------------------------------
create view public.pending_approvals as
select *
from public.task_pipeline_health
where task_status = 'submitted'
order by internal_deadline asc;


-- ---------------------------------------------------------------
-- 7. Recreate pipeline_summary (was dropped by CASCADE above)
-- ---------------------------------------------------------------
create view public.pipeline_summary as
select
  count(*) filter (where pressure_level = 'overdue')               as overdue,
  count(*) filter (where pressure_level = 'critical')              as critical,
  count(*) filter (where pressure_level = 'approaching')           as approaching,
  count(*) filter (where pressure_level = 'comfortable')           as comfortable,
  count(*) filter (where task_status = 'blocked')                  as blocked,
  count(*) filter (
    where completed_at >= date_trunc('week', now())
  )                                                                as completed_this_week,
  count(*) filter (
    where posting_date between current_date and current_date + 7
      and task_type = 'post'
  )                                                                as posts_next_7_days,
  count(*) filter (
    where posting_date = current_date
      and task_type = 'post'
      and task_status not in ('done','approved')
  )                                                                as posts_due_today
from public.task_pipeline_health;


-- ============================================================
-- 09_demo_seed.sql
-- ============================================================
-- =============================================================
-- 09_demo_seed.sql
-- Real clients + demo content rows + tasks
-- Team accounts must be created first via /admin/team or Supabase Auth.
-- Safe to re-run. To clear: DELETE FROM content_rows WHERE source = 'import';
-- =============================================================

DO $$
DECLARE
  v_designer1 uuid;  -- Dhairya (graphic designer)
  v_designer2 uuid;  -- Abhishek or Jignesh (motion)
  v_smo1      uuid;  -- Kavita
  v_manager   uuid;  -- Sameer or Yogina
  r           bigint;

BEGIN
  -- Pick real team by role (whoever exists in profiles)
  SELECT id INTO v_designer1 FROM public.profiles WHERE role='designer' AND is_active=true ORDER BY full_name LIMIT 1;
  SELECT id INTO v_designer2 FROM public.profiles WHERE role='designer' AND is_active=true ORDER BY full_name OFFSET 1 LIMIT 1;
  SELECT id INTO v_smo1      FROM public.profiles WHERE role='smo'      AND is_active=true LIMIT 1;
  SELECT id INTO v_manager   FROM public.profiles WHERE role IN ('manager','admin','ceo') AND is_active=true LIMIT 1;

  v_designer2 := COALESCE(v_designer2, v_designer1);

  -- ── Real Clients ─────────────────────────────────────────────
  INSERT INTO public.clients (name) VALUES
    ('Bizcivitas'), ('Easebiz'), ('Bardbox'), ('BrandWhisperer'), ('K10')
  ON CONFLICT DO NOTHING;

  -- ================================================================
  -- POSTED — April 2026
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','linkedin','post',
    'Thought leadership: 3 common mistakes businesses make when scaling their online presence',
    '3 mistakes that cost businesses lakhs online — and how to avoid them. 🧵 #Bizcivitas #DigitalGrowth',
    '2026-04-05','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-02 10:00+05:30','done','2026-04-01 16:00+05:30','https://canva.com/design/biz1'),
         (r,'post',v_smo1,'2026-04-05 10:00+05:30','done','2026-04-05 10:05+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','carousel',
    'Step-by-step guide: registering your business online in under 10 minutes',
    'Start your business in 10 minutes flat 🚀 Swipe to see how Easebiz makes it possible. #Easebiz #Startup',
    '2026-04-08','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer2,'2026-04-04 10:00+05:30','done','2026-04-03 14:00+05:30','https://canva.com/design/ease1'),
         (r,'post',v_smo1,'2026-04-08 10:00+05:30','done','2026-04-08 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Agency culture reel — team at work, creative process, behind the scenes vibes',
    'This is what creativity looks like at 9am on a Monday ☕ #Bardbox #AgencyLife #CreativeTeam',
    '2026-04-11','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-07 10:00+05:30','done','2026-04-06 18:00+05:30','https://canva.com/design/bb1'),
         (r,'post',v_smo1,'2026-04-11 10:00+05:30','done','2026-04-11 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','linkedin','post',
    'Why most brands talk AT their audience instead of WITH them — thought piece',
    'Your brand is not the hero. Your customer is. Here is what that actually means for your content. #BrandWhisperer #Branding',
    '2026-04-15','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer2,'2026-04-11 10:00+05:30','done','2026-04-10 12:00+05:30','https://canva.com/design/bw1'),
         (r,'post',v_smo1,'2026-04-15 10:00+05:30','done','2026-04-15 10:00+05:30',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','post',
    'New property listing announcement — premium residential project launch',
    '🏙️ Introducing K10 Heights. Premium living, prime location. DM for details. #K10 #RealEstate',
    '2026-04-18','posted','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,completed_at,design_url)
  VALUES (r,'design',v_designer1,'2026-04-14 10:00+05:30','done','2026-04-13 17:00+05:30','https://canva.com/design/k10a'),
         (r,'post',v_smo1,'2026-04-18 10:00+05:30','done','2026-04-18 10:00+05:30',null);

  -- ================================================================
  -- OVERDUE — design in_progress, deadline already passed
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','facebook','post',
    'Case study: how a client 5x-ed their leads in 60 days using Bizcivitas platform',
    null,'2026-04-22','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-04-19 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-04-22 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','reel',
    'Walkthrough video of the model apartment — luxury interiors, ambient music',
    null,'2026-04-24','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-04-21 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-04-24 10:00+05:30','todo');

  -- ================================================================
  -- PENDING APPROVAL — submitted by designer, awaiting review
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','reel',
    'Animated explainer: what is a GST number and why your business needs one',
    'No more GST confusion 📋 We explain it in 30 seconds. #Easebiz #GSTIndia #BusinessTips',
    '2026-04-27','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer2,'2026-04-23 10:00+05:30','submitted','https://canva.com/design/ease2'),
         (r,'post',v_smo1,'2026-04-27 10:00+05:30','todo',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','linkedin','post',
    'Client results showcase: 3 brands, 3 transformations — before/after metrics',
    'We helped 3 brands completely transform their digital presence in Q1 2026. Here are the numbers 👇 #Bardbox #Results',
    '2026-04-28','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer1,'2026-04-24 10:00+05:30','submitted','https://canva.com/design/bb2'),
         (r,'post',v_smo1,'2026-04-28 10:00+05:30','todo',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','instagram','carousel',
    'Brand audit checklist — 5 things every brand should review quarterly',
    'Is your brand saying the right things? 🔍 Swipe for a 5-point brand health check. #BrandWhisperer #BrandStrategy',
    '2026-04-30','in_review','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer2,'2026-04-26 10:00+05:30','submitted','https://canva.com/design/bw2'),
         (r,'post',v_smo1,'2026-04-30 10:00+05:30','todo',null);

  -- ================================================================
  -- MAY 2026 — approved + in_progress + todo
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','carousel',
    'Amenities tour — rooftop, gym, pool, co-working space at K10 Heights',
    'Life at K10 is not just a home — it is a lifestyle. 🏊 Swipe to see every amenity. #K10 #LuxuryLiving',
    '2026-05-03','approved','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status,design_url)
  VALUES (r,'design',v_designer1,'2026-04-29 10:00+05:30','approved','https://canva.com/design/k10b'),
         (r,'post',v_smo1,'2026-05-03 10:00+05:30','approved',null);

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','instagram','reel',
    'Founder story — why Bizcivitas was started and the problem it solves for SMBs',
    'We built Bizcivitas because we saw too many good businesses fail for the wrong reasons. Here is why 👇',
    '2026-05-06','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-02 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-05-06 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Time-lapse of a full brand identity project from brief to delivery',
    'From blank canvas to full identity in 3 weeks ⚡ Watch the entire process sped up. #Bardbox #BrandDesign',
    '2026-05-09','in_design','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-05 10:00+05:30','in_progress'),
         (r,'post',v_smo1,'2026-05-09 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','linkedin','post',
    'New feature announcement: one-click GST filing now available on Easebiz dashboard',
    '🎉 Big update: GST filing just got a lot easier. One click. Done. #Easebiz #ProductUpdate',
    '2026-05-12','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-08 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-12 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','instagram','post',
    'Quote card: "Your logo is not your brand. Your reputation is." — with commentary',
    '"Your logo is not your brand. Your reputation is." 🔑 Save this. #BrandWhisperer #BrandQuote',
    '2026-05-15','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-13 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-15 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','facebook','post',
    'Limited early-bird pricing announcement — deadline May 31',
    '⏳ Early-bird pricing ends May 31. Book your K10 unit before rates increase. DM now. #K10 #RealEstate',
    '2026-05-20','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-05-16 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-20 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','carousel',
    'Services breakdown: what we do at Bardbox — branding, content, digital, web',
    'One studio. Every creative need covered. 🎨 Swipe to see what Bardbox does. #Bardbox #CreativeAgency',
    '2026-05-23','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-05-19 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-05-23 10:00+05:30','todo');

  -- ================================================================
  -- JUNE 2026 — all draft / todo (comfortable pipeline)
  -- ================================================================

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bizcivitas','linkedin','post',
    'Mid-year growth report: Bizcivitas platform milestones and what is coming next',
    'Halfway through 2026 and here is where we stand 📊 Our biggest milestones and what comes next. #Bizcivitas',
    '2026-06-05','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-02 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-05 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Easebiz','instagram','reel',
    'Motion graphic: the journey of a startup from idea to registered company using Easebiz',
    'From idea to official company in 72 hours ⚡ Watch the full journey. #Easebiz #StartupIndia',
    '2026-06-10','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-06-07 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-10 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('BrandWhisperer','linkedin','post',
    'Case study: rebranding a 15-year-old business — the process and results',
    'We helped a 15-year-old business rediscover its identity. Here is the full story. #BrandWhisperer #CaseStudy',
    '2026-06-16','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-12 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-16 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('K10','instagram','reel',
    'Possession ceremony highlights — emotional handover moments, happy residents',
    'This is the moment we work for. 🔑 Possession day at K10. Congratulations to our homeowners! #K10',
    '2026-06-21','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer1,'2026-06-17 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-21 10:00+05:30','todo');

  INSERT INTO public.content_rows (client_name,platform,content_type,brief,caption,posting_date,status,source,auto_create_tasks,created_by)
  VALUES ('Bardbox','instagram','reel',
    'Team introduction series: meet the Bardbox creative team — faces behind the work',
    'Meet the people behind the magic ✨ This is the Bardbox team. #Bardbox #TeamBardbox #MeetTheTeam',
    '2026-06-25','draft','import',false,v_manager)
  RETURNING id INTO r;
  INSERT INTO public.tasks(content_row_id,task_type,assignee_id,internal_deadline,status)
  VALUES (r,'design',v_designer2,'2026-06-21 10:00+05:30','todo'),
         (r,'post',v_smo1,'2026-06-25 10:00+05:30','todo');

  RAISE NOTICE 'Demo seed complete — 5 clients, 28 content rows, 56 tasks inserted.';
END;
$$;


-- ============================================================
-- 10_developer_role.sql
-- ============================================================
-- =============================================================
-- 10_developer_role.sql
-- Add 'developer' to allowed roles.
-- Run before creating Aadil's account.
-- =============================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('designer','smo','manager','admin','ceo','hr','developer'));


-- ============================================================
-- 11_ai_settings.sql
-- ============================================================
-- =============================================================
-- 11_ai_settings.sql
-- AI provider configuration and custom training knowledge base.
-- Run after 10_developer_role.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. AI provider settings (one active row = current config)
-- ---------------------------------------------------------------
create table if not exists public.ai_settings (
  id           serial primary key,
  provider     text    not null default 'gemini'
                 check (provider in ('gemini','ollama','openai')),
  model        text    not null default 'gemini-2.0-flash',
  base_url     text,          -- required for ollama / custom openai
  api_key      text,          -- null = use GEMINI_API_KEY env var
  is_active    boolean not null default true,
  updated_by   uuid    references public.profiles(id) on delete set null,
  updated_at   timestamptz default now()
);

-- Seed default row (uses env var key)
insert into public.ai_settings (provider, model)
values ('gemini', 'gemini-2.0-flash')
on conflict do nothing;

-- ---------------------------------------------------------------
-- 2. Training / knowledge base documents
--    Injected into AI system prompts to "train" the AI on your
--    brand, clients, workflow and creative direction.
-- ---------------------------------------------------------------
create table if not exists public.ai_training_docs (
  id         serial primary key,
  title      text    not null,
  category   text    not null default 'general'
               check (category in ('brand_guidelines','client_info','workflow','creative_direction','general')),
  content    text    not null,
  is_active  boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------
alter table public.ai_settings       enable row level security;
alter table public.ai_training_docs  enable row level security;

-- All authenticated users can read (needed for AI routes that run server-side)
create policy "authenticated_read_ai_settings"
  on public.ai_settings for select
  using (auth.role() = 'authenticated');

create policy "authenticated_read_ai_training"
  on public.ai_training_docs for select
  using (auth.role() = 'authenticated');

-- Only admin / manager can write
create policy "admin_write_ai_settings"
  on public.ai_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );

create policy "admin_write_ai_training"
  on public.ai_training_docs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin','manager')
    )
  );


-- ============================================================
-- 12_role_permissions.sql
-- ============================================================
-- Dynamic per-role nav permissions
-- Admin can toggle which routes each role can access via /admin/permissions

create table if not exists role_permissions (
  role    text    not null,
  route   text    not null,
  enabled boolean not null default true,
  primary key (role, route)
);

-- Only admins can read/write this table
alter table role_permissions enable row level security;

create policy "admin full access"
  on role_permissions for all
  using  (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- App server reads allowed for any authenticated user (to build their own nav)
create policy "authenticated read"
  on role_permissions for select
  using (auth.role() = 'authenticated');

-- Seed: default sensible permissions for each role
insert into role_permissions (role, route, enabled) values
  -- manager
  ('manager', '/manager',          true),
  ('manager', '/manager/tasks',    true),
  ('manager', '/manager/requests', true),
  ('manager', '/manager/clients',  true),
  ('manager', '/request-task',     true),
  ('manager', '/content',          true),
  ('manager', '/admin/team',       true),
  ('manager', '/hr',               true),
  ('manager', '/smo',              false),
  ('manager', '/designer',         false),
  ('manager', '/ceo',              false),
  ('manager', '/ceo/approvals',    false),
  ('manager', '/admin/roles',      false),
  ('manager', '/admin/settings',   false),
  ('manager', '/admin/permissions',false),

  -- admin
  ('admin', '/manager',          true),
  ('admin', '/manager/tasks',    true),
  ('admin', '/manager/requests', true),
  ('admin', '/manager/clients',  true),
  ('admin', '/request-task',     true),
  ('admin', '/content',          true),
  ('admin', '/smo',              true),
  ('admin', '/designer',         true),
  ('admin', '/ceo',              false),
  ('admin', '/ceo/approvals',    false),
  ('admin', '/admin/team',       true),
  ('admin', '/hr',               true),
  ('admin', '/admin/roles',      true),
  ('admin', '/admin/settings',   true),
  ('admin', '/admin/permissions',true),

  -- ceo
  ('ceo', '/manager',           false),
  ('ceo', '/manager/tasks',     false),
  ('ceo', '/manager/requests',  false),
  ('ceo', '/manager/clients',   false),
  ('ceo', '/request-task',      false),
  ('ceo', '/content',           true),
  ('ceo', '/smo',               false),
  ('ceo', '/designer',          false),
  ('ceo', '/ceo',               true),
  ('ceo', '/ceo/approvals',     true),
  ('ceo', '/admin/team',        true),
  ('ceo', '/hr',                false),
  ('ceo', '/admin/roles',       false),
  ('ceo', '/admin/settings',    false),
  ('ceo', '/admin/permissions', false),

  -- smo
  ('smo', '/manager',           false),
  ('smo', '/manager/tasks',     false),
  ('smo', '/manager/requests',  false),
  ('smo', '/manager/clients',   false),
  ('smo', '/request-task',      true),
  ('smo', '/content',           true),
  ('smo', '/smo',               true),
  ('smo', '/designer',          false),
  ('smo', '/ceo',               false),
  ('smo', '/ceo/approvals',     false),
  ('smo', '/admin/team',        false),
  ('smo', '/hr',                false),
  ('smo', '/admin/roles',       false),
  ('smo', '/admin/settings',    false),
  ('smo', '/admin/permissions', false),

  -- designer
  ('designer', '/manager',           false),
  ('designer', '/manager/tasks',     false),
  ('designer', '/manager/requests',  false),
  ('designer', '/manager/clients',   false),
  ('designer', '/request-task',      true),
  ('designer', '/content',           true),
  ('designer', '/smo',               false),
  ('designer', '/designer',          true),
  ('designer', '/ceo',               false),
  ('designer', '/ceo/approvals',     false),
  ('designer', '/admin/team',        false),
  ('designer', '/hr',                false),
  ('designer', '/admin/roles',       false),
  ('designer', '/admin/settings',    false),
  ('designer', '/admin/permissions', false),

  -- hr
  ('hr', '/manager',           false),
  ('hr', '/manager/tasks',     false),
  ('hr', '/manager/requests',  false),
  ('hr', '/manager/clients',   false),
  ('hr', '/request-task',      false),
  ('hr', '/content',           false),
  ('hr', '/smo',               false),
  ('hr', '/designer',          false),
  ('hr', '/ceo',               false),
  ('hr', '/ceo/approvals',     false),
  ('hr', '/admin/team',        true),
  ('hr', '/hr',                true),
  ('hr', '/admin/roles',       false),
  ('hr', '/admin/settings',    false),
  ('hr', '/admin/permissions', false),

  -- developer
  ('developer', '/manager',           true),
  ('developer', '/manager/tasks',     true),
  ('developer', '/manager/requests',  false),
  ('developer', '/manager/clients',   false),
  ('developer', '/request-task',      true),
  ('developer', '/content',           false),
  ('developer', '/smo',               false),
  ('developer', '/designer',          false),
  ('developer', '/ceo',               false),
  ('developer', '/ceo/approvals',     false),
  ('developer', '/admin/team',        false),
  ('developer', '/hr',                false),
  ('developer', '/admin/roles',       true),
  ('developer', '/admin/settings',    true),
  ('developer', '/admin/permissions', false)

on conflict (role, route) do nothing;


-- ============================================================
-- 13_cloudinary_urls.sql
-- ============================================================
-- Add Cloudinary-hosted image URLs to profiles and clients
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS logo_url   TEXT;


-- ============================================================
-- 14_employee_fields.sql
-- ============================================================
-- 14_employee_fields.sql
-- Add HR / employee fields to profiles table
-- Run in Supabase SQL editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS employee_id       TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS designation       TEXT,
  ADD COLUMN IF NOT EXISTS date_of_joining   DATE,
  ADD COLUMN IF NOT EXISTS employment_type   TEXT CHECK (employment_type IN ('full-time','part-time','freelance','intern')),
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT;


-- ============================================================
-- 15_leave_conflicts.sql
-- ============================================================
-- =============================================================
-- 15_leave_conflicts.sql
-- Leave-aware task conflict resolution with AI suggestions
-- Run after 14_employee_fields.sql
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Extend task status to include new granular statuses
-- ---------------------------------------------------------------
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'todo', 'assigned', 'working_on_it', 'on_hold',
    'submitted', 'approved', 'done', 'blocked',
    'adjusted_before', 'adjusted_after'
  ));

-- Store original deadline before any adjustment
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS original_deadline timestamptz;

-- Why was this task adjusted / moved
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS adjustment_reason text;


-- ---------------------------------------------------------------
-- 2. Leave conflict tasks — one row per conflicting task per leave
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_conflict_tasks (
  id               bigserial PRIMARY KEY,
  leave_request_id bigint NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  task_id          bigint NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,

  -- AI output
  ai_suggestion    text CHECK (ai_suggestion IN ('before', 'after', 'reassign')),
  ai_reasoning     text,

  -- Manager resolution
  resolution       text NOT NULL DEFAULT 'pending'
                   CHECK (resolution IN ('pending', 'before', 'after', 'reassign')),
  resolved_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at      timestamptz,

  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(leave_request_id, task_id)
);

CREATE INDEX IF NOT EXISTS leave_conflict_leave_idx
  ON public.leave_conflict_tasks(leave_request_id);

CREATE INDEX IF NOT EXISTS leave_conflict_pending_idx
  ON public.leave_conflict_tasks(resolution)
  WHERE resolution = 'pending';


-- ---------------------------------------------------------------
-- 3. Update pending_approvals view to use new statuses
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW public.pending_approvals AS
SELECT *
FROM public.task_pipeline_health
WHERE task_status = 'submitted'
ORDER BY internal_deadline ASC;


-- ============================================================
-- 16_ai_providers_extended.sql
-- ============================================================
-- =============================================================
-- 16_ai_providers_extended.sql
-- Extend ai_settings provider CHECK constraint to include
-- groq and anthropic alongside the original providers.
-- Run after 11_ai_settings.sql
-- =============================================================

ALTER TABLE public.ai_settings
  DROP CONSTRAINT IF EXISTS ai_settings_provider_check;

ALTER TABLE public.ai_settings
  ADD CONSTRAINT ai_settings_provider_check
  CHECK (provider IN ('gemini', 'groq', 'anthropic', 'openai', 'ollama'));


