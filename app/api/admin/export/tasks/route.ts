import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import ExcelJS from 'exceljs';

// content_type key → display label with prefix code
const TYPE_LABEL: Record<string, string> = {
  reel:        '[RL] Reel',
  carousel:    '[CR] Carousel',
  static:      '[SP] Static Post',
  story:       '[ST] Story',
  video:       '[WL] Long Video',
  youtube:     '[YT] YouTube',
  infographic: '[IG] Infographic',
  thumbnail:   '[TH] Thumbnail',
  flyer:       '[FL] Flyer',
  logo:        '[LG] Logo',
  reel_cover:  '[RC] Reel Cover',
  thread:      '[TW] Thread',
  linkedin:    '[LI] LinkedIn Post',
};

function typeLabel(raw: string): string {
  return TYPE_LABEL[raw.toLowerCase()] ?? raw;
}

// Consistent ARGB color per person name
const COLOR_PALETTE = [
  'FFD9E8', // pink
  'D9F0FF', // sky blue
  'D9FFE8', // mint
  'FFF3D9', // peach
  'EDD9FF', // lavender
  'FFE8D9', // light orange
  'CCFFCC', // bright green (Jignesh-like)
  'C8E6C9', // medium green (Dhairya-like)
  'D7CCC8', // light brown (Abhishek-like)
  'E1BEE7', // light purple
];

function nameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

const PRIORITY_FILL: Record<string, string> = {
  emergency: 'FF4444',
  high:      'FFB3B3',
  medium:    'FFF176',
  low:       'B9F6CA',
};

const PRIORITY_FONT: Record<string, string> = {
  emergency: 'FF0000',
  high:      'CC0000',
  medium:    'AA7700',
  low:       '1B5E20',
};

const STATUS_LABELS: Record<string, string> = {
  todo:          'Pending',
  working_on_it: 'In Progress',
  submitted:     'Submitted',
  approved:      'Approved',
  done:          'Done',
  blocked:       'Blocked',
  on_hold:       'On Hold',
};

