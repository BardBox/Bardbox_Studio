'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import type { PipelineTask, UserProfile } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  submitted: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  done: 'bg-green-100 text-green-700',
  blocked: 'bg-red-100 text-red-700',
};

const PRESSURE_COLORS: Record<string, string> = {
  overdue: 'text-red-600',
  critical: 'text-orange-500',
  approaching: 'text-yellow-600',
  comfortable: 'text-green-600',
  completed: 'text-muted-foreground',
};

interface Props {
  initialTasks: PipelineTask[];
  team: UserProfile[];
  clients: string[];
  filterStatus: string;
  filterClient: string;
  filterAssignee: string;
}

export function AllTasksTable({ initialTasks, team, clients, filterStatus, filterClient, filterAssignee }: Props) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [reassignTarget, setReassignTarget] = useState<PipelineTask | null>(null);
  const [newAssignee, setNewAssignee] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [sStatus, setSStatus] = useState(filterStatus);
  const [sClient, setSClient] = useState(filterClient);
  const [sAssignee, setSAssignee] = useState(filterAssignee);

  function applyFilters() {
    const params = new URLSearchParams();
    if (sStatus) params.set('status', sStatus);
    if (sClient) params.set('client', sClient);
    if (sAssignee) params.set('assignee', sAssignee);
    router.push(`/manager/tasks?${params.toString()}`);
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
      const member = team.find((m) => m.id === newAssignee);
      setTasks((prev) =>
        prev.map((t) =>
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

  const NONE = '__none__';

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={sStatus || NONE} onValueChange={(v) => setSStatus(!v || v === NONE ? '' : v)}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All statuses</SelectItem>
              {['todo','in_progress','submitted','approved','done','blocked'].map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Client</span>
          <Select value={sClient || NONE} onValueChange={(v) => setSClient(!v || v === NONE ? '' : v)}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All clients" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All clients</SelectItem>
              {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Assignee</span>
          <Select value={sAssignee || NONE} onValueChange={(v) => setSAssignee(!v || v === NONE ? '' : v)}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Anyone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Anyone</SelectItem>
              {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={applyFilters}>Filter</Button>
      </div>

      <p className="text-xs text-muted-foreground">{tasks.length} tasks</p>

      <div className="border rounded-lg overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Client</th>
              <th className="px-3 py-2 text-left">Platform / Type</th>
              <th className="px-3 py-2 text-left">Post Date</th>
              <th className="px-3 py-2 text-left">Assignee</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Deadline</th>
              <th className="px-3 py-2 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((t) => (
              <tr key={t.task_id} className="hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{t.client_name ?? '—'}</td>
                <td className="px-3 py-2">
                  <span className="capitalize">{t.platform}</span>
                  <span className="text-muted-foreground"> / {t.content_type}</span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{t.posting_date}</td>
                <td className="px-3 py-2">{t.assignee_name ?? <span className="text-muted-foreground italic">unassigned</span>}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.task_status] ?? ''}`}>
                    {t.task_status.replace('_', ' ')}
                  </span>
                </td>
                <td className={`px-3 py-2 text-xs ${PRESSURE_COLORS[t.pressure_level] ?? ''}`}>
                  {new Date(t.internal_deadline).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => { setReassignTarget(t); setNewAssignee(t.assignee_id ?? ''); }}
                  >
                    Reassign
                  </Button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No tasks match the current filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!reassignTarget} onOpenChange={() => setReassignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {reassignTarget?.client_name} — {reassignTarget?.platform} {reassignTarget?.content_type}
          </p>
          <Select value={newAssignee} onValueChange={(v) => v && setNewAssignee(v)}>
            <SelectTrigger><SelectValue placeholder="Select team member…" /></SelectTrigger>
            <SelectContent>
              {team.filter((m) => {
                const roleMap: Record<string, string> = { design: 'designer', post: 'smo' };
                return reassignTarget ? m.role === roleMap[reassignTarget.task_type] || ['manager','admin'].includes(m.role) : true;
              }).map((m) => (
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
    </>
  );
}
