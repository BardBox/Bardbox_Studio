# 🔑 Environment Variables

> File location: `Bardbox_Studio/.env.local`  
> ⚠️ Never commit this file. It's in `.gitignore`.

---

## Required Variables

### Supabase
| Variable | Where to Find | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon/public | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | ✅ Yes (server only) |

### App
| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (dev) or Vercel URL (prod) | ✅ Yes |

### Email (Nodemailer)
| Variable | Value | Required |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | ✅ Yes |
| `EMAIL_PORT` | `587` | ✅ Yes |
| `EMAIL_SECURE` | `false` | ✅ Yes |
| `EMAIL_USER` | Gmail address | ✅ Yes |
| `EMAIL_PASS` | Gmail App Password (not real password) | ✅ Yes |
| `EMAIL_FROM` | Sender display email | ✅ Yes |

> Gmail App Password: myaccount.google.com → Security → 2-Step Verification → App passwords

### AI
| Variable | Where to Find | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | For AI features |
| `GEMINI_API_KEY` | Google AI Studio | For AI features |

### Google Sheets Sync
| Variable | Notes | Required |
|---|---|---|
| `SHEETS_WEBHOOK_SECRET` | Any random 32-char string | For sheet sync |
| `APPS_SCRIPT_WEBAPP_URL` | From Apps Script → Deploy → Web App URL | For sheet sync |
| `APPS_SCRIPT_WEBAPP_SECRET` | Any random string (must match Apps Script) | For sheet sync |

### Setup Script (one-time only)
| Variable | Notes |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from supabase.com/dashboard/account/tokens |
| `SETUP_ADMIN_EMAIL` | First admin account email |
| `SETUP_ADMIN_NAME` | First admin name |
| `SETUP_ADMIN_PASSWORD` | First admin password |

---

## Vercel Production Env Vars

Add all the above at: Vercel Dashboard → Project → Settings → Environment Variables

Change `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL in production.
