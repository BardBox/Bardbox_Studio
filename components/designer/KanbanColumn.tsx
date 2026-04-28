import type { PipelineTask, PressureLevel } from '@/lib/types';
import { TaskCard } from '@/components/shared/TaskCard';

const HEADER_STYLES: Record<PressureLevel, string> = {
  overdue:     'border-red-300 bg-red-50',
  critical:    'border-orange-300 bg-orange-50',
  approaching: 'border-yellow-300 bg-yellow-50',
  comfortable: 'border-green-300 bg-green-50',
  completed:   'border-gray-200 bg-gray-50',
};

const HEADER_TEXT: Record<PressureLevel, string> = {
  overdue:     'text-red-700',
  critical:    'text-orange-700',
  approaching: 'text-yellow-700',
  comfortable: 'text-green-700',
  completed:   'text-gray-500',
};

const COLUMN_LABELS: Record<PressureLevel, string> = {
  overdue:     'Overdue',
  critical:    'Critical (<48h)',
  approaching: 'Approaching (2-7d)',
  comfortable: 'On Track (>7d)',
  completed:   'Completed',
};

interface KanbanColumnProps {
  level: PressureLevel;
  tasks: PipelineTask[];
  onTaskClick: (task: PipelineTask) => void;
}

export function KanbanColumn({ level, tasks, onTaskClick }: KanbanColumnProps) {
  return (
    <div className="flex flex-col gap-3 min-w-[240px]">
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${HEADER_STYLES[level]}`}>
        <span className={`font-semibold text-sm ${HEADER_TEXT[level]}`}>
          {COLUMN_LABELS[level]}
        </span>
        <span className={`text-xs font-bold ${HEADER_TEXT[level]}`}>{tasks.length}</span>
      </div>

      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
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
