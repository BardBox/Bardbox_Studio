const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const input = path.join(__dirname, '..', 'sheet', 'BB -RDCC- SMO & Competitor Strategy - June - 2026.csv');
const output = path.join(__dirname, '..', 'sheet', 'RDCC - Bardbox Upload - June 2026 - ready.csv');

function parseDate(value) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;

  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };
  const month = months[match[2].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

function iso(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isBardboxOffDay(date) {
  const day = date.getDay();
  const dateNum = date.getDate();
  return day === 0 || (day === 6 && dateNum <= 7) || (day === 6 && dateNum >= 15 && dateNum <= 21);
}

function nextWorkingDay(date) {
  const d = new Date(date);
  while (isBardboxOffDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

function bardboxType(format) {
  const raw = String(format || '').trim().toLowerCase();
  if (raw.includes('reel')) return 'Reel';
  if (raw.includes('carousel')) return 'Carousel';
  if (raw.includes('image') || raw.includes('static')) return 'Static Post';
  if (raw.includes('video')) return 'Video';
  return 'Static Post';
}

function clean(value) {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const workbook = XLSX.readFile(input, { raw: false });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

const headerIndex = rows.findIndex((row) =>
  clean(row[2]).toLowerCase() === 'post no' &&
  clean(row[3]).toLowerCase() === 'date' &&
  clean(row[4]).toLowerCase() === 'format'
);

if (headerIndex === -1) {
  throw new Error('Could not find the dated RDCC schedule header.');
}

const outRows = [];
for (let i = headerIndex + 1; i < rows.length; i++) {
  const row = rows[i];
  if (clean(row[2]).toLowerCase() === 'post no') break;

  const postNo = clean(row[2]);
  const sourceDate = parseDate(row[3]);
  const format = clean(row[4]);
  const pillar = clean(row[5]);
  const content = clean(row[6]);
  const hook = clean(row[7]);
  const cta = clean(row[8]);
  const driveLink = clean(row[9]);
  const notes = clean(row[10]);
  const remarks = clean(row[11]);

  if (!postNo || !sourceDate || sourceDate.getFullYear() !== 2026 || sourceDate.getMonth() !== 5) continue;
  if (remarks.toLowerCase() === 'posting done') continue;

  const uploadDate = nextWorkingDay(sourceDate);
  const details = [
    hook && `Hook: ${hook}`,
    cta && `CTA: ${cta}`,
    driveLink && `Drive: ${driveLink}`,
    notes && `Notes: ${notes}`,
    remarks && `Source status: ${remarks}`,
    iso(uploadDate) !== iso(sourceDate) && `Original source date: ${iso(sourceDate)}`,
  ].filter(Boolean);

  outRows.push({
    '#': outRows.length + 1,
    'Post Date': iso(uploadDate),
    'Type': bardboxType(format),
    'Task Name': [pillar, content].filter(Boolean).join(' - ') || content || pillar || format,
    'Priority': 'medium',
    'Caption': details.join('\n'),
    'Hashtags': '',
    'Deadline': '10:00',
  });
}

const headers = ['#', 'Post Date', 'Type', 'Task Name', 'Priority', 'Caption', 'Hashtags', 'Deadline'];
const csv = [
  headers.join(','),
  ...outRows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
].join('\n') + '\n';

fs.writeFileSync(output, csv, 'utf8');
console.log(`Wrote ${outRows.length} rows to ${output}`);
