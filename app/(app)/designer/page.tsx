import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { KanbanBoard } from '@/components/designer/KanbanBoard';
import type { PipelineTask } from '@/lib/types';

export default async function DesignerPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { data: tasks } = await supabase
    .from('task_pipeline_health')
    .select('*')
    .eq('assignee_id', user!.id)
    .eq('task_type', 'design')
    .not('pressure_level', 'eq', 'completed')
    .order('hours_until_deadline', { ascending: true });

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">My Design Tasks</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Click a card to update its status.
        </p>
      </div>
      <KanbanBoard initialTasks={(tasks ?? []) as PipelineTask[]} />
    </div>
  );
}
