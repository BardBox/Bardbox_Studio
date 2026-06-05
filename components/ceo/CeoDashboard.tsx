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
    <div className="space-y-5">
      {/* Page header */}
      <div className="glass-panel rounded-xl px-5 py-3.5">
        <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Executive Overview</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
          Full pipeline visibility across all clients and teams.
        </p>
      </div>

      <KpiBar summary={summary} />

      {pendingApprovals.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Pending Approvals</h2>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-orange-500/10 text-orange-600 border border-orange-300/30 rounded-full">
              {pendingApprovals.length} waiting
            </span>
          </div>
          <ApprovalQueue tasks={pendingApprovals.slice(0, 5)} compact />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Client Health</h2>
        <ClientHealthTable clients={clientHealth} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Team Workload</h2>
          <TeamLoadTable members={teamLoad} />
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-tight">Throughput (12 weeks)</h2>
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
