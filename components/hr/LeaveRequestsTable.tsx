'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';
import type { LeaveRequest } from '@/lib/types';

interface Props {
  requests: LeaveRequest[];
  mode: 'pending' | 'history';
  onReviewed?: (id: number, status: 'approved' | 'denied') => void;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-500/15 text-amber-700 border-amber-400/30',
  approved: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30',
  denied:   'bg-red-500/15 text-red-600 border-red-400/30',
};

const ROLE_AVATAR: Record<string, string> = {
  designer:  'bg-blue-500',
  smo:       'bg-violet-500',
  manager:   'bg-amber-500',
  admin:     'bg-slate-500',
  hr:        'bg-pink-500',
  developer: 'bg-emerald-500',
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function LeaveRequestsTable({ requests, mode, onReviewed }: Props) {
  const [denyTarget, setDenyTarget] = useState<LeaveRequest | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [loading, setLoading] = useState<number | null>(null);
  const [localRequests, setLocalRequests] = useState(requests);

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
      setLocalRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      onReviewed?.(id, status);
      setDenyTarget(null);
    } catch {
      toast.error('Could not update leave request.');
    } finally {
      setLoading(null);
    }
  }

  if (localRequests.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center text-slate-400 text-sm">
        {mode === 'pending' ? 'No pending requests.' : 'No recent decisions.'}
      </div>
    );
  }

  return (
    <>
      <div className="glass-panel rounded-xl overflow-hidden">
        {localRequests.map((r, idx) => {
          const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86_400_000) + 1;
          const initials = (r.full_name ?? r.user_id ?? '?').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
          const avatarBg = ROLE_AVATAR[r.role ?? ''] ?? 'bg-slate-500';
          const isLast = idx === localRequests.length - 1;

          return (
            <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${!isLast ? 'border-b border-white/20 dark:border-white/5' : ''} hover:bg-white/10 transition-colors`}>
              {/* Avatar */}
              <div className={`size-8 rounded-full ${avatarBg} flex items-center justify-center shrink-0`}>
                <span className="text-[10px] font-black text-white">{initials}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{r.full_name ?? r.user_id}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 capitalize">{r.role}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {fmtDate(r.start_date)} — {fmtDate(r.end_date)}
                  <span className="ml-2 text-slate-400">· {days}d</span>
                  {r.reason && <span className="ml-2 text-slate-400 truncate">· {r.reason}</span>}
                </div>
              </div>

              {/* Status or actions */}
              {mode === 'history' ? (
                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              ) : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    disabled={loading === r.id}
                    onClick={() => handleDecision(r.id, 'approved')}
                    className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 border border-emerald-400/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    <Check className="size-3" /> Approve
                  </button>
                  <button
                    disabled={loading === r.id}
                    onClick={() => { setDenyTarget(r); setDenyNotes(''); }}
                    className="inline-flex items-center gap-1 h-7 px-3 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-400/30 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    <X className="size-3" /> Deny
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deny modal */}
      {denyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border border-white/50"
            style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}
          >
            <h2 className="text-sm font-bold text-slate-800 mb-1">Deny Leave Request</h2>
            <p className="text-xs text-slate-500 mb-4">
              Denying leave for <strong className="text-slate-700">{denyTarget.full_name}</strong>. You may add a note for the employee.
            </p>
            <textarea
              placeholder="Reason for denial (optional)"
              value={denyNotes}
              onChange={(e) => setDenyNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setDenyTarget(null)}
                className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={loading !== null}
                onClick={() => denyTarget && handleDecision(denyTarget.id, 'denied', denyNotes)}
                className="h-8 px-4 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
