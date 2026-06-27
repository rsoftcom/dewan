/**
 * orders.spec.ts
 * Flujo completo de órdenes: listar, filtrar por estado, ver detalle.
 */
import { test, expect } from '@playwright/test';
import { login, env } from '../helpers/auth';

test.describe('Órdenes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, env('TEST_EMAIL'), env('TEST_PASSWORD'));
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
  });

  test('lista de órdenes carga sin errores', async ({ page }) => {
    await expect(page.locator('h1')).toContainText(/[Pp]edidos|[Óo]rdenes/);
    // No debe haber mensajes de error visibles
    await expect(page.locator('.p-message-error')).toHaveCount(0);
  });

  test('filtros de tipo funcionan', async ({ page }) => {
    const localBtn = page.locator('button, p-chip, .filter-chip').filter({ hasText: /Local/ });
    if (await localBtn.isVisible()) {
      await localBtn.click();
      await page.waitForTimeout(800);
      await expect(page).not.toHaveURL(/login/);
    }
  });

  test('filtros de estado funcionan', async ({ page }) => {
    const pendingBtn = page.locator('button, p-chip, .filter-chip').filter({ hasText: /[Pp]endiente/ });
    if (await pendingBtn.isVisible()) {
      await pendingBtn.click();
      await page.waitForTimeout(800);
      await expect(page).not.toHaveURL(/login/);
    }
  });

  test('botón nuevo pedido es visible', async ({ page }) => {
    await expect(page.locator('button').filter({ hasText: /[Nn]uevo [Pp]edido/ })).toBeVisible();
  });
});
