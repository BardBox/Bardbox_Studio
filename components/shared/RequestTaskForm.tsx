'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Client, TaskRequest } from '@/lib/types';

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'tiktok', 'other'];
const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'graphic', 'other'];

export function RequestTaskForm({ clients, userId }: { clients: Client[]; userId: string }) {
  const blank = { client_name: '', platform: '', content_type: '', posting_date: '', caption: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<TaskRequest[]>([]);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name || !form.platform || !form.content_type || !form.posting_date) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    const res = await fetch('/api/tasks/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (res.ok) {
      toast.success('Task request submitted — awaiting manager approval');
      setSubmitted((prev) => [{ ...json, requested_by: userId }, ...prev]);
      setForm(blank);
    } else {
      toast.error(json.error ?? 'Submission failed');
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="border rounded-xl p-6 space-y-5 bg-card shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <Label className="text-sm font-semibold">Client <span className="text-destructive">*</span></Label>
            <Select value={form.client_name || null} onValueChange={(v) => set('client_name', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Platform <span className="text-destructive">*</span></Label>
            <Select value={form.platform || null} onValueChange={(v) => set('platform', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select platform…" /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Content Type <span className="text-destructive">*</span></Label>
            <Select value={form.content_type || null} onValueChange={(v) => set('content_type', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-sm font-semibold">Posting Date <span className="text-destructive">*</span></Label>
            <Input type="date" value={form.posting_date} onChange={(e) => set('posting_date', e.target.value)} required />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-sm font-semibold">Caption / Brief</Label>
            <Textarea
              placeholder="What should this post say?"
              rows={4}
              value={form.caption}
              onChange={(e) => set('caption', e.target.value)}
            />
          </div>
          <div className="space-y-2 col-span-2">
            <Label className="text-sm font-semibold">Notes for Manager</Label>
            <Input
              placeholder="Any extra context for the manager…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting} className="w-full h-11 text-base font-semibold mt-1">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>

      {submitted.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Submitted this session</p>
          {submitted.map((r) => (
            <div key={r.id} className="border rounded-xl p-4 flex items-start justify-between gap-2 bg-card shadow-sm">
              <div className="space-y-1">
                <p className="text-sm font-semibold">{r.client_name} · {r.platform} {r.content_type}</p>
                <p className="text-xs text-muted-foreground">{r.posting_date}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0 capitalize">Pending</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
