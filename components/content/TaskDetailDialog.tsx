'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { PipelineTask, TaskStatus } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskAiChat } from '@/components/shared/TaskAiChat';

// ── Status styles (shared by calendar + table) ────────────────────────────────

export const TASK_STATUS_GLASS: Record<string, string> = {
  todo:          'bg-white/30 border-white/60 text-slate-600 dark:bg-white/10 dark:border-white/20 dark:text-slate-300',
  working_on_it: 'bg-blue-500/15 border-blue-400/40 text-blue-700 dark:bg-blue-400/20 dark:border-blue-400/30 dark:text-blue-300',
  submitted:     'bg-amber-500/15 border-amber-400/40 text-amber-700 dark:bg-amber-400/20 dark:border-amber-400/30 dark:text-amber-300',
  approved:      'bg-emerald-500/15 border-emerald-400/40 text-emerald-700 dark:bg-emerald-400/20 dark:border-emerald-400/30 dark:text-emerald-300',
  done:          'bg-emerald-600/20 border-emerald-500/40 text-emerald-800 dark:bg-emerald-500/20 dark:border-emerald-500/30 dark:text-emerald-200',
  blocked:       'bg-red-500/15 border-red-400/40 text-red-700 dark:bg-red-400/20 dark:border-red-400/30 dark:text-red-300',
};

export const TASK_STATUS_DOTS: Record<string, string> = {
  todo:          'bg-gray-400',
  working_on_it: 'bg-blue-500',
  submitted:     'bg-amber-500',
  approved:      'bg-emerald-500',
  done:          'bg-emerald-600',
  blocked:       'bg-red-500',
};

const ALL_TASK_STATUSES: TaskStatus[] = ['todo', 'working_on_it', 'submitted', 'approved', 'done', 'blocked'];

const PRESSURE_ACCENT: Record<string, string> = {
  overdue:     'bg-red-500',
  critical:    'bg-orange-500',
  approaching: 'bg-yellow-400',
  comfortable: 'bg-emerald-500',
  completed:   'bg-gray-300',
};

// ── Task Detail Dialog ────────────────────────────────────────────────────────

export function TaskDetailDialog({
  task,
  onClose,
  onStatusChanged,
}: {
  task: PipelineTask | null;
  onClose: () => void;
  onStatusChanged: (taskId: number, newStatus: TaskStatus) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [carryState, setCarryState] = useState<'idle' | 'loading' | 'done' | 'skipped'>('idle');

  if (!task) return null;

  async function handleCarryForward() {
    setCarryState('loading');
    try {
      const res = await fetch('/api/tasks/reschedule-for-emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designer_id: task!.assignee_id,
          from_date: task!.internal_deadline?.slice(0, 10) ?? task!.posting_date,
          exclude_task_id: task!.task_id,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      toast.success(`${json.shifted ?? 0} task(s) pushed to next working day`);
      setCarryState('done');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Rescheduling failed');
      setCarryState('idle');
    }
  }

  async function changeStatus(newStatus: TaskStatus) {
    if (newStatus === task!.task_status || loading) return;
    setLoading(true);
    const res = await fetch('/api/tasks/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task!.task_id, status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`);
      onStatusChanged(task!.task_id, newStatus);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? 'Failed to update status');
    }
  }

  const accentColor = PRESSURE_ACCENT[task.pressure_level] ?? 'bg-gray-300';

  const fmtDate = (d: string, isTimestamp = false) =>
    new Date(isTimestamp ? d : d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent variant="glass" className="sm:max-w-md p-0 overflow-hidden gap-0">
        <div className={`h-1 w-full shrink-0 ${accentColor}`} />

        <div className="px-6 pt-5 pb-6 space-y-4">
          <DialogHeader className="space-y-1.5 pr-6">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide">
                {new Date(task.posting_date + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })}
                {task.posting_time && (
                  <span className="text-muted-foreground font-normal ml-0.5">{task.posting_time.slice(0, 5)}</span>
                )}
              </span>
            </div>

            <DialogTitle className="flex items-center gap-2 flex-wrap text-base leading-snug">
              <span>{task.client_name ?? '—'}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                task.task_type === 'design'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              }`}>
                {task.task_type === 'design' ? '✎ Design' : '↗ Post'}
              </span>
              {(task.pressure_level === 'overdue' || task.pressure_level === 'critical') && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                  task.pressure_level === 'overdue'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                }`}>
                  {task.pressure_level}
                </span>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground capitalize">
              {task.content_type}{task.platform ? ` · ${task.platform}` : ''}
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/10 px-4 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Submit by</p>
              <p className="text-sm font-medium">{fmtDate(task.internal_deadline, true)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Posts on</p>
              <p className="text-sm font-medium">
                {fmtDate(task.posting_date)}
                {task.posting_time && (
                  <span className="ml-1 text-xs text-muted-foreground">{task.posting_time.slice(0, 5)}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Assigned to</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{task.assignee_name ?? 'Unassigned'}</span>
                {task.assignee_role && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                    task.task_type !== 'post'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : task.assignee_role === 'smo'
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {task.assignee_role}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">SMO</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{task.smo_name ?? '—'}</span>
                {task.smo_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                    smo
                  </span>
                )}
              </div>
            </div>
          </div>

          {task.brief && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Brief</p>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">{task.brief}</p>
            </div>
          )}

          {task.design_url && (
            <a
              href={task.design_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              Open Design ↗
            </a>
          )}

          {task.rejection_notes && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-900">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">Rejection note</p>
              <p className="text-xs text-red-600 dark:text-red-400">{task.rejection_notes}</p>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold border ${TASK_STATUS_GLASS[task.task_status] ?? TASK_STATUS_GLASS.todo}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS_DOTS[task.task_status] ?? 'bg-gray-400'}`} />
                {task.task_status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TASK_STATUSES.filter(s => s !== task.task_status).map(s => (
                <button
                  key={s}
                  disabled={loading}
                  onClick={() => changeStatus(s)}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold border cursor-pointer transition-all disabled:opacity-50 hover:brightness-110 ${TASK_STATUS_GLASS[s]}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${TASK_STATUS_DOTS[s] ?? 'bg-gray-400'}`} />
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Carry-forward decision — only for emergency tasks assigned to a designer */}
          {task.is_emergency && task.task_type === 'design' && task.assignee_id && (
            <div className="rounded-xl border border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🚨</span>
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wide">Emergency Task</p>
              </div>
              {carryState === 'done' ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">✓ Your other tasks have been pushed to the next working day.</p>
              ) : carryState === 'skipped' ? (
                <p className="text-xs text-slate-500 font-medium">You chose to keep existing deadlines unchanged.</p>
              ) : (
                <>
                  <p className="text-xs text-red-600 dark:text-red-300">
                    Can you still complete your other tasks by their current deadlines, or do they need to move to the next working day?
                  </p>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      disabled={carryState === 'loading'}
                      onClick={handleCarryForward}
                      className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {carryState === 'loading' ? 'Moving...' : 'Push tasks forward'}
                    </button>
                    <button
                      disabled={carryState === 'loading'}
                      onClick={() => setCarryState('skipped')}
                      className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                    >
                      I can manage
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
