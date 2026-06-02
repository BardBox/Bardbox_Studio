/**
 * Global setup — runs ONCE before the entire test suite.
 * Logs in as admin, saves cookies to .auth-state.json so all
 * other specs reuse the session without logging in again.
 */
import { chromium } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth-state.json');

async function globalSetup() {
  const browser = await chromium.launch();
  const page    = await browser.newPage();

  await page.goto('http://localhost:3000/login');
  await page.waitForSelector('#email', { timeout: 15_000 });

  await page.fill('#email',    'saucesensei001@gmail.com');
  await page.fill('#password', 'asdasd123');
  await page.click('button[type="submit"]');

  // Middleware redirects admin → /manager
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20_000 });

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();

  console.log('  ✓ Auth state saved to tests/setup/.auth-state.json');
}

export default globalSetup;
