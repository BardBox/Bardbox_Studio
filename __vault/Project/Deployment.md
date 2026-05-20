# 🚀 Deployment Guide

## Stack

- **App** → Vercel
- **DB + Auth + Realtime** → Supabase (managed)
- **Sheet Sync** → Google Apps Script (deployed as Web App)

---

## Deploy to Vercel

```bash
# Push to GitHub → Vercel auto-deploys on push to main
git push origin main
```

Or manually:
```bash
npx vercel --prod
```

### Vercel Settings
- Framework Preset: **Next.js**
- Root Directory: `Bardbox_Studio/` (if in monorepo)
- Node.js Version: 20.x
- Build Command: `npm run build`
- Output: `.next`

### Env Vars on Vercel
Add all `.env.local` variables at:
Vercel Dashboard → Project → Settings → Environment Variables

⚠️ Change `NEXT_PUBLIC_APP_URL` to your Vercel URL for production.

---

## Google Apps Script Deploy

1. Open your Google Sheet → Extensions → Apps Script
2. Paste `apps-script/SheetSync.gs`
3. Replace:
   - `WEBHOOK_URL` → your Vercel URL + `/api/sheets/webhook`
   - `WEBHOOK_SECRET` → same as `SHEETS_WEBHOOK_SECRET` in env
4. Deploy → New deployment → Web App → Execute as: Me → Access: Anyone
5. Copy Web App URL → set as `APPS_SCRIPT_WEBAPP_URL` in env
6. Add trigger: `onEditHandler` → From spreadsheet → On edit

---

## Local Dev with Sheet Sync

Sheet sync requires a public URL. Use ngrok for local testing:

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000
# Copy the https URL → set as WEBHOOK_URL in Apps Script
```

---

## Rollback

Vercel keeps all deployments. To rollback:
Vercel Dashboard → Deployments → Select older one → "Promote to Production"

---

## Monitoring

- Vercel Functions logs: Vercel Dashboard → Logs
- Supabase logs: Supabase Dashboard → Logs → API / Database
- Error tracking: _(add Sentry if needed)_
