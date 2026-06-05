'use client';

import { useState } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle, Users } from 'lucide-react';
import type { LeaveRequest, TeamAvailability, UserProfile } from '@/lib/types';
import { LeaveRequestsTable } from '@/components/hr/LeaveRequestsTable';
import { LeaveCalendar } from '@/components/hr/LeaveCalendar';
import { SubmitLeaveDialog } from '@/components/hr/SubmitLeaveDialog';

interface Props {
  pendingLeave: LeaveRequest[];
  recentLeave: LeaveRequest[];
  availability: TeamAvailability[];
  teamProfiles: UserProfile[];
}

export function HrDashboard({ pendingLeave, recentLeave, availability, teamProfiles }: Props) {
  const [pending, setPending] = useState(pendingLeave);
  const [recent, setRecent] = useState(recentLeave);
  const [submitOpen, setSubmitOpen] = useState(false);

  function onReviewed(id: number, status: 'approved' | 'denied') {
    const item = pending.find((r) => r.id === id);
    if (!item) return;
    setPending((prev) => prev.filter((r) => r.id !== id));
    setRecent((prev) => [{ ...item, status }, ...prev]);
  }

  const approvedRecent = recent.filter(r => r.status === 'approved').length;
  const deniedRecent   = recent.filter(r => r.status === 'denied').length;

  const stats = [
    { label: 'Pending Review', value: pending.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-400/30' },
    { label: 'Approved (30d)',  value: approvedRecent, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-400/30' },
    { label: 'Denied (30d)',    value: deniedRecent,   icon: XCircle,      color: 'text-red-500',     bg: 'bg-red-500/10 border-red-400/30' },
    { label: 'Team Size',       value: teamProfiles.length, icon: Users,  color: 'text-blue-600',    bg: 'bg-blue-500/10 border-blue-400/30' },
  ];

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="glass-panel rounded-xl px-5 py-3.5 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Leave Management</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
            Manage team availability, approve requests, and track absences.
          </p>
        </div>
        <button
          onClick={() => setSubmitOpen(true)}
          className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-1.5"
        >
          <Calendar className="size-3.5" /> Request Leave
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`glass-panel rounded-xl p-4 border ${bg}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <Icon className={`size-4 ${color}`} />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Pending + Recent stacked */}
      <div className="grid grid-cols-1 gap-5">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Pending Requests</h2>
            {pending.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-400/30 rounded-full">
                {pending.length} waiting
              </span>
            )}
          </div>
          <LeaveRequestsTable requests={pending} mode="pending" onReviewed={onReviewed} />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Recent Decisions</h2>
          <LeaveRequestsTable requests={recent} mode="history" />
        </section>
      </div>

      {/* Calendar */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">
          Team Availability — Next 30 Days
        </h2>
        <LeaveCalendar availability={availability} />
      </section>

      <SubmitLeaveDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        teamProfiles={teamProfiles}
      />
    </div>
  );
}
