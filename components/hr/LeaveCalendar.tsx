'use client';

import type { TeamAvailability } from '@/lib/types';

interface Props {
  availability: TeamAvailability[];
}

const AVATAR_COLORS = ['bg-blue-500','bg-violet-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500','bg-indigo-500','bg-orange-500'];
function avatarBg(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
}

export function LeaveCalendar({ availability: data }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

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
  const firstDayOffset = today.getDay();
  const paddedDays: (Date | null)[] = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...days,
  ];

  return (
    <div className="glass-panel rounded-xl p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-1.5 min-w-[560px]">
        {/* Day headers */}
        {weekDays.map((wd) => (
          <div key={wd} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center py-1.5">
            {wd}
          </div>
        ))}

        {/* Day cells */}
        {paddedDays.map((day, idx) => {
          if (!day) return <div key={`pad-${idx}`} />;
          const absentees = getAbsentees(day);
          const isToday = day.toISOString().slice(0, 10) === today.toISOString().slice(0, 10);
          const hasAbsent = absentees.length > 0;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[80px] rounded-xl p-2 text-xs transition-colors ${
                isToday
                  ? 'bg-blue-500/10 border border-blue-400/40'
                  : hasAbsent
                  ? 'bg-red-500/5 border border-red-300/20'
                  : 'bg-white/5 dark:bg-white/3 border border-white/10 dark:border-white/5'
              }`}
            >
              <div className={`font-bold mb-1.5 ${
                isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
              }`}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {absentees.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1"
                    title={`${a.name} (${a.role})`}
                  >
                    <div className={`size-3.5 rounded-full ${avatarBg(a.name)} shrink-0 flex items-center justify-center`}>
                      <span className="text-[6px] font-black text-white">{a.name[0]}</span>
                    </div>
                    <span className="text-[9px] font-medium text-red-600 dark:text-red-400 truncate">
                      {a.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1.5">
        <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
        Team members on approved leave are shown in red.
      </p>
    </div>
  );
}
