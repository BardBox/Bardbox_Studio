/**
 * SheetSync.gs — ContentOps ⇄ Google Sheets bidirectional sync
 *
 * Paste into Extensions → Apps Script on your Content Calendar sheet.
 * Then: Triggers → Add Trigger → onEditHandler, From spreadsheet, On edit.
 *
 * Deployment for push-back:
 *   Deploy → New Deployment → Type: Web app
 *   Execute as: Me | Access: Anyone (or Anyone with Google account)
 *   Copy the /exec URL into APPS_SCRIPT_WEBAPP_URL in your .env.local
 */

// ======== CONFIG ========
const WEBHOOK_URL    = 'https://YOUR-APP-DOMAIN.com/api/sheets/webhook';
const WEBHOOK_SECRET = 'REPLACE-WITH-SHEETS_WEBHOOK_SECRET-FROM-ENV';
const WEBAPP_SECRET  = 'REPLACE-WITH-APPS_SCRIPT_WEBAPP_SECRET-FROM-ENV';
const SHEET_NAME     = 'Content Calendar';

// ======== onEdit trigger ========
function onEditHandler(e) {
  if (!e) return;
  const sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  const row = e.range.getRow();
  if (row === 1) return; // header

  // write-back columns shouldn't re-trigger sync loop
  const editedCol = e.range.getColumn();
  const headers = getHeaders(sheet);
  const editedHeader = headers[editedCol - 1];
  if (['Status', 'Designer', 'SMO'].includes(editedHeader)) return;

  syncRow(sheet, row);
}

// ======== Sync a single row up to the app ========
function syncRow(sheet, row) {
  const headers = getHeaders(sheet);
  const values  = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

  const idCol = ensureIdColumn(sheet, headers);
  let sheetRowId = sheet.getRange(row, idCol).getValue();
  if (!sheetRowId) {
    sheetRowId = Utilities.getUuid();
    sheet.getRange(row, idCol).setValue(sheetRowId);
  }

  const payload = { sheet_row_id: sheetRowId };
  headers.forEach((h, i) => {
    if (!h || h === '_id') return;
    payload[normalizeKey(h)] = formatValue(values[i]);
  });

  const resp = UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': WEBHOOK_SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() >= 400) {
    Logger.log('Sync failed for row ' + row + ': ' + resp.getContentText());
  }
}

// ======== Backfill all rows (run once after first deploy) ========
function syncAllRows() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  for (let r = 2; r <= lastRow; r++) {
    syncRow(sheet, r);
    Utilities.sleep(150);
  }
  Logger.log('Backfill complete: ' + (lastRow - 1) + ' rows.');
}

// ======== doPost — receives push-back from the app ========
//  POST { secret, sheet_row_id, status?, designer?, smo? }
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.secret !== WEBAPP_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const headers = getHeaders(sheet);
  const idCol = ensureIdColumn(sheet, headers);

  const lastRow = sheet.getLastRow();
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  let targetRow = -1;
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0] === body.sheet_row_id) { targetRow = i + 2; break; }
  }

  if (targetRow < 0) return json({ error: 'row not found' }, 404);

  const updates = {
    'Status':   body.status,
    'Designer': body.designer,
    'SMO':      body.smo,
  };

  Object.keys(updates).forEach(col => {
    if (updates[col] === undefined || updates[col] === null) return;
    const colIdx = headers.indexOf(col) + 1;
    if (colIdx > 0) sheet.getRange(targetRow, colIdx).setValue(updates[col]);
  });

  return json({ ok: true, row: targetRow });
}

// ======== helpers ========
function getHeaders(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function ensureIdColumn(sheet, headers) {
  let idCol = headers.indexOf('_id') + 1;
  if (idCol === 0) {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue('_id').setFontWeight('bold');
    idCol = 1;
  }
  return idCol;
}

function normalizeKey(h) {
  return String(h).toLowerCase().trim().replace(/\s+/g, '_');
}

function formatValue(v) {
  if (v instanceof Date) {
    // ISO date (YYYY-MM-DD) for Posting Date, ISO datetime otherwise
    const pad = n => (n < 10 ? '0' : '') + n;
    return v.getFullYear() + '-' + pad(v.getMonth() + 1) + '-' + pad(v.getDate());
  }
  return v;
}

function json(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
