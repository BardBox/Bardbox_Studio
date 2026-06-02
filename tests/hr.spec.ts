/**
 * HR Dashboard — /hr
 * Tests: page loads, leave requests table, availability table,
 * submit leave dialog opens and validates.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('HR Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/hr');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /hr|leave/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'hr.png'), fullPage: true });
  });

  test('team availability section renders', async ({ page }) => {
    // HrDashboard has a "Team Availability" card
    await expect(page.getByText(/team availability|availability/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('leave requests table or empty state is shown', async ({ page }) => {
    const rows  = await page.locator('table tbody tr').count();
    const empty = await page.getByText(/no leave|no requests|no pending/i).isVisible().catch(() => false);
    expect(rows > 0 || empty).toBeTruthy();
  });

  test('Submit Leave button opens the leave dialog', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /submit leave|request leave|apply leave/i });
    await expect(submitBtn).toBeVisible({ timeout: 8_000 });
    await submitBtn.click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4_000 });
    await page.screenshot({ path: path.join(SS, 'hr-submit-leave-dialog.png') });
  });

  test('leave dialog has start date, end date, and reason fields', async ({ page }) => {
    await page.getByRole('button', { name: /submit leave|request leave|apply leave/i }).click();
    await page.locator('[role="dialog"]').waitFor({ timeout: 4_000 });

    // Start date and end date inputs
    const dateInputs = page.locator('[role="dialog"] input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();

    // Reason textarea or input
    const reason = page.locator('[role="dialog"] textarea, [role="dialog"] input[type="text"]').first();
    await expect(reason).toBeVisible();

    await page.keyboard.press('Escape');
  });

  test('Submit button in leave dialog is disabled when fields are empty', async ({ page }) => {
    await page.getByRole('button', { name: /submit leave|request leave|apply leave/i }).click();
    await page.locator('[role="dialog"]').waitFor({ timeout: 4_000 });
    const submitBtn = page.locator('[role="dialog"]').getByRole('button', { name: /submit|save/i });
    await expect(submitBtn).toBeDisabled();
    await page.keyboard.press('Escape');
  });
});
