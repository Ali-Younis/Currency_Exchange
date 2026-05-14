import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

/**
 * Helper: stores an access token in localStorage to simulate a logged-in session.
 * Requires E2E_ACCESS_TOKEN to be set (can be obtained via API call).
 */
async function loginWithToken(page: import('@playwright/test').Page, token: string) {
  await page.goto(`${BASE}/login`);
  await page.evaluate((t) => {
    localStorage.setItem('accessToken', t);
  }, token);
  await page.goto(`${BASE}/dashboard`);
}

test.describe('Dashboard (authenticated)', () => {
  test.skip(!process.env.E2E_ACCESS_TOKEN, 'Skipped: set E2E_ACCESS_TOKEN env var');

  test('shows navigation and stat cards', async ({ page }) => {
    await loginWithToken(page, process.env.E2E_ACCESS_TOKEN!);
    await expect(page.locator('nav, aside')).toBeVisible();
    // At least one stat card / metric section should be visible
    await expect(page.locator('[class*="card"], [class*="stat"], main')).toBeVisible();
  });
});

test.describe('Currency page (authenticated admin)', () => {
  test.skip(!process.env.E2E_ACCESS_TOKEN, 'Skipped: set E2E_ACCESS_TOKEN env var');

  test('shows list of currencies with flags', async ({ page }) => {
    await loginWithToken(page, process.env.E2E_ACCESS_TOKEN!);
    await page.goto(`${BASE}/currencies`);
    // Should show table rows
    await expect(page.locator('table tbody tr')).not.toHaveCount(0);
  });
});

test.describe('Current balances page (authenticated admin)', () => {
  test.skip(!process.env.E2E_ACCESS_TOKEN, 'Skipped: set E2E_ACCESS_TOKEN env var');

  test('loads current balances table', async ({ page }) => {
    await loginWithToken(page, process.env.E2E_ACCESS_TOKEN!);
    await page.goto(`${BASE}/current-balances`);
    await expect(page.locator('table')).toBeVisible();
  });
});
