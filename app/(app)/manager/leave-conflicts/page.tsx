import { redirect } from 'next/navigation';
import { createClient, supabaseAdmin } from '@/lib/supabase/server';
import { LeaveConflictPanel } from '@/components/manager/LeaveConflictPanel';

export default async function LeaveConflictsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    redirect('/manager');
  }

  const { count } = await supabaseAdmin
    .from('leave_conflict_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('resolution', 'pending');

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Leave Conflicts</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tasks affected by approved leave. AI has analysed each one — review and confirm the adjustment.
        </p>
      </div>
      {(count ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <strong>{count}</strong> task{count !== 1 ? 's' : ''} need your decision.
        </div>
      )}
      <LeaveConflictPanel />
    </div>
  );
}
