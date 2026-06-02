/**
 * Auth tests — run WITHOUT saved state.
 * Tests login page UI, error messages, and post-login redirect.
 */
import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders email + password fields and submit button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('shows error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email',    'wrong@example.com');
    await page.fill('#password', 'badpassword');
    await page.click('button[type="submit"]');
    // Supabase returns "Invalid login credentials"
    await expect(page.locator('.text-destructive')).toBeVisible({ timeout: 8_000 });
  });

  test('redirects to /manager after successful login (admin role)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email',    'saucesensei001@gmail.com');
    await page.fill('#password', 'asdasd123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/manager/, { timeout: 20_000 });
  });
});

test.describe('Unauthenticated redirect', () => {
  test('visiting /manager without a session redirects to /login', async ({ page }) => {
    // No stored cookies → middleware should redirect
    await page.goto('/manager');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
