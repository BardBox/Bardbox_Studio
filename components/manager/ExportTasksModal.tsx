'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Download } from 'lucide-react';

const ALL_COLUMNS = [
  { key: 'task_name', label: 'Task Name' },
  { key: 'designer',  label: 'Designer' },
  { key: 'smo',       label: 'SMO' },
  { key: 'type',      label: 'Type' },
  { key: 'platform',  label: 'Platform' },
  { key: 'priority',  label: 'Priority' },
  { key: 'post_date', label: 'Post Date' },
  { key: 'status',    label: 'Status' },
  { key: 'script',    label: 'Script / Brief' },
];

const DEFAULT_COLUMNS = new Set(['task_name', 'designer', 'type', 'priority', 'post_date', 'status']);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExportTasksModal({ open, onClose }: Props) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_COLUMNS));
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('__all__');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');

  useEffect(() => {
    if (!open) return;
    fetch('/api/clients')
      .then(r => r.json())
      .then((data: { name: string; is_active: boolean }[]) => {
        setClients(Array.isArray(data) ? data.filter(c => c.is_active).map(c => c.name).sort() : []);
      })
      .catch(() => {});
  }, [open]);

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleExport() {
    if (selected.size === 0) {
      toast.error('Select at least one column');
      return;
    }
    setLoading(true);
    try {
      const columns = ALL_COLUMNS.filter(c => selected.has(c.key)).map(c => c.key).join(',');
      const clientParam = selectedClient !== '__all__' ? `&client=${encodeURIComponent(selectedClient)}` : '';
      const url = `/api/admin/export/tasks?month=${month}&columns=${columns}${clientParam}&format=${format}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(err.error ?? 'Export failed');
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const clientSlug = selectedClient !== '__all__' ? `-${selectedClient.replace(/\s+/g, '_')}` : '';
      a.download = `tasks-${month}${clientSlug}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Excel downloaded');
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export Tasks to Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Month picker */}
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Client filter */}
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={selectedClient} onValueChange={v => setSelectedClient(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All clients (one sheet each)</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format toggle */}
          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2">
              {(['xlsx', 'csv'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`px-4 py-1.5 rounded text-sm font-medium border transition-colors ${
                    format === f
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:border-foreground/40'
                  }`}
                >
                  .{f}
                </button>
              ))}
            </div>
          </div>

          {/* Column selection */}
          <div className="space-y-1.5">
            <Label>Columns to include</Label>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
              {ALL_COLUMNS.map(col => (
                <div key={col.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`col-${col.key}`}
                    checked={selected.has(col.key)}
                    onCheckedChange={() => toggle(col.key)}
                  />
                  <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {selectedClient === '__all__'
              ? 'One sheet per client. Rows are combined design + post tasks.'
              : `Single sheet for ${selectedClient} only.`}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={loading || selected.size === 0}>
            <Download className="h-4 w-4 mr-2" />
            {loading ? 'Generating…' : `Export .${format}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
