import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiChat } from '@/lib/ai';

export const runtime = 'nodejs';

const VIDEO_TYPES = new Set(['reel', 'video', 'youtube']);

function requiredSpecialty(contentType: string): 'video_editor' | 'graphic_designer' {
  return VIDEO_TYPES.has(contentType.toLowerCase()) ? 'video_editor' : 'graphic_designer';
}

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

  // Fetch tasks with content_type
  const { data: tasks, error } = await supabaseAdmin
    .from('task_pipeline_health')
    .select('task_id, task_type, internal_deadline, task_status, assignee_id, assignee_name, client_name, platform, content_type, posting_date')
    .in('task_id', task_ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tasks?.length) return NextResponse.json({ suggestions: [], all_clear: true });

  const assigneeIds = [...new Set(tasks.map(t => t.assignee_id).filter((id): id is string => !!id))];

  // Fetch assignee specialties
  const { data: assigneeProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, specialty, role')
    .in('id', assigneeIds.length > 0 ? assigneeIds : ['00000000-0000-0000-0000-000000000000']);

  const specialtyMap: Record<string, string | null> = {};
  for (const p of assigneeProfiles ?? []) specialtyMap[p.id] = p.specialty;

  const today = new Date().toISOString().slice(0, 10);

  // Fetch approved leave
  const { data: leaves } = assigneeIds.length > 0
    ? await supabaseAdmin
        .from('leave_requests')
        .select('id, user_id, start_date, end_date')
        .in('user_id', assigneeIds)
        .eq('status', 'approved')
        .gte('end_date', today)
    : { data: [] };

  // Fetch overall workload from team_load_report (used only for free_capacity check)
  const { data: workload } = assigneeIds.length > 0
    ? await supabaseAdmin
        .from('team_load_report')
        .select('id, active_total, max_concurrent_tasks')
        .in('id', assigneeIds)
    : { data: [] };

  // Fetch per-content-type daily caps from the admin capacity page
  const { data: caps } = assigneeIds.length > 0
    ? await supabaseAdmin
        .from('user_content_capacity')
        .select('user_id, content_type, task_type, daily_cap')
        .in('user_id', assigneeIds)
    : { data: [] };

  // cap lookup: `${user_id}|${content_type}|${task_type}` → daily_cap
  const capLookup: Record<string, number> = {};
  for (const c of caps ?? []) {
    capLookup[`${c.user_id}|${c.content_type}|${c.task_type}`] = c.daily_cap;
  }

  // Count active tasks per assignee per content_type per task_type per posting_date
  const { data: activeTaskRows } = assigneeIds.length > 0
    ? await supabaseAdmin
        .from('tasks')
        .select('assignee_id, task_type, content_rows!inner(posting_date, content_type)')
        .in('assignee_id', assigneeIds)
        .not('status', 'in', '("done","approved")')
    : { data: [] };

  // load lookup: `${assignee_id}|${task_type}|${posting_date}|${content_type}` → count
  const loadLookup: Record<string, number> = {};
  for (const t of activeTaskRows ?? []) {
    const cr = t.content_rows as { posting_date: string; content_type: string } | null;
    if (!cr || !t.assignee_id) continue;
    const key = `${t.assignee_id}|${t.task_type}|${cr.posting_date}|${cr.content_type}`;
    loadLookup[key] = (loadLookup[key] ?? 0) + 1;
  }

  // Fetch ALL active designers to check free capacity for proactive suggestions
  const { data: allDesigners } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, specialty, role')
    .eq('is_active', true)
    .in('role', ['designer', 'smo']);

  const { data: allWorkload } = await supabaseAdmin
    .from('team_load_report')
    .select('id, active_total, max_concurrent_tasks');

  const workloadMap: Record<string, { active_total: number; max_concurrent_tasks: number }> = {};
  for (const w of allWorkload ?? []) workloadMap[w.id] = w;

  type ConflictType = 'leave_overlap' | 'over_capacity' | 'tight_deadline' | 'skill_mismatch' | 'free_capacity';

  interface Conflict {
    task_id: number;
    task_type: string;
    assignee_id: string | null;
    assignee_name: string;
    client: string;
    content_type: string;
    posting_date: string;
    deadline: string;
    conflict_type: ConflictType;
    leave_start?: string;
    leave_end?: string;
    current_load?: number;
    max_capacity?: number;
    hours_until_deadline?: number;
    assigned_specialty?: string | null;
    required_specialty?: string;
    suggested_assignee_name?: string;
  }

  const conflicts: Conflict[] = [];

  for (const task of tasks) {
    if (!task.internal_deadline) continue;

    const deadlineDate = task.internal_deadline.slice(0, 10);
    const hoursUntil = (new Date(task.internal_deadline).getTime() - Date.now()) / 3_600_000;
    const contentType = (task.content_type ?? '').toLowerCase();
    const reqSpecialty = task.task_type === 'design' ? requiredSpecialty(contentType) : null;

    if (!task.assignee_id) continue;

    // 1. Skill mismatch: reel/video assigned to graphic-only designer
    if (reqSpecialty && specialtyMap[task.assignee_id] !== null) {
      const assignedSpec = specialtyMap[task.assignee_id];
      if (assignedSpec && assignedSpec !== reqSpecialty) {
        // Find a better match
        const betterMatch = (allDesigners ?? []).find(d =>
          d.role === 'designer' &&
          (d.specialty === reqSpecialty || d.specialty === null) &&
          d.id !== task.assignee_id &&
          (workloadMap[d.id]?.active_total ?? 0) < (workloadMap[d.id]?.max_concurrent_tasks ?? 10)
        );
        conflicts.push({
          task_id: task.task_id,
          task_type: task.task_type,
          assignee_id: task.assignee_id,
          assignee_name: task.assignee_name ?? 'Unknown',
          client: task.client_name ?? '',
          content_type: contentType,
          posting_date: task.posting_date,
          deadline: task.internal_deadline,
          conflict_type: 'skill_mismatch',
          assigned_specialty: assignedSpec,
          required_specialty: reqSpecialty,
          suggested_assignee_name: betterMatch?.full_name,
          hours_until_deadline: hoursUntil,
        });
        continue;
      }
    }

    // 2. Leave overlap
    const leaveConflict = (leaves ?? []).find(
      l => l.user_id === task.assignee_id &&
           deadlineDate >= l.start_date &&
           deadlineDate <= l.end_date
    );
    if (leaveConflict) {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        content_type: contentType,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'leave_overlap',
        leave_start: leaveConflict.start_date,
        leave_end: leaveConflict.end_date,
        hours_until_deadline: hoursUntil,
      });
      continue;
    }

    // 3. Over capacity — check per content_type + task_type + posting_date cap
    const capKey = `${task.assignee_id}|${contentType}|${task.task_type}`;
    const dailyCap = capLookup[capKey] ?? null;
    if (dailyCap !== null) {
      const loadKey = `${task.assignee_id}|${task.task_type}|${task.posting_date}|${contentType}`;
      const currentLoad = loadLookup[loadKey] ?? 0;
      if (currentLoad > dailyCap) {
        conflicts.push({
          task_id: task.task_id,
          task_type: task.task_type,
          assignee_id: task.assignee_id,
          assignee_name: task.assignee_name ?? 'Unknown',
          client: task.client_name ?? '',
          content_type: contentType,
          posting_date: task.posting_date,
          deadline: task.internal_deadline,
          conflict_type: 'over_capacity',
          current_load: currentLoad,
          max_capacity: dailyCap,
          hours_until_deadline: hoursUntil,
        });
        continue;
      }
    }

    // 4. Tight deadline — only flag if task hasn't been started yet (todo status)
    // Flagging working_on_it/submitted tasks as "tight" is noise: they're already in progress
    if (hoursUntil > 0 && hoursUntil < 24 && task.task_status === 'todo') {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        content_type: contentType,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'tight_deadline',
        hours_until_deadline: hoursUntil,
      });
      continue;
    }

    // 5. Free capacity: assignee has task far in future but low current load — suggest start early
    const daysUntil = hoursUntil / 24;
    const assigneeLoad = (workload ?? []).find(w => w.id === task.assignee_id);
    const currentTasks = assigneeLoad?.active_total ?? 0;
    if (daysUntil > 7 && currentTasks <= 1) {
      conflicts.push({
        task_id: task.task_id,
        task_type: task.task_type,
        assignee_id: task.assignee_id,
        assignee_name: task.assignee_name ?? 'Unknown',
        client: task.client_name ?? '',
        content_type: contentType,
        posting_date: task.posting_date,
        deadline: task.internal_deadline,
        conflict_type: 'free_capacity',
        current_load: currentTasks,
        hours_until_deadline: hoursUntil,
      });
    }
  }

  if (conflicts.length === 0) {
    return NextResponse.json({ suggestions: [], all_clear: true });
  }

  // Ask AI for suggestions
  const systemPrompt = `You are a task scheduling assistant for a creative social media agency.
Analyze the following task assignment issues and suggest the best resolution for each.

Conflict types:
- skill_mismatch: wrong specialist assigned (e.g. reel given to graphic designer instead of video editor)
- leave_overlap: assignee is on approved leave during deadline
- over_capacity: assignee has too many concurrent tasks
- tight_deadline: deadline is within 48 hours
- free_capacity: assignee has very few tasks and deadline is far away — they can start immediately

For each conflict, choose ONE action:
- "reassign": give to a different team member with the right skill and availability
- "start_early": person is free now — start the task today, don't wait for deadline
- "move_before": move deadline earlier, before leave/conflict
- "move_after": move deadline after conflict (only if posting date allows)
- "accept_risk": keep as-is, manageable risk

Respond ONLY with a valid JSON array — no text outside JSON:
[{"task_id": <number>, "suggestion": "<action>", "reasoning": "<1-2 sentences>", "urgency": "high"|"medium"|"low"}]`;

  let aiSuggestions: Array<{ task_id: number; suggestion: string; reasoning: string; urgency: string }> = [];

  try {
    const raw = await aiChat(
      [{ role: 'user', text: `Issues:\n${JSON.stringify(conflicts, null, 2)}` }],
      systemPrompt,
      false
    );
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) aiSuggestions = JSON.parse(match[0]);
  } catch {
    // AI unavailable — return conflicts with default suggestions
  }

  const results = conflicts.map(c => {
    const ai = aiSuggestions.find(s => s.task_id === c.task_id);
    const defaultSuggestion = c.conflict_type === 'skill_mismatch' ? 'reassign'
      : c.conflict_type === 'free_capacity' ? 'start_early'
      : 'reassign';
    const defaultUrgency = c.conflict_type === 'skill_mismatch' ? 'high'
      : c.conflict_type === 'free_capacity' ? 'low'
      : 'medium';
    return {
      ...c,
      suggestion: ai?.suggestion ?? defaultSuggestion,
      reasoning: ai?.reasoning ?? (
        c.conflict_type === 'skill_mismatch'
          ? `This ${c.content_type} task requires a video editor but is assigned to a graphic designer.${c.suggested_assignee_name ? ` Consider reassigning to ${c.suggested_assignee_name}.` : ''}`
          : c.conflict_type === 'free_capacity'
          ? `${c.assignee_name} currently has only ${c.current_load ?? 0} active task(s) and the deadline is ${Math.round((c.hours_until_deadline ?? 0) / 24)} days away — they can start this now.`
          : 'Manual review recommended.'
      ),
      urgency: ai?.urgency ?? defaultUrgency,
    };
  });

  return NextResponse.json({ suggestions: results, all_clear: false });
}
