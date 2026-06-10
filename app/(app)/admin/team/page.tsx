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
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [authResult, profilesResult, rolesResult] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('profiles').select('*, specialty').order('role').order('full_name'),
    supabaseAdmin.from('roles').select('key, label').order('label'),
  ]);

  const authUsers = authResult.data?.users ?? [];
  const profiles = profilesResult.data;
  const roles = rolesResult.data;

  const emailMap = Object.fromEntries(authUsers.map((u) => [u.id, u.email ?? '']));

  const merged: TeamUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap[p.id] ?? p.email ?? '',
    role: p.role as TeamUser['role'],
    is_active: p.is_active,
    max_concurrent_tasks: p.max_concurrent_tasks,
    daily_capacity: p.daily_capacity ?? 3,
    created_at: p.created_at,
    specialty: p.specialty ?? null,
    employee_id: p.employee_id ?? null,
    designation: p.designation ?? null,
    date_of_joining: p.date_of_joining ?? null,
    employment_type: p.employment_type ?? null,
    date_of_birth: p.date_of_birth ?? null,
    emergency_contact: p.emergency_contact ?? null,
  }));

  return <TeamTable initialUsers={merged} roles={(roles ?? []) as { key: string; label: string }[]} />;
}
