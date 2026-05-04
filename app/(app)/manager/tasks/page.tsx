import { createClient } from '@/lib/supabase/server';
import { AllTasksTable } from '@/components/manager/AllTasksTable';
import type { PipelineTask, UserProfile } from '@/lib/types';

export default async function ManagerTasksPage() {
  const supabase = await createClient();

  const [tasksRes, teamRes, clientsRes] = await Promise.all([
    supabase
      .from('task_pipeline_health')
      .select('*')
      .order('internal_deadline', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('clients')
      .select('name')
      .eq('is_active', true)
      .order('name'),
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
      />
    </div>
  );
}
