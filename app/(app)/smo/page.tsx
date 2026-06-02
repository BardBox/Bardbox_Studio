import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CalendarGrid } from '@/components/smo/CalendarGrid';
import type { PipelineTask } from '@/lib/types';

export default async function SmoPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

  const { data: tasks } = await supabase
    .from('task_pipeline_health')
    .select('*')
    .eq('assignee_id', user!.id)
    .eq('task_type', 'post')
    .eq('task_status', 'approved')
    .gte('posting_date', startOfMonth)
    .lte('posting_date', endOfNextMonth)
    .order('posting_date', { ascending: true })
    .order('posting_time', { ascending: true });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Posting Calendar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Approved posts ready to publish â€” this and next month
        </p>
      </div>
      <CalendarGrid initialTasks={(tasks ?? []) as PipelineTask[]} />
    </div>
  );
}
