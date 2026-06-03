'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
      toast.success(`Status → ${newStatus.replace('_', ' ')}`);
      onStatusChanged(task!.task_id, newStatus);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? 'Failed to update status');
    }
  }

  const cls = TASK_STATUS_COLORS[task.task_status] ?? 'bg-muted text-muted-foreground';

  return (
    <Dialog open={!!task} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{task.client_name ?? '—'}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {task.task_type === 'design' ? '· Design Task' : '· Post Task'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Platform</p>
              <p className="font-medium capitalize">{task.platform}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Content Type</p>
              <p className="font-medium capitalize">{task.content_type}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Posting Date</p>
              <p className="font-medium">
                {new Date(task.posting_date + 'T00:00:00').toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
                {task.posting_time && <span className="ml-1 text-muted-foreground">{task.posting_time.slice(0, 5)}</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assigned To</p>
              <p className="font-medium">{task.assignee_name ?? 'Unassigned'}</p>
            </div>
          </div>

          {/* Brief */}
          {task.brief && (
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Brief</p>
              <p className="text-sm text-foreground/80 line-clamp-3">{task.brief}</p>
            </div>
          )}

          {/* Design link */}
          {task.design_url && (
            <a
              href={task.design_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              Open Design ↗
            </a>
          )}

          {/* Rejection notes */}
          {task.rejection_notes && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-xs font-medium text-red-700 mb-0.5">Rejection note</p>
              <p className="text-xs text-red-600">{task.rejection_notes}</p>
            </div>
          )}

          {/* Current status + change */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Status</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${cls}`}>
                {task.task_status.replace('_', ' ')}
              </span>
              <span className="text-xs text-muted-foreground">→ change to:</span>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TASK_STATUSES.filter(s => s !== task.task_status).map(s => (
                  <button
                    key={s}
                    disabled={loading}
                    onClick={() => changeStatus(s)}
                    className={`text-xs px-2 py-1 rounded-full font-medium border border-transparent hover:border-current cursor-pointer transition-opacity disabled:opacity-50 ${TASK_STATUS_COLORS[s]}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* AI assistant */}
        <TaskAiChat task_id={task.task_id} task_type={task.task_type} />
      </DialogContent>
    </Dialog>
  );
}

export function ContentCalendar({ tasks: initialTasks, currentMonth, clients, teamMembers, activeClient, activeAssignee, holidays = [] }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);
  const [tasks, setTasks] = useState(initialTasks);

  const [year, month] = currentMonth.split('-').map(Number);

  function navMonth(offset: number) {
    const d = new Date(year, month - 1 + offset, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const params = new URLSearchParams();
    params.set('view', 'calendar');
    params.set('month', ym);
    if (activeClient) params.set('client', activeClient);
    if (activeAssignee) params.set('assignee', activeAssignee);
    router.push(`/content?${params.toString()}`);
  }

  function pushFilter(key: string, value: string | null) {
    const params = new URLSearchParams();
    params.set('view', 'calendar');
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
    const key = task.posting_date.slice(0, 10);
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
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Team member filter */}
          <Select value={activeAssignee ?? '__all__'} onValueChange={v => pushFilter('assignee', v === '__all__' ? null : v)}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="All team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All team</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name} <span className="text-muted-foreground capitalize">({m.role})</span>
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
                    <button
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground text-base leading-none transition-opacity"
                      onClick={() => { setCreateDate(dateStr); setCreateOpen(true); }}
                      title="Add content"
                    >
                      +
                    </button>
                  )}
                </div>

                {/* Task chips — clickable */}
                {dayTasks.slice(0, 4).map((t) => (
                  <button
                    key={t.task_id}
                    onClick={() => setSelectedTask(t)}
                    className={`text-xs rounded px-1.5 py-0.5 truncate text-left w-full cursor-pointer hover:opacity-80 transition-opacity ${TASK_STATUS_COLORS[t.task_status] ?? 'bg-gray-100 text-gray-700'}`}
                    title={`${t.task_type === 'design' ? 'Design' : 'Post'} · ${t.content_type} · ${t.assignee_name ?? 'Unassigned'} · ${t.task_status}`}
                  >
                    <span className="font-medium capitalize">{t.content_type}</span>
                    <span className="mx-0.5 opacity-40">·</span>
                    <span className={t.task_type === 'design' ? 'text-blue-600' : 'text-violet-600'}>
                      {t.assignee_name?.split(' ')[0] ?? '—'}
                    </span>
                  </button>
                ))}
                {dayTasks.length > 4 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayTasks.length - 4} more
                  </div>
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
