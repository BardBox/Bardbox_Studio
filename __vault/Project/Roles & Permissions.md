# 👥 Roles & Permissions

## Roles

| Role | Description | Dashboard Route |
|---|---|---|
| `designer` | Creates visual content | `/designer` |
| `smo` | Posts content on platforms | `/smo` |
| `manager` | Oversees team, manages clients, can override assignments | `/manager` |
| `ceo` | Approvals only | `/ceo` |
| `hr` | Team management, leave calendar | `/hr` |
| `admin` | Full access — team, roles, AI settings, system config | `/admin` |

---

## What Each Role Can Do

### Designer
- See their assigned design tasks
- Kanban view sorted by pressure level (urgent → comfortable)
- Upload creative assets
- Mark task done → triggers approval flow

### SMO (Social Media Officer)
- Calendar view by posting date
- See approved creatives ready to post
- Post checklist per content row
- Mark posted

### Manager
- Full pipeline view — all tasks, all team members
- Override assignee on any task
- See team load (who is overloaded)
- Approve/reject designer submissions
- Manage clients

### CEO
- Approvals dashboard (high-level)
- View pipeline throughput

### HR
- Team member list
- Leave/holiday calendar (affects auto-assign)
- Active status management

### Admin
- Everything above
- Add/remove users
- Change roles
- Configure AI settings
- System-wide settings

---

## Supabase RLS (Row-Level Security)

Row-level security is enforced in `supabase/04_rls.sql`.

- Designers only see tasks assigned to them
- Managers see all tasks in their team
- Admin bypasses all restrictions (service-role key on server)

---

## Adding a New User

1. Go to Supabase Dashboard → Auth → Users → Invite user
2. After they confirm email, run this SQL:

```sql
INSERT INTO public.profiles (id, full_name, role, whatsapp_number, is_active)
VALUES ('<uuid-from-auth>', 'Name Here', 'designer', '+91...', true);
```

Replace role with: `designer` / `smo` / `manager` / `ceo` / `hr` / `admin`
