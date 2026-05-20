# ⚙️ Feature: Auto-Assign Engine

**Status:** ✅ Done (Phase 1)

---

## What It Does

When a new content row comes in, the engine:
1. Reads `buffer_config` to get design buffer days for that platform + content type
2. Calculates `design_deadline = posting_date − buffer_days`
3. Finds the `designer` with fewest open tasks → assigns design task
4. Finds the `smo` with fewest open tasks → assigns post task
5. Sets `manually_assigned = false`

---

## Buffer Config Table

Stored in `supabase/05_seed.sql`. Defaults:

| Platform | Content Type | Buffer Days |
|---|---|---|
| instagram | reel | 5 |
| instagram | post | 2 |
| instagram | story | 1 |
| youtube | video | 7 |
| _(tunable per platform/type)_ | | |

---

## Manager Override

Manager can reassign any task → sets `manually_assigned = true`.

Once `manually_assigned = true`, the auto-assign engine **never touches that task again**, even on sheet edits.

API: `POST /api/tasks/override-assignee`

---

## Lightest-Load Algorithm

```sql
SELECT assignee_id, COUNT(*) as open_tasks
FROM tasks
WHERE role = 'designer'
  AND status NOT IN ('done', 'posted')
  AND manually_assigned = false
GROUP BY assignee_id
ORDER BY open_tasks ASC
LIMIT 1
```

---

## Files

| File | Purpose |
|---|---|
| `supabase/02_functions.sql` | Core auto-assign + task creation functions |
| `supabase/05_seed.sql` | Default buffer_config values |
| `app/api/tasks/override-assignee/route.ts` | Manager override endpoint |
