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

interface Client { id: string | number; name: string; is_active: boolean }

interface Props {
  clients: Client[];
}

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'tiktok', 'other'];
const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'graphic', 'other'];
const PRIORITIES = [
  { value: 'low',    label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High' },
];

interface Suggestion { suggested_name: string; reason: string }

export function CreateTaskDialog({ clients }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [clientName, setClientName] = useState('');
  const [platform, setPlatform] = useState('');
  const [contentType, setContentType] = useState('');
  const [priority, setPriority] = useState('medium');
  const [postingDate, setPostingDate] = useState('');
  const [brief, setBrief] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');

  const [aiLoading, setAiLoading] = useState<'brief' | 'caption' | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  const canSubmit = clientName && platform && contentType && postingDate;

  async function handleExpandBrief() {
    if (!brief.trim()) { toast.error('Enter a brief idea first'); return; }
    setAiLoading('brief');
    try {
      const res = await fetch('/api/ai/expand-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ short_description: brief, platform, content_type: contentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBrief(data.brief);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI failed');
    } finally {
      setAiLoading(null);
    }
  }

  async function handleGenerateCaption() {
    setAiLoading('caption');
    try {
      const res = await fetch('/api/ai/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content_type: contentType, brief, client_name: clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCaption(data.caption ?? '');
      setHashtags(data.hashtags ?? '');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'AI failed');
    } finally {
      setAiLoading(null);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          platform,
          content_type: contentType,
          posting_date: postingDate,
          priority,
          brief: brief || undefined,
          caption: caption || undefined,
          hashtags: hashtags || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create task');
      toast.success('Content row created — tasks auto-assigned');

      // Fetch assignment suggestion for designer
      fetch('/api/ai/suggest-assignee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_type: 'design' }),
      }).then(r => r.json()).then((s) => {
        if (s.suggested_name) setSuggestion(s);
      }).catch(() => {});

      router.refresh();
      resetForm();
      setOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setClientName(''); setPlatform(''); setContentType(''); setPriority('medium');
    setPostingDate(''); setBrief(''); setCaption(''); setHashtags('');
    setSuggestion(null);
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>+ New Task</Button>

      {suggestion && (
        <div className="fixed bottom-4 right-4 z-50 bg-background border rounded-xl shadow-lg p-4 max-w-xs text-sm animate-in slide-in-from-bottom-4">
          <p className="font-medium mb-1">Suggested Designer</p>
          <p className="text-muted-foreground">{suggestion.suggested_name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{suggestion.reason}</p>
          <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs" onClick={() => setSuggestion(null)}>
            Dismiss
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); } setOpen(o); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Content Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Row 1: Client + Platform */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client *</Label>
                <Select value={clientName || undefined} onValueChange={v => setClientName(v ?? '')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.filter(c => c.is_active).map(c => (
                      <SelectItem key={String(c.id)} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Platform *</Label>
                <Select value={platform || undefined} onValueChange={v => setPlatform(v ?? '')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select platform…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Content Type + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Content Type *</Label>
                <Select value={contentType || undefined} onValueChange={v => setContentType(v ?? '')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={priority} onValueChange={v => setPriority(v ?? 'medium')}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Posting Date */}
            <div className="space-y-1.5">
              <Label className="text-xs">Posting Date *</Label>
              <Input
                type="date"
                value={postingDate}
                onChange={e => setPostingDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* Brief with AI expand */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Brief / Description</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1 text-primary"
                  onClick={handleExpandBrief}
                  disabled={aiLoading === 'brief' || !brief.trim()}
                >
                  {aiLoading === 'brief' ? (
                    <span className="h-3 w-3 rounded-full border border-primary border-t-transparent animate-spin inline-block" />
                  ) : '✨'} Expand
                </Button>
              </div>
              <Textarea
                placeholder="Describe the content idea..."
                value={brief}
                onChange={e => setBrief(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Caption with AI generate */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Caption</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs gap-1 text-primary"
                  onClick={handleGenerateCaption}
                  disabled={aiLoading === 'caption' || !platform || !contentType}
                >
                  {aiLoading === 'caption' ? (
                    <span className="h-3 w-3 rounded-full border border-primary border-t-transparent animate-spin inline-block" />
                  ) : '✨'} Generate
                </Button>
              </div>
              <Textarea
                placeholder="Social media caption..."
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1.5">
              <Label className="text-xs">Hashtags</Label>
              <Input
                placeholder="#hashtag1 #hashtag2"
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                className="text-sm h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setOpen(false); }}>
              Cancel
            </Button>
            <Button disabled={!canSubmit || loading} onClick={handleSubmit}>
              {loading ? 'Creating…' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
