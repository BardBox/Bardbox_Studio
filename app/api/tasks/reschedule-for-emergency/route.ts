import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function nextWorkingDay(date: Date, holidays: Set<string>): Date {
  const d = new Date(date);
  do {
    d.setDate(d.getDate() + 1);
  } while (
    d.getDay() === 0 ||   // Sunday
    d.getDay() === 6 ||   // Saturday
    holidays.has(d.toISOString().slice(0, 10))
  );
  return d;
}

/**
 * POST /api/tasks/reschedule-for-emergency
 * Body: { designer_id: string, from_date: string (YYYY-MM-DD), exclude_task_id?: number }
 *
 * Shifts ALL future design tasks for the designer by 1 working day,
 * skipping weekends and public holidays.
 */
export async function POST(req: NextRequest) {
  try {
    const { designer_id, from_date, exclude_task_id } = await req.json();
    if (!designer_id || !from_date) {
      return NextResponse.json({ error: 'designer_id and from_date are required' }, { status: 400 });
    }

    // Load public holidays
    const { data: holidayRows } = await supabaseAdmin
      .from('public_holidays')
      .select('holiday_date');
    const holidays = new Set((holidayRows ?? []).map((h: { holiday_date: string }) => h.holiday_date));

    // Find all future design tasks for this designer (excluding the emergency task itself)
    let query = supabaseAdmin
      .from('tasks')
      .select('id, internal_deadline')
      .eq('assignee_id', designer_id)
      .eq('task_type', 'design')
      .gte('internal_deadline', from_date)
      .order('internal_deadline', { ascending: true });

    if (exclude_task_id) {
      query = query.neq('id', exclude_task_id);
    }

    const { data: tasks, error: fetchErr } = await query;
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!tasks || tasks.length === 0) return NextResponse.json({ shifted: 0 });

    // Shift each task's internal_deadline by 1 working day
    const updates = tasks.map((t: { id: number; internal_deadline: string }) => {
      const original = new Date(t.internal_deadline);
      const shifted = nextWorkingDay(original, holidays);
      return { id: t.id, internal_deadline: shifted.toISOString().slice(0, 10) };
    });

    // Batch update
    const { error: updateErr } = await supabaseAdmin.rpc('bulk_shift_deadlines', {
      p_updates: updates,
    });

    // Fallback: update one-by-one if bulk RPC not available
    if (updateErr) {
      for (const u of updates) {
        await supabaseAdmin
          .from('tasks')
          .update({ internal_deadline: u.internal_deadline })
          .eq('id', u.id);
      }
    }

    return NextResponse.json({ shifted: updates.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown error' }, { status: 500 });
  }
}
