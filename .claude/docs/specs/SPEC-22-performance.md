# SPEC-22: Performance — App Rápida en 3G

**Descripción:** Conjunto de optimizaciones transversales para que la aplicación cargue y responda rápido incluso en condiciones de red deterioradas (3G lento, latencia alta). Este spec es diferente a los demás: no agrega funcionalidad sino que establece métricas objetivo, identifica los cuellos de botella y prescribe las intervenciones concretas.

**Actores:** Todos los usuarios

---

## Métricas objetivo

Medidas con Lighthouse en modo "Slow 4G" (simulación de 3G+ real) sobre una carga en frío (sin caché).

| Métrica | Objetivo | Herramienta |
|---|---|---|
| Largest Contentful Paint (LCP) | < 2.5 s | Lighthouse |
| First Input Delay / INP | < 100 ms | Lighthouse / CrUX |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Total Blocking Time (TBT) | < 300 ms | Lighthouse |
| JS bundle inicial (gzip) | < 150 KB | `webpack-bundle-analyzer` |
| Tiempo de respuesta P95 API (reads) | < 200 ms | k6 / autocannon |
| `GET /kitchen/orders` P95 | < 80 ms | k6 |
| `GET /products` P95 | < 80 ms | k6 |
| Puntuación Lighthouse Performance | ≥ 85 | Lighthouse |

---

## Diagnóstico del estado actual

### Frontend

| Área | Estado actual | Problema |
|---|---|---|
| Lazy routes | Parcialmente implementado | Verificar que TODOS los features routes usen `loadComponent` / `loadChildren` |
| ChangeDetection | No declarado (default=`CheckAlways`) | Los componentes con signals deberían declarar `OnPush` |
| Bundle | No analizado | Desconocido — puede haber imports de PrimeNG que arrastran módulos completos |
| Fuentes | Inter + Outfit via Google Fonts | Bloquean render si no están precargadas |
| Imágenes | Sin atributo `loading`, sin tamaño declarado | CLS y carga innecesaria |
| Socket connection | `io()` por componente | Múltiples conexiones innecesarias (resuelto en SPEC-20) |

### Backend

| Área | Estado actual | Problema |
|---|---|---|
| Compresión HTTP | No configurado | Respuestas JSON sin gzip |
| Índices DB | Los básicos por `tenantId` existen | Pueden faltar índices compuestos para queries frecuentes |
| Select fields | `prisma.findMany({})` sin `select` | Selecciona columnas que no se usan (ej: `password_hash` en joins de user) |
| Cache-Control | No configurado | Clientes re-fetchen datos estáticos cada vez |
| Paginación | `$transaction([findMany, count])` | Verificar que todos los listados usen transacción doble (no dos queries seriales) |

### Red / Infraestructura

| Área | Estado actual |
|---|---|
| Gzip en Nginx | Probablemente activo pero no verificado |
| Cloudflare Brotli | No verificado |
| Cache-Control en assets | Cloudflare Pages sirve con `max-age` por defecto — verificar |
| CDN para API | No aplica (DigitalOcean directo) |

---

## PERF-01: Compresión de respuestas HTTP (backend)

**Impacto:** Alto — reduce tamaño de payloads JSON en ~60–70%.

**Cambio:**

```typescript
// dewan-backend/main.ts
import * as compression from 'compression';
app.use(compression());
```

**Requisito:** `npm i compression && npm i -D @types/compression`

**Criterio de aceptación:**

```gherkin
Scenario: GET /products responde con Content-Encoding: gzip
  Given cliente que envía Accept-Encoding: gzip
  When GET /api/v1/products
  Then la respuesta tiene header Content-Encoding: gzip
  And el tamaño del payload es menor que sin compresión
```

---

## PERF-02: Cache-Control en endpoints de datos estáticos (backend)

**Impacto:** Medio — elimina round-trips innecesarios para catálogos que cambian poco.

**Endpoints a cachear:**

