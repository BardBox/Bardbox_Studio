import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { CapacityPageShell } from '@/components/admin/CapacityPageShell';
import { getProductionRoleKeys } from '@/lib/role-flags';

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
    .from('profiles').select('role, full_name').eq('id', user.id).single();
  if (!profile) redirect('/login');

  const isAdmin = ['admin', 'manager', 'ceo'].includes(profile.role);

  // ── Employee view: show only the current user's own capacity (read-only) ──
  if (!isAdmin) {
    const { data: myRows } = await supabaseAdmin
      .from('user_content_capacity')
      .select('content_type, task_type, daily_cap, notes')
      .eq('user_id', user.id)
      .order('task_type')
      .order('content_type');

    return (
      <div className="space-y-4">
        <div className="glass-panel rounded-xl px-5 py-3.5">
          <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">My Task Capacity</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
            Your daily cap per content type · set by your manager
          </p>
        </div>
        {(!myRows || myRows.length === 0) ? (
          <div className="glass-panel rounded-xl px-5 py-8 text-center text-sm text-slate-400">
            No capacity limits configured for you yet. Contact your manager.
          </div>
        ) : (
          <div className="glass-panel rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-white/20 dark:border-white/10">
                <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Content Type</th>
                  <th className="px-4 py-3">Task Type</th>
                  <th className="px-4 py-3 text-center">Daily Cap</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {myRows.map((r, i) => (
                  <tr key={i} className="border-b border-white/10 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{r.content_type}</td>
                    <td className="px-4 py-3 capitalize text-slate-500">{r.task_type}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold px-2.5 py-0.5">
                        {r.daily_cap}/day
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{r.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Admin / Manager / CEO / Developer view: full editable matrix ──
  const [
    { data: profiles },
    { data: contentTypes },
  ] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .in('role', await getProductionRoleKeys(supabaseAdmin))
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
    role: p.role as 'designer' | 'video_editor' | 'smo',
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
