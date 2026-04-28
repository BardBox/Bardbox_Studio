import { createClient } from '@/lib/supabase/server';
import { AllTasksTable } from '@/components/manager/AllTasksTable';
import type { PipelineTask, UserProfile } from '@/lib/types';

export default async function ManagerTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; client?: string; assignee?: string }>;
}) {
  const { status, client, assignee } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('task_pipeline_health')
    .select('*')
    .order('internal_deadline', { ascending: true });

  if (status) query = query.eq('task_status', status);
  if (client) query = query.eq('client_name', client);
  if (assignee) query = query.eq('assignee_id', assignee);

  const [tasksRes, teamRes, clientsRes] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    supabase.from('clients').select('name').eq('is_active', true).order('name'),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">All Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">Assign, filter, and manage every task.</p>
      </div>
      <AllTasksTable
        initialTasks={(tasksRes.data ?? []) as PipelineTask[]}
        team={(teamRes.data ?? []) as UserProfile[]}
        clients={(clientsRes.data ?? []).map((c: { name: string }) => c.name)}
        filterStatus={status ?? ''}
        filterClient={client ?? ''}
        filterAssignee={assignee ?? ''}
      />
    </div>
  );
}
