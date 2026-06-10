import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

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

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { ids?: number[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { ids } = body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
  }

  // Create tasks via RPC (handles deadlines + auto-assign)
  const { data, error } = await supabaseAdmin.rpc('create_tasks_for_rows', { p_ids: ids });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const created = (data as unknown[])?.length ?? 0;

  // ── Apply preferred_assignee_id ───────────────────────────────
  try {
    const { data: rowData } = await supabaseAdmin
      .from('content_rows')
      .select('id, preferred_assignee_id')
      .in('id', ids)
      .not('preferred_assignee_id', 'is', null);

    if (rowData && rowData.length > 0) {
      const assigneeIds = [...new Set(rowData.map((r: { preferred_assignee_id: string }) => r.preferred_assignee_id))];

      // Fetch profiles and task_types in parallel
      const [{ data: profiles }, { data: taskTypes }] = await Promise.all([
        supabaseAdmin.from('profiles').select('id, role').in('id', assigneeIds),
        supabaseAdmin.from('task_types').select('key, target_role'),
      ]);

      const idToRole: Record<string, string> = {};
      for (const p of profiles ?? []) idToRole[p.id] = p.role;

      // DB-driven: role → task_type (reverse of target_role → key)
      const roleToTaskType: Record<string, string> = {};
      for (const tt of taskTypes ?? []) roleToTaskType[tt.target_role] = tt.key;

      for (const row of rowData as { id: number; preferred_assignee_id: string }[]) {
        const role = idToRole[row.preferred_assignee_id];
        if (!role) continue;
        const taskType = roleToTaskType[role];
        if (!taskType) continue;
        await supabaseAdmin
          .from('tasks')
          .update({ assignee_id: row.preferred_assignee_id, manually_assigned: true })
          .eq('content_row_id', row.id)
          .eq('task_type', taskType);
      }
    }
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ created, rows: data });
}
