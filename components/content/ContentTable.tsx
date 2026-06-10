'use client';

import { useState, useMemo, useEffect, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowUpDown, ArrowUp, ArrowDown, ListFilter, Plus, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ImportDialog } from './ImportDialog';
import { TaskDetailDialog } from './TaskDetailDialog';
import type { PipelineTask, TaskStatus } from '@/lib/types';

// ── Avatar color ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-rose-500', 'bg-teal-500',
  'bg-indigo-500', 'bg-amber-500',
];
function avatarColor(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AiSuggestion {
  task_id: number;
  task_type: string;
  assignee_name: string;
  client: string;
  platform: string;
  content_type: string;
  posting_date: string;
  deadline: string;
  conflict_type: 'leave_overlap' | 'over_capacity' | 'tight_deadline' | 'skill_mismatch' | 'free_capacity';
  leave_start?: string;
  leave_end?: string;
  current_load?: number;
  max_capacity?: number;
  hours_until_deadline?: number;
  assigned_specialty?: string | null;
  required_specialty?: string;
  suggested_assignee_name?: string;
  suggestion: string;
  reasoning: string;
  urgency: 'high' | 'medium' | 'low';
}

interface TaskSummary {
  id: number;
  task_type: string;
  status: string;
  assignee_id: string | null;
  internal_deadline: string | null;
}

interface ContentRow {
  id: number;
  client_name: string | null;
  platform: string;
  content_type: string;
  posting_date: string;
  status: string;
  source: string;
  auto_create_tasks: boolean;
  created_at: string;
  preferred_assignee_name: string | null;
  preferred_assignee_id: string | null;
  tasks: TaskSummary[];
}

interface Designer { id: string; full_name: string }
interface TeamMember { id: string; full_name: string; role: string }

interface Props {
  rows: ContentRow[];
  clients: string[];
  platforms: string[];
  designers: Designer[];
  teamMembers: TeamMember[];
  activeClient: string | null;
  activePlatform: string | null;
  activeAssignee: string | null;
  activeMonth: string;
  canImport?: boolean;
  hideEmployee?: boolean;
  showTeamFilter?: boolean;
  currentUserId?: string;
  taskTypeRoles: Record<string, string>;
  mediaTaskTypes: string[];
  publishingTaskTypes: string[];
  pipelineTasks?: PipelineTask[];
}

// ── Status styles (glass pills) ───────────────────────────────────────────────

const ROW_STATUSES = ['draft', 'in_design', 'in_review', 'approved', 'scheduled', 'posted', 'cancelled'];

const STATUS_GLASS: Record<string, string> = {
  draft:      'bg-white/40 border-white/60 text-slate-600 dark:bg-white/10 dark:border-white/20 dark:text-slate-300',
  in_design:  'bg-blue-500/15 border-blue-400/40 text-blue-700 dark:bg-blue-400/20 dark:text-blue-300',
  in_review:  'bg-amber-500/15 border-amber-400/40 text-amber-700 dark:bg-amber-400/20 dark:text-amber-300',
  approved:   'bg-emerald-500/15 border-emerald-400/40 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-300',
  scheduled:  'bg-violet-500/15 border-violet-400/40 text-violet-700 dark:bg-violet-400/20 dark:text-violet-300',
  posted:     'bg-teal-500/15 border-teal-400/40 text-teal-700 dark:bg-teal-400/20 dark:text-teal-300',
  cancelled:  'bg-red-500/15 border-red-400/40 text-red-700 dark:bg-red-400/20 dark:text-red-300',
};

// ── Task progress badge ───────────────────────────────────────────────────────

function TaskBadge({ tasks }: { tasks: TaskSummary[] }) {
  if (tasks.length === 0) return <span className="text-xs text-slate-400">No tasks</span>;
  const done = tasks.filter(t => ['done', 'approved'].includes(t.status)).length;
  const pct = tasks.length > 0 ? (done / tasks.length) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-white/50 dark:bg-white/10 rounded-full overflow-hidden border border-white/40">
        <div
          className={`h-full rounded-full transition-all ${done === tasks.length ? 'bg-emerald-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold tabular-nums ${done === tasks.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
        {done}/{tasks.length}
      </span>
    </div>
  );
}

// ── Assignee cell with dropdown ───────────────────────────────────────────────

function AssignTaskCell({ task, pool }: { task: TaskSummary | undefined; pool: TeamMember[] }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const name = pool.find(m => m.id === task?.assignee_id)?.full_name ?? null;
  const color = name ? avatarColor(name) : 'bg-slate-300 dark:bg-slate-600';

  if (!task) return <span className="text-xs text-slate-300 dark:text-slate-600">—</span>;

  async function assign(assigneeId: string | 'auto') {
    setLoading(true);
    const res = assigneeId === 'auto'
      ? await fetch('/api/tasks/auto-assign', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: task!.id }),
        })
      : await fetch('/api/tasks/override-assignee', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: task!.id, assignee_id: assigneeId }),
        });
    setLoading(false);
    if (res.ok) { toast.success('Assigned'); router.refresh(); }
    else { const j = await res.json().catch(() => ({})); toast.error(j.error ?? 'Failed'); }
  }

  const dlHrs = task.internal_deadline
    ? (new Date(task.internal_deadline).getTime() - Date.now()) / 3_600_000
    : null;
  const dlCls = dlHrs === null ? '' : dlHrs < 0 ? 'text-red-600' : dlHrs < 48 ? 'text-amber-600' : dlHrs < 120 ? 'text-amber-500' : 'text-slate-400';
  const dlStr = task.internal_deadline
    ? new Date(task.internal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold shrink-0', color)}>
        {name ? name.charAt(0).toUpperCase() : '?'}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className="text-xs font-semibold hover:text-blue-600 hover:underline underline-offset-2 cursor-pointer max-w-[80px] truncate disabled:opacity-50 text-slate-700 dark:text-slate-300 transition-colors"
        >
          {loading ? '…' : (name ?? <span className="text-slate-400 italic font-normal">Assign</span>)}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem onClick={() => assign('auto')} className="gap-2 text-purple-600 font-medium">
            ✦ Auto-assign (smart)
          </DropdownMenuItem>
          {pool.map(m => (
            <DropdownMenuItem key={m.id} onClick={() => assign(m.id)} className="gap-2">
              <span className={cn('inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[8px] font-bold shrink-0', avatarColor(m.full_name))}>
                {m.full_name.charAt(0)}
              </span>
              {m.full_name}
              {m.id === task.assignee_id && <span className="ml-auto text-xs text-muted-foreground">current</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {dlStr && <span className={`text-[10px] tabular-nums font-medium ${dlCls}`}>{dlStr}</span>}
    </div>
  );
}

// ── Inline status select ──────────────────────────────────────────────────────

function InlineStatusSelect({ rowId, currentStatus }: { rowId: number; currentStatus: string }) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function change(newStatus: string) {
    if (newStatus === status || loading) return;
    const prev = status;
    setStatus(newStatus);
    setLoading(true);
    const res = await fetch('/api/content/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [rowId], status: newStatus }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success('Status updated');
      router.refresh();
    } else {
      setStatus(prev);
      toast.error('Failed to update status');
    }
  }

  const cls = STATUS_GLASS[status] ?? STATUS_GLASS.draft;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={cn(
          'text-[11px] px-2.5 py-1 rounded-full font-semibold cursor-pointer',
          'hover:brightness-110 transition-all border capitalize',
          cls
        )}
      >
        {loading ? '…' : status.replace(/_/g, ' ')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ROW_STATUSES.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={() => change(s)}
            className="gap-2 cursor-pointer"
          >
            <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-semibold border capitalize', STATUS_GLASS[s])}>
              {s.replace(/_/g, ' ')}
            </span>
            {s === status && <span className="ml-auto text-xs text-muted-foreground">current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main table ────────────────────────────────────────────────────────────────

export function ContentTable({
  rows, clients, platforms, designers, teamMembers,
  activeClient, activePlatform, activeAssignee, activeMonth, canImport = true, hideEmployee = false, showTeamFilter = true,
  currentUserId, taskTypeRoles, mediaTaskTypes, publishingTaskTypes, pipelineTasks = [],
}: Props) {
  const mediaTypeSet = useMemo(() => new Set(mediaTaskTypes), [mediaTaskTypes]);
  const publishingTypeSet = useMemo(() => new Set(publishingTaskTypes), [publishingTaskTypes]);
  const mediaRoles = useMemo(
    () => mediaTaskTypes.map((taskType) => taskTypeRoles[taskType]).filter(Boolean),
    [mediaTaskTypes, taskTypeRoles],
  );
  const publishingRoles = useMemo(
    () => publishingTaskTypes.map((taskType) => taskTypeRoles[taskType]).filter(Boolean),
    [publishingTaskTypes, taskTypeRoles],
  );
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [sortField, setSortField] = useState<string>('posting_date');
  const [sortOrder, setSortOrder] = useState<1 | -1>(1);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  function toggleExpanded(rowId: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  }

  // ── Nested-accordion collapse state (Date ▸ Client ▸ Deadline ▸ Task) ───────
  // Keys: `d:<date>`, `c:<date>|<client>`, `dl:<date>|<client>|<deadline>`.
  // Empty set = everything expanded by default (employee sees their tasks at once).
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  function toggleKey(key: string) {
    setCollapsedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Task detail dialog (reused from the calendar) ──────────────────────────
  const [selectedTask, setSelectedTask] = useState<PipelineTask | null>(null);
  const pipelineById = useMemo(() => {
    const map = new Map<number, PipelineTask>();
    for (const t of pipelineTasks) map.set(t.task_id, t);
    return map;
  }, [pipelineTasks]);
  function openTaskDetail(taskId: number) {
    const full = pipelineById.get(taskId);
    if (full) setSelectedTask(full);
  }
  function handleTaskStatusChanged(taskId: number, newStatus: TaskStatus) {
    setSelectedTask(t => (t && t.task_id === taskId ? { ...t, task_status: newStatus } : t));
    router.refresh();
  }

  // ── Task timer (employee view) ─────────────────────────────────────────────
  const [timerState, setTimerState] = useState<{
    activeTaskId: number | null;
    startedAt: number | null;
    totals: Record<number, number>;
  }>({ activeTaskId: null, startedAt: null, totals: {} });
  const [timerMounted, setTimerMounted] = useState(false);
  const [, setTimerTick] = useState(0);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      const stored = localStorage.getItem(`bardbox_timer_${currentUserId}`);
      if (stored) setTimerState(JSON.parse(stored));
    } catch {}
    setTimerMounted(true);
    // Auto-expand rows where the user has a task due today
    setExpandedRows(prev => {
      const next = new Set(prev);
      for (const row of rows) {
        const mine = row.tasks.filter(t => t.assignee_id === currentUserId);
        if (mine.some(t => t.internal_deadline?.slice(0, 10) === todayStr)) {
          next.add(row.id);
        }
      }
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    if (!timerState.activeTaskId) return;
    const id = setInterval(() => setTimerTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerState.activeTaskId]);

  function startTimer(taskId: number) {
    setTimerState(prev => {
      const now = Date.now();
      const totals = { ...prev.totals };
      if (prev.activeTaskId !== null && prev.activeTaskId !== taskId && prev.startedAt !== null) {
        totals[prev.activeTaskId] = (totals[prev.activeTaskId] ?? 0) + (now - prev.startedAt);
      }
      const next = { activeTaskId: taskId, startedAt: now, totals };
      if (currentUserId) {
        try { localStorage.setItem(`bardbox_timer_${currentUserId}`, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }

  function pauseTimer(taskId: number) {
    setTimerState(prev => {
      if (prev.activeTaskId !== taskId || prev.startedAt === null) return prev;
      const now = Date.now();
      const next = {
        activeTaskId: null as number | null,
        startedAt: null as number | null,
        totals: { ...prev.totals, [taskId]: (prev.totals[taskId] ?? 0) + (now - prev.startedAt) },
      };
      if (currentUserId) {
        try { localStorage.setItem(`bardbox_timer_${currentUserId}`, JSON.stringify(next)); } catch {}
      }
      return next;
    });
  }

  function formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${m}:${String(sec).padStart(2, '0')}`;
  }

  const NONE = '__none__';

  const contentTypes = useMemo(() => [...new Set(rows.map(r => r.content_type))].sort(), [rows]);
  const sourceOptions = useMemo(() => [...new Set(rows.map(r => r.source))].sort(), [rows]);
  const assigneeOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of rows) {
      for (const t of r.tasks) {
        if (t.assignee_id) {
          const m = teamMembers.find(tm => tm.id === t.assignee_id);
          if (m) names.set(m.id, m.full_name);
        }
      }
      if (r.preferred_assignee_id && r.preferred_assignee_name) {
        names.set(r.preferred_assignee_id, r.preferred_assignee_name);
      }
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, teamMembers]);

  function toggleSort(field: string) {
    if (sortField === field) setSortOrder(o => (o === 1 ? -1 : 1));
    else { setSortField(field); setSortOrder(1); }
  }

  function setColFilter(field: string, val: string) {
    setColFilters(prev => {
      const next = { ...prev };
      if (val) next[field] = val; else delete next[field];
      return next;
    });
  }

  const displayRows = useMemo(() => {
    let result = [...rows];

    for (const [field, val] of Object.entries(colFilters)) {
      if (!val) continue;
      if (field === 'assignee') {
        result = result.filter(r => {
          const hasTask = r.tasks.some(t => t.assignee_id === val);
          const hasPreferred = r.preferred_assignee_id === val;
          return hasTask || hasPreferred;
        });
      } else if (field === 'task_status') {
        result = result.filter(r => {
          if (val === 'pending') return r.tasks.length === 0;
          if (val === 'done') return r.tasks.length > 0 && r.tasks.every(t => ['done', 'approved'].includes(t.status));
          return r.tasks.some(t => t.status === val);
        });
      } else {
        result = result.filter(r => String(r[field as keyof ContentRow] ?? '') === val);
      }
    }

    result.sort((a, b) => {
      let aVal = '', bVal = '';
      if (sortField === 'client_name')       { aVal = a.client_name ?? ''; bVal = b.client_name ?? ''; }
      else if (sortField === 'platform')     { aVal = a.platform ?? '';    bVal = b.platform ?? ''; }
      else if (sortField === 'content_type') { aVal = a.content_type;      bVal = b.content_type; }
      else if (sortField === 'posting_date') { aVal = a.posting_date;      bVal = b.posting_date; }
      else if (sortField === 'status')       { aVal = a.status;            bVal = b.status; }
      else if (sortField === 'source')       { aVal = a.source;            bVal = b.source; }
      else if (sortField === 'tasks') {
        aVal = String(a.tasks.length).padStart(3, '0');
        bVal = String(b.tasks.length).padStart(3, '0');
      } else if (sortField === 'assignee') {
        const aName = a.tasks.find(t => t.assignee_id)
          ? teamMembers.find(m => m.id === a.tasks.find(t => t.assignee_id)?.assignee_id)?.full_name ?? ''
          : (a.preferred_assignee_name ?? '');
        const bName = b.tasks.find(t => t.assignee_id)
          ? teamMembers.find(m => m.id === b.tasks.find(t => t.assignee_id)?.assignee_id)?.full_name ?? ''
          : (b.preferred_assignee_name ?? '');
        aVal = aName; bVal = bName;
      }
      if (aVal < bVal) return -1 * sortOrder;
      if (aVal > bVal) return sortOrder;
      return 0;
    });
    return result;
  }, [rows, sortField, sortOrder, colFilters, teamMembers]);

  // ── Nested tree for the employee view: Deadline ▸ Client ▸ Task ─────────────
  // Top level = task deadline, matching the employees calendar (which places
  // tasks by deadline). Leaves are the user's own tasks, labelled
  // "<content type> — <task type>" (e.g. "Reel — Design").
  type TaskLeaf = { row: ContentRow; task: TaskSummary };
  const employeeTree = useMemo(() => {
    if (!currentUserId) return [] as {
      deadline: string;
      count: number;
      clients: { client: string; leaves: TaskLeaf[] }[];
    }[];

    const byDeadline = new Map<string, Map<string, TaskLeaf[]>>();
    for (const row of displayRows) {
      for (const task of row.tasks) {
        if (task.assignee_id !== currentUserId) continue;
        const deadline = task.internal_deadline ? task.internal_deadline.slice(0, 10) : 'none';
        const client = row.client_name ?? '—';
        if (!byDeadline.has(deadline)) byDeadline.set(deadline, new Map());
        const byClient = byDeadline.get(deadline)!;
        if (!byClient.has(client)) byClient.set(client, []);
        byClient.get(client)!.push({ row, task });
      }
    }

    return [...byDeadline.entries()]
      .sort(([a], [b]) => (a === 'none' ? 1 : b === 'none' ? -1 : a < b ? -1 : a > b ? 1 : 0))
      .map(([deadline, byClient]) => {
        const clients = [...byClient.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([client, leaves]) => ({
            client,
            leaves: leaves.sort((x, y) => x.row.posting_date.localeCompare(y.row.posting_date)),
          }));
        const count = clients.reduce((n, c) => n + c.leaves.length, 0);
        return { deadline, count, clients };
      });
  }, [displayRows, currentUserId]);

  function pushFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'table');
    if (value) { params.set(key, value); } else { params.delete(key); }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleAll() {
    const allVisible = displayRows.every(r => selected.has(r.id));
    setSelected(allVisible ? new Set() : new Set(displayRows.map(r => r.id)));
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedIds = [...selected];

  async function handleCreateTasks() {
    setLoading(true);
    try {
      const res = await fetch('/api/content/create-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Tasks created for ${json.created} content rows`);
      setSelected(new Set());
      router.refresh();

      const taskIds = (json.rows as Array<{ design_task_id: number; post_task_id: number }> | null)
        ?.flatMap(r => [r.design_task_id, r.post_task_id].filter(Boolean)) ?? [];

      if (taskIds.length > 0) {
        setAiChecking(true);
        try {
          const aiRes = await fetch('/api/tasks/ai-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_ids: taskIds }),
          });
          const aiJson = await aiRes.json();
          if (aiJson.all_clear) {
            toast.success('All assignments look good', { description: 'No conflicts detected.' });
          } else if (aiJson.suggestions?.length > 0) {
            setAiSuggestions(aiJson.suggestions);
            setAiOpen(true);
          }
        } catch {
          // silently skip if AI is unavailable
        } finally {
          setAiChecking(false);
        }
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkStatus() {
    if (!bulkStatus) return;
    setLoading(true);
    try {
      const res = await fetch('/api/content/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, status: bulkStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Status updated for ${json.updated} rows`);
      setSelected(new Set()); setStatusOpen(false); router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch('/api/content/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Deleted ${json.deleted} rows`);
      setSelected(new Set()); setDeleteOpen(false); router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = -3; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  // TH helper
  const thCls = 'px-3 py-2.5 text-left text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const sortIcon = (field: string) => {
    const isActive = sortField === field;
    return isActive
      ? (sortOrder === 1 ? <ArrowUp className="h-3 w-3 text-blue-500" /> : <ArrowDown className="h-3 w-3 text-blue-500" />)
      : <ArrowUpDown className="h-3 w-3 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />;
  };

  return (
    <div className="space-y-3">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Month filter */}
          <Select value={activeMonth} onValueChange={(v) => v && pushFilter('month', v)}>
            <SelectTrigger className="h-9 rounded-full bg-white/40 backdrop-blur-sm border-white/50 hover:bg-white/60 transition-colors text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-slate-200 shadow-none text-xs font-semibold w-auto min-w-[120px] gap-1.5 focus:ring-0 focus:ring-offset-0">
              <span className="flex-1 text-left truncate">{activeMonth}</span>
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client filter */}
          <Select value={activeClient ?? '__all__'} onValueChange={(v) => pushFilter('client', v === '__all__' ? null : v)}>
            <SelectTrigger className="h-9 rounded-full bg-white/40 backdrop-blur-sm border-white/50 hover:bg-white/60 transition-colors text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-slate-200 shadow-none text-xs font-semibold w-auto min-w-[110px] gap-1.5 focus:ring-0 focus:ring-offset-0">
              <span className={cn('flex-1 text-left truncate', !activeClient && 'text-slate-500 dark:text-slate-400')}>
                {activeClient ?? 'All clients'}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Team filter — hidden for employees viewing only their own tasks */}
          {showTeamFilter && (
            <Select
              value={activeAssignee ?? '__all__'}
              onValueChange={(v) => pushFilter('assignee', v === '__all__' ? null : v)}
            >
              <SelectTrigger className="h-9 rounded-full bg-white/40 backdrop-blur-sm border-white/50 hover:bg-white/60 transition-colors text-slate-700 dark:bg-white/10 dark:border-white/20 dark:text-slate-200 shadow-none text-xs font-semibold w-auto min-w-[110px] gap-1.5 focus:ring-0 focus:ring-offset-0">
                <span className={cn('flex-1 text-left truncate', !activeAssignee && 'text-slate-500 dark:text-slate-400')}>
                  {activeAssignee ?? 'All team'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All team</SelectItem>
                {teamMembers.map(m => (
                  <SelectItem key={m.id} value={m.full_name}>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold uppercase">
                        {m.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </span>
                      <span className="font-medium">{m.full_name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                        mediaRoles.includes(m.role)
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                          : publishingRoles.includes(m.role)
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {m.role}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Import CTA — privileged roles only */}
        {canImport && (
          <button
            onClick={() => setImportOpen(true)}
            className="h-9 flex items-center gap-2 px-5 rounded-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white text-xs font-bold transition-colors shadow-md"
          >
            <Plus className="size-3.5" />
            Import
          </button>
        )}
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-500/10 backdrop-blur-sm border border-blue-400/30 rounded-full px-4 py-2 flex-wrap">
          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{selected.size} selected</span>
          <div className="flex-1" />
          {canImport && (
            <Button size="sm" variant="outline" onClick={handleCreateTasks} disabled={loading || aiChecking} className="rounded-full text-xs h-7">
              {aiChecking ? '✦ AI analysing…' : 'Create Tasks'}
            </Button>
          )}
          {canImport && (
            <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)} disabled={loading} className="rounded-full text-xs h-7">
              Change Status
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={loading} className="rounded-full text-xs h-7">
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} className="rounded-full text-xs h-7">✕</Button>
        </div>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {!canImport && currentUserId ? (
            <div className="p-2 sm:p-3 space-y-1.5">
              {employeeTree.length === 0 ? (
                <div className="px-4 py-14 text-center text-sm text-slate-400 dark:text-slate-500">
                  No tasks found.
                </div>
              ) : employeeTree.map(dlNode => {
                const dlKey = `dl:${dlNode.deadline}`;
                const dlOpen = !collapsedKeys.has(dlKey);
                const isToday = dlNode.deadline === todayStr;
                const isOverdue = dlNode.deadline !== 'none' && dlNode.deadline < todayStr;
                const dlLabel = dlNode.deadline === 'none'
                  ? 'No deadline'
                  : new Date(dlNode.deadline + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                return (
                  <div key={dlNode.deadline} className="rounded-xl border border-white/40 dark:border-white/10 overflow-hidden bg-white/20 dark:bg-white/[0.03]">
                    {/* Level 1 — Deadline */}
                    <button
                      onClick={() => toggleKey(dlKey)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
                    >
                      <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform shrink-0', dlOpen && 'rotate-90')} />
                      <span className={cn(
                        'text-sm font-bold',
                        isToday ? 'text-amber-700 dark:text-amber-400'
                          : isOverdue ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-800 dark:text-slate-100'
                      )}>
                        {isOverdue ? '⚑ ' : ''}{dlNode.deadline === 'none' ? dlLabel : isToday ? `${dlLabel} · Due today` : `Due ${dlLabel}`}
                      </span>
                      <span className="text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-white/10 border border-white/50 rounded-full px-1.5 py-0.5">
                        {dlNode.count} {dlNode.count === 1 ? 'task' : 'tasks'}
                      </span>
                    </button>

                    {dlOpen && dlNode.clients.map(clientNode => {
                      const clientKey = `c:${dlNode.deadline}|${clientNode.client}`;
                      const clientOpen = !collapsedKeys.has(clientKey);
                      return (
                        <div key={clientNode.client} className="border-t border-white/30 dark:border-white/5">
                          {/* Level 2 — Client */}
                          <button
                            onClick={() => toggleKey(clientKey)}
                            className="w-full flex items-center gap-2 pl-8 pr-3 py-2 hover:bg-white/20 dark:hover:bg-white/5 transition-colors"
                          >
                            <ChevronRight className={cn('h-3.5 w-3.5 text-slate-400 transition-transform shrink-0', clientOpen && 'rotate-90')} />
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{clientNode.client}</span>
                            <span className="text-[10px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">{clientNode.leaves.length}</span>
                          </button>

                          {/* Level 3 — Task (Title — Type) */}
                          {clientOpen && clientNode.leaves.map(({ row, task }) => {
                            const taskIsActive = timerState.activeTaskId === task.id;
                            const taskAccumulated = timerState.totals[task.id] ?? 0;
                            const taskCurrentMs = taskIsActive && timerState.startedAt ? Date.now() - timerState.startedAt : 0;
                            const taskTotalMs = taskAccumulated + taskCurrentMs;
                            return (
                              <div key={task.id} className="flex items-center gap-2.5 pl-14 pr-3 py-2 border-t border-white/10 dark:border-white/[0.03] bg-slate-50/40 dark:bg-slate-900/20">
                                <button
                                  onClick={() => openTaskDetail(task.id)}
                                  className="flex items-center gap-2.5 text-left rounded-md -ml-1 px-1 py-0.5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                  title="View task details"
                                >
                                  <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-200 capitalize">{row.content_type}</span>
                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                <span className={cn(
                                  'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border capitalize',
                                  mediaTypeSet.has(task.task_type)
                                    ? 'bg-violet-500/10 border-violet-400/30 text-violet-700 dark:text-violet-300'
                                    : 'bg-blue-500/10 border-blue-400/30 text-blue-700 dark:text-blue-300'
                                )}>
                                  {task.task_type}
                                </span>
                                <span className={cn(
                                  'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border',
                                  STATUS_GLASS[task.status] ?? STATUS_GLASS.draft
                                )}>
                                  {task.status.replace(/_/g, ' ')}
                                </span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                    posts {new Date(row.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </span>
                                </button>
                                {timerMounted && (
                                  <div className="ml-auto flex items-center gap-2">
                                    <button
                                      onClick={() => taskIsActive ? pauseTimer(task.id) : startTimer(task.id)}
                                      className={cn(
                                        'text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all',
                                        taskIsActive
                                          ? 'bg-amber-500/15 border-amber-400/40 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
                                          : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                                      )}
                                    >
                                      {taskIsActive ? '⏸ Pause' : taskTotalMs > 0 ? '▶ Resume' : '▶ Start'}
                                    </button>
                                    {taskTotalMs > 0 && (
                                      <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums bg-white/60 dark:bg-white/10 border border-white/40 px-2 py-0.5 rounded">
                                        {formatMs(taskTotalMs)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : (
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-white/30 dark:border-white/10 bg-white/20 dark:bg-white/5">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={displayRows.length > 0 && displayRows.every(r => selected.has(r.id))}
                    onChange={toggleAll}
                    className="rounded accent-blue-600"
                  />
                </th>

                {/* Sortable + filterable columns */}
                {(([
                  ['client_name',   'Client',       clients],
                  ['platform',      'Platform',     platforms],
                  ['content_type',  'Type',         contentTypes],
                  ['posting_date',  'Posting Date', null],
                  ['status',        'Status',       ROW_STATUSES],
                ]) as [string, string, string[] | null][]).map(([field, label, options]) => {
                  const hasFilter = !!colFilters[field];
                  return (
                    <th key={field} className={thCls}>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => toggleSort(field)}
                          className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group"
                        >
                          {label}
                          {sortIcon(field)}
                        </button>
                        {options && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-white/50 ${hasFilter ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`}
                              title={`Filter by ${label}`}
                            >
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem onClick={() => setColFilter(field, '')} className={!colFilters[field] ? 'font-semibold' : ''}>
                                All {label.toLowerCase()}s
                              </DropdownMenuItem>
                              {options.map(opt => (
                                <DropdownMenuItem
                                  key={opt}
                                  onClick={() => setColFilter(field, opt)}
                                  className={`capitalize ${colFilters[field] === opt ? 'font-semibold text-blue-600' : ''}`}
                                >
                                  {opt.replace(/_/g, ' ')}
                                  {colFilters[field] === opt && <span className="ml-auto text-xs">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Tasks */}
                {(() => {
                  const taskStatusOptions = ['pending', 'in_progress', 'done', 'approved', 'cancelled'];
                  const hasFilter = !!colFilters['task_status'];
                  return (
                    <th className={thCls}>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('tasks')} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group">
                          Tasks {sortIcon('tasks')}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-white/50 ${hasFilter ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`} title="Filter by task status">
                            <ListFilter className="h-3 w-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => setColFilter('task_status', '')} className={!colFilters['task_status'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                            {taskStatusOptions.map(opt => (
                              <DropdownMenuItem key={opt} onClick={() => setColFilter('task_status', opt)} className={`capitalize ${colFilters['task_status'] === opt ? 'font-semibold text-blue-600' : ''}`}>
                                {opt.replace(/_/g, ' ')}{colFilters['task_status'] === opt && <span className="ml-auto text-xs">✓</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  );
                })()}

                {/* Employee */}
                {!hideEmployee && (() => {
                  const hasFilter = !!colFilters['assignee'];
                  return (
                    <th className={thCls}>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('assignee')} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group">
                          Employee {sortIcon('assignee')}
                        </button>
                        {assigneeOptions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-white/50 ${hasFilter ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`} title="Filter by employee">
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              <DropdownMenuItem onClick={() => setColFilter('assignee', '')} className={!colFilters['assignee'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                              {assigneeOptions.map(([id, name]) => (
                                <DropdownMenuItem key={id} onClick={() => setColFilter('assignee', id)} className={colFilters['assignee'] === id ? 'font-semibold text-blue-600' : ''}>
                                  {name}{colFilters['assignee'] === id && <span className="ml-auto text-xs">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </th>
                  );
                })()}

                <th className={thCls}>SMO</th>

                {/* Source */}
                {(() => {
                  const hasFilter = !!colFilters['source'];
                  return (
                    <th className={thCls}>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('source')} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors group">
                          Source {sortIcon('source')}
                        </button>
                        {sourceOptions.length > 1 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-white/50 ${hasFilter ? 'text-blue-600' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'}`} title="Filter by source">
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              <DropdownMenuItem onClick={() => setColFilter('source', '')} className={!colFilters['source'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                              {sourceOptions.map(opt => (
                                <DropdownMenuItem key={opt} onClick={() => setColFilter('source', opt)} className={`capitalize ${colFilters['source'] === opt ? 'font-semibold text-blue-600' : ''}`}>
                                  {opt}{colFilters['source'] === opt && <span className="ml-auto text-xs">✓</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </th>
                  );
                })()}

                {!canImport && currentUserId && (
                  <th className={thCls}>Action</th>
                )}
              </tr>
            </thead>

            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-14 text-center text-sm text-slate-400 dark:text-slate-500">
                    No content rows found.
                  </td>
                </tr>
              ) : displayRows.map((row, rowIdx) => {
                const myTasks = currentUserId ? row.tasks.filter(t => t.assignee_id === currentUserId) : [];
                const hasActiveTimer = myTasks.some(t => timerState.activeTaskId === t.id);
                const isExpanded = expandedRows.has(row.id);
                const hasTaskDueToday = !canImport && myTasks.some(t => t.internal_deadline?.slice(0, 10) === todayStr);
                return (
                <Fragment key={row.id}>
                <tr
                  className={cn(
                    'transition-colors text-[13px]',
                    'border-b border-white/20 dark:border-white/5 last:border-0',
                    selected.has(row.id)
                      ? 'bg-blue-500/8 dark:bg-blue-400/10'
                      : hasTaskDueToday
                        ? 'bg-amber-500/5 dark:bg-amber-400/5 border-l-2 border-l-amber-400/70'
                        : rowIdx % 2 === 0
                          ? 'hover:bg-blue-500/5 dark:hover:bg-blue-400/5'
                          : 'bg-white/10 dark:bg-white/[0.02] hover:bg-blue-500/5 dark:hover:bg-blue-400/5'
                  )}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="rounded accent-blue-600"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-bold text-blue-700 dark:text-blue-400">
                    {row.client_name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-slate-600 dark:text-slate-300">{row.platform}</td>
                  <td className="px-3 py-2.5 capitalize text-slate-700 dark:text-slate-200">{row.content_type}</td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                    {new Date(row.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2.5">
                    <InlineStatusSelect rowId={row.id} currentStatus={row.status} />
                  </td>
                  <td className="px-3 py-2.5">
                    {row.tasks.length === 0 && !row.auto_create_tasks ? (
                      <span className="text-[11px] text-amber-600 font-semibold">Pending</span>
                    ) : (
                      <TaskBadge tasks={row.tasks} />
                    )}
                  </td>
                  {!hideEmployee && (
                    <td className="px-3 py-2.5">
                      {(() => {
                          const mediaTask = row.tasks.find(t => mediaTypeSet.has(t.task_type));
                          return (
                            <AssignTaskCell
                              task={mediaTask}
                              pool={teamMembers.filter(m => m.role === (mediaTask ? taskTypeRoles[mediaTask.task_type] : ''))}
                            />
                          );
                        })()}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    {(() => {
                      const publishingTask = row.tasks.find(t => publishingTypeSet.has(t.task_type));
                      return (
                        <AssignTaskCell
                          task={publishingTask}
                          pool={teamMembers.filter(m => publishingRoles.includes(m.role))}
                        />
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 capitalize font-medium">{row.source}</span>
                  </td>
                  {!canImport && currentUserId && (
                    <td className="px-3 py-2.5">
                      {timerMounted && myTasks.length > 0 ? (
                        <button
                          onClick={() => toggleExpanded(row.id)}
                          className={cn(
                            'flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full border transition-all',
                            isExpanded
                              ? 'bg-blue-500/15 border-blue-400/40 text-blue-700 dark:text-blue-300'
                              : hasActiveTimer
                              ? 'bg-amber-500/15 border-amber-400/40 text-amber-700 dark:text-amber-300'
                              : hasTaskDueToday
                              ? 'bg-amber-500/15 border-amber-400/50 text-amber-800 dark:text-amber-300'
                              : 'bg-slate-100/60 border-slate-200/60 text-slate-600 hover:bg-slate-200/60 dark:bg-slate-800/40 dark:text-slate-400'
                          )}
                        >
                          {hasActiveTimer && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                          {myTasks.length} task{myTasks.length > 1 ? 's' : ''}
                          {hasTaskDueToday && (
                            <span className="text-[9px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded-full leading-none">Today</span>
                          )}
                          <span className="text-[9px]">{isExpanded ? '▴' : '▾'}</span>
                        </button>
                      ) : timerMounted ? (
                        <span className="text-[11px] text-slate-300 dark:text-slate-600">—</span>
                      ) : null}
                    </td>
                  )}
                </tr>
                {isExpanded && timerMounted && myTasks.map(task => {
                  const taskIsActive = timerState.activeTaskId === task.id;
                  const taskAccumulated = timerState.totals[task.id] ?? 0;
                  const taskCurrentMs = taskIsActive && timerState.startedAt ? Date.now() - timerState.startedAt : 0;
                  const taskTotalMs = taskAccumulated + taskCurrentMs;
                  return (
                    <tr key={`task-${task.id}`} className="bg-slate-50/50 dark:bg-slate-900/30">
                      <td colSpan={10} className="border-b border-white/10 dark:border-white/5">
                        <div className="pl-10 pr-4 py-2 flex items-center gap-4">
                          <span className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border capitalize',
                            mediaTypeSet.has(task.task_type)
                              ? 'bg-violet-500/10 border-violet-400/30 text-violet-700 dark:text-violet-300'
                              : 'bg-blue-500/10 border-blue-400/30 text-blue-700 dark:text-blue-300'
                          )}>
                            {task.task_type}
                          </span>
                          <span className={cn(
                            'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border',
                            STATUS_GLASS[task.status] ?? STATUS_GLASS.draft
                          )}>
                            {task.status.replace(/_/g, ' ')}
                          </span>
                          {task.internal_deadline && (
                            <span className={cn(
                              'text-[11px] font-semibold',
                              task.internal_deadline.slice(0, 10) === todayStr
                                ? 'text-amber-700 dark:text-amber-400'
                                : task.internal_deadline.slice(0, 10) < todayStr
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-slate-400 dark:text-slate-500'
                            )}>
                              {task.internal_deadline.slice(0, 10) === todayStr ? '⚑ Due today' : `Due ${new Date(task.internal_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                            </span>
                          )}
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              onClick={() => taskIsActive ? pauseTimer(task.id) : startTimer(task.id)}
                              className={cn(
                                'text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all',
                                taskIsActive
                                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300'
                                  : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                              )}
                            >
                              {taskIsActive ? '⏸ Pause' : taskTotalMs > 0 ? '▶ Resume' : '▶ Start'}
                            </button>
                            {taskTotalMs > 0 && (
                              <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums bg-white/60 dark:bg-white/10 border border-white/40 px-2 py-0.5 rounded">
                                {formatMs(taskTotalMs)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </Fragment>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <TaskDetailDialog
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusChanged={handleTaskStatusChanged}
      />

      {/* ── AI Schedule Analysis dialog ──────────────────────────────────────── */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ✦ AI Schedule Analysis
              <span className="text-xs font-normal bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">
                {aiSuggestions.length} conflict{aiSuggestions.length !== 1 ? 's' : ''} detected
              </span>
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Review AI suggestions and adjust assignments as needed.
          </p>
          <div className="space-y-3 mt-1">
            {aiSuggestions.map(s => (
              <div
                key={s.task_id}
                className={`rounded-lg border p-4 space-y-2 ${
                  s.urgency === 'high'
                    ? 'border-destructive/50 bg-destructive/5'
                    : s.urgency === 'medium'
                    ? 'border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium capitalize">
                      {s.task_type} task · {s.client}
                      {(s.content_type || s.platform) && (
                        <span className="text-muted-foreground font-normal ml-1">
                          ({s.content_type || s.platform})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Assigned to: <span className="font-medium text-foreground">{s.assignee_name}</span>
                      {' · '}Posting: {new Date(s.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${
                      s.urgency === 'high' ? 'bg-destructive/15 text-destructive' :
                      s.urgency === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {s.urgency}
                    </span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${
                      s.conflict_type === 'skill_mismatch' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                      s.conflict_type === 'free_capacity'  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {s.conflict_type === 'skill_mismatch' ? '⚠ Wrong Skill' :
                       s.conflict_type === 'free_capacity'  ? '✓ Start Early' :
                       s.conflict_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {s.conflict_type === 'skill_mismatch' && (
                  <p className="text-xs rounded px-2 py-1 bg-red-100/60 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {s.content_type} task needs a <strong>{s.required_specialty?.replace('_', ' ')}</strong> — assigned to a {s.assigned_specialty?.replace('_', ' ') ?? 'different specialist'}
                    {s.suggested_assignee_name && <span> · Suggest: <strong>{s.suggested_assignee_name}</strong></span>}
                  </p>
                )}
                {s.conflict_type === 'free_capacity' && (
                  <p className="text-xs rounded px-2 py-1 bg-green-100/60 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    {s.assignee_name} has only {s.current_load ?? 0} active task(s) — deadline is {Math.round((s.hours_until_deadline ?? 0) / 24)} days away, can start now
                  </p>
                )}
                {s.conflict_type === 'leave_overlap' && (
                  <p className="text-xs rounded px-2 py-1 bg-amber-100/60 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    On approved leave: {s.leave_start} → {s.leave_end}
                  </p>
                )}
                {s.conflict_type === 'over_capacity' && (
                  <p className="text-xs rounded px-2 py-1 bg-red-100/60 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    Workload: {s.current_load} / {s.max_capacity} tasks (at capacity)
                  </p>
                )}
                {s.conflict_type === 'tight_deadline' && (
                  <p className="text-xs rounded px-2 py-1 bg-orange-100/60 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    Deadline in {Math.round(s.hours_until_deadline ?? 0)}h — very tight
                  </p>
                )}

                <div className="flex items-baseline gap-2 text-xs">
                  <span className="text-primary font-semibold shrink-0">AI suggests:</span>
                  <span className="font-medium capitalize">{s.suggestion.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="mt-2">
            <p className="text-xs text-muted-foreground flex-1">
              Use the Assign column in the table to act on these suggestions.
            </p>
            <Button variant="outline" onClick={() => setAiOpen(false)}>Dismiss</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Change status dialog ─────────────────────────────────────────────── */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Update status for {selected.size} selected row{selected.size !== 1 ? 's' : ''}.
          </p>
          <Select value={bulkStatus || NONE} onValueChange={v => setBulkStatus(!v || v === NONE ? '' : v)}>
            <SelectTrigger><span className="truncate">{bulkStatus || 'Select status…'}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— select —</SelectItem>
              {ROW_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button disabled={!bulkStatus || loading} onClick={handleBulkStatus}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm dialog ─────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete {selected.size} row{selected.size !== 1 ? 's' : ''}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the content rows and all associated tasks. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={loading} onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
