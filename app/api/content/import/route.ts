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

interface ColumnMap {
  posting_date: string;
  content_type?: string;
  brief?: string;
  caption?: string;
  hashtags?: string;
  posting_time?: string;
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

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  if (!mappingRaw) return NextResponse.json({ error: 'No column mapping provided' }, { status: 400 });
  if (!clientName?.trim()) return NextResponse.json({ error: 'client_name required' }, { status: 400 });

  let mapping: ColumnMap;
  try {
    mapping = JSON.parse(mappingRaw) as ColumnMap;
  } catch {
    return NextResponse.json({ error: 'Invalid mapping JSON' }, { status: 400 });
  }

  if (!mapping.posting_date) {
    return NextResponse.json({ error: 'Mapping must include posting_date' }, { status: 400 });
  }

  let platforms: string[] = [];
  if (platformsRaw) {
    try {
      platforms = JSON.parse(platformsRaw);
    } catch {
      platforms = [platformsRaw];
    }
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return NextResponse.json({ error: 'platforms[] required' }, { status: 400 });
  }

  // Parse file
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });

  // Use the specified tab or first sheet
  const sheetName = (tabName && workbook.SheetNames.includes(tabName))
    ? tabName
    : workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (rows.length === 0) {
    return NextResponse.json({ error: 'File is empty or has no rows after the header' }, { status: 400 });
  }

  // Build insert payloads — one set of rows per platform
  type InsertRow = {
    client_name: string | null;
    platform: string;
    content_type: string;
    brief: string | null;
    caption: string | null;
    hashtags: string | null;
    posting_date: string;
    posting_time: string;
    source: 'import';
    created_by: string;
    auto_create_tasks: false;
  };

  const inserts: InsertRow[] = [];

  for (const platform of platforms) {
    for (const row of rows) {
      const postingDateRaw = row[mapping.posting_date];
      const posting_date =
        typeof postingDateRaw === 'number'
          ? excelDateToISO(postingDateRaw)
          : str(postingDateRaw);

      if (!posting_date || !/^\d{4}-\d{2}-\d{2}$/.test(posting_date)) continue;

      // Resolve content_type from column or fallback to 'post'
      const content_type = mapping.content_type
        ? str(row[mapping.content_type]) || 'post'
        : 'post';

      inserts.push({
        client_name: clientName.trim(),
        platform: platform.toLowerCase(),
        content_type: content_type.toLowerCase(),
        brief: mapping.brief ? str(row[mapping.brief]) || null : null,
        caption: mapping.caption ? str(row[mapping.caption]) || null : null,
        hashtags: mapping.hashtags ? str(row[mapping.hashtags]) || null : null,
        posting_date,
        posting_time: mapping.posting_time
          ? str(row[mapping.posting_time]) || '10:00:00'
          : '10:00:00',
        source: 'import' as const,
        created_by: user.id,
        auto_create_tasks: false,
      });
    }
  }

  if (inserts.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows found. Check that posting_date column contains dates in YYYY-MM-DD format.' },
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
