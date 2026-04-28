# Bardbox Studio — Production Deployment Guide

## Stack
- **Frontend / API**: Next.js 16 (App Router) — deployed on **Vercel**
- **Database / Auth**: **Supabase** (PostgreSQL + Supabase Auth)
- **Sheet Sync**: Google Apps Script (optional — tasks can also be created in-app)

---

## Step 1 — Supabase Project Setup

### 1.1 Create the project
1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to your users
3. Note your **Project URL** and **API keys** (Settings → API)

### 1.2 Run the SQL migrations
Go to **SQL Editor** and run each file **in order**:

| Order | File | What it does |
|-------|------|--------------|
| 1 | `supabase/01_schema.sql` | All tables + indexes |
| 2 | `supabase/02_functions.sql` | Auto-assign, deadline triggers, complete/override RPCs |
| 3 | `supabase/03_views.sql` | Reporting views (pipeline health, team load, etc.) |
| 4 | `supabase/04_rls.sql` | Row-level security policies |
| 5 | `supabase/05_seed.sql` | Default buffer configs |
| 6 | `supabase/06_roles_leave.sql` | CEO/HR roles, leave management, approval RPCs |

### 1.3 Configure Auth

**Redirect URLs** (Auth → URL Configuration):
```
https://your-app.vercel.app/api/auth/callback
http://localhost:3000/api/auth/callback
```

**Email Templates** (Auth → Email Templates):
- Paste the contents of `emails/invite.html` into the **Invite** template
- Paste `emails/reset-password.html` into **Reset Password**
- Paste `emails/magic-link.html` into **Magic Link**
- Paste `emails/email-change.html` into **Email Change**

