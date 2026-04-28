import { createClient } from '@/lib/supabase/server';
import { CeoDashboard } from '@/components/ceo/CeoDashboard';
import type { PipelineTask, PipelineSummary, TeamMember, ThroughputRow, ClientHealth } from '@/lib/types';

export default async function CeoPage() {
  const supabase = await createClient();

  const [summary, teamLoad, overdue, throughput, clientHealth, pendingApprovals] =
    await Promise.all([
      supabase.from('pipeline_summary').select('*').single(),
      supabase.from('team_load_report').select('*'),
      supabase
        .from('task_pipeline_health')
        .select('*')
        .in('pressure_level', ['overdue', 'critical'])
        .order('internal_deadline', { ascending: true }),
      supabase.from('weekly_throughput').select('*'),
      supabase.from('client_health').select('*'),
      supabase
        .from('pending_approvals')
        .select('*')
        .order('internal_deadline', { ascending: true }),
    ]);

  return (
    <CeoDashboard
      summary={(summary.data ?? {}) as PipelineSummary}
      teamLoad={(teamLoad.data ?? []) as TeamMember[]}
      overdueTasks={(overdue.data ?? []) as PipelineTask[]}
      throughput={(throughput.data ?? []) as ThroughputRow[]}
      clientHealth={(clientHealth.data ?? []) as ClientHealth[]}
      pendingApprovals={(pendingApprovals.data ?? []) as PipelineTask[]}
    />
  );
}
