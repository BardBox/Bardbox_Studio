'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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
      <div className="border rounded-lg p-10 text-center text-muted-foreground text-sm">
        No pending requests
      </div>
    );
  }

  return (
    <>
      <div className="divide-y border rounded-lg overflow-hidden">
        {requests.map((req) => (
          <div key={req.id} className="p-4 bg-background flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{req.client_name}</span>
                <Badge variant="secondary" className="text-xs">{req.platform}</Badge>
                <Badge variant="outline" className="text-xs">{req.content_type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Posting: <strong>{req.posting_date}</strong>
                {req.requester_name && (
                  <> · Requested by <strong>{req.requester_name}</strong> ({req.requester_role})</>
                )}
              </p>
              {req.caption && (
                <p className="text-sm text-muted-foreground line-clamp-2">"{req.caption}"</p>
              )}
              {req.notes && (
                <p className="text-xs text-muted-foreground italic">Notes: {req.notes}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                disabled={loading === req.id}
                onClick={() => approve(req)}
              >
                {loading === req.id ? '…' : 'Approve'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={loading === req.id}
                onClick={() => { setRejectTarget(req); setRejectNotes(''); }}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Rejecting <strong>{rejectTarget?.client_name}</strong> — {rejectTarget?.platform} {rejectTarget?.content_type} on {rejectTarget?.posting_date}
          </p>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject}>Confirm Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
