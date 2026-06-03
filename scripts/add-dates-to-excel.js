// Prepares EaseBiz Excel for Bardbox import:
// 1. Adds "Post Date" column with dates spread across the month
// 2. Renames columns to match Bardbox template (Post Type→Type, Post Hook→Caption, Post Description→Task Name)
//    so the import dialog detects it as "Bardbox template" and skips AI mapping

const XLSX = require('xlsx');
const path = require('path');

const SRC  = path.join(__dirname, '..', 'public', 'EaseBiz - SMO Strategy.xlsx');
const DEST = path.join(__dirname, '..', 'public', 'EaseBiz - SMO Strategy (bardbox).xlsx');

// EaseBiz column name → Bardbox template column name
// Only rename the ones the template cares about; leave rest as-is
const COLUMN_RENAME = {
  'Post Type':        'Type',
  'Post Hook':        'Caption',
  'Post Description': 'Task Name',
  'Hashtags':         'Hashtags', // already correct, listed for clarity
};

// Map sheet name → year + month (0-indexed)
const MONTH_MAP = {
  'june 2026':              { year: 2026, month: 5  },
  'may 2026':               { year: 2026, month: 4  },
  '2.0 april 2026':         { year: 2026, month: 3  },
  'copy of 2.0 march 2026': { year: 2026, month: 2  },
  'march 2026':             { year: 2026, month: 2  },
  'april 2026':             { year: 2026, month: 3  },
  'dec 2025':               { year: 2025, month: 11 },
  'feb 2026':               { year: 2026, month: 1  },
};

function getWorkingDays(year, month) {
  const days = [];
  const total = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0) { // Mon–Sat (skip Sunday)
      const mm = String(month + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      days.push(`${year}-${mm}-${dd}`);
    }
  }
  return days;
}

const wb = XLSX.readFile(SRC);

for (const sheetName of wb.SheetNames) {
  const key  = sheetName.toLowerCase().trim();
  const info = MONTH_MAP[key];
  if (!info) { console.log(`SKIP  ${sheetName}`); continue; }

  const ws   = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 2) { console.log(`EMPTY ${sheetName}`); continue; }

  const originalHeader = rows[0].map(String);
  const dataRows       = rows.slice(1);

  // Skip sheets that already have Post Date (re-run safe)
  if (originalHeader.includes('Post Date')) {
    console.log(`SKIP  ${sheetName} — already processed`);
    continue;
  }

  // Rename existing columns to match Bardbox template
  const renamedHeader = originalHeader.map(h => COLUMN_RENAME[h] ?? h);

  // Prepend Post Date column
  const finalHeader = ['Post Date', ...renamedHeader];

  const workingDays  = getWorkingDays(info.year, info.month);
  const realRows     = dataRows.filter(r => r[0] !== '' || r[1] !== '');
  const postsPerDay  = Math.max(1, Math.ceil(realRows.length / workingDays.length));

  console.log(`\nPROCESS  ${sheetName}  →  ${realRows.length} posts, ${workingDays.length} working days`);
  console.log(`  Renamed: ${originalHeader.filter(h => COLUMN_RENAME[h] && COLUMN_RENAME[h] !== h).map(h => `${h} → ${COLUMN_RENAME[h]}`).join(', ')}`);

  let dayIdx = 0;
  let countOnDay = 0;

  const newRows = [finalHeader];
  for (const row of dataRows) {
    const isEmpty = row[0] === '' && row[1] === '';
    if (isEmpty) {
      newRows.push(['', ...row]);
    } else {
      if (countOnDay >= postsPerDay) { dayIdx++; countOnDay = 0; }
      const date = workingDays[Math.min(dayIdx, workingDays.length - 1)];
      countOnDay++;
      newRows.push([date, ...row]);
    }
  }

  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(newRows);
  console.log(`  Dates: ${workingDays[0]} → ${workingDays[Math.min(dayIdx, workingDays.length - 1)]}`);
}

XLSX.writeFile(wb, DEST);
console.log(`\nSaved → ${DEST}`);
