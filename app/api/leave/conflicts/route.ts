import { NextRequest, NextResponse } from 'next/server';
import { createClient, supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET /api/leave/conflicts — all pending conflict tasks for manager view
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo', 'hr'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('leave_conflict_tasks')
    .select(`
      id, leave_request_id, task_id, ai_suggestion, ai_reasoning, resolution, created_at,
      leave_requests!inner(
        start_date, end_date,
        profiles!leave_requests_user_id_fkey(full_name, role)
      ),
      tasks!inner(
        task_type, internal_deadline, status,
        content_rows!inner(client_name, platform, content_type, posting_date)
      )
    `)
    .eq('resolution', 'pending')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH /api/leave/conflicts — manager resolves a conflict
// Body: { conflict_id, resolution: 'before'|'after'|'reassign', reassign_to_id? }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { conflict_id, resolution, reassign_to_id } = body;

  if (!conflict_id || !['before', 'after', 'reassign'].includes(resolution)) {
    return NextResponse.json({ error: 'conflict_id and valid resolution required' }, { status: 400 });
  }

  // Fetch the conflict with task + leave details
  const { data: conflict, error: fetchErr } = await supabaseAdmin
    .from('leave_conflict_tasks')
    .select(`
      task_id, leave_request_id,
      leave_requests!inner(start_date, end_date, user_id),
      tasks!inner(internal_deadline, content_rows!inner(posting_date))
    `)
    .eq('id', conflict_id)
    .single();

  if (fetchErr || !conflict) return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });

  const lr = (conflict as Record<string, unknown>).leave_requests as { start_date: string; end_date: string; user_id: string };
  const task = (conflict as Record<string, unknown>).tasks as { internal_deadline: string; content_rows: { posting_date: string } };

  const leaveStart = new Date(lr.start_date);
  const leaveEnd = new Date(lr.end_date);
  const currentDeadline = new Date(task.internal_deadline);

  let newDeadline: Date | null = null;
  let newStatus = 'assigned';

  if (resolution === 'before') {
    // Move deadline to 1 day before leave starts
    newDeadline = new Date(leaveStart);
    newDeadline.setDate(newDeadline.getDate() - 1);
    newDeadline.setHours(currentDeadline.getHours(), currentDeadline.getMinutes(), 0, 0);
    newStatus = 'adjusted_before';
  } else if (resolution === 'after') {
    // Move deadline to 1 day after leave ends
    newDeadline = new Date(leaveEnd);
    newDeadline.setDate(newDeadline.getDate() + 1);
    newDeadline.setHours(currentDeadline.getHours(), currentDeadline.getMinutes(), 0, 0);
    newStatus = 'adjusted_after';
  }

  // Update the task
  const taskUpdate: Record<string, unknown> = {
    status: newStatus,
    original_deadline: task.internal_deadline,
    adjustment_reason: `Leave conflict resolved: ${resolution}`,
    updated_at: new Date().toISOString(),
  };

  if (newDeadline) taskUpdate.internal_deadline = newDeadline.toISOString();
  if (resolution === 'reassign' && reassign_to_id) taskUpdate.assignee_id = reassign_to_id;

  const { error: taskErr } = await supabaseAdmin
    .from('tasks')
    .update(taskUpdate)
    .eq('id', conflict.task_id);

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });

  // Mark conflict as resolved
  const { error: conflictErr } = await supabaseAdmin
    .from('leave_conflict_tasks')
    .update({
      resolution,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', conflict_id);

  if (conflictErr) return NextResponse.json({ error: conflictErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, resolution, new_deadline: newDeadline?.toISOString() ?? null });
}
