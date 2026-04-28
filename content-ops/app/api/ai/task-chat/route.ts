import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiChat, RateLimitError } from '@/lib/ai';

export const runtime = 'nodejs';

interface ChatMsg { role: 'user' | 'model'; text: string }

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { task_id, message, history } = await req.json() as {
    task_id: number;
    message: string;
    history?: ChatMsg[];
  };
  if (!task_id || !message) {
    return NextResponse.json({ error: 'missing task_id or message' }, { status: 400 });
  }

  // Fetch rich task context
  const { data: task } = await supabaseAdmin
    .from('task_pipeline_health')
    .select('*')
    .eq('task_id', task_id)
    .single();

  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });

  const taskContext = `
CLIENT: ${task.client_name ?? 'Unknown'}
PLATFORM: ${task.platform}
CONTENT TYPE: ${task.content_type}
TASK TYPE: ${task.task_type === 'design' ? 'Design / Visual creation' : 'Social Media posting'}
POSTING DATE: ${task.posting_date}${task.posting_time ? ' at ' + task.posting_time.slice(0, 5) : ''}
${task.brief ? `BRIEF: ${task.brief}` : ''}
${task.caption ? `CAPTION DRAFT: ${task.caption}` : ''}
ASSIGNED TO: ${task.assignee_name ?? 'Unknown'} (${task.assignee_role ?? 'team member'})
CURRENT STATUS: ${task.task_status}
`.trim();

  const systemInstruction = `You are a creative AI assistant embedded inside ContentOps — the content management system for Bardbox Studio, a digital marketing agency.

A team member is working on a specific task and has a question or needs creative help. Here are the task details:

${taskContext}

Your role depends on the task type:
- DESIGN tasks: Help with visual concepts, layout ideas, color palettes, typography, Canva tips, brand consistency, creative direction, and making the design platform-optimised.
- POST tasks (SMO): Help write or refine captions, suggest hashtags, advise on emoji use, posting timing, engagement hooks, and platform-specific best practices.

Guidelines:
- Be concise, specific, and actionable — no generic advice.
- Give multiple creative options when relevant (e.g. "Option A: bold minimal, Option B: vibrant lifestyle").
- Reference the client, platform, and content type in your suggestions.
- Encourage the team member and be collaborative.
- If asked for caption ideas, write real captions they can use immediately.
- If asked for design ideas, describe visuals they can actually create in Canva.`;

  const messages: ChatMsg[] = [...(history ?? []), { role: 'user', text: message }];

  try {
    const reply = await aiChat(messages, systemInstruction, true);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn('[ai/task-chat] rate limited, retry in', e.retrySeconds, 's');
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }
    console.error('[ai/task-chat]', e);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 });
  }
}
