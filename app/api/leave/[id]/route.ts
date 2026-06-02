import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiGenerate } from '@/lib/ai';

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

// Ask Claude to suggest before/after/reassign for each conflicting task
async function getAiSuggestion(task: {
  task_type: string;
  platform: string;
  content_type: string;
  posting_date: string;
  internal_deadline: string;
  client_name: string | null;
}, leaveStart: string, leaveEnd: string): Promise<{ suggestion: 'before' | 'after' | 'reassign'; reasoning: string }> {
  const deadlineDate = new Date(task.internal_deadline);
  const leaveStartDate = new Date(leaveStart);
  const leaveEndDate = new Date(leaveEnd);
  const postingDate = new Date(task.posting_date);

  const daysBeforeLeave = Math.floor((leaveStartDate.getTime() - deadlineDate.getTime()) / 86400000);
  const daysAfterLeaveToPosting = Math.floor((postingDate.getTime() - leaveEndDate.getTime()) / 86400000);

  try {
    const prompt = `A team member is going on leave from ${leaveStart} to ${leaveEnd}.

Task details:
- Type: ${task.task_type} (${task.platform} / ${task.content_type})
- Client: ${task.client_name ?? 'Unknown'}
- Current deadline: ${task.internal_deadline.slice(0, 10)}
- Posting date: ${task.posting_date}
- Days available BEFORE leave starts: ${daysBeforeLeave}
- Days available AFTER leave ends before posting: ${daysAfterLeaveToPosting}

Should this task be:
A) "before" - completed before leave starts (only if ${daysBeforeLeave} >= 1)
B) "after" - completed after leave ends (only if ${daysAfterLeaveToPosting} >= 2)
C) "reassign" - reassigned to another team member

Reply in JSON only: {"suggestion":"before|after|reassign","reasoning":"one sentence why"}`;

    const text = await aiGenerate(prompt, false);
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { suggestion: parsed.suggestion, reasoning: parsed.reasoning };
  } catch {
    // Fallback logic if AI fails
    if (daysBeforeLeave >= 1) return { suggestion: 'before', reasoning: 'Sufficient time to complete before leave.' };
    if (daysAfterLeaveToPosting >= 2) return { suggestion: 'after', reasoning: 'Can be completed after leave with time before posting.' };
    return { suggestion: 'reassign', reasoning: 'No viable window before or after leave — reassignment recommended.' };
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaveId = Number(id);
  if (!leaveId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['hr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only HR or admin can review leave requests' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, review_notes } = body;

  if (!['approved', 'denied'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or denied' }, { status: 400 });
  }

  // Update leave status
  const { data: leave, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    })
    .eq('id', leaveId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On approval: detect conflicting tasks and generate AI suggestions
  if (status === 'approved') {
    const { data: conflictingTasks } = await supabaseAdmin
      .from('tasks')
      .select(`
        id, task_type, internal_deadline, status,
        content_rows!inner(client_name, platform, content_type, posting_date)
      `)
      .eq('assignee_id', leave.user_id)
      .not('status', 'in', '("done","approved")')
      .gte('internal_deadline', `${leave.start_date}T00:00:00`)
      .lte('internal_deadline', `${leave.end_date}T23:59:59`);

    if (conflictingTasks && conflictingTasks.length > 0) {
      for (const task of conflictingTasks) {
        const cr = (task as Record<string, unknown>).content_rows as {
          client_name: string | null; platform: string; content_type: string; posting_date: string;
        };

        const { suggestion, reasoning } = await getAiSuggestion(
          {
            task_type: task.task_type,
            platform: cr.platform,
            content_type: cr.content_type,
            posting_date: cr.posting_date,
            internal_deadline: task.internal_deadline,
            client_name: cr.client_name,
          },
          leave.start_date,
          leave.end_date
        );

        await supabaseAdmin.from('leave_conflict_tasks').upsert({
          leave_request_id: leaveId,
          task_id: task.id,
          ai_suggestion: suggestion,
          ai_reasoning: reasoning,
          resolution: 'pending',
        }, { onConflict: 'leave_request_id,task_id' });
      }
    }
  }

  return NextResponse.json({
    ...leave,
    conflicts_detected: status === 'approved'
      ? ((await supabaseAdmin
          .from('leave_conflict_tasks')
          .select('id', { count: 'exact', head: true })
          .eq('leave_request_id', leaveId)
          .eq('resolution', 'pending')).count ?? 0)
      : 0,
  });
}
