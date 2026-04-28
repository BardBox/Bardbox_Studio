'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PressureBadge } from '@/components/shared/PressureBadge';
import type { PipelineTask } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  tasks: PipelineTask[];
  compact?: boolean;
}

export function ApprovalQueue({ tasks: initialTasks, compact = false }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [rejectTask, setRejectTask] = useState<PipelineTask | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [loading, setLoading] = useState<number | null>(null);

  async function handleApprove(task: PipelineTask) {
    setLoading(task.task_id);
    try {
      const res = await fetch(`/api/tasks/${task.task_id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      setTasks((prev) => prev.filter((t) => t.task_id !== task.task_id));
      toast.success(`Task approved — ${task.client_name ?? task.platform}`);
    } catch {
      toast.error('Could not approve task. Try again.');
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectTask || !rejectNotes.trim()) return;
    setLoading(rejectTask.task_id);
    try {
      const res = await fetch(`/api/tasks/${rejectTask.task_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes }),
      });
      if (!res.ok) throw new Error('Failed');
      setTasks((prev) => prev.filter((t) => t.task_id !== rejectTask.task_id));
      toast.success('Task sent back for revision.');
      setRejectTask(null);
      setRejectNotes('');
    } catch {
      toast.error('Could not reject task. Try again.');
    } finally {
      setLoading(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-8 text-center text-muted-foreground text-sm">
        No tasks waiting for approval.
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Client</th>
              <th className="text-left px-4 py-2.5 font-medium">Platform</th>
              <th className="text-left px-4 py-2.5 font-medium">Type</th>
              {!compact && <th className="text-left px-4 py-2.5 font-medium">Assignee</th>}
              <th className="text-left px-4 py-2.5 font-medium">Design</th>
              <th className="text-left px-4 py-2.5 font-medium">Deadline</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => (
              <tr key={task.task_id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 font-medium">{task.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{task.platform}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{task.content_type}</td>
                {!compact && (
                  <td className="px-4 py-3 text-muted-foreground">{task.assignee_name ?? '—'}</td>
                )}
                <td className="px-4 py-3">
                  {task.design_url ? (
                    <a
                      href={task.design_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                    >
                      Open ↗
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No link</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(task.internal_deadline).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <PressureBadge level={task.pressure_level} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      disabled={loading === task.task_id}
                      onClick={() => handleApprove(task)}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading === task.task_id}
                      onClick={() => { setRejectTask(task); setRejectNotes(''); }}
                      className="h-7 text-xs"
                    >
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!rejectTask} onOpenChange={(o) => !o && setRejectTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sending{' '}
            <strong>
              {rejectTask?.client_name ?? rejectTask?.platform} — {rejectTask?.content_type}
            </strong>{' '}
            back to the designer. Please explain what needs to change.
          </p>
          <Textarea
            placeholder="Describe what needs to be changed..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTask(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectNotes.trim() || loading !== null}
              onClick={handleReject}
            >
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
