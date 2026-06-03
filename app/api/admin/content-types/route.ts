import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function assertAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager', 'ceo'].includes(profile.role)) return null;
  return user;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('content_types')
    .select('*')
    .order('sort_order')
    .order('label');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const actor = await assertAdmin();
  if (!actor) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const { key, label, for_designer, for_smo } = body;
  if (!key || !label) return NextResponse.json({ error: 'key and label required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('content_types')
    .insert({ key: key.toLowerCase().trim().replace(/\s+/g, '_'), label: label.trim(), for_designer: !!for_designer, for_smo: !!for_smo })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
