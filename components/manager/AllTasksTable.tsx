'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { PipelineTask, UserProfile } from '@/lib/types';
import {
  ArrowUp, ArrowDown, ChevronDown, Filter,
  Clock, Calendar, AlertTriangle, ListChecks, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_BADGE: Record<string, string> = {
  todo:        'bg-status-cloud text-foreground',
  in_progress: 'bg-status-sky text-foreground',
  submitted:   'bg-status-daffodil text-foreground',
  approved:    'bg-status-mint text-foreground',
  done:        'bg-status-mint text-foreground',
  blocked:     'bg-status-blush text-foreground',
};

const PRESSURE_TEXT: Record<string, string> = {
  overdue:     'text-red-600 font-semibold',
  critical:    'text-orange-500 font-medium',
  approaching: 'text-yellow-600',
  comfortable: 'text-green-600',
  completed:   'text-muted-foreground',
};

type SortField = 'client_name' | 'platform' | 'posting_date' | 'assignee_name' | 'task_status' | 'internal_deadline';
type SortDir = 'asc' | 'desc';

interface QuickFilter { id: string; label: string; icon: React.ElementType; type: 'time' | 'additive' }

const QUICK_FILTERS: QuickFilter[] = [
  { id: 'today',      label: 'Today',      icon: Clock,          type: 'time' },
  { id: '7-days',     label: '7 Days',     icon: Calendar,       type: 'time' },
  { id: '30-days',    label: '30 Days',    icon: Calendar,       type: 'time' },
  { id: 'this-month', label: 'This Month', icon: Calendar,       type: 'time' },
  { id: 'overdue',    label: 'Overdue',    icon: AlertTriangle,  type: 'additive' },
  { id: 'pending',    label: 'Pending',    icon: ListChecks,     type: 'additive' },
  { id: 'unassigned', label: 'Unassigned', icon: Users,          type: 'additive' },
];

const TIME_FILTERS = ['today', '7-days', '30-days', 'this-month'];
const INACTIVE_STATUSES = ['approved', 'done', 'blocked'];

interface Props {
  initialTasks: PipelineTask[];
  team: UserProfile[];
  clients: string[];
}

export function AllTasksTable({ initialTasks, team, clients }: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [reassignTarget, setReassignTarget] = useState<PipelineTask | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sStatus, setSStatus] = useState('');
  const [sClient, setSClient] = useState('');
  const [sAssignee, setSAssignee] = useState('');
  const [activeQuickFilters, setActiveQuickFilters] = useState<string[]>([]);

  const [sortField, setSortField] = useState<SortField>('internal_deadline');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleQuickFilter = (id: string) => {
    setActiveQuickFilters(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      if (TIME_FILTERS.includes(id)) return [...prev.filter(f => !TIME_FILTERS.includes(f)), id];
      return [...prev, id];
    });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let result = [...tasks];

    if (sStatus) result = result.filter(t => t.task_status === sStatus);
    if (sClient) result = result.filter(t => t.client_name === sClient);
    if (sAssignee) result = result.filter(t => t.assignee_id === sAssignee);

    if (activeQuickFilters.length > 0) {
      const isPending = (t: PipelineTask) => !INACTIVE_STATUSES.includes(t.task_status);
      const activeTime = activeQuickFilters.find(f => TIME_FILTERS.includes(f));

      if (activeTime === 'today') {
        result = result.filter(t => {
          const d = new Date(t.posting_date); d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime() || isPending(t);
        });
      } else if (activeTime === '7-days') {
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7);
        result = result.filter(t => {
          const d = new Date(t.posting_date); d.setHours(0, 0, 0, 0);
          return (d >= cutoff && d <= today) || isPending(t);
        });
      } else if (activeTime === '30-days') {
        const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
        result = result.filter(t => {
          const d = new Date(t.posting_date); d.setHours(0, 0, 0, 0);
          return (d >= cutoff && d <= today) || isPending(t);
        });
      } else if (activeTime === 'this-month') {
        result = result.filter(t => {
          const d = new Date(t.posting_date);
          return (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) || isPending(t);
        });
      }

      if (activeQuickFilters.includes('overdue'))    result = result.filter(t => t.pressure_level === 'overdue');
      if (activeQuickFilters.includes('pending'))    result = result.filter(t => ['todo', 'in_progress'].includes(t.task_status));
      if (activeQuickFilters.includes('unassigned')) result = result.filter(t => !t.assignee_id);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'client_name':       cmp = (a.client_name ?? '').localeCompare(b.client_name ?? ''); break;
        case 'platform':          cmp = a.platform.localeCompare(b.platform); break;
        case 'posting_date':      cmp = new Date(a.posting_date).getTime() - new Date(b.posting_date).getTime(); break;
        case 'assignee_name':     cmp = (a.assignee_name ?? '').localeCompare(b.assignee_name ?? ''); break;
        case 'task_status':       cmp = a.task_status.localeCompare(b.task_status); break;
        case 'internal_deadline': cmp = new Date(a.internal_deadline).getTime() - new Date(b.internal_deadline).getTime(); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, sStatus, sClient, sAssignee, activeQuickFilters, sortField, sortDir]);

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
      setTasks(prev =>
        prev.map(t =>
          t.task_id === reassignTarget.task_id
            ? { ...t, assignee_id: newAssignee, assignee_name: member?.full_name ?? null }
            : t
        )
      );
      toast.success('Task reassigned');
      setReassignTarget(null);
      setNewAssignee('');
    } else {
      toast.error('Reassignment failed');
    }
    setReassigning(false);
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary" />
      : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const activeDropdownCount = [sStatus, sClient, sAssignee].filter(Boolean).length;

  return (
    <div className="space-y-3">

      {/* Collapsible filter panel */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">View Filters</span>
              {activeDropdownCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {activeDropdownCount}
                </span>
              )}
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              filtersOpen && 'rotate-180'
            )} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex flex-wrap items-end gap-3 px-4 pb-4 pt-1">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Status</span>
                <Select value={sStatus || null} onValueChange={v => setSStatus(v ?? '')}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    {['todo','in_progress','submitted','approved','done','blocked'].map(s => (
                      <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Client</span>
                <Select value={sClient || null} onValueChange={v => setSClient(v ?? '')}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="All clients" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground font-medium">Assignee</span>
                <Select value={sAssignee || null} onValueChange={v => setSAssignee(v ?? '')}>
                  <SelectTrigger className="w-40"><SelectValue placeholder="Anyone" /></SelectTrigger>
                  <SelectContent>
                    {team.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {activeDropdownCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => { setSStatus(''); setSClient(''); setSAssignee(''); }}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Quick filter chips */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
        {QUICK_FILTERS.map(filter => {
          const Icon = filter.icon;
          const isActive = activeQuickFilters.includes(filter.id);
          return (
            <button
              key={filter.id}
              onClick={() => handleQuickFilter(filter.id)}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                isActive
                  ? 'text-primary underline underline-offset-4'
                  : 'text-muted-foreground hover:text-primary'
              )}
            >
              <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
              {filter.label}
            </button>
          );
        })}
        <button
          onClick={() => setActiveQuickFilters([])}
          disabled={activeQuickFilters.length === 0}
          className={cn(
            'text-sm font-medium transition-colors',
            activeQuickFilters.length > 0
              ? 'text-destructive hover:text-destructive/80 cursor-pointer'
              : 'text-muted-foreground/40 cursor-default'
          )}
        >
          Clear Filters
        </button>
      </div>

      <p className="text-xs text-muted-foreground">{filteredTasks.length} tasks</p>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-2 border-primary/20">
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('client_name')}
              >
                <div className="flex items-center gap-1.5">Client <SortIcon field="client_name" /></div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('platform')}
              >
                <div className="flex items-center gap-1.5">Platform / Type <SortIcon field="platform" /></div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('posting_date')}
              >
                <div className="flex items-center gap-1.5">Post Date <SortIcon field="posting_date" /></div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('assignee_name')}
              >
                <div className="flex items-center gap-1.5">Assignee <SortIcon field="assignee_name" /></div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('task_status')}
              >
                <div className="flex items-center gap-1.5">Status <SortIcon field="task_status" /></div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleSort('internal_deadline')}
              >
                <div className="flex items-center gap-1.5">Deadline <SortIcon field="internal_deadline" /></div>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTasks.map(t => (
              <TableRow key={t.task_id} className="group">
                <TableCell className="font-medium">{t.client_name ?? '—'}</TableCell>
                <TableCell>
                  <span className="capitalize">{t.platform}</span>
                  <span className="text-muted-foreground"> / {t.content_type}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{t.posting_date}</TableCell>
                <TableCell>
                  {t.assignee_name ?? <span className="text-muted-foreground italic">unassigned</span>}
                </TableCell>
                <TableCell>
                  <Badge className={cn('capitalize border-0', STATUS_BADGE[t.task_status] ?? 'bg-muted text-foreground')}>
                    {t.task_status.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className={cn('text-xs', PRESSURE_TEXT[t.pressure_level])}>
                  {new Date(t.internal_deadline).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { setReassignTarget(t); setNewAssignee(t.assignee_id ?? ''); }}
                  >
                    Reassign
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredTasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No tasks match the current filters
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
