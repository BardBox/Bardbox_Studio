import { createClient, supabaseAdmin } from '@/lib/supabase/server';
import { AllTasksTable } from '@/components/manager/AllTasksTable';
import { getTaskTypeRoles } from '@/lib/task-type-flags';
import type { PipelineTask, UserProfile, UserRole } from '@/lib/types';

// Roles that can always see all tasks — does not depend on the roles table being seeded
const PRIVILEGED_ROLES = new Set(['admin', 'manager', 'ceo', 'developer']);

export default async function ManagerTasksPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single();
  const userRole = (profile?.role ?? 'manager') as UserRole;
  const isPrivileged = PRIVILEGED_ROLES.has(userRole);

  const taskTypeRoles = await getTaskTypeRoles(supabase);

  const [tasksRes, teamRes, clientsRes] = await Promise.all([
    (() => {
      // Privileged roles use supabaseAdmin → bypasses RLS, sees every task
      // Non-privileged use user client filtered to their own tasks
      const client = isPrivileged ? supabaseAdmin : supabase;
      let q = client
        .from('task_pipeline_health')
        .select('*')
        .order('internal_deadline', { ascending: true });
      if (!isPrivileged) q = q.eq('assignee_id', user!.id);
      return q;
    })(),
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, role')
      .eq('is_active', true)
      .order('full_name'),
    supabaseAdmin
      .from('clients')
      .select('name')
      .eq('is_active', true)
      .order('name'),
  ]);

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">All Tasks</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">Assign, filter, and manage every task.</p>
      </div>
      <AllTasksTable
        initialTasks={(tasksRes.data ?? []) as PipelineTask[]}
        team={(teamRes.data ?? []) as UserProfile[]}
        clients={(clientsRes.data ?? []).map((c: { name: string }) => c.name)}
        userRole={userRole}
        taskTypeRoles={taskTypeRoles}
      />
    </div>
  );
}
