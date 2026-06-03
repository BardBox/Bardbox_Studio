'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface CreatedRole {
  id: number;
  key: string;
  label: string;
  description: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (role: CreatedRole) => void;
}

const EMPTY = { key: '', label: '', description: '' };

export function CreateRoleDialog({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: form.key,
        label: form.label,
        description: form.description || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Failed to create role');
    } else {
      toast.success(`Role "${json.label}" created`);
      onCreated(json);
      setForm(EMPTY);
      onClose();
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Role</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Key" hint="Unique identifier, e.g. designer">
            <Input
              required
              value={form.key}
              onChange={(e) => setField('key', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
              placeholder="e.g. designer"
            />
          </Field>
          <Field label="Label">
            <Input
              required
              value={form.label}
              onChange={(e) => setField('label', e.target.value)}
              placeholder="e.g. Designer"
            />
          </Field>
          <Field label="Description">
            <Input
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="What does this role do?"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Role'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
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
