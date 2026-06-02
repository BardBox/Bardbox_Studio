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
import { Copy, Check } from 'lucide-react';

interface RoleOption { key: string; label: string; }

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
  defaultRole?: string;
  roles?: RoleOption[];
}

const BLANK = {
  full_name: '', email: '', role: '', max_concurrent_tasks: '10',
  employee_id: '', designation: '', date_of_joining: '',
  employment_type: '', date_of_birth: '', emergency_contact: '',
};

export function InviteDialog({ open, onClose, onInvited, defaultRole, roles = [] }: InviteDialogProps) {
  const [form, setForm] = useState({ ...BLANK, role: defaultRole ?? '' });
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ ...BLANK, role: defaultRole ?? '' });
      setInviteLink(null);
      setCopied(false);
    }
  }, [open, defaultRole]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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
      toast.error(json.error ?? 'Failed to create member');
    } else {
      onInvited();
      if (json.invite_link) {
        setInviteLink(json.invite_link);
      } else {
        onClose();
      }
    }
    setLoading(false);
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        {inviteLink ? (
          <div className="flex flex-col gap-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Member created. Copy the link below and share it via WhatsApp or Slack —
              <span className="font-medium text-foreground"> do not send via email</span> as email
              security scanners consume single-use links before the user can click them.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={inviteLink}
                className="input flex-1 text-xs font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                {copied ? <Check className="size-4 text-green-600" /> : <Copy className="size-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-2">

            {/* Basic Info */}
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name *">
                  <input required value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
                    className="input" placeholder="Jane Smith" />
                </Field>
                <Field label="Email *">
                  <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                    className="input" placeholder="jane@agency.com" />
                </Field>
                <Field label="Employee ID">
                  <input value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)}
                    className="input" placeholder="BB-001" />
                </Field>
                <Field label="Designation">
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
                    <SelectTrigger><SelectValue placeholder="Select role…" /></SelectTrigger>
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
                <Field label="Date of Joining">
                  <input type="date" value={form.date_of_joining} onChange={(e) => set('date_of_joining', e.target.value)}
                    className="input" />
                </Field>
                <Field label="Max Concurrent Tasks">
                  <input type="number" min={1} max={50} value={form.max_concurrent_tasks}
                    onChange={(e) => set('max_concurrent_tasks', e.target.value)}
                    className="input" />
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
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating…' : 'Create Member'}
              </Button>
            </DialogFooter>
          </form>
        )}
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
