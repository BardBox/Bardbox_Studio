// @ts-check
'use strict';

/**
 * Bardbox Studio — One-Command Supabase Setup
 *
 * Reads credentials from ../.env.local and:
 *  1. Runs all 6 SQL migrations
 *  2. Configures auth redirect URLs + site URL
 *  3. Uploads all 4 branded email templates
 *  4. Creates the first admin user + profile
 *
 * Run: node scripts/setup.js
 */

const fs   = require('fs');
const path = require('path');

// ─── Terminal colours ───────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
};
const ok   = (msg) => console.log(`  ${c.green}✓${c.reset} ${msg}`);
const fail = (msg) => console.log(`  ${c.red}✗${c.reset} ${msg}`);
const info = (msg) => console.log(`  ${c.dim}→${c.reset} ${msg}`);
const head = (msg) => console.log(`\n${c.bold}${c.cyan}${msg}${c.reset}`);
const warn = (msg) => console.log(`  ${c.yellow}!${c.reset} ${msg}`);

// ─── Load .env.local ─────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    fail('.env.local not found. Copy .env.example → .env.local and fill it in.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  const env = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    val = val.replace(/\s+#.*$/, '').trim();
    val = val.replace(/^["']|["']$/g, '');
    env[key] = val;
  }
  return env;
}

// ─── Validate required vars ──────────────────────────────────────────────────
function validate(env) {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ACCESS_TOKEN',
    'NEXT_PUBLIC_APP_URL',
    'SETUP_ADMIN_EMAIL',
    'SETUP_ADMIN_NAME',
    'SETUP_ADMIN_PASSWORD',
  ];
  const placeholders = ['xxxxx', 'eyJhbGci...', 'your', '...', 'sbp_xxx'];
  const missing = required.filter((k) => {
    const v = env[k];
    if (!v) return true;
    return placeholders.some((p) => v.includes(p));
  });
  if (missing.length > 0) {
    fail('Missing or placeholder values in .env.local:');
    missing.forEach((k) => console.log(`     ${c.red}${k}${c.reset}`));
    console.log('\n  Fill in .env.local and run again.\n');
    process.exit(1);
  }
}

