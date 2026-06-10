import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ContentCalendar } from '@/components/content/ContentCalendar';
import { ContentTable } from '@/components/content/ContentTable';
import { RedistributeButton } from '@/components/content/RedistributeButton';
import { getDesignerRoleKeys, getVideoRoleKeys } from '@/lib/role-flags';
import {
  getRoleKeysForTaskTypes,
  getTaskTypeKeysForRoles,
  getTaskTypeRolesMap,
  getTaskTypes,
} from '@/lib/task-type-flags';
import type { PipelineTask } from '@/lib/types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type View = 'table' | 'calendar' | 'employees';

function tabClass(active: boolean) {
  return `text-xs px-4 py-1.5 rounded-full font-semibold transition-all duration-200 ${
    active
      ? 'bg-blue-500/15 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300'
      : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200'
  }`;
}

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; client?: string; platform?: string; view?: string; assignee?: string }>;
}) {
  const { month, client, platform, view, assignee } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  const role = profile?.role ?? '';

  // Privilege determined by role name — no dependency on roles table being seeded
  const PRIVILEGED_ROLES = new Set(['admin', 'manager', 'ceo', 'developer']);
  const REDISTRIBUTE_ROLES = new Set(['admin', 'manager', 'ceo']);
  const canSeeCalendar  = PRIVILEGED_ROLES.has(role);
  const canRedistribute = REDISTRIBUTE_ROLES.has(role);

  // Use supabaseAdmin for role flag lookups so RLS never blocks them
  const [taskTypes, designerRoles, videoRoles] = await Promise.all([
    getTaskTypes(supabaseAdmin),
    getDesignerRoleKeys(supabaseAdmin),
    getVideoRoleKeys(supabaseAdmin),
  ]);
  const taskTypeRoles = getTaskTypeRolesMap(taskTypes);
  const productionRoles = getRoleKeysForTaskTypes(taskTypes);
  // mediaRoles: designer + video_editor (from roles table flags via supabaseAdmin)
  // Falls back to all non-smo task type targets if roles table not yet seeded
  const mediaRolesFromFlags = [...new Set([...designerRoles, ...videoRoles])];
  const mediaRoles = mediaRolesFromFlags.length > 0
    ? mediaRolesFromFlags
    : taskTypes.filter(tt => tt.target_role !== 'smo').map(tt => tt.target_role);
  const mediaTaskTypes = getTaskTypeKeysForRoles(taskTypes, mediaRoles);
  const publishingTaskTypes = taskTypes
    .filter((taskType) => !mediaRoles.includes(taskType.target_role))
    .map((taskType) => taskType.key);

  // If a non-privileged user somehow hits ?view=calendar, fall back to employees view
  const rawView = view === 'calendar' && !canSeeCalendar ? 'employees' : view;
  const activeView: View = rawView === 'calendar' ? 'calendar' : rawView === 'employees' ? 'employees' : 'table';

  const now = new Date();
  const activeMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [ymYear, ymMonth] = activeMonth.split('-').map(Number);
  const firstDay = `${activeMonth}-01`;
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate();
  const lastDay = `${activeMonth}-${String(daysInMonth).padStart(2, '0')}`;

  // Team members — all roles targeted by task_types
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', productionRoles.length > 0 ? productionRoles : ['__none__'])
    .eq('is_active', true)
    .order('role')
    .order('full_name');

  const allTeamMembers = (teamMembers ?? []) as { id: string; full_name: string; role: string }[];
  const mediaProducers = allTeamMembers.filter(m => mediaRoles.includes(m.role));

  // Shared tab bar links
  const tabs = (
    <div className="flex items-center gap-1 bg-white/40 backdrop-blur-sm border border-white/50 dark:bg-white/10 dark:border-white/20 rounded-full p-1">
      <Link
        href={`/content?view=table&month=${activeMonth}${client ? `&client=${client}` : ''}${platform ? `&platform=${platform}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
        className={tabClass(activeView === 'table')}
      >
        Table
      </Link>
      {canSeeCalendar && (
        <Link
          href={`/content?view=calendar&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
          className={tabClass(activeView === 'calendar')}
        >
          Calendar
        </Link>
      )}
      <Link
        href={`/content?view=employees&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
        className={tabClass(activeView === 'employees')}
      >
        Employees
      </Link>
    </div>
  );

  // ── TABLE ─────────────────────────────────────────────────────────────────
  if (activeView === 'table') {
    let assigneeRowIds: number[] | null = null;

    // Non-privileged roles: always show only their own content rows
    const effectiveAssigneeId = !canSeeCalendar ? user.id : assignee
      ? (allTeamMembers.find(m => m.full_name === assignee)?.id ?? assignee)
      : null;

    if (effectiveAssigneeId) {
      const [{ data: taskRows }, { data: preferredRows }] = await Promise.all([
        supabase.from('tasks').select('content_row_id').eq('assignee_id', effectiveAssigneeId),
        supabase.from('content_rows').select('id').eq('preferred_assignee_id', effectiveAssigneeId),
      ]);
      const ids = new Set<number>();
      for (const t of taskRows ?? []) ids.add(t.content_row_id);
      for (const r of preferredRows ?? []) ids.add(r.id);
      assigneeRowIds = [...ids];
    }

    const rowClient = supabaseAdmin;
    let rowQuery = rowClient
      .from('content_rows')
      .select('id, client_name, platform, content_type, posting_date, status, source, auto_create_tasks, created_at, preferred_assignee_name, preferred_assignee_id, tasks(id, task_type, status, assignee_id, internal_deadline)')
      .gte('posting_date', firstDay)
      .lte('posting_date', lastDay)
      .order('posting_date', { ascending: true });

    if (client) rowQuery = rowQuery.eq('client_name', client);
    if (platform) rowQuery = rowQuery.eq('platform', platform);
    if (assigneeRowIds !== null) {
      rowQuery = rowQuery.in('id', assigneeRowIds.length > 0 ? assigneeRowIds : [-1]);
    }

    const [rowsResult, clientsResult, platformsResult, designersResult] = await Promise.all([
      rowQuery,
      supabase.from('content_rows').select('client_name').not('client_name', 'is', null).order('client_name'),
      supabase.from('content_rows').select('platform').order('platform'),
      supabase.from('profiles').select('id, full_name')
        .in('role', mediaRoles.length > 0 ? mediaRoles : ['__none__'])
        .eq('is_active', true).order('full_name'),
    ]);

    const uniqueClients = [...new Set(
      (clientsResult.data ?? []).map((r: { client_name: string }) => r.client_name)
    )].filter(Boolean) as string[];

    const uniquePlatforms = [...new Set(
      (platformsResult.data ?? []).map((r: { platform: string }) => r.platform)
    )].filter(Boolean) as string[];

    // Full task details (PipelineTask) for the employee tree's task-detail dialog.
    // Only the employee view opens the dialog, so skip this query for privileged users.
    const pipelineTasksResult = !canSeeCalendar
      ? await supabaseAdmin
          .from('task_pipeline_health')
          .select('*')
          .eq('assignee_id', user.id)
          .gte('posting_date', firstDay)
          .lte('posting_date', lastDay)
      : { data: [] as PipelineTask[] };

    return (
      <div className="space-y-4">
        <div className="glass-panel rounded-xl px-5 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Content Operations</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">{activeMonth}</p>
          </div>
          <div className="flex items-center gap-2">
            {tabs}
            {canRedistribute && <RedistributeButton month={activeMonth} />}
          </div>
        </div>
        <ContentTable
          rows={(rowsResult.data ?? []) as Parameters<typeof ContentTable>[0]['rows']}
          clients={uniqueClients}
          platforms={uniquePlatforms}
          designers={designersResult.data ?? []}
          teamMembers={allTeamMembers}
          activeClient={client ?? null}
          activePlatform={platform ?? null}
          activeAssignee={assignee ?? null}
          activeMonth={activeMonth}
          canImport={canSeeCalendar}
          hideEmployee={!canSeeCalendar}
          showTeamFilter={canSeeCalendar}
          currentUserId={user.id}
          taskTypeRoles={taskTypeRoles}
          mediaTaskTypes={mediaTaskTypes}
          publishingTaskTypes={publishingTaskTypes}
          pipelineTasks={(pipelineTasksResult.data ?? []) as PipelineTask[]}
        />
      </div>
    );
  }

  // ── CALENDAR (all tasks) or EMPLOYEES (media tasks) ───────────────────────
  const isEmployeeView = activeView === 'employees';

  let taskQuery = supabaseAdmin.from('task_pipeline_health').select('*');

  if (isEmployeeView) {
    taskQuery = taskQuery
      .gte('internal_deadline', firstDay)
      .lte('internal_deadline', `${lastDay}T23:59:59`)
      .order('internal_deadline', { ascending: true });
    // Privileged users browsing a specific employee: restrict to media tasks only
    // Non-privileged employees: show ALL their own tasks (any type)
    if (canSeeCalendar && mediaTaskTypes.length > 0) {
      taskQuery = taskQuery.in('task_type', mediaTaskTypes);
    }
  } else {
    taskQuery = taskQuery
      .gte('posting_date', firstDay)
      .lte('posting_date', lastDay)
      .order('posting_date', { ascending: true });
  }
  if (client) taskQuery = taskQuery.eq('client_name', client);

  if (!canSeeCalendar && isEmployeeView) {
    taskQuery = taskQuery.eq('assignee_id', user.id);
  } else if (assignee) {
    const members = isEmployeeView ? mediaProducers : allTeamMembers;
    const calAssigneeId = members.find(m => m.full_name === assignee)?.id ?? assignee;
    taskQuery = taskQuery.eq('assignee_id', calAssigneeId);
  }

  const [tasks, clientsRes, holidaysRes] = await Promise.all([
    taskQuery,
    supabase.from('content_rows').select('client_name').not('client_name', 'is', null).order('client_name'),
    supabaseAdmin.from('public_holidays').select('holiday_date, name').order('holiday_date'),
  ]);

  const uniqueClients = [...new Set(
    (clientsRes.data ?? []).map((r: { client_name: string }) => r.client_name)
  )].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Content</h1>
        <div className="flex items-center gap-2">
          {tabs}
          {canRedistribute && <RedistributeButton month={activeMonth} />}
        </div>
      </div>
      <ContentCalendar
        key={`${activeView}-${assignee ?? 'all'}-${client ?? 'all'}-${firstDay.slice(0, 7)}`}
        tasks={(tasks.data ?? []) as PipelineTask[]}
        currentMonth={firstDay.slice(0, 7)}
        clients={uniqueClients}
        teamMembers={!canSeeCalendar ? [] : isEmployeeView ? mediaProducers : allTeamMembers}
        canImport={canSeeCalendar}
        activeClient={client ?? null}
        activeAssignee={assignee ?? null}
        holidays={(holidaysRes.data ?? []) as { holiday_date: string; name: string }[]}
        view={activeView}
        currentUserId={user.id}
        taskTypeRoles={taskTypeRoles}
        mediaTaskTypes={mediaTaskTypes}
        publishingTaskTypes={publishingTaskTypes}
      />
    </div>
  );
}
