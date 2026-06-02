import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/profile — own profile
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, whatsapp_number, is_active, created_at')
    .eq('id', user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, auth_email: user.email });
}

// PATCH /api/profile — update own full_name / whatsapp_number
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, string> = {};
  if (typeof body.full_name === 'string' && body.full_name.trim())
    updates.full_name = body.full_name.trim();
  if (typeof body.whatsapp_number === 'string')
    updates.whatsapp_number = body.whatsapp_number.trim();
  if (typeof body.avatar_url === 'string')
    updates.avatar_url = body.avatar_url;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
