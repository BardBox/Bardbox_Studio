'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PipelineTask, PipelineSummary, TeamMember, UserProfile } from '@/lib/types';
import { ReassignDialog } from './ReassignDialog';
import { TeamLoadTable } from './TeamLoadTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  todo:        'bg-status-cloud text-foreground',
  in_progress: 'bg-status-sky text-foreground',
  submitted:   'bg-status-daffodil text-foreground',
  approved:    'bg-status-mint text-foreground',
  done:        'bg-status-mint text-foreground',
  blocked:     'bg-status-blush text-foreground',
};

const PLATFORM_BADGE: Record<string, string> = {
  instagram: 'bg-status-blush text-foreground',
  facebook:  'bg-status-powder-blue text-foreground',
  linkedin:  'bg-status-sky text-foreground',
  youtube:   'bg-status-peach text-foreground',
  twitter:   'bg-status-slate text-foreground',
  tiktok:    'bg-status-lavender text-foreground',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn('capitalize border-0 text-xs', STATUS_BADGE[status] ?? 'bg-muted text-foreground')}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <Badge className={cn('capitalize border-0 text-xs', PLATFORM_BADGE[platform?.toLowerCase()] ?? 'bg-muted text-foreground')}>
      {platform}
    </Badge>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <Badge className={cn('border-0 text-xs font-semibold tabular-nums', className)}>
      {count}
    </Badge>
  );
}

function TaskRow({ task, showAssignee = true, onReassign }: {
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
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}

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

  const overdue = overdueBlocked.filter(t => t.pressure_level === 'overdue');
  const blocked = overdueBlocked.filter(t => t.task_status === 'blocked');

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
    { label: 'Pending Approval', value: pendingApprovals.length, valueClass: pendingApprovals.length > 0 ? 'text-yellow-600' : '' },
    { label: 'Overdue',          value: summary.overdue ?? 0,    valueClass: (summary.overdue ?? 0) > 0 ? 'text-destructive' : '' },
    { label: 'Blocked',          value: summary.blocked ?? 0,    valueClass: (summary.blocked ?? 0) > 0 ? 'text-orange-500' : '' },
    { label: 'Active Work',      value: activeNow.length,        valueClass: '' },
    { label: 'Posts Next 7 Days',value: summary.posts_next_7_days ?? 0, valueClass: '' },
    { label: 'Done This Week',   value: summary.completed_this_week ?? 0, valueClass: 'text-green-600' },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(({ label, value, valueClass }) => (
          <Card key={label} size="sm">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground leading-tight">{label}</p>
              <p className={cn('text-2xl font-bold mt-1 tabular-nums', valueClass)}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Today row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Posts Going Live Today</CardTitle>
              <CountBadge count={todayPostings.length} className="bg-status-mint text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {todayPostings.length === 0 ? (
              <EmptyState text="No posts scheduled for today" />
            ) : (
              todayPostings.map(t => (
                <div key={t.task_id} className="flex items-center gap-3 py-2.5 border-b last:border-0 text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{t.client_name ?? '—'}</span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <span className="text-muted-foreground">{t.content_type}</span>
                    {t.posting_time && (
                      <span className="ml-2 text-xs text-muted-foreground">{t.posting_time.slice(0, 5)}</span>
                    )}
                  </div>
                  <PlatformBadge platform={t.platform} />
                  <StatusBadge status={t.task_status} />
                  <span className="text-xs text-muted-foreground">{t.assignee_name ?? '—'}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Design Deadlines Today</CardTitle>
              <CountBadge count={todayDesignDeadlines.length} className="bg-status-daffodil text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {todayDesignDeadlines.length === 0 ? (
              <EmptyState text="No design deadlines today" />
            ) : (
              todayDesignDeadlines.map(t => (
                <TaskRow key={t.task_id} task={t} onReassign={setSelectedTask} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Needs attention */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Pending Approval</CardTitle>
              <CountBadge count={pendingApprovals.length} className="bg-status-daffodil text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <EmptyState text="All clear" />
            ) : (
              pendingApprovals.slice(0, 10).map(t => (
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
                        className="text-xs text-primary hover:underline"
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Overdue</CardTitle>
              <CountBadge count={overdue.length} className="bg-status-blush text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 ? (
              <EmptyState text="Nothing overdue" />
            ) : (
              overdue.slice(0, 8).map(t => (
                <div key={t.task_id} className="py-2.5 border-b last:border-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                    <StatusBadge status={t.task_status} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{t.content_type} · {t.platform}</span>
                    <button
                      onClick={() => setSelectedTask(t)}
                      className="text-xs text-destructive hover:underline"
                    >
                      {t.assignee_name ?? 'Unassigned'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">Blocked</CardTitle>
              <CountBadge count={blocked.length} className="bg-status-peach text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {blocked.length === 0 ? (
              <EmptyState text="No blocked tasks" />
            ) : (
              blocked.slice(0, 8).map(t => (
                <div key={t.task_id} className="py-2.5 border-b last:border-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                    <PlatformBadge platform={t.platform} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{t.content_type}</span>
                    <button
                      onClick={() => setSelectedTask(t)}
                      className="text-xs text-orange-500 hover:underline"
                    >
                      {t.assignee_name ?? 'Unassigned'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active right now */}
      <Card>
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Active Right Now</CardTitle>
            <CountBadge count={activeNow.length} className="bg-status-sky text-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          {Object.keys(byAssignee).length === 0 ? (
            <EmptyState text="No tasks in progress" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(byAssignee).map(([id, { name, tasks }]) => (
                <div key={id} className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-semibold mb-2">{name}</p>
                  {tasks.map(t => (
                    <div key={t.task_id} className="flex items-center gap-1.5 mb-1.5 last:mb-0 text-xs">
                      <PlatformBadge platform={t.platform} />
                      <span className="font-medium truncate">{t.client_name ?? '—'}</span>
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
        </CardContent>
      </Card>

      {/* Team capacity */}
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
