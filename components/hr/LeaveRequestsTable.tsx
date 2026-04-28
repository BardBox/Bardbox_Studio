'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { LeaveRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  requests: LeaveRequest[];
  mode: 'pending' | 'history';
  onReviewed?: (id: number, status: 'approved' | 'denied') => void;
}

export function LeaveRequestsTable({ requests, mode, onReviewed }: Props) {
  const [denyTarget, setDenyTarget] = useState<LeaveRequest | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [loading, setLoading] = useState<number | null>(null);

  async function handleDecision(id: number, status: 'approved' | 'denied', notes = '') {
    setLoading(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_notes: notes }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(status === 'approved' ? 'Leave approved.' : 'Leave denied.');
      onReviewed?.(id, status);
      setDenyTarget(null);
    } catch {
      toast.error('Could not update leave request.');
    } finally {
      setLoading(null);
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-6 text-center text-muted-foreground text-sm">
        {mode === 'pending' ? 'No pending requests.' : 'No recent decisions.'}
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-emerald-100 text-emerald-800',
    denied: 'bg-red-100 text-red-800',
  };

  return (
    <>
      <div className="rounded-xl border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Employee</th>
              <th className="text-left px-4 py-2.5 font-medium">Dates</th>
              <th className="text-left px-4 py-2.5 font-medium">Reason</th>
              <th className="text-left px-4 py-2.5 font-medium">Status</th>
              {mode === 'pending' && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => {
              const days =
                Math.round(
                  (new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) /
                    (1000 * 60 * 60 * 24)
                ) + 1;
              return (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name ?? r.user_id}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.role}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>
                      {new Date(r.start_date).toLocaleDateString()} —{' '}
                      {new Date(r.end_date).toLocaleDateString()}
                    </div>
                    <div className="text-xs">{days} day{days !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                    {r.reason ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </td>
                  {mode === 'pending' && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                          disabled={loading === r.id}
                          onClick={() => handleDecision(r.id, 'approved')}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={loading === r.id}
                          onClick={() => { setDenyTarget(r); setDenyNotes(''); }}
                        >
                          Deny
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!denyTarget} onOpenChange={(o) => !o && setDenyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deny Leave Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Denying leave for <strong>{denyTarget?.full_name}</strong>. You may add a note for the employee.
          </p>
          <Textarea
            placeholder="Reason for denial (optional)"
            value={denyNotes}
            onChange={(e) => setDenyNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={loading !== null}
              onClick={() => denyTarget && handleDecision(denyTarget.id, 'denied', denyNotes)}
            >
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
