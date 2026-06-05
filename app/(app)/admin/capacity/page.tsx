import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CapacityPageShell } from '@/components/admin/CapacityPageShell';

export default async function CapacityPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager', 'ceo'].includes(profile.role)) redirect('/');

  const [
    { data: profiles },
    { data: contentTypes },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .in('role', ['designer', 'smo'])
      .eq('is_active', true)
      .order('role')
      .order('full_name'),
    supabaseAdmin
      .from('content_types')
      .select('*')
      .order('sort_order')
      .order('label'),
  ]);

  const ids = (profiles ?? []).map(p => p.id);

  const { data: rows } = await supabaseAdmin
    .from('user_content_capacity')
    .select('id, user_id, content_type, task_type, daily_cap, notes, updated_at')
    .in('user_id', ids)
    .order('content_type');

  const rowMap: Record<string, typeof rows> = {};
  for (const r of rows ?? []) {
    if (!rowMap[r.user_id]) rowMap[r.user_id] = [];
    rowMap[r.user_id]!.push(r);
  }

  const initialUsers = (profiles ?? []).map(p => ({
    id: p.id,
    full_name: p.full_name,
    role: p.role as 'designer' | 'smo',
    is_active: p.is_active,
    rows: (rowMap[p.id] ?? []) as {
      id: number; user_id: string; content_type: string;
      task_type: string; daily_cap: number; notes: string | null; updated_at: string;
    }[],
  }));

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Task Capacity</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Per-employee content type caps · weekends auto-excluded
        </p>
      </div>
      <CapacityPageShell
        initialUsers={initialUsers}
        initialContentTypes={contentTypes ?? []}
      />
    </div>
  );
}
