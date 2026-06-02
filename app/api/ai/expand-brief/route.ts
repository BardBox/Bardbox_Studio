import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { aiGenerate, RateLimitError } from '@/lib/ai';

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

  let body: { short_description?: string; platform?: string; content_type?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { short_description = '', platform = 'instagram', content_type = 'post' } = body;
  if (!short_description.trim()) {
    return NextResponse.json({ error: 'short_description required' }, { status: 400 });
  }

  const prompt = `Expand this short content idea into a clear, actionable creative brief for a graphic designer.

Platform: ${platform}
Content type: ${content_type}
Idea: ${short_description}

The brief should include:
1. Visual concept: what should the design look like?
2. Key message: what is the core thing we want to communicate?
3. Mood / tone: the feeling or aesthetic to aim for
4. Specific elements to include (if any)
5. Any do's and don'ts

Keep it concise (3â€“5 sentences max), practical, and easy for a designer to act on.
Return ONLY the brief text, no JSON, no extra formatting.`;

  try {
    const brief = await aiGenerate(prompt, true);
    return NextResponse.json({ brief });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }
    console.error('[ai/expand-brief]', e);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
