'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InviteDialog } from './InviteDialog';
import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';

export interface TeamUser {
  id: string;
  full_name: string;
  email: string;
  role: 'designer' | 'smo' | 'manager' | 'admin';
  is_active: boolean;
  max_concurrent_tasks: number;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  designer: 'Designer',
  smo: 'SMO',
  manager: 'Manager',
  admin: 'Admin',
};

export function TeamTable({ initialUsers }: { initialUsers: TeamUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | null>(null);
  const [resetUser, setResetUser] = useState<TeamUser | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function toggleActive(user: TeamUser) {
    setTogglingId(user.id);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !user.is_active }),
    });
    if (res.ok) {
      setUsers((us) => us.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
      toast.success(user.is_active ? `${user.full_name} deactivated` : `${user.full_name} reactivated`);
    } else {
      toast.error('Failed to update status');
    }
    setTogglingId(null);
  }

  function handleUpdated(userId: string, updated: Partial<TeamUser>) {
    setUsers((us) => us.map((u) => u.id === userId ? { ...u, ...updated } : u));
  }

  function handleInvited() {
    // Refresh list from server by reloading
    window.location.reload();
  }

  const sorted = [...users].sort((a, b) => {
    const roleOrder = ['admin', 'manager', 'designer', 'smo'];
    return roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.full_name.localeCompare(b.full_name);
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>+ Invite Member</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Task Cap</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((user) => (
              <TableRow key={user.id} className={!user.is_active ? 'opacity-50' : ''}>
                <TableCell className="font-medium">{user.full_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{user.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                </TableCell>
                <TableCell className="text-right">{user.max_concurrent_tasks}</TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${user.is_active ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => setEditUser(user)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => setResetUser(user)}>
                      Reset PW
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-7 text-xs ${user.is_active ? 'text-destructive hover:text-destructive' : 'text-green-600 hover:text-green-700'}`}
                      disabled={togglingId === user.id}
                      onClick={() => toggleActive(user)}
                    >
                      {togglingId === user.id ? '…' : user.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={handleInvited} />
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onUpdated={(updated) => { if (editUser) handleUpdated(editUser.id, updated); }}
      />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />
    </>
  );
}
