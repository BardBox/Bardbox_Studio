'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TeamUser } from './TeamTable';

interface ResetPasswordDialogProps {
  user: TeamUser | null;
  onClose: () => void;
}

export function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? 'Reset failed');
    } else {
      toast.success(`Password reset for ${user.full_name}`);
      setPassword('');
      setConfirm('');
      onClose();
    }
    setLoading(false);
  }

  return (
    <Dialog open={!!user} onOpenChange={() => { setPassword(''); setConfirm(''); onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Set a new password for {user?.full_name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">New Password</label>
            <input type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input" placeholder="Min 8 characters" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Confirm Password</label>
            <input type="password" required value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="input" placeholder="Repeat password" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Resetting…' : 'Reset Password'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
