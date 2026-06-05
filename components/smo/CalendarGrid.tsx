'use client';

import { useState } from 'react';
import type { PipelineTask } from '@/lib/types';
import { DayCell } from './DayCell';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay();
  const cells: Date[] = [];

  for (let i = startDay - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i));
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - last.getDate() - startDay + 1));
  }
  return cells;
}

interface CalendarGridProps {
  initialTasks: PipelineTask[];
}

export function CalendarGrid({ initialTasks }: CalendarGridProps) {
  const today = new Date();
  const [tasks, setTasks] = useState(initialTasks);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const cells = getMonthGrid(year, month);

  const tasksByDate = tasks.reduce<Record<string, PipelineTask[]>>((acc, t) => {
    const key = t.posting_date.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  function handleDone(taskId: number) {
    setTasks((ts) => ts.filter((t) => t.task_id !== taskId));
  }

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
  const monthLabel = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-3">
          <h2 className="text-2xl font-bold text-blue-600">{monthLabel}</h2>
          {isCurrentMonth && (
            <span className="px-3 py-1 bg-blue-500/10 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
              Active Cycle
            </span>
          )}
        </div>
        <div className="flex items-center bg-white/40 backdrop-blur-sm border border-white/50 rounded-full p-1.5 gap-0.5">
          <button
            onClick={prev}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-white/60 transition-colors"
          >
            Prev
          </button>
          <button
            onClick={goToday}
            className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all ${
              isCurrentMonth
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:bg-white/60'
            }`}
          >
            Today
          </button>
          <button
            onClick={next}
            className="px-4 py-1.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-white/60 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      {/* Calendar */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-xl border border-white/60">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-white/40 bg-white/10">
          {DAYS.map((d) => (
            <div key={d} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center py-3">
              {d}
            </div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          {cells.map((date, i) => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return (
              <DayCell
                key={i}
                date={date}
                tasks={tasksByDate[key] ?? []}
                isCurrentMonth={date.getMonth() === month}
                onDone={handleDone}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
