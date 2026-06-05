'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X, ExternalLink } from 'lucide-react';
import { PressureBadge } from '@/components/shared/PressureBadge';
import type { PipelineTask } from '@/lib/types';

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
      toast.success(`Approved — ${task.client_name ?? task.platform}`);
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
      setTasks((prev) => prev.filter((t) => t.task_id !== rejectTask!.task_id));
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
      <div className="glass-panel rounded-xl p-8 text-center text-slate-400 text-sm">
        No tasks waiting for approval.
      </div>
    );
  }

  return (
    <>
      <div className="glass-panel rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/20 dark:bg-white/5 border-b border-white/30 dark:border-white/10">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Client</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Platform</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Type</th>
              {!compact && <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Assignee</th>}
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Design</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Deadline</th>
              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/20 dark:divide-white/5">
            {tasks.map((task) => (
              <tr key={task.task_id} className="hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{task.client_name ?? '—'}</td>
                <td className="px-4 py-3 text-slate-500 capitalize">{task.platform}</td>
                <td className="px-4 py-3 capitalize text-slate-500">{task.content_type}</td>
                {!compact && (
                  <td className="px-4 py-3 text-slate-500">{task.assignee_name ?? '—'}</td>
                )}
                <td className="px-4 py-3">
                  {task.design_url ? (
                    <a
                      href={task.design_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Open <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">No link</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {new Date(task.internal_deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <PressureBadge level={task.pressure_level} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={loading === task.task_id}
                      onClick={() => handleApprove(task)}
                      className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                    >
                      <Check className="size-3" /> Approve
                    </button>
                    <button
                      disabled={loading === task.task_id}
                      onClick={() => { setRejectTask(task); setRejectNotes(''); }}
                      className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-400/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                      <X className="size-3" /> Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reject modal */}
      {rejectTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/50"
            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <h2 className="text-sm font-bold text-slate-800 mb-1">Request Revision</h2>
            <p className="text-xs text-slate-500 mb-4">
              Sending{' '}
              <strong className="text-slate-700">
                {rejectTask.client_name ?? rejectTask.platform} — {rejectTask.content_type}
              </strong>{' '}
              back to the designer.
            </p>
            <textarea
              placeholder="Describe what needs to be changed..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setRejectTask(null)}
                className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!rejectNotes.trim() || loading !== null}
                onClick={handleReject}
                className="h-8 px-4 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Send Back
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
