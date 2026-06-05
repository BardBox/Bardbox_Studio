import { createClient } from '@/lib/supabase/server';
import { ApprovalQueue } from '@/components/ceo/ApprovalQueue';
import type { PipelineTask } from '@/lib/types';

export default async function ApprovalsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('pending_approvals')
    .select('*')
    .order('internal_deadline', { ascending: true });

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Approval Queue</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Review submitted work and approve or request changes.
        </p>
      </div>
      <ApprovalQueue tasks={(data ?? []) as PipelineTask[]} />
    </div>
  );
}
