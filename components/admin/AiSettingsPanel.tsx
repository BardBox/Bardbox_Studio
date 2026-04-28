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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'gemini' | 'ollama' | 'openai';

interface AiSettings {
  provider: Provider;
  model: string;
  base_url: string;
  api_key: string;
  has_db_key: boolean;
  has_env_key: boolean;
}

interface TrainingDoc {
  id: number;
  title: string;
  category: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  initialSettings: AiSettings;
  initialDocs: TrainingDoc[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google Gemini',
  ollama: 'Ollama (local / self-hosted)',
  openai: 'OpenAI',
};

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-lite',
];

const OLLAMA_SUGGESTED = ['llama3.2', 'llama3.1', 'mistral', 'gemma2', 'phi3.5', 'qwen2.5'];

const OPENAI_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];

const CATEGORY_LABELS: Record<string, string> = {
  brand_guidelines:   '🎨 Brand Guidelines',
  client_info:        '👤 Client Info',
  workflow:           '⚙️ Workflow & SOPs',
  creative_direction: '✨ Creative Direction',
  general:            '📝 General',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  brand_guidelines:   "Brand voice, tone, color palette, do's and don'ts",
  client_info:        'Client profiles, preferences, past feedback, goals',
  workflow:           'SOPs, approval flows, process notes',
  creative_direction: 'Design preferences, content pillars, visual style',
  general:            'Any other custom context',
};

// ─── Tab toggle ───────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiSettingsPanel({ initialSettings, initialDocs }: Props) {
  const [tab, setTab] = useState<'provider' | 'training'>('provider');

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex border-b gap-2">
        <Tab active={tab === 'provider'} onClick={() => setTab('provider')}>
          🤖 AI Provider
        </Tab>
        <Tab active={tab === 'training'} onClick={() => setTab('training')}>
          🧠 Knowledge Base
        </Tab>
      </div>

      {tab === 'provider' && <ProviderSection initial={initialSettings} />}
      {tab === 'training' && <TrainingSection initialDocs={initialDocs} />}
    </div>
  );
}

// ─── Provider section ─────────────────────────────────────────────────────────

