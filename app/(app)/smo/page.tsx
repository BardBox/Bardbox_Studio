import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CalendarGrid } from '@/components/smo/CalendarGrid';
import type { PipelineTask, UserRole } from '@/lib/types';

const MANAGER_ROLES: UserRole[] = ['admin', 'manager', 'ceo'];

export default async function SmoPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const userRole = (profile?.role ?? 'smo') as UserRole;
  const isManager = MANAGER_ROLES.includes(userRole);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);

  let query = supabase
    .from('task_pipeline_health')
    .select('*')
    .eq('task_type', 'post')
    .gte('posting_date', startOfMonth)
    .lte('posting_date', endOfNextMonth)
    .order('posting_date', { ascending: true })
    .order('posting_time', { ascending: true });

  // SMOs only see their own tasks; managers/admins/ceo see all
  if (!isManager) {
    query = query.eq('assignee_id', user!.id);
  }

  const { data: tasks } = await query;

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 tracking-tight">Posting Calendar</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          {isManager ? 'All approved posts this and next month.' : 'Your approved posts ready to publish.'}
        </p>
      </div>
      <CalendarGrid initialTasks={(tasks ?? []) as PipelineTask[]} />
    </div>
  );
}
