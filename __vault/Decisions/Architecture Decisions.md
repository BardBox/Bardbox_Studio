# 🧠 Architecture Decisions

---

## ADR-001 — Two Tasks Per Content Row (Not One)

**Date:** 2026-05-20  
**Decision:** Each content row = one design task + one post task  
**Why:** Different deadlines, different assignees, different checklists. One task = "in progress for whom?" is ambiguous. Two tasks = clean role separation + measurable pipeline.

---

## ADR-002 — `buffer_config` Table (Not Hardcoded)

**Date:** 2026-05-20  
**Decision:** Buffer days stored in DB table, not code  
**Why:** Reels need more lead time than stories. You'll tune per platform/type over time. Table-driven = no code deploy to change buffer.

---

## ADR-003 — `manually_assigned` Flag

**Date:** 2026-05-20  
**Decision:** Once manager overrides assignee, set `manually_assigned = true` — auto-assign skips that task forever  
**Why:** Auto-reassignment on sheet edit would undo manager decisions. Flag locks in human choices.

---

## ADR-004 — `_id` UUID in Sheet (Not Row Number)

**Date:** 2026-05-20  
**Decision:** UUID column in Google Sheet instead of using row numbers  
**Why:** Inserting/deleting rows shifts all row numbers → lose task linkage. UUID per row survives row operations.

---

## ADR-005 — Next.js App Router (Not Pages Router)

**Date:** 2026-05-20  
**Decision:** Using Next.js App Router with route groups `(app)` and `(auth)`  
**Why:** Server components, better layout nesting, middleware-based auth, edge runtime support.

---

## ADR-006 — Supabase (Not Custom Auth)

**Date:** 2026-05-20  
**Decision:** Supabase for Auth + DB + Realtime + Storage  
**Why:** Managed, fast to set up, RLS for row-level security, built-in auth flows, realtime out of the box.

---

## Template

```
## ADR-XXX — [Title]

**Date:** YYYY-MM-DD
**Decision:** What was decided
**Why:** The reasoning — constraints, tradeoffs, alternatives rejected
```
