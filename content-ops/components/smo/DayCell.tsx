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
  const [expanded, setExpanded] = useState(false);
  const isToday = date.toDateString() === new Date().toDateString();
  const visible = expanded ? tasks : tasks.slice(0, 3);
  const hidden = tasks.length - 3;

  return (
    <div
      className={`min-h-[100px] p-1.5 border-b border-r flex flex-col gap-1 ${
        !isCurrentMonth ? 'bg-muted/20 opacity-50' : ''
      }`}
    >
      <span
        className={`text-xs font-medium self-start w-6 h-6 flex items-center justify-center rounded-full ${
          isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
        }`}
      >
        {date.getDate()}
      </span>

      <div className="flex flex-col gap-1">
        {visible.map((t) => (
          <PostTaskCard key={t.task_id} task={t} onDone={onDone} />
        ))}
        {!expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-primary hover:underline text-left"
          >
            +{hidden} more
          </button>
        )}
      </div>
    </div>
  );
}