// Format date as "20 May" to match screenshot
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !['admin', 'manager', 'ceo'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const month = searchParams.get('month'); // YYYY-MM
  const columnsParam = searchParams.get('columns');
  const clientFilter = searchParams.get('client') ?? null; // optional single-client filter
  const format = searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';

  const ALL_COLUMNS = ['task_name', 'designer', 'smo', 'type', 'platform', 'priority', 'post_date', 'status', 'script'];
  const activeColumns: string[] = columnsParam
    ? columnsParam.split(',').filter(c => ALL_COLUMNS.includes(c))
    : ['task_name', 'designer', 'type', 'priority', 'post_date', 'status'];

  // Date range
  let startDate: string, endDate: string, exportMonth: string;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    startDate   = `${month}-01`;
    endDate     = `${month}-${String(last).padStart(2, '0')}`;
    exportMonth = month;
  } else {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, now.getMonth() + 1, 0).getDate();
    startDate   = `${y}-${m}-01`;
    endDate     = `${y}-${m}-${String(last).padStart(2, '0')}`;
    exportMonth = `${y}-${m}`;
  }

  let taskQuery = supabaseAdmin
    .from('task_pipeline_health')
    .select('*')
    .gte('posting_date', startDate)
    .lte('posting_date', endDate)
    .order('posting_date', { ascending: true });

  if (clientFilter) taskQuery = taskQuery.eq('client_name', clientFilter);

  const { data: rawTasks, error } = await taskQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type ExcelRow = {
    brief:        string;
    client_name:  string;
    platform:     string;
    content_type: string;
    priority:     string;
    posting_date: string;
    designer:     string | null;
    smo:          string | null;
    status:       string;
  };

  // Combine design + post tasks → one row per content_row_id
  const rowMap = new Map<number, ExcelRow>();
  for (const t of rawTasks ?? []) {
    if (!rowMap.has(t.content_row_id)) {
      rowMap.set(t.content_row_id, {
        brief:        t.brief ?? '—',
        client_name:  t.client_name ?? 'Unknown',
        platform:     t.platform ?? '—',
        content_type: t.content_type ?? '—',
        priority:     t.priority ?? 'medium',
        posting_date: t.posting_date,
        designer:     null,
        smo:          null,
        status:       t.task_status ?? 'todo',
      });
    }
    const row = rowMap.get(t.content_row_id)!;
    if (t.task_type === 'design') {
      row.designer = t.assignee_name ?? null;
      row.status   = t.task_status ?? 'todo';
    } else if (t.task_type === 'post') {
      row.smo = t.assignee_name ?? null;
    }
  }

  // Group by client, sort by posting_date within each client
  const clientMap = new Map<string, ExcelRow[]>();
  for (const row of rowMap.values()) {
    const client = row.client_name;
    if (!clientMap.has(client)) clientMap.set(client, []);
    clientMap.get(client)!.push(row);
  }
  for (const rows of clientMap.values()) {
    rows.sort((a, b) => a.posting_date.localeCompare(b.posting_date));
  }

  const COLUMN_HEADERS: Record<string, string> = {
    task_name: 'Task Name',
    designer:  'Designer',
    smo:       'SMO',
    type:      'Type',
    platform:  'Platform',
    priority:  'Priority',
    post_date: 'Post Date',
    status:    'Status',
    script:    'Script / Brief',
  };

  // ── CSV path ────────────────────────────────────────────────────
  if (format === 'csv') {
    function csvCell(val: string): string {
      const s = val ?? '';
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }

    const csvColHeaders: string[] = clientFilter
      ? activeColumns.map(c => COLUMN_HEADERS[c])
      : ['Client', ...activeColumns.map(c => COLUMN_HEADERS[c])];

    const lines: string[] = [csvColHeaders.map(csvCell).join(',')];

    for (const client of [...clientMap.keys()].sort()) {
      for (const r of clientMap.get(client)!) {
        const cellValues: Record<string, string> = {
          task_name: r.brief,
          designer:  r.designer ?? '',
          smo:       r.smo ?? '',
          type:      typeLabel(r.content_type),
          platform:  r.platform,
          priority:  r.priority.charAt(0).toUpperCase() + r.priority.slice(1),
          post_date: r.posting_date ? fmtDate(r.posting_date) : '',
          status:    STATUS_LABELS[r.status] ?? r.status,
          script:    r.brief,
        };
        const rowCells = activeColumns.map(c => csvCell(cellValues[c] ?? ''));
        if (!clientFilter) rowCells.unshift(csvCell(client));
        lines.push(rowCells.join(','));
      }
    }

    const csv = lines.join('\r\n');
    const clientSlug = clientFilter ? `-${clientFilter.replace(/\s+/g, '_')}` : '';
    const csvFilename = `tasks-${exportMonth}${clientSlug}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename}"`,
      },
    });
  }
  // ── end CSV path ─────────────────────────────────────────────────

  const COLUMN_WIDTHS: Record<string, number> = {
    task_name: 42, designer: 14, smo: 14, type: 20,
    platform: 14, priority: 11, post_date: 12, status: 13, script: 42,
  };

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bardbox Studio';
  workbook.created = new Date();

  const sortedClients = [...clientMap.keys()].sort();

  for (const client of sortedClients) {
    const rows = clientMap.get(client)!;
    const sheetName = client.replace(/[\\/?*[\]:]/g, '_').slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // ── Header row ──────────────────────────────────────────────
    const headerRow = sheet.addRow(activeColumns.map(c => COLUMN_HEADERS[c]));
    headerRow.height = 26;
    headerRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    });

    // Column widths
    activeColumns.forEach((col, i) => {
      sheet.getColumn(i + 1).width = COLUMN_WIDTHS[col] ?? 16;
    });

    // ── Data rows ────────────────────────────────────────────────
    for (const r of rows) {
      const designerColor = r.designer ? nameColor(r.designer) : null;

      const cellValues: Record<string, string> = {
        task_name: r.brief,
        designer:  r.designer ?? '—',
        smo:       r.smo ?? '—',
        type:      typeLabel(r.content_type),
        platform:  r.platform,
        priority:  r.priority.charAt(0).toUpperCase() + r.priority.slice(1),
        post_date: r.posting_date ? fmtDate(r.posting_date) : '—',
        status:    STATUS_LABELS[r.status] ?? r.status,
        script:    r.brief,
      };

      const dataRow = sheet.addRow(activeColumns.map(c => cellValues[c]));
      dataRow.height = 20;

      activeColumns.forEach((col, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.font      = { size: 10, name: 'Calibri' };
        cell.alignment = { vertical: 'middle', wrapText: false };
        cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } } };

        switch (col) {
          case 'task_name':
          case 'script':
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            break;

          case 'designer':
          case 'smo': {
            const name = col === 'designer' ? r.designer : r.smo;
            if (name && name !== '—') {
              const color = nameColor(name);
              cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
              cell.font  = { bold: true, size: 10, name: 'Calibri' };
            }
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          }

          case 'type':
            // Type cell gets same color as designer — matches screenshot
            if (designerColor) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: designerColor } };
              cell.font = { bold: true, size: 10, name: 'Calibri' };
            }
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;

          case 'priority': {
            const fill = PRIORITY_FILL[r.priority] ?? 'FFF176';
            const fc   = PRIORITY_FONT[r.priority] ?? 'AA7700';
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
            cell.font  = { bold: true, size: 10, name: 'Calibri', color: { argb: fc } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
          }

          case 'post_date':
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font      = { size: 10, name: 'Calibri' };
            break;

          case 'status':
            // STATUS in amber/gold like screenshot
            cell.font  = { bold: true, size: 10, name: 'Calibri', color: { argb: 'FFCC8800' } };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9CC' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            break;
        }
      });
    }

    // Freeze header
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  const buffer   = await workbook.xlsx.writeBuffer();
  const clientSlug = clientFilter ? `-${clientFilter.replace(/\s+/g, '_')}` : '';
  const filename = `tasks-${exportMonth}${clientSlug}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
