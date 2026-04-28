'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteDialog({ open, onClose, onInvited }: InviteDialogProps) {
  const [form, setForm] = useState({ full_name: '', email: '', role: '', max_concurrent_tasks: '10' });
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.role) { toast.error('Please select a role'); return; }
    setLoading(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, max_concurrent_tasks: Number(form.max_concurrent_tasks) }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to send invite');
    } else {
      toast.success(`Invite email sent to ${form.email}`);
      setForm({ full_name: '', email: '', role: '', max_concurrent_tasks: '10' });
      onInvited();
      onClose();
    }
    setLoading(false);
  }

  function handleClose() {
    setForm({ full_name: '', email: '', role: '', max_concurrent_tasks: '10' });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Full Name">
            <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
              className="input" placeholder="Jane Smith" />
          </Field>
          <Field label="Email">
            <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              className="input" placeholder="jane@agency.com" />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => set('role', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="smo">Social Media Ops</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="ceo">CEO</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max Concurrent Tasks">
            <input type="number" min={1} max={50} value={form.max_concurrent_tasks}
              onChange={(e) => set('max_concurrent_tasks', e.target.value)}
              className="input" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Sending invite…' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
