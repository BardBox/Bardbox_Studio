import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

function str(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function excelDateToISO(serial: unknown): string {
  if (typeof serial === 'number') {
    const date = XLSX.SSF.parse_date_code(serial);
    const y = date.y;
    const m = String(date.m).padStart(2, '0');
    const d = String(date.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return str(serial);
}

// Parse human-readable dates like "4 May", "4 May 2026", "1 Sept 2025"
function parseDateToken(raw: string, yearHint: number): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const MONTHS: Record<string, number> = {
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  };
  const m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})(?:\s+(\d{4}))?/);
  if (!m) return null;
  const day = parseInt(m[1]);
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  const year = m[3] ? parseInt(m[3]) : yearHint;
  if (!mon || day < 1 || day > 31) return null;
  return `${year}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// Normalise content type from labels like "[RL] Reel", "[CR] Carousel", etc.
function normaliseType(raw: string): string {
  const t = raw.toLowerCase();
  if (t.includes('reel') || t.includes('[rl]')) return 'reel';
  if (t.includes('carousel') || t.includes('[cr]')) return 'carousel';
  if (t.includes('static') || t.includes('[sp]')) return 'post';
  if (t.includes('long video') || t.includes('[wl]') || t.includes('[sv]') ||
      t.includes('[bw]') || t.includes('[biz]') || t.includes('outro') ||
      t.includes('video')) return 'video';
  return 'post';
}

type InsertRow = {
  client_name: string | null;
  platform: string;
  content_type: string;
  brief: string | null;
  caption: string | null;
  hashtags: string | null;
  posting_date: string;
  posting_time: string;
  priority: 'low' | 'medium' | 'high' | 'emergency';
  source: 'import';
  created_by: string;
  auto_create_tasks: false;
};

function normalisePriority(raw: string): 'low' | 'medium' | 'high' | 'emergency' {
  const s = raw.trim().toLowerCase();
  if (s === 'emergency' || s === 'urgent' || s === 'critical') return 'emergency';
  if (s === 'high' || s === 'important') return 'high';
  if (s === 'low') return 'low';
  return 'medium';
}

// Parse a multi-designer production schedule (3 designer sections side by side).
// Detects the header row by looking for a row where col[0]="Date" and "Task" appears 2+ times.
function parseProductionSchedule(
  workbook: XLSX.WorkBook,
  sheetName: string,
  platforms: string[],
  userId: string,
): InsertRow[] {
  const ws = workbook.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

  // Extract year hint from first few rows (e.g. "May 2026")
  let yearHint = new Date().getFullYear();
  for (let i = 0; i < Math.min(5, allRows.length); i++) {
    const rowStr = JSON.stringify(allRows[i]);
    const m = rowStr.match(/20(\d{2})/);
    if (m) { yearHint = parseInt('20' + m[1]); break; }
  }

  // Find the header row: first row where col[0].trim().toLowerCase() === 'date'
  // and 'task' appears in 2+ columns.
  let headerRowIdx = -1;
  let headerRow: unknown[] = [];
  for (let i = 0; i < Math.min(12, allRows.length); i++) {
    const row = allRows[i];
    if (String(row[0] ?? '').trim().toLowerCase() !== 'date') continue;
    const taskCount = row.filter(c => String(c).trim().toLowerCase() === 'task').length;
    if (taskCount >= 2) { headerRowIdx = i; headerRow = row; break; }
  }
  if (headerRowIdx === -1) return [];

  // Find where each designer section starts (column index of each "Task" header)
  const sectionStarts: number[] = [];
  for (let col = 0; col < headerRow.length; col++) {
    if (String(headerRow[col]).trim().toLowerCase() === 'task') sectionStarts.push(col);
  }

  // Within each section header row, find offsets for Client, Type, Post Date
  function colOffset(sectionStart: number, fieldName: string): number {
    const fn = fieldName.toLowerCase().replace(/\s/g, '');
    for (let off = 0; off < 8; off++) {
      const cell = String(headerRow[sectionStart + off] ?? '').toLowerCase().replace(/\s/g, '');
      if (cell === fn) return off;
    }
    return -1;
  }

  // Build per-section offsets (same layout expected for all sections)
  const offsets = sectionStarts.map(start => ({
    start,
    client:   colOffset(start, 'client'),
    type:     colOffset(start, 'type'),
    postDate: colOffset(start, 'postdate'),
  }));

  const inserts: InsertRow[] = [];
  let currentProductionDate = '';

  for (let i = headerRowIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];

    // Update running production date from col[0] when present
    const dateCell = String(row[0] ?? '').trim();
    if (dateCell) {
      const parsed = parseDateToken(dateCell, yearHint);
      if (parsed) currentProductionDate = parsed;
    }

    for (const { start, client: cOff, type: tOff, postDate: pdOff } of offsets) {
      const task    = String(row[start] ?? '').trim();
      const client  = cOff  >= 0 ? String(row[start + cOff]  ?? '').trim() : '';
      const type    = tOff  >= 0 ? String(row[start + tOff]  ?? '').trim() : '';
      const pdRaw   = pdOff >= 0 ? String(row[start + pdOff] ?? '').trim() : '';

      // Skip empty, header repetitions, or LEAVE entries
      if (!task || task.toLowerCase() === 'task' || task.toLowerCase() === 'leave') continue;
      if (!client) continue;

      const postingDate = parseDateToken(pdRaw, yearHint) || currentProductionDate;
      if (!postingDate) continue;

      const contentType = normaliseType(type);

      for (const platform of platforms) {
        inserts.push({
          client_name:      client,
          platform:         platform.toLowerCase(),
          content_type:     contentType,
          brief:            task,
          caption:          null,
          hashtags:         null,
          posting_date:     postingDate,
          posting_time:     '10:00:00',
          priority:         'medium',
          source:           'import',
          created_by:       userId,
          auto_create_tasks: false,
        });
      }
    }
  }

  return inserts;
}

interface ColumnMap {
  posting_date: string;
  content_type?: string;
  brief?: string;
  caption?: string;
  hashtags?: string;
  posting_time?: string;
  priority?: string;
}

export async function POST(req: NextRequest) {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['manager', 'admin', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });

  const file = formData.get('file') as File | null;
  const mappingRaw = formData.get('mapping') as string | null;
  const clientName = formData.get('client_name') as string | null;
  const platformsRaw = formData.get('platforms') as string | null;
  const tabName = formData.get('tab_name') as string | null;
  const headerRowRaw = formData.get('header_row') as string | null;
  const headerRowIdx = headerRowRaw ? (parseInt(headerRowRaw) || 0) : 0;
  const isProductionSchedule = formData.get('is_production_schedule') === 'true';

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  let platforms: string[] = [];
  if (platformsRaw) {
    try { platforms = JSON.parse(platformsRaw); } catch { platforms = [platformsRaw]; }
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'platforms[] required' }, { status: 400 });
  }

  // Parse file
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  const sheetName = (tabName && workbook.SheetNames.includes(tabName))
    ? tabName
    : workbook.SheetNames[0];

  let inserts: InsertRow[] = [];

  if (isProductionSchedule) {
    // Multi-section production schedule — auto-parse, clients come from file
    inserts = parseProductionSchedule(workbook, sheetName, platforms, user.id);
    if (inserts.length === 0) {
      return NextResponse.json({ error: 'No valid rows found in production schedule. Check the file format.' }, { status: 400 });
    }
  } else {
    // Standard flat-table import — requires column mapping
    if (!mappingRaw) return NextResponse.json({ error: 'No column mapping provided' }, { status: 400 });
    if (!clientName?.trim() || clientName.trim() === '__from_file__') {
      return NextResponse.json({ error: 'client_name required for standard import' }, { status: 400 });
    }

    let mapping: ColumnMap;
    try { mapping = JSON.parse(mappingRaw) as ColumnMap; } catch {
      return NextResponse.json({ error: 'Invalid mapping JSON' }, { status: 400 });
    }
    if (!mapping.posting_date) {
      return NextResponse.json({ error: 'Mapping must include posting_date' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', range: headerRowIdx });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no rows after the header' }, { status: 400 });
    }

    // Parse rows once with date carry-forward, then multiply by platform
    type FlatRow = {
      posting_date: string;
      content_type: string;
      brief: string | null;
      caption: string | null;
      hashtags: string | null;
      posting_time: string;
      priority: 'low' | 'medium' | 'high' | 'emergency';
    };
    const parsedRows: FlatRow[] = [];
    const yearHint = new Date().getFullYear();
    let lastValidDate = '';

    for (const row of rows) {
      const postingDateRaw = row[mapping.posting_date];
      let posting_date: string | null =
        typeof postingDateRaw === 'number'
          ? excelDateToISO(postingDateRaw)
          : parseDateToken(str(postingDateRaw), yearHint);

      if (!posting_date || !/^\d{4}-\d{2}-\d{2}$/.test(posting_date)) {
        posting_date = lastValidDate || null;
      }
      if (!posting_date) continue;
      lastValidDate = posting_date;

      parsedRows.push({
        posting_date,
        content_type: normaliseType(mapping.content_type ? str(row[mapping.content_type]) : ''),
        brief: mapping.brief ? str(row[mapping.brief]) || null : null,
        caption: mapping.caption ? str(row[mapping.caption]) || null : null,
        hashtags: mapping.hashtags ? str(row[mapping.hashtags]) || null : null,
        posting_time: mapping.posting_time ? str(row[mapping.posting_time]) || '10:00:00' : '10:00:00',
        priority: mapping.priority ? normalisePriority(str(row[mapping.priority])) : 'medium',
      });
    }

    for (const platform of platforms) {
      for (const r of parsedRows) {
        inserts.push({
          client_name: clientName.trim(),
          platform: platform.toLowerCase(),
          content_type: r.content_type,
          brief: r.brief,
          caption: r.caption,
          hashtags: r.hashtags,
          posting_date: r.posting_date,
          posting_time: r.posting_time,
          priority: r.priority,
          source: 'import' as const,
          created_by: user.id,
          auto_create_tasks: false,
        });
      }
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows found. Check posting dates are in a recognised format (e.g. "4 May" or "2026-05-04").' },
      { status: 400 }
    );
  }

  // Insert in batches of 100
  let created = 0;
  const errors: string[] = [];

  for (let i = 0; i < inserts.length; i += 100) {
    const batch = inserts.slice(i, i + 100);
    const { error } = await supabaseAdmin.from('content_rows').insert(batch);
    if (error) {
      errors.push(error.message);
    } else {
      created += batch.length;
    }
  }

  return NextResponse.json({
    created,
    total: inserts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
