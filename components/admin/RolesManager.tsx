'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { CreateRoleDialog } from './CreateRoleDialog';

export interface Role {
  id: number;
  key: string;
  label: string;
  description: string | null;
  created_at: string;
  member_count: number;
  active_count: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin:     'bg-slate-500/15 text-slate-700 border-slate-400/30',
  manager:   'bg-amber-500/15 text-amber-700 border-amber-400/30',
  ceo:       'bg-indigo-500/15 text-indigo-700 border-indigo-400/30',
  hr:        'bg-pink-500/15 text-pink-700 border-pink-400/30',
  designer:  'bg-blue-500/15 text-blue-700 border-blue-400/30',
  smo:       'bg-violet-500/15 text-violet-700 border-violet-400/30',
  developer: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30',
};

const inputCls = 'w-full h-8 rounded-xl border border-white/50 bg-white/60 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm disabled:opacity-50';

export function RolesManager({ initialRoles }: { initialRoles: Role[] }) {
  const [roles, setRoles]           = useState(initialRoles);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole]     = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [form, setForm]             = useState({ key: '', label: '', description: '' });
  const [loading, setLoading]       = useState(false);

  function openEdit(role: Role) {
    setForm({ key: role.key, label: role.label, description: role.description ?? '' });
    setEditRole(role);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    setLoading(true);
    const res = await fetch(`/api/admin/roles/${editRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: form.label, description: form.description }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to update role');
    } else {
      setRoles(prev => prev.map(r => r.id === editRole.id ? { ...r, label: json.label, description: json.description } : r));
      toast.success(`Role "${json.label}" updated`);
      setEditRole(null);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteRole) return;
    setLoading(true);
    const res = await fetch(`/api/admin/roles/${deleteRole.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to delete role');
    } else {
      setRoles(prev => prev.filter(r => r.id !== deleteRole.id));
      toast.success(`Role "${deleteRole.label}" deleted`);
      setDeleteRole(null);
    }
    setLoading(false);
  }

  const thClass = 'px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap';
  const tdClass = 'px-4 py-3';

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-slate-400">
          Per-person capacity is managed on the{' '}
          <a href="/admin/capacity" className="underline underline-offset-2 hover:text-slate-600 transition-colors">Capacity page</a>.
        </p>
        <button
          onClick={() => setCreateOpen(true)}
          className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-1.5"
        >
          <Plus className="size-3.5" /> New Role
        </button>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 border-b border-white/30">
              <tr>
                <th className={thClass}>Label</th>
                <th className={thClass}>Key</th>
                <th className={thClass}>Description</th>
                <th className={`${thClass} text-right`}>Members</th>
                <th className={`${thClass} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/15">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                    No roles yet. Create one to get started.
                  </td>
                </tr>
              ) : roles.map(role => (
                <tr key={role.id} className="hover:bg-white/20 transition-colors">
                  <td className={tdClass}>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[role.key] ?? 'bg-slate-500/10 text-slate-600 border-slate-400/20'}`}>
                      {role.label}
                    </span>
                  </td>
                  <td className={tdClass}>
                    <code className="text-xs bg-slate-500/10 px-1.5 py-0.5 rounded text-slate-500">{role.key}</code>
                  </td>
                  <td className={`${tdClass} text-slate-500 max-w-xs truncate`}>
                    {role.description ?? <span className="italic opacity-50">—</span>}
                  </td>
                  <td className={`${tdClass} text-right tabular-nums`}>
                    <span className="text-slate-600 font-medium">{role.active_count} active</span>
                    {role.member_count !== role.active_count && (
                      <span className="text-slate-400"> / {role.member_count}</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(role)}
                        className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                        title="Edit role"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteRole(role)}
                        disabled={role.member_count > 0}
                        title={role.member_count > 0 ? 'Reassign all members before deleting' : 'Delete role'}
                        className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create dialog */}
      <CreateRoleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(role) => setRoles(prev => [...prev, { ...role, member_count: 0, active_count: 0 }])}
      />

      {/* Edit modal */}
      {editRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-white/50" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
            <h2 className="text-sm font-bold text-slate-800 mb-1">Edit Role</h2>
            <p className="text-xs text-slate-400 mb-4">Update the label or description for this role.</p>
            <form onSubmit={handleEdit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Key <span className="normal-case font-normal">(cannot change)</span></label>
                <input value={form.key} disabled className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Label</label>
                <input required value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description…" className={inputCls} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditRole(null)} disabled={loading} className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="h-8 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-white/50" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
            <h2 className="text-sm font-bold text-slate-800 mb-1">Delete Role</h2>
            <p className="text-xs text-slate-500 mb-5">
              Are you sure you want to delete the{' '}
              <strong className="text-slate-700">{deleteRole.label}</strong> role? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteRole(null)} disabled={loading} className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={loading} className="h-8 px-4 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50">
                {loading ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
