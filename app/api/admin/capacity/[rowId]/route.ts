import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';

async function getActor() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager', 'ceo'].includes(profile.role)) return null;
  return user;
}

// PATCH — update daily_cap or notes
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rowId } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.daily_cap !== undefined) update.daily_cap = Number(body.daily_cap);
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabaseAdmin
    .from('user_content_capacity')
    .update(update)
    .eq('id', Number(rowId))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — remove a capacity row
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { rowId } = await params;
  const { error } = await supabaseAdmin
    .from('user_content_capacity')
    .delete()
    .eq('id', Number(rowId));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
