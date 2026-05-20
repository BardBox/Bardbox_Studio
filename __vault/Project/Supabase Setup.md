# 🗄️ Supabase Setup

## Project

- **URL**: `https://rzgheidhzirnhmecoine.supabase.co`
- **Dashboard**: https://supabase.com/dashboard/project/rzgheidhzirnhmecoine

---

## SQL Files (run in this order)

| File | Purpose |
|---|---|
| `supabase/01_schema.sql` | Tables: content_rows, tasks, profiles, buffer_config, clients |
| `supabase/02_functions.sql` | Auto-assign, task creation, override logic |
| `supabase/03_views.sql` | `task_pipeline_health`, team load reports |
| `supabase/04_rls.sql` | Row-level security rules per role |
| `supabase/05_seed.sql` | Default buffer_config values |

---

## Key Tables

| Table | Purpose |
|---|---|
| `content_rows` | One row per piece of content (synced from Google Sheet) |
| `tasks` | Design task + Post task per content row |
| `profiles` | User profiles with role, name, WhatsApp |
| `buffer_config` | Platform × Content Type → buffer days |
| `clients` | Client list |

---

## Key Views

| View | Purpose |
|---|---|
| `task_pipeline_health` | Overdue risk, pressure levels per task |
| _(team load view)_ | Who has how many open tasks |

---

## Auto-Assign Logic

Function in `02_functions.sql`. On content row insert:
1. Look up buffer days from `buffer_config` (platform + content_type)
2. Calculate design deadline = posting_date − buffer
3. Find team member with role = `designer` with fewest open tasks
4. Find team member with role = `smo` with fewest open tasks
5. Create two tasks (design + post) with those assignees
6. Set `manually_assigned = false` (auto-assigned)

If manager overrides → `manually_assigned = true` → auto-assign skips this task on future edits.

---

## Running Setup Fresh

```bash
# 1. Create Supabase project at supabase.com
# 2. Copy URL + keys to .env.local
# 3. Run SQL files in order via SQL Editor

# 4. Run setup script (creates first admin user)
npm run setup
```

---

## Checking Data

```sql
-- All content rows
SELECT * FROM content_rows LIMIT 10;

-- Pipeline health
SELECT * FROM task_pipeline_health;

-- Team load
SELECT assignee_id, COUNT(*) as open_tasks
FROM tasks
WHERE status NOT IN ('done', 'posted')
GROUP BY assignee_id;
```
