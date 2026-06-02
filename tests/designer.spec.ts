/**
 * Designer Kanban board — /designer
 * Tests: page loads, kanban columns, task cards, detail panel.
 * Note: tasks are filtered by the logged-in user's assignee_id.
 * If the test user has no design tasks, empty-state tests run instead.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Designer Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('page heading is visible', async ({ page }) => {
    // h1 says "My Design Tasks"
    await expect(page.getByRole('heading', { name: /design/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'designer.png'), fullPage: true });
  });

  test('kanban pressure columns are present', async ({ page }) => {
    for (const label of ['Overdue', 'Critical', 'Approaching', 'On Track']) {
      await expect(page.getByText(label, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('task cards are present or empty-state shown', async ({ page }) => {
    // TaskCard uses shadcn Card → renders data-slot="card"
    const cards = page.locator('[data-slot="card"]');
    const count = await cards.count();
    if (count === 0) {
      await expect(page.getByText('No tasks').first()).toBeVisible({ timeout: 5_000 });
    } else {
      await expect(cards.first()).toBeVisible();
    }
  });

  test('clicking a task card opens TaskDetailPanel', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    if (await cards.count() === 0) return; // No tasks — skip
    await cards.first().click();
    // TaskDetailPanel shows "Post Date" in the meta grid when open
    await expect(page.getByText('Post Date').first()).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: path.join(SS, 'designer-task-panel.png') });
  });

  test('task detail panel shows Start Working / Submit Design buttons', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    if (await cards.count() === 0) return;
    await cards.first().click();
    await expect(page.getByText('Post Date').first()).toBeVisible({ timeout: 5_000 });
    const btn = page.getByRole('button', { name: /start working|submit design|approved|done/i });
    await expect(btn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('panel Close button dismisses the sheet', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    if (await cards.count() === 0) return;
    await cards.first().click();
    await expect(page.getByText('Post Date').first()).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
    await expect(page.getByText('Post Date')).not.toBeVisible({ timeout: 3_000 });
  });
});
