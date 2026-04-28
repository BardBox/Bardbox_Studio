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
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { platform?: string; content_type?: string; brief?: string; client_name?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { platform = 'instagram', content_type = 'post', brief = '', client_name } = body;

  const clientLine = client_name ? ` for ${client_name}` : '';
  const prompt = `Write an engaging ${platform} ${content_type} caption${clientLine}.
${brief ? `Brief: ${brief}` : 'No brief provided — write something compelling and versatile.'}

Requirements:
- Tone: professional yet conversational, appropriate for ${platform}
- Length: suitable for a ${content_type} (shorter for stories/reels, longer for carousels/posts)
- Include a clear call to action
- Generate 5–10 relevant hashtags

Return ONLY valid JSON, no explanation:
{
  "caption": "<the caption text>",
  "hashtags": "<space-separated hashtags starting with #>"
}`;

  try {
    const raw = (await aiGenerate(prompt, true)).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON in response');
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }
    console.error('[ai/generate-caption]', e);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
