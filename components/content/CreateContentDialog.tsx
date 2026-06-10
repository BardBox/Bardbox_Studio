'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLATFORMS = ['Instagram', 'LinkedIn', 'Twitter', 'Facebook', 'YouTube', 'Other'];
const CONTENT_TYPES = ['Post', 'Reel', 'Story', 'Carousel', 'Video', 'Article', 'Other'];

interface Props {
  open: boolean;
  defaultDate?: string | null;
  onClose: () => void;
}

export function CreateContentDialog({ open, defaultDate, onClose }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [isEmergency, setIsEmergency] = useState(false);
  const [form, setForm] = useState({
    client_name: '',
    platform: '',
    content_type: '',
    brief: '',
    caption: '',
    hashtags: '',
    posting_date: defaultDate ?? '',
    posting_time: '10:00',
  });

  // Update posting_date when defaultDate changes
  const effectiveDate = defaultDate ?? form.posting_date;

  function set(k: string, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSubmit() {
    if (!form.platform || !form.content_type || !effectiveDate) {
      toast.error('Platform, content type, and posting date are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          posting_date: effectiveDate,
          posting_time: `${form.posting_time}:00`,
          is_emergency: isEmergency,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? 'Failed to create content');
      }
      toast.success(isEmergency ? 'Emergency task created — existing tasks rescheduled.' : 'Content created — tasks auto-assigned.');
      router.refresh();
      onClose();
      setIsEmergency(false);
      setForm({ client_name: '', platform: '', content_type: '', brief: '', caption: '', hashtags: '', posting_date: '', posting_time: '10:00' });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Content Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Client Name</Label>
            <Input
              placeholder="e.g. Acme Corp"
              value={form.client_name}
              onChange={(e) => set('client_name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Platform *</Label>
              <Select value={form.platform} onValueChange={(v) => set('platform', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content Type *</Label>
              <Select value={form.content_type} onValueChange={(v) => set('content_type', v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Posting Date *</Label>
              <Input
                type="date"
                value={defaultDate ?? form.posting_date}
                onChange={(e) => set('posting_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Posting Time</Label>
              <Input
                type="time"
                value={form.posting_time}
                onChange={(e) => set('posting_time', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Brief</Label>
            <Textarea
              placeholder="Describe what this piece of content should be about..."
              value={form.brief}
              onChange={(e) => set('brief', e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Caption (optional)</Label>
            <Textarea
              placeholder="Draft caption for the post..."
              value={form.caption}
              onChange={(e) => set('caption', e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hashtags (optional)</Label>
            <Input
              placeholder="#example #branding"
              value={form.hashtags}
              onChange={(e) => set('hashtags', e.target.value)}
            />
          </div>

          {/* Emergency toggle */}
          <button
            type="button"
            onClick={() => setIsEmergency(v => !v)}
            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors text-left ${
              isEmergency
                ? 'border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-700'
                : 'border-border bg-muted/40 hover:bg-muted/60'
            }`}
          >
            <span className={`text-xl ${isEmergency ? 'animate-pulse' : ''}`}>🚨</span>
            <div>
              <p className={`text-sm font-semibold ${isEmergency ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>
                Emergency Task
              </p>
              <p className="text-xs text-muted-foreground">
                {isEmergency
                  ? 'This is marked as emergency — designer\'s existing tasks will shift by 1 working day'
                  : 'Mark as emergency to auto-reschedule the assigned designer\'s tasks'}
              </p>
            </div>
            <div className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
              isEmergency ? 'border-red-500 bg-red-500' : 'border-muted-foreground/40'
            }`}>
              {isEmergency && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!form.platform || !form.content_type || !(defaultDate ?? form.posting_date) || loading}
            onClick={handleSubmit}
            className={isEmergency ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {loading ? (isEmergency ? 'Creating & Rescheduling...' : 'Creating...') : (isEmergency ? '🚨 Create Emergency Task' : 'Create Content')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
