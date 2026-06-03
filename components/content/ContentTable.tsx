'use client';

import { useState, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowUpDown, ArrowUp, ArrowDown, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  task_type: 'design' | 'post';
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
}

const ROW_STATUSES = ['draft', 'in_design', 'in_review', 'approved', 'scheduled', 'posted', 'cancelled'];

const STATUS_COLORS: Record<string, string> = {
  draft:      'bg-status-pearl text-status-pearl-foreground',
  in_design:  'bg-status-sky-blue text-status-sky-blue-foreground',
  in_review:  'bg-status-buttercup text-status-buttercup-foreground',
  approved:   'bg-status-mint text-status-mint-foreground',
  scheduled:  'bg-status-lavender text-status-lavender-foreground',
  posted:     'bg-status-seafoam text-status-seafoam-foreground',
  cancelled:  'bg-status-blush text-status-blush-foreground',
};

function TaskBadge({ tasks }: { tasks: TaskSummary[] }) {
  if (tasks.length === 0) return <span className="text-xs text-muted-foreground">No tasks</span>;
  const done = tasks.filter(t => ['done', 'approved'].includes(t.status)).length;
  return (
    <span className={`text-xs font-medium ${done === tasks.length ? 'text-green-600' : 'text-muted-foreground'}`}>
      {done}/{tasks.length} done
    </span>
  );
}

