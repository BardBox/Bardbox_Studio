'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PipelineTask, TaskStatus } from '@/lib/types';
import { PressureBadge } from '@/components/shared/PressureBadge';
import { CreateContentDialog } from '@/components/content/CreateContentDialog';
import { ImportDialog } from '@/components/content/ImportDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskAiChat } from '@/components/shared/TaskAiChat';

interface TeamMember { id: string; full_name: string; role: string }

interface Holiday { holiday_date: string; name: string }

interface Props {
  tasks: PipelineTask[];
  currentMonth: string; // "YYYY-MM"
  clients: string[];
  teamMembers: TeamMember[];
  activeClient: string | null;
  activeAssignee: string | null;
  holidays?: Holiday[];
  view?: 'calendar' | 'employees';
}

const PLATFORMS: Record<string, string> = {
  instagram: 'IG',
  linkedin: 'LI',
  twitter: 'TW',
  facebook: 'FB',
  youtube: 'YT',
  tiktok: 'TK',
};

function platformAbbr(p: string | null | undefined) {
  if (!p) return '–';
  return PLATFORMS[p.toLowerCase()] ?? p.slice(0, 2).toUpperCase();
}

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-700',
  working_on_it: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-emerald-100 text-emerald-700',
  done: 'bg-emerald-200 text-emerald-800',
  blocked: 'bg-red-100 text-red-700',
};

const ALL_TASK_STATUSES: TaskStatus[] = ['todo', 'working_on_it', 'submitted', 'approved', 'done', 'blocked'];

const PRESSURE_ACCENT: Record<string, string> = {
  overdue:     'bg-red-500',
  critical:    'bg-orange-500',
  approaching: 'bg-yellow-400',
  comfortable: 'bg-emerald-500',
  completed:   'bg-gray-300',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getExcludedDays(year: number, month: number): Set<number> {
  const excluded = new Set<number>();
  const daysInMonth = new Date(year, month, 0).getDate();
  let satCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0) excluded.add(d);          // all Sundays
    if (dow === 6) {
      satCount++;
      if (satCount === 1 || satCount === 3) excluded.add(d); // 1st & 3rd Saturday
    }
  }
  return excluded;
}

