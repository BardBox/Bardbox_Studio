'use client';

import { useState, useEffect, useTransition } from 'react';
import { Plus, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CapacityRow {
  id: number;
  user_id: string;
  content_type: string;
  task_type: string;
  daily_cap: number;
  notes: string | null;
  updated_at: string;
}

interface ContentType {
  id: number;
  key: string;
  label: string;
  for_designer: boolean;
  for_smo: boolean;
}

export interface CapacityUser {
  id: string;
  full_name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer', video_editor: 'Video Editor', smo: 'SMO',
};

const ROLE_COLORS: Record<string, string> = {
  designer:     'bg-blue-500/15 text-blue-700 border-blue-400/30',
  video_editor: 'bg-cyan-500/15 text-cyan-700 border-cyan-400/30',
  smo:          'bg-violet-500/15 text-violet-700 border-violet-400/30',
};

const inputCls = 'h-7 rounded-lg border border-white/50 bg-white/60 dark:bg-white/10 px-2 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40';

function taskTypeForRole(role: string): string {
  if (role === 'smo') return 'post';
  if (role === 'video_editor') return 'video';
  return 'design';
}

function RowItem({
  row,
  onUpdate,
  onDelete,
}: {
  row: CapacityRow;
  onUpdate: (id: number, cap: number, notes: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [cap, setCap] = useState(String(row.daily_cap));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [pending, start] = useTransition();

  function cancel() { setCap(String(row.daily_cap)); setNotes(row.notes ?? ''); setEditing(false); }
  function save() { start(async () => { await onUpdate(row.id, Number(cap), notes); setEditing(false); }); }

  return (
    <tr className="group border-b border-white/10 last:border-0 hover:bg-white/10 transition-colors text-xs">
      <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200 capitalize">{row.content_type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-2">
        <span className="px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400 text-[10px] font-bold border border-slate-400/20">
          {row.task_type}
        </span>
      </td>
      <td className="px-4 py-2 w-24">
        {editing
          ? <input type="number" min={1} max={50} value={cap} onChange={e => setCap(e.target.value)} className={`${inputCls} w-16`} />
          : <span className="font-bold tabular-nums text-slate-800 dark:text-slate-100">{row.daily_cap}/day</span>
        }
      </td>
      <td className="px-4 py-2 text-slate-400 max-w-[160px]">
        {editing
          ? <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" className={`${inputCls} w-full`} />
          : <span className="truncate block">{row.notes ?? <span className="italic opacity-40">—</span>}</span>
        }
      </td>
      <td className="px-4 py-2 text-right">
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={save} disabled={pending} className="size-6 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors disabled:opacity-40">
              <Check className="size-3" />
            </button>
            <button onClick={cancel} className="size-6 rounded-full flex items-center justify-center bg-slate-100/60 text-slate-500 hover:bg-slate-200/60 transition-colors">
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setEditing(true)} className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
              <Pencil className="size-3" />
            </button>
            <button onClick={() => start(() => onDelete(row.id))} disabled={pending} className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddRowForm({
  user,
  existingTypes,
  contentTypes,
  onAdd,
  onCancel,
}: {
  user: CapacityUser;
  existingTypes: string[];
  contentTypes: ContentType[];
  onAdd: (row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}) {
  const taskType = taskTypeForRole(user.role);
  const isDesignerType = user.role === 'designer' || user.role === 'video_editor';
  const all = contentTypes.filter(ct => isDesignerType ? ct.for_designer : ct.for_smo);
  const available = all.filter(ct => !existingTypes.includes(ct.key));

  const [contentType, setContentType] = useState(available[0]?.key ?? '__custom__');
  const [customType, setCustomType] = useState('');
  const [cap, setCap] = useState('3');
  const [notes, setNotes] = useState('');
  const [pending, start] = useTransition();

  const finalType = contentType === '__custom__' ? customType.toLowerCase().trim() : contentType;

  function submit() {
    if (!finalType || !cap) return;
    start(async () => {
      await onAdd({ content_type: finalType, task_type: taskType, daily_cap: Number(cap), notes: notes || null });
    });
  }

  const selectCls = 'h-7 rounded-lg border border-white/50 bg-white/60 dark:bg-white/10 px-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40';

  return (
    <tr className="border-b border-white/10 bg-blue-500/5 text-xs">
      <td className="px-4 py-2" colSpan={2}>
        <div className="flex items-center gap-2">
          <select value={contentType} onChange={e => setContentType(e.target.value)} className={`${selectCls} w-36`}>
            {available.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
          {contentType === '__custom__' && (
            <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. banner" className={`${inputCls} w-24`} />
          )}
          <span className="text-[10px] text-slate-400">→ {taskType}</span>
        </div>
      </td>
      <td className="px-4 py-2 w-24">
        <input type="number" min={1} max={50} value={cap} onChange={e => setCap(e.target.value)} className={`${inputCls} w-16`} />
      </td>
      <td className="px-4 py-2">
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" className={`${inputCls} w-full`} />
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center gap-1 justify-end">
          <button onClick={submit} disabled={pending || !finalType} className="size-6 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors disabled:opacity-40">
            <Check className="size-3" />
          </button>
          <button onClick={onCancel} className="size-6 rounded-full flex items-center justify-center bg-slate-100/60 text-slate-500 hover:bg-slate-200/60 transition-colors">
            <X className="size-3" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function CapacityModal({ user, onClose }: { user: CapacityUser | null; onClose: () => void }) {
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setAdding(false);
    Promise.all([
      fetch(`/api/admin/capacity?user_id=${user.id}`).then(r => r.json()),
      fetch('/api/admin/content-types').then(r => r.json()),
    ]).then(([rowData, ctData]) => {
      setRows(Array.isArray(rowData) ? rowData : []);
      setContentTypes(Array.isArray(ctData) ? ctData : []);
    }).catch(() => toast.error('Failed to load capacity data')).finally(() => setLoading(false));
  }, [user?.id]);

  async function handleUpdate(id: number, cap: number, notes: string) {
    const res = await fetch(`/api/admin/capacity/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_cap: cap, notes }),
    });
    if (res.ok) {
      setRows(prev => prev.map(r => r.id === id ? { ...r, daily_cap: cap, notes } : r));
      toast.success('Updated');
    } else {
      toast.error('Failed to update');
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/admin/capacity/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id));
      toast.success('Deleted');
    } else {
      toast.error('Failed to delete');
    }
  }

  async function handleAdd(row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) {
    const res = await fetch('/api/admin/capacity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user!.id, ...row }),
    });
    if (res.ok) {
      const data = await res.json();
      setRows(prev => [...prev, data]);
      setAdding(false);
      toast.success('Added');
    } else {
      toast.error('Failed to add');
    }
  }

  const avg = rows.length > 0
    ? (rows.reduce((s, r) => s + r.daily_cap, 0) / rows.length).toFixed(1)
    : null;

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent variant="glass" className="sm:max-w-xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-white/20 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div>
              <DialogTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
                {user?.full_name ?? '—'}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {user && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role] ?? 'bg-slate-500/10 text-slate-600 border-slate-300'}`}>
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                )}
                {avg && (
                  <span className="text-[10px] text-slate-400">{rows.length} rule{rows.length !== 1 ? 's' : ''} · avg {avg}/day</span>
                )}
              </div>
            </div>
            <button
              onClick={() => { setAdding(true); }}
              className="ml-auto h-7 px-3 rounded-full border border-white/50 dark:border-white/20 bg-white/60 dark:bg-white/10 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/20 transition-colors inline-flex items-center gap-1"
            >
              <Plus className="size-3" /> Add rule
            </button>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border-b border-white/20 dark:border-white/10 z-10">
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="text-left px-4 py-2">Content Type</th>
                  <th className="text-left px-4 py-2">Task</th>
                  <th className="text-left px-4 py-2">Cap</th>
                  <th className="text-left px-4 py-2">Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {adding && user && (
                  <AddRowForm
                    user={user}
                    existingTypes={rows.map(r => r.content_type)}
                    contentTypes={contentTypes}
                    onAdd={handleAdd}
                    onCancel={() => setAdding(false)}
                  />
                )}
                {rows.map(row => (
                  <RowItem key={row.id} row={row} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
                {rows.length === 0 && !adding && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-[11px] text-slate-400 py-10 italic">
                      No capacity rules configured — default cap applies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
