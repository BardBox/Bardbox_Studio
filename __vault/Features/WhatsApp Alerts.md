# 📱 Feature: WhatsApp Alerts

**Status:** 📋 Planned (Phase 4)

---

## Planned Alerts

| Trigger | Recipient | Message |
|---|---|---|
| New task assigned | Designer | "New task: {brief}, due {date}" |
| Creative approved | SMO | "{platform} creative approved, ready to post on {date}" |
| Task overdue | Manager | "{designer} task for {client} is overdue" |
| Low pipeline buffer | Manager | "Only {n} tasks scheduled for next 7 days" |

---

## Integration

Uses existing **Baileys** WhatsApp setup (from bizcivitas project).

Each user's `whatsapp_number` stored in `profiles` table.

---

## TODO

- [ ] Connect to Baileys instance
- [ ] Create notification service
- [ ] Trigger on task status changes
- [ ] Manager alert for pipeline health
