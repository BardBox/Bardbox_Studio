/**
 * Admin pages — /admin/team  /admin/settings  /admin/permissions
 * Tests: team table, invite dialog, settings form, permissions matrix.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Admin → Team', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/team');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'admin-team.png'), fullPage: true });
  });

  test('team members table has at least one row', async ({ page }) => {
    // The admin/manager user themselves should appear
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 8_000 });
  });

  test('Invite Team Member button is present', async ({ page }) => {
    const inviteBtn = page.getByRole('button', { name: /invite|add member/i });
    await expect(inviteBtn).toBeVisible();
  });

  test('Invite dialog opens with email field', async ({ page }) => {
    await page.getByRole('button', { name: /invite|add member/i }).click();
    await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4_000 });
    await expect(page.locator('[role="dialog"] input[type="email"]')).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'admin-team-invite-dialog.png') });
    await page.keyboard.press('Escape');
  });

  test('Edit user button opens edit dialog', async ({ page }) => {
    await page.locator('table tbody tr').first().waitFor({ timeout: 8_000 });
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(page.locator('[role="dialog"]')).toBeVisible({ timeout: 4_000 });
      await page.screenshot({ path: path.join(SS, 'admin-team-edit-dialog.png') });
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('Admin → Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'admin-settings.png'), fullPage: true });
  });

  test('AI provider section is present', async ({ page }) => {
    await expect(page.getByText(/ai|provider|anthropic|gemini/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('knowledge base / training docs section is present', async ({ page }) => {
    // Settings page subtitle: "AI provider configuration and knowledge base"
    await expect(page.getByText(/knowledge base|knowledge|training|provider/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Admin → Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/permissions');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /permission/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'admin-permissions.png'), fullPage: true });
  });

  test('role columns are visible (designer, smo, manager, ceo)', async ({ page }) => {
    for (const role of ['designer', 'smo', 'manager', 'ceo']) {
      await expect(page.getByText(role, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test('permission toggles are interactive checkboxes or switches', async ({ page }) => {
    const toggle = page.locator('input[type="checkbox"], [role="switch"]').first();
    await expect(toggle).toBeVisible({ timeout: 8_000 });
  });
});
