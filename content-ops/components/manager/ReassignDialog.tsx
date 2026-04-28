'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PressureBadge } from '@/components/shared/PressureBadge';
import type { PipelineTask, UserProfile } from '@/lib/types';

interface ReassignDialogProps {
  task: PipelineTask | null;
  teamMembers: UserProfile[];
  onClose: () => void;
  onReassigned: (taskId: number, newAssigneeId: string) => void;
}

export function ReassignDialog({ task, teamMembers, onClose, onReassigned }: ReassignDialogProps) {
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  const eligible = teamMembers.filter((m) =>
    task.task_type === 'design' ? m.role === 'designer' : m.role === 'smo'
  );

  async function handleReassign() {
    if (!assigneeId) return;
    setLoading(true);
    const res = await fetch('/api/tasks/override-assignee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task!.task_id, assignee_id: assigneeId }),
    });
    if (res.ok) {
      onReassigned(task!.task_id, assigneeId);
      toast.success('Task reassigned');
      onClose();
    } else {
      toast.error('Failed to reassign. Please try again.');
    }
    setLoading(false);
    setAssigneeId('');
  }

  return (
    <Dialog open={!!task} onOpenChange={() => { setAssigneeId(''); onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reassign Task</DialogTitle>
          <DialogDescription>
            {task.client_name} · {task.platform} · {task.content_type}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Current:</span>
          <span className="text-sm font-medium">{task.assignee_name ?? 'Unassigned'}</span>
          <PressureBadge level={task.pressure_level} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Reassign to</label>
          <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select team member…" />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleReassign} disabled={!assigneeId || loading}>
            {loading ? 'Reassigning…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
