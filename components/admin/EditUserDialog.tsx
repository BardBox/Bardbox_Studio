'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { TeamUser } from './TeamTable';

interface RoleOption { key: string; label: string; }

interface EditUserDialogProps {
  user: TeamUser | null;
  onClose: () => void;
  onUpdated: (updated: Partial<TeamUser>) => void;
  roles?: RoleOption[];
}

export function EditUserDialog({ user, onClose, onUpdated, roles = [] }: EditUserDialogProps) {
  const [form, setForm] = useState({ full_name: '', role: '', max_concurrent_tasks: '10' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({
      full_name: user.full_name,
      role: user.role,
      max_concurrent_tasks: String(user.max_concurrent_tasks),
    });
  }, [user]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, max_concurrent_tasks: Number(form.max_concurrent_tasks) }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Update failed');
    } else {
      toast.success('User updated');
      onUpdated({ full_name: form.full_name, role: form.role as TeamUser['role'], max_concurrent_tasks: Number(form.max_concurrent_tasks) });
      onClose();
    }
    setLoading(false);
  }

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Full Name</label>
            <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className="input" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Role</label>
            <Select value={form.role} onValueChange={(v) => set('role', v ?? '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Max Concurrent Tasks</label>
            <input type="number" min={1} max={50} value={form.max_concurrent_tasks}
              onChange={(e) => set('max_concurrent_tasks', e.target.value)} className="input" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
