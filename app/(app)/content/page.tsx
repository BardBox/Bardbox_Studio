import { createClient } from '@/lib/supabase/server';
import { ContentCalendar } from '@/components/content/ContentCalendar';
import { ContentTable } from '@/components/content/ContentTable';
import type { PipelineTask } from '@/lib/types';
import Link from 'next/link';

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; client?: string; platform?: string; view?: string; assignee?: string }>;
}) {
  const { month, client, platform, view, assignee } = await searchParams;
  const supabase = await createClient();

  const now = new Date();
  const activeMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [ymYear, ymMonth] = activeMonth.split('-').map(Number);
  const firstDay = `${activeMonth}-01`;
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate();
  const lastDay = `${activeMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const showTable = view !== 'calendar';

  // Team members for filter in both views
  const { data: teamMembers } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['designer', 'smo'])
    .eq('is_active', true)
    .order('role')
    .order('full_name');

  const allTeamMembers = (teamMembers ?? []) as { id: string; full_name: string; role: string }[];

  if (showTable) {
    // If filtering by team member, get matching content_row_ids first
    let assigneeRowIds: number[] | null = null;
    if (assignee) {
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('content_row_id')
        .eq('assignee_id', assignee);
      assigneeRowIds = (taskRows ?? []).map((t: { content_row_id: number }) => t.content_row_id);
    }

    let rowQuery = supabase
      .from('content_rows')
      .select('id, client_name, platform, content_type, posting_date, status, source, auto_create_tasks, created_at, tasks(id, task_type, status, assignee_id, internal_deadline)')
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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Content</h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/content?view=table&month=${activeMonth}${client ? `&client=${client}` : ''}${platform ? `&platform=${platform}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${showTable ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              Table
            </Link>
            <Link
              href={`/content?view=calendar&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${!showTable ? 'bg-secondary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              Calendar
            </Link>
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

  // Calendar view
  let taskQuery = supabase
    .from('task_pipeline_health')
    .select('*')
    .gte('posting_date', firstDay)
    .lte('posting_date', lastDay)
    .order('posting_date', { ascending: true });

  if (client) taskQuery = taskQuery.eq('client_name', client);
  if (assignee) taskQuery = taskQuery.eq('assignee_id', assignee);

  const [tasks, clientsRes] = await Promise.all([
    taskQuery,
    supabase.from('content_rows').select('client_name').not('client_name', 'is', null).order('client_name'),
  ]);

  const uniqueClients = [...new Set(
    (clientsRes.data ?? []).map((r: { client_name: string }) => r.client_name)
  )].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Content</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/content?view=table&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
            className="text-xs px-3 py-1.5 rounded-md transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Table
          </Link>
          <Link
            href={`/content?view=calendar&month=${activeMonth}${client ? `&client=${client}` : ''}${assignee ? `&assignee=${assignee}` : ''}`}
            className="text-xs px-3 py-1.5 rounded-md transition-colors bg-secondary font-medium"
          >
            Calendar
          </Link>
        </div>
      </div>
      <ContentCalendar
        tasks={(tasks.data ?? []) as PipelineTask[]}
        currentMonth={firstDay.slice(0, 7)}
        clients={uniqueClients}
        teamMembers={allTeamMembers}
        activeClient={client ?? null}
        activeAssignee={assignee ?? null}
      />
    </div>
  );
}
