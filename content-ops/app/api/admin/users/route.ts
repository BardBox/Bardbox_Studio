import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function assertManagerOrAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin'].includes(profile.role)) return null;
  return user;
}

// GET /api/admin/users — list all profiles merged with auth emails
export async function GET() {
  const actor = await assertManagerOrAdmin();
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const [{ data: { users } }, { data: profiles }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabaseAdmin.from('profiles').select('*').order('role').order('full_name'),
  ]);

  const emailMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.email ?? '']));

  const merged = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? p.email ?? '',
  }));

  return NextResponse.json(merged);
}

// POST /api/admin/users — invite a new user (sends invite email via Supabase)
export async function POST(req: NextRequest) {
  const actor = await assertManagerOrAdmin();
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { full_name, email, role, max_concurrent_tasks = 10 } = await req.json();
  if (!full_name || !email || !role) {
    return NextResponse.json({ error: 'full_name, email, and role are required' }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${appUrl}/api/auth/callback`,
      data: { full_name },
    }
  );

  if (inviteError) {
    // If user already exists and invite was re-sent, treat as success
    if (inviteError.message?.includes('already been registered') || inviteError.code === 'email_exists') {
      return NextResponse.json({ ok: true, resent: true });
    }
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    { id: invited.user.id, full_name, role, email, max_concurrent_tasks, is_active: true },
    { onConflict: 'id' }
  );

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(invited.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
