import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { TaskStatus, UserRole } from '@/lib/types';

export const runtime = 'nodejs';

const ALLOWED_TRANSITIONS: Partial<Record<UserRole, Partial<Record<TaskStatus, TaskStatus[]>>>> = {
  designer: {
    todo:        ['in_progress'],
    in_progress: ['submitted'],
  },
  smo: {
    todo:        ['in_progress'],
    in_progress: ['done'],
  },
  manager: {
    todo:        ['in_progress', 'submitted', 'approved', 'done', 'blocked'],
    in_progress: ['submitted', 'approved', 'done', 'blocked'],
    submitted:   ['approved', 'done', 'blocked'],
    approved:    ['done'],
    blocked:     ['todo', 'in_progress'],
  },
  admin: {
    todo:        ['in_progress', 'submitted', 'approved', 'done', 'blocked'],
    in_progress: ['submitted', 'approved', 'done', 'blocked'],
    submitted:   ['approved', 'done', 'blocked'],
    approved:    ['done'],
    blocked:     ['todo', 'in_progress'],
  },
  ceo: {
    submitted: ['approved', 'done'],
  },
  hr: {},
};

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'profile not found' }, { status: 403 });

  const { task_id, status: newStatus, design_url } = await req.json() as {
    task_id: number;
    status: TaskStatus;
    design_url?: string;
  };
  if (!task_id || !newStatus) {
    return NextResponse.json({ error: 'missing task_id or status' }, { status: 400 });
  }

  const { data: task } = await supabaseAdmin
    .from('tasks')
    .select('status, assignee_id, content_row_id')
    .eq('id', task_id)
    .single();
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 });

  const role = profile.role as UserRole;

  if (!['manager', 'admin'].includes(role) && task.assignee_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const allowed = ALLOWED_TRANSITIONS[role]?.[task.status as TaskStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `transition ${task.status} → ${newStatus} not allowed for role ${role}` },
      { status: 422 }
    );
  }

  if (newStatus === 'done') {
    const { error } = await supabaseAdmin.rpc('complete_task', {
      p_task_id: task_id,
      p_actor_id: user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'submitted' && design_url) {
      updatePayload.design_url = design_url;
    }
    const { error } = await supabaseAdmin
      .from('tasks')
      .update(updatePayload)
      .eq('id', task_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/sheets/push-back`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ content_row_id: task.content_row_id }),
  }).catch((e) => console.error('push-back fire-and-forget failed', e));

  return NextResponse.json({ ok: true });
}
