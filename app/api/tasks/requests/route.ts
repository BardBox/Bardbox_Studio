import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET — list task requests
// Manager sees all; others see only their own
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const isManager = ['manager', 'admin', 'ceo'].includes(profile.role);

  const status = req.nextUrl.searchParams.get('status');

  let query = supabase
    .from('task_requests')
    .select('*, profiles!task_requests_requested_by_fkey(full_name, role)')
    .order('created_at', { ascending: false });

  if (!isManager) query = query.eq('requested_by', user.id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const flat = (data ?? []).map((r: Record<string, unknown>) => {
    const prof = r.profiles as { full_name: string; role: string } | null;
    return { ...r, requester_name: prof?.full_name, requester_role: prof?.role };
  });

  return NextResponse.json(flat);
}

// POST — submit a new task request
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { client_name, platform, content_type, posting_date, caption, notes } = await req.json();
  if (!client_name || !platform || !content_type || !posting_date) {
    return NextResponse.json(
      { error: 'client_name, platform, content_type, posting_date are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.from('task_requests').insert({
    requested_by: user.id,
    client_name,
    platform: platform.toLowerCase(),
    content_type: content_type.toLowerCase(),
    posting_date,
    caption: caption || null,
    notes: notes || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
