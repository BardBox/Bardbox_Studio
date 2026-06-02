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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review submitted work and approve or request changes.
        </p>
      </div>
      <ApprovalQueue tasks={(data ?? []) as PipelineTask[]} />
    </div>
  );
}
