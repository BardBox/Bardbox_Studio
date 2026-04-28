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

  const monthLabel = new Date(year, month).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <div className="flex gap-2">
          <button onClick={prev} className="px-3 py-1 text-sm border rounded-md hover:bg-muted">‹</button>
          <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            className="px-3 py-1 text-sm border rounded-md hover:bg-muted">Today</button>
          <button onClick={next} className="px-3 py-1 text-sm border rounded-md hover:bg-muted">›</button>
        </div>
      </div>

      <div className="border border-b-0 border-r-0 rounded-t-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40">
          {DAYS.map((d) => (
            <div key={d} className="text-xs font-semibold text-muted-foreground text-center py-2 border-b border-r">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
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
