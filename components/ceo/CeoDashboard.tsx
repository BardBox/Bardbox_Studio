'use client';

import { useState } from 'react';
import type { PipelineTask, PipelineSummary, TeamMember, ThroughputRow, ClientHealth } from '@/lib/types';
import { KpiBar } from '@/components/manager/KpiBar';
import { TeamLoadTable } from '@/components/manager/TeamLoadTable';
import { ThroughputChart } from '@/components/manager/ThroughputChart';
import { ReassignDialog } from '@/components/manager/ReassignDialog';
import { ApprovalQueue } from '@/components/ceo/ApprovalQueue';
import { ClientHealthTable } from '@/components/ceo/ClientHealthTable';

interface Props {
  summary: PipelineSummary;
  teamLoad: TeamMember[];
  overdueTasks: PipelineTask[];
  throughput: ThroughputRow[];
  clientHealth: ClientHealth[];
  pendingApprovals: PipelineTask[];
}

export function CeoDashboard({
  summary,
  teamLoad,
  overdueTasks,
  throughput,
  clientHealth,
  pendingApprovals,
}: Props) {
  const [reassignTask, setReassignTask] = useState<PipelineTask | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Executive Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full pipeline visibility across all clients and teams.
        </p>
      </div>

      <KpiBar summary={summary} />

      {pendingApprovals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Pending Approvals</h2>
            <span className="text-sm bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
              {pendingApprovals.length} waiting
            </span>
          </div>
          <ApprovalQueue tasks={pendingApprovals.slice(0, 5)} compact />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Client Health</h2>
        <ClientHealthTable clients={clientHealth} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold">Team Workload</h2>
          <TeamLoadTable members={teamLoad} />
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Throughput (12 weeks)</h2>
          <ThroughputChart data={throughput} />
        </div>
      </div>

      {reassignTask && (
        <ReassignDialog
          task={reassignTask}
          teamMembers={teamLoad}
          onClose={() => setReassignTask(null)}
          onReassigned={() => setReassignTask(null)}
        />
      )}
    </div>
  );
}
