'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from 'primereact/datatable';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { Dropdown } from 'primereact/dropdown';
import type { LeaveRequest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  requests: LeaveRequest[];
  mode: 'pending' | 'history';
  onReviewed?: (id: number, status: 'approved' | 'denied') => void;
}

const STATUS_OPTIONS = [
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied',   value: 'denied' },
];

const STATUS_COLOR: Record<string, string> = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-emerald-100 text-emerald-800',
  denied:   'bg-red-100 text-red-800',
};

export function LeaveRequestsTable({ requests, mode, onReviewed }: Props) {
  const [denyTarget, setDenyTarget] = useState<LeaveRequest | null>(null);
  const [denyNotes, setDenyNotes] = useState('');
  const [loading, setLoading] = useState<number | null>(null);
  const [localRequests, setLocalRequests] = useState(requests);
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    status: { value: null, matchMode: FilterMatchMode.EQUALS },
  });

  async function handleDecision(id: number, status: 'approved' | 'denied', notes = '') {
    setLoading(id);
    try {
      const res = await fetch(`/api/leave/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, review_notes: notes }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(status === 'approved' ? 'Leave approved.' : 'Leave denied.');
      setLocalRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      onReviewed?.(id, status);
      setDenyTarget(null);
    } catch {
      toast.error('Could not update leave request.');
    } finally {
      setLoading(null);
    }
  }

  if (localRequests.length === 0) {
    return (
      <div className="rounded-xl border bg-background p-6 text-center text-muted-foreground text-sm">
        {mode === 'pending' ? 'No pending requests.' : 'No recent decisions.'}
      </div>
    );
  }

  const statusFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={STATUS_OPTIONS}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Any status" showClear style={{ minWidth: '10rem' }} />
  );

  const employeeBody = (r: LeaveRequest) => (
    <div>
      <div className="font-medium">{r.full_name ?? r.user_id}</div>
      <div className="text-xs text-muted-foreground capitalize">{r.role}</div>
    </div>
  );

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const datesBody = (r: LeaveRequest) => {
    const days = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86_400_000) + 1;
    return (
      <div className="text-muted-foreground">
        <div>{fmtDate(r.start_date)} — {fmtDate(r.end_date)}</div>
        <div className="text-xs">{days} day{days !== 1 ? 's' : ''}</div>
      </div>
    );
  };

  const reasonBody = (r: LeaveRequest) => (
    <span className="text-muted-foreground max-w-xs truncate block">{r.reason ?? '—'}</span>
  );

  const statusBody = (r: LeaveRequest) => (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLOR[r.status]}`}>
      {r.status}
    </span>
  );

  const actionsBody = (r: LeaveRequest) => {
    if (mode !== 'pending') return null;
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
          disabled={loading === r.id}
          onClick={() => handleDecision(r.id, 'approved')}>
          Approve
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs"
          disabled={loading === r.id}
          onClick={() => { setDenyTarget(r); setDenyNotes(''); }}>
          Deny
        </Button>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-xl overflow-hidden border">
        <DataTable
          value={localRequests}
          dataKey="id"
          sortField="start_date"
          sortOrder={-1}
          filters={filters}
          onFilter={(e) => setFilters(e.filters)}
          filterDisplay="menu"
          size="small"
          emptyMessage="No leave requests found"
        >
          <Column header="Employee"   body={employeeBody}  style={{ minWidth: '150px' }} />
          <Column field="start_date"  header="Dates"       sortable body={datesBody}    style={{ minWidth: '200px' }} />
          <Column header="Reason"     body={reasonBody}    style={{ minWidth: '180px' }} />
          <Column field="status"      header="Status"      sortable filter filterElement={statusFilterTemplate} filterMatchMode={FilterMatchMode.EQUALS} body={statusBody} style={{ minWidth: '110px' }} />
          {mode === 'pending' && <Column header="Actions" body={actionsBody} style={{ minWidth: '140px' }} />}
        </DataTable>
      </div>

      <Dialog open={!!denyTarget} onOpenChange={(o) => !o && setDenyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deny Leave Request</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Denying leave for <strong>{denyTarget?.full_name}</strong>. You may add a note for the employee.
          </p>
          <Textarea
            placeholder="Reason for denial (optional)"
            value={denyNotes}
            onChange={(e) => setDenyNotes(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={loading !== null}
              onClick={() => denyTarget && handleDecision(denyTarget.id, 'denied', denyNotes)}>
              Deny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