function ProviderSection({ initial }: { initial: AiSettings }) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [model, setModel] = useState(initial.model);
  const [baseUrl, setBaseUrl] = useState(initial.base_url || 'http://100.x.x.x:11434');
  const [apiKey, setApiKey] = useState('');
  const [clearKey, setClearKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; info?: string; error?: string } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);

  const hasKey = clearKey ? false : (!!apiKey || initial.has_db_key || initial.has_env_key);

  async function fetchOllamaModels() {
    if (!baseUrl) return;
    setFetchingModels(true);
    try {
      const res = await fetch('/api/admin/ai-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'ollama', model, base_url: baseUrl }),
      });
      const data = await res.json();
      if (data.ok && data.info) {
        const match = data.info.match(/Models: (.+)/);
        if (match) setOllamaModels(match[1].split(', ').filter(Boolean));
      }
    } catch { /* ignore */ }
    setFetchingModels(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    const config = {
      provider,
      model,
      base_url: provider === 'ollama' ? baseUrl : undefined,
      api_key: apiKey || undefined,
    };
    const res = await fetch('/api/admin/ai-settings/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      provider,
      model,
      base_url: provider !== 'gemini' ? baseUrl : undefined,
      api_key: clearKey ? '' : (apiKey || undefined),
    };
    const res = await fetch('/api/admin/ai-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('AI settings saved');
      setApiKey('');
      setClearKey(false);
    } else {
      const j = await res.json();
      toast.error(j.error ?? 'Failed to save');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Provider selector */}
      <div className="space-y-2">
        <Label>AI Provider</Label>
        <div className="grid grid-cols-3 gap-3">
          {(['gemini', 'ollama', 'openai'] as Provider[]).map(p => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`rounded-lg border-2 p-3 text-left transition-all ${
                provider === p
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
              }`}
            >
              <p className="text-sm font-semibold">
                {p === 'gemini' ? '✦' : p === 'ollama' ? '🦙' : '◆'} {p === 'gemini' ? 'Gemini' : p === 'ollama' ? 'Ollama' : 'OpenAI'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p === 'gemini' ? 'Google · API key' : p === 'ollama' ? 'Local · No cost' : 'OpenAI · API key'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Ollama config */}
      {provider === 'ollama' && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            Ollama must be running with <code className="bg-muted px-1 rounded">OLLAMA_HOST=0.0.0.0</code>.
            Enter your Tailscale or LAN IP below.
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL</Label>
            <div className="flex gap-2">
              <Input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="http://100.x.x.x:11434"
                className="font-mono text-sm"
              />
              <Button variant="outline" size="sm" onClick={fetchOllamaModels} disabled={fetchingModels}>
                {fetchingModels ? '…' : 'Fetch models'}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="llama3.2"
              className="font-mono text-sm"
            />
            {ollamaModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                <p className="w-full text-xs text-muted-foreground">Available on your server:</p>
                {ollamaModels.map(m => (
                  <button
                    key={m}
                    onClick={() => setModel(m)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      model === m ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {ollamaModels.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Suggested: {OLLAMA_SUGGESTED.map(m => (
                  <button key={m} onClick={() => setModel(m)} className="underline mr-1.5">{m}</button>
                ))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Gemini config */}
      {provider === 'gemini' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GEMINI_MODELS.map(m => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            {initial.has_env_key && !clearKey && (
              <p className="text-xs text-green-600">
                ✓ Using key from <code>GEMINI_API_KEY</code> environment variable
              </p>
            )}
            {initial.has_db_key && !clearKey && (
              <p className="text-xs text-blue-600">✓ Custom key saved in database</p>
            )}
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={hasKey ? 'Leave blank to keep existing key' : 'AIza…'}
            />
            {(initial.has_db_key) && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={clearKey} onChange={e => setClearKey(e.target.checked)} />
                Remove stored key (revert to env var)
              </label>
            )}
          </div>
        </div>
      )}

      {/* OpenAI config */}
      {provider === 'openai' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL <span className="text-muted-foreground">(optional, for proxies)</span></Label>
            <Input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.openai.com"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OPENAI_MODELS.map(m => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-…"
            />
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          testResult.ok
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {testResult.ok ? '✓ ' : '✗ '}
          {testResult.info ?? testResult.error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing…' : '⚡ Test Connection'}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}

// ─── Training / Knowledge base section ───────────────────────────────────────

function TrainingSection({ initialDocs }: { initialDocs: TrainingDoc[] }) {
  const [docs, setDocs] = useState<TrainingDoc[]>(initialDocs);
  const [editDoc, setEditDoc] = useState<Partial<TrainingDoc> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState('all');

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  async function saveDoc() {
    if (!editDoc?.title?.trim() || !editDoc?.content?.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setSaving(true);
    const isNew = !editDoc.id;
    const res = isNew
      ? await fetch('/api/admin/ai-training', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editDoc),
        })
      : await fetch(`/api/admin/ai-training/${editDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editDoc),
        });
    const saved = await res.json();
    setSaving(false);
    if (res.ok) {
      setDocs(ds => isNew ? [...ds, saved] : ds.map(d => d.id === saved.id ? saved : d));
      setEditDoc(null);
      toast.success(isNew ? 'Knowledge doc added' : 'Doc updated');
    } else {
      toast.error(saved.error ?? 'Failed to save');
    }
  }

  async function toggleActive(doc: TrainingDoc) {
    const res = await fetch(`/api/admin/ai-training/${doc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !doc.is_active }),
    });
    if (res.ok) {
      setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, is_active: !doc.is_active } : d));
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/ai-training/${deleteId}`, { method: 'DELETE' });
    if (res.ok) {
      setDocs(ds => ds.filter(d => d.id !== deleteId));
      toast.success('Doc deleted');
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">AI Knowledge Base</h2>
          <p className="text-xs text-muted-foreground">
            Active documents are injected into every AI response as context — no fine-tuning required.
            Add brand guidelines, client details, and workflow notes so the AI always knows your business.
          </p>
        </div>
        <Button size="sm" onClick={() => setEditDoc({ category: 'general', is_active: true })}>
          + Add Doc
        </Button>
      </div>

      {/* Filter by category */}
      <div className="flex flex-wrap gap-2">
        {['all', 'brand_guidelines', 'client_info', 'workflow', 'creative_direction', 'general'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filterCat === cat ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border hover:bg-muted'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            <span className="ml-1 text-muted-foreground">
              ({cat === 'all' ? docs.length : docs.filter(d => d.category === cat).length})
            </span>
          </button>
        ))}
      </div>

      {/* Category descriptions */}
      {filterCat !== 'all' && (
        <p className="text-xs text-muted-foreground italic">{CATEGORY_DESCRIPTIONS[filterCat]}</p>
      )}

      {/* Doc list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
          No documents yet.{' '}
          <button className="underline" onClick={() => setEditDoc({ category: filterCat === 'all' ? 'general' : filterCat, is_active: true })}>
            Add the first one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div
              key={doc.id}
              className={`rounded-lg border p-4 transition-opacity ${doc.is_active ? '' : 'opacity-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold">{doc.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </span>
                    {!doc.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                    {doc.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(doc)}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                    title={doc.is_active ? 'Disable' : 'Enable'}
                  >
                    {doc.is_active ? '✓ Active' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => setEditDoc({ ...doc })}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteId(doc.id)}
                    className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/create dialog */}
      <Dialog open={!!editDoc} onOpenChange={open => { if (!open) setEditDoc(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editDoc?.id ? 'Edit Knowledge Document' : 'Add Knowledge Document'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Title *</Label>
                <Input
                  value={editDoc?.title ?? ''}
                  onChange={e => setEditDoc(d => d ? { ...d, title: e.target.value } : d)}
                  placeholder="Bardbox Studio Brand Voice"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <Select
                  value={editDoc?.category ?? 'general'}
                  onValueChange={v => setEditDoc(d => d ? { ...d, category: v } : d)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Content *</Label>
              <p className="text-xs text-muted-foreground">
                Write everything you want the AI to know. Be specific — the AI will use this verbatim as context.
              </p>
              <Textarea
                value={editDoc?.content ?? ''}
                onChange={e => setEditDoc(d => d ? { ...d, content: e.target.value } : d)}
                placeholder={`Example for Brand Guidelines:\n- Brand tone: professional but approachable, avoid jargon\n- Primary colors: deep blue #1A2E5C, gold #C8A951\n- Always use the Oxford comma\n- Never use competitor names in content`}
                className="min-h-[200px] font-mono text-xs leading-relaxed"
              />
              <p className="text-xs text-muted-foreground text-right">
                {editDoc?.content?.length ?? 0} chars
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDoc(null)}>Cancel</Button>
            <Button onClick={saveDoc} disabled={saving}>
              {saving ? 'Saving…' : editDoc?.id ? 'Update' : 'Add Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete this document?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            The AI will no longer have access to this knowledge. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
