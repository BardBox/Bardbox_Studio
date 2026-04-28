'use client';

import type { TeamAvailability } from '@/lib/types';

interface Props {
  availability: TeamAvailability[];
}

export function LeaveCalendar({ availability: data }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build 30-day grid
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  // For each day, find who is on approved leave
  function getAbsentees(day: Date): { name: string; role: string }[] {
    const ds = day.toISOString().slice(0, 10);
    const seen = new Set<string>();
    return data
      .filter((row) => {
        if (!row.start_date || !row.end_date || row.leave_status !== 'approved') return false;
        return ds >= row.start_date && ds <= row.end_date;
      })
      .filter((row) => {
        if (seen.has(row.user_id)) return false;
        seen.add(row.user_id);
        return true;
      })
      .map((row) => ({ name: row.full_name, role: row.role }));
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Pad first row to align to correct weekday
  const firstDayOffset = today.getDay(); // 0=Sun
  const paddedDays: (Date | null)[] = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...days,
  ];

  return (
    <div className="rounded-xl border bg-background p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-1 min-w-[560px]">
        {weekDays.map((wd) => (
          <div key={wd} className="text-xs font-medium text-muted-foreground text-center py-1">
            {wd}
          </div>
        ))}
        {paddedDays.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const absentees = getAbsentees(day);
          const isToday = day.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[72px] rounded-lg p-1.5 text-xs border ${
                isToday ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/30'
              }`}
            >
              <div className={`font-medium mb-1 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {absentees.map((a, i) => (
                  <div
                    key={i}
                    className="bg-red-100 text-red-700 rounded px-1 py-0.5 truncate"
                    title={`${a.name} (${a.role})`}
                  >
                    {a.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Red cells = team member on approved leave that day.
      </p>
    </div>
  );
}
