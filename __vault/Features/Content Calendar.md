# 📅 Feature: Content Calendar

**Status:** 🔄 In Progress (Phase 2)

---

## What It Should Do

- Visual calendar view of all scheduled content
- Filter by: platform, client, status, assignee
- Color-coded by status (pending / in-design / approved / posted)
- Click row → see task details, upload, approve

---

## Who Sees It

| Role | View |
|---|---|
| Designer | Their tasks only, sorted by pressure |
| SMO | By posting date (what to post and when) |
| Manager | Full pipeline — all clients, all team |
| CEO | High-level approval queue |

---

## Route

- `/content` — shared content calendar (all authenticated users)
- `/designer` — designer-specific task view
- `/smo` — SMO posting calendar
- `/manager/tasks` — manager full pipeline

---

## Status Flow

```
pending → in-design → submitted → approved → ready-to-post → posted
                                ↓
                            rejected → in-design (revise)
```

---

## Pressure Level Logic

Pressure = how close is the deadline vs. today

| Days Until Deadline | Pressure |
|---|---|
| > 5 days | 🟢 Comfortable |
| 2-5 days | 🟡 Watch |
| 1-2 days | 🟠 Urgent |
| < 1 day | 🔴 Critical |
| Past due | ⚫ Overdue |

---

## TODO

- [ ] Build designer kanban view
- [ ] Build SMO calendar view
- [ ] Build manager pipeline view
- [ ] Add filter bar (platform, client, status)
- [ ] Add pressure level color coding