function AssigneeCell({ tasks, teamMembers, preferredName, preferredId }: { tasks: TaskSummary[]; teamMembers: TeamMember[]; preferredName?: string | null; preferredId?: string | null }) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();

  const lookup = (id: string | null) => teamMembers.find(m => m.id === id)?.full_name ?? null;
  const designers = teamMembers.filter(m => m.role === 'designer');
  const smos = teamMembers.filter(m => m.role === 'smo');

  const designTask = tasks.find(t => t.task_type === 'design');
  const postTask   = tasks.find(t => t.task_type === 'post');

  if (tasks.length === 0) {
    if (preferredId && preferredName) return <span className="text-xs text-muted-foreground italic">{preferredName}</span>;
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  async function assign(taskId: number, assigneeId: string | 'auto') {
    setLoadingId(taskId);
    const res = assigneeId === 'auto'
      ? await fetch('/api/tasks/auto-assign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId }),
        })
      : await fetch('/api/tasks/override-assignee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: taskId, assignee_id: assigneeId }),
        });
    setLoadingId(null);
    if (res.ok) { toast.success('Assigned'); router.refresh(); }
    else {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error ?? 'Failed to assign');
    }
  }

  function deadlineUrgency(dl: string | null) {
    if (!dl) return '';
    const hrs = (new Date(dl).getTime() - Date.now()) / 3_600_000;
    if (hrs < 0)   return 'text-destructive';
    if (hrs < 48)  return 'text-yellow-600';
    if (hrs < 120) return 'text-amber-500';
    return 'text-muted-foreground';
  }

  function fmtDeadline(dl: string | null) {
    if (!dl) return null;
    return new Date(dl).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  function TaskAssignRow({
    taskItem,
    label,
    pool,
  }: {
    taskItem: TaskSummary;
    label: string;
    pool: TeamMember[];
  }) {
    const name = lookup(taskItem.assignee_id);
    const dlCls = deadlineUrgency(taskItem.internal_deadline);
    const dlStr = fmtDeadline(taskItem.internal_deadline);
    const isLoading = loadingId === taskItem.id;

    return (
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs w-10 shrink-0">{label}:</span>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isLoading}
            className="text-xs font-medium hover:underline underline-offset-2 cursor-pointer max-w-[90px] truncate disabled:opacity-50"
          >
            {isLoading ? '…' : (name ?? <span className="text-muted-foreground italic">Assign</span>)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onClick={() => assign(taskItem.id, 'auto')} className="gap-2 text-purple-600 font-medium">
              ✦ Auto-assign (smart)
            </DropdownMenuItem>
            {pool.map(m => (
              <DropdownMenuItem
                key={m.id}
                onClick={() => assign(taskItem.id, m.id)}
                className="gap-2"
              >
                {m.full_name}
                {m.id === taskItem.assignee_id && <span className="ml-auto text-xs text-muted-foreground">current</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {dlStr && (
          <span className={`text-xs ${dlCls}`} title="Design deadline">{dlStr}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {designTask && <TaskAssignRow taskItem={designTask} label="Design" pool={designers} />}
      {postTask   && <TaskAssignRow taskItem={postTask}   label="Post"   pool={smos} />}
    </div>
  );
}

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

  const cls = STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={loading}
        className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-75 transition-opacity border-0 ${cls}`}
      >
        {loading ? '…' : status.replace('_', ' ')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {ROW_STATUSES.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={() => change(s)}
            className="gap-2 cursor-pointer"
          >
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s]}`}>
              {s.replace('_', ' ')}
            </span>
            {s === status && <span className="ml-auto text-xs text-muted-foreground">current</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ContentTable({
  rows, clients, platforms, designers, teamMembers,
  activeClient, activePlatform, activeAssignee, activeMonth,
}: Props) {
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

    // Apply column filters
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

      // Run AI schedule analysis on the newly created tasks
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

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month filter */}
          <Select value={activeMonth} onValueChange={(v) => v && pushFilter('month', v)}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Client filter */}
          <Select value={activeClient ?? NONE} onValueChange={(v) => pushFilter('client', v === NONE || !v ? null : v)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All clients</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Platform filter */}
          <Select value={activePlatform ?? NONE} onValueChange={(v) => pushFilter('platform', v === NONE || !v ? null : v)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All platforms</SelectItem>
              {platforms.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Team member filter */}
          <Select
            value={activeAssignee ?? NONE}
            onValueChange={(v) => pushFilter('assignee', v === NONE || !v ? null : v)}
          >
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="All team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All team</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                  <span className="ml-1 text-muted-foreground capitalize">({m.role})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

        </div>

        <Button size="sm" onClick={() => setImportOpen(true)}>
          + Import
        </Button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2 flex-wrap">
          <span className="text-sm font-medium text-primary">{selected.size} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={handleCreateTasks} disabled={loading || aiChecking}>
            {aiChecking ? '✦ AI analysing…' : 'Create Tasks'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)} disabled={loading}>
            Change Status
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)} disabled={loading}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>✕</Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-card border-b border-border">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={displayRows.length > 0 && displayRows.every(r => selected.has(r.id))}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {(([
                  ['client_name',   'Client',       clients],
                  ['platform',      'Platform',     platforms],
                  ['content_type',  'Type',         contentTypes],
                  ['posting_date',  'Posting Date', null],
                  ['status',        'Status',       ROW_STATUSES],
                ]) as [string, string, string[] | null][]).map(([field, label, options]) => {
                  const isActive = sortField === field;
                  const hasFilter = !!colFilters[field];
                  return (
                    <th key={field}
                      className="px-3 py-2.5 text-left text-[0.7rem] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap"
                    >
                      <div className="flex items-center gap-0.5">
                        {/* Sort trigger */}
                        <button
                          onClick={() => toggleSort(field)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors group"
                        >
                          {label}
                          {isActive
                            ? (sortOrder === 1
                                ? <ArrowUp className="h-3 w-3 text-primary" />
                                : <ArrowDown className="h-3 w-3 text-primary" />)
                            : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                          }
                        </button>
                        {/* Column filter */}
                        {options && (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-muted ${hasFilter ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                              title={`Filter by ${label}`}
                            >
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                onClick={() => setColFilter(field, '')}
                                className={!colFilters[field] ? 'font-semibold' : ''}
                              >
                                All {label.toLowerCase()}s
                              </DropdownMenuItem>
                              {options.map(opt => (
                                <DropdownMenuItem
                                  key={opt}
                                  onClick={() => setColFilter(field, opt)}
                                  className={`capitalize ${colFilters[field] === opt ? 'font-semibold text-primary' : ''}`}
                                >
                                  {opt.replace('_', ' ')}
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
                {/* Tasks column */}
                {(() => {
                  const taskStatusOptions = ['pending', 'in_progress', 'done', 'approved', 'cancelled'];
                  const isActive = sortField === 'tasks';
                  const hasFilter = !!colFilters['task_status'];
                  return (
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('tasks')} className="flex items-center gap-1 hover:text-foreground transition-colors group">
                          Tasks
                          {isActive ? (sortOrder === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-muted ${hasFilter ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} title="Filter by task status">
                            <ListFilter className="h-3 w-3" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem onClick={() => setColFilter('task_status', '')} className={!colFilters['task_status'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                            {taskStatusOptions.map(opt => (
                              <DropdownMenuItem key={opt} onClick={() => setColFilter('task_status', opt)} className={`capitalize ${colFilters['task_status'] === opt ? 'font-semibold text-primary' : ''}`}>
                                {opt.replace('_', ' ')}{colFilters['task_status'] === opt && <span className="ml-auto text-xs">✓</span>}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </th>
                  );
                })()}
                {/* Assigned To column */}
                {(() => {
                  const isActive = sortField === 'assignee';
                  const hasFilter = !!colFilters['assignee'];
                  return (
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('assignee')} className="flex items-center gap-1 hover:text-foreground transition-colors group">
                          Assigned To
                          {isActive ? (sortOrder === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                        </button>
                        {assigneeOptions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-muted ${hasFilter ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} title="Filter by assignee">
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                              <DropdownMenuItem onClick={() => setColFilter('assignee', '')} className={!colFilters['assignee'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                              {assigneeOptions.map(([id, name]) => (
                                <DropdownMenuItem key={id} onClick={() => setColFilter('assignee', id)} className={colFilters['assignee'] === id ? 'font-semibold text-primary' : ''}>
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
                {/* Source column */}
                {(() => {
                  const isActive = sortField === 'source';
                  const hasFilter = !!colFilters['source'];
                  return (
                    <th className="px-3 py-2.5 text-left text-[0.7rem] font-semibold tracking-wide uppercase text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => toggleSort('source')} className="flex items-center gap-1 hover:text-foreground transition-colors group">
                          Source
                          {isActive ? (sortOrder === 1 ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />}
                        </button>
                        {sourceOptions.length > 1 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className={`ml-0.5 rounded p-0.5 transition-colors hover:bg-muted ${hasFilter ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'}`} title="Filter by source">
                              <ListFilter className="h-3 w-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-40">
                              <DropdownMenuItem onClick={() => setColFilter('source', '')} className={!colFilters['source'] ? 'font-semibold' : ''}>All</DropdownMenuItem>
                              {sourceOptions.map(opt => (
                                <DropdownMenuItem key={opt} onClick={() => setColFilter('source', opt)} className={`capitalize ${colFilters['source'] === opt ? 'font-semibold text-primary' : ''}`}>
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No content rows found.
                  </td>
                </tr>
              ) : displayRows.map(row => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted/30 transition-colors ${selected.has(row.id) ? 'bg-primary/5' : ''}`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{row.client_name ?? '—'}</td>
                  <td className="px-3 py-2 capitalize">{row.platform}</td>
                  <td className="px-3 py-2 capitalize">{row.content_type}</td>
                  <td className="px-3 py-2">
                    {new Date(row.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-2">
                    <InlineStatusSelect rowId={row.id} currentStatus={row.status} />
                  </td>
                  <td className="px-3 py-2">
                    {row.tasks.length === 0 && !row.auto_create_tasks ? (
                      <span className="text-xs text-amber-600 font-medium">Pending</span>
                    ) : (
                      <TaskBadge tasks={row.tasks} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <AssigneeCell tasks={row.tasks} teamMembers={teamMembers} preferredName={row.preferred_assignee_name} preferredId={row.preferred_assignee_id} />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs capitalize">{row.source}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {/* AI Schedule Analysis dialog */}
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
                      <span className="text-muted-foreground font-normal ml-1">({s.platform})</span>
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

      {/* Change status dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Change Status</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Update status for {selected.size} selected row{selected.size !== 1 ? 's' : ''}.
          </p>
          <Select value={bulkStatus || NONE} onValueChange={v => setBulkStatus(!v || v === NONE ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Select status…" /></SelectTrigger>
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

      {/* Delete confirm dialog */}
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
