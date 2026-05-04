import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function assertManagerOrAdmin() {
  const supabase = await createClient();
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

  // Use generateLink instead of inviteUserByEmail so the link is returned to the
  // admin UI rather than emailed. Email security scanners (Gmail Safe Browsing etc.)
  // pre-fetch links in emails and consume the single-use OTP before the user clicks.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${appUrl}/api/auth/callback`,
      data: { full_name },
    },
  });

  if (linkError) {
    if (linkError.message?.includes('already been registered') || (linkError as { code?: string }).code === 'email_exists') {
      return NextResponse.json({ ok: true, resent: true });
    }
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
    { id: linkData.user.id, full_name, role, email, max_concurrent_tasks, is_active: true },
    { onConflict: 'id' }
  );

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(linkData.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, invite_link: linkData.properties.action_link });
}
