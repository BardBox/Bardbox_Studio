'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Client, TaskRequest } from '@/lib/types';

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'tiktok', 'other'];
const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'graphic', 'other'];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

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

  const inputCls = 'bg-white/50 border-white/60 focus:border-blue-300/60 focus-visible:ring-0 focus-visible:border-blue-300/60 text-slate-700 placeholder:text-slate-300 text-sm rounded-xl';
  const triggerCls = 'bg-white/50 border-white/60 focus:border-blue-300/60 focus:ring-0 text-slate-700 rounded-xl text-sm';

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-4 shadow-xl">

        {/* Client */}
        <div>
          <FieldLabel required>Client</FieldLabel>
          <Select value={form.client_name} onValueChange={(v) => set('client_name', v ?? '')}>
            <SelectTrigger className={triggerCls}><SelectValue placeholder="Select client…" /></SelectTrigger>
            <SelectContent>
              {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Platform + Content Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel required>Platform</FieldLabel>
            <Select value={form.platform} onValueChange={(v) => set('platform', v ?? '')}>
              <SelectTrigger className={triggerCls}><SelectValue placeholder="Select platform…" /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FieldLabel required>Content Type</FieldLabel>
            <Select value={form.content_type} onValueChange={(v) => set('content_type', v ?? '')}>
              <SelectTrigger className={triggerCls}><SelectValue placeholder="Select type…" /></SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Posting Date */}
        <div>
          <FieldLabel required>Posting Date</FieldLabel>
          <Input
            type="date"
            value={form.posting_date}
            onChange={(e) => set('posting_date', e.target.value)}
            className={inputCls}
            required
          />
        </div>

        {/* Caption */}
        <div>
          <FieldLabel>Caption / Brief</FieldLabel>
          <Textarea
            placeholder="What should this post say?"
            rows={4}
            value={form.caption}
            onChange={(e) => set('caption', e.target.value)}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Notes */}
        <div>
          <FieldLabel>Notes for Manager</FieldLabel>
          <Input
            placeholder="Any extra context for the manager…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-xl bg-blue-500/80 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold backdrop-blur-sm transition-all mt-1 shadow-sm"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>

      {/* Submitted this session */}
      {submitted.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Submitted this session</p>
          {submitted.map((r) => (
            <div key={r.id} className="glass-panel rounded-xl px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-700">{r.client_name} · {r.platform} {r.content_type}</p>
                <p className="text-xs text-slate-400 mt-0.5">{r.posting_date}</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-400/40 text-amber-700 shrink-0">
                Pending
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
