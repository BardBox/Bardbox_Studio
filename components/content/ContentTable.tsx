'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
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
  draft:      'bg-muted text-muted-foreground',
  in_design:  'bg-blue-100 text-blue-700',
  in_review:  'bg-yellow-100 text-yellow-700',
  approved:   'bg-green-100 text-green-700',
  scheduled:  'bg-purple-100 text-purple-700',
  posted:     'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-red-100 text-red-700',
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

function AssigneeCell({ tasks, teamMembers }: { tasks: TaskSummary[]; teamMembers: TeamMember[] }) {
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();

  const lookup = (id: string | null) => teamMembers.find(m => m.id === id)?.full_name ?? null;
  const designers = teamMembers.filter(m => m.role === 'designer');
  const smos = teamMembers.filter(m => m.role === 'smo');

  const designTask = tasks.find(t => t.task_type === 'design');
  const postTask   = tasks.find(t => t.task_type === 'post');

  if (tasks.length === 0) return <span className="text-xs text-muted-foreground">No tasks yet</span>;

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
  const [assignOpen, setAssignOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bulkAssignee, setBulkAssignee] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const NONE = '__none__';

  function pushFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', 'table');
    if (value) { params.set(key, value); } else { params.delete(key); }
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleAll() {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  }

  async function handleBulkAssign() {
    if (!bulkAssignee) return;
    setLoading(true);
    try {
      const res = await fetch('/api/content/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, assignee_id: bulkAssignee }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Assigned designer to ${json.updated} rows`);
      setSelected(new Set()); setAssignOpen(false); router.refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
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
          <Button size="sm" variant="outline" onClick={handleCreateTasks} disabled={loading}>
            Create Tasks
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} disabled={loading}>
            Assign Designer
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
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && selected.size === rows.length}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Client</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Platform</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Posting Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Tasks</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Assigned To</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No content rows found.
                  </td>
                </tr>
              ) : rows.map(row => (
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
                    <AssigneeCell tasks={row.tasks} teamMembers={teamMembers} />
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

      {/* Assign designer dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Assign Designer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assign a designer to the design tasks for {selected.size} selected row{selected.size !== 1 ? 's' : ''}.
          </p>
          <Select value={bulkAssignee || NONE} onValueChange={v => setBulkAssignee(!v || v === NONE ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="Select designer…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— select —</SelectItem>
              {designers.map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!bulkAssignee || loading} onClick={handleBulkAssign}>Assign</Button>
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
