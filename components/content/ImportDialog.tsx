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
  { key: 'priority', label: 'Priority', required: false },
];

// Fixed column names matching the Bardbox SMO content calendar format.
// Extra columns in the file (Mention Work, Status, Live link, etc.) are ignored automatically.
const TEMPLATE_COLUMN_MAP: Record<string, string> = {
  posting_date:  'Date',
  content_type:  'Creative',
  brief:         'Idea',
  caption:       'Caption',
  hashtags:      'Hashtags',
  posting_time:  'Posting Time',
  priority:      'Priority',
};
const TEMPLATE_REQUIRED = ['Date', 'Creative', 'Idea'] as const;

interface Client { id: string; name: string; is_active: boolean }

export function ImportDialog({ open, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Tab selection
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');

  // Production schedule auto-detection
  const [isProductionSchedule, setIsProductionSchedule] = useState(false);
  const [isTemplateFormat, setIsTemplateFormat] = useState(false);
  const [headerRow, setHeaderRow] = useState(0);

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

  // Detect multi-designer production schedule format:
  // Looks for a header row where col[0]="Date" and "Task" appears 2+ times.
  function detectProductionSchedule(wb: XLSX.WorkBook, sheetName: string): boolean {
    const ws = wb.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
    for (let i = 0; i < Math.min(10, allRows.length); i++) {
      const row = allRows[i];
      if (String(row[0] ?? '').trim().toLowerCase() === 'date') {
        const taskCount = row.filter(c => String(c).trim().toLowerCase() === 'task').length;
        if (taskCount >= 2) return true;
      }
    }
    return false;
  }

  // Find actual header row by looking for first row with 3+ recognised column keywords.
  // Skips title rows like "BIZCIVITAS (MAY - JUNE)" that appear above the real headers.
  function findHeaderRow(ws: XLSX.WorkSheet): number {
    const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
    const KEYWORDS = new Set(['#', 'date', 'creative', 'idea', 'caption', 'status', 'type', 'brief', 'platform', 'mention', 'reference', 'sr', 'priority']);
    for (let i = 0; i < Math.min(6, allRows.length); i++) {
      const hits = allRows[i].filter(c => KEYWORDS.has(String(c ?? '').trim().toLowerCase())).length;
      if (hits >= 3) return i;
    }
    return 0;
  }

  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['#', 'Date', 'Creative', 'Idea', 'Caption', 'Mention Work', 'Hashtags', 'Status', 'Posting Time', 'Priority'],
      [1, '2026-06-01', 'Reel', 'Hook idea for this reel', 'Your caption goes here...', '', '#brand #social', 'Undone', '10:00', 'medium'],
      [2, '2026-06-02', 'Carousel', 'Topic for the carousel slides', '', '', '', 'Undone', '', 'high'],
      ['', '', 'Image', 'Quote post same day', '', '', '', 'Undone', '', 'low'],
      [3, '2026-06-03', 'Reel', 'Another reel idea', 'Caption...', '', '', 'Undone', '', 'emergency'],
    ]);
    ws['!cols'] = [
      { wch: 4 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 40 },
      { wch: 14 }, { wch: 25 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'June - 2026');
    XLSX.writeFile(wb, 'bardbox_content_template.xlsx');
  }

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

      const firstSheet = names[0] ?? '';
      setIsProductionSchedule(detectProductionSchedule(wb, firstSheet));

      if (names.length > 1) {
        setSelectedTab(firstSheet);
        setStep('tabs');
      } else {
        setSelectedTab(firstSheet);
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

      // Re-detect on the actual selected tab (may differ from first sheet)
      const isProdSched = detectProductionSchedule(wb, tabName);
      setIsProductionSchedule(isProdSched);

      if (isProdSched) {
        // Production schedule: no manual column mapping needed
        setHeaders([]);
        setPreview([]);
        setMapping({});
        setAiNotes({});
        return;
      }

      // Standard flat-table flow
      const ws = wb.Sheets[tabName];
      const hdrIdx = findHeaderRow(ws);
      setHeaderRow(hdrIdx);
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', range: hdrIdx });
      if (rows.length === 0) { toast.error('Selected sheet appears empty.'); return; }
      const hdrs = Object.keys(rows[0]);
      setHeaders(hdrs);
      setPreview(rows.slice(0, 5));

      // Fast-path: Bardbox standard template — all required columns present, no AI needed
      const hdrSet = new Set(hdrs);
      const isTmpl = TEMPLATE_REQUIRED.every(h => hdrSet.has(h));
      setIsTemplateFormat(isTmpl);
      if (isTmpl) {
        setMapping(TEMPLATE_COLUMN_MAP);
        setAiNotes({});
        return;
      }

      // Call AI mapping for non-template sheets
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

  const canProceedFromContext = isProductionSchedule
    ? selectedPlatforms.length > 0
    : !!(selectedClient && selectedPlatforms.length > 0);
  const canImport = isProductionSchedule
    ? selectedPlatforms.length > 0
    : !!(mapping.posting_date && selectedClient && selectedPlatforms.length > 0);

  // Row count for the selected tab
  const rowCount = preview.length > 0 ? preview.length : 0;

  async function handleImport() {
    if (!file || !canImport) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('mapping', JSON.stringify(mapping));
      fd.append('client_name', selectedClient || '__from_file__');
      fd.append('platforms', JSON.stringify(selectedPlatforms));
      fd.append('tab_name', selectedTab);
      fd.append('header_row', String(headerRow));
      if (isProductionSchedule) fd.append('is_production_schedule', 'true');

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
    setIsProductionSchedule(false);
    setIsTemplateFormat(false);
    setHeaderRow(0);
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
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Upload a <strong>.csv</strong>, <strong>.xlsx</strong>, or <strong>.xls</strong> file.
                Use the Bardbox template for instant import — no column mapping needed.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="shrink-0 flex items-center gap-1.5 text-xs text-primary border border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors whitespace-nowrap"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template
              </button>
            </div>
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
            {isProductionSchedule ? (
              <div className="flex items-start gap-2 text-sm rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                <span className="text-primary font-semibold shrink-0">✦</span>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Production schedule detected.</strong>{' '}
                  Clients and content types will be read directly from the file. Just pick the platform(s) to apply.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}

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
            {isProductionSchedule ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">✦ Auto-detected</span>
                  <p className="text-sm text-muted-foreground">Production schedule — no manual mapping needed.</p>
                </div>
                <div className="rounded-lg border divide-y text-sm">
                  {[
                    ['Posting Date', '"Post Date" column per designer section (falls back to production date)'],
                    ['Client', 'Read from "Client" column in each section'],
                    ['Content Type', 'Normalised from "Type" column (Reel, Carousel, Static, Video…)'],
                    ['Brief', '"Task" title used as the creative brief'],
                    ['Platform', `Set by you: ${selectedPlatforms.join(', ') || '—'}`],
                  ].map(([field, source]) => (
                    <div key={field} className="flex gap-3 px-3 py-2">
                      <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{field}</span>
                      <span className="text-xs text-foreground">{source}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rows with no valid date, empty task names, or "LEAVE" entries will be skipped automatically.
                </p>
              </div>
            ) : isTemplateFormat ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">✓ Bardbox template</span>
                  <p className="text-sm text-muted-foreground">Standard template detected — ready to import.</p>
                </div>
                <div className="rounded-lg border divide-y text-sm">
                  {Object.entries(TEMPLATE_COLUMN_MAP).map(([field, col]) => {
                    const label = MAPPING_FIELDS.find(f => f.key === field)?.label.replace(' *', '') ?? field;
                    return (
                      <div key={field} className="flex gap-3 px-3 py-2">
                        <span className="w-28 shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
                        <span className="text-xs text-foreground font-mono">{col}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rows with an empty Date will inherit the date from the row above. Rows with no date at all are skipped.
                </p>
              </div>
            ) : aiLoading ? (
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
                <span className="text-muted-foreground">Format</span>
                <span className="text-xs">
                  {isProductionSchedule ? 'Production schedule' : isTemplateFormat ? 'Bardbox template' : 'Custom mapping'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <span>{isProductionSchedule ? <span className="text-muted-foreground italic">from file</span> : selectedClient}</span>
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
