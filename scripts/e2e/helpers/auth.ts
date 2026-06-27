import { Page, expect } from '@playwright/test';

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.fill('#email', email);

  // PrimeNG p-password renders the input with inputId="password"
  await page.fill('#password', password);

  await page.click('button[type="submit"]');

  // Wait for redirect away from login (dashboard or tenant selector)
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 15_000 });

  // If a tenant selector dialog appears (multi-tenant owner), dismiss it by picking first option
  const tenantDialog = page.locator('.tenant-selector, [data-testid="tenant-selector"]');
  if (await tenantDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await tenantDialog.locator('button').first().click();
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  }

  await expect(page).toHaveURL(/dashboard/);
}

export function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Env var ${key} is required. Set it before running the test.`);
  return val;
}
