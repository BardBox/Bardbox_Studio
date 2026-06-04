import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ContentCalendar } from '@/components/content/ContentCalendar';
import { ContentTable } from '@/components/content/ContentTable';
import { RedistributeButton } from '@/components/content/RedistributeButton';
import type { PipelineTask } from '@/lib/types';
import Link from 'next/link';

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

  const activeView: View = view === 'calendar' ? 'calendar' : view === 'employees' ? 'employees' : 'table';

  const now = new Date();
  const activeMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [ymYear, ymMonth] = activeMonth.split('-').map(Number);
  const firstDay = `${activeMonth}-01`;
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate();
  const lastDay = `${activeMonth}-${String(daysInMonth).padStart(2, '0')}`;

  // Team members — used by all views
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['designer', 'smo'])
    .eq('is_active', true)
    .order('role')
    .order('full_name');

  const allTeamMembers = (teamMembers ?? []) as { id: string; full_name: string; role: string }[];
  const designersOnly = allTeamMembers.filter(m => m.role === 'designer');

  // Shared tab bar links
  const tabs = (
    <div className="flex items-center gap-1 bg-white/40 backdrop-blur-sm border border-white/50 dark:bg-white/10 dark:border-white/20 rounded-full p-1">
      <Link
        href={`/content?view=table&month=${activeMonth}${client ? `&client=${client}` : ''}${platform ? `&platform=${platform}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
        className={tabClass(activeView === 'table')}
      >
        Table
      </Link>
      <Link
        href={`/content?view=calendar&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
        className={tabClass(activeView === 'calendar')}
      >
        Calendar
      </Link>
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
    if (assignee) {
      const assigneeProfile = allTeamMembers.find(m => m.full_name === assignee);
      const assigneeId = assigneeProfile?.id ?? assignee;
      const [{ data: taskRows }, { data: preferredRows }] = await Promise.all([
        supabase.from('tasks').select('content_row_id').eq('assignee_id', assigneeId),
        supabase.from('content_rows').select('id').eq('preferred_assignee_id', assigneeId),
      ]);
      const ids = new Set<number>();
      for (const t of taskRows ?? []) ids.add(t.content_row_id);
      for (const r of preferredRows ?? []) ids.add(r.id);
      assigneeRowIds = [...ids];
    }

    let rowQuery = supabase
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
      supabase.from('profiles').select('id, full_name').eq('role', 'designer').eq('is_active', true).order('full_name'),
    ]);

    const uniqueClients = [...new Set(
      (clientsResult.data ?? []).map((r: { client_name: string }) => r.client_name)
    )].filter(Boolean) as string[];

    const uniquePlatforms = [...new Set(
      (platformsResult.data ?? []).map((r: { platform: string }) => r.platform)
    )].filter(Boolean) as string[];

    return (
      <div className="space-y-4">
        <div className="glass-panel rounded-xl px-5 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Content Operations</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">{activeMonth}</p>
          </div>
          <div className="flex items-center gap-2">
            {tabs}
            <RedistributeButton month={activeMonth} />
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
        />
      </div>
    );
  }

  // ── CALENDAR (all tasks) or EMPLOYEES (design only) ───────────────────────
  const isEmployeeView = activeView === 'employees';

  let taskQuery = supabase
    .from('task_pipeline_health')
    .select('*');

  if (isEmployeeView) {
    // Show design tasks by their internal_deadline (when the designer must submit)
    taskQuery = taskQuery
      .eq('task_type', 'design')
      .gte('internal_deadline', firstDay)
      .lte('internal_deadline', `${lastDay}T23:59:59`)
      .order('internal_deadline', { ascending: true });
  } else {
    taskQuery = taskQuery
      .gte('posting_date', firstDay)
      .lte('posting_date', lastDay)
      .order('posting_date', { ascending: true });
  }
  if (client) taskQuery = taskQuery.eq('client_name', client);
  if (assignee) {
    const members = isEmployeeView ? designersOnly : allTeamMembers;
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
          <RedistributeButton month={activeMonth} />
        </div>
      </div>
      <ContentCalendar
        key={`${activeView}-${assignee ?? 'all'}-${client ?? 'all'}-${firstDay.slice(0, 7)}`}
        tasks={(tasks.data ?? []) as PipelineTask[]}
        currentMonth={firstDay.slice(0, 7)}
        clients={uniqueClients}
        teamMembers={isEmployeeView ? designersOnly : allTeamMembers}
        activeClient={client ?? null}
        activeAssignee={assignee ?? null}
        holidays={(holidaysRes.data ?? []) as { holiday_date: string; name: string }[]}
        view={activeView}
      />
    </div>
  );
}
