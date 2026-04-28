import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const leaveId = Number(id);
  if (!leaveId) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['hr', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only HR or admin can review leave requests' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { status, review_notes } = body;

  if (!['approved', 'denied'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or denied' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: review_notes || null,
    })
    .eq('id', leaveId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
