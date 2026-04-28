# ContentOps — Build Plan

A workload + content calendar ops tool. Google Sheet is the source of truth; the app reads from it, auto-splits each row into a **design task** and a **post task**, applies buffer-based deadlines, auto-assigns to the lightest-loaded person (with manager override), and shows role-specific dashboards.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: Next.js API routes (Edge/Node runtime)
- **DB / Auth / Realtime**: Supabase
- **Sheet sync**: Google Apps Script → webhook → Next.js → Supabase
- **Deploy**: Vercel (app) + Supabase (managed)

## File structure

```
content-ops/
├── BUILD_PLAN.md              ← you are here
├── .env.example
├── supabase/
│   ├── 01_schema.sql          ← tables
│   ├── 02_functions.sql       ← auto-assign, task creation, override
│   ├── 03_views.sql           ← pipeline health + team load reports
│   ├── 04_rls.sql             ← row-level security
│   └── 05_seed.sql            ← buffer config defaults
├── apps-script/
│   └── SheetSync.gs           ← paste into script editor of your Sheet
├── app/
│   ├── api/
│   │   └── sheets/
│   │       ├── webhook/route.ts       ← receives edits from Apps Script
│   │       └── push-back/route.ts     ← sends status updates to Sheet
│   └── api/tasks/
│       └── override-assignee/route.ts ← manager override endpoint
└── lib/supabase/
    ├── server.ts              ← service-role client (server only)
    └── client.ts              ← anon client (browser)
```

## Setup sequence (do in this order)

### 1. Supabase project
1. Create a new project at [supabase.com](https://supabase.com)
2. Open SQL Editor, run these files in order:
   - `supabase/01_schema.sql`
   - `supabase/02_functions.sql`
   - `supabase/03_views.sql`
   - `supabase/04_rls.sql`
   - `supabase/05_seed.sql`
3. From Project Settings → API, copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key

### 2. Create your first users
In Supabase Auth → Users, invite your team (or sign them up through your app later). Then run this for each, updating the role:

```sql
insert into public.profiles (id, full_name, role, whatsapp_number, is_active)
values ('<uuid-from-auth-users>', 'Sameer', 'manager', '+9198...', true);
```

Roles: `designer`, `smo`, `manager`, `admin`.

### 3. Next.js project
```bash
npx create-next-app@latest content-ops-web --ts --tailwind --app --eslint
cd content-ops-web
npm install @supabase/supabase-js @supabase/ssr
# copy lib/, app/api/ folders from this package
```

Copy `.env.example` → `.env.local`, fill in your Supabase keys and a webhook secret (any random string).

### 4. Google Sheet setup
Your Content Calendar Sheet needs these columns (header row 1, exact names):

| Column Header | Type | Required | Notes |
|---|---|---|---|
| `_id` | auto | yes | Leave empty — script fills it |
| `Client Name` | text | no | |
| `Platform` | text | yes | `instagram` / `facebook` / `linkedin` / `twitter` / `youtube` |
| `Content Type` | text | yes | `post` / `reel` / `story` / `carousel` / `video` / `short` / `article` |
| `Brief` | text | no | What the creative should say/do |
| `Caption` | text | no | SMO uses this when posting |
| `Hashtags` | text | no | |
| `Reference Links` | text | no | Comma-separated URLs |
| `Posting Date` | date | yes | YYYY-MM-DD |
| `Posting Time` | time | no | HH:MM, defaults to 10:00 |
| `Status` | text | auto | App writes back to this |
| `Designer` | text | auto | App writes back |
| `SMO` | text | auto | App writes back |

### 5. Deploy Apps Script
1. Open your Sheet → Extensions → Apps Script
2. Paste contents of `apps-script/SheetSync.gs`
3. Replace `WEBHOOK_URL` with your deployed app URL (for local dev use [ngrok](https://ngrok.com))
4. Replace `WEBHOOK_SECRET` with the one from your `.env.local`
5. Save, then: Triggers → Add Trigger → `onEditHandler`, From spreadsheet, On edit
6. Run `syncAllRows()` once to backfill existing rows

### 6. Verify
- Edit any row in the Sheet → check `public.content_rows` in Supabase (should appear)
- Two tasks should auto-create in `public.tasks` (one design, one post) with buffer-based deadlines
- Query `select * from public.task_pipeline_health`
- Check `Status` column in your Sheet updated automatically

## Build phases

**Phase 1 — Foundation (this package)** ✅
- Schema + functions + views
- Sheet ⇄ DB sync
- Auto-assign engine
- Buffer/deadline logic
- Manager override endpoint

**Phase 2 — Dashboards (next)**
- Designer view: my tasks + Kanban by pressure level
- SMO view: calendar by posting date + post checklist
- Manager view: team load, overdue risks, pipeline throughput

**Phase 3 — Workflow**
- Creative upload → Supabase Storage
- Approval flow (designer submits → manager approves → SMO gets "ready")
- Activity timeline per content row

**Phase 4 — Notifications**
- WhatsApp alerts via your existing Baileys setup
  - Designer: "New task, due {date}"
  - SMO: "Creative approved for {platform} post"
  - Manager: "Task overdue" / "Low pipeline buffer"

**Phase 5 — Polish**
- Client-facing read-only portal
- Performance reports export
- Holiday/leave calendar (affects auto-assign)

## Key design decisions & why

**Why two linked tasks per content row, not one?**
Different deadlines (design deadline = posting − buffer), different assignees, different checklists. Forcing them into one task muddies status ("in progress" for whom?). Two tasks with a shared parent row gives you clean role separation + a pipeline you can actually measure.

**Why `buffer_config` table instead of hardcoded days?**
Reels need more lead time than stories. You'll tune this per platform/content type as you learn. Table-driven means no code changes.

**Why a `manually_assigned` flag?**
Auto-assignment is great on creation, but once the manager moves Priya's task to Rahul, auto-reassignment logic on edit would undo that. The flag locks in human decisions.

**Why `_id` column in the Sheet instead of row number?**
Inserting or deleting a row shifts all row numbers — you'd lose task linkage. A UUID per row (auto-generated on first edit) keeps the link stable forever.

## Env vars you need

See `.env.example`.
