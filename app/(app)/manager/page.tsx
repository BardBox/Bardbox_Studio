import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ManagerDashboard } from '@/components/manager/ManagerDashboard';
import { CreateTaskDialog } from '@/components/manager/CreateTaskDialog';
import type {
  PipelineSummary, PipelineTask, TeamMember, UserProfile, Client,
} from '@/lib/types';

export default async function ManagerPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  // IST = UTC+5:30; compute today in IST regardless of server timezone
  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + (5 * 60 + 30) * 60_000);
  const todayStr = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;
  // IST midnight in UTC for deadline range queries
  const istDayStart = `${todayStr}T00:00:00+05:30`;
  const istDayEnd   = `${todayStr}T23:59:59+05:30`;

  const [
    { data: summary },
    { data: teamLoad },
    { data: teamMembers },
    { data: clients },
    { data: pendingApprovals },
    { data: activeNow },
    { data: overdueBlocked },
    { data: todayPostings },
    { data: todayDesignDeadlines },
  ] = await Promise.all([
    supabase.from('pipeline_summary').select('*').single(),
    supabase.from('team_load_report').select('*'),
    supabase
      .from('profiles')
      .select('id, full_name, role, max_concurrent_tasks')
      .in('role', ['designer', 'smo'])
      .eq('is_active', true),
    supabase.from('clients').select('*').eq('is_active', true).order('name'),

    // Pending approval: submitted tasks, ordered by deadline urgency
    supabase
      .from('pending_approvals')
      .select('*')
      .limit(30),

    // Currently working_on_it — what each person is working on right now
    supabase
      .from('task_pipeline_health')
      .select('*')
      .eq('task_status', 'working_on_it')
      .order('internal_deadline', { ascending: true }),

    // Overdue or blocked tasks needing manager attention
    supabase
      .from('task_pipeline_health')
      .select('*')
      .or('pressure_level.eq.overdue,task_status.eq.blocked')
      .not('task_status', 'in', '("done","approved")')
      .order('internal_deadline', { ascending: true })
      .limit(30),

    // Posts going live TODAY
    supabase
      .from('task_pipeline_health')
      .select('*')
      .eq('task_type', 'post')
      .eq('posting_date', todayStr)
      .order('posting_time', { ascending: true }),

    // Design tasks whose deadline is TODAY (in IST)
    supabase
      .from('task_pipeline_health')
      .select('*')
      .eq('task_type', 'design')
      .gte('internal_deadline', istDayStart)
      .lte('internal_deadline', istDayEnd)
      .not('task_status', 'in', '("done","approved")')
      .order('internal_deadline', { ascending: true }),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">{todayStr}</p>
        </div>
        <CreateTaskDialog clients={(clients ?? []) as Client[]} />
      </div>
      <ManagerDashboard
        summary={(summary ?? {}) as PipelineSummary}
        teamLoad={(teamLoad ?? []) as TeamMember[]}
        teamMembers={(teamMembers ?? []) as UserProfile[]}
        pendingApprovals={(pendingApprovals ?? []) as PipelineTask[]}
        activeNow={(activeNow ?? []) as PipelineTask[]}
        overdueBlocked={(overdueBlocked ?? []) as PipelineTask[]}
        todayPostings={(todayPostings ?? []) as PipelineTask[]}
        todayDesignDeadlines={(todayDesignDeadlines ?? []) as PipelineTask[]}
      />
    </div>
  );
}
