# 🐛 Active Bugs

> Move bugs to `Resolved` section once fixed.

---

## 🔴 Open

### BUG-001 — Supabase "Failed to fetch" on dev server
- **Reported:** 2026-05-20
- **Symptom:** Dev server shows "Failed to fetch" when connecting to Supabase
- **Root Cause:** Dev server was running before `.env.local` was loaded OR Supabase free project is paused
- **Fix:** Restart `npm run dev`. Check Supabase dashboard — unpause project if paused.
- **Status:** 🔄 Investigating

---

## ✅ Resolved

_(move bugs here when fixed)_

---

## Bug Template

```
### BUG-XXX — Title
- **Reported:** YYYY-MM-DD
- **Symptom:** What the user sees
- **Root Cause:** Why it happens
- **Fix:** How to fix it
- **Status:** Open / Fixed / Won't Fix
- **Fixed in:** commit hash or date
```
