import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// PATCH /api/tasks/requests/[id]
// Body: { action: 'approve' | 'reject', review_notes?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const { action, review_notes } = await req.json();

  if (action === 'approve') {
    const { data, error } = await supabaseAdmin.rpc('approve_task_request', {
      p_request_id: Number(id),
      p_actor_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, task_id: data });
  }

  if (action === 'reject') {
    const { error } = await supabaseAdmin
      .from('task_requests')
      .update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: review_notes ?? null,
      })
      .eq('id', id)
      .eq('status', 'pending');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
}
