'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { DataTable } from 'primereact/datatable';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { Dropdown } from 'primereact/dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { PipelineTask, UserProfile, UserRole } from '@/lib/types';
import { Clock, Calendar, AlertTriangle, ListChecks, Users, Zap, Download, Shuffle } from 'lucide-react';
import { cn, statusLabel } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TaskDetailPanel } from '@/components/shared/TaskDetailPanel';
import { ExportTasksModal } from '@/components/manager/ExportTasksModal';

const STATUS_BADGE: Record<string, string> = {
  todo:          'bg-status-cloud text-foreground',
  working_on_it: 'bg-status-sky text-foreground',
  submitted:     'bg-status-daffodil text-foreground',
  approved:      'bg-status-mint text-foreground',
  done:          'bg-status-mint text-foreground',
  blocked:       'bg-status-blush text-foreground',
  on_hold:       'bg-status-peach text-foreground',
};

const PRIORITY_BADGE: Record<string, string> = {
  emergency: 'bg-red-600 text-white',
  high:      'bg-red-100 text-red-700',
  medium:    'bg-yellow-100 text-yellow-700',
  low:       'bg-green-100 text-green-700',
};

const PRESSURE_TEXT: Record<string, string> = {
  overdue:     'text-red-600 font-semibold',
  critical:    'text-orange-500 font-medium',
  approaching: 'text-yellow-600',
  comfortable: 'text-green-600',
  completed:   'text-muted-foreground',
};

const STATUS_OPTIONS = [
  { label: 'To Do',        value: 'todo' },
  { label: 'In Progress',  value: 'working_on_it' },
  { label: 'Submitted',    value: 'submitted' },
  { label: 'Approved',     value: 'approved' },
  { label: 'Done',         value: 'done' },
  { label: 'Blocked',      value: 'blocked' },
  { label: 'On Hold',      value: 'on_hold' },
];

interface QuickFilter { id: string; label: string; icon: React.ElementType; type: 'time' | 'additive' }

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'today',      label: 'Today',      icon: Clock,          type: 'time' },
  { id: '7-days',     label: '7 Days',     icon: Calendar,       type: 'time' },
  { id: '30-days',    label: '30 Days',    icon: Calendar,       type: 'time' },
  { id: 'this-month', label: 'This Month', icon: Calendar,       type: 'time' },
  { id: 'overdue',    label: 'Overdue',    icon: AlertTriangle,  type: 'additive' },
  { id: 'pending',    label: 'Pending',    icon: ListChecks,     type: 'additive' },
  { id: 'unassigned', label: 'Unassigned', icon: Users,          type: 'additive' },
  { id: 'emergency',  label: 'Emergency',  icon: Zap,            type: 'additive' },
];

const TIME_FILTERS = ['today', '7-days', '30-days', 'this-month'];
const INACTIVE_STATUSES = ['approved', 'done', 'blocked'];

interface Props {
  initialTasks: PipelineTask[];
  team: UserProfile[];
  clients: string[];
  userRole: UserRole;
}

interface CapacityEntry {
  user_id: string;
  full_name: string;
  role: string;
  daily_cap: number | null;
  current_load: number;
}

const EMPTY_FILTERS: DataTableFilterMeta = {
  client_name:   { value: null, matchMode: FilterMatchMode.EQUALS },
  platform:      { value: null, matchMode: FilterMatchMode.EQUALS },
  assignee_name: { value: null, matchMode: FilterMatchMode.EQUALS },
  task_status:   { value: null, matchMode: FilterMatchMode.EQUALS },
};

