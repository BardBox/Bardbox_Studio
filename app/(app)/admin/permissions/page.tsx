import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { PermissionsMatrix } from '@/components/admin/PermissionsMatrix';
import { ALL_ROUTES } from '@/lib/nav';
import type { UserRole } from '@/lib/types';

export default async function PermissionsPage() {
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
  if (!profile || profile.role !== 'admin') redirect('/manager');

  // Load roles dynamically so any role added via Roles page appears here automatically
  const [{ data: rolesRows }, { data: permRows }] = await Promise.all([
    supabaseAdmin.from('roles').select('key').order('created_at'),
    supabaseAdmin.from('role_permissions').select('role, route, enabled'),
  ]);

  const ALL_ROLES = (rolesRows ?? []).map((r) => r.key as UserRole);

  // Build a map: permissions[role][route] = enabled
  const permissions: Record<string, Record<string, boolean>> = {};
  for (const role of ALL_ROLES) {
    permissions[role] = {};
    for (const r of ALL_ROUTES) permissions[role][r.href] = false;
  }
  for (const row of permRows ?? []) {
    if (permissions[row.role]) permissions[row.role][row.route] = row.enabled;
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Permissions</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Control page access per role · changes take effect on next page load
        </p>
      </div>
      <PermissionsMatrix
        roles={ALL_ROLES}
        routes={ALL_ROUTES}
        initialPermissions={permissions}
      />
    </div>
  );
}
