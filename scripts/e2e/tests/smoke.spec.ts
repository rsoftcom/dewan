/**
 * smoke.spec.ts
 * Verificación básica: login exitoso + carga de las secciones principales.
 */
import { test, expect } from '@playwright/test';
import { login, env } from '../helpers/auth';

test.describe('Smoke — navegación básica', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, env('TEST_EMAIL'), env('TEST_PASSWORD'));
  });

  test('dashboard carga correctamente', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.page-title').first()).toBeVisible();
  });

  test('listado de órdenes', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('p-table, .ten-card, h1').first()).toBeVisible();
  });

  test('listado de productos', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('p-table, .ten-card, h1').first()).toBeVisible();
  });

  test('listado de clientes', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('p-table, .ten-card, h1').first()).toBeVisible();
  });

  test('caja registradora', async ({ page }) => {
    await page.goto('/cash-register');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
  });

  test('inventario', async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveURL(/login/);
  });
});
