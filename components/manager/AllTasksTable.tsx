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
import { Clock, Calendar, AlertTriangle, ListChecks, Users, Zap } from 'lucide-react';
import { cn, statusLabel } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TaskDetailPanel } from '@/components/shared/TaskDetailPanel';

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
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);
  const [filters, setFilters] = useState<DataTableFilterMeta>(EMPTY_FILTERS);

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

  const assigneeBody  = (t: PipelineTask) =>
    t.assignee_name ?? <span className="text-muted-foreground/60 italic text-xs">unassigned</span>;

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

  const actionsBody   = (t: PipelineTask) => (
    <Button size="sm" variant="ghost" className="h-7 text-xs"
      onClick={(e) => { e.stopPropagation(); setReassignTarget(t); setNewAssignee(t.assignee_id ?? ''); }}>
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

      {/* Reassign dialog */}
      <Dialog open={!!reassignTarget} onOpenChange={() => setReassignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {reassignTarget?.client_name} — {reassignTarget?.platform} {reassignTarget?.content_type}
          </p>
          <Select value={newAssignee || null} onValueChange={v => { if (v) setNewAssignee(v); }}>
            <SelectTrigger><SelectValue placeholder="Select team member…" /></SelectTrigger>
            <SelectContent>
              {team.filter(m => {
                const roleMap: Record<string, string> = { design: 'designer', post: 'smo' };
                return reassignTarget
                  ? m.role === roleMap[reassignTarget.task_type] || ['manager', 'admin'].includes(m.role)
                  : true;
              }).map(m => (
                <SelectItem key={m.id} value={m.id}>{m.full_name} ({m.role})</SelectItem>
              ))}
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
    </div>
  );
}