| Endpoint | TTL sugerido | Razón |
|---|---|---|
| `GET /units` | 1 hora | Cambian raramente |
| `GET /units/conversions` | 1 hora | Idem |
| `GET /categories` | 5 minutos | Cambian ocasionalmente |
| `GET /products` (listado) | 1 minuto | Cambian con frecuencia moderada |

**Implementación:** Decorator personalizado o interceptor que añade `Cache-Control: private, max-age=<TTL>` a las respuestas GET. `private` es importante — son datos por tenant, no públicos.

```typescript
// Ejemplo en controller
@Get()
@Header('Cache-Control', 'private, max-age=3600')
findAll() { ... }
```

---

## PERF-03: Índices de base de datos adicionales

**Impacto:** Alto para queries con filtros compuestos frecuentes.

**Análisis de queries frecuentes y sus índices:**

| Query | Índice necesario |
|---|---|
| `orders WHERE tenant_id = ? AND status IN (pending, in_kitchen)` | `@@index([tenantId, status])` en `Order` |
| `notifications WHERE user_id = ? AND is_read = false` | `@@index([userId, isRead])` en `Notification` |
| `audit_logs WHERE tenant_id = ? AND created_at DESC` | `@@index([tenantId, createdAt])` en `AuditLog` |
| `order_status_history WHERE order_id = ?` | `@@index([orderId])` en `OrderStatusHistory` |
| `movements WHERE tenant_id = ? AND created_at BETWEEN ? AND ?` | `@@index([tenantId, createdAt])` en `Movement` |

**Verificar con `EXPLAIN ANALYZE`** antes y después de añadir índices para confirmar que se usan.

---

## PERF-04: Eliminar campos innecesarios en queries Prisma (backend)

**Impacto:** Bajo-Medio — reduce tamaño de payload y tiempo de serialización.

**Patrones a corregir:**

1. Cuando se incluye `user` en una relación (ej: en `AuditLog`), hacer `select: { id: true, name: true, email: true }` — excluir `password_hash`, `created_at`, `updated_at`.
2. En listados de pedidos, no incluir `items` por defecto (solo en el detalle). Confirmar que `GET /orders` excluye `items`.
3. En `GET /kitchen/orders`, incluir solo los campos que muestra la UI: `id, type, status, tableName, createdAt, items.{ productName, quantity, notes }`.

---

## PERF-05: Lazy loading completo en el frontend

**Impacto:** Alto — reduce el bundle inicial drásticamente.

**Verificar que todas las rutas de features usen `loadComponent` / `loadChildren`:**

```typescript
// app.routes.ts — patrón correcto
{ path: 'kitchen', loadComponent: () => import('./features/kitchen/pages/kitchen-view.component').then(m => m.KitchenViewComponent) }
```

**Acciones:**

1. Revisar `app/app.routes.ts` y confirmar que ninguna ruta importa componentes estáticamente.
2. Si algún componente está importado directamente en el módulo raíz, moverlo a lazy.
3. Ejecutar `ng build --stats-json` y analizar con `npx webpack-bundle-analyzer dist/.../stats.json`.

**Criterio de aceptación:**

```gherkin
Scenario: Chunk del kitchen no se carga al abrir la app
  Given usuario en /login
  When el bundle inicial carga
  Then el chunk kitchen-view-component no está en los scripts iniciales de la página
```

---

## PERF-06: ChangeDetection.OnPush en todos los componentes

**Impacto:** Medio — Angular con signals ya es eficiente, pero `OnPush` elimina ciclos de detección innecesarios.

**Cambio en todos los componentes:**

```typescript
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
```

**Nota:** Con `signal()` y `computed()`, `OnPush` es seguro y no requiere `markForCheck()` manual.

---

## PERF-07: Precarga y autohosting de fuentes (frontend)

**Impacto:** Medio — Google Fonts bloquea el render hasta que descarga las fuentes.

**Cambio:**