function TaskDetailDialog({
  task,
  onClose,
  onStatusChanged,
}: {
  task: PipelineTask | null;
  onClose: () => void;
  onStatusChanged: (taskId: number, newStatus: TaskStatus) => void;
}) {
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  async function changeStatus(newStatus: TaskStatus) {
    if (newStatus === task!.task_status || loading) return;
    setLoading(true);
    const res = await fetch('/api/tasks/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task!.task_id, status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(`Status → ${newStatus.replace(/_/g, ' ')}`);
      onStatusChanged(task!.task_id, newStatus);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? 'Failed to update status');
    }
  }

  const cls = TASK_STATUS_COLORS[task.task_status] ?? 'bg-muted text-muted-foreground';
  const accentColor = PRESSURE_ACCENT[task.pressure_level] ?? 'bg-gray-300';

  const fmtDate = (d: string, isTimestamp = false) =>
    new Date(isTimestamp ? d : d + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        {/* Pressure colour stripe at top */}
        <div className={`h-1 w-full shrink-0 ${accentColor}`} />

        <div className="px-6 pt-5 pb-6 space-y-4">
          {/* Header */}
          <DialogHeader className="space-y-1.5 pr-6">
            {/* Date badge — prominent, first thing read */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-wide">
                {new Date(task.posting_date + 'T00:00:00').toLocaleDateString('en-IN', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })}
                {task.posting_time && (
                  <span className="text-muted-foreground font-normal ml-0.5">{task.posting_time.slice(0, 5)}</span>
                )}
              </span>
            </div>

            <DialogTitle className="flex items-center gap-2 flex-wrap text-base leading-snug">
              <span>{task.client_name ?? '—'}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                task.task_type === 'design'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
              }`}>
                {task.task_type === 'design' ? '✎ Design' : '↗ Post'}
              </span>
              {(task.pressure_level === 'overdue' || task.pressure_level === 'critical') && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${
                  task.pressure_level === 'overdue'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                }`}>
                  {task.pressure_level}
                </span>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground capitalize">
              {task.content_type}{task.platform ? ` · ${task.platform}` : ''}
            </p>
          </DialogHeader>

          {/* Meta card */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Submit by</p>
              <p className="text-sm font-medium">{fmtDate(task.internal_deadline, true)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Posts on</p>
              <p className="text-sm font-medium">
                {fmtDate(task.posting_date)}
                {task.posting_time && (
                  <span className="ml-1 text-xs text-muted-foreground">{task.posting_time.slice(0, 5)}</span>
                )}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Assigned to</p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{task.assignee_name ?? 'Unassigned'}</span>
                {task.assignee_role && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                    task.assignee_role === 'designer'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : task.assignee_role === 'smo'
                      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {task.assignee_role}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Brief */}
          {task.brief && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Brief</p>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">{task.brief}</p>
            </div>
          )}

          {/* Design link */}
          {task.design_url && (
            <a
              href={task.design_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              Open Design ↗
            </a>
          )}

          {/* Rejection notes */}
          {task.rejection_notes && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-900">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-0.5">Rejection note</p>
              <p className="text-xs text-red-600 dark:text-red-400">{task.rejection_notes}</p>
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Status</p>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cls}`}>
                {task.task_status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TASK_STATUSES.filter(s => s !== task.task_status).map(s => (
                <button
                  key={s}
                  disabled={loading}
                  onClick={() => changeStatus(s)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border border-transparent hover:border-current cursor-pointer transition-opacity disabled:opacity-50 ${TASK_STATUS_COLORS[s]}`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* AI assistant */}
          <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ContentCalendar({ tasks: initialTasks, currentMonth, clients, teamMembers, activeClient, activeAssignee, holidays = [], view = 'calendar' }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);
  const [dayViewDate, setDayViewDate] = useState<string | null>(null);
  const [tasks, setTasks] = useState(initialTasks);

  const [year, month] = currentMonth.split('-').map(Number);

  function navMonth(offset: number) {
    const d = new Date(year, month - 1 + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('month', ym);
    if (activeClient) params.set('client', activeClient);
    if (activeAssignee) params.set('assignee', activeAssignee);
    router.push(`/content?${params.toString()}`);
  }

  function pushFilter(key: string, value: string | null) {
    const params = new URLSearchParams();
    params.set('view', view);
    params.set('month', currentMonth);
    if (activeClient && key !== 'client') params.set('client', activeClient);
    if (activeAssignee && key !== 'assignee') params.set('assignee', activeAssignee);
    if (value) params.set(key, value);
    router.push(`/content?${params.toString()}`);
  }

  function handleStatusChanged(taskId: number, newStatus: TaskStatus) {
    setTasks(ts => ts.map(t => t.task_id === taskId ? { ...t, task_status: newStatus } : t));
    if (selectedTask?.task_id === taskId) {
      setSelectedTask(t => t ? { ...t, task_status: newStatus } : null);
    }
    router.refresh();
  }

  // Build month grid
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = firstOfMonth.getDay();
  // Today in IST
  const nowUtc = new Date();
  const istNow = new Date(nowUtc.getTime() + (5 * 60 + 30) * 60_000);
  const today = `${istNow.getUTCFullYear()}-${String(istNow.getUTCMonth() + 1).padStart(2, '0')}-${String(istNow.getUTCDate()).padStart(2, '0')}`;

  const excludedDays = getExcludedDays(year, month);

  // Build holiday map: "YYYY-MM-DD" → name
  const holidayMap = new Map<string, string>();
  for (const h of holidays) holidayMap.set(h.holiday_date.slice(0, 10), h.name);

  const tasksByDate = new Map<string, PipelineTask[]>();
  for (const task of tasks) {
    // Employees view: group by internal_deadline (when work is due)
    // Calendar view: group by posting_date (when it publishes)
    const key = view === 'employees' && task.internal_deadline
      ? task.internal_deadline.slice(0, 10)
      : task.posting_date.slice(0, 10);
    if (!tasksByDate.has(key)) tasksByDate.set(key, []);
    tasksByDate.get(key)!.push(task);
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = firstOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navMonth(-1)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            ‹
          </button>
          <h2 className="text-xl font-bold min-w-[180px] text-center">{monthLabel}</h2>
          <button
            onClick={() => navMonth(1)}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Client filter */}
          <Select value={activeClient ?? '__all__'} onValueChange={v => pushFilter('client', v === '__all__' ? null : v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <span className={cn('flex-1 text-left truncate text-xs', !activeClient && 'text-muted-foreground')}>
                {activeClient ?? 'All clients'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Team member filter */}
          <Select value={activeAssignee ?? '__all__'} onValueChange={v => pushFilter('assignee', v === '__all__' ? null : v)}>
            <SelectTrigger className="h-8 text-xs w-52">
              <span className={cn('flex-1 text-left truncate', !activeAssignee && 'text-muted-foreground')}>
                {activeAssignee ?? (view === 'employees' ? 'All employees' : 'All team')}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{view === 'employees' ? 'All employees' : 'All team'}</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.full_name}>
                  <span className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                      {m.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </span>
                    <span className="font-medium">{m.full_name}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                      m.role === 'designer'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                        : m.role === 'smo'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-muted text-muted-foreground'
                    } capitalize`}>
                      {m.role}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button size="sm" onClick={() => { setCreateDate(null); setCreateOpen(true); }}>
            + New Content
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border bg-background overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y">
          {cells.map((day, idx) => {
            if (!day) return <div key={`pad-${idx}`} className="min-h-[110px] bg-muted/10" />;

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasksByDate.get(dateStr) ?? [];
            const isToday = dateStr === today;
            const isPast = dateStr < today;
            const holidayName = holidayMap.get(dateStr) ?? null;
            const isExcluded = excludedDays.has(day) || !!holidayName;

            // Pair design + post tasks for the same content row into one card
            const contentGroups = new Map<number, { design?: PipelineTask; post?: PipelineTask }>();
            for (const t of dayTasks) {
              if (!contentGroups.has(t.content_row_id)) contentGroups.set(t.content_row_id, {});
              const g = contentGroups.get(t.content_row_id)!;
              if (t.task_type === 'design') g.design = t;
              else g.post = t;
            }
            const groupEntries = [...contentGroups.entries()];

            return (
              <div
                key={dateStr}
                className={`min-h-[110px] p-1.5 flex flex-col gap-1 relative group ${
                  isExcluded
                    ? 'bg-slate-100/80 dark:bg-slate-800/40'
                    : isToday ? 'bg-primary/5' : isPast ? 'bg-muted/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                      isExcluded
                        ? 'text-slate-400'
                        : isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {day}
                  </span>
                  {isExcluded ? (
                    <span className="text-[9px] text-slate-400 font-medium truncate max-w-[70px]" title={holidayName ?? 'Off'}>
                      {holidayName ?? 'Off'}
                    </span>
                  ) : (
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                      {dayTasks.length > 0 && (
                        <button
                          className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          onClick={() => setDayViewDate(dateStr)}
                          title="View all tasks"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={() => { setCreateDate(dateStr); setCreateOpen(true); }}
                        title="Add content"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Content cards — one per content row, showing designer + SMO */}
                {groupEntries.slice(0, 3).map(([rowId, g]) => {
                  const primary = g.design ?? g.post!;
                  const cardStatus = g.design?.task_status ?? g.post?.task_status ?? 'todo';
                  const cls = TASK_STATUS_COLORS[cardStatus] ?? 'bg-gray-100 text-gray-700';
                  return (
                    <button
                      key={rowId}
                      onClick={() => setSelectedTask(primary)}
                      className={`text-xs rounded px-2 py-1.5 text-left w-full cursor-pointer hover:opacity-80 transition-opacity ${cls}`}
                      title={`${primary.content_type} · ${primary.client_name} | Design: ${g.design?.assignee_name ?? '—'} · Post: ${g.post?.assignee_name ?? '—'}`}
                    >
                      <div className="font-semibold capitalize leading-tight truncate">
                        {primary.content_type}
                        <span className="ml-1 font-normal opacity-50 text-[10px] normal-case">{primary.client_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] leading-tight">
                        {g.design && (
                          <span className="text-blue-600 truncate">
                            {g.design.assignee_name?.split(' ')[0] ?? '—'}
                          </span>
                        )}
                        {g.design && g.post && <span className="opacity-30 shrink-0">·</span>}
                        {g.post && (
                          <span className="text-violet-600 truncate">
                            {g.post.assignee_name?.split(' ')[0] ?? '—'}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
                {groupEntries.length > 3 && (
                  <button
                    onClick={() => setDayViewDate(dateStr)}
                    className="text-xs text-muted-foreground hover:text-foreground px-1 text-left hover:underline transition-colors"
                  >
                    +{groupEntries.length - 3} more
                  </button>
                )}

                {dayTasks.some((t) => t.pressure_level === 'overdue') && (
                  <PressureBadge level="overdue" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground items-center">
        {Object.entries(TASK_STATUS_COLORS).map(([s, cls]) => (
          <span key={s} className={`px-2 py-0.5 rounded capitalize ${cls}`}>{s.replace('_', ' ')}</span>
        ))}
        <span className="text-muted-foreground">·</span>
        <span className="text-blue-600 font-medium">Blue name = Designer</span>
        <span className="text-violet-600 font-medium">Violet name = SMO</span>
        <span className="text-muted-foreground italic">· Click chip to update status</span>
      </div>

      {/* Day view dialog — shows all tasks for a date */}
      <Dialog open={!!dayViewDate} onOpenChange={open => !open && setDayViewDate(null)}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-base">
              {dayViewDate && new Date(dayViewDate + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dayViewDate && (() => {
                const groups = [...(tasksByDate.get(dayViewDate) ?? [])].reduce((m, t) => {
                  if (!m.has(t.content_row_id)) m.set(t.content_row_id, {});
                  const g = m.get(t.content_row_id)!;
                  if (t.task_type === 'design') (g as Record<string, PipelineTask>).design = t;
                  else (g as Record<string, PipelineTask>).post = t;
                  return m;
                }, new Map<number, Record<string, PipelineTask>>());
                return `${groups.size} content item${groups.size !== 1 ? 's' : ''}`;
              })()}
            </p>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-3 py-3 space-y-1.5">
            {dayViewDate && (() => {
              const dayT = tasksByDate.get(dayViewDate) ?? [];
              const groups = new Map<number, { design?: PipelineTask; post?: PipelineTask }>();
              for (const t of dayT) {
                if (!groups.has(t.content_row_id)) groups.set(t.content_row_id, {});
                const g = groups.get(t.content_row_id)!;
                if (t.task_type === 'design') g.design = t; else g.post = t;
              }
              return [...groups.entries()].map(([rowId, g]) => {
                const primary = g.design ?? g.post!;
                const cls = TASK_STATUS_COLORS[primary.task_status] ?? 'bg-gray-100 text-gray-700';
                return (
                  <button
                    key={rowId}
                    onClick={() => { setDayViewDate(null); setSelectedTask(primary); }}
                    className={`w-full text-left rounded-lg px-3 py-2.5 text-sm cursor-pointer hover:opacity-80 transition-opacity ${cls}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold capitalize">{primary.content_type}</span>
                      <span className="text-[10px] opacity-60">{primary.client_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                      {g.design && (
                        <span className="text-blue-600">✎ {g.design.assignee_name ?? 'Unassigned'}</span>
                      )}
                      {g.post && (
                        <span className="text-violet-600">↗ {g.post.assignee_name ?? 'Unassigned'}</span>
                      )}
                      <span className="ml-auto opacity-50 capitalize">{primary.task_status.replace(/_/g, ' ')}</span>
                    </div>
                  </button>
                );
              });
            })()}
          </div>
          <div className="px-5 py-3 border-t shrink-0">
            <button
              onClick={() => { setDayViewDate(null); setCreateDate(dayViewDate); setCreateOpen(true); }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add content for this day
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChanged={handleStatusChanged}
      />

      <CreateContentDialog
        open={createOpen}
        defaultDate={createDate}
        onClose={() => setCreateOpen(false)}
      />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
