import { createClient } from '@/lib/supabase/server';
import { TaskRequestsQueue } from '@/components/manager/TaskRequestsQueue';
import type { TaskRequest } from '@/lib/types';

export default async function ManagerRequestsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('task_requests')
    .select('*, profiles!task_requests_requested_by_fkey(full_name, role)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const requests: TaskRequest[] = (data ?? []).map((r: Record<string, unknown>) => {
    const prof = r.profiles as { full_name: string; role: string } | null;
    return { ...(r as unknown as TaskRequest), requester_name: prof?.full_name, requester_role: prof?.role as TaskRequest['requester_role'] };
  });

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Task Requests</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mt-0.5">Review and approve content requests from the team.</p>
      </div>
      <TaskRequestsQueue initialRequests={requests} />
    </div>
  );
}
