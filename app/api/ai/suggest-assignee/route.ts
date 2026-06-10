import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiGenerate, RateLimitError } from '@/lib/ai';
import { getTaskTypeRoles } from '@/lib/task-type-flags';

export const runtime = 'nodejs';

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  active_total: number;
  overdue_count: number;
  critical_count: number;
  max_concurrent_tasks: number;
  is_on_leave_today: boolean;
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

  let body: {
    task_type?: string;
    platform?: string;
    content_type?: string;
    brief?: string;
    deadline?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { task_type, platform = '', content_type = '', brief = '', deadline = '' } = body;
  if (!task_type) {
    return NextResponse.json({ error: 'task_type is required' }, { status: 400 });
  }

  const taskTypeRoles = await getTaskTypeRoles(supabaseAdmin);
  const targetRole = taskTypeRoles[task_type];
  if (!targetRole) {
    return NextResponse.json({ error: `unknown task_type: ${task_type}` }, { status: 400 });
  }

  // Fetch team load + leave status in parallel
  const [{ data: loadRows, error: loadErr }, { data: leaveRows, error: leaveErr }] =
    await Promise.all([
      supabaseAdmin
        .from('team_load_report')
        .select('id, full_name, role, active_total, overdue_count, critical_count, max_concurrent_tasks')
        .eq('role', targetRole),
      supabaseAdmin
        .from('team_availability')
        .select('user_id, is_on_leave_today')
        .eq('role', targetRole)
        .eq('is_on_leave_today', true),
    ]);

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (leaveErr) return NextResponse.json({ error: leaveErr.message }, { status: 500 });
  if (!loadRows || loadRows.length === 0) {
    return NextResponse.json({ error: `no active ${targetRole} found` }, { status: 404 });
  }

  const onLeaveToday = new Set((leaveRows ?? []).map((r: { user_id: string }) => r.user_id));

  const team: TeamMember[] = loadRows.map((r: {
    id: string; full_name: string; role: string; active_total: number;
    overdue_count: number; critical_count: number; max_concurrent_tasks: number;
  }) => ({
    ...r,
    is_on_leave_today: onLeaveToday.has(r.id),
  }));

  // Build Gemini prompt
  const teamSummary = team
    .map(m => {
      const leaveTag = m.is_on_leave_today ? ' [ON LEAVE TODAY]' : '';
      const cap = m.max_concurrent_tasks ?? 10;
      const utilPct = Math.round((m.active_total / cap) * 100);
      return `- ${m.full_name}${leaveTag}: ${m.active_total} open tasks (${utilPct}% capacity), ${m.overdue_count} overdue, ${m.critical_count} due <48h`;
    })
    .join('\n');

  const deadlineStr = deadline
    ? `Deadline: ${new Date(deadline).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`
    : '';

  const prompt = `You are an expert content operations manager assigning work fairly and strategically.

A new task needs to be assigned to the most suitable team member.

TASK DETAILS:
- Type: ${task_type} (${targetRole})
- Platform: ${platform || 'unspecified'}
- Content type: ${content_type || 'unspecified'}
${deadlineStr}
${brief ? `- Brief summary: ${brief.slice(0, 200)}` : ''}

CURRENT TEAM WORKLOAD (${targetRole}s):
${teamSummary}

ASSIGNMENT RULES:
1. Never assign to someone on leave today if alternatives exist.
2. Prefer the person with most available capacity (lowest utilization %).
3. If utilization is similar (within 10%), prefer the person with fewer overdue or critical tasks.
4. Consider content complexity: reels/videos require more focus than simple posts.
5. Give a brief, honest reason the manager will find useful.

Respond with ONLY valid JSON in this exact format (no markdown, no extra text):
{"name": "<full name>", "reason": "<one sentence explanation>"}`;

  try {
    const raw = await aiGenerate(prompt, false);

    // Extract JSON even if the model wraps it in markdown
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('no JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as { name: string; reason: string };

    // Match name back to a profile; fall back to least-loaded if no match
    const match = team.find(
      m => m.full_name.toLowerCase() === parsed.name.toLowerCase()
    ) ?? team.reduce((best, m) =>
      (m.active_total ?? 0) < (best.active_total ?? 0) ? m : best
    );

    return NextResponse.json({
      suggested_id: match.id,
      suggested_name: match.full_name,
      reason: parsed.reason,
      is_on_leave: match.is_on_leave_today,
      active_tasks: match.active_total,
    });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }

    // Fallback: least-loaded not on leave, or least-loaded overall
    const fallback = [...team]
      .filter(m => !m.is_on_leave_today)
      .sort((a, b) => (a.active_total ?? 0) - (b.active_total ?? 0))[0]
      ?? team.sort((a, b) => (a.active_total ?? 0) - (b.active_total ?? 0))[0];

    console.error('[ai/suggest-assignee] AI failed, using fallback:', e);
    return NextResponse.json({
      suggested_id: fallback.id,
      suggested_name: fallback.full_name,
      reason: `Lowest current workload — ${fallback.active_total ?? 0} active task${(fallback.active_total ?? 0) === 1 ? '' : 's'}`,
      is_on_leave: fallback.is_on_leave_today,
      active_tasks: fallback.active_total,
      fallback: true,
    });
  }
}
