'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineTask, PressureLevel } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { TaskDetailPanel } from '@/components/shared/TaskDetailPanel';

const PRESSURE_ORDER: PressureLevel[] = ['overdue', 'critical', 'approaching', 'comfortable'];

interface KanbanBoardProps {
  initialTasks: PipelineTask[];
}

export function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<PipelineTask | null>(null);

  const inReview = initialTasks.filter(t => t.task_status === 'submitted');
  const active   = initialTasks.filter(t => t.task_status !== 'submitted');

  const grouped = PRESSURE_ORDER.reduce<Record<PressureLevel, PipelineTask[]>>((acc, level) => {
    acc[level] = active.filter(t => t.pressure_level === level);
    return acc;
  }, {} as Record<PressureLevel, PipelineTask[]>);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4">
        <div className="min-w-[240px]">
          <KanbanColumn level="in_review" tasks={inReview} onTaskClick={setSelected} />
        </div>
        {PRESSURE_ORDER.map((level) => (
          <div key={level} className="flex-1 min-w-[240px]">
            <KanbanColumn level={level} tasks={grouped[level]} onTaskClick={setSelected} />
          </div>
        ))}
      </div>

      <TaskDetailPanel
        task={selected}
        userRole="designer"
        onClose={() => setSelected(null)}
        onTaskUpdated={() => { setSelected(null); router.refresh(); }}
      />
    </>
  );
}
