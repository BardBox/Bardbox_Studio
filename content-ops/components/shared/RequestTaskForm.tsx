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

  const NONE = '__none__';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="border rounded-lg p-5 space-y-4 bg-background">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label>Client *</Label>
            <Select value={form.client_name || NONE} onValueChange={(v) => set('client_name', !v || v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Platform *</Label>
            <Select value={form.platform || NONE} onValueChange={(v) => set('platform', !v || v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Platform…" /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Content Type *</Label>
            <Select value={form.content_type || NONE} onValueChange={(v) => set('content_type', !v || v === NONE ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Type…" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Posting Date *</Label>
            <Input type="date" value={form.posting_date} onChange={(e) => set('posting_date', e.target.value)} required />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Caption / Brief</Label>
            <Textarea
              placeholder="What should this post say?"
              rows={3}
              value={form.caption}
              onChange={(e) => set('caption', e.target.value)}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label>Notes for manager</Label>
            <Input
              placeholder="Any extra context"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Submitting…' : 'Submit Request'}
        </Button>
      </form>

      {submitted.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Submitted this session</p>
          {submitted.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{r.client_name} · {r.platform} {r.content_type}</p>
                <p className="text-xs text-muted-foreground">{r.posting_date}</p>
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">Pending</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
