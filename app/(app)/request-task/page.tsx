import { createClient } from '@/lib/supabase/server';
import { RequestTaskForm } from '@/components/shared/RequestTaskForm';
import type { Client } from '@/lib/types';

export default async function RequestTaskPage() {
  const supabase = await createClient();

  const [{ data: clients }, { data: { user } }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 tracking-tight">Request a Task</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Submit a content task for manager approval.</p>
      </div>
      <RequestTaskForm
        clients={(clients ?? []) as Client[]}
        userId={user?.id ?? ''}
      />
    </div>
  );
}
