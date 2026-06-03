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

// GET — all designers + SMOs with their capacity rows
export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profiles, error: profErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, is_active')
    .in('role', ['designer', 'smo'])
    .eq('is_active', true)
    .order('role')
    .order('full_name');

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

  const ids = (profiles ?? []).map(p => p.id);

  const { data: rows, error: rowErr } = await supabaseAdmin
    .from('user_content_capacity')
    .select('id, user_id, content_type, task_type, daily_cap, notes, updated_at')
    .in('user_id', ids)
    .order('content_type');

  if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });

  const rowMap: Record<string, typeof rows> = {};
  for (const r of rows ?? []) {
    if (!rowMap[r.user_id]) rowMap[r.user_id] = [];
    rowMap[r.user_id]!.push(r);
  }

  const result = (profiles ?? []).map(p => ({
    ...p,
    rows: rowMap[p.id] ?? [],
  }));

  return NextResponse.json(result);
}

// POST — add a new capacity row
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { user_id, content_type, task_type, daily_cap, notes } = body;

  if (!user_id || !content_type || !task_type || !daily_cap) {
    return NextResponse.json({ error: 'user_id, content_type, task_type, daily_cap required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_content_capacity')
    .insert({ user_id, content_type: content_type.toLowerCase().trim(), task_type, daily_cap: Number(daily_cap), notes: notes ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
