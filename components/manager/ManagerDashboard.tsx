'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RefreshCw, Check, X, ExternalLink } from 'lucide-react';
import type { PipelineTask, PipelineSummary, TeamMember, UserProfile } from '@/lib/types';
import { ReassignDialog } from './ReassignDialog';
import { TeamLoadTable } from './TeamLoadTable';
import { PipelineDonutChart } from './PipelineDonutChart';
import { TeamUtilizationChart } from './TeamUtilizationChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn, statusLabel } from '@/lib/utils';

type SectionKey = 'approvals' | 'overdue' | 'blocked' | 'active' | 'today';

const STATUS_BADGE: Record<string, string> = {
  todo:          'bg-status-cloud text-foreground',
  working_on_it: 'bg-status-sky text-foreground',
  submitted:     'bg-status-daffodil text-foreground',
  approved:      'bg-status-mint text-foreground',
  done:          'bg-status-mint text-foreground',
  blocked:       'bg-status-blush text-foreground',
  on_hold:       'bg-status-peach text-foreground',
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
    <Badge className={cn('border-0 text-xs shrink-0', STATUS_BADGE[status] ?? 'bg-muted text-foreground')}>
      {statusLabel(status)}
    </Badge>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  return (
    <Badge className={cn('capitalize border-0 text-xs shrink-0', PLATFORM_BADGE[platform?.toLowerCase()] ?? 'bg-muted text-foreground')}>
      {platform}
    </Badge>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <Badge className={cn('border-0 text-xs font-semibold tabular-nums shrink-0', className)}>
      {count}
    </Badge>
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
  taskTypeRoles: Record<string, string>;
}

export function ManagerDashboard({
  summary,
  teamLoad,
  teamMembers,
  pendingApprovals: initialPendingApprovals,
  activeNow,
  overdueBlocked,
  todayPostings,
  todayDesignDeadlines,
  taskTypeRoles,
}: ManagerDashboardProps) {
  const router = useRouter();

  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(initialPendingApprovals);
  const [rejectTask, setRejectTask] = useState<PipelineTask | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'designer' | 'smo'>('all');
  const [highlighted, setHighlighted] = useState<SectionKey | null>(null);

  const approvalsRef = useRef<HTMLDivElement>(null);
  const overdueRef   = useRef<HTMLDivElement>(null);
  const blockedRef   = useRef<HTMLDivElement>(null);
  const activeRef    = useRef<HTMLDivElement>(null);
  const todayRef     = useRef<HTMLDivElement>(null);

  const sectionRefs = { approvals: approvalsRef, overdue: overdueRef, blocked: blockedRef, active: activeRef, today: todayRef };

  function scrollToSection(key: SectionKey) {
    sectionRefs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlighted(key);
    setTimeout(() => setHighlighted(null), 2000);
  }

  async function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }

  function handleReassigned() {
    setSelectedTask(null);
    router.refresh();
  }

  async function handleApprove(task: PipelineTask) {
    setActionLoading(task.task_id);
    try {
      const res = await fetch(`/api/tasks/${task.task_id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error();
      setPendingApprovals(prev => prev.filter(t => t.task_id !== task.task_id));
      toast.success(`Approved — ${task.client_name ?? task.platform}`);
    } catch {
      toast.error('Could not approve. Try again.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!rejectTask || !rejectNotes.trim()) return;
    setActionLoading(rejectTask.task_id);
    try {
      const res = await fetch(`/api/tasks/${rejectTask.task_id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectNotes }),
      });
      if (!res.ok) throw new Error();
      setPendingApprovals(prev => prev.filter(t => t.task_id !== rejectTask!.task_id));
      toast.success('Sent back for revision.');
      setRejectTask(null);
      setRejectNotes('');
    } catch {
      toast.error('Could not reject. Try again.');
    } finally {
      setActionLoading(null);
    }
  }

  const overdue = overdueBlocked.filter(t => t.pressure_level === 'overdue');
  const blocked = overdueBlocked.filter(t => t.task_status === 'blocked');

  const filteredActive = activeNow.filter(t =>
    activeTab === 'all' ? true : t.assignee_role === activeTab
  );

  const byAssignee = filteredActive.reduce<Record<string, { name: string; tasks: PipelineTask[] }>>(
    (acc, t) => {
      const key = t.assignee_id ?? 'unassigned';
      if (!acc[key]) acc[key] = { name: t.assignee_name ?? 'Unassigned', tasks: [] };
      acc[key].tasks.push(t);
      return acc;
    },
    {}
  );

  const kpis: Array<{ label: string; value: number; valueClass: string; sectionKey: SectionKey | null; alert: boolean }> = [
    { label: 'Pending Approval', value: pendingApprovals.length,       valueClass: pendingApprovals.length > 0 ? 'text-yellow-600' : '',     sectionKey: 'approvals', alert: pendingApprovals.length > 0 },
    { label: 'Overdue',          value: summary.overdue ?? 0,          valueClass: (summary.overdue ?? 0) > 0 ? 'text-destructive' : '',     sectionKey: 'overdue',   alert: (summary.overdue ?? 0) > 0 },
    { label: 'Blocked',          value: summary.blocked ?? 0,          valueClass: (summary.blocked ?? 0) > 0 ? 'text-orange-500' : '',      sectionKey: 'blocked',   alert: (summary.blocked ?? 0) > 0 },
    { label: 'Active Work',      value: activeNow.length,              valueClass: '',                                                        sectionKey: 'active',    alert: false },
    { label: 'Posts Next 7 Days',value: summary.posts_next_7_days ?? 0,valueClass: '',                                                        sectionKey: 'today',     alert: false },
    { label: 'Done This Week',   value: summary.completed_this_week ?? 0, valueClass: 'text-green-600',                                       sectionKey: null,        alert: false },
  ];

  return (
    <div className="flex flex-col gap-6">

      {/* KPI strip — clickable */}
      <div className="flex items-center justify-between mb-0">
        <p className="text-xs text-muted-foreground">Click a card to jump to that section</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="gap-2 h-7 text-xs"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 -mt-4">
        {kpis.map(({ label, value, valueClass, sectionKey, alert }) => (
          <Card
            key={label}
            onClick={() => sectionKey && scrollToSection(sectionKey)}
            className={cn(
              'transition-all duration-200 select-none',
              sectionKey && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[0.97]',
              alert && 'border-destructive/30 bg-destructive/[0.025]',
              sectionKey !== null && highlighted === sectionKey && 'ring-2 ring-primary shadow-lg',
            )}
          >
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground leading-tight truncate">{label}</p>
              <p className={cn('text-3xl font-bold mt-1 tabular-nums', valueClass)}>{value}</p>
              {sectionKey && (
                <p className="text-[10px] text-muted-foreground/40 mt-1">↓ jump to section</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-3 gap-4">
        <PipelineDonutChart summary={summary} />
        <div className="md:col-span-2">
          <TeamUtilizationChart members={teamLoad} />
        </div>
      </div>

      {/* Today row */}
      <div ref={todayRef} className="grid md:grid-cols-2 gap-4 scroll-mt-4">
        <Card className={cn('transition-all duration-500', highlighted === 'today' && 'ring-2 ring-primary')}>
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
                <div key={t.task_id} className="group flex items-center gap-3 py-2.5 border-b last:border-0 text-sm hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
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
                  <span className="text-xs text-muted-foreground shrink-0">{t.assignee_name ?? '—'}</span>
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
                <div key={t.task_id} className="group flex items-center gap-3 py-2.5 border-b last:border-0 text-sm hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                    <span className="text-muted-foreground mx-1.5">·</span>
                    <span className="text-muted-foreground truncate">{t.content_type}</span>
                  </div>
                  <PlatformBadge platform={t.platform} />
                  <StatusBadge status={t.task_status} />
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {t.internal_deadline
                        ? new Date(t.internal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>
                    <button
                      onClick={() => setSelectedTask(t)}
                      className="slide-in-actions text-xs text-primary hover:underline"
                    >
                      Reassign
                    </button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Needs attention — 3 cols */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Pending Approvals */}
        <div ref={approvalsRef} className="scroll-mt-4">
          <Card className={cn('h-full transition-all duration-500', highlighted === 'approvals' && 'ring-2 ring-primary')}>
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
                  <div key={t.task_id} className="group py-2.5 border-b last:border-0 text-sm hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                      <PlatformBadge platform={t.platform} />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">{t.content_type}</span>
                      {t.design_url ? (
                        <a
                          href={t.design_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
                        >
                          View <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">No link</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">by {t.assignee_name ?? '—'}</p>
                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        disabled={actionLoading === t.task_id}
                        onClick={() => handleApprove(t)}
                        className="h-6 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === t.task_id}
                        onClick={() => { setRejectTask(t); setRejectNotes(''); }}
                        className="h-6 text-xs flex-1"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Overdue */}
        <div ref={overdueRef} className="scroll-mt-4">
          <Card className={cn('h-full transition-all duration-500', highlighted === 'overdue' && 'ring-2 ring-destructive')}>
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
                overdue.slice(0, 8).map(t => {
                  const hrs = Math.round(Math.abs(t.hours_until_deadline));
                  const label = hrs >= 24 ? `${Math.floor(hrs / 24)}d overdue` : `${hrs}h overdue`;
                  return (
                    <div key={t.task_id} className="group py-2.5 border-b last:border-0 text-sm hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                        <span className="text-xs font-semibold text-destructive shrink-0">{label}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground truncate">{t.content_type} · {t.platform}</span>
                        <StatusBadge status={t.task_status} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{t.assignee_name ?? 'Unassigned'}</span>
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="slide-in-actions text-xs text-destructive hover:underline"
                        >
                          Reassign →
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Blocked */}
        <div ref={blockedRef} className="scroll-mt-4">
          <Card className={cn('h-full transition-all duration-500', highlighted === 'blocked' && 'ring-2 ring-orange-400')}>
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
                  <div key={t.task_id} className="group py-2.5 border-b last:border-0 text-sm hover:bg-muted/40 rounded px-1 -mx-1 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                      <PlatformBadge platform={t.platform} />
                    </div>
                    <span className="text-xs text-muted-foreground">{t.content_type}</span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{t.assignee_name ?? 'Unassigned'}</span>
                      <button
                        onClick={() => setSelectedTask(t)}
                        className="slide-in-actions text-xs text-orange-500 hover:underline"
                      >
                        Reassign →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active right now */}
      <div ref={activeRef} className="scroll-mt-4">
        <Card className={cn('transition-all duration-500', highlighted === 'active' && 'ring-2 ring-primary')}>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Active Right Now</CardTitle>
                <CountBadge count={activeNow.length} className="bg-status-sky text-foreground" />
              </div>
              {/* Role filter tabs */}
              <div className="flex rounded-md border overflow-hidden text-xs shrink-0">
                {(['all', 'designer', 'smo'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-3 py-1.5 capitalize transition-colors',
                      activeTab === tab
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'hover:bg-muted text-muted-foreground'
                    )}
                  >
                    {tab === 'smo' ? 'SMO' : tab}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(byAssignee).length === 0 ? (
              <EmptyState text={
                activeTab === 'all' ? 'No tasks in progress'
                : activeTab === 'smo' ? 'No SMO tasks in progress'
                : 'No designer tasks in progress'
              } />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(byAssignee).map(([id, { name, tasks }]) => (
                  <div key={id} className="rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold">{name}</p>
                      <Badge className="text-[10px] border-0 bg-status-sky text-foreground">
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {tasks.map(t => (
                      <div key={t.task_id} className="flex items-center gap-1.5 mb-1.5 last:mb-0 text-xs">
                        <PlatformBadge platform={t.platform} />
                        <span className="font-medium truncate">{t.client_name ?? '—'}</span>
                        <span className="text-muted-foreground truncate flex-1">· {t.content_type}</span>
                        <span className="text-muted-foreground shrink-0">
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
      </div>

      {/* Team capacity */}
      <TeamLoadTable members={teamLoad} />

      {/* Reassign dialog */}
      <ReassignDialog
        task={selectedTask}
        teamMembers={teamMembers}
        onClose={() => setSelectedTask(null)}
        onReassigned={handleReassigned}
        taskTypeRoles={taskTypeRoles}
      />

      {/* Reject dialog */}
      <Dialog open={!!rejectTask} onOpenChange={o => !o && setRejectTask(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Revision</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sending{' '}
            <strong>
              {rejectTask?.client_name ?? rejectTask?.platform} — {rejectTask?.content_type}
            </strong>{' '}
            back for revision.
          </p>
          <Textarea
            placeholder="What needs to change?"
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTask(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectNotes.trim() || actionLoading !== null}
              onClick={handleReject}
            >
              Send Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
