'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { InboxIcon } from 'lucide-react';
import type { TaskRequest } from '@/lib/types';

export function TaskRequestsQueue({ initialRequests }: { initialRequests: TaskRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [rejectTarget, setRejectTarget] = useState<TaskRequest | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [loading, setLoading] = useState<number | null>(null);

  async function approve(req: TaskRequest) {
    setLoading(req.id);
    const res = await fetch(`/api/tasks/requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success(`Approved — task #${json.task_id} created and auto-assigned`);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } else {
      toast.error(json.error ?? 'Approval failed');
    }
    setLoading(null);
  }

  async function reject() {
    if (!rejectTarget) return;
    setLoading(rejectTarget.id);
    const res = await fetch(`/api/tasks/requests/${rejectTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', review_notes: rejectNotes }),
    });
    if (res.ok) {
      toast.success('Request rejected');
      setRequests((prev) => prev.filter((r) => r.id !== rejectTarget.id));
    } else {
      toast.error('Rejection failed');
    }
    setLoading(null);
    setRejectTarget(null);
    setRejectNotes('');
  }

  if (requests.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-14 flex flex-col items-center gap-3 text-center">
        <div className="size-12 rounded-2xl bg-slate-500/10 border border-slate-400/20 flex items-center justify-center">
          <InboxIcon className="size-6 text-slate-400" />
        </div>
        <p className="text-sm font-semibold text-slate-400">No pending requests</p>
        <p className="text-xs text-slate-300">All caught up — nothing needs review right now.</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        {requests.map((req, idx) => (
          <div
            key={req.id}
            className={`flex flex-col sm:flex-row sm:items-start gap-4 px-5 py-4 transition-colors hover:bg-white/20 ${idx < requests.length - 1 ? 'border-b border-white/30' : ''}`}
          >
            {/* Info */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-700">{req.client_name}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-400/40 text-blue-700">
                  {req.platform}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-400/40 text-amber-700">
                  {req.content_type}
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Posting: <span className="font-semibold text-slate-600">{req.posting_date}</span>
                {req.requester_name && (
                  <> · Requested by <span className="font-semibold text-slate-600">{req.requester_name}</span>
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-500/10 border border-slate-400/20 text-slate-500">{req.requester_role}</span>
                  </>
                )}
              </p>

              {req.caption && (
                <p className="text-xs text-slate-500 line-clamp-2 italic">"{req.caption}"</p>
              )}
              {req.notes && (
                <p className="text-xs text-slate-400 italic">Notes: {req.notes}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0 items-center">
              <button
                disabled={loading === req.id}
                onClick={() => approve(req)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 border border-emerald-400/40 text-emerald-700 hover:bg-emerald-500/25 transition-all disabled:opacity-40"
              >
                {loading === req.id ? '…' : 'Approve'}
              </button>
              <button
                disabled={loading === req.id}
                onClick={() => { setRejectTarget(req); setRejectNotes(''); }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-red-500/15 border border-red-400/40 text-red-700 hover:bg-red-500/25 transition-all disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent variant="glass">
          <DialogHeader>
            <DialogTitle className="text-slate-800">Reject Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Rejecting <span className="font-semibold text-slate-700">{rejectTarget?.client_name}</span> —{' '}
            {rejectTarget?.platform} {rejectTarget?.content_type} on {rejectTarget?.posting_date}
          </p>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            className="bg-white/50 border-white/60 focus:border-blue-300/60 resize-none"
          />
          <DialogFooter>
            <button
              onClick={() => setRejectTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/40 border border-white/60 text-slate-600 hover:bg-white/60 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={reject}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-400/40 text-red-700 hover:bg-red-500/25 transition-all"
            >
              Confirm Reject
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
