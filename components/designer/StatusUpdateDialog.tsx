'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PressureBadge } from '@/components/shared/PressureBadge';
import { TaskAiChat } from '@/components/shared/TaskAiChat';
import type { PipelineTask, TaskStatus } from '@/lib/types';

interface Props {
  task: PipelineTask | null;
  onClose: () => void;
  onUpdate: (taskId: number, newStatus: TaskStatus, designUrl?: string) => Promise<void>;
  loading: boolean;
}

export function StatusUpdateDialog({ task, onClose, onUpdate, loading }: Props) {
  const [designUrl, setDesignUrl] = useState('');

  if (!task) return null;

  const isSubmitted   = task.task_status === 'submitted';
  const canStart      = task.task_status === 'todo';
  const canSubmit     = task.task_status === 'in_progress';
  const isApproved    = task.task_status === 'approved';
  const hasRejection  = !!task.rejection_notes && task.task_status === 'in_progress';

  const urlValid = designUrl.trim().startsWith('http');

  function handleClose() {
    setDesignUrl('');
    onClose();
  }

  async function handleSubmit() {
    await onUpdate(task!.task_id, 'submitted', designUrl.trim() || undefined);
    setDesignUrl('');
  }

  return (
    <Dialog open={!!task} onOpenChange={() => handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task.client_name ?? 'Task'}</DialogTitle>
          <DialogDescription>
            {task.platform} · {task.content_type} · posting{' '}
            {new Date(task.posting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </DialogDescription>
        </DialogHeader>

        {/* Rejection feedback from manager/CEO */}
        {hasRejection && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Sent back for revision:</span>{' '}
            {task.rejection_notes}
          </div>
        )}

        {task.brief && (
          <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
            {task.brief}
          </p>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <PressureBadge level={task.pressure_level} />
          <span className="text-sm text-muted-foreground capitalize">{task.task_status.replace('_', ' ')}</span>
        </div>

        {/* Design URL input — shown when task is in_progress */}
        {canSubmit && (
          <div className="space-y-1.5">
            <Label className="text-xs">Design link (Canva / Drive / Figma) *</Label>
            <Input
              type="url"
              placeholder="https://www.canva.com/design/..."
              value={designUrl}
              onChange={(e) => setDesignUrl(e.target.value)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Paste the shareable link to your finished design so the reviewer can open it.
            </p>
          </div>
        )}

        {/* Existing design link — shown when awaiting review */}
        {isSubmitted && task.design_url && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Design submitted:</p>
            <a
              href={task.design_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline break-all"
            >
              {task.design_url}
            </a>
          </div>
        )}

        {/* AI assistant for the task */}
        <TaskAiChat task_id={task.task_id} task_type={task.task_type} />

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Close
          </Button>

          {canStart && (
            <Button onClick={() => onUpdate(task.task_id, 'in_progress')} disabled={loading}>
              {loading ? 'Updating…' : 'Start Task'}
            </Button>
          )}
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={loading || !urlValid}>
              {loading ? 'Submitting…' : 'Submit for Review'}
            </Button>
          )}
          {isSubmitted && (
            <Button variant="secondary" disabled>
              Awaiting Review
            </Button>
          )}
          {isApproved && (
            <Button variant="secondary" disabled>
              Approved ✓
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
