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

const BLANK_EXTRA = {
  employee_id: '', designation: '', date_of_joining: '',
  employment_type: '', date_of_birth: '', emergency_contact: '',
  specialty: '',
};

export function EditUserDialog({ user, onClose, onUpdated, roles = [] }: EditUserDialogProps) {
  const [form, setForm] = useState({
    full_name: '', role: '', daily_capacity: '3', ...BLANK_EXTRA,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({
      full_name:       user.full_name,
      role:            user.role,
      daily_capacity:  String(user.daily_capacity ?? 3),
      employee_id:          user.employee_id       ?? '',
      designation:          user.designation       ?? '',
      date_of_joining:      user.date_of_joining   ?? '',
      employment_type:      user.employment_type   ?? '',
      date_of_birth:        user.date_of_birth     ?? '',
      emergency_contact:    user.emergency_contact ?? '',
      specialty:            user.specialty         ?? '',
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
      body: JSON.stringify({
        ...form,
        daily_capacity: Number(form.daily_capacity),
        date_of_joining:      form.date_of_joining || null,
        date_of_birth:        form.date_of_birth   || null,
        specialty:            form.specialty        || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Update failed');
    } else {
      toast.success('User updated');
      onUpdated({
        full_name:            form.full_name,
        role:                 form.role as TeamUser['role'],
        daily_capacity:  Number(form.daily_capacity),
        employee_id:          form.employee_id       || null,
        designation:          form.designation       || null,
        date_of_joining:      form.date_of_joining   || null,
        employment_type:      form.employment_type   || null,
        date_of_birth:        form.date_of_birth     || null,
        emergency_contact:    form.emergency_contact || null,
        specialty:            (form.specialty || null) as TeamUser['specialty'],
      });
      onClose();
    }
    setLoading(false);
  }

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {user?.full_name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Basic Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name *">
                <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className="input" />
              </Field>
              <Field label="Employee ID">
                <input value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)}
                  className="input" placeholder="BB-001" />
              </Field>
              <Field label="Designation" className="col-span-2">
                <input value={form.designation} onChange={(e) => set('designation', e.target.value)}
                  className="input" placeholder="Senior Designer" />
              </Field>
            </div>
          </section>

          {/* Employment */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employment</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role *">
                <Select value={form.role} onValueChange={(v) => set('role', v ?? '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Employment Type">
                <Select value={form.employment_type} onValueChange={(v) => set('employment_type', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-Time</SelectItem>
                    <SelectItem value="part-time">Part-Time</SelectItem>
                    <SelectItem value="freelance">Freelance</SelectItem>
                    <SelectItem value="intern">Intern</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {['designer'].includes(form.role) && (
                <Field label="Design Specialty">
                  <Select value={form.specialty || ''} onValueChange={(v) => set('specialty', v === '__both__' ? '' : (v ?? ''))}>
                    <SelectTrigger><SelectValue placeholder="Both (generalist)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__both__">Both (generalist)</SelectItem>
                      <SelectItem value="video_editor">🎬 Video Editor — reels, videos, youtube</SelectItem>
                      <SelectItem value="graphic_designer">🎨 Graphic Designer — carousels, posts, static</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Controls which content types are auto-assigned to this person.
                  </p>
                </Field>
              )}
              <Field label="Date of Joining">
                <input type="date" value={form.date_of_joining} onChange={(e) => set('date_of_joining', e.target.value)}
                  className="input" />
              </Field>

              <Field label="Daily Capacity (tasks/day)">
                <input type="number" min={1} max={20} value={form.daily_capacity}
                  onChange={(e) => set('daily_capacity', e.target.value)} className="input" />
              </Field>
            </div>
          </section>

          {/* HR Info */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HR Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date of Birth">
                <input type="date" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)}
                  className="input" />
              </Field>
              <Field label="Emergency Contact">
                <input value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)}
                  className="input" placeholder="Name — phone number" />
              </Field>
            </div>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
