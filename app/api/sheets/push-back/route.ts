import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/sheets/push-back
 * Called from inside your app (server-side) when a task's status
 * or assignee changes — it echoes the change back into the Sheet.
 *
 * Body: { content_row_id: number } | { sheet_row_id: string }
 *
 * Typical trigger: a Supabase database webhook on tasks table,
 * or called directly from a route handler that mutates tasks.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  let sheetRowId: string | null = body.sheet_row_id ?? null;
  let status: string | null = null;
  let designer: string | null = null;
  let smo: string | null = null;

  if (!sheetRowId && body.content_row_id) {
    const { data: row } = await supabaseAdmin
      .from('content_rows')
      .select('sheet_row_id, status')
      .eq('id', body.content_row_id)
      .single();
    sheetRowId = row?.sheet_row_id ?? null;
    status = row?.status ?? null;

    // assignee names
    const { data: tasks } = await supabaseAdmin
      .from('tasks')
      .select('task_type, profiles:assignee_id(full_name)')
      .eq('content_row_id', body.content_row_id);

    tasks?.forEach((t: any) => {
      if (t.task_type === 'design') designer = t.profiles?.full_name ?? null;
      if (t.task_type === 'post') smo = t.profiles?.full_name ?? null;
    });
  }

  if (!sheetRowId) {
    return NextResponse.json({ error: 'no sheet_row_id resolvable' }, { status: 400 });
  }

  const resp = await fetch(process.env.APPS_SCRIPT_WEBAPP_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: process.env.APPS_SCRIPT_WEBAPP_SECRET,
      sheet_row_id: sheetRowId,
      status,
      designer,
      smo,
    }),
  });

  const result = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error('[sheets/push-back] apps-script failed:', result);
    return NextResponse.json({ error: 'apps script rejected', detail: result }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
