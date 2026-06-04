'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { AlertTriangle, Download } from 'lucide-react';
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

const CONTENT_TYPES = ['post', 'reel', 'story', 'carousel', 'video', 'graphic', 'other'];

const MAPPING_FIELDS = [
  { key: 'posting_date', label: 'Posting Date *', required: true },
  { key: 'content_type', label: 'Content Type', required: false },
  { key: 'brief', label: 'Task Name / Brief', required: false },
  { key: 'caption', label: 'Caption / Copy', required: false },
  { key: 'hashtags', label: 'Hashtags', required: false },
  { key: 'posting_time', label: 'Deadline', required: false },
  { key: 'priority', label: 'Priority', required: false },
];

// Fixed column names matching the Bardbox SMO content calendar format.
const TEMPLATE_COLUMN_MAP: Record<string, string> = {
  posting_date:  'Post Date',
  content_type:  'Type',
  brief:         'Task Name',
  caption:       'Caption',
  hashtags:      'Hashtags',
  posting_time:  'Deadline',
  priority:      'Priority',
};
const TEMPLATE_REQUIRED = ['Post Date', 'Type', 'Task Name'] as const;

interface Client { id: string; name: string; is_active: boolean }

export function ImportDialog({ open, onClose }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);

  // Tab selection
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>('');
  // Multi-tab import: sheet name → client name mapping
  const [importAllTabs, setImportAllTabs] = useState(false);
  const [tabClientMap, setTabClientMap] = useState<Record<string, string>>({});

  // Production schedule auto-detection
  const [isProductionSchedule, setIsProductionSchedule] = useState(false);
  const [isTemplateFormat, setIsTemplateFormat] = useState(false);
  const [headerRow, setHeaderRow] = useState(0);

  // Context
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');

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
    const KEYWORDS = new Set(['#', 'date', 'post date', 'creative', 'idea', 'task name', 'caption', 'status', 'type', 'brief', 'platform', 'mention', 'reference', 'sr', 'priority']);
    for (let i = 0; i < Math.min(6, allRows.length); i++) {
      const hits = allRows[i].filter(c => KEYWORDS.has(String(c ?? '').trim().toLowerCase())).length;
      if (hits >= 3) return i;
    }
    return 0;
  }


  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buf = ev.target?.result;
      if (!buf) return;
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
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
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });

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

      // Non-template: show mismatch error — no AI mapping
    };
    reader.readAsArrayBuffer(file);
  }

  function proceedToMapping() {
    // For multi-tab import, sample the first sheet for header/mapping detection
    const tabToSample = importAllTabs ? (sheetNames[0] ?? '') : selectedTab;
    if (tabToSample) loadSheetData(tabToSample);
    setStep('mapping');
  }

  function setMap(field: string, col: string) {
    setMapping(prev => {
      const next = { ...prev };
      if (col === NONE) { delete next[field]; } else { next[field] = col; }
      return next;
    });
  }

  const canProceedFromContext = importAllTabs
    ? Object.values(tabClientMap).every(v => v.trim())
    : isProductionSchedule
      ? true
      : !!(selectedClient);
  const canImport = importAllTabs
    ? Object.values(tabClientMap).every(v => v.trim()) && !!(mapping.posting_date || isProductionSchedule)
    : isProductionSchedule
      ? true
      : !!(mapping.posting_date && selectedClient);

  // Row count for the selected tab
  const rowCount = preview.length > 0 ? preview.length : 0;

  async function handleImport() {
    if (!file || !canImport) return;
    setLoading(true);
    try {
      if (importAllTabs) {
        // Import each sheet as a separate client
        const sheets = Object.entries(tabClientMap);
        let totalCreated = 0;
        const failures: string[] = [];
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        for (const [tabName, clientName] of sheets) {
          const isProd = detectProductionSchedule(wb, tabName);
          const fd = new FormData();
          fd.append('file', file);
          fd.append('mapping', JSON.stringify(mapping));
          fd.append('client_name', clientName.trim());
          fd.append('tab_name', tabName);
          fd.append('header_row', String(headerRow));
          if (isProd) fd.append('is_production_schedule', 'true');
          const res = await fetch('/api/content/import', { method: 'POST', body: fd });
          const json = await res.json().catch(() => ({}));
          if (res.ok) {
            totalCreated += json.created ?? 0;
          } else {
            failures.push(`${clientName}: ${json.error ?? 'failed'}`);
          }
        }
        if (failures.length > 0) {
          toast.warning(`Imported ${totalCreated} rows. ${failures.length} sheet(s) had errors.`);
        } else {
          toast.success(`Imported ${totalCreated} rows across ${sheets.length} clients.`);
        }
      } else {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('mapping', JSON.stringify(mapping));
        fd.append('client_name', selectedClient || '__from_file__');
        fd.append('tab_name', selectedTab);
        fd.append('header_row', String(headerRow));
        if (isProductionSchedule) fd.append('is_production_schedule', 'true');
        const res = await fetch('/api/content/import', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? 'Import failed');
        toast.success(`Imported ${json.created} rows. Open the Content page to create tasks.`);
      }
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
    setImportAllTabs(false);
    setTabClientMap({});
    setIsProductionSchedule(false);
    setIsTemplateFormat(false);
    setHeaderRow(0);
    setSelectedClient('');
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
              <a
                href="/api/admin/export/template"
                download
                className="shrink-0 flex items-center gap-1.5 text-xs text-primary border border-primary/40 rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Download Template
              </a>
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
            {/* Mode toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImportAllTabs(false)}
                className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
                  !importAllTabs ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-muted-foreground text-muted-foreground'
                }`}
              >
                <div className="font-medium mb-0.5">Single sheet</div>
                <div className="text-xs text-muted-foreground">Pick one tab to import</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportAllTabs(true);
                  const map: Record<string, string> = {};
                  sheetNames.forEach(n => {
                    const match = clients.find(c => c.name.toLowerCase() === n.toLowerCase());
                    map[n] = match?.name ?? '';
                  });
                  setTabClientMap(map);
                }}
                className={`rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
                  importAllTabs ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:border-muted-foreground text-muted-foreground'
                }`}
              >
                <div className="font-medium mb-0.5">All sheets — multi-client</div>
                <div className="text-xs text-muted-foreground">Each tab = one client</div>
              </button>
            </div>

            {!importAllTabs ? (
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">Select the sheet to import:</p>
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
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Each sheet will be imported as a separate client. Edit client names if needed:
                </p>
                <div className="grid gap-2">
                  {sheetNames.map(name => (
                    <div key={name} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                      <span className="text-xs text-muted-foreground font-mono w-36 shrink-0 truncate" title={name}>
                        {name}
                      </span>
                      <span className="text-muted-foreground/40 text-xs shrink-0">→</span>
                      <Select
                        value={tabClientMap[name] ?? ''}
                        onValueChange={v => setTabClientMap(prev => ({ ...prev, [name]: v }))}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Select client…" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map(c => (
                            <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Context (client) ── */}
        {step === 'context' && (
          <div className="space-y-5">
            {importAllTabs ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                  <span className="text-primary font-semibold shrink-0">✦</span>
                  <p className="text-muted-foreground">
                    <strong className="text-foreground">Multi-client import.</strong>{' '}
                    {Object.keys(tabClientMap).length} sheets will be imported as separate clients.
                  </p>
                </div>
                <div className="rounded-lg border divide-y text-sm">
                  {Object.entries(tabClientMap).map(([tab, client]) => (
                    <div key={tab} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground text-xs font-mono">{tab}</span>
                      <span className="font-medium">{client}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : isProductionSchedule ? (
              <div className="flex items-start gap-2 text-sm rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
                <span className="text-primary font-semibold shrink-0">✦</span>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Production schedule detected.</strong>{' '}
                  Clients and content types will be read directly from the file.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Set the client for <strong>{file?.name}</strong>
                  {selectedTab ? ` › ${selectedTab}` : ''}.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs">Client *</Label>
                  <Select value={selectedClient || ''} onValueChange={v => setSelectedClient(v || '')}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
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
            ) : (
              /* ── Template mismatch: file doesn't match Bardbox format ── */
              <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-destructive">File doesn't match the Bardbox template</p>
                    <p className="text-sm text-muted-foreground">
                      Your file has columns we don't recognise. Download the Bardbox template, fill it in, and re-upload.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Required columns</p>
                  <div className="flex flex-wrap gap-2">
                    {['#', 'Post Date', 'Type', 'Task Name', 'Priority', 'Caption', 'Hashtags', 'Deadline'].map(col => (
                      <span
                        key={col}
                        className={`text-xs px-2.5 py-1 rounded-md font-mono border ${
                          ['Post Date', 'Type', 'Task Name'].includes(col)
                            ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                            : 'bg-muted border-border text-muted-foreground'
                        }`}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-primary font-medium">Bold</span> columns are required. Others are optional.
                  </p>
                </div>

                <a
                  href="/api/admin/export/template"
                  download
                  className="flex items-center justify-center gap-2 w-full rounded-lg border-2 border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary font-medium text-sm py-3 transition-colors"
                >
                  <Download className="size-4" />
                  Download Bardbox Template
                </a>
              </div>
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
                {importAllTabs ? (
                  <span className="text-xs text-right">
                    {Object.values(tabClientMap).join(', ')}
                  </span>
                ) : isProductionSchedule ? (
                  <span className="text-muted-foreground italic">from file</span>
                ) : (
                  <span>{selectedClient}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mapped columns</span>
                <span>{Object.keys(mapping).length} / {MAPPING_FIELDS.length}</span>
              </div>
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
              <Button
                disabled={importAllTabs && Object.values(tabClientMap).some(v => !v.trim())}
                onClick={() => importAllTabs ? proceedToMapping() : setStep('context')}
              >
                {importAllTabs
                  ? `Import ${Object.keys(tabClientMap).length} sheets`
                  : 'Next'}
              </Button>
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
              {(isTemplateFormat || isProductionSchedule) && (
                <Button disabled={!canImport} onClick={() => setStep('confirm')}>
                  Review Import
                </Button>
              )}
              {!isTemplateFormat && !isProductionSchedule && (
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Upload Different File
                </Button>
              )}
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
