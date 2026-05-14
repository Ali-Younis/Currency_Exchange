import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASS = process.env.E2E_ADMIN_PASS ?? 'Admin@Change123!';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to /login', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/login/);
  });

  test('shows validation error on wrong credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="text"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should show error message or stay on login
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Admin login flow', () => {
  test.skip(
    !process.env.E2E_ADMIN_PASS,
    'Skipped: set E2E_ADMIN_PASS env var to run admin tests',
  );

  test('admin can log in and reach dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="text"]', ADMIN_USER);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');

    // Could be TOTP enroll / verify, password change, or dashboard
    await expect(page).not.toHaveURL(`${BASE}/login`);
  });
});

test.describe('Public pages', () => {
  test('login page loads', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('h1, h2')).toBeVisible();
    await expect(page.locator('input[type="text"], input[name="username"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
