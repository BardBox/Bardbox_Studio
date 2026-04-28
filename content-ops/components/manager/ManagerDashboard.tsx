'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineTask, PipelineSummary, TeamMember, UserProfile } from '@/lib/types';
import { ReassignDialog } from './ReassignDialog';
import { TeamLoadTable } from './TeamLoadTable';

interface ManagerDashboardProps {
  summary: PipelineSummary;
  teamLoad: TeamMember[];
  teamMembers: UserProfile[];
  pendingApprovals: PipelineTask[];
  activeNow: PipelineTask[];
  overdueBlocked: PipelineTask[];
  todayPostings: PipelineTask[];
  todayDesignDeadlines: PipelineTask[];
}

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  done: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-red-100 text-red-700',
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  facebook: 'bg-blue-100 text-blue-700',
  linkedin: 'bg-sky-100 text-sky-700',
  youtube: 'bg-red-100 text-red-700',
  twitter: 'bg-slate-100 text-slate-700',
  tiktok: 'bg-purple-100 text-purple-700',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_COLORS[platform?.toLowerCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {platform}
    </span>
  );
}

function SectionHeader({ title, count, accent }: { title: string; count?: number; accent?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {count !== undefined && count > 0 && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accent ?? 'bg-muted text-muted-foreground'}`}>
          {count}
        </span>
      )}
    </div>
  );
}

function TaskRow({
  task,
  showAssignee = true,
  onReassign,
}: {
  task: PipelineTask;
  showAssignee?: boolean;
  onReassign?: (t: PipelineTask) => void;
}) {
  const deadline = task.internal_deadline
    ? new Date(task.internal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0 text-sm">
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate">{task.client_name ?? '—'}</span>
        <span className="text-muted-foreground mx-1.5">·</span>
        <span className="text-muted-foreground truncate">{task.content_type}</span>
        {task.brief && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{task.brief}</p>
        )}
      </div>
      <PlatformBadge platform={task.platform} />
      <StatusBadge status={task.task_status} />
      {showAssignee && (
        <button
          onClick={() => onReassign?.(task)}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline whitespace-nowrap"
        >
          {task.assignee_name ?? 'Unassigned'}
        </button>
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap">{deadline}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4 text-center">{text}</p>;
}

export function ManagerDashboard({
  summary,
  teamLoad,
  teamMembers,
  pendingApprovals,
  activeNow,
  overdueBlocked,
  todayPostings,
  todayDesignDeadlines,
}: ManagerDashboardProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);

  function handleReassigned() {
    setSelectedTask(null);
    router.refresh();
  }

  const overdue = overdueBlocked.filter((t) => t.pressure_level === 'overdue');
  const blocked = overdueBlocked.filter((t) => t.task_status === 'blocked');

  // Group active tasks by assignee
  const byAssignee = activeNow.reduce<Record<string, { name: string; tasks: PipelineTask[] }>>(
    (acc, t) => {
      const key = t.assignee_id ?? 'unassigned';
      if (!acc[key]) acc[key] = { name: t.assignee_name ?? 'Unassigned', tasks: [] };
      acc[key].tasks.push(t);
      return acc;
    },
    {}
  );

  const kpis = [
    { label: 'Pending Approval', value: pendingApprovals.length, alert: pendingApprovals.length > 0, color: 'text-amber-600' },
    { label: 'Overdue', value: summary.overdue ?? 0, alert: (summary.overdue ?? 0) > 0, color: 'text-red-600' },
    { label: 'Blocked', value: summary.blocked ?? 0, alert: (summary.blocked ?? 0) > 0, color: 'text-orange-600' },
    { label: 'Active Work', value: activeNow.length, alert: false, color: '' },
    { label: 'Posts Next 7 Days', value: summary.posts_next_7_days ?? 0, alert: false, color: '' },
    { label: 'Done This Week', value: summary.completed_this_week ?? 0, alert: false, color: 'text-green-600' },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(({ label, value, alert, color }) => (
          <div key={label} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${alert ? color : color || ''}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── TODAY ─────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Posts going live today */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader
            title="Posts Going Live Today"
            count={todayPostings.length}
            accent="bg-green-100 text-green-700"
          />
          {todayPostings.length === 0 ? (
            <EmptyState text="No posts scheduled for today" />
          ) : (
            todayPostings.map((t) => (
              <div key={t.task_id} className="flex items-center gap-3 py-2.5 border-b last:border-0 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{t.client_name ?? '—'}</span>
                  <span className="text-muted-foreground mx-1.5">·</span>
                  <span className="text-muted-foreground">{t.content_type}</span>
                  {t.posting_time && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {t.posting_time.slice(0, 5)}
                    </span>
                  )}
                </div>
                <PlatformBadge platform={t.platform} />
                <StatusBadge status={t.task_status} />
                <span className="text-xs text-muted-foreground">{t.assignee_name ?? '—'}</span>
              </div>
            ))
          )}
        </div>

        {/* Design deadlines today */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader
            title="Design Deadlines Today"
            count={todayDesignDeadlines.length}
            accent={todayDesignDeadlines.length > 0 ? 'bg-amber-100 text-amber-700' : undefined}
          />
          {todayDesignDeadlines.length === 0 ? (
            <EmptyState text="No design deadlines today" />
          ) : (
            todayDesignDeadlines.map((t) => (
              <TaskRow key={t.task_id} task={t} onReassign={setSelectedTask} />
            ))
          )}
        </div>
      </div>

      {/* ── NEEDS ACTION ──────────────────────────────────────────── */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Pending Approval */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader
            title="Pending Approval"
            count={pendingApprovals.length}
            accent="bg-amber-100 text-amber-700"
          />
          {pendingApprovals.length === 0 ? (
            <EmptyState text="All clear" />
          ) : (
            pendingApprovals.slice(0, 10).map((t) => (
              <div key={t.task_id} className="py-2.5 border-b last:border-0 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                  <PlatformBadge platform={t.platform} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground truncate">{t.content_type}</span>
                  {t.design_url ? (
                    <a
                      href={t.design_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open Design ↗
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">No link</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">by {t.assignee_name ?? '—'}</p>
              </div>
            ))
          )}
        </div>

        {/* Overdue */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader
            title="Overdue"
            count={overdue.length}
            accent="bg-red-100 text-red-700"
          />
          {overdue.length === 0 ? (
            <EmptyState text="Nothing overdue" />
          ) : (
            overdue.slice(0, 8).map((t) => (
              <div key={t.task_id} className="py-2.5 border-b last:border-0 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                  <StatusBadge status={t.task_status} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{t.content_type} · {t.platform}</span>
                  <button
                    onClick={() => setSelectedTask(t)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t.assignee_name ?? 'Unassigned'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Blocked */}
        <div className="rounded-lg border bg-card p-4">
          <SectionHeader
            title="Blocked"
            count={blocked.length}
            accent="bg-orange-100 text-orange-700"
          />
          {blocked.length === 0 ? (
            <EmptyState text="No blocked tasks" />
          ) : (
            blocked.slice(0, 8).map((t) => (
              <div key={t.task_id} className="py-2.5 border-b last:border-0 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                  <PlatformBadge platform={t.platform} />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{t.content_type}</span>
                  <button
                    onClick={() => setSelectedTask(t)}
                    className="text-xs text-orange-600 hover:underline"
                  >
                    {t.assignee_name ?? 'Unassigned'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── ACTIVE RIGHT NOW ──────────────────────────────────────── */}
      <div className="rounded-lg border bg-card p-4">
        <SectionHeader
          title="Active Right Now"
          count={activeNow.length}
          accent="bg-blue-100 text-blue-700"
        />
        {Object.keys(byAssignee).length === 0 ? (
          <EmptyState text="No tasks in progress" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(byAssignee).map(([id, { name, tasks }]) => (
              <div key={id} className="rounded-md border bg-muted/30 p-3">
                <p className="text-sm font-semibold mb-2">{name}</p>
                {tasks.map((t) => (
                  <div key={t.task_id} className="text-xs flex items-center gap-1.5 mb-1.5 last:mb-0">
                    <PlatformBadge platform={t.platform} />
                    <span className="truncate font-medium">{t.client_name ?? '—'}</span>
                    <span className="text-muted-foreground truncate flex-1">· {t.content_type}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {t.posting_date
                        ? new Date(t.posting_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TEAM CAPACITY ─────────────────────────────────────────── */}
      <TeamLoadTable members={teamLoad} />

      <ReassignDialog
        task={selectedTask}
        teamMembers={teamMembers}
        onClose={() => setSelectedTask(null)}
        onReassigned={handleReassigned}
      />
    </div>
  );
}
