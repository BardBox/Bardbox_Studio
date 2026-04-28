'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PipelineTask, PressureLevel, TaskStatus } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { StatusUpdateDialog } from './StatusUpdateDialog';

const COLUMN_ORDER: PressureLevel[] = ['overdue', 'critical', 'approaching', 'comfortable'];

interface KanbanBoardProps {
  initialTasks: PipelineTask[];
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selected, setSelected] = useState<PipelineTask | null>(null);
  const [loading, setLoading] = useState(false);

  const grouped = COLUMN_ORDER.reduce<Record<PressureLevel, PipelineTask[]>>((acc, level) => {
    acc[level] = tasks.filter((t) => t.pressure_level === level);
    return acc;
  }, {} as Record<PressureLevel, PipelineTask[]>);

  async function handleUpdate(taskId: number, newStatus: TaskStatus, designUrl?: string) {
    setLoading(true);
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.task_id !== taskId));
    setSelected(null);

    const res = await fetch('/api/tasks/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, status: newStatus, design_url: designUrl }),
    });

    if (!res.ok) {
      setTasks(prev);
      toast.error('Failed to update status. Please try again.');
    } else {
      toast.success(`Task marked as ${newStatus.replace('_', ' ')}`);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMN_ORDER.map((level) => (
          <div key={level} className="flex-1 min-w-[240px]">
            <KanbanColumn
              level={level}
              tasks={grouped[level]}
              onTaskClick={setSelected}
            />
          </div>
        ))}
      </div>

      <StatusUpdateDialog
        task={selected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        loading={loading}
      />
    </>
  );
}
