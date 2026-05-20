# 📊 Feature: Google Sheet ↔ DB Sync

**Status:** ✅ Done (Phase 1)

---

## How It Works

```
User edits Google Sheet row
    ↓
Apps Script: onEditHandler fires
    ↓
POST /api/sheets/webhook  (with HMAC signature)
    ↓
Upsert into content_rows table (by _id UUID)
    ↓
DB trigger → auto-create 2 tasks if new row
    ↓
Auto-assign runs
    ↓
POST /api/sheets/push-back → writes Status/Designer/SMO back to Sheet
```

---

## Files

| File | Purpose |
|---|---|
| `apps-script/SheetSync.gs` | Google Apps Script — pastes into Sheet |
| `app/api/sheets/webhook/route.ts` | Receives edits from Apps Script |
| `app/api/sheets/push-back/route.ts` | Sends status updates back to Sheet |

---

## Google Sheet Column Requirements

| Column | Type | Notes |
|---|---|---|
| `_id` | auto (UUID) | Script fills this — never touch manually |
| `Client Name` | text | Optional |
| `Platform` | text | `instagram` / `facebook` / `linkedin` / `twitter` / `youtube` |
| `Content Type` | text | `post` / `reel` / `story` / `carousel` / `video` / `short` / `article` |
| `Brief` | text | What the creative should say/do |
| `Caption` | text | SMO uses when posting |
| `Hashtags` | text | Optional |
| `Reference Links` | text | Comma-separated URLs |
| `Posting Date` | date | `YYYY-MM-DD` format |
| `Posting Time` | time | `HH:MM`, defaults to 10:00 |
| `Status` | auto | App writes back |
| `Designer` | auto | App writes back |
| `SMO` | auto | App writes back |

---

## Security

Webhook is HMAC-signed. Apps Script sends `X-Webhook-Secret` header = `SHEETS_WEBHOOK_SECRET`.

---

## Backfill Existing Rows

Run `syncAllRows()` manually in Apps Script editor once to sync all pre-existing rows.
