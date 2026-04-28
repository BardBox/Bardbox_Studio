import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  let query = supabase.from('task_pipeline_health').select('*');

  const status = searchParams.get('status');
  if (status) query = query.eq('task_status', status);

  const assignee = searchParams.get('assignee_id');
  if (assignee) query = query.eq('assignee_id', assignee);

  const client = searchParams.get('client_name');
  if (client) query = query.eq('client_name', client);

  const { data, error } = await query.order('internal_deadline', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    client_name,
    platform,
    content_type,
    brief,
    caption,
    hashtags,
    posting_date,
    posting_time,
  } = body;

  if (!platform || !content_type || !posting_date) {
    return NextResponse.json(
      { error: 'platform, content_type, and posting_date are required' },
      { status: 400 }
    );
  }

  // Insert content_row — DB trigger auto-creates tasks and auto-assigns
  const { data: contentRow, error: rowError } = await supabase
    .from('content_rows')
    .insert({
      client_name: client_name || null,
      platform,
      content_type,
      brief: brief || null,
      caption: caption || null,
      hashtags: hashtags || null,
      posting_date,
      posting_time: posting_time || '10:00:00',
      source: 'in_app',
      created_by: user.id,
    })
    .select()
    .single();

  if (rowError) return NextResponse.json({ error: rowError.message }, { status: 500 });
  return NextResponse.json(contentRow, { status: 201 });
}
