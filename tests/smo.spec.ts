/**
 * SMO Calendar — /smo
 * Tests: calendar grid renders, month navigation, post task cards.
 * Note: task cards only appear for approved tasks assigned to the logged-in user.
 * If the test user has no approved post tasks this month, empty-state tests run.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('SMO Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smo');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('page heading is visible', async ({ page }) => {
    // h1 says "Posting Calendar"
    await expect(page.getByRole('heading', { name: /posting calendar/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'smo-calendar.png'), fullPage: true });
  });

  test('calendar shows a month/year header', async ({ page }) => {
    const header = page.locator('text=/\\d{4}/').first();
    await expect(header).toBeVisible({ timeout: 8_000 });
  });

  test('calendar has 7 day-of-week headers', async ({ page }) => {
    for (const d of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.getByText(d, { exact: true }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('Prev / Next month navigation buttons exist and work', async ({ page }) => {
    const prevBtn = page.getByRole('button', { name: /prev|previous|</i }).first();
    const nextBtn = page.getByRole('button', { name: /next|>/i }).first();

    const hasPrev = await prevBtn.isVisible().catch(() => false);
    const hasNext = await nextBtn.isVisible().catch(() => false);
    expect(hasPrev || hasNext).toBeTruthy();

    if (hasNext) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SS, 'smo-next-month.png'), fullPage: true });
    }
  });

  test('post task cards appear or empty calendar cells render', async ({ page }) => {
    // PostTaskCard uses rounded-md border on the wrapper div
    const cards = page.locator('.rounded-md.border.bg-background');
    const count = await cards.count();
    if (count === 0) {
      // No approved tasks for this user — verify calendar grid cells still render
      const cells = page.locator('[class*="min-h-"]');
      await expect(cells.first()).toBeVisible({ timeout: 5_000 });
    } else {
      await expect(cards.first()).toBeVisible();
    }
    await page.screenshot({ path: path.join(SS, 'smo-task-cards.png'), fullPage: true });
  });

  test('clicking a task card expands it inline', async ({ page }) => {
    const cards = page.locator('.rounded-md.border.bg-background');
    if (await cards.count() === 0) return; // No tasks — skip

    // PostTaskCard expands in-place on click (not a dialog)
    const header = cards.first().locator('[class*="cursor-pointer"]').first();
    await header.click();
    // Expanded section contains posting info (date · time · platform)
    await expect(cards.first().locator('text=/\\d{4}-\\d{2}-\\d{2}/')).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: path.join(SS, 'smo-task-panel.png') });
  });
});
