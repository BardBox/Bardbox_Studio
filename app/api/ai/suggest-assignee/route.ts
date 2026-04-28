import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { task_type?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { task_type } = body;
  if (task_type !== 'design' && task_type !== 'post') {
    return NextResponse.json({ error: 'task_type must be design or post' }, { status: 400 });
  }

  const targetRole = task_type === 'design' ? 'designer' : 'smo';

  const { data: team, error } = await supabaseAdmin
    .from('team_load_report')
    .select('id, full_name, role, active_total, max_concurrent_tasks')
    .eq('role', targetRole);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!team || team.length === 0) {
    return NextResponse.json({ error: `no active ${targetRole} found` }, { status: 404 });
  }

  const sorted = [...team].sort((a, b) => (a.active_total ?? 0) - (b.active_total ?? 0));
  const best = sorted[0];

  return NextResponse.json({
    suggested_id: best.id,
    suggested_name: best.full_name,
    reason: `Lowest current workload — ${best.active_total ?? 0} active task${(best.active_total ?? 0) === 1 ? '' : 's'}`,
  });
}
