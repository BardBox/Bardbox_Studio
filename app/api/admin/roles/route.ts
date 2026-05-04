import { NextResponse } from 'next/server';
import { createClient, supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { key, label, description, default_task_cap } = body;

  if (!key || !label) {
    return NextResponse.json({ error: 'key and label are required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('roles')
    .insert({
      key: key.toLowerCase().replace(/\s+/g, '_'),
      label,
      description: description || null,
      default_task_cap: Number(default_task_cap) || 10,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
