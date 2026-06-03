'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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

interface RolesManagerProps {
  initialRoles: Role[];
}

const EMPTY_FORM = { key: '', label: '', description: '' };

export function RolesManager({ initialRoles }: RolesManagerProps) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [deleteRole, setDeleteRole] = useState<Role | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function openCreate() {
    setCreateOpen(true);
  }

  function openEdit(role: Role) {
    setForm({
      key: role.key,
      label: role.label,
      description: role.description ?? '',
    });
    setEditRole(role);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: form.key,
        label: form.label,
        description: form.description,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to create role');
    } else {
      setRoles((prev) => [...prev, { ...json, member_count: 0, active_count: 0 }]);
      toast.success(`Role "${json.label}" created`);
      setCreateOpen(false);
    }
    setLoading(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    setLoading(true);
    const res = await fetch(`/api/admin/roles/${editRole.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: form.label,
        description: form.description,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to update role');
    } else {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === editRole.id ? { ...r, label: json.label, description: json.description, default_task_cap: json.default_task_cap } : r
        )
      );
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
      setRoles((prev) => prev.filter((r) => r.id !== deleteRole.id));
      toast.success(`Role "${deleteRole.label}" deleted`);
      setDeleteRole(null);
    }
    setLoading(false);
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          New Role
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Per-person content capacity (e.g. carousels/day) is managed on the{' '}
        <a href="/admin/capacity" className="underline underline-offset-2 hover:text-foreground">Capacity page</a>.
      </p>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                  No roles yet. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium">
                    <Badge variant="secondary">{role.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">{role.key}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {role.description ?? <span className="italic opacity-50">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm">
                      {role.active_count} active
                      {role.member_count !== role.active_count && (
                        <span className="text-muted-foreground"> / {role.member_count} total</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(role)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteRole(role)}
                        disabled={role.member_count > 0}
                        title={role.member_count > 0 ? 'Reassign all members before deleting' : 'Delete role'}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <CreateRoleDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(role) => setRoles((prev) => [...prev, { ...role, member_count: 0, active_count: 0 }])}
      />

      {/* Edit Dialog */}
      <Dialog open={!!editRole} onOpenChange={(open) => !open && setEditRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="flex flex-col gap-4">
            <Field label="Key" hint="Cannot be changed after creation">
              <Input value={form.key} disabled className="opacity-60" />
            </Field>
            <Field label="Label">
              <Input
                required
                value={form.label}
                onChange={(e) => setField('label', e.target.value)}
              />
            </Field>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditRole(null)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteRole} onOpenChange={(open) => !open && setDeleteRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the <span className="font-medium text-foreground">{deleteRole?.label}</span> role?
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteRole(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label className="text-sm font-medium">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