1. Descargar Inter y Outfit como archivos `.woff2` y servirlos desde los assets de la app (Cloudflare Pages los sirve con CDN).
2. En `index.html`: añadir `<link rel="preload">` para los subsets usados.
3. En `styles.scss`: usar `@font-face` local en lugar de `@import url('https://fonts.googleapis.com/...')`.

```html
<!-- index.html -->
<link rel="preload" href="/assets/fonts/inter-v19-latin-regular.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/outfit-v11-latin-regular.woff2" as="font" type="font/woff2" crossorigin>
```

---

## PERF-08: Optimización de imágenes

**Impacto:** Bajo-Medio — logos y thumbnails de productos.

**Acciones:**

1. Añadir `loading="lazy"` y `width`/`height` en todas las `<img>` que no estén above-the-fold.
2. Servir imágenes en WebP cuando el origen lo permita (Cloudflare R2 puede servir WebP con una transform URL).
3. Definir tamaños máximos al subir (logo: 512×512, producto: 800×800).

---

## PERF-09: Nginx y Cloudflare — cabeceras de caché para assets

**Impacto:** Alto para retorno de usuarios.

**Nginx (backend):**

```nginx
# Para archivos estáticos si el backend sirve alguno
location ~* \.(js|css|woff2|png|webp|jpg)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}
```

**Cloudflare Pages (frontend):**

Cloudflare Pages sirve automáticamente con `Cache-Control: public, max-age=0, must-revalidate` para el `index.html` y `max-age=31536000, immutable` para los chunks con hash. Verificar que el build de Angular genera hashes en los nombres de archivos (ya lo hace por defecto con `ng build`).

**Habilitar en Cloudflare dashboard:**

- Speed → Optimization → Auto Minify: HTML + CSS + JS ✓
- Speed → Optimization → Brotli: ✓

---

## PERF-10: Eliminar WebSocket polling — completado por SPEC-20

La migración a `WebSocketService` singleton (SPEC-20) elimina el principal patrón de tráfico innecesario. Impacto directo:

- Elimina conexiones WS duplicadas por componente.
- Elimina cualquier polling HTTP que pudiera existir en futuras iteraciones.
- La cocina recibe pedidos nuevos al instante sin re-fetches.

---

## Metodología de medición

### Lighthouse (cada sprint)

```bash
# Con la app corriendo en modo producción local:
npx lighthouse http://localhost:4200 --view --throttling-method=simulate --preset=desktop
```

### Bundle analysis

```bash
cd dewan-frontend
npm run build:prod -- --stats-json
npx webpack-bundle-analyzer dist/dewan-frontend/browser/stats.json
```

### Load testing API (antes de producción)

```bash
# Ejemplo con autocannon
npx autocannon -c 10 -d 30 -H "Authorization: Bearer <token>" http://localhost:3000/v1/products
```

### EXPLAIN ANALYZE para queries críticas

```sql
EXPLAIN ANALYZE
SELECT * FROM orders
WHERE tenant_id = 'uuid' AND status IN ('pending', 'in_kitchen')
ORDER BY created_at ASC;
```

---

## Orden de implementación sugerido (mayor impacto primero)

| Prioridad | Item | Esfuerzo | Impacto |
|---|---|---|---|
| 1 | PERF-01: Compresión gzip (backend) | 30 min | Alto |
| 2 | PERF-05: Lazy loading completo | 1–2 h | Alto |
| 3 | PERF-03: Índices DB | 1 h | Alto |
| 4 | PERF-07: Autohosting fuentes | 1 h | Medio |
| 5 | PERF-06: ChangeDetection.OnPush | 1–2 h | Medio |
| 6 | PERF-09: Cloudflare/Nginx headers | 30 min | Medio |
| 7 | PERF-02: Cache-Control API | 1 h | Medio |
| 8 | PERF-04: Select fields Prisma | 2–3 h | Bajo-Medio |
| 9 | PERF-08: Imágenes lazy | 1 h | Bajo-Medio |

> SPEC-20 (WebSocket singleton) y las migraciones de SPEC-21 (multi-tenant) son requisitos previos que también mejoran el rendimiento de red.
