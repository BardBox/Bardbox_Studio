import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/sheets/sync
 * Full-month sync from Google Apps Script.
 * Sends all rows for a given month so the DB stays in sync with the sheet.
 *
 * Headers: x-webhook-secret: <SHEETS_WEBHOOK_SECRET>
 * Body: { month: "YYYY-MM", rows: [...] }
 *
 * Each row same shape as the single-row webhook.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret');
  if (secret !== process.env.SHEETS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { month?: string; rows?: Record<string, unknown>[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { month, rows } = body;
  if (!month || !Array.isArray(rows)) {
    return NextResponse.json({ error: 'month (YYYY-MM) and rows[] required' }, { status: 400 });
  }

  // Validate month format
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const results = { upserted: 0, skipped: 0, errors: 0 };

  for (const row of rows) {
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
    } = row as Record<string, unknown>;

    if (!sheet_row_id || !platform || !content_type || !posting_date) {
      results.skipped++;
      continue;
    }

    const refUrls =
      typeof reference_links === 'string' && (reference_links as string).trim()
        ? (reference_links as string).split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    const { error } = await supabaseAdmin
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
      );

    if (error) {
      console.error('[sheets/sync] upsert failed for', sheet_row_id, ':', error.message);
      results.errors++;
    } else {
      results.upserted++;
    }
  }

  return NextResponse.json({ ok: true, month, ...results });
}
