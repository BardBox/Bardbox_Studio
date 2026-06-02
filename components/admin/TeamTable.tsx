'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { DataTable } from 'primereact/datatable';
import type { DataTableFilterMeta } from 'primereact/datatable';
import { Column } from 'primereact/column';
import type { ColumnFilterElementTemplateOptions } from 'primereact/column';
import { FilterMatchMode } from 'primereact/api';
import { Dropdown } from 'primereact/dropdown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InviteDialog } from './InviteDialog';
import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export interface TeamUser {
  id: string;
  full_name: string;
  email: string;
  role: 'designer' | 'smo' | 'manager' | 'admin' | 'ceo' | 'hr' | 'developer';
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
}

const ROLE_LABELS: Record<string, string> = {
  designer:  'Designer',
  smo:       'SMO',
  manager:   'Manager',
  admin:     'Admin',
  ceo:       'CEO',
  hr:        'HR',
  developer: 'Developer',
};

const ROLE_OPTIONS = [
  { label: 'Designer',  value: 'designer' },
  { label: 'SMO',       value: 'smo' },
  { label: 'Manager',   value: 'manager' },
  { label: 'Admin',     value: 'admin' },
  { label: 'CEO',       value: 'ceo' },
  { label: 'HR',        value: 'hr' },
  { label: 'Developer', value: 'developer' },
];

export interface RoleOption { key: string; label: string; }

export function TeamTable({ initialUsers, roles = [] }: { initialUsers: TeamUser[]; roles?: RoleOption[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [resetUser, setResetUser] = useState<TeamUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [filters, setFilters] = useState<DataTableFilterMeta>({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    role:   { value: null, matchMode: FilterMatchMode.EQUALS },
  });

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

  function handleInvited() {
    window.location.reload();
  }

  const roleFilterTemplate = (options: ColumnFilterElementTemplateOptions) => (
    <Dropdown value={options.value} options={ROLE_OPTIONS}
      onChange={(e) => options.filterCallback(e.value, options.index)}
      placeholder="Any role" showClear style={{ minWidth: '10rem' }} />
  );

  const nameBody = (user: TeamUser) => (
    <div className={!user.is_active ? 'opacity-50' : ''}>
      <div className="font-medium">{user.full_name}</div>
      {user.designation && (
        <div className="text-xs text-muted-foreground">{user.designation}</div>
      )}
    </div>
  );

  const emailBody = (user: TeamUser) => (
    <div className={`text-sm ${!user.is_active ? 'opacity-50' : ''}`}>
      <div className="text-muted-foreground">{user.email}</div>
      {user.employee_id && (
        <div className="text-xs font-mono text-muted-foreground/70">{user.employee_id}</div>
      )}
    </div>
  );

  const roleBody = (user: TeamUser) => (
    <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
  );

  const taskCapBody = (user: TeamUser) => (
    <span className="text-right tabular-nums">{user.max_concurrent_tasks}</span>
  );

  const dailyCapBody = (user: TeamUser) => (
    <span className="text-right tabular-nums">{user.daily_capacity ?? 3}</span>
  );

  const statusBody = (user: TeamUser) => (
    <span className={`text-xs font-medium ${user.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
      {user.is_active ? 'Active' : 'Inactive'}
    </span>
  );

  const actionsBody = (user: TeamUser) => (
    <div className="flex items-center justify-end gap-2">
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditUser(user)}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setResetUser(user)}>
        Reset PW
      </Button>
      <Button
        size="sm" variant="ghost"
        className={`h-7 text-xs ${user.is_active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-700'}`}
        disabled={togglingId === user.id}
        onClick={() => toggleActive(user)}
      >
        {togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Reactivate'}
      </Button>
    </div>
  );

  const tableHeader = (
    <div className="flex items-center justify-between gap-3 p-1">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} member{users.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={globalFilter}
          onChange={(e) => {
            setGlobalFilter(e.target.value);
            setFilters(f => ({ ...f, global: { value: e.target.value, matchMode: FilterMatchMode.CONTAINS } }));
          }}
          placeholder="Search name or email…"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring w-52"
        />
        <Button onClick={() => setInviteOpen(true)}>+ Invite Member</Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="rounded-lg overflow-hidden border">
        <DataTable
          value={users}
          dataKey="id"
          sortField="role"
          sortOrder={1}
          filters={filters}
          onFilter={(e) => setFilters(e.filters)}
          filterDisplay="menu"
          globalFilterFields={['full_name', 'email']}
          size="small"
          header={tableHeader}
          emptyMessage="No team members found"
        >
          <Column field="full_name" header="Name"     sortable body={nameBody}    style={{ minWidth: '150px' }} />
          <Column field="email"     header="Email"    sortable body={emailBody}   style={{ minWidth: '200px' }} />
          <Column field="role"      header="Role"     sortable filter filterElement={roleFilterTemplate} filterMatchMode={FilterMatchMode.EQUALS} body={roleBody} style={{ minWidth: '110px' }} />
          <Column field="max_concurrent_tasks" header="Task Cap"  sortable body={taskCapBody}  style={{ width: '90px', textAlign: 'right' }} />
          <Column field="daily_capacity"       header="Daily Cap" sortable body={dailyCapBody} style={{ width: '90px', textAlign: 'right' }} />
          <Column field="is_active" header="Status"  sortable body={statusBody}  style={{ minWidth: '80px' }} />
          <Column body={actionsBody} style={{ minWidth: '220px' }} />
        </DataTable>
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={handleInvited} roles={roles} />
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