// ─── Supabase Management API helper ─────────────────────────────────────────
async function mgmt(method, endpoint, accessToken, body) {
  const res = await fetch(`https://api.supabase.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, data: json };
}

// ─── Extract project ref from URL ────────────────────────────────────────────
function getProjectRef(supabaseUrl) {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0];
  } catch {
    fail(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
    process.exit(1);
  }
}

// ─── Step 1: Run SQL migrations ───────────────────────────────────────────────
async function runMigrations(projectRef, accessToken) {
  head('Step 1 — Running SQL migrations');

  const files = [
    '01_schema.sql',
    '02_functions.sql',
    '03_views.sql',
    '04_rls.sql',
    '05_seed.sql',
    '06_roles_leave.sql',
    '07_task_requests_clients.sql',
  ];

  for (const file of files) {
    const filePath = path.join(__dirname, '..', 'supabase', file);
    if (!fs.existsSync(filePath)) {
      warn(`${file} not found — skipping`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf-8');
    info(`Running ${file} ...`);

    const result = await mgmt('POST', `/projects/${projectRef}/database/query`, accessToken, { query: sql });
    if (result.ok) {
      ok(file);
    } else {
      const msg = result.data?.message ?? result.data?.error ?? JSON.stringify(result.data);
      // Idempotency warnings — safe to continue
      if (msg && (msg.includes('already exists') || msg.includes('does not exist'))) {
        warn(`${file} — ${msg.slice(0, 120)} (safe to ignore)`);
      } else {
        fail(`${file} — ${msg?.slice(0, 200) ?? 'unknown error'}`);
      }
    }
  }
}

// ─── Step 2: Configure Auth ───────────────────────────────────────────────────
async function configureAuth(projectRef, accessToken, appUrl) {
  head('Step 2 — Configuring Auth settings');

  // Deduplicate in case appUrl is localhost
  const redirectSet = new Set([
    `${appUrl}/api/auth/callback`,
    'http://localhost:3000/api/auth/callback',
  ]);
  const redirectUrls = [...redirectSet].join(',');

  info(`Site URL: ${appUrl}`);
  info(`Redirect URLs: ${redirectUrls}`);

  const result = await mgmt('PATCH', `/projects/${projectRef}/config/auth`, accessToken, {
    site_url: appUrl,
    additional_redirect_urls: redirectUrls,
    mailer_autoconfirm: false,
    disable_signup: true,
  });

  if (result.ok) {
    ok('Auth settings updated');
  } else {
    fail(`Auth config failed: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
}

// ─── Step 3: Upload email templates ──────────────────────────────────────────
async function uploadEmailTemplates(projectRef, accessToken) {
  head('Step 3 — Uploading email templates');

  const templates = [
    { key: 'invite',       file: 'invite.html',         subject: "You're invited to Bardbox Studio" },
    { key: 'recovery',     file: 'reset-password.html', subject: 'Reset your Bardbox Studio password' },
    { key: 'magic_link',   file: 'magic-link.html',     subject: 'Your Bardbox Studio sign-in link' },
    { key: 'email_change', file: 'email-change.html',   subject: 'Confirm your new email address — Bardbox Studio' },
  ];

  // Build a single PATCH body with all template subjects + contents
  // Supabase auth config fields: mailer_subjects_* and mailer_templates_*
  const configBody = {};
  const loaded = [];

  for (const tpl of templates) {
    const filePath = path.join(__dirname, '..', 'emails', tpl.file);
    if (!fs.existsSync(filePath)) {
      warn(`${tpl.file} not found — skipping`);
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    configBody[`mailer_subjects_${tpl.key}`] = tpl.subject;
    configBody[`mailer_templates_${tpl.key}`] = content;
    loaded.push(tpl);
  }

  if (loaded.length === 0) return;

  const result = await mgmt('PATCH', `/projects/${projectRef}/config/auth`, accessToken, configBody);

  if (result.ok) {
    loaded.forEach((t) => ok(`${t.key} template uploaded`));
  } else {
    // API doesn't support template content — print manual steps
    warn('Template API not available — paste them manually in the Supabase dashboard:');
    info('Supabase → Auth → Email Templates, then for each:');
    loaded.forEach((t) => {
      console.log(`     ${c.cyan}${t.key}${c.reset} → paste ${c.dim}emails/${t.file}${c.reset}`);
    });
  }
}

// ─── Step 3b: Configure SMTP so invite emails use Gmail ──────────────────────
async function configureSmtp(projectRef, accessToken, env) {
  const host = env.EMAIL_HOST;
  const user = env.EMAIL_USER;
  const pass = env.EMAIL_PASS;

  head('Step 3b — Configuring SMTP');

  if (!host || !user || !pass) {
    warn('EMAIL_HOST / EMAIL_USER / EMAIL_PASS not set — skipping SMTP config');
    info('Invite emails will use Supabase built-in SMTP (rate-limited).');
    return;
  }

  info(`SMTP host: ${host}  user: ${user}`);

  const result = await mgmt('PATCH', `/projects/${projectRef}/config/auth`, accessToken, {
    smtp_admin_email: env.EMAIL_FROM ?? user,
    smtp_host:        host,
    smtp_port:        String(env.EMAIL_PORT ?? '587'),
    smtp_user:        user,
    smtp_pass:        pass,
    smtp_sender_name: 'Bardbox Studio',
  });

  if (result.ok) {
    ok('SMTP configured — invite emails will use Gmail');
  } else {
    warn(`SMTP config failed: ${JSON.stringify(result.data).slice(0, 160)}`);
    info('Invite emails will fall back to Supabase built-in SMTP.');
  }
}


// ─── Step 4: Create admin user via supabase-js admin client ──────────────────
async function createAdminUser(supabaseUrl, serviceKey, adminEmail, adminName, adminPassword) {
  head('Step 4 — Creating admin user');
  info(`Email: ${adminEmail}`);
  info(`Name:  ${adminName}`);

  // Use supabase-js so it handles both old JWT keys and new sb_secret_ key format
  let createClient;
  try {
    ({ createClient } = await import('@supabase/supabase-js'));
  } catch {
    fail('Could not import @supabase/supabase-js — run: npm install');
    return null;
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Try to create the user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { full_name: adminName },
  });

  let userId;

  if (!createErr) {
    userId = created.user.id;
    ok(`Auth user created (${userId})`);
  } else if (
    createErr.message?.includes('already been registered') ||
    createErr.message?.includes('already exists') ||
    createErr.code === 'email_exists'
  ) {
    warn('User already exists — looking up existing user ID');
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listErr) {
      fail(`Could not list users: ${listErr.message}`);
      return null;
    }
    const existing = list.users.find(
      (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    );
    if (!existing) {
      fail('User not found. Create manually in Supabase → Auth → Users.');
      return null;
    }
    userId = existing.id;
    ok(`Found existing user (${userId})`);
  } else {
    fail(`Could not create user: ${createErr.message}`);
    return null;
  }

  // Upsert admin profile
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      { id: userId, full_name: adminName, role: 'admin', email: adminEmail, max_concurrent_tasks: 10, is_active: true },
      { onConflict: 'id' }
    );

  if (profileErr) {
    fail(`Profile upsert failed: ${profileErr.message}`);
  } else {
    ok('Admin profile ready');
  }

  return userId;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════╗`);
  console.log(`║   Bardbox Studio — Supabase Setup         ║`);
  console.log(`╚══════════════════════════════════════════╝${c.reset}`);

  const env = loadEnv();
  validate(env);

  const {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    SUPABASE_ACCESS_TOKEN: accessToken,
    NEXT_PUBLIC_APP_URL: appUrl,
    SETUP_ADMIN_EMAIL: adminEmail,
    SETUP_ADMIN_NAME: adminName,
    SETUP_ADMIN_PASSWORD: adminPassword,
  } = env;

  const projectRef = getProjectRef(supabaseUrl);
  info(`Project ref: ${projectRef}`);
  info(`App URL:     ${appUrl}`);

  await runMigrations(projectRef, accessToken);
  await configureAuth(projectRef, accessToken, appUrl);
  await configureSmtp(projectRef, accessToken, env);
  await uploadEmailTemplates(projectRef, accessToken);
  const userId = await createAdminUser(supabaseUrl, serviceKey, adminEmail, adminName, adminPassword);

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.green}═══════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.green}  Setup complete!${c.reset}`);
  console.log(`${c.green}═══════════════════════════════════════════${c.reset}\n`);

  if (userId) {
    console.log(`  Login at: ${c.cyan}${appUrl}/login${c.reset}`);
    console.log(`  Email:    ${c.cyan}${adminEmail}${c.reset}`);
    console.log(`  Role:     ${c.cyan}admin${c.reset}`);
  }

  if (appUrl.includes('localhost')) {
    console.log();
    warn('App URL is localhost — after deploying to Vercel, update NEXT_PUBLIC_APP_URL');
    warn('and run this script again to register the production redirect URL.');
  }

  console.log(`\n  ${c.bold}npm run dev${c.reset}  →  login at /login\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err.message ?? err);
  process.exit(1);
});
