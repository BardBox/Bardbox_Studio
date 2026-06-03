import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const date = searchParams.get('date');
  const content_type = searchParams.get('content_type');
  const task_type = searchParams.get('task_type');

  if (!date || !content_type || !task_type) {
    return NextResponse.json({ error: 'date, content_type, task_type required' }, { status: 400 });
  }

  const roleForType = task_type === 'design' ? 'designer' : 'smo';

  const { data: members } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', roleForType)
    .eq('is_active', true)
    .order('full_name');

  if (!members || members.length === 0) return NextResponse.json([]);

  const memberIds = members.map(m => m.id);

  // Capacity caps for this content_type + task_type per member
  const { data: caps } = await supabaseAdmin
    .from('user_content_capacity')
    .select('user_id, daily_cap')
    .in('user_id', memberIds)
    .eq('content_type', content_type.toLowerCase())
    .eq('task_type', task_type);

  const capMap: Record<string, number> = {};
  for (const c of caps ?? []) capMap[c.user_id] = c.daily_cap;

  // Count active tasks per assignee on that date + content_type + task_type
  // Join tasks → content_rows via foreign key content_row_id
  const { data: loadRows } = await supabaseAdmin
    .from('tasks')
    .select('assignee_id, content_rows!inner(posting_date, content_type)')
    .in('assignee_id', memberIds)
    .eq('task_type', task_type)
    .eq('content_rows.posting_date', date)
    .eq('content_rows.content_type', content_type.toLowerCase())
    .not('status', 'in', '("done","approved")');

  const loadMap: Record<string, number> = {};
  for (const row of loadRows ?? []) {
    const aid = row.assignee_id;
    if (aid) loadMap[aid] = (loadMap[aid] ?? 0) + 1;
  }

  return NextResponse.json(
    members.map(m => ({
      user_id: m.id,
      full_name: m.full_name,
      role: m.role,
      daily_cap: capMap[m.id] ?? null,
      current_load: loadMap[m.id] ?? 0,
    }))
  );
}
