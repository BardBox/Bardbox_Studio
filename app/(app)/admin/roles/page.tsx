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
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) redirect('/manager');

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
      <div>
        <h1 className="text-2xl font-bold">Roles</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Define and manage team roles. Assign roles to members via the Team page.
        </p>
      </div>
      <RolesManager initialRoles={rolesWithCounts} />
    </div>
  );
}
