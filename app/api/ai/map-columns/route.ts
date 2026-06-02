import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { aiGenerate, RateLimitError } from '@/lib/ai';

export const runtime = 'nodejs';

const TARGET_FIELDS = [
  { key: 'posting_date', label: 'Posting Date', required: true, hint: 'the date the content should be posted or published' },
  { key: 'content_type', label: 'Content Type', required: false, hint: 'type of post: reel, story, post, carousel, video, etc.' },
  { key: 'brief', label: 'Brief / Description', required: false, hint: 'creative brief or description for the designer' },
  { key: 'caption', label: 'Caption / Copy', required: false, hint: 'the social media caption or copy text' },
  { key: 'hashtags', label: 'Hashtags', required: false, hint: 'hashtags to include with the post' },
  { key: 'posting_time', label: 'Posting Time', required: false, hint: 'time of day to post, e.g. 10:00 AM' },
];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 400 });

  let body: { headers: string[]; sample_rows: Record<string, unknown>[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { headers, sample_rows } = body;
  if (!Array.isArray(headers) || headers.length === 0) {
    return NextResponse.json({ error: 'headers[] required' }, { status: 400 });
  }

  const fieldDescriptions = TARGET_FIELDS
    .map(f => `  - "${f.key}" (${f.required ? 'required' : 'optional'}): ${f.hint}`)
    .join('\n');

  const sampleText = sample_rows?.slice(0, 3).map((r, i) =>
    `Row ${i + 1}: ${JSON.stringify(r)}`
  ).join('\n') ?? 'No sample data';

  const prompt = `You are helping map spreadsheet columns to content scheduling fields.

Spreadsheet headers: ${JSON.stringify(headers)}

Sample data:
${sampleText}

Map each of these target fields to the best matching header (or null if no match):
${fieldDescriptions}

Rules:
- Match by meaning, not just exact name. E.g. "Date", "Post Date", "Scheduled" all map to posting_date.
- If a header clearly contains date values, it likely maps to posting_date.
- Return ONLY valid JSON in this exact format, no explanation:
{
  "mapping": {
    "posting_date": "<header name or null>",
    "content_type": "<header name or null>",
    "brief": "<header name or null>",
    "caption": "<header name or null>",
    "hashtags": "<header name or null>",
    "posting_time": "<header name or null>"
  },
  "notes": {
    "posting_date": "<brief reason>",
    "content_type": "<brief reason>",
    "brief": "<brief reason>",
    "caption": "<brief reason>",
    "hashtags": "<brief reason>",
    "posting_time": "<brief reason>"
  }
}`;

  try {
    const raw = (await aiGenerate(prompt, false)).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('no JSON in response');
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    if (e instanceof RateLimitError) {
      return NextResponse.json({ error: 'rate_limited', retrySeconds: e.retrySeconds }, { status: 429 });
    }
    console.error('[ai/map-columns]', e);
    return NextResponse.json({ mapping: {}, notes: {} });
  }
}