export function AllTasksTable({ initialTasks, team, clients, userRole }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [panelTask, setPanelTask] = useState<PipelineTask | null>(null);
  const [reassignTarget, setReassignTarget] = useState<PipelineTask | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [capacityLoad, setCapacityLoad] = useState<CapacityEntry[]>([]);
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);
  const [filters, setFilters] = useState<DataTableFilterMeta>(EMPTY_FILTERS);
  const [exportOpen, setExportOpen] = useState(false);
  const [redistributeOpen, setRedistributeOpen] = useState(false);
  const [redistributing, setRedistributing] = useState(false);
  const [redistributeMonth, setRedistributeMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const hasActiveColumnFilters = Object.values(filters).some(
    f => 'value' in f && f.value !== null
  );
  const hasAnyFilter = activeQuickFilters.length > 0 || hasActiveColumnFilters;

  const handleQuickFilter = (id: string) => {
    setActiveQuickFilters(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      if (TIME_FILTERS.includes(id)) return [...prev.filter(f => !TIME_FILTERS.includes(f)), id];
      return [...prev, id];
    });
  };

  // Quick filters apply before DataTable's own column filters
  const quickFilteredTasks = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let result = [...tasks];

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

    return result;
  }, [tasks, activeQuickFilters]);

  const platformOptions = useMemo(() =>
    [...new Set(initialTasks.map(t => t.platform))].map(p => ({ label: p, value: p })),
  [initialTasks]);

  const assigneeOptions = useMemo(() =>
    team.map(m => ({ label: m.full_name, value: m.full_name })),
  [team]);

  // Column filter elements (PrimeReact Dropdown popups)
  const clientFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={clients.map(c => ({ label: c, value: c }))}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Any client" showClear style={{ minWidth: '12rem' }} />
  );

  const platformFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={platformOptions}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Any platform" showClear style={{ minWidth: '12rem' }} />
  );

  const assigneeFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={assigneeOptions}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Anyone" showClear style={{ minWidth: '12rem' }} />
  );

  const statusFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={STATUS_OPTIONS}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Any status" showClear style={{ minWidth: '12rem' }} />
  );

  // Body cell templates
  const clientBody    = (t: PipelineTask) => <span className="font-semibold">{t.client_name ?? '—'}</span>;

  const platformBody  = (t: PipelineTask) => (
    <div className="flex flex-col gap-0.5">
      <span className="capitalize text-sm font-medium">{t.platform}</span>
      <span className="text-xs text-muted-foreground capitalize">{t.content_type}</span>
    </div>
  );

  const postDateBody  = (t: PipelineTask) => (
    <span className="text-sm text-muted-foreground tabular-nums">
      {new Date(t.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
    </span>
  );

  const assigneeBody  = (t: PipelineTask) => (
    <div className="flex flex-col gap-0.5">
      <span>{t.assignee_name ?? <span className="text-muted-foreground/60 italic text-xs">unassigned</span>}</span>
      {t.assignee_specialty === 'video_editor' && (
        <span className="text-[10px] text-purple-600 font-medium">🎬 Video Editor</span>
      )}
      {t.assignee_specialty === 'graphic_designer' && (
        <span className="text-[10px] text-blue-600 font-medium">🎨 Graphic</span>
      )}
    </div>
  );

  const statusBody    = (t: PipelineTask) => (
    <Badge className={cn('border-0 text-xs font-medium px-2.5 py-0.5', STATUS_BADGE[t.task_status] ?? 'bg-muted text-foreground')}>
      {statusLabel(t.task_status)}
    </Badge>
  );

  const priorityBody  = (t: PipelineTask) => (
    <Badge className={cn('border-0 text-xs font-medium px-2 py-0.5 capitalize inline-flex items-center gap-1', PRIORITY_BADGE[t.priority] ?? 'bg-muted text-foreground')}>
      {t.is_emergency && <Zap className="h-3 w-3" />}
      {t.priority}
    </Badge>
  );

  const deadlineBody  = (t: PipelineTask) => (
    <span className={cn('text-xs font-medium tabular-nums', PRESSURE_TEXT[t.pressure_level])}>
      {new Date(t.internal_deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );

  async function openReassign(t: PipelineTask) {
    setReassignTarget(t);
    setNewAssignee(t.assignee_id ?? '');
    setCapacityLoad([]);
    setLoadingCapacity(true);
    try {
      const params = new URLSearchParams({
        date: t.posting_date,
        content_type: t.content_type,
        task_type: t.task_type,
      });
      const res = await fetch(`/api/tasks/capacity-load?${params}`);
      if (res.ok) setCapacityLoad(await res.json());
    } finally {
      setLoadingCapacity(false);
    }
  }

  const actionsBody   = (t: PipelineTask) => (
    <Button size="sm" variant="ghost" className="h-7 text-xs"
      onClick={(e) => { e.stopPropagation(); openReassign(t); }}>
      Reassign
    </Button>
  );

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

  return (
    <div className="space-y-3">
      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
        {QUICK_FILTERS.map(filter => {
          const Icon = filter.icon;
          const isActive = activeQuickFilters.includes(filter.id);
          return (
            <button key={filter.id} onClick={() => handleQuickFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                isActive ? 'text-primary underline underline-offset-4' : 'text-muted-foreground hover:text-primary'
              )}>
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              {filter.label}
            </button>
          );
        })}
        <button
          onClick={() => { setActiveQuickFilters([]); setFilters(EMPTY_FILTERS); }}
          disabled={!hasAnyFilter}
          className={cn('text-sm font-medium transition-colors',
            hasAnyFilter
              ? 'text-destructive hover:text-destructive/80 cursor-pointer'
              : 'text-muted-foreground/40 cursor-default'
          )}>
          Clear Filters
        </button>

        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setRedistributeOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <Shuffle className="h-4 w-4" />
            Redistribute
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* DataTable */}
      <div className="rounded-lg overflow-hidden border">
        <DataTable
          value={quickFilteredTasks}
          dataKey="task_id"
          sortField="internal_deadline"
          sortOrder={1}
          paginator
          rows={25}
          rowsPerPageOptions={[10, 25, 50]}
          filters={filters}
          onFilter={(e) => setFilters(e.filters)}
          filterDisplay="menu"
          size="small"
          emptyMessage="No tasks match the current filters"
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
          currentPageReportTemplate="{first}–{last} of {totalRecords} tasks"
          onRowClick={(e) => setPanelTask(e.data as PipelineTask)}
          rowClassName={() => 'cursor-pointer'}
        >
          <Column field="client_name"   header="Client"         sortable filter filterElement={clientFilterTemplate}   filterMatchMode={FilterMatchMode.EQUALS} body={clientBody}   style={{ minWidth: '130px' }} />
          <Column field="platform"      header="Platform / Type" sortable filter filterElement={platformFilterTemplate} filterMatchMode={FilterMatchMode.EQUALS} body={platformBody} style={{ minWidth: '140px' }} />
          <Column field="posting_date"  header="Post Date"      sortable body={postDateBody}  style={{ minWidth: '100px' }} />
          <Column field="assignee_name" header="Assignee"       sortable filter filterElement={assigneeFilterTemplate} filterMatchMode={FilterMatchMode.EQUALS} body={assigneeBody} style={{ minWidth: '130px' }} />
          <Column field="priority"      header="Priority"       sortable body={priorityBody}  style={{ minWidth: '90px' }} />
          <Column field="task_status"   header="Status"         sortable filter filterElement={statusFilterTemplate}   filterMatchMode={FilterMatchMode.EQUALS} body={statusBody}   style={{ minWidth: '110px' }} />
          <Column field="internal_deadline" header="Deadline"   sortable body={deadlineBody}  style={{ minWidth: '110px' }} />
          <Column body={actionsBody} style={{ width: '80px' }} />
        </DataTable>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {reassignTarget?.client_name} — <span className="capitalize">{reassignTarget?.content_type}</span> ({reassignTarget?.task_type})
            &nbsp;·&nbsp;
            {reassignTarget?.posting_date && new Date(reassignTarget.posting_date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
          </p>

          {/* Capacity load cards */}
          {loadingCapacity ? (
            <p className="text-xs text-muted-foreground">Loading capacity…</p>
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
                      'flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors cursor-pointer',
                      newAssignee === entry.user_id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-muted-foreground/50',
                    )}
                  >
                    <span className="font-medium truncate">{entry.full_name.split(' ')[0]}</span>
                    {cap > 0 ? (
                      <span className={cn(
                        'ml-2 shrink-0 text-xs font-semibold tabular-nums',
                        isFull ? 'text-red-600' : isNearFull ? 'text-orange-500' : 'text-green-600',
                      )}>
                        {load}/{cap}
                        {isFull && ' Full'}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-muted-foreground">no cap</span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Fallback dropdown for roles without capacity data */}
          <Select value={newAssignee || undefined} onValueChange={v => { if (v) setNewAssignee(v); }}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Or pick from all team members…" /></SelectTrigger>
            <SelectContent>
              {team.filter(m => {
                const roleMap: Record<string, string> = { design: 'designer', post: 'smo' };
                return reassignTarget
                  ? m.role === roleMap[reassignTarget.task_type] || ['manager', 'admin'].includes(m.role)
                  : true;
              }).map(m => {
                const entry = capacityLoad.find(e => e.user_id === m.id);
                const capLabel = entry
                  ? ` (${entry.current_load}/${entry.daily_cap ?? '∞'})`
                  : '';
                return (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}{capLabel}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button>
            <Button disabled={!newAssignee || reassigning} onClick={handleReassign}>
              {reassigning ? 'Reassigning…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redistribute dialog */}
      <Dialog open={redistributeOpen} onOpenChange={v => { if (!v) setRedistributeOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redistribute Tasks</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Re-runs auto-assign on all <strong>to-do</strong> tasks for the selected month.
            New team members with capacity set will be included in the pool.
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Month</label>
              <input
                type="month"
                value={redistributeMonth}
                onChange={e => setRedistributeMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
          </div>
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5">
            Only unstarted (to-do) tasks will be re-assigned. In-progress or submitted tasks are untouched.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRedistributeOpen(false)}>Cancel</Button>
            <Button onClick={handleRedistribute} disabled={redistributing}>
              {redistributing ? 'Redistributing…' : 'Re-assign Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
