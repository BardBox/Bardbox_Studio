'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PressureBadge } from './PressureBadge';
import { TaskAiChat } from './TaskAiChat';
import type { PipelineTask, TaskStatus, UserRole } from '@/lib/types';
import { cn, statusLabel } from '@/lib/utils';
import { ExternalLink, Zap } from 'lucide-react';

interface Props {
  task: PipelineTask | null;
  userRole: UserRole;
  onClose: () => void;
  onTaskUpdated: (taskId: number) => void;
}

export function TaskDetailPanel({ task, userRole, onClose, onTaskUpdated }: Props) {
  const [designUrl, setDesignUrl]         = useState('');
  const [rejectNotes, setRejectNotes]     = useState('');
  const [rejectMode, setRejectMode]       = useState(false);
  const [loading, setLoading]             = useState(false);
  const [markingEmergency, setMarkingEmergency] = useState(false);

  function handleClose() {
    setDesignUrl('');
    setRejectNotes('');
    setRejectMode(false);
    onClose();
  }

  async function updateStatus(status: TaskStatus, extra?: { design_url?: string }) {
    if (!task) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: task.task_id, status, ...extra }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Status updated to "${statusLabel(status)}"`);
      onTaskUpdated(task.task_id);
      handleClose();
    } catch {
      toast.error('Could not update task. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function markAsEmergency() {
    if (!task) return;
    setMarkingEmergency(true);
    try {
      const res = await fetch('/api/content/emergency-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content_row_id: task.content_row_id }),
      });
      if (!res.ok) throw new Error();
      toast.success('Marked as emergency. Timeline adjusted.');
      onTaskUpdated(task.task_id);
      handleClose();
    } catch {
      toast.error('Could not mark as emergency. Try again.');
    } finally {
      setMarkingEmergency(false);
    }
  }

  async function approve() {
    if (!task) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.task_id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Task approved.');
      onTaskUpdated(task.task_id);
      handleClose();
    } catch {
      toast.error('Could not approve. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!task || !rejectNotes.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.task_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes }),
      });
      if (!res.ok) throw new Error();
      toast.success('Sent back for revision.');
      onTaskUpdated(task.task_id);
      handleClose();
    } catch {
      toast.error('Could not reject. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const isDesigner = userRole === 'designer';
  const canManage  = userRole === 'manager' || userRole === 'admin';
  const isSmo      = userRole === 'smo';
  const isCeo      = userRole === 'ceo';

  const canStart   = task?.task_status === 'todo'        && (isDesigner || isSmo || canManage);
  const canSubmit  = task?.task_status === 'working_on_it' && (isDesigner || canManage);
  const canApprove = task?.task_status === 'submitted'   && (canManage || isCeo);
  const canDone    = isSmo && (task?.task_status === 'working_on_it' || task?.task_status === 'approved');

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-[480px] flex flex-col p-0 gap-0">
        {task && (
          <>
            <SheetHeader className="px-6 pt-6 pb-4 border-b">
              {task.is_emergency && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 rounded-md px-3 py-1.5 mb-3">
                  <Zap className="h-3.5 w-3.5" />
                  Emergency — timeline adjusted
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="text-lg leading-tight">{task.client_name ?? 'Task'}</SheetTitle>
                  <SheetDescription className="mt-0.5">
                    {task.platform} · {task.content_type}
                  </SheetDescription>
                </div>
                <PressureBadge level={task.pressure_level} />
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                  <Badge variant="secondary" className="capitalize">
                    {statusLabel(task.task_status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Priority</p>
                  <Badge className={cn(
                    'border-0 text-xs capitalize inline-flex items-center gap-1',
                    task.priority === 'emergency' ? 'bg-red-600 text-white' :
                    task.priority === 'high'      ? 'bg-red-100 text-red-700' :
                    task.priority === 'medium'    ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                  )}>
                    {task.is_emergency && <Zap className="h-3 w-3" />}
                    {task.priority ?? 'medium'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Post Date</p>
                  <p className="font-medium text-sm">
                    {new Date(task.posting_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {task.posting_time ? ` · ${task.posting_time.slice(0, 5)}` : ''}
                  </p>
                </div>
                {task.assignee_name && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Assignee</p>
                    <p className="font-medium text-sm">{task.assignee_name}</p>
                    {task.assignee_specialty === 'video_editor' && (
                      <p className="text-[10px] text-purple-600 font-medium mt-0.5">🎬 Video Editor</p>
                    )}
                    {task.assignee_specialty === 'graphic_designer' && (
                      <p className="text-[10px] text-blue-600 font-medium mt-0.5">🎨 Graphic Designer</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Deadline</p>
                  <p className="font-medium text-sm">
                    {new Date(task.internal_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Revision feedback */}
              {task.rejection_notes && task.task_status === 'working_on_it' && (
                <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                  <p className="font-semibold mb-0.5">Revision requested</p>
                  <p className="leading-relaxed">{task.rejection_notes}</p>
                </div>
              )}

              {/* Brief */}
              {task.brief && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Brief</p>
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed">{task.brief}</p>
                </div>
              )}

              {/* Caption */}
              {task.caption && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Caption</p>
                  <p className="text-sm bg-muted/50 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">{task.caption}</p>
                </div>
              )}

              {/* Design link */}
              {task.design_url && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Design</p>
                  <a
                    href={task.design_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
                  >
                    <ExternalLink className="size-3.5" />
                    Open Design
                  </a>
                </div>
              )}

              {/* Submit input */}
              {canSubmit && !rejectMode && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Submit Design Link</p>
                  <Input
                    type="url"
                    placeholder="https://www.canva.com/design/..."
                    value={designUrl}
                    onChange={e => setDesignUrl(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Paste a shareable link (Canva, Drive, Figma).</p>
                </div>
              )}

              {/* Reject notes */}
              {rejectMode && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Revision Notes</p>
                  <Textarea
                    placeholder="Describe what needs to change..."
                    value={rejectNotes}
                    onChange={e => setRejectNotes(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              )}

              <Separator />
              <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
            </div>

            {/* Footer actions */}
            <div className="border-t px-6 py-4 flex flex-wrap items-center gap-2 shrink-0">
              {canStart && (
                <Button size="sm" onClick={() => updateStatus('working_on_it')} disabled={loading}>
                  {loading ? 'Updating…' : 'Start Task'}
                </Button>
              )}

              {canSubmit && !rejectMode && (
                <Button
                  size="sm"
                  disabled={loading || !designUrl.trim().startsWith('http')}
                  onClick={() => updateStatus('submitted', { design_url: designUrl.trim() })}
                >
                  {loading ? 'Submitting…' : 'Submit for Review'}
                </Button>
              )}

              {canDone && (
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => updateStatus('done')}
                  disabled={loading}
                >
                  {loading ? 'Updating…' : 'Mark as Posted'}
                </Button>
              )}

              {canApprove && !rejectMode && (
                <>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={approve}
                    disabled={loading}
                  >
                    {loading ? 'Approving…' : 'Approve'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectMode(true)} disabled={loading}>
                    Request Revision
                  </Button>
                </>
              )}

              {rejectMode && (
                <>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={loading || !rejectNotes.trim()}
                    onClick={reject}
                  >
                    {loading ? 'Sending…' : 'Send Back'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejectMode(false)} disabled={loading}>
                    Cancel
                  </Button>
                </>
              )}

              {canManage && !task.is_emergency && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 inline-flex items-center gap-1"
                  disabled={markingEmergency || loading}
                  onClick={markAsEmergency}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {markingEmergency ? 'Marking…' : 'Mark Emergency'}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={handleClose}>
                Dismiss
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
