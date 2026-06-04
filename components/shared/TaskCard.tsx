import type { PipelineTask } from '@/lib/types';
import { PressureBadge } from './PressureBadge';
import { Card, CardContent } from '@/components/ui/card';

function formatDeadline(hours: number): string {
  if (hours < 0) return `${Math.abs(Math.round(hours))}h overdue`;
  if (hours < 48) return `${Math.round(hours)}h left`;
  return `${Math.round(hours / 24)}d left`;
}

interface TaskCardProps {
  task: PipelineTask;
  actions?: React.ReactNode;
  onClick?: () => void;
}

export function TaskCard({ task, actions, onClick }: TaskCardProps) {
  const isSubmitted = task.task_status === 'submitted';
  const hasRevision = task.task_status === 'working_on_it' && !!task.rejection_notes;

  return (
    <Card
      className={`transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${hasRevision ? 'border-red-300' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="font-medium text-sm truncate">
              {task.client_name ?? 'No client'}
            </span>
            <span className="text-xs text-muted-foreground">
              {task.platform} · {task.content_type}
            </span>
          </div>
          <PressureBadge level={task.pressure_level} />
        </div>

        {hasRevision && (
          <div className="flex items-center gap-1 rounded-md bg-red-50 border border-red-200 px-2 py-1">
            <span className="text-[10px] font-semibold text-red-600">⚠ Revision requested</span>
          </div>
        )}

        {isSubmitted && (
          <div className="flex items-center gap-1 rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1">
            <span className="text-[10px] font-semibold text-yellow-700">⏳ Waiting for approval</span>
          </div>
        )}

        {task.brief && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.brief}</p>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(task.posting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            {' · '}
            {formatDeadline(task.hours_until_deadline)}
          </span>
          {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
