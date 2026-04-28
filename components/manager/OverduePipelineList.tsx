import type { PipelineTask } from '@/lib/types';
import { TaskCard } from '@/components/shared/TaskCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OverduePipelineListProps {
  tasks: PipelineTask[];
  onReassign: (task: PipelineTask) => void;
}

export function OverduePipelineList({ tasks, onReassign }: OverduePipelineListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Overdue & Critical
          <span className="ml-2 text-sm font-normal text-muted-foreground">({tasks.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">All clear!</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
            {tasks.map((task) => (
              <TaskCard
                key={task.task_id}
                task={task}
                actions={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onReassign(task)}
                  >
                    Reassign
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
