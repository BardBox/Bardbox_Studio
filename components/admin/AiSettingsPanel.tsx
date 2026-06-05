'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ToggleRight, ToggleLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'gemini' | 'groq' | 'anthropic' | 'openai' | 'ollama';

interface AiSettings {
  provider: Provider;
  model: string;
  base_url: string;
  api_key: string;
  has_db_key: boolean;
  env_key_map: Record<Provider, boolean>;
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
  gemini:    'Google Gemini',
  groq:      'Groq (Free)',
  anthropic: 'Anthropic Claude',
  openai:    'OpenAI',
  ollama:    'Ollama (self-hosted)',
};

const PROVIDER_DESC: Record<Provider, string> = {
  gemini:    'Google · API key · 1,500 req/day free',
  groq:      'Free tier · Llama / Mixtral · Fast',
  anthropic: 'Claude Haiku / Sonnet / Opus',
  openai:    'GPT-4o-mini / GPT-4o · API key',
  ollama:    'Runs locally · No cost · Private',
};

const PROVIDER_ICON: Record<Provider, string> = {
  gemini: '✦', groq: '⚡', anthropic: '◈', openai: '◆', ollama: '🦙',
};

const GEMINI_MODELS    = ['gemini-2.0-flash','gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash-lite'];
const GROQ_MODELS      = ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'];
const ANTHROPIC_MODELS = ['claude-haiku-4-5-20251001','claude-sonnet-4-6','claude-opus-4-7'];
const OPENAI_MODELS    = ['gpt-4o-mini','gpt-4o','gpt-4-turbo','gpt-3.5-turbo'];
const OLLAMA_SUGGESTED = ['llama3.2','llama3.1','mistral','gemma2','phi3.5','qwen2.5'];

const DEFAULT_MODEL: Record<Provider, string> = {
  gemini: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile',
  anthropic: 'claude-haiku-4-5-20251001', openai: 'gpt-4o-mini', ollama: 'llama3.2',
};

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

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls = 'w-full h-8 rounded-xl border border-white/50 bg-white/60 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm disabled:opacity-50';
const selectCls = 'w-full h-8 rounded-xl border border-white/50 bg-white/60 px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 backdrop-blur-sm font-mono';

// ─── Main component ───────────────────────────────────────────────────────────

export function AiSettingsPanel({ initialSettings, initialDocs }: Props) {
  const [tab, setTab] = useState<'provider' | 'training'>('provider');

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 w-fit">
        {(['provider', 'training'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t
                ? 'bg-white/80 text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'provider' ? '🤖 AI Provider' : '🧠 Knowledge Base'}
          </button>
        ))}
      </div>

      {tab === 'provider' && <ProviderSection initial={initialSettings} />}
      {tab === 'training' && <TrainingSection initialDocs={initialDocs} />}
    </div>
  );
}

// ─── Provider section ─────────────────────────────────────────────────────────

