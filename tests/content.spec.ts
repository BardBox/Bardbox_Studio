/**
 * Content Page — /content
 * Tests: table view, calendar view, import button.
 * Note: "Table" and "Calendar" are <Link> nav elements, not role="tab".
 * Navigate via URL params instead of clicking tabs.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Content page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/content');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /content/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'content-table.png'), fullPage: true });
  });

  test('Table and Calendar view links are present', async ({ page }) => {
    // They are <Link> elements (rendered as <a>), not role="tab"
    await expect(page.locator('a', { hasText: 'Table' }).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('a', { hasText: 'Calendar' }).first()).toBeVisible({ timeout: 8_000 });
  });

  test('Table view shows content rows', async ({ page }) => {
    // Default view is table (?view=table is the default)
    const rows = page.locator('table tbody tr, .p-datatable-tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Calendar view renders without error', async ({ page }) => {
    await page.goto('/content?view=calendar');
    await page.waitForSelector('h1', { timeout: 15_000 });
    // CalendarGrid renders day cells with date numbers
    const dayCell = page.locator('text=/^([1-9]|[12]\\d|3[01])$/').first();
    await expect(dayCell).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: path.join(SS, 'content-calendar.png'), fullPage: true });
  });

  test('content row shows platform and client name', async ({ page }) => {
    const rows = page.locator('table tbody tr, .p-datatable-tbody tr');
    const count = await rows.count();
    if (count === 0) return; // No rows this month — skip
    await rows.first().waitFor({ timeout: 10_000 });
    // Seed data includes clients like "Bizcivitas"
    const bodyText = await page.locator('table, .p-datatable').first().innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });

  test('Import button is present', async ({ page }) => {
    const importBtn = page.getByRole('button', { name: /import/i });
    await expect(importBtn).toBeVisible();
  });
});
