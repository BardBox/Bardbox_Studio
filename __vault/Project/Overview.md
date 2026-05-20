# 🚀 Bardbox Studio — Overview

## What is it?

A **ContentOps SaaS** tool for managing social media content production pipelines.

The Google Sheet is the source of truth. The app:
1. Reads content rows from the sheet
2. Auto-splits each row into a **Design task** + **Post task**
3. Applies buffer-based deadlines per platform/content type
4. Auto-assigns to the lightest-loaded team member
5. Shows role-specific dashboards (Designer / SMO / Manager / CEO / HR / Admin)

---

## Who Uses It?

| Role | What They See |
|---|---|
| **Designer** | My tasks + Kanban by pressure level |
| **SMO** | Calendar by posting date + post checklist |
| **Manager** | Team load, overdue risks, pipeline throughput |
| **CEO** | Approvals dashboard |
| **HR** | Team management, leave calendar |
| **Admin** | Full access — team, roles, settings, AI config |

---

## Core Concept: Two Tasks Per Content Row

Each sheet row = one piece of content = **two tasks**:
- **Design task** → deadline = posting date − buffer days
- **Post task** → deadline = posting date

Different deadlines, different assignees, different checklists. Merged into one task = messy status ("in progress for whom?").

---

## Why `_id` in the Sheet?

Inserting/deleting rows shifts row numbers → lose task linkage. A UUID per row (auto-generated on first edit) keeps the link stable forever.

---

## Why `buffer_config` Table?

Reels need more lead time than stories. Table-driven means no code changes when you tune it.

---

## Links

- [[Tech Stack]]
- [[Architecture]]
- [[Supabase Setup]]
- [[Deployment]]
