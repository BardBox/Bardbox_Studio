/**
 * Manager → Clients — /manager/clients
 * Tests: clients list, inline add-client form.
 * Note: ClientsManager uses an inline form (no dialog) to add clients.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SS = path.join(__dirname, '..', 'screenshots', 'after');
fs.mkdirSync(SS, { recursive: true });

test.describe('Clients page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manager/clients');
    await page.waitForSelector('h1', { timeout: 15_000 });
  });

  test('heading is visible', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
    await page.screenshot({ path: path.join(SS, 'manager-clients.png'), fullPage: true });
  });

  test('seed clients are listed', async ({ page }) => {
    await expect(page.getByText('Bizcivitas')).toBeVisible({ timeout: 8_000 });
  });

  test('Add client button is present', async ({ page }) => {
    // ClientsManager renders <Button type="submit">Add</Button>
    const addBtn = page.getByRole('button', { name: /^add$/i });
    await expect(addBtn).toBeVisible({ timeout: 5_000 });
  });

  test('Add client inline form has a name input', async ({ page }) => {
    // ClientsManager uses an inline form — not a dialog
    await expect(
      page.locator('input[placeholder="New client name"]')
    ).toBeVisible({ timeout: 5_000 });
    await page.screenshot({ path: path.join(SS, 'manager-clients-add-form.png') });
  });
});
