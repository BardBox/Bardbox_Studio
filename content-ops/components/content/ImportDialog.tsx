'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'tabs' | 'context' | 'mapping' | 'confirm';

const PLATFORMS = ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube', 'tiktok', 'other'];
const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'graphic', 'other'];

const MAPPING_FIELDS = [
  { key: 'posting_date', label: 'Posting Date *', required: true },
  { key: 'content_type', label: 'Content Type', required: false },
  { key: 'brief', label: 'Brief / Description', required: false },
  { key: 'caption', label: 'Caption / Copy', required: false },
  { key: 'hashtags', label: 'Hashtags', required: false },
  { key: 'posting_time', label: 'Posting Time', required: false },
];

interface Client { id: string; name: string; is_active: boolean }

export function ImportDialog({ open, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Tab selection
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');

  // Context
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Mapping
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiNotes, setAiNotes] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(false);

  const NONE = '__none__';

  // Load clients on open
  useEffect(() => {
    if (!open) return;
    fetch('/api/clients').then(r => r.json()).then((data: Client[]) => {
      setClients(Array.isArray(data) ? data.filter(c => c.is_active) : []);
    }).catch(() => {});
  }, [open]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result;
      if (!buf) return;
      const wb = XLSX.read(buf, { type: 'array' });
      const names = wb.SheetNames;
      setSheetNames(names);

      if (names.length > 1) {
        setSelectedTab(names[0]);
        setStep('tabs');
      } else {
        setSelectedTab(names[0] ?? '');
        setStep('context');
      }
    };
    reader.readAsArrayBuffer(f);
  }

  function loadSheetData(tabName: string) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const buf = ev.target?.result;
      if (!buf) return;
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[tabName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (rows.length === 0) { toast.error('Selected sheet appears empty.'); return; }
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setPreview(rows.slice(0, 5));

      // Call AI mapping
      setAiLoading(true);
      try {
        const res = await fetch('/api/ai/map-columns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ headers: hdrs, sample_rows: rows.slice(0, 3) }),
        });
        const data = await res.json();
        if (data.mapping) {
          const cleaned: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.mapping)) {
            if (v && typeof v === 'string') cleaned[k] = v;
          }
          setMapping(cleaned);
          setAiNotes(data.notes ?? {});
        }
      } catch {
        // silently fall back to empty mapping
      } finally {
        setAiLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function proceedToMapping() {
    loadSheetData(selectedTab);
    setStep('mapping');
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function setMap(field: string, col: string) {
    setMapping(prev => {
      const next = { ...prev };
      if (col === NONE) { delete next[field]; } else { next[field] = col; }
      return next;
    });
  }

  const canProceedFromContext = selectedClient && selectedPlatforms.length > 0;
  const canImport = mapping.posting_date && selectedClient && selectedPlatforms.length > 0;

  // Row count for the selected tab
  const rowCount = preview.length > 0 ? preview.length : 0;

  async function handleImport() {
    if (!file || !canImport) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('client_name', selectedClient);
      fd.append('platforms', JSON.stringify(selectedPlatforms));
      fd.append('tab_name', selectedTab);

      const res = await fetch('/api/content/import', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? 'Import failed');
      toast.success(`Imported ${json.created} rows. Open the Content page to create tasks.`);
      router.refresh();
      resetAndClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  function resetAndClose() {
    setStep('upload');
    setFile(null);
    setSheetNames([]);
    setSelectedTab('');
    setSelectedClient('');
    setSelectedPlatforms([]);
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setAiNotes({});
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetAndClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Content from CSV / Excel</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          {(['upload', 'context', 'mapping', 'confirm'] as const).map((s, i) => (
            <span key={s} className="flex items-center gap-1">
              {i > 0 && <span>›</span>}
              <span className={step === s || (s === 'context' && step === 'tabs') ? 'text-foreground font-medium' : ''}>
                {s === 'upload' ? 'Upload' : s === 'context' ? 'Context' : s === 'mapping' ? 'Map Columns' : 'Import'}
              </span>
            </span>
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> file.
              AI will auto-map columns. Required: a posting date column.
            </p>
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <p className="text-muted-foreground text-sm">Click to choose a file</p>
              <p className="text-xs text-muted-foreground mt-1">CSV · XLSX · XLS</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        )}

        {/* ── Step 1b: Tab picker (multi-sheet workbooks) ── */}
        {step === 'tabs' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <strong>{file?.name}</strong> has multiple sheets. Select which one to import.
            </p>
            <div className="grid gap-2">
              {sheetNames.map(name => (
                <label
                  key={name}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedTab === name ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="tab"
                    value={name}
                    checked={selectedTab === name}
                    onChange={() => setSelectedTab(name)}
                    className="accent-primary"
                  />
                  <span className="text-sm font-medium">{name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Context (client + platforms) ── */}
        {step === 'context' && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
              Set the client and platform(s) for <strong>{file?.name}</strong>
              {selectedTab ? ` › ${selectedTab}` : ''}. These apply to all rows.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Client *</Label>
              <Select value={selectedClient || NONE} onValueChange={v => setSelectedClient(!v || v === NONE ? '' : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select client…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— select client —</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Platform(s) * <span className="text-muted-foreground font-normal">— select all that apply</span></Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                      selectedPlatforms.includes(p)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {selectedPlatforms.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedPlatforms.length > 1
                    ? `Each row will be duplicated for: ${selectedPlatforms.join(', ')}`
                    : `Platform: ${selectedPlatforms[0]}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: AI Column Mapping ── */}
        {step === 'mapping' && (
          <div className="space-y-5">
            {aiLoading ? (
              <div className="flex items-center gap-3 py-6 justify-center">
                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">AI is mapping your columns…</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">✨ AI mapped</span>
                  <p className="text-sm text-muted-foreground">Review and adjust if needed.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {MAPPING_FIELDS.map(({ key, label }) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">{label}</Label>
                        {aiNotes[key] && (
                          <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]" title={aiNotes[key]}>
                            {aiNotes[key]}
                          </span>
                        )}
                      </div>
                      <Select
                        value={mapping[key] ?? NONE}
                        onValueChange={(v) => setMap(key, v ?? NONE) }
                      >
                        <SelectTrigger className={`text-xs h-8 ${mapping[key] ? 'border-primary/50' : ''}`}>
                          <SelectValue placeholder="— skip —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>— skip —</SelectItem>
                          {headers.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                {preview.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Preview — first {Math.min(preview.length, 5)} rows
                    </p>
                    <div className="overflow-x-auto rounded-lg border text-xs">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr>
                            {headers.map(h => (
                              <th key={h} className={`px-3 py-1.5 text-left font-medium whitespace-nowrap ${
                                Object.values(mapping).includes(h) ? 'text-primary' : 'text-muted-foreground'
                              }`}>
                                {h}
                                {Object.values(mapping).includes(h) && (
                                  <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1 rounded">
                                    {Object.entries(mapping).find(([, v]) => v === h)?.[0]}
                                  </span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.map((row, i) => (
                            <tr key={i}>
                              {headers.map(h => (
                                <td key={h} className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate">
                                  {String(row[h] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm ── */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Ready to import</p>
            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File</span>
                <span className="font-medium">{file?.name}</span>
              </div>
              {selectedTab && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sheet</span>
                  <span>{selectedTab}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span>{selectedClient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform(s)</span>
                <div className="flex gap-1">
                  {selectedPlatforms.map(p => (
                    <Badge key={p} variant="secondary" className="capitalize text-xs">{p}</Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mapped columns</span>
                <span>{Object.keys(mapping).length} / {MAPPING_FIELDS.length}</span>
              </div>
              {selectedPlatforms.length > 1 && (
                <p className="text-xs text-muted-foreground pt-1 border-t">
                  Each row will create {selectedPlatforms.length} content items (one per platform).
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Tasks will <strong>not</strong> be created automatically. Go to the Content page after import to create tasks for selected rows.
            </p>
          </div>
        )}

        {/* ── Footer buttons ── */}
        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={resetAndClose}>Cancel</Button>
          )}

          {step === 'tabs' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('context')}>Next</Button>
            </>
          )}

          {step === 'context' && (
            <>
              <Button variant="outline" onClick={() => sheetNames.length > 1 ? setStep('tabs') : setStep('upload')}>
                Back
              </Button>
              <Button disabled={!canProceedFromContext} onClick={proceedToMapping}>
                Next — Map Columns
              </Button>
            </>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('context')}>Back</Button>
              <Button
                disabled={!canImport || aiLoading}
                onClick={() => setStep('confirm')}
              >
                Review Import
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>Back</Button>
              <Button disabled={loading} onClick={handleImport}>
                {loading ? 'Importing…' : 'Import'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
