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
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role, id').eq('id', user.id).single();
  if (!profile || !['manager', 'admin'].includes(profile.role)) return null;
  return user;
}

// PATCH /api/admin/users/[id]
// Body: { full_name?, role?, max_concurrent_tasks?, is_active?, password? }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await assertManagerOrAdmin();
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { password, ...profileFields } = body;

  if (Object.keys(profileFields).length > 0) {
    const allowed = [
        'full_name', 'role', 'max_concurrent_tasks', 'daily_capacity', 'is_active',
        'employee_id', 'designation', 'date_of_joining', 'employment_type',
        'date_of_birth', 'emergency_contact', 'specialty',
      ];
    const DATE_FIELDS = ['date_of_birth', 'date_of_joining'];
    const filtered = Object.fromEntries(
      Object.entries(profileFields)
        .filter(([k]) => allowed.includes(k))
        .map(([k, v]) => [k, DATE_FIELDS.includes(k) && v === '' ? null : v])
    );
    // Migrate legacy role values that no longer exist in the check constraint
    if (filtered.role === 'video_editor') filtered.role = 'designer';
    if (Object.keys(filtered).length > 0) {
      const { error } = await supabaseAdmin
        .from('profiles').update(filtered).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (password) {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
