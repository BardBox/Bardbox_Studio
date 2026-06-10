import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { RolesManager } from '@/components/admin/RolesManager';

export default async function RolesPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: roles }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from('roles').select('*').order('created_at'),
    supabaseAdmin.from('profiles').select('role, is_active'),
  ]);

  // Compute member counts per role key
  const counts = (profiles ?? []).reduce<Record<string, { total: number; active: number }>>(
    (acc, p) => {
      if (!acc[p.role]) acc[p.role] = { total: 0, active: 0 };
      acc[p.role].total++;
      if (p.is_active) acc[p.role].active++;
      return acc;
    },
    {}
  );

  const rolesWithCounts = (roles ?? []).map((r) => ({
    ...r,
    member_count: counts[r.key]?.total ?? 0,
    active_count: counts[r.key]?.active ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Roles</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Define and manage team roles · assign via Team page
        </p>
      </div>
      <RolesManager initialRoles={rolesWithCounts} />
    </div>
  );
}
