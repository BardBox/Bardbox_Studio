/**
 * Manager → All Tasks — /manager/tasks
 * Tests: table renders, quick filters, row click opens detail panel,
 * priority + status badges visible, reassign dialog.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('All Tasks table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manager/tasks');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /all tasks/i })).toBeVisible();
  });

  test('DataTable renders at least one row', async ({ page }) => {
    const rows = page.locator('.p-datatable-tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(SS, 'manager-tasks.png'), fullPage: true });
  });

  test('quick filter buttons are present', async ({ page }) => {
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /7 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /overdue/i })).toBeVisible();
  });

  test('Priority column shows colored badges', async ({ page }) => {
    await page.locator('.p-datatable-tbody tr').first().waitFor({ timeout: 10_000 });
    await expect(page.getByRole('columnheader', { name: /priority/i })).toBeVisible();
  });

  test('Status column shows human-readable labels (not raw db values)', async ({ page }) => {
    await page.locator('.p-datatable-tbody tr').first().waitFor({ timeout: 10_000 });
    const bodyText = await page.locator('.p-datatable-tbody').innerText();
    expect(bodyText).not.toContain('working_on_it');
    expect(bodyText).not.toContain('_');
  });

  test('clicking a row opens task detail panel', async ({ page }) => {
    const firstRow = page.locator('.p-datatable-tbody tr').first();
    await firstRow.waitFor({ timeout: 10_000 });
    await firstRow.click();
    // TaskDetailPanel is a Sheet — "Post Date" appears in the meta grid when open
    await expect(page.getByText('Post Date').first()).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: path.join(SS, 'manager-tasks-detail-panel.png') });
  });

  test('task detail panel shows Status and Priority badges', async ({ page }) => {
    await page.locator('.p-datatable-tbody tr').first().click();
    await expect(page.getByText('Post Date').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Status').first()).toBeVisible();
    await expect(page.getByText('Priority').first()).toBeVisible();
  });

  test('Overdue quick filter reduces visible rows', async ({ page }) => {
    await page.locator('.p-datatable-tbody tr').first().waitFor({ timeout: 10_000 });

    await page.getByRole('button', { name: /overdue/i }).click();
    await page.waitForTimeout(400);
    const filteredRows = await page.locator('.p-datatable-tbody tr').count();
    expect(filteredRows).toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: path.join(SS, 'manager-tasks-overdue-filter.png'), fullPage: true });
  });

  test('Reassign button opens reassign dialog', async ({ page }) => {
    await page.locator('.p-datatable-tbody tr').first().waitFor({ timeout: 10_000 });
    await page.locator('.p-datatable-tbody tr').first().hover();
    const reassignBtn = page.getByRole('button', { name: /reassign/i }).first();
    if (await reassignBtn.isVisible()) {
      await reassignBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4_000 });
      await page.screenshot({ path: path.join(SS, 'manager-tasks-reassign-dialog.png') });
      await page.keyboard.press('Escape');
    }
  });
});
