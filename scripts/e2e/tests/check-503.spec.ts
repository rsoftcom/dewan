/**
 * check-503.spec.ts
 * Navega por todas las secciones del app haciendo múltiples reloads
 * e intercepta cualquier respuesta 5xx de la API.
 * Útil para detectar 503 intermitentes sin tener que hacerlo manualmente.
 */
import { test, expect } from '@playwright/test';
import { login, env } from '../helpers/auth';

const PAGES = [
  { name: 'Dashboard',   path: '/dashboard' },
  { name: 'Órdenes',     path: '/orders' },
  { name: 'Productos',   path: '/products' },
  { name: 'Clientes',    path: '/customers' },
  { name: 'Movimientos', path: '/movements' },
  { name: 'Caja',        path: '/cash-register' },
  { name: 'Inventario',  path: '/inventory' },
  { name: 'Proveedores', path: '/suppliers' },
  { name: 'Compras',     path: '/purchases' },
  { name: 'Cocina',      path: '/kitchen' },
];

const RELOADS_PER_PAGE = parseInt(process.env['RELOADS'] || '5');

interface ApiError {
  page: string;
  url: string;
  status: number;
  at: string;
}

test('detectar errores 503 / 5xx durante navegación y reloads', async ({ page }) => {
  const errors: ApiError[] = [];

  // Capturar todas las respuestas de la API
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/v1/') && status >= 500) {
      errors.push({ page: 'navegando', url, status, at: new Date().toISOString() });
      console.log(`  ❌ ${status} → ${url}`);
    }
  });

  // También capturar errores de red (CORS/ERR_FAILED = status 0 desde Angular)
  page.on('requestfailed', request => {
    const url = request.url();
    if (url.includes('/v1/')) {
      errors.push({ page: 'navegando', url, status: 0, at: new Date().toISOString() });
      console.log(`  ❌ ERR_FAILED → ${url} (${request.failure()?.errorText})`);
    }
  });

  await login(page, env('TEST_EMAIL'), env('TEST_PASSWORD'));

  for (const { name, path } of PAGES) {
    console.log(`\n📄 ${name} (${RELOADS_PER_PAGE} reloads)`);
    for (let i = 1; i <= RELOADS_PER_PAGE; i++) {
      const before = errors.length;
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => null);
      await page.waitForTimeout(800);
      const newErrors = errors.length - before;
      const icon = newErrors > 0 ? `❌ (${newErrors} errores)` : '✅';
      console.log(`  Reload ${i}: ${icon}`);
    }
  }

  // Resumen final
  console.log('\n══════════════════════════════════════');
  if (errors.length === 0) {
    console.log('✅ Sin errores 5xx detectados');
  } else {
    console.log(`❌ ${errors.length} errores detectados:\n`);
    for (const e of errors) {
      console.log(`  [${e.at}] ${e.status} → ${e.url}`);
    }

    // Agrupar por endpoint para ver cuáles fallan más
    const byEndpoint: Record<string, number> = {};
    for (const e of errors) {
      const key = new URL(e.url).pathname;
      byEndpoint[key] = (byEndpoint[key] || 0) + 1;
    }
    console.log('\nEndpoints con más fallos:');
    Object.entries(byEndpoint)
      .sort(([, a], [, b]) => b - a)
      .forEach(([path, count]) => console.log(`  ${count}x ${path}`));
  }
  console.log('══════════════════════════════════════\n');

  expect(errors, `Se encontraron ${errors.length} errores 5xx. Ver log arriba.`).toHaveLength(0);
});
