# ✅ Feature: Approval Flow

**Status:** 📋 Planned (Phase 3)

---

## Flow

```
Designer marks task "submitted"
    ↓
Manager gets notification
    ↓
Manager reviews → Approve or Reject
    ↓
If Approved:
    → Creative uploaded to Supabase Storage
    → SMO gets "ready to post" status
    → WhatsApp alert to SMO
If Rejected:
    → Reason given
    → Task goes back to "in-design"
    → Designer gets WhatsApp alert
```

---

## Storage

Creative files stored in **Supabase Storage** bucket.
Path: `creatives/{task_id}/{filename}`

---

## API Endpoints Needed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/tasks/[id]/submit` | POST | Designer submits creative |
| `/api/tasks/[id]/approve` | POST | Manager approves |
| `/api/tasks/[id]/reject` | POST | Manager rejects with reason |
| `/api/tasks/[id]/upload` | POST | Upload file to Storage |

---

## TODO

- [ ] Supabase Storage bucket setup
- [ ] File upload component (designer)
- [ ] Approval UI (manager)
- [ ] Rejection reason input
- [ ] Status updates in DB
- [ ] Notifications (Phase 4)
