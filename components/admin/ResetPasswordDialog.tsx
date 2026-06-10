'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/send-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      let json: { ok?: boolean; error?: string } = {};
      try { json = await res.json(); } catch { /* empty body */ }
      if (!res.ok) {
        toast.error(json.error ?? 'Failed to send reset link');
      } else {
        toast.success(`Password reset link sent to ${user.email}`);
        onClose();
      }
    } catch {
      toast.error('Network error — please try again');
    }
    setLoading(false);
  }

  return (
    <Dialog open={!!user} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Password Reset Link</DialogTitle>
          <DialogDescription>
            A secure reset link will be emailed to the user. They will use it to set their own password.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 dark:bg-white/5 dark:border-white/10 px-4 py-3">
          <Mail className="size-5 text-slate-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
