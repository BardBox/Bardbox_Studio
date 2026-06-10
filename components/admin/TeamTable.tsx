'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Search, Plus, UserPlus, ArrowUpDown, Pencil, KeyRound, ToggleRight, ToggleLeft, Eye } from 'lucide-react';
import { InviteDialog } from './InviteDialog';
import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { CreateRoleDialog } from './CreateRoleDialog';
import { CapacityModal, type CapacityUser } from './CapacityModal';

export interface TeamUser {
  id: string;
  full_name: string;
  email: string;
  role: 'designer' | 'video_editor' | 'smo' | 'manager' | 'admin' | 'ceo' | 'hr' | 'developer';
  is_active: boolean;
  max_concurrent_tasks: number;
  daily_capacity: number;
  created_at: string;
  employee_id?: string | null;
  designation?: string | null;
  date_of_joining?: string | null;
  employment_type?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
  specialty?: 'video_editor' | 'graphic_designer' | null;
}

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer', video_editor: 'Video Editor', smo: 'SMO', manager: 'Manager',
  admin: 'Admin', ceo: 'CEO', hr: 'HR', developer: 'Developer',
};

const ROLE_COLORS: Record<string, string> = {
  designer:     'bg-blue-500/15 text-blue-700 border-blue-400/30',
  video_editor: 'bg-cyan-500/15 text-cyan-700 border-cyan-400/30',
  smo:          'bg-violet-500/15 text-violet-700 border-violet-400/30',
  manager:      'bg-amber-500/15 text-amber-700 border-amber-400/30',
  admin:        'bg-slate-500/15 text-slate-700 border-slate-400/30',
  ceo:          'bg-indigo-500/15 text-indigo-700 border-indigo-400/30',
  hr:           'bg-pink-500/15 text-pink-700 border-pink-400/30',
  developer:    'bg-emerald-500/15 text-emerald-700 border-emerald-400/30',
};

const ROLE_OPTIONS = [
  { label: 'Designer', value: 'designer' },           { label: 'Video Editor', value: 'video_editor' },
  { label: 'SMO', value: 'smo' },                     { label: 'Manager', value: 'manager' },
  { label: 'Admin', value: 'admin' },                 { label: 'CEO', value: 'ceo' },
  { label: 'HR', value: 'hr' },                       { label: 'Developer', value: 'developer' },
];

export interface RoleOption { key: string; label: string; }

type SortKey = 'full_name' | 'email' | 'role' | 'max_concurrent_tasks' | 'daily_capacity' | 'is_active';