**SMTP** (Auth → SMTP Settings):
- Supabase's built-in mailer is limited to **2 emails/hour** — configure SMTP for production
- Recommended: [Resend](https://resend.com) — 3,000 emails/month free
  - Host: `smtp.resend.com`, Port: `465`, User: `resend`, Password: Resend API key

### 1.4 Create the first Admin user
1. **Auth → Users → Add user → Create new user**
   - Enter your email + strong password, check **Auto Confirm User**
2. Copy the UUID from the user list
3. Run in **SQL Editor**:

```sql
INSERT INTO public.profiles (id, full_name, role, email, max_concurrent_tasks)
VALUES (
  'paste-your-uuid-here',
  'Your Name',
  'admin',
  'your@email.com',
  10
);
```

All other users are managed from inside the app (Team page).

---

## Step 2 — Vercel Deployment

### 2.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/bardbox-studio.git
git push -u origin main
```

### 2.2 Import to Vercel
1. [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `content-ops`
3. Framework preset: **Next.js** (auto-detected)

### 2.3 Environment Variables
Add in **Vercel → Project → Settings → Environment Variables**:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key (**keep secret**) |
| `NEXT_PUBLIC_APP_URL` | Your Vercel domain, e.g. `https://bardbox-studio.vercel.app` |
| `SHEETS_WEBHOOK_SECRET` | Random 32-char string (optional — only if using Sheets sync) |
| `APPS_SCRIPT_WEBAPP_URL` | Your Apps Script web app URL (optional) |
| `APPS_SCRIPT_WEBAPP_SECRET` | Random 32-char string (optional) |

> Generate secrets: `openssl rand -hex 32`

### 2.4 Deploy
Click **Deploy**. Every `git push` to `main` triggers a new deployment.

---

## Step 3 — User Roles Reference

| Role | Home | What they can do |
|------|------|-----------------|
| `designer` | `/designer` | See own design tasks, update status: todo → in_progress → submitted |
| `smo` | `/smo` | See own post tasks on calendar, mark done |
| `manager` | `/manager` | Pipeline overview, reassign tasks, create content, manage team |
| `ceo` | `/ceo` | Everything manager can do + approve/reject submitted work + client health + executive KPIs |
| `hr` | `/hr` | Team management (invite/deactivate/reset PW) + leave request approval + availability calendar |
| `admin` | `/manager` | Full access to all dashboards |

### Role capabilities matrix

| Capability | designer | smo | manager | ceo | hr | admin |
|-----------|----------|-----|---------|-----|----|-------|
| View own tasks | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Update own task status | ✓ | ✓ | — | — | — | ✓ |
| View all tasks / pipeline | — | — | ✓ | ✓ | — | ✓ |
| Reassign tasks | — | — | ✓ | ✓ | — | ✓ |
| Approve / reject submitted work | — | — | ✓ | ✓ | — | ✓ |
| Create content tasks (in-app) | — | — | ✓ | ✓ | — | ✓ |
| Import content from CSV/Excel | — | — | ✓ | ✓ | — | ✓ |
| View executive KPIs + client health | — | — | — | ✓ | — | ✓ |
| Invite / deactivate users | — | — | ✓ | — | ✓ | ✓ |
| Reset user passwords | — | — | ✓ | — | ✓ | ✓ |
| Submit leave requests | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approve / deny leave | — | — | — | — | ✓ | ✓ |
| View leave calendar | — | — | ✓ | ✓ | ✓ | ✓ |

---

## Step 4 — In-App Content Creation

Content tasks can be created three ways — no Google Sheets required:

### 4.1 Single task (form)
Manager/CEO → **Content** → **+ New Content** → fill form → **Create Content**
- Auto-assigns a designer and an SMO based on workload
- Deadlines computed from `buffer_config` (platform × content type)

### 4.2 Bulk import (CSV / Excel)
Manager/CEO → **Content** → **Import CSV / Excel**
1. Upload your `.csv`, `.xlsx`, or `.xls` file
2. Map your column headers to the required fields (platform, content type, posting date)
3. Preview first 3 rows
4. Click **Import** — all rows inserted, tasks auto-created and auto-assigned

**Minimum required columns in your file:**

| Field | Example values |
|-------|---------------|
| Platform | `Instagram`, `LinkedIn`, `Twitter` |
| Content Type | `Post`, `Reel`, `Story`, `Carousel` |
| Posting Date | `2026-05-15` (YYYY-MM-DD) or Excel date serial |

**Optional columns:** `client_name`, `brief`, `caption`, `hashtags`, `posting_time`

### 4.3 Google Sheets (optional)
If you still want to use the original Sheets pipeline, see Step 5 below.

---

## Step 5 — Google Sheets Sync (Optional)

### 5.1 Prepare your Sheet
Required columns: `_id`, `client_name`, `platform`, `content_type`, `brief`, `caption`, `hashtags`, `posting_date`, `posting_time`

### 5.2 Deploy the Apps Script
1. Sheet → **Extensions → Apps Script**
2. Paste contents of `apps-script/SheetSync.gs`
3. Update constants:
   ```javascript
   const WEBHOOK_URL    = 'https://your-app.vercel.app/api/sheets/webhook';
   const WEBHOOK_SECRET = '<same as SHEETS_WEBHOOK_SECRET env var>';
   const WEBAPP_SECRET  = '<same as APPS_SCRIPT_WEBAPP_SECRET env var>';
   ```
4. **Deploy → New deployment → Web app** (Execute as: Me, Access: Anyone)
5. Copy Web App URL → Vercel `APPS_SCRIPT_WEBAPP_URL`
6. **Triggers → Add trigger → onEdit → On edit**

---

## Step 6 — Leave Management Flow

1. Any user submits leave: **HR → Leave → + Request Leave** (or HR submits on their behalf)
2. HR reviews under **Pending Requests** → **Approve** or **Deny**
3. Approved leaves appear on the **Team Availability calendar** (30-day view)
4. Auto-assign skips team members whose approved leave overlaps a task's deadline

---

## Step 7 — Task Approval Flow

```
Designer: todo → in_progress → submitted
CEO/Manager reviews: submitted → approved (or rejected → back to in_progress)
SMO: approved → done
```

- CEO dashboard shows the **Approval Queue** at the top — one-click approve or reject with notes
- Rejected tasks have notes visible to the designer on their task card
- Manager dashboard also has approve/reject on the Overdue Pipeline list

---

## Step 8 — Buffer Config Tuning

The `buffer_config` table controls task deadlines. Defaults from `05_seed.sql`:

| Platform | Content Type | Design Buffer | Review Buffer |
|----------|-------------|---------------|---------------|
| Instagram | Post | 2 days | 1 day |
| Instagram | Reel | 4 days | 1 day |
| Instagram | Story | 1 day | 0 days |
| Instagram | Carousel | 3 days | 1 day |
| Facebook | Post | 2 days | 1 day |
| LinkedIn | Post | 3 days | 1 day |
| LinkedIn | Article | 5 days | 2 days |
| Twitter | Post | 1 day | 0 days |
| YouTube | Video | 7 days | 2 days |

Adjust via SQL:
```sql
UPDATE public.buffer_config
SET design_buffer_days = 5
WHERE platform = 'instagram' AND content_type = 'reel';
```

---

## Step 9 — Post-Deployment Checklist

- [ ] Log in as admin → redirects to `/manager`
- [ ] Create a CEO user in Team → log in as CEO → see `/ceo` with approval queue
- [ ] Create an HR user → log in as HR → see `/hr` leave dashboard
- [ ] Create a designer + SMO user → verify they see correct dashboards
- [ ] Manager creates a content task via form → two tasks auto-created in DB
- [ ] Import a CSV file → rows created, tasks auto-assigned
- [ ] Designer updates task to `submitted` → appears in CEO approval queue
- [ ] CEO approves task → designer no longer sees it in queue
- [ ] HR submits leave for a team member → appears as pending
- [ ] HR approves leave → appears on leave calendar
- [ ] Auto-assign a task with deadline overlapping approved leave → person is skipped

---

## Troubleshooting

**Invite emails not arriving**
→ Check Supabase Auth → Logs. If hitting the 2/hr limit, configure SMTP (Step 1.3).

**"forbidden" errors in the app**
→ User exists in Auth but has no `profiles` row. Insert one manually via SQL.

**CEO or HR user redirected to login**
→ Their `profiles.role` is not `ceo` or `hr`. Update via: `UPDATE profiles SET role = 'ceo' WHERE id = '...';`

**CSV import error: "No valid rows found"**
→ Check that your posting_date column is in `YYYY-MM-DD` format or a standard Excel date serial.

**Leave not blocking auto-assign**
→ Confirm `06_roles_leave.sql` was run. Check `leave_requests.status = 'approved'` for that user.

**Vercel build fails**
→ Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set — they're needed at build time.

**Tasks not auto-created after content import**
→ Verify `02_functions.sql` was run. Check Supabase → Database → Functions for `create_tasks_for_content_row`.
