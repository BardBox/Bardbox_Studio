import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import type { UserRole } from '@/lib/types';
import { buildNav, ROLE_DEFAULT_ROUTES } from '@/lib/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  // Middleware already validated the session — this reads from the cookie (no network call)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single();

  if (!profile) redirect('/login');

  let enabledRoutes: string[] = [];
  try {
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('route')
      .eq('role', profile.role)
      .eq('enabled', true);
    enabledRoutes = rolePerms?.map((r: { route: string }) => r.route) ?? [];
  } catch {
    // ignore
  }
  // Fall back to hardcoded defaults if DB returned nothing
  if (enabledRoutes.length === 0) {
    enabledRoutes = ROLE_DEFAULT_ROUTES[profile.role] ?? [];
  }
  const nav = buildNav(enabledRoutes);

  return (
    <AppShell displayName={profile.full_name} role={profile.role as UserRole} nav={nav}>
      {children}
    </AppShell>
  );
}
