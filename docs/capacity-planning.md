# Task Capacity Planning — BardBox Studio

**Document purpose:** Internal review — to be confirmed by department managers before development begins.  
**Prepared by:** BardBox Engineering Team  
**Date:** June 2026  
**Status:** Draft — Awaiting Manager Approval

---

## About BardBox Studio

BardBox Studio is a **social media marketing agency** that manages content creation and publishing for multiple clients simultaneously. Each month, a content plan is uploaded for each client — covering Instagram, Facebook, LinkedIn, and other platforms. The plan includes reels, carousels, static images, stories, and more.

The workflow involves three main roles:

| Role | What They Do |
|---|---|
| **Graphic Designer** | Creates visual content (carousels, statics, infographics, covers) |
| **Video Editor** | Edits reels, short videos, animations, YouTube content |
| **SMO (Social Media Operator)** | Writes captions, schedules posts, publishes on time |

Because BardBox handles **multiple clients at once**, the challenge is making sure no team member is overloaded on any single day — especially when different content types take very different amounts of time.

This document defines the **task capacity system** that the BardBox app will use to auto-schedule work fairly.

---

## Working Hours

| | Time |
|---|---|
| Start | 9:00 AM |
| Break | 1:00 PM – 2:00 PM |
| End | 6:00 PM |
| **Productive Hours** | **8 hours/day** |

All capacity numbers below are calculated against this 8-hour window.

---

## What Is Daily Capacity?

Daily capacity is the **maximum number of tasks one person can realistically complete in a single working day**, based on their role and the type of content they are working on.

This is different from the existing "Task Cap" (max open tasks at once). Daily capacity is about **how much one person can produce per day** — not how many tasks are assigned to them in total.

**Example:**
> A designer can finish 5 static images in a day, but only 3 carousels — because a carousel has 8–10 slides and takes much longer.

The system uses this to automatically schedule tasks so no one is overloaded on any given day.

---

## Why This Matters

Without daily capacity limits:
- A designer could get 8 carousels assigned on the same day and miss all of them
- The system has no way to know that a reel edit takes 3× longer than a story upload
- Managers have to manually redistribute work

With daily capacity:
- Tasks are auto-assigned to whoever has room on that day
- If everyone is full, the task moves to the next available day automatically
- Emergency tasks displace lower-priority tasks and reschedule them

---

## Proposed Capacity Per Role

> Please review and adjust numbers based on your team's actual output.  
> These are starting defaults — they can be changed per person in the admin panel.

---

### Graphic Designer

8 productive hours. Time estimates include brief reading, design, export, and upload.

| Content Type | Time Per Task | Tasks Per Day | Notes |
|---|---|---|---|
| Carousel | ~2.5 hrs | 3 | 8–10 slides, multiple size variations |
| Static / Image | ~1.5 hrs | 5 | Single frame, faster turnaround |
| Story Frame | ~1 hr | 6–7 | Small canvas, minimal elements |
| Infographic | ~4 hrs | 2 | Data layout, icons, heavy detail |
| Thumbnail | ~1 hr | 7 | Quick crop + text overlay |
| Flyer / Poster | ~2.5 hrs | 3 | Print-quality, more detail |
| Logo / Branding | ~8 hrs | 1 | Conceptual work, revision-heavy |
| Reel Cover / Banner | ~1 hr | 7 | One frame, brand consistent |

---

### Video Editor

8 productive hours. Time includes raw footage review, edit, captions, colour, export.

| Content Type | Time Per Task | Tasks Per Day | Notes |
|---|---|---|---|
| Short Reel (up to 30 sec) | ~2.5 hrs | 3 | Trim, captions, music sync |
| Long Reel (30–60 sec) | ~4 hrs | 2 | More cuts, transitions, review |
| YouTube Video (5–15 min) | ~8 hrs | 1 | Full edit, colour grading, chapters |
| Story Animation | ~2 hrs | 4 | Short looping clips |
| Highlight Reel | ~4 hrs | 2 | Multi-clip assembly |
| Lyrical / Lyrics Video | ~4 hrs | 2 | Sync-heavy, frame-accurate cuts |

---

