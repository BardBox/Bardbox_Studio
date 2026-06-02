/**
 * Manager → Requests — /manager/requests
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Task Requests page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manager/requests');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /requests/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'manager-requests.png'), fullPage: true });
  });

  test('shows request rows or a no-requests empty state', async ({ page }) => {
    const rows  = await page.locator('table tbody tr').count();
    const empty = await page.getByText(/no pending|no requests/i).isVisible().catch(() => false);
    expect(rows > 0 || empty).toBeTruthy();
  });

  test('reject button opens a dialog with a notes textarea', async ({ page }) => {
    const rows = await page.locator('table tbody tr').count();
    if (rows === 0) {
      test.skip();
      return;
    }
    await page.getByRole('button', { name: /reject/i }).first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4_000 });
    await expect(page.getByRole('textbox')).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'manager-requests-reject-dialog.png') });
    await page.keyboard.press('Escape');
  });
});
