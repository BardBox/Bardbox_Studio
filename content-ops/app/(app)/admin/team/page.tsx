import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { TeamTable } from '@/components/admin/TeamTable';
import type { TeamUser } from '@/components/admin/TeamTable';

export default async function TeamPage() {
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
  if (!profile || !['manager', 'admin'].includes(profile.role)) redirect('/login');

  const [{ data: { users: authUsers } }, { data: profiles }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('profiles').select('*').order('role').order('full_name'),
  ]);

  const emailMap = Object.fromEntries((authUsers ?? []).map((u) => [u.id, u.email ?? '']));

  const merged: TeamUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap[p.id] ?? p.email ?? '',
    role: p.role,
    is_active: p.is_active,
    max_concurrent_tasks: p.max_concurrent_tasks,
    created_at: p.created_at,
  }));

  return <TeamTable initialUsers={merged} />;
}