### SMO — Social Media Operator (Scheduler / Publisher)

8 productive hours. Time includes caption check, hashtag research, scheduling, and confirmation.

| Content Type | Time Per Task | Tasks Per Day | Notes |
|---|---|---|---|
| Post Scheduling (any type) | ~45 min | 10 | Upload, schedule, confirm |
| Caption Writing + Scheduling | ~1 hr | 8 | Writing adds time |
| Story Upload | ~30 min | 12–14 | Fastest workflow |
| Reel Upload + Description | ~1.5 hrs | 5 | Hashtag research + cover selection |
| Twitter / X Thread | ~1 hr | 7 | Multi-tweet planning |
| LinkedIn Post | ~1.5 hrs | 5 | Professional tone, formatting |

---

### Copywriter *(if role is added later)*

8 productive hours. Time includes brief reading, research, draft, and one round of self-edit.

| Content Type | Time Per Task | Tasks Per Day | Notes |
|---|---|---|---|
| Social Media Caption | ~30 min | 12–14 | Short, quick creative bursts |
| Blog Post (500–1000 words) | ~3 hrs | 2–3 | Research + draft |
| Long-Form Article (2000w+) | ~8 hrs | 1 | Deep focus work |
| Ad Copy (3–5 variations) | ~1.5 hrs | 5 | Versioning takes time |
| Email Newsletter | ~2.5 hrs | 3 | Subject line testing + copy |

---

## How the System Will Use These Numbers

**Real-world example:**

> BardBox has 3 clients — Acme, BrandX, and FreshCo. On June 10th:
> - Acme needs 2 carousels + 1 static
> - BrandX needs 1 carousel
> - FreshCo needs 2 statics
>
> Total for June 10th: 3 carousels + 3 statics.  
> One designer can do max **3 carousels** or **5 statics** per day.  
> The system assigns: Designer A gets 3 carousels, Designer B gets 3 statics — both within daily limit. Done automatically, no manager needed.

When a task is created (from an uploaded monthly sheet or manually):

1. The system checks the content type of the task (e.g. "Carousel")
2. It looks up the daily capacity for that role + content type (e.g. Designer + Carousel = 3)
3. It counts how many tasks are already assigned to each person on the deadline day
4. It assigns to the team member with the most room — if everyone is full on that day, it finds the next available day automatically
5. No manual redistribution needed

---

## Emergency Task Behaviour

If a client calls in an emergency (e.g. a brand crisis, last-minute campaign, trending moment):

**Example:** On June 10th, a client calls at 9 AM — they need an emergency reel by EOD. Designer A already has 3 carousels scheduled (full day). The system:

1. Manager marks the reel as **Emergency** in BardBox
2. System finds Designer A's lowest-priority task on June 10th (e.g. a "low" priority static for another client)
3. That static is **automatically pushed to June 11th** (next slot where Designer A has room)
4. Designer A's original June 10th deadline for that static is saved — no data lost
5. Designer A sees their updated schedule immediately
6. The emergency reel takes the freed slot on June 10th

No phone calls. No manual re-scheduling. No missed deadlines.

---

## What Needs Manager Confirmation

Please review and answer the following:

- [ ] Are the capacity numbers above accurate for your team?
- [ ] Should capacity differ per seniority level (e.g. junior designer = 2 carousels/day, senior = 4)?
- [ ] Do you want to set capacity globally by role, or per individual employee?
- [ ] Are there content types missing from the list above that your team works on?
- [x] What is the standard working day? **9 AM – 6 PM, break 1–2 PM = 8 productive hours**
- [ ] Should weekends be excluded from scheduling, or handled case-by-case?

---

## Implementation Plan (Once Approved)

| Step | What Gets Built | Time Estimate |
|---|---|---|
| 1 | Database table for role × content type capacity | 1 day |
| 2 | Admin panel to view and edit capacity numbers | 1 day |
| 3 | Scheduling engine updated to use new capacity | 1 day |
| 4 | Testing with real task sheet import | 1 day |

Total: approximately 4 development days after approval.

---

*Prepared by: BardBox Studio Engineering Team*  
*Please fill in the checkboxes above and return with corrections. Once approved, development can begin immediately.*
