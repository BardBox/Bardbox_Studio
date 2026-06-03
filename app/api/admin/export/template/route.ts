import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

const PRIORITY_FILL: Record<string, string> = {
  high:      'FFCCCC',
  medium:    'FFF9CC',
  low:       'CCFFCC',
  emergency: 'FF9999',
};

const PRIORITY_FONT: Record<string, string> = {
  high:      'CC0000',
  medium:    'AA7700',
  low:       '1B5E20',
  emergency: 'FF0000',
};

export async function GET() {
  const now       = new Date();
  const year      = now.getFullYear();
  const monthNum  = now.getMonth() + 1;
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' });

  function d(day: number) {
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const sampleRows = [
    { num: 1,  date: d(1),  type: 'Reel',        task: 'Hook idea for this reel',         caption: 'Your caption goes here...', hashtags: '#brand #social', time: '10:00', priority: 'high' },
    { num: 2,  date: d(3),  type: 'Carousel',     task: 'Topic for the carousel slides',   caption: '',                          hashtags: '',              time: '',      priority: 'high' },
    { num: '',  date: d(3), type: 'Static Post',  task: 'Quote post — same day',            caption: '',                          hashtags: '',              time: '',      priority: 'medium' },
    { num: 3,  date: d(5),  type: 'Reel',        task: 'Another reel idea',                caption: 'Caption...',                hashtags: '',              time: '',      priority: 'medium' },
    { num: 4,  date: d(8),  type: 'Static Post', task: 'Brand awareness static',           caption: '',                          hashtags: '#branding',     time: '11:00', priority: 'low' },
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bardbox Studio';

  const sheet = workbook.addWorksheet(`${monthName} - ${year}`);

  // ── Note row ────────────────────────────────────────────────
  const noteRow = sheet.addRow(['Update Post Date column daily  •  Priority: high / medium / low / emergency  •  Leave Post Date blank to inherit from row above']);
  noteRow.height = 18;
  noteRow.getCell(1).font      = { italic: true, size: 9, color: { argb: 'FF888888' }, name: 'Calibri' };
  noteRow.getCell(1).alignment = { vertical: 'middle' };
  sheet.mergeCells('A1:H1');

  // ── Header row ──────────────────────────────────────────────
  // Columns: #, Post Date, Type, Task Name, Priority, Caption, Hashtags, Deadline
  const headers = ['#', 'Post Date', 'Type', 'Task Name', 'Priority', 'Caption', 'Hashtags', 'Deadline'];
  const headerRow = sheet.addRow(headers);
  headerRow.height = 26;
  headerRow.eachCell(cell => {
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1A' } };
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF333333' } } };
  });
  headerRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };  // Task Name
  headerRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'left' };  // Caption

  // ── Column widths ────────────────────────────────────────────
  sheet.getColumn(1).width = 4;   // #
  sheet.getColumn(2).width = 13;  // Post Date
  sheet.getColumn(3).width = 15;  // Type
  sheet.getColumn(4).width = 36;  // Task Name
  sheet.getColumn(5).width = 12;  // Priority
  sheet.getColumn(6).width = 40;  // Caption
  sheet.getColumn(7).width = 22;  // Hashtags
  sheet.getColumn(8).width = 14;  // Deadline

  // ── Data rows ────────────────────────────────────────────────
  // Col indices: 1=#, 2=PostDate, 3=Type, 4=TaskName, 5=Priority, 6=Caption, 7=Hashtags, 8=Deadline
  for (const r of sampleRows) {
    const dataRow = sheet.addRow([r.num, r.date, r.type, r.task, r.priority, r.caption, r.hashtags, r.time]);
    dataRow.height = 20;

    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.font      = { size: 10, name: 'Calibri' };
      cell.alignment = { vertical: 'middle' };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } } };
    });

    dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };   // #
    dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };   // Post Date
    // Type
    dataRow.getCell(3).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
    dataRow.getCell(3).font      = { size: 10, name: 'Calibri', bold: true };
    dataRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
    // Task Name
    dataRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    // Priority — colored
    const pFill = PRIORITY_FILL[r.priority] ?? 'FFF9CC';
    const pFont = PRIORITY_FONT[r.priority] ?? 'AA7700';
    dataRow.getCell(5).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: pFill } };
    dataRow.getCell(5).font      = { bold: true, size: 10, name: 'Calibri', color: { argb: pFont } };
    dataRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' };
    // Caption
    dataRow.getCell(6).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    // Deadline
    dataRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'center' };
  }

  // ── Empty rows with borders so user can see where to type ───
  for (let i = 0; i < 25; i++) {
    const emptyRow = sheet.addRow(['', '', '', '', '', '', '', '']);
    emptyRow.height = 20;
    emptyRow.eachCell({ includeEmpty: true }, cell => {
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } } };
    });
  }

  // Freeze header rows (note + header)
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

  const buffer   = await workbook.xlsx.writeBuffer();
  const filename = `bardbox_template_${monthName.toLowerCase()}_${year}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
