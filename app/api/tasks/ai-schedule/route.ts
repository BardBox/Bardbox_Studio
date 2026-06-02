import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiChat } from '@/lib/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { task_ids?: number[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { task_ids } = body;
  if (!Array.isArray(task_ids) || task_ids.length === 0) {
    return NextResponse.json({ suggestions: [], all_clear: true });
  }

  // Fetch tasks via the pipeline health view (has all needed fields)
  const { data: tasks, error } = await supabaseAdmin
    .from('task_pipeline_health')
    .select('task_id, task_type, internal_deadline, task_status, assignee_id, assignee_name, client_name, platform, content_type, posting_date')
    .in('task_id', task_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks?.length) return NextResponse.json({ suggestions: [], all_clear: true });

  const assigneeIds = [...new Set(tasks.map(t => t.assignee_id).filter((id): id is string => !!id))];

  if (assigneeIds.length === 0) {
    return NextResponse.json({ suggestions: [], all_clear: true });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Fetch approved leave for all assignees (current + future)
  const { data: leaves } = await supabaseAdmin
    .from('leave_requests')
    .select('id, user_id, start_date, end_date, reason')
    .in('user_id', assigneeIds)
    .eq('status', 'approved')
    .gte('end_date', today);

  // Fetch workload from team_load_report view
  const { data: workload } = await supabaseAdmin
    .from('team_load_report')
    .select('id, active_total, max_concurrent_tasks')
    .in('id', assigneeIds);

  // Detect conflicts per task
  interface Conflict {
    task_id: number;
    task_type: string;
    assignee_id: string;
    assignee_name: string;
    client: string;
    platform: string;
    posting_date: string;
    deadline: string;
    conflict_type: 'leave_overlap' | 'over_capacity' | 'tight_deadline';
    leave_start?: string;
    leave_end?: string;
    current_load?: number;
    max_capacity?: number;
    hours_until_deadline?: number;
  }

  const conflicts: Conflict[] = [];

  for (const task of tasks) {
    if (!task.assignee_id || !task.internal_deadline) continue;

    const deadlineDate = task.internal_deadline.slice(0, 10);
    const hoursUntil = (new Date(task.internal_deadline).getTime() - Date.now()) / 3_600_000;

    const leaveConflict = leaves?.find(
      l => l.user_id === task.assignee_id &&
           deadlineDate >= l.start_date &&
           deadlineDate <= l.end_date
    );

    const load = workload?.find(w => w.id === task.assignee_id);
    const maxCap = load?.max_concurrent_tasks ?? 10;
    const isOverCapacity = !!load && load.active_total >= maxCap;
    const isTight = hoursUntil > 0 && hoursUntil < 48;

    if (leaveConflict) {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        platform: task.platform,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'leave_overlap',
        leave_start: leaveConflict.start_date,
        leave_end: leaveConflict.end_date,
        hours_until_deadline: hoursUntil,
      });
    } else if (isOverCapacity) {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        platform: task.platform,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'over_capacity',
        current_load: load?.active_total,
        max_capacity: maxCap,
        hours_until_deadline: hoursUntil,
      });
    } else if (isTight) {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        platform: task.platform,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'tight_deadline',
        hours_until_deadline: hoursUntil,
      });
    }
  }

  if (conflicts.length === 0) {
    return NextResponse.json({ suggestions: [], all_clear: true });
  }

  // Ask AI for suggestions on each conflict
  const systemPrompt = `You are a task scheduling assistant for a creative social media agency.
Analyze the following task assignment conflicts and suggest the best resolution for each.
For each conflict choose ONE action:
- "reassign": the task should be given to a different team member
- "move_before": move the internal deadline earlier, before the leave/conflict period
- "move_after": move the deadline to after the conflict period (only if posting date allows)
- "accept_risk": keep as-is, manageable risk

Respond with ONLY a valid JSON array — no explanation outside JSON:
[{"task_id": <number>, "suggestion": "<action>", "reasoning": "<1-2 sentences>", "urgency": "high"|"medium"|"low"}]`;

  let aiSuggestions: Array<{ task_id: number; suggestion: string; reasoning: string; urgency: string }> = [];

  try {
    const raw = await aiChat(
      [{ role: 'user', text: `Conflicts:\n${JSON.stringify(conflicts, null, 2)}` }],
      systemPrompt,
      false
    );
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) aiSuggestions = JSON.parse(match[0]);
  } catch {
    // AI unavailable — return conflicts without suggestions
  }

  const results = conflicts.map(c => {
    const ai = aiSuggestions.find(s => s.task_id === c.task_id);
    return {
      ...c,
      suggestion: ai?.suggestion ?? 'reassign',
      reasoning: ai?.reasoning ?? 'Manual review recommended.',
      urgency: ai?.urgency ?? 'medium',
    };
  });

  return NextResponse.json({ suggestions: results, all_clear: false });
}
