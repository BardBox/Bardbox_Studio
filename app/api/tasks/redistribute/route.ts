import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// POST /api/tasks/redistribute
// Re-runs auto_assign_with_daily_cap on all todo tasks (optionally filtered by month).
// Clears manually_assigned first so the RPC doesn't skip them.
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { month, task_type } = body as { month?: string; task_type?: string };

  // Fetch todo tasks to redistribute
  let query = supabaseAdmin
    .from('task_pipeline_health')
    .select('task_id, posting_date')
    .eq('task_status', 'todo');

  if (task_type) query = query.eq('task_type', task_type);

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    query = query
      .gte('posting_date', `${month}-01`)
      .lte('posting_date', `${month}-${String(last).padStart(2, '0')}`);
  }

  const { data: todoTasks, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!todoTasks?.length) return NextResponse.json({ reassigned: 0 });

  const taskIds = [...new Set(todoTasks.map(t => t.task_id))];

  // Clear assignee + manually_assigned so counts start from zero and the RPC re-balances fairly
  await supabaseAdmin
    .from('tasks')
    .update({ assignee_id: null, manually_assigned: false })
    .in('id', taskIds);

  // Re-run auto-assign for each task sequentially
  let reassigned = 0;
  let firstError: string | null = null;
  for (const taskId of taskIds) {
    const { error } = await supabaseAdmin.rpc('auto_assign_with_daily_cap', { p_task_id: taskId });
    if (!error) {
      reassigned++;
    } else if (!firstError) {
      firstError = `task ${taskId}: ${error.message}`;
    }
  }

  return NextResponse.json({ reassigned, total: taskIds.length, firstError });
}
