# 🏗️ App Architecture & Routes

## Folder Structure

```
Bardbox_Studio/
├── app/
│   ├── (app)/                    ← Protected routes (requires login)
│   │   ├── admin/                ← Admin: team, roles, settings
│   │   ├── ceo/                  ← CEO: approvals dashboard
│   │   ├── content/              ← Content calendar view
│   │   ├── designer/             ← Designer task view
│   │   ├── hr/                   ← HR: team + leave management
│   │   ├── manager/              ← Manager: tasks, clients, requests
│   │   ├── request-task/         ← Task request flow
│   │   └── smo/                  ← SMO: posting calendar
│   ├── (auth)/                   ← Public routes
│   │   ├── login/                ← Login page
│   │   └── set-password/         ← First-time password set
│   └── api/                      ← API routes
│       ├── admin/                ← Admin APIs (roles, AI settings)
│       ├── ai/                   ← AI features (Claude + Gemini)
│       ├── auth/                 ← Auth endpoints
│       ├── clients/              ← Client management
│       ├── content/              ← Content row CRUD
│       ├── leave/                ← Leave calendar
│       ├── sheets/               ← Google Sheets webhook + push-back
│       └── tasks/                ← Task CRUD + override
├── components/                   ← Shared UI components
├── lib/
│   ├── supabase/
│   │   ├── client.ts             ← Browser anon client
│   │   ├── server.ts             ← Server service-role client
│   │   └── middleware-client.ts  ← Middleware SSR client
│   ├── ai.ts                     ← AI helper (Claude + Gemini)
│   ├── email.ts                  ← Nodemailer email sender
│   └── utils.ts                  ← Shared utilities
├── supabase/                     ← SQL migration files
├── scripts/                      ← Setup + screenshot scripts
└── __vault/                      ← This Obsidian vault
```

---

## Route → Role Access Map

| Route | Roles |
|---|---|
| `/designer` | designer |
| `/smo` | smo |
| `/manager/*` | manager |
| `/ceo/*` | ceo |
| `/hr` | hr |
| `/admin/*` | admin |
| `/content` | all authenticated |
| `/request-task` | all authenticated |

---

## Data Flow

```
Google Sheet
    ↓ (Apps Script webhook on edit)
POST /api/sheets/webhook
    ↓
Supabase: content_rows table
    ↓ (DB trigger / function)
Two tasks auto-created in tasks table
    ↓
Auto-assign function → lightest-loaded team member
    ↓
Push-back: /api/sheets/push-back → updates Sheet Status column
```

---

## Auth Flow

```
Login → Supabase Auth → Session cookie → Middleware verifies → Role-based redirect
Set-password → Supabase Auth update → Redirect to role dashboard
```

---

## Links

- [[Roles & Permissions]]
- [[Supabase Setup]]
- [[Features/Sheet Sync]]