export function TeamTable({ initialUsers, roles = [] }: { initialUsers: TeamUser[]; roles?: RoleOption[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [resetUser, setResetUser] = useState<TeamUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [capacityUser, setCapacityUser] = useState<CapacityUser | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('role');
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const visible = useMemo(() => {
    let list = users;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter);
    list = [...list].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [users, search, roleFilter, sortKey, sortAsc]);

  async function toggleActive(user: TeamUser) {
    setTogglingId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    if (res.ok) {
      setUsers(us => us.map(u => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      toast.success(user.is_active ? `${user.full_name} deactivated` : `${user.full_name} reactivated`);
    } else {
      toast.error('Failed to update status');
    }
    setTogglingId(null);
  }

  function handleUpdated(userId: string, updated: Partial<TeamUser>) {
    setUsers(us => us.map(u => u.id === userId ? { ...u, ...updated } : u));
  }

  const thClass = 'px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const tdClass = 'px-4 py-3';

  function SortBtn({ col }: { col: SortKey }) {
    return (
      <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-0.5 hover:text-slate-700 transition-colors">
        <ArrowUpDown className={`size-2.5 ${sortKey === col ? 'text-blue-500' : 'text-slate-300'}`} />
      </button>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="glass-panel rounded-xl px-5 py-3.5 flex items-center justify-between mb-4">
        <div>
          <h1 className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">Team</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
            {users.length} member{users.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="h-8 rounded-full border border-white/50 dark:border-white/20 bg-white/60 dark:bg-white/10 pl-8 pr-3 text-xs text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 w-48 backdrop-blur-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="h-8 rounded-full border border-white/50 dark:border-white/20 bg-white/60 dark:bg-white/10 px-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm"
          >
            <option value="">All roles</option>
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setCreateRoleOpen(true)}
            className="h-8 px-3 rounded-full border border-white/50 dark:border-white/20 bg-white/60 dark:bg-white/10 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/20 transition-colors backdrop-blur-sm inline-flex items-center gap-1"
          >
            <Plus className="size-3" /> Create Role
          </button>
          <button
            onClick={() => setInviteOpen(true)}
            className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-1.5"
          >
            <UserPlus className="size-3.5" /> Invite Member
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/20 dark:bg-white/5 border-b border-white/30 dark:border-white/10">
              <tr>
                <th className={thClass}><span className="flex items-center gap-1">Name <SortBtn col="full_name" /></span></th>
                <th className={thClass}><span className="flex items-center gap-1">Email <SortBtn col="email" /></span></th>
                <th className={thClass}><span className="flex items-center gap-1">Role <SortBtn col="role" /></span></th>
                <th className={`${thClass} text-right`}><span className="flex items-center justify-end gap-1">Task Cap <SortBtn col="max_concurrent_tasks" /></span></th>
                <th className={`${thClass} text-right`}><span className="flex items-center justify-end gap-1">Daily Cap <SortBtn col="daily_capacity" /></span></th>
                <th className={thClass}><span className="flex items-center gap-1">Status <SortBtn col="is_active" /></span></th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/15 dark:divide-white/5">
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">No team members found.</td>
                </tr>
              )}
              {visible.map(user => (
                <tr key={user.id} className={`hover:bg-white/20 dark:hover:bg-white/5 transition-colors ${!user.is_active ? 'opacity-50' : ''}`}>
                  <td className={tdClass}>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{user.full_name}</div>
                    {user.designation && <div className="text-xs text-slate-400 mt-0.5">{user.designation}</div>}
                  </td>
                  <td className={tdClass}>
                    <div className="text-slate-500">{user.email}</div>
                    {user.employee_id && <div className="text-xs font-mono text-slate-400">{user.employee_id}</div>}
                  </td>
                  <td className={tdClass}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${ROLE_COLORS[user.role] ?? 'bg-slate-500/10 text-slate-600 border-slate-400/20'}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                      {user.specialty === 'video_editor' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-700 border border-purple-400/30">🎬 Video</span>
                      )}
                      {user.specialty === 'graphic_designer' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-700 border border-sky-400/30">🎨 Graphic</span>
                      )}
                    </div>
                  </td>
                  <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium`}>{user.max_concurrent_tasks}</td>
                  <td className={`${tdClass} text-right tabular-nums text-slate-600 dark:text-slate-300 font-medium`}>{user.daily_capacity ?? 3}</td>
                  <td className={tdClass}>
                    <button
                      disabled={togglingId === user.id}
                      onClick={() => toggleActive(user)}
                      title={user.is_active ? 'Click to deactivate' : 'Click to reactivate'}
                      className="flex items-center justify-center transition-all disabled:opacity-40 hover:opacity-80"
                    >
                      {togglingId === user.id
                        ? <span className="text-slate-400 text-sm">…</span>
                        : user.is_active
                        ? <ToggleRight className="size-7 text-emerald-500" />
                        : <ToggleLeft className="size-7 text-slate-300" />
                      }
                    </button>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <div className="flex items-center justify-end gap-1">
                      {['designer', 'video_editor', 'smo'].includes(user.role) && (
                        <button
                          onClick={() => setCapacityUser({ id: user.id, full_name: user.full_name, role: user.role })}
                          title="View capacity"
                          className="size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-violet-600 hover:bg-violet-500/10 transition-colors"
                        >
                          <Eye className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditUser(user)}
                        title="Edit member"
                        className="size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setResetUser(user)}
                        title="Reset password"
                        className="size-7 rounded-full flex items-center justify-center text-slate-500 hover:text-amber-600 hover:bg-amber-500/10 transition-colors"
                      >
                        <KeyRound className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CapacityModal user={capacityUser} onClose={() => setCapacityUser(null)} />
      <CreateRoleDialog open={createRoleOpen} onClose={() => setCreateRoleOpen(false)} onCreated={() => window.location.reload()} />
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={() => window.location.reload()} roles={roles} />
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onUpdated={(updated) => { if (editUser) handleUpdated(editUser.id, updated); }}
        roles={roles}
      />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
    </>
  );
}