function ProviderSection({ initial }: { initial: AiSettings }) {
  const [savedProvider, setSavedProvider] = useState<Provider>(initial.provider);
  const [savedModel, setSavedModel]       = useState<string>(initial.model ?? '');
  const [provider, setProvider]           = useState<Provider>(initial.provider);
  const [model, setModel]                 = useState<string>(initial.model ?? '');
  const [baseUrl, setBaseUrl]             = useState(initial.base_url || 'http://100.x.x.x:11434');
  const [apiKey, setApiKey]               = useState('');
  const [clearKey, setClearKey]           = useState(false);
  const [saving, setSaving]               = useState(false);
  const [testing, setTesting]             = useState(false);
  const [testResult, setTestResult]       = useState<{ ok: boolean; info?: string; error?: string } | null>(null);
  const [ollamaModels, setOllamaModels]   = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [showKeyInput, setShowKeyInput]   = useState(false);

  const hasEnvKey = initial.env_key_map[provider] ?? false;
  const hasKey    = clearKey ? false : (!!apiKey || initial.has_db_key || hasEnvKey);
  const hasChanges = provider !== savedProvider || model !== savedModel || showKeyInput || clearKey;

  async function fetchOllamaModels() {
    if (!baseUrl) return;
    setFetchingModels(true);
    try {
      const res = await fetch('/api/admin/ai-settings/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    setTesting(true); setTestResult(null);
    const res = await fetch('/api/admin/ai-settings/test', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, base_url: (provider === 'ollama' || provider === 'openai') ? baseUrl : undefined, api_key: apiKey || undefined }),
    });
    setTestResult(await res.json());
    setTesting(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch('/api/admin/ai-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider, model,
        base_url: (provider === 'ollama' || provider === 'openai') ? baseUrl : undefined,
        api_key: clearKey ? '' : (apiKey || undefined),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('AI settings saved');
      setApiKey(''); setClearKey(false); setShowKeyInput(false);
      setSavedProvider(provider); setSavedModel(model);
    } else {
      const j = await res.json();
      toast.error(j.error ?? 'Failed to save');
    }
  }

  function selectProvider(p: Provider) {
    setProvider(p); setModel(DEFAULT_MODEL[p]); setTestResult(null);
    setApiKey(''); setClearKey(false); setShowKeyInput(false);
  }

  const modelOptions: Record<Provider, string[]> = {
    gemini: GEMINI_MODELS, groq: GROQ_MODELS,
    anthropic: ANTHROPIC_MODELS, openai: OPENAI_MODELS, ollama: [],
  };

  return (
    <div className="max-w-2xl space-y-4">
      {/* Provider cards */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">AI Provider</p>
        <div className="grid grid-cols-3 gap-2">
          {(['gemini', 'groq', 'anthropic', 'openai', 'ollama'] as Provider[]).map(p => (
            <button
              key={p}
              onClick={() => selectProvider(p)}
              className={`glass-panel rounded-xl p-3 text-left transition-all relative ${
                provider === p ? 'ring-2 ring-blue-400/60 bg-blue-500/5' : 'hover:bg-white/30'
              }`}
            >
              {savedProvider === p && (
                <span className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-400/30">
                  Active
                </span>
              )}
              <p className="text-xs font-semibold text-slate-800">{PROVIDER_ICON[p]} {PROVIDER_LABELS[p]}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{PROVIDER_DESC[p]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ollama config */}
      {provider === 'ollama' && (
        <div className="glass-panel rounded-xl p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Ollama must be running with <code className="bg-slate-500/10 px-1 rounded text-slate-600">OLLAMA_HOST=0.0.0.0</code>.
            Enter your Tailscale or LAN IP below.
          </p>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Base URL</p>
            <div className="flex gap-2">
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="http://100.x.x.x:11434" className={`${inputCls} font-mono flex-1`} />
              <button onClick={fetchOllamaModels} disabled={fetchingModels} className="h-8 px-3 rounded-xl border border-white/50 bg-white/60 text-xs text-slate-600 hover:bg-white/80 transition-colors disabled:opacity-50">
                {fetchingModels ? '…' : 'Fetch models'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Model</p>
            <input value={model} onChange={e => setModel(e.target.value)} placeholder="llama3.2" className={`${inputCls} font-mono`} />
            {ollamaModels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <p className="w-full text-[10px] text-slate-400">Available on your server:</p>
                {ollamaModels.map(m => (
                  <button key={m} onClick={() => setModel(m)} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${model === m ? 'border-blue-400/60 bg-blue-500/10 text-blue-700' : 'border-white/40 bg-white/40 text-slate-600 hover:bg-white/60'}`}>
                    {m}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 mt-1.5">
                Suggested: {OLLAMA_SUGGESTED.map(m => (
                  <button key={m} onClick={() => setModel(m)} className="underline mr-1.5 hover:text-slate-600">{m}</button>
                ))}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Standard provider config (model + API key) */}
      {provider !== 'ollama' && (
        <div className="glass-panel rounded-xl p-4 space-y-3">
          {/* Groq free-tier notice */}
          {provider === 'groq' && (
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700">
              ⚡ Groq offers a <strong>free tier</strong> — 14,400 requests/day. Get your API key at{' '}
              <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="underline">console.groq.com</a>
            </div>
          )}

          {/* OpenAI base URL */}
          {provider === 'openai' && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Base URL <span className="normal-case font-normal text-slate-300">(optional, for proxies)</span></p>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.openai.com" className={`${inputCls} font-mono`} />
            </div>
          )}

          {/* Model selector */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Model</p>
            <select value={model} onChange={e => setModel(e.target.value)} className={selectCls}>
              {modelOptions[provider].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* API key */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">API Key</p>
            {hasEnvKey && !clearKey && (
              <p className="text-xs text-emerald-600 mb-1">✓ Using key from <code className="bg-slate-500/10 px-1 rounded">{provider.toUpperCase()}_API_KEY</code> environment variable</p>
            )}
            {initial.has_db_key && !clearKey && (
              <p className="text-xs text-blue-600 mb-1">✓ Custom key saved in database</p>
            )}
            {savedProvider === provider && hasKey && !showKeyInput ? (
              <button type="button" onClick={() => setShowKeyInput(true)} className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600">
                Change key
              </button>
            ) : (
              <div className="space-y-1.5">
                <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={hasKey ? 'Leave blank to keep existing key' : 'Paste API key…'} className={inputCls} />
                {initial.has_db_key && (
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={clearKey} onChange={e => setClearKey(e.target.checked)} className="rounded accent-red-500" />
                    Remove stored key (revert to env var)
                  </label>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`glass-panel rounded-xl px-4 py-3 text-xs font-medium ${testResult.ok ? 'border border-emerald-400/40 text-emerald-700' : 'border border-red-400/40 text-red-600'}`}>
          {testResult.ok ? '✓ ' : '✗ '}{testResult.info ?? testResult.error}
        </div>
      )}

      {/* Actions */}
      {hasChanges && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <button onClick={handleTest} disabled={testing} className="h-8 px-4 rounded-full border border-white/50 bg-white/60 text-xs font-semibold text-slate-600 hover:bg-white/80 transition-colors disabled:opacity-50">
            {testing ? 'Testing…' : '⚡ Test Connection'}
          </button>
          <button onClick={handleSave} disabled={saving} className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Training / Knowledge base section ───────────────────────────────────────

function TrainingSection({ initialDocs }: { initialDocs: TrainingDoc[] }) {
  const [docs, setDocs]       = useState<TrainingDoc[]>(initialDocs);
  const [editDoc, setEditDoc] = useState<Partial<TrainingDoc> | null>(null);
  const [saving, setSaving]   = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterCat, setFilterCat] = useState('all');

  const filtered = filterCat === 'all' ? docs : docs.filter(d => d.category === filterCat);

  async function saveDoc() {
    if (!editDoc?.title?.trim() || !editDoc?.content?.trim()) {
      toast.error('Title and content are required'); return;
    }
    setSaving(true);
    const isNew = !editDoc.id;
    const res = isNew
      ? await fetch('/api/admin/ai-training', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDoc) })
      : await fetch(`/api/admin/ai-training/${editDoc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDoc) });
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
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !doc.is_active }),
    });
    if (res.ok) setDocs(ds => ds.map(d => d.id === doc.id ? { ...d, is_active: !doc.is_active } : d));
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/ai-training/${deleteId}`, { method: 'DELETE' });
    if (res.ok) { setDocs(ds => ds.filter(d => d.id !== deleteId)); toast.success('Doc deleted'); }
    setDeleteId(null);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-700">AI Knowledge Base</p>
          <p className="text-xs text-slate-400 mt-0.5">Active documents are injected into every AI response as context.</p>
        </div>
        <button onClick={() => setEditDoc({ category: 'general', is_active: true })} className="h-8 px-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-1.5">
          <Plus className="size-3.5" /> Add Doc
        </button>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {['all', 'brand_guidelines', 'client_info', 'workflow', 'creative_direction', 'general'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCat(cat)}
            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-colors ${
              filterCat === cat
                ? 'border-blue-400/60 bg-blue-500/10 text-blue-700'
                : 'border-white/40 bg-white/30 text-slate-500 hover:bg-white/50'
            }`}
          >
            {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            <span className="ml-1 opacity-60">({cat === 'all' ? docs.length : docs.filter(d => d.category === cat).length})</span>
          </button>
        ))}
      </div>

      {filterCat !== 'all' && (
        <p className="text-[10px] text-slate-400 italic px-1">{CATEGORY_DESCRIPTIONS[filterCat]}</p>
      )}

      {/* Doc list */}
      {filtered.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center border-dashed text-sm text-slate-400">
          No documents yet.{' '}
          <button className="underline hover:text-slate-600" onClick={() => setEditDoc({ category: filterCat === 'all' ? 'general' : filterCat, is_active: true })}>
            Add the first one
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(doc => (
            <div key={doc.id} className={`glass-panel rounded-xl p-4 transition-opacity ${doc.is_active ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{doc.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-400/20">
                      {CATEGORY_LABELS[doc.category] ?? doc.category}
                    </span>
                    {!doc.is_active && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 border border-red-400/20">Disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 whitespace-pre-wrap">{doc.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleActive(doc)} title={doc.is_active ? 'Disable' : 'Enable'} className="transition-colors">
                    {doc.is_active
                      ? <ToggleRight className="size-6 text-emerald-500" />
                      : <ToggleLeft className="size-6 text-slate-300" />}
                  </button>
                  <button onClick={() => setEditDoc({ ...doc })} className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-500/10 transition-colors">
                    <Pencil className="size-3.5" />
                  </button>
                  <button onClick={() => setDeleteId(doc.id)} className="size-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/create modal */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl border border-white/50 mx-4" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
            <h2 className="text-sm font-bold text-slate-800 mb-4">{editDoc?.id ? 'Edit Knowledge Document' : 'Add Knowledge Document'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Title *</label>
                  <input
                    value={editDoc?.title ?? ''}
                    onChange={e => setEditDoc(d => d ? { ...d, title: e.target.value } : d)}
                    placeholder="Bardbox Studio Brand Voice"
                    className="w-full h-8 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Category</label>
                  <select
                    value={editDoc?.category ?? 'general'}
                    onChange={e => setEditDoc(d => d ? { ...d, category: e.target.value } : d)}
                    className="w-full h-8 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">Content *</label>
                <p className="text-[10px] text-slate-400 mb-1">Write everything you want the AI to know. Be specific — the AI will use this verbatim as context.</p>
                <textarea
                  value={editDoc?.content ?? ''}
                  onChange={e => setEditDoc(d => d ? { ...d, content: e.target.value } : d)}
                  placeholder={`Example:\n- Brand tone: professional but approachable\n- Primary colors: deep blue #1A2E5C, gold #C8A951`}
                  rows={8}
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 font-mono leading-relaxed resize-none"
                />
                <p className="text-[10px] text-slate-400 text-right mt-0.5">{editDoc?.content?.length ?? 0} chars</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setEditDoc(null)} className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={saveDoc} disabled={saving} className="h-8 px-4 rounded-full text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : editDoc?.id ? 'Update' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-white/50" style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
            <h2 className="text-sm font-bold text-slate-800 mb-1">Delete this document?</h2>
            <p className="text-xs text-slate-500 mb-5">The AI will no longer have access to this knowledge. This cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="h-8 px-4 rounded-full text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button onClick={confirmDelete} className="h-8 px-4 rounded-full text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
