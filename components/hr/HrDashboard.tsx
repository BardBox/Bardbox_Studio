'use client';

import { useState } from 'react';
import type { LeaveRequest, TeamAvailability, UserProfile } from '@/lib/types';
import { LeaveRequestsTable } from '@/components/hr/LeaveRequestsTable';
import { LeaveCalendar } from '@/components/hr/LeaveCalendar';
import { SubmitLeaveDialog } from '@/components/hr/SubmitLeaveDialog';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage team availability, approve leave requests, and track absences.
          </p>
        </div>
        <Button onClick={() => setSubmitOpen(true)}>+ Request Leave</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Pending Requests</h2>
            {pending.length > 0 && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                {pending.length}
              </span>
            )}
          </div>
          <LeaveRequestsTable requests={pending} mode="pending" onReviewed={onReviewed} />
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Recent Decisions</h2>
          <LeaveRequestsTable requests={recent} mode="history" />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Team Availability — Next 30 Days</h2>
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
