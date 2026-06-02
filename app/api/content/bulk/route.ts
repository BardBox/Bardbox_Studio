import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function getUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) return null;
  return user;
}

// DELETE /api/content/bulk  { ids: number[] }
export async function DELETE(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { ids?: number[] };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('content_rows')
    .delete()
    .in('id', body.ids);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: body.ids.length });
}

// PATCH /api/content/bulk  { ids: number[], status?: string, assignee_id?: string }
export async function PATCH(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { ids?: number[]; status?: string; assignee_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'ids[] required' }, { status: 400 });
  }

  if (body.status) {
    const { error } = await supabaseAdmin
      .from('content_rows')
      .update({ status: body.status })
      .in('id', body.ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.assignee_id) {
    const { data: updated, error } = await supabaseAdmin
      .from('tasks')
      .update({ assignee_id: body.assignee_id, manually_assigned: true })
      .in('content_row_id', body.ids)
      .eq('task_type', 'design')
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'No design tasks found for the selected rows. Create tasks first, then assign a designer.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ updated: updated.length });
  }

  return NextResponse.json({ updated: body.ids.length });
}
