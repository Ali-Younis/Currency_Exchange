import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

test.describe('Transaction form', () => {
  test.skip(!process.env.E2E_ACCESS_TOKEN, 'Skipped: set E2E_ACCESS_TOKEN env var');

  async function loginWithToken(page: import('@playwright/test').Page, token: string) {
    await page.goto(`${BASE}/login`);
    await page.evaluate((t) => {
      localStorage.setItem('accessToken', t);
    }, token);
  }

  test('buy page shows customer name, email and currency fields', async ({ page }) => {
    await loginWithToken(page, process.env.E2E_ACCESS_TOKEN!);
    await page.goto(`${BASE}/buy`);
    await expect(page.locator('input[name="customerName"]')).toBeVisible();
    await expect(page.locator('input[name="customerEmail"]')).toBeVisible();
    await expect(page.locator('select[name="currencyInId"]')).toBeVisible();
  });

  test('sell page shows customer name, email and currency fields', async ({ page }) => {
    await loginWithToken(page, process.env.E2E_ACCESS_TOKEN!);
    await page.goto(`${BASE}/sell`);
    await expect(page.locator('input[name="customerName"]')).toBeVisible();
    await expect(page.locator('input[name="customerEmail"]')).toBeVisible();
    await expect(page.locator('select[name="currencyOutId"]')).toBeVisible();
  });
});
