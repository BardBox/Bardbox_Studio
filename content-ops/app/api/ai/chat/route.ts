import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { aiChat, RateLimitError } from '@/lib/ai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are an AI assistant built into ContentOps — a content pipeline management tool for a social media agency called Bardbox Studio.

The app manages:
- Clients (brands like Zara India, FitLife Gym, etc.)
- Content rows (planned posts: platform, content type, posting date)
- Tasks: each content row gets a "design" task (for the designer) and a "post" task (for the SMO)
- Team roles: Manager, Designer, SMO (Social Media Officer), CEO, HR

Workflow:
1. Manager imports content plan (Excel/CSV) or creates content directly
2. Manager selects rows → clicks "Create Tasks" → tasks auto-assigned to team
3. Designer picks up task → moves to In Progress → pastes Canva/Drive link → submits
4. Manager or CEO reviews the design link → approves
5. SMO sees only approved tasks → posts on the platform → marks as done

Platforms supported: Instagram, Facebook, LinkedIn, Twitter, YouTube, TikTok

Content types: Post, Reel, Story, Carousel, Video, Graphic

Task statuses: Todo → In Progress → Submitted → Approved → Done (also: Blocked)

Key pages:
- /manager: Dashboard with KPIs, team load, approval queue
- /content: Content calendar and table with import/bulk actions
- /manager/tasks: All tasks with filters and reassign
- /designer: Kanban board of the designer's tasks
- /smo: Calendar showing only approved tasks ready to post
- /ceo/approvals: Approval queue for CEO

AI features:
- ✨ Expand Brief: turn a short idea into a designer-ready brief
- ✨ Generate Caption: create platform-optimised caption + hashtags
- Import: AI auto-maps spreadsheet columns to the right fields

Answer questions about the workflow, help with content ideas, explain features, or assist with any task. Be concise, friendly, and professional. If asked for content ideas, give specific, actionable suggestions tailored to the context given.`;

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { messages: ChatMessage[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages[] required' }, { status: 400 });
  }

  try {
    const reply = await aiChat(messages, SYSTEM_PROMPT, true);
    return NextResponse.json({ reply });
  } catch (e) {
    if (e instanceof RateLimitError) {
      console.warn('[ai/chat] rate limited, retry in', e.retrySeconds, 's');
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }
    console.error('[ai/chat]', e);
    return NextResponse.json({ error: 'AI unavailable' }, { status: 500 });
  }
}
