# 🛠️ Tech Stack & Dependencies

## Core Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + Base UI |
| DB / Auth / Realtime | Supabase |
| Deploy — App | Vercel |
| Deploy — DB | Supabase (managed) |
| Sheet Sync | Google Apps Script → Webhook → Next.js → Supabase |

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `@supabase/supabase-js` | Supabase client |
| `@supabase/ssr` | SSR-safe Supabase auth helpers |
| `@anthropic-ai/sdk` | Claude AI features |
| `@google/generative-ai` | Gemini AI features |
| `react-hook-form` + `zod` | Forms + validation |
| `date-fns` | Date manipulation |
| `recharts` | Charts (manager dashboard) |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |
| `nodemailer` | Email (team invite emails) |
| `embla-carousel-react` | Carousels |
| `xlsx` | Excel export |
| `next-themes` | Dark/light mode |

---

## Dev Dependencies

| Package | Purpose |
|---|---|
| `@playwright/test` | E2E testing |
| `eslint` + `eslint-config-next` | Linting |
| `tailwindcss` v4 | CSS framework |

---

## Scripts

| Command | What It Does |
|---|---|
| `npm run dev` | Start dev server on :3000 |
| `npm run build` | Production build |
| `npm run setup` | One-time: provision Supabase + create first admin |
| `npm run screenshot` | Playwright screenshots of all pages |

---

## Links

- [[Env Vars]] — all env variables explained
- [[Supabase Setup]] — DB schema and config
