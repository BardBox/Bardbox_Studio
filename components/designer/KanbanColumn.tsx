import type { PipelineTask, PressureLevel } from '@/lib/types';
import { TaskCard } from '@/components/shared/TaskCard';

type ColumnType = PressureLevel | 'in_review';

const HEADER_STYLES: Record<ColumnType, string> = {
  in_review:   'bg-yellow-500/10 border-yellow-400/30 text-yellow-700',
  overdue:     'bg-red-500/10 border-red-400/30 text-red-700',
  critical:    'bg-orange-500/10 border-orange-400/30 text-orange-700',
  approaching: 'bg-amber-500/10 border-amber-400/30 text-amber-700',
  comfortable: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-700',
  completed:   'bg-slate-500/10 border-slate-400/30 text-slate-500',
};

const COLUMN_LABELS: Record<ColumnType, string> = {
  in_review:   'In Review',
  overdue:     'Overdue',
  critical:    'Critical (<48h)',
  approaching: 'Approaching (2-7d)',
  comfortable: 'On Track (>7d)',
  completed:   'Completed',
};

interface KanbanColumnProps {
  level: ColumnType;
  tasks: PipelineTask[];
  onTaskClick: (task: PipelineTask) => void;
}

export function KanbanColumn({ level, tasks, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-3 min-w-[240px]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border font-bold ${HEADER_STYLES[level]}`}>
        <span className="text-xs">{COLUMN_LABELS[level]}</span>
        <span className="text-xs tabular-nums">{tasks.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200/60 rounded-xl">
            No tasks
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.task_id} task={task} onClick={() => onTaskClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}
