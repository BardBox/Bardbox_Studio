// @ts-check
'use strict';

/**
 * Bardbox Studio — Auto Screenshot All Pages
 *
 * Logs in as admin, then visits every role-specific page and captures
 * full-page screenshots into screenshots/before/ for Google Stitch input.
 *
 * Usage:
 *   node scripts/screenshot-all.js
 *
 * Prerequisites:
 *   - npm run dev is running on localhost:3000
 *   - npm install -D @playwright/test
 *   - npx playwright install chromium
 */

const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL   = 'http://localhost:3000';
const EMAIL      = 'saucesensei001@gmail.com';
const PASSWORD   = 'asdasd123';
const OUT_DIR    = path.join(__dirname, '..', 'screenshots', 'before');

// All pages to capture — label is used as the filename
const PAGES = [
  { label: '01_login',             url: '/login',             skipAuth: true },
  { label: '02_set-password',      url: '/set-password',      skipAuth: true },
  { label: '03_content',           url: '/content' },
  { label: '04_request-task',      url: '/request-task' },
  { label: '05_manager',           url: '/manager' },
  { label: '06_manager-tasks',     url: '/manager/tasks' },
  { label: '07_manager-requests',  url: '/manager/requests' },
  { label: '08_manager-clients',   url: '/manager/clients' },
  { label: '09_ceo',               url: '/ceo' },
  { label: '10_ceo-approvals',     url: '/ceo/approvals' },
  { label: '11_designer',          url: '/designer' },
  { label: '12_smo',               url: '/smo' },
  { label: '13_hr',                url: '/hr' },
  { label: '14_admin-settings',    url: '/admin/settings' },
  { label: '15_admin-team',        url: '/admin/team' },
];

// ─── Colours ─────────────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════╗`);
  console.log(`║   Bardbox Studio — Page Screenshots       ║`);
  console.log(`╚══════════════════════════════════════════╝${c.reset}`);

  // Ensure output dir exists
  fs.mkdirSync(OUT_DIR, { recursive: true });
  info(`Saving screenshots to: screenshots/before/`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  // ── Login once and reuse the session ────────────────────────────────────────
  head('Logging in...');
  const loginPage = await context.newPage();
  await loginPage.goto(`${BASE_URL}/login`);
  await loginPage.waitForLoadState('networkidle');

  await loginPage.fill('input[type="email"], input[name="email"]', EMAIL);
  await loginPage.fill('input[type="password"], input[name="password"]', PASSWORD);
  await loginPage.click('button[type="submit"]');

  // Wait for redirect away from /login
  try {
    await loginPage.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    ok('Logged in successfully');
  } catch {
    fail('Login did not redirect — check credentials or that dev server is running');
    await browser.close();
    process.exit(1);
  }
  await loginPage.close();

  // ── Screenshot each page ────────────────────────────────────────────────────
  head('Capturing pages...');

  const authlessContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  for (const { label, url, skipAuth } of PAGES) {
    const page = await (skipAuth ? authlessContext : context).newPage();
    const fullUrl = `${BASE_URL}${url}`;

    try {
      info(`${label}  →  ${fullUrl}`);
      await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 15000 });

      // Extra wait for any client-side data fetching
      await page.waitForTimeout(1000);

      const outPath = path.join(OUT_DIR, `${label}.png`);
      await page.screenshot({ path: outPath, fullPage: true });
      ok(`${label}.png`);
    } catch (err) {
      fail(`${label} — ${err.message?.slice(0, 100)}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  // ── Summary ─────────────────────────────────────────────────────────────────
  const saved = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
  console.log(`\n${c.bold}${c.green}═══════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.green}  Done! ${saved.length} screenshots saved.${c.reset}`);
  console.log(`${c.green}═══════════════════════════════════════════${c.reset}`);
  console.log(`\n  Folder: ${c.cyan}${OUT_DIR}${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Unexpected error:${c.reset}`, err.message ?? err);
  process.exit(1);
});
