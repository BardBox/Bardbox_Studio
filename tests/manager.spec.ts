/**
 * Manager Dashboard — /manager
 * Tests: KPI cards, team load table, create-task dialog (full flow).
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Manager Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manager');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('page heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /manager dashboard/i })).toBeVisible();
  });

  test('KPI stat cards render numbers', async ({ page }) => {
    const cards = page.locator('[data-slot="card"]');
    await expect(cards.first()).toBeVisible({ timeout: 8_000 });
    await page.screenshot({ path: path.join(SS, 'manager-dashboard.png'), fullPage: true });
  });

  test('team load table has at least one row', async ({ page }) => {
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
  });

  test('"+  New Task" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new task/i })).toBeVisible();
  });
});

test.describe('Create Task Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manager');
    await page.waitForSelector('button:has-text("New Task")', { timeout: 15_000 });
    await page.click('button:has-text("New Task")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  });

  test('dialog opens with all required fields', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    await expect(page.getByText('New Content Task')).toBeVisible();
    // Labels exist as text (not htmlFor-linked) — verify by text
    await expect(dialog.getByText('Client *')).toBeVisible();
    await expect(dialog.getByText('Platform *')).toBeVisible();
    await expect(dialog.getByText('Content Type *')).toBeVisible();
    await expect(dialog.getByText('Priority')).toBeVisible();
    await expect(dialog.getByText('Posting Date *')).toBeVisible();
    // Verify controls are present
    await expect(dialog.getByRole('combobox').first()).toBeVisible();
    await expect(dialog.locator('input[type="date"]')).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'create-task-dialog-empty.png') });
  });

  test('Create Task button is disabled until required fields filled', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /create task/i });
    await expect(submitBtn).toBeDisabled();
  });

  test('fills form and Create Task button enables', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');

    // Client — first combobox in dialog
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    // Platform — second combobox
    await dialog.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /instagram/i }).click();

    // Content type — third combobox
    await dialog.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: /post/i }).first().click();

    // Posting date
    await dialog.locator('input[type="date"]').fill('2027-12-31');

    const submitBtn = page.getByRole('button', { name: /create task/i });
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
    await page.screenshot({ path: path.join(SS, 'create-task-dialog-filled.png') });
  });

  test('submits form and shows success toast', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');

    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    await dialog.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /linkedin/i }).click();

    await dialog.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: /post/i }).first().click();

    await dialog.locator('input[type="date"]').fill('2027-11-15');

    await page.getByRole('button', { name: /create task/i }).click();

    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: path.join(SS, 'create-task-success.png') });
  });

  test('Priority select shows Low / Medium / High options', async ({ page }) => {
    const dialog = page.locator('[role="dialog"]');
    // Priority is the 4th combobox (0-indexed: client=0, platform=1, contentType=2, priority=3)
    await dialog.getByRole('combobox').nth(3).click();
    await expect(page.getByRole('option', { name: /low/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /medium/i })).toBeVisible();
    await expect(page.getByRole('option', { name: /high/i })).toBeVisible();
  });

  test('Cancel closes the dialog', async ({ page }) => {
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 3_000 });
  });
});
