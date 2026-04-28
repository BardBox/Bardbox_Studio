import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { KanbanBoard } from '@/components/designer/KanbanBoard';
import type { PipelineTask } from '@/lib/types';

export default async function DesignerPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
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
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Design Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click a card to update its status
        </p>
      </div>
      <KanbanBoard initialTasks={(tasks ?? []) as PipelineTask[]} />
    </div>
  );
}
