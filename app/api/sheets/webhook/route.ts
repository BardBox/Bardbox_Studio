import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/sheets/webhook
 * Called by Google Apps Script on every row edit.
 *
 * Headers: x-webhook-secret: <SHEETS_WEBHOOK_SECRET>
 * Body: normalized row payload with sheet_row_id + column values
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const {
    sheet_row_id,
    client_name,
    platform,
    content_type,
    brief,
    caption,
    hashtags,
    reference_links,
    posting_date,
    posting_time,
  } = body;

  if (!sheet_row_id) {
    return NextResponse.json({ error: 'missing sheet_row_id' }, { status: 400 });
  }
  if (!platform || !content_type || !posting_date) {
    // ignore incomplete rows (someone's mid-typing) — don't 400, just no-op
    return NextResponse.json({ ok: true, skipped: 'incomplete' });
  }

  const refUrls =
    typeof reference_links === 'string' && reference_links.trim()
      ? reference_links.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];

  const { data, error } = await supabaseAdmin
    .from('content_rows')
    .upsert(
      {
        sheet_row_id,
        client_name: client_name || null,
        platform: String(platform).toLowerCase(),
        content_type: String(content_type).toLowerCase(),
        brief: brief || null,
        caption: caption || null,
        hashtags: hashtags || null,
        reference_urls: refUrls,
        posting_date,
        posting_time: posting_time || null,
        sheet_last_updated: new Date().toISOString(),
      },
      { onConflict: 'sheet_row_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[sheets/webhook] upsert failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row_id: data.id });
}
