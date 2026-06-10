'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Check, X, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import type { ContentType } from './ContentTypeManager';

interface CapacityRow {
  id: number;
  user_id: string;
  content_type: string;
  task_type: string;
  daily_cap: number;
  notes: string | null;
  updated_at: string;
}

interface UserWithCapacity {
  id: string;
  full_name: string;
  role: 'designer' | 'video_editor' | 'smo';
  is_active: boolean;
  rows: CapacityRow[];
}

const ROLE_COLORS: Record<string, string> = {
  designer: 'bg-blue-500/15 text-blue-700 border-blue-400/30',
  smo:      'bg-violet-500/15 text-violet-700 border-violet-400/30',
};

const inputCls = 'h-6 rounded-lg border border-white/50 bg-white/60 px-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm';

function CapacityRowItem({
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
  const [pending, startTransition] = useTransition();

  function cancel() {
    setCap(String(row.daily_cap));
    setNotes(row.notes ?? '');
    setEditing(false);
  }

  function save() {
    startTransition(async () => {
      await onUpdate(row.id, Number(cap), notes);
      setEditing(false);
    });
  }

  const thClass = 'px-3 py-1.5';

  return (
    <tr className="group border-b border-white/10 last:border-0 hover:bg-white/15 transition-colors text-xs">
      <td className={`${thClass} font-medium text-slate-700 capitalize`}>{row.content_type.replace(/_/g, ' ')}</td>
      <td className={thClass}>
        <span className="px-1.5 py-0.5 rounded-full bg-slate-500/10 text-slate-500 text-[10px] font-bold border border-slate-400/20">
          {row.task_type}
        </span>
      </td>
      <td className={`${thClass} w-24`}>
        {editing
          ? <input type="number" min={1} max={50} value={cap} onChange={e => setCap(e.target.value)} className={`${inputCls} w-16`} />
          : <span className="font-bold tabular-nums text-slate-800">{row.daily_cap}</span>
        }
      </td>
      <td className={`${thClass} text-slate-400`}>
        {editing
          ? <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" className={`${inputCls} w-full`} />
          : <span className="truncate">{row.notes ?? <span className="italic opacity-50">—</span>}</span>
        }
      </td>
      <td className={`${thClass} text-right`}>
        {editing ? (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={save} disabled={pending} className="size-6 rounded-full flex items-center justify-center bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 transition-colors">
              <Check className="size-3" />
            </button>
            <button onClick={cancel} className="size-6 rounded-full flex items-center justify-center bg-slate-100/60 text-slate-500 hover:bg-slate-200/60 transition-colors">
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-end">
            <button onClick={() => setEditing(true)} className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
              <Pencil className="size-3" />
            </button>
            <button
              onClick={() => startTransition(() => onDelete(row.id))}
              disabled={pending}
              className="size-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AddRowForm({
  userId,
  role,
  existingTypes,
  contentTypes,
  onAdd,
  onCancel,
}: {
  userId: string;
  role: 'designer' | 'video_editor' | 'smo';
  existingTypes: string[];
  contentTypes: ContentType[];
  onAdd: (row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) => Promise<void>;
  onCancel: () => void;
}) {
  const allTypes = contentTypes.filter(ct => (role === 'designer' || role === 'video_editor') ? ct.for_designer : ct.for_smo);
  const available = allTypes.filter(ct => !existingTypes.includes(ct.key));
  const taskType = role === 'smo' ? 'post' : 'design';

  const [contentType, setContentType] = useState(available[0]?.key ?? '');
  const [customType, setCustomType] = useState('');
  const [cap, setCap] = useState('3');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const finalType = contentType === '__custom__' ? customType.toLowerCase().trim() : contentType;

  function submit() {
    if (!finalType || !cap) return;
    startTransition(async () => {
      await onAdd({ content_type: finalType, task_type: taskType, daily_cap: Number(cap), notes: notes || null });
    });
  }

  const selectCls = 'h-6 rounded-lg border border-white/50 bg-white/60 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm';

  return (
    <tr className="border-b border-white/10 bg-blue-500/5 text-xs">
      <td className="px-3 py-1.5" colSpan={2}>
        <div className="flex items-center gap-2">
          <select value={contentType} onChange={e => setContentType(e.target.value)} className={`${selectCls} w-36`}>
            {available.map(ct => <option key={ct.key} value={ct.key}>{ct.label}</option>)}
            <option value="__custom__">Custom type…</option>
          </select>
          {contentType === '__custom__' && (
            <input value={customType} onChange={e => setCustomType(e.target.value)} placeholder="e.g. banner" className={`${inputCls} w-24`} />
          )}
        </div>
      </td>
      <td className="px-3 py-1.5 w-24">
        <input type="number" min={1} max={50} value={cap} onChange={e => setCap(e.target.value)} className={`${inputCls} w-16`} />
      </td>
      <td className="px-3 py-1.5">
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…" className={`${inputCls} w-full`} />
      </td>
      <td className="px-3 py-1.5 text-right">
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

function UserCapacityCard({ user, contentTypes, onChange }: { user: UserWithCapacity; contentTypes: ContentType[]; onChange: (updated: UserWithCapacity) => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  async function handleUpdate(rowId: number, cap: number, notes: string) {
    await fetch(`/api/admin/capacity/${rowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ daily_cap: cap, notes }),
    });
    onChange({ ...user, rows: user.rows.map(r => r.id === rowId ? { ...r, daily_cap: cap, notes } : r) });
  }

  async function handleDelete(rowId: number) {
    await fetch(`/api/admin/capacity/${rowId}`, { method: 'DELETE' });
    onChange({ ...user, rows: user.rows.filter(r => r.id !== rowId) });
  }

  async function handleAdd(row: Omit<CapacityRow, 'id' | 'user_id' | 'updated_at'>) {
    const res = await fetch('/api/admin/capacity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, ...row }),
    });
    const data = await res.json();
    onChange({ ...user, rows: [...user.rows, data] });
    setAdding(false);
  }

  const avgCap = user.rows.length > 0
    ? (user.rows.reduce((s, r) => s + r.daily_cap, 0) / user.rows.length).toFixed(1)
    : null;

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/20 hover:bg-white/30 transition-colors text-left"
      >
        <span className="flex items-center justify-center text-slate-400">
          {open
            ? <ChevronDown className="size-3.5" />
            : <ChevronRight className="size-3.5" />}
        </span>
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{user.full_name}</span>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ROLE_COLORS[user.role]}`}>
          {user.role.toUpperCase()}
        </span>
        <span className="text-[10px] text-slate-400 ml-1">
          {user.rows.length} type{user.rows.length !== 1 ? 's' : ''}
          {avgCap ? ` · avg ${avgCap}/day` : ''}
        </span>
        <div className="ml-auto" onClick={e => { e.stopPropagation(); setOpen(true); setAdding(true); }}>
          <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-white/50 bg-white/60 text-[10px] font-semibold text-slate-600 hover:bg-white/80 transition-colors">
            <Plus className="size-2.5" /> Add type
          </span>
        </div>
      </button>

      {/* Expanded table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-white/20">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <th className="text-left px-3 py-1.5">Content Type</th>
                <th className="text-left px-3 py-1.5">Task Type</th>
                <th className="text-left px-3 py-1.5">Cap / Day</th>
                <th className="text-left px-3 py-1.5">Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {user.rows.map(row => (
                <CapacityRowItem key={row.id} row={row} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
              {user.rows.length === 0 && !adding && (
                <tr>
                  <td colSpan={5} className="text-center text-[11px] text-slate-400 py-4 italic">
                    No capacity rules — using default ({user.role === 'smo' ? 10 : 3}/day)
                  </td>
                </tr>
              )}
              {adding && (
                <AddRowForm
                  userId={user.id}
                  role={user.role}
                  existingTypes={user.rows.map(r => r.content_type)}
                  contentTypes={contentTypes}
                  onAdd={handleAdd}
                  onCancel={() => setAdding(false)}
                />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CapacityMatrix({ initialUsers, contentTypes }: { initialUsers: UserWithCapacity[]; contentTypes: ContentType[] }) {
  const [users, setUsers] = useState(initialUsers);

  function updateUser(updated: UserWithCapacity) {
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  }

  const designers = users.filter(u => u.role === 'designer');
  const smos = users.filter(u => u.role === 'smo');

  return (
    <div className="space-y-6">
      {designers.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Graphic Designers</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-400/20">design tasks</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {designers.map(u => (
              <UserCapacityCard key={u.id} user={u} contentTypes={contentTypes} onChange={updateUser} />
            ))}
          </div>
        </section>
      )}

      {smos.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">SMO — Social Media Operators</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 border border-violet-400/20">post tasks</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {smos.map(u => (
              <UserCapacityCard key={u.id} user={u} contentTypes={contentTypes} onChange={updateUser} />
            ))}
          </div>
        </section>
      )}

      {users.length === 0 && (
        <div className="glass-panel rounded-xl p-12 text-center text-slate-400 text-sm">
          No designers or SMOs found. Invite team members first.
        </div>
      )}
    </div>
  );
}
