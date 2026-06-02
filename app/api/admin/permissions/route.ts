import { NextResponse } from 'next/server';
import { createClient, supabaseAdmin } from '@/lib/supabase/server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return null;
  return user;
}

// GET /api/admin/permissions — returns all role_permissions rows
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('role_permissions')
    .select('role, route, enabled')
    .order('role')
    .order('route');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// PATCH /api/admin/permissions — { role, route, enabled }
export async function PATCH(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { role, route, enabled } = await req.json();
  if (!role || !route || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'role, route, enabled required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('role_permissions')
    .upsert({ role, route, enabled }, { onConflict: 'role,route' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
