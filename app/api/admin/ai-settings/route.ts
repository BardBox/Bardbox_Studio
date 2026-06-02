import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) return null;
  return user;
}

// GET â€” return current active settings (api_key masked)
export async function GET() {
  const { data } = await supabaseAdmin
    .from('ai_settings')
    .select('id, provider, model, base_url, api_key')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({
      id: null, provider: 'gemini', model: 'gemini-2.0-flash', base_url: null,
      has_api_key: !!process.env.GEMINI_API_KEY, api_key_source: 'env',
    });
  }

  return NextResponse.json({
    id: data.id,
    provider: data.provider,
    model: data.model,
    base_url: data.base_url,
    has_api_key: !!(data.api_key || process.env.GEMINI_API_KEY),
    api_key_source: data.api_key ? 'db' : 'env',
  });
}

// POST â€” save settings
export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { provider, model, base_url, api_key } = await req.json() as {
    provider: string; model: string; base_url?: string; api_key?: string;
  };

  if (!provider || !model) {
    return NextResponse.json({ error: 'provider and model required' }, { status: 400 });
  }

  // Deactivate old rows
  await supabaseAdmin.from('ai_settings').update({ is_active: false }).eq('is_active', true);

  const { data, error } = await supabaseAdmin
    .from('ai_settings')
    .insert({
      provider,
      model,
      base_url: base_url || null,
      api_key: api_key || null,
      is_active: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
