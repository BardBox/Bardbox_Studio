// @ts-check
'use strict';

/**
 * Bardbox Studio — Playwright Screenshot Script
 *
 * Logs in as admin and captures screenshots of all major pages.
 * Saves to screenshots/after/
 *
 * Prerequisites:
 *   1. npm run dev  (dev server on http://localhost:3000)
 *   2. node scripts/screenshot.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs   = require('fs');

const BASE_URL = 'http://localhost:3000';
const EMAIL    = 'saucesensei001@gmail.com';
const PASSWORD = 'asdasd123';
const OUT_DIR  = path.join(__dirname, '..', 'screenshots', 'after');

const PAGES = [
  { slug: '01_login',           url: '/login',              waitFor: 'input[type="email"]' },
  { slug: '02_manager',         url: '/manager',            waitFor: 'h1' },
  { slug: '03_manager-tasks',   url: '/manager/tasks',      waitFor: 'h1' },
  { slug: '04_manager-requests',url: '/manager/requests',   waitFor: 'h1' },
  { slug: '05_manager-clients', url: '/manager/clients',    waitFor: 'h1' },
  { slug: '06_ceo',             url: '/ceo',                waitFor: 'h1' },
  { slug: '07_ceo-approvals',   url: '/ceo/approvals',      waitFor: 'h1' },
  { slug: '08_designer',        url: '/designer',           waitFor: 'h1' },
  { slug: '09_smo',             url: '/smo',                waitFor: 'h1' },
  { slug: '10_content',         url: '/content',            waitFor: 'h1' },
  { slug: '11_hr',              url: '/hr',                 waitFor: 'h1' },
  { slug: '12_admin-team',      url: '/admin/team',         waitFor: 'h1' },
  { slug: '13_admin-settings',  url: '/admin/settings',     waitFor: 'h1' },
];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log('→ Logging in…');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]',    EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.includes('/login'), { timeout: 15_000 });
  console.log('  ✓ Logged in');

  // ── Screenshot each page ───────────────────────────────────────────────────
  for (const { slug, url, waitFor } of PAGES.slice(1)) { // skip login page
    try {
      await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle', timeout: 20_000 });
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(600); // let charts/animations settle
      const file = path.join(OUT_DIR, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`  ✓ ${slug}.png`);
    } catch (err) {
      console.log(`  ✗ ${slug} — ${err.message?.slice(0, 80)}`);
    }
  }

  // ── CreateTaskDialog screenshot ────────────────────────────────────────────
  try {
    await page.goto(`${BASE_URL}/manager`, { waitUntil: 'networkidle', timeout: 20_000 });
    await page.waitForSelector('button:has-text("+ New Task")', { timeout: 8_000 });
    await page.click('button:has-text("+ New Task")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
    await page.waitForTimeout(400);
    const file = path.join(OUT_DIR, '02b_create-task-dialog.png');
    await page.screenshot({ path: file, fullPage: false });
    console.log('  ✓ 02b_create-task-dialog.png');
  } catch (err) {
    console.log(`  ✗ create-task-dialog — ${err.message?.slice(0, 80)}`);
  }

  await browser.close();
  console.log(`\nDone — screenshots saved to screenshots/after/`);
}

run().catch(err => {
  console.error('Fatal:', err.message ?? err);
  process.exit(1);
});
