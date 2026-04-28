import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * POST /api/tasks/override-assignee
 * Body: { task_id: number, assignee_id: string }
 *
 * Only callable by users with role 'manager' or 'admin' (enforced
 * via auth session → profiles lookup).
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {},
        remove: () => {},
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['manager', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { task_id, assignee_id } = await req.json();
  if (!task_id || !assignee_id) {
    return NextResponse.json({ error: 'missing task_id or assignee_id' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.rpc('override_assignee', {
    p_task_id: task_id,
    p_assignee_id: assignee_id,
    p_actor_id: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // push the new assignee back to the Sheet
  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('content_row_id')
    .eq('id', task_id)
    .single();

  if (task?.content_row_id) {
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sheets/push-back`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ content_row_id: task.content_row_id }),
    }).catch(e => console.error('push-back fire-and-forget failed', e));
  }

  return NextResponse.json({ ok: true });
}
