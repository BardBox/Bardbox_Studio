'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { PipelineTask, UserProfile, UserRole } from '@/lib/types';
import {
  Clock, Calendar, AlertTriangle, ListChecks, Users, Zap, Download, Plus,
  Shuffle, ChevronUp, ChevronDown, ChevronsUpDown, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { cn, statusLabel } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TaskDetailPanel } from '@/components/shared/TaskDetailPanel';
import { ExportTasksModal } from '@/components/manager/ExportTasksModal';
import { CreateContentDialog } from '@/components/content/CreateContentDialog';

/* ── Avatar helpers ─────────────────────────────────────────── */
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

function PersonChip({ name, sub }: { name: string | null; sub?: string }) {
  if (!name) return <span className="text-slate-400/60 italic text-xs">—</span>;
  const color = avatarColor(name);
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[10px] font-bold shrink-0', color)}>
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate text-slate-700 dark:text-slate-200">{name}</span>
        {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Glass badge maps ───────────────────────────────────────── */
const STATUS_GLASS: Record<string, string> = {
  todo:          'bg-white/40 border-white/60 text-slate-600',
  working_on_it: 'bg-blue-500/15 border-blue-400/40 text-blue-700',
  submitted:     'bg-amber-500/15 border-amber-400/40 text-amber-700',
  approved:      'bg-emerald-500/15 border-emerald-400/40 text-emerald-700',
  done:          'bg-teal-500/15 border-teal-400/40 text-teal-700',
  blocked:       'bg-red-500/15 border-red-400/40 text-red-700',
  on_hold:       'bg-slate-500/15 border-slate-400/40 text-slate-600',
};

const PRIORITY_GLASS: Record<string, string> = {
  emergency: 'bg-red-500/15 border-red-400/40 text-red-700',
  high:      'bg-orange-500/15 border-orange-400/40 text-orange-700',
  medium:    'bg-amber-500/15 border-amber-400/40 text-amber-700',
  low:       'bg-emerald-500/15 border-emerald-400/40 text-emerald-700',
};

const PRESSURE_TEXT: Record<string, string> = {
  overdue:     'text-red-600 font-semibold',
  critical:    'text-orange-500 font-medium',
  approaching: 'text-amber-600',
  comfortable: 'text-emerald-600',
  completed:   'text-slate-400',
};

/* ── Quick filters ──────────────────────────────────────────── */
interface QuickFilter { id: string; label: string; icon: React.ElementType; type: 'time' | 'additive' }
const QUICK_FILTERS: QuickFilter[] = [
  { id: 'today',      label: 'Today',      icon: Clock,         type: 'time' },
  { id: '7-days',     label: '7 Days',     icon: Calendar,      type: 'time' },
  { id: '30-days',    label: '30 Days',    icon: Calendar,      type: 'time' },
  { id: 'this-month', label: 'This Month', icon: Calendar,      type: 'time' },
  { id: 'overdue',    label: 'Overdue',    icon: AlertTriangle, type: 'additive' },
  { id: 'pending',    label: 'Pending',    icon: ListChecks,    type: 'additive' },
  { id: 'unassigned', label: 'Unassigned', icon: Users,         type: 'additive' },
  { id: 'emergency',  label: 'Emergency',  icon: Zap,           type: 'additive' },
];
const TIME_FILTERS = ['today', '7-days', '30-days', 'this-month'];
const INACTIVE_STATUSES = ['approved', 'done', 'blocked'];

const STATUS_OPTIONS = [
  { label: 'To Do',       value: 'todo' },
  { label: 'In Progress', value: 'working_on_it' },
  { label: 'Submitted',   value: 'submitted' },
  { label: 'Approved',    value: 'approved' },
  { label: 'Done',        value: 'done' },
  { label: 'Blocked',     value: 'blocked' },
  { label: 'On Hold',     value: 'on_hold' },
];

/* ── Types ──────────────────────────────────────────────────── */
interface Props {
  initialTasks: PipelineTask[];
  team: UserProfile[];
  clients: string[];
  userRole: UserRole;
  taskTypeRoles: Record<string, string>;
}

interface CapacityEntry {
  user_id: string;
  full_name: string;
  role: string;
  daily_cap: number | null;
  current_load: number;
}

type SortKey = 'client_name' | 'platform' | 'posting_date' | 'internal_deadline' | 'smo_name' | 'assignee_name' | 'priority' | 'task_status';
type SortDir = 'asc' | 'desc' | null;

/* ── Column filter dropdown ─────────────────────────────────── */
function ColFilter({
  options,
  value,
  placeholder,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string | null;
  placeholder: string;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={cn(
          'p-0.5 rounded transition-colors',
          value ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
        )}
      >
        <Filter className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[10rem] rounded-xl bg-white/90 backdrop-blur-xl border border-white/60 shadow-xl py-1">
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-blue-500/10 hover:text-slate-600 transition-colors"
          >
            {placeholder}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs transition-colors',
                value === opt.value
                  ? 'bg-blue-500/15 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-blue-500/10 hover:text-slate-800'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sort icon ──────────────────────────────────────────────── */
function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')  return <ChevronUp   className="h-3 w-3 text-blue-600" />;
  if (dir === 'desc') return <ChevronDown className="h-3 w-3 text-blue-600" />;
  return <ChevronsUpDown className="h-3 w-3 text-slate-300" />;
}

const PAGE_SIZE = 25;

/* ── Main component ─────────────────────────────────────────── */
export function AllTasksTable({ initialTasks, team, clients, userRole, taskTypeRoles }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [panelTask, setPanelTask] = useState<PipelineTask | null>(null);
  const [reassignTarget, setReassignTarget] = useState<PipelineTask | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [capacityLoad, setCapacityLoad] = useState<CapacityEntry[]>([]);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [redistributing, setRedistributing] = useState(false);
  const [page, setPage] = useState(0);
  const [redistributeMonth, setRedistributeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('internal_deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Column filters
  const [colFilters, setColFilters] = useState<Partial<Record<SortKey, string | null>>>({});

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const setColFilter = (key: SortKey, value: string | null) => {
    setColFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const hasAnyFilter = activeQuickFilters.length > 0 || Object.values(colFilters).some(Boolean);

  const handleQuickFilter = (id: string) => {
    setActiveQuickFilters(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      if (TIME_FILTERS.includes(id)) return [...prev.filter(f => !TIME_FILTERS.includes(f)), id];
      return [...prev, id];
    });
    setPage(0);
  };

  const clearAll = () => { setActiveQuickFilters([]); setColFilters({}); setPage(0); };

  /* ── Filtered + sorted data ─────────────────────────────── */
  const processed = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let result = [...tasks];

    // Quick filters
    if (activeQuickFilters.length > 0) {
      const isPending = (t: PipelineTask) => !INACTIVE_STATUSES.includes(t.task_status);
      const activeTime = activeQuickFilters.find(f => TIME_FILTERS.includes(f));
      if (activeTime === 'today') {
        result = result.filter(t => { const d = new Date(t.posting_date); d.setHours(0,0,0,0); return d.getTime() === today.getTime() || isPending(t); });
      } else if (activeTime === '7-days') {
        const c = new Date(today); c.setDate(c.getDate() - 7);
        result = result.filter(t => { const d = new Date(t.posting_date); d.setHours(0,0,0,0); return (d >= c && d <= today) || isPending(t); });
      } else if (activeTime === '30-days') {
        const c = new Date(today); c.setDate(c.getDate() - 30);
        result = result.filter(t => { const d = new Date(t.posting_date); d.setHours(0,0,0,0); return (d >= c && d <= today) || isPending(t); });
      } else if (activeTime === 'this-month') {
        result = result.filter(t => { const d = new Date(t.posting_date); return (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) || isPending(t); });
      }
      if (activeQuickFilters.includes('overdue'))    result = result.filter(t => t.pressure_level === 'overdue');
      if (activeQuickFilters.includes('pending'))    result = result.filter(t => ['todo','working_on_it'].includes(t.task_status));
      if (activeQuickFilters.includes('unassigned')) result = result.filter(t => !t.assignee_id);
      if (activeQuickFilters.includes('emergency'))  result = result.filter(t => t.is_emergency);
    }

    // Column filters
    if (colFilters.client_name)   result = result.filter(t => t.client_name === colFilters.client_name);
    if (colFilters.platform)      result = result.filter(t => t.platform === colFilters.platform);
    if (colFilters.smo_name)      result = result.filter(t => t.smo_name === colFilters.smo_name);
    if (colFilters.assignee_name) result = result.filter(t => t.assignee_name === colFilters.assignee_name);
    if (colFilters.task_status)   result = result.filter(t => t.task_status === colFilters.task_status);

    // Sort
    if (sortDir) {
      result.sort((a, b) => {
        let av: string | number = '';
        let bv: string | number = '';
        if (sortKey === 'client_name')       { av = a.client_name ?? ''; bv = b.client_name ?? ''; }
        else if (sortKey === 'platform')     { av = a.platform; bv = b.platform; }
        else if (sortKey === 'posting_date') { av = a.posting_date; bv = b.posting_date; }
        else if (sortKey === 'internal_deadline') { av = a.internal_deadline; bv = b.internal_deadline; }
        else if (sortKey === 'smo_name')     { av = a.smo_name ?? ''; bv = b.smo_name ?? ''; }
        else if (sortKey === 'assignee_name'){ av = a.assignee_name ?? ''; bv = b.assignee_name ?? ''; }
        else if (sortKey === 'priority')     { av = a.priority; bv = b.priority; }
        else if (sortKey === 'task_status')  { av = a.task_status; bv = b.task_status; }
        const cmp = String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [tasks, activeQuickFilters, colFilters, sortKey, sortDir]);

  const totalPages = Math.ceil(processed.length / PAGE_SIZE);
  const pageSlice  = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ── Options for column filter dropdowns ────────────────── */
  const platformOpts = useMemo(() =>
    [...new Set(initialTasks.map(t => t.platform))].map(p => ({ label: p, value: p })),
  [initialTasks]);

  const productionRoles = useMemo(() => Object.values(taskTypeRoles), [taskTypeRoles]);
  const assigneeOpts = useMemo(() =>
    team
      .filter(m => productionRoles.includes(m.role))
      .map(m => ({ label: m.full_name, value: m.full_name })),
  [team, productionRoles]);

  const smoOpts = useMemo(() =>
    team
      .filter(m => m.role === 'smo')
      .map(m => ({ label: m.full_name, value: m.full_name })),
  [team]);

  /* ── Reassign ───────────────────────────────────────────── */
  async function openReassign(t: PipelineTask) {
    setReassignTarget(t);
    setNewAssignee(t.assignee_id ?? '');
    setCapacityLoad([]);
    setLoadingCapacity(true);
    try {
      const params = new URLSearchParams({ date: t.posting_date, content_type: t.content_type, task_type: t.task_type });
      const res = await fetch(`/api/tasks/capacity-load?${params}`);
      if (res.ok) setCapacityLoad(await res.json());
    } finally {
      setLoadingCapacity(false);
    }
  }

  async function handleReassign() {
    if (!reassignTarget || !newAssignee) return;
    setReassigning(true);
    const res = await fetch('/api/tasks/override-assignee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: reassignTarget.task_id, assignee_id: newAssignee }),
    });
    if (res.ok) {
      const member = team.find(m => m.id === newAssignee);
      setTasks(prev => prev.map(t =>
        t.task_id === reassignTarget.task_id
          ? { ...t, assignee_id: newAssignee, assignee_name: member?.full_name ?? null }
          : t
      ));
      toast.success('Task reassigned');
      setReassignTarget(null);
      setNewAssignee('');
    } else {
      toast.error('Reassignment failed');
    }
    setReassigning(false);
  }

  async function handleRedistribute() {
    setRedistributing(true);
    try {
      const res = await fetch('/api/tasks/redistribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: redistributeMonth }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      toast.success(`Re-assigned ${json.reassigned} of ${json.total} tasks`);
      setRedistributeOpen(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Redistribution failed');
    } finally {
      setRedistributing(false);
    }
  }

  const thCls = 'px-3 py-2.5 text-left text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 whitespace-nowrap';

  function SortableTh({
    col, label, filterKey, filterOpts, filterPlaceholder,
  }: {
    col: SortKey;
    label: string;
    filterKey?: SortKey;
    filterOpts?: { label: string; value: string }[];
    filterPlaceholder?: string;
  }) {
    return (
      <th className={thCls}>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleSort(col)}
            className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            {label}
            <SortIcon dir={sortKey === col ? sortDir : null} />
          </button>
          {filterKey && filterOpts && (
            <ColFilter
              options={filterOpts}
              value={colFilters[filterKey] ?? null}
              placeholder={filterPlaceholder ?? 'All'}
              onChange={v => setColFilter(filterKey, v)}
            />
          )}
        </div>
      </th>
    );
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      {/* Quick filter bar */}
      <div className="flex flex-wrap gap-2 items-center bg-white/40 backdrop-blur-sm border border-white/50 dark:bg-white/10 dark:border-white/20 rounded-2xl px-4 py-2.5">
        {QUICK_FILTERS.map(filter => {
          const Icon = filter.icon;
          const isActive = activeQuickFilters.includes(filter.id);
          return (
            <button key={filter.id} onClick={() => handleQuickFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap',
                isActive
                  ? 'bg-blue-500/15 border-blue-400/40 text-blue-700 dark:bg-blue-400/20 dark:border-blue-400/30 dark:text-blue-300'
                  : 'bg-white/50 border-white/60 text-slate-500 hover:text-slate-700 hover:bg-white/70 dark:bg-white/10 dark:border-white/20 dark:text-slate-400'
              )}>
              <Icon className="h-3 w-3" />
              {filter.label}
            </button>
          );
        })}
        <button
          onClick={clearAll}
          disabled={!hasAnyFilter}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border transition-all',
            hasAnyFilter
              ? 'bg-red-500/10 border-red-400/30 text-red-600 hover:bg-red-500/20 cursor-pointer'
              : 'bg-white/20 border-white/30 text-slate-300 cursor-default dark:text-slate-600'
          )}>
          Clear Filters
        </button>
        {(['manager', 'admin', 'ceo', 'smo'] as UserRole[]).includes(userRole) && tasks.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setRedistributeOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/50 border border-white/60 text-slate-500 hover:text-slate-700 hover:bg-white/70 transition-all dark:bg-white/10 dark:border-white/20 dark:text-slate-400"
            >
              <Shuffle className="h-3 w-3" />
              Redistribute
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white/50 border border-white/60 text-slate-500 hover:text-slate-700 hover:bg-white/70 transition-all dark:bg-white/10 dark:border-white/20 dark:text-slate-400"
            >
              <Download className="h-3 w-3" />
              Export Excel
            </button>
          </div>
        )}
        {!(['manager', 'admin', 'ceo', 'smo'] as UserRole[]).includes(userRole) && (
          <div className="ml-auto">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              New Content
            </button>
          </div>
        )}
      </div>

      {/* Glass table */}
      <div className="glass-panel rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/30 dark:border-white/10 bg-white/20 dark:bg-white/5">
                <SortableTh col="client_name"       label="Client"          filterKey="client_name"   filterOpts={clients.map(c => ({ label: c, value: c }))} filterPlaceholder="Any client" />
                <SortableTh col="platform"          label="Platform / Type" filterKey="platform"      filterOpts={platformOpts} filterPlaceholder="Any platform" />
                <SortableTh col="posting_date"      label="Post Date" />
                <SortableTh col="internal_deadline" label="Deadline" />
                <SortableTh col="smo_name"          label="SMO"             filterKey="smo_name"      filterOpts={smoOpts}      filterPlaceholder="Any SMO" />
                <SortableTh col="assignee_name"     label="Assignee"        filterKey="assignee_name" filterOpts={assigneeOpts} filterPlaceholder="Anyone" />
                <SortableTh col="priority"          label="Priority" />
                <SortableTh col="task_status"       label="Status"          filterKey="task_status"   filterOpts={STATUS_OPTIONS} filterPlaceholder="Any status" />
                <th className={thCls} />
              </tr>
            </thead>
            <tbody>
              {pageSlice.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">
                    No tasks match the current filters
                  </td>
                </tr>
              ) : pageSlice.map(t => (
                <tr
                  key={t.task_id}
                  onClick={() => setPanelTask(t)}
                  className="border-b border-white/20 dark:border-white/5 hover:bg-blue-500/5 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className="font-bold text-slate-800 dark:text-slate-100">{t.client_name ?? '—'}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="capitalize text-sm font-medium text-slate-700 dark:text-slate-200">{t.platform}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{t.content_type}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-slate-500 tabular-nums">
                      {new Date(t.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn('text-xs font-medium tabular-nums', PRESSURE_TEXT[t.pressure_level])}>
                      {new Date(t.internal_deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <PersonChip name={t.smo_name} />
                  </td>
                  <td className="px-3 py-2.5">
                    <PersonChip
                      name={t.assignee_name}
                      sub={t.assignee_specialty === 'video_editor' ? '🎬 Video' : t.assignee_specialty === 'graphic_designer' ? '🎨 Graphic' : undefined}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize',
                      PRIORITY_GLASS[t.priority] ?? 'bg-white/40 border-white/60 text-slate-600'
                    )}>
                      {t.is_emergency && <Zap className="h-3 w-3" />}
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border',
                      STATUS_GLASS[t.task_status] ?? 'bg-white/40 border-white/60 text-slate-600'
                    )}>
                      {statusLabel(t.task_status)}
                    </span>
                  </td>
                  {(['manager', 'admin', 'ceo', 'smo'] as UserRole[]).includes(userRole) && (
                    <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openReassign(t)}
                        className="text-[10px] font-bold px-3 py-1 rounded-full bg-slate-800/90 text-white hover:bg-slate-700 transition-colors"
                      >
                        Reassign
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/25 dark:border-white/10 bg-white/10 dark:bg-white/5">
            <span className="text-xs text-slate-500">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, processed.length)} of {processed.length} tasks
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/40 disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = totalPages <= 7 ? i : page <= 3 ? i : page >= totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'min-w-[28px] h-7 px-1 rounded-lg text-xs font-semibold transition-colors',
                      p === page
                        ? 'bg-blue-500/15 border border-blue-400/40 text-blue-700'
                        : 'text-slate-500 hover:bg-white/40 hover:text-slate-700'
                    )}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/40 disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task detail panel */}
      <TaskDetailPanel
        task={panelTask}
        userRole={userRole}
        onClose={() => setPanelTask(null)}
        onTaskUpdated={() => { setPanelTask(null); router.refresh(); }}
      />

      {/* Export modal */}
      <ExportTasksModal open={exportOpen} onClose={() => setExportOpen(false)} />

      {/* Reassign dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={() => setReassignTarget(null)}>
        <DialogContent variant="glass">
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {reassignTarget?.client_name} — <span className="capitalize">{reassignTarget?.content_type}</span> ({reassignTarget?.task_type})
            &nbsp;·&nbsp;
            {reassignTarget?.posting_date && new Date(reassignTarget.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </p>
          {loadingCapacity ? (
            <p className="text-xs text-slate-400">Loading capacity…</p>
          ) : capacityLoad.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {capacityLoad.map(entry => {
                const cap = entry.daily_cap ?? 0;
                const load = entry.current_load;
                const isFull = cap > 0 && load >= cap;
                const isNearFull = cap > 0 && load === cap - 1;
                return (
                  <button
                    key={entry.user_id}
                    type="button"
                    onClick={() => setNewAssignee(entry.user_id)}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition-all cursor-pointer',
                      newAssignee === entry.user_id
                        ? 'border-blue-400/50 bg-blue-500/10 ring-1 ring-blue-400/30'
                        : 'border-white/50 bg-white/30 hover:bg-white/50 hover:border-white/70',
                    )}
                  >
                    <span className="font-medium truncate text-slate-700">{entry.full_name.split(' ')[0]}</span>
                    {cap > 0 ? (
                      <span className={cn('ml-2 shrink-0 text-xs font-bold tabular-nums', isFull ? 'text-red-600' : isNearFull ? 'text-orange-500' : 'text-emerald-600')}>
                        {load}/{cap}{isFull && ' Full'}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-slate-400">no cap</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
          <Select value={newAssignee || undefined} onValueChange={v => { if (v) setNewAssignee(v); }}>
            <SelectTrigger className="mt-1 bg-white/50 border-white/60 dark:bg-white/10 dark:border-white/20">
              <SelectValue placeholder="Or pick from all team members…" />
            </SelectTrigger>
            <SelectContent>
              {team.filter(m => {
                return reassignTarget
                  ? m.role === taskTypeRoles[reassignTarget.task_type] || ['manager', 'admin'].includes(m.role)
                  : true;
              }).map(m => {
                const entry = capacityLoad.find(e => e.user_id === m.id);
                const capLabel = entry ? ` (${entry.current_load}/${entry.daily_cap ?? '∞'})` : '';
                return <SelectItem key={m.id} value={m.id}>{m.full_name}{capLabel}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <DialogFooter className="border-t border-white/30 dark:border-white/10 pt-4">
            <Button variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button disabled={!newAssignee || reassigning} onClick={handleReassign}>
              {reassigning ? 'Reassigning…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redistribute dialog */}
      <Dialog open={redistributeOpen} onOpenChange={v => { if (!v) setRedistributeOpen(false); }}>
        <DialogContent variant="glass" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redistribute Tasks</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Re-runs auto-assign on all <strong>to-do</strong> tasks for the selected month.
            New team members with capacity set will be included in the pool.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Month</label>
            <input
              type="month"
              value={redistributeMonth}
              onChange={e => setRedistributeMonth(e.target.value)}
              className="w-full border border-white/50 rounded-xl px-3 py-1.5 text-sm bg-white/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 dark:bg-white/10 dark:border-white/20"
            />
          </div>
          <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-400/30 rounded-xl px-3 py-2">
            Only unstarted (to-do) tasks will be re-assigned. In-progress or submitted tasks are untouched.
          </p>
          <DialogFooter className="border-t border-white/30 dark:border-white/10 pt-4">
            <Button variant="outline" onClick={() => setRedistributeOpen(false)}>Cancel</Button>
            <Button onClick={handleRedistribute} disabled={redistributing}>
              {redistributing ? 'Redistributing…' : 'Re-assign Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateContentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
