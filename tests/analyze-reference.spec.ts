/**
 * Reference site analysis — https://thebardbox.5day.io
 * Captures all API/network calls, screenshots every page visited,
 * and logs what features and endpoints are discovered.
 * Run with: npx playwright test tests/analyze-reference.spec.ts --headed --project=auth
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const OUT = path.join(__dirname, '..', 'screenshots', 'reference-analysis');
fs.mkdirSync(OUT, { recursive: true });

const BASE = 'https://thebardbox.5day.io';
const EMAIL = 'team@thebardbox.com';
const PASSWORD = 'BardboxLLP@705';
const apiCalls: { method: string; url: string; status?: number; body?: string }[] = [];

function logReq(method: string, url: string, status?: number, body?: string) {
  if (/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp|map)(\?|$)/.test(url)) return;
  if (url.includes('_next/static') || url.includes('__nextjs')) return;
  if (url.includes('generate_204')) return;
  apiCalls.push({ method, url, status, body });
  console.log(`[${method}] ${url}${status ? ` → ${status}` : ''}`);
}

test.describe('Reference site — thebardbox.5day.io', () => {

  test('full site analysis', async ({ page }) => {
    test.setTimeout(300_000); // 5 min — external site, lots of navigation

    // ── Intercept all requests ──────────────────────────────────────────────
    page.on('request', req => {
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        logReq(req.method(), req.url());
      }
    });

    page.on('response', async res => {
      const req = res.request();
      if (req.resourceType() === 'fetch' || req.resourceType() === 'xhr') {
        let body: string | undefined;
        try { body = (await res.text()).slice(0, 600); } catch {}
        logReq(req.method(), req.url(), res.status(), body);
      }
    });

    // ── 1. LOGIN ──────────────────────────────────────────────────────────
    console.log('\n=== 1. LOGIN ===');
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.screenshot({ path: path.join(OUT, '01-login-page.png'), fullPage: true });
    console.log('Pre-login URL:', page.url());

    // Fill login form (5day.io hosted login)
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passInput  = page.locator('input[type="password"]').first();

    await emailInput.waitFor({ timeout: 15_000 });
    await emailInput.fill(EMAIL);
    await passInput.fill(PASSWORD);
    await page.screenshot({ path: path.join(OUT, '01b-login-filled.png') });

    await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")').first().click();

    // Wait for redirect away from login
    await page.waitForURL(url => !url.toString().includes('login') && !url.toString().includes('auth'), { timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, '02-post-login.png'), fullPage: true });
    console.log('Post-login URL:', page.url());
    console.log('Title:', await page.title());
    console.log('H1:', await page.locator('h1').first().textContent().catch(() => 'none'));

    // ── 2. Target URL ──────────────────────────────────────────────────────
    console.log('\n=== 2. /project/p2/list ===');
    await page.goto(`${BASE}/project/p2/list`, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '02-project-p2-list.png'), fullPage: true });
    console.log('Title:', await page.title());
    console.log('URL:', page.url());

    // Capture all visible text headings
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log('Headings:', headings);

    // Capture nav links
    const navLinks = await page.locator('nav a, [role="navigation"] a').allTextContents();
    console.log('Nav links:', navLinks);

    // ── 3. Explore nav links from this page ───────────────────────────────
    console.log('\n=== 3. NAV EXPLORATION ===');
    const links = await page.locator('a[href]').all();
    const hrefs: string[] = [];
    for (const link of links) {
      const href = await link.getAttribute('href').catch(() => null);
      const text = await link.textContent().catch(() => '');
      if (href && !href.startsWith('http') && !href.startsWith('#') && href.length > 1) {
        hrefs.push(`${text?.trim()} → ${href}`);
      }
    }
    console.log('Internal links:', [...new Set(hrefs)].slice(0, 40));

    // ── 4. Try clicking sidebar/nav items ─────────────────────────────────
    const sidebarItems = await page.locator('aside a, [data-sidebar] a, nav li a').all();
    console.log(`\n=== 4. SIDEBAR ITEMS (${sidebarItems.length}) ===`);
    for (let i = 0; i < Math.min(sidebarItems.length, 8); i++) {
      const text = await sidebarItems[i].textContent().catch(() => '');
      const href = await sidebarItems[i].getAttribute('href').catch(() => '');
      console.log(`  Sidebar[${i}]: "${text?.trim()}" → ${href}`);
    }

    // ── 5. Click list items / table rows ──────────────────────────────────
    console.log('\n=== 5. LIST VIEW ===');
    const rows = page.locator('tr, [role="row"], .task-row, li[data-id]');
    const rowCount = await rows.count();
    console.log(`Row/item count: ${rowCount}`);
    if (rowCount > 0) {
      await rows.first().click().catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, '03-list-item-click.png'), fullPage: true });
      console.log('After row click URL:', page.url());
    }

    // ── 6. Check for boards/kanban/calendar views ──────────────────────────
    const viewLinks = [
      '/project/p2/board',
      '/project/p2/kanban',
      '/project/p2/calendar',
      '/project/p2/table',
      '/project/p2/timeline',
      '/project/p2/gantt',
    ];
    console.log('\n=== 6. VIEW VARIANTS ===');
    for (const path_ of viewLinks) {
      const res = await page.goto(`${BASE}${path_}`, { timeout: 10_000 }).catch(() => null);
      if (res && res.status() < 400) {
        await page.waitForTimeout(1000);
        const ss = path_.replace(/\//g, '-').replace(/^-/, '') + '.png';
        await page.screenshot({ path: path.join(OUT, ss), fullPage: true });
        console.log(`  ✓ ${path_} — ${res.status()} — title: ${await page.title()}`);
      } else {
        console.log(`  ✗ ${path_} — not found or error`);
      }
    }

    // ── 7. Check for auth / login page ────────────────────────────────────
    console.log('\n=== 7. AUTH PAGE ===');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: path.join(OUT, '07-login.png'), fullPage: true });
    console.log('Login URL:', page.url());
    const emailField = await page.locator('input[type="email"], input[name="email"]').count();
    console.log('Email field present:', emailField > 0);

    // ── 8. Check for API/settings page ────────────────────────────────────
    const extraRoutes = ['/settings', '/dashboard', '/projects', '/workspace', '/admin'];
    console.log('\n=== 8. EXTRA ROUTES ===');
    for (const r of extraRoutes) {
      const res = await page.goto(`${BASE}${r}`, { timeout: 10_000 }).catch(() => null);
      if (res) {
        await page.waitForTimeout(800);
        console.log(`  ${r} → ${page.url()} (${res.status()})`);
        await page.screenshot({ path: path.join(OUT, `extra${r.replace(/\//g, '-')}.png`) });
      }
    }

    // ── 9. Final API call summary ──────────────────────────────────────────
    console.log('\n=== API CALLS SUMMARY ===');
    const unique = [...new Map(apiCalls.map(c => [c.url, c])).values()];
    const apiOnly = unique.filter(c =>
      c.url.includes('/api/') || c.url.includes('supabase') ||
      c.url.includes('graphql') || c.url.includes('/trpc/') ||
      c.url.includes('/v1/') || c.url.includes('/rest/')
    );
    console.log(`Total XHR/fetch calls: ${unique.length}`);
    console.log(`API calls only: ${apiOnly.length}`);
    console.log('\nAll API calls:');
    for (const c of apiOnly) {
      console.log(`  [${c.method}] ${c.url} → ${c.status ?? '?'}`);
      if (c.body && c.status && c.status < 400) {
        console.log(`    Response preview: ${c.body.slice(0, 200)}`);
      }
    }

    // Write full report
    const report = {
      timestamp: new Date().toISOString(),
      totalRequests: unique.length,
      apiRequests: apiOnly,
      allRequests: unique,
    };
    fs.writeFileSync(
      path.join(OUT, 'api-report.json'),
      JSON.stringify(report, null, 2)
    );
    console.log(`\nFull report written to screenshots/reference-analysis/api-report.json`);
  });
});
