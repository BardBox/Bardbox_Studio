'use client';

import { useState } from 'react';
import type { PipelineTask } from '@/lib/types';
import { PostTaskCard } from './PostTaskCard';

interface DayCellProps {
  date: Date;
  tasks: PipelineTask[];
  isCurrentMonth: boolean;
  onDone: (taskId: number) => void;
}

export function DayCell({ date, tasks, isCurrentMonth, onDone }: DayCellProps) {
  const [showAll, setShowAll] = useState(false);
  const isToday = date.toDateString() === new Date().toDateString();
  const visible = showAll ? tasks : tasks.slice(0, 3);
  const hidden = tasks.length - 3;

  return (
    <div
      className={`min-h-[140px] p-2 border-b border-r border-white/20 flex flex-col gap-1 transition-colors ${
        !isCurrentMonth ? 'opacity-40' : 'hover:bg-white/10'
      } ${tasks.length > 0 && isCurrentMonth ? 'bg-white/5' : ''}`}
    >
      {/* Date number */}
      <div className="flex items-center justify-between ml-0.5">
        <span
          className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
            isToday
              ? 'bg-blue-600 text-white shadow-sm shadow-blue-300'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {date.getDate()}
        </span>
        {isToday && (
          <span className="text-[8px] font-bold text-blue-600 uppercase tracking-wider mr-1">Today</span>
        )}
      </div>

      {/* Task cards */}
      <div className="flex flex-col gap-1">
        {visible.map((t) => (
          <PostTaskCard key={t.task_id} task={t} onDone={onDone} />
        ))}
        {!showAll && hidden > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-[10px] font-bold text-blue-500 hover:text-blue-700 text-left px-1 transition-colors"
          >
            +{hidden} more
          </button>
        )}
      </div>
    </div>
  );
}
