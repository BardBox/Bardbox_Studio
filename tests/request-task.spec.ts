/**
 * Request Task page — /request-task
 * Accessible to any authenticated role. Tests the submission form.
 * Note: Labels are not htmlFor-linked to Select triggers; use getByRole('combobox').
 * Note: Submit button is always enabled (validation shows toast on submit).
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Request Task page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/request-task');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /request/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'request-task.png'), fullPage: true });
  });

  test('form has client, platform, content type and posting date fields', async ({ page }) => {
    // Labels exist as text nodes (not htmlFor-linked) — verify by text and control presence
    await expect(page.getByText('Client').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('Platform').first()).toBeVisible();
    await expect(page.getByText('Content Type').first()).toBeVisible();
    await expect(page.getByText('Posting Date').first()).toBeVisible();
    // Controls
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('Submit button is present', async ({ page }) => {
    // RequestTaskForm always shows Submit enabled; validates with toast on submit
    const submitBtn = page.getByRole('button', { name: /submit/i });
    await expect(submitBtn).toBeVisible();
  });

  test('fills form fields', async ({ page }) => {
    // Client — first combobox
    await page.getByRole('combobox').first().click();
    await page.getByRole('option').first().click();

    // Platform — second combobox
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: /instagram/i }).click();

    // Content Type — third combobox
    await page.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: /post/i }).first().click();

    // Posting date
    await page.locator('input[type="date"]').fill('2027-09-01');

    // Verify Submit button is visible (form is ready)
    await expect(page.getByRole('button', { name: /submit/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'request-task-filled.png') });
  });
});
