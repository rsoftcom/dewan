# SPEC-27: Offline-First PWA (Modo sin conexión para owner/admin)

**Descripción:** La aplicación Dewan funciona completamente sin conexión a internet para roles `owner` y `admin`. Cualquier operación disponible en línea para esos roles es ejecutable offline. Los cambios se almacenan localmente y se sincronizan automáticamente cuando vuelve la conexión. La app es instalable como PWA en smartphones (Android/iOS) y escritorio.

**Actores:** `owner`, `admin` — únicos roles con modo offline habilitado. Roles `cashier`, `waiter`, `kitchen`, `delivery`: sin offline (ven pantalla "Sin conexión" estándar).

**Entidades afectadas:** Todas las existentes (sin nuevas entidades de negocio). Nueva entidad de infraestructura: `sync_operation`.

**Fuera de alcance:**
- Menú público QR (SPEC-26) — siempre online, es para visitantes anónimos
- Vista cocina (`kitchen` role) — rol no admin, no aplica
- `super_admin` — opera solo desde la admin panel con conexión garantizada

**Depende de:** Todos los módulos SPEC-01 a SPEC-24 (son los que se hacen offline).

---

## 1. Principios de diseño

### P-01: El cliente es el autor; el servidor es el árbitro

Offline, el cliente genera IDs (UUID v4) para entidades nuevas y ejecuta las operaciones localmente. Al sincronizar, el servidor valida y persiste. Si hay conflicto, el servidor decide y notifica — nunca rechaza silenciosamente.

### P-02: Operaciones, no estados

Las escrituras offline no sobreescriben snapshots de datos. Se almacenan como **operaciones** (comandos con idempotency key). El servidor las reproduce en orden. Esto permite detectar duplicados exactos y mergear de forma segura.

### P-03: La sincronización no bloquea la UI

El proceso pull → push se ejecuta en background. El usuario ve el estado offline inmediatamente (optimistic UI). Si la sync falla, el estado local se mantiene y se reintenta.

### P-04: La integridad financiera es no negociable

Cash register, pagos y movimientos tienen reglas adicionales de conflicto. Si el servidor detecta que una caja offline ya fue cerrada por otro admin, bloquea la operación y notifica — nunca aplica estados financieros en conflicto automáticamente.

---

## 2. Arquitectura en tres capas

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA 1 — PWA / Service Worker (@angular/pwa + Workbox)    │
│  • Precachea: app shell, CSS, JS, fuentes, íconos          │
│  • Runtime cache: GET de catálogo (stale-while-revalidate) │
│  • Background Sync API: reintenta push si falla            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  CAPA 2 — IndexedDB (Dexie.js)                             │
│  Stores:                                                    │
│  • products, categories, units — réplica catálogo          │
│  • tables, customers, suppliers — réplica maestros         │
│  • orders, order_items — últimos 7 días                    │
│  • cash_registers, movements, payments — últimos 7 días    │
│  • inventory_adjustments, purchases — últimos 7 días       │
│  • notifications — últimas 50 no leídas                    │
│  • operation_queue — escrituras pendientes (append-only)   │
│  • sync_meta — { lastSyncAt, tenantId, userId, version }   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  CAPA 3 — SyncService (Angular singleton)                  │
│  • Detecta conectividad real (ping /v1/sync/ping)          │
│  • En ONLINE: HTTP normal → API → actualiza IndexedDB      │
│  • En OFFLINE: sirve desde IndexedDB, encola writes        │
│  • Al reconectar: PULL cambios → PUSH cola → reconcilia    │
│  • Notifica al usuario conflictos no resolubles            │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Cambios de schema (backend)

### 3.1 Nueva tabla: `sync_operation`

Registra cada operación procesada. La columna `client_operation_id` es la clave de idempotencia — si el cliente re-envía la misma operación, el servidor la ignora sin error.

```prisma
enum SyncOperationStatus {
  processed
  conflict
  rejected

  @@map("sync_operation_status")
}

model SyncOperation {
  id                String              @id @default(uuid())
  tenantId          String              @map("tenant_id")
  userId            String              @map("user_id")
  clientOperationId String              @unique @map("client_operation_id")
  entityType        String              @map("entity_type")
  operation         String
  status            SyncOperationStatus @default(processed)
  conflictDetails   Json?               @map("conflict_details")
  processedAt       DateTime            @default(now()) @map("processed_at") @db.Timestamptz
  createdAt         DateTime            @default(now()) @map("created_at") @db.Timestamptz

  @@index([tenantId])
  @@index([processedAt])
  @@map("sync_operations")
}
```

### 3.2 Modificación a entidades existentes — locking optimista

Se añade `updatedAt` ya existe en todos los modelos (`@updatedAt`). Se usará como version timestamp para detectar conflictos. **No se añade campo `version` adicional** — `updatedAt` es suficiente.

**Excepción:** `CashRegister` recibe un campo `offlineLock` para proteger el flujo financiero:

```prisma
// En model CashRegister — añadir:
offlineLock  String?  @map("offline_lock")  // UUID del admin que lo tiene bloqueado offline
```

Cuando un admin abre una caja offline, el servidor registra su `userId` en `offlineLock`. Si otro admin intenta operar esa caja (online u offline), recibe un error de conflicto hasta que el primero sincronice y libere el lock.

---

## 4. Protocolo de sincronización

### Fase A: Detección de conectividad

No se usa solo `navigator.onLine` (puede indicar conexión a router sin internet real). El `SyncService` hace ping a `GET /v1/sync/ping` cada 30 segundos. Si el ping falla dos veces consecutivas → modo OFFLINE. Si responde → modo ONLINE.

### Fase B: Sincronización inicial (primer uso o sesión nueva)

```
1. GET /v1/sync/pull?since=epoch
   ← Recibe todos los datos del tenant (catálogo completo + últimos 7 días de transacciones)
   
2. Guardar todo en IndexedDB
3. Guardar sync_meta.lastSyncAt = serverTimestamp recibido
```

### Fase C: Ciclo normal online

Cada request HTTP que hace la app:
1. `OfflineInterceptor` lo deja pasar a la API normalmente
2. Al recibir respuesta exitosa, actualiza el store de IndexedDB correspondiente
3. IndexedDB siempre está en sincronía con la API cuando hay conexión

### Fase D: Escritura offline

Cuando un admin opera sin conexión y ejecuta una acción (crear orden, agregar ítem, cobrar, etc.):

1. `OfflineInterceptor` intercepta el request HTTP saliente
2. Genera un `operationId` = `uuid()` (idempotency key)
3. Serializa la operación:
   ```json
   {
     "operationId": "550e8400-...",
     "entityType": "order",
     "operation": "create",
     "entityId": "client-generated-uuid",
     "payload": { "type": "local", "tableId": "...", "items": [...] },
     "clientTimestamp": "2026-06-29T14:32:00Z",
     "entityUpdatedAt": null
   }
   ```
4. Guarda la operación en `operation_queue` (IndexedDB)
5. Aplica el cambio en IndexedDB localmente (optimistic update)
6. Retorna el resultado local al componente — el componente no sabe que está offline

### Fase E: Reconexión — protocolo pull → push

Al detectar que vuelve la conexión:

```
1. POST /auth/refresh (refresca el JWT con la cookie HttpOnly)
   → Si falla (token expirado > 7 días): pedir re-login, conservar cola

2. GET /v1/sync/pull?since=<lastSyncAt>
   → Recibe cambios del servidor mientras estaba offline
   → Aplica en IndexedDB: server-wins para conflictos de lectura
   → Actualiza sync_meta.lastSyncAt

3. POST /v1/sync/push   { operations: [op1, op2, ...op_n] }
   → Envía TODA la cola en orden cronológico (clientTimestamp)
   → El servidor procesa en una transacción de PostgreSQL atómica
   → Si hay conflictos: los resuelve según la matriz de conflictos (sección 5)
   → Responde: { processed: [...], conflicts: [...], failed: [...] }

4. Si la respuesta tiene `conflicts`:
   → El SyncService notifica al admin con detalle de cada conflicto
   → Las operaciones en conflicto se marcan en la cola como `conflict`
   → Las demás se eliminan de la cola

5. Si el push falla totalmente (red inestable):
   → La cola se conserva intacta, se reintenta en 60s
```

### Fase F: Autenticación durante offline prolongado

El refresh token tiene 7 días de vida. Si el admin estuvo offline más de 7 días:
- Al reconectar, el refresh falla
- `SyncService` emite estado `auth_expired`
- Se muestra pantalla de login con aviso: "Tu sesión expiró. Inicia sesión para sincronizar X operaciones pendientes"
- La cola se conserva en IndexedDB — no se pierde
- Tras login exitoso, se ejecuta inmediatamente el protocolo pull → push

---

## 5. Matriz de resolución de conflictos

Un conflicto ocurre cuando el servidor tiene `entity.updatedAt` > `operation.clientTimestamp` para la misma entidad.

| Tipo de operación | Política | Razón |
|---|---|---|
| Crear nueva entidad (order, customer, purchase) | **Siempre aplica** — IDs de cliente son UUID únicos | No hay conflicto posible en creates |
| Agregar ítem a orden | **Merge** — acumulativo, nunca destructivo | Dos admins agregando ítems a una orden = suma |
| Cambiar estado de orden (status machine) | **Server-wins si más avanzado** | Nunca revertir `paid` → `pending` |
| Actualizar producto (precio, nombre, estado) | **Last-write-wins** + notificación de conflicto | El más reciente en `clientTimestamp` gana |
| Actualizar customer, supplier | **Last-write-wins** | Cambios de maestros son reversibles |
| Abrir/cerrar caja | **Bloqueo explícito** — `offlineLock` | Financiero: no se resuelve automáticamente |
| Crear pago | **Idempotencia estricta** — verifica que la orden no esté ya pagada | No se puede cobrar dos veces |
| Ajuste de inventario | **Aplica delta** — no valor absoluto | Dos ajustes de -5 = -10 en total |
| Eliminar registro | **Server-wins** — si ya fue eliminado, ignorar | |

---

## 6. Nuevos endpoints (backend) — módulo `SyncModule`

### UC-27-01: Health check de conectividad

**Contrato:** `GET /v1/sync/ping`

Response 200: `{ "status": "ok", "serverTime": "2026-06-29T14:00:00Z" }`

Sin auth requerida — usado para detectar conectividad real.

---

### UC-27-02: Pull — obtener delta de cambios

**Actor:** `owner`, `admin`
**Roles:** OW, AD

**Contrato:** `GET /v1/sync/pull?since=<ISO_TIMESTAMP>`

- Si `since` no se proporciona o es `epoch`: retorna snapshot completo (catálogo + últimos 7 días de transacciones)
- Si `since` se proporciona: retorna solo entidades con `updatedAt > since`

Response 200:
```json
{
  "serverTimestamp": "2026-06-29T14:00:00Z",
  "entities": {
    "products": [...],
    "categories": [...],
    "units": [...],
    "tables": [...],
    "customers": [...],
    "suppliers": [...],
    "orders": [...],
    "orderItems": [...],
    "cashRegisters": [...],
    "movements": [...],
    "payments": [...],
    "inventoryAdjustments": [...],
    "purchases": [...],
    "purchaseItems": [...],
    "notifications": [...]
  }
}
```

**Criterio de aceptación:**

```gherkin
Scenario: Pull inicial trae datos del tenant
  Given un admin autenticado
  When envía GET /v1/sync/pull sin parámetro since
  Then recibe todos los productos, categorías y transacciones de los últimos 7 días del tenant
  And recibe un serverTimestamp para usar en el próximo pull

Scenario: Pull delta trae solo cambios recientes
  Given lastSyncAt = "2026-06-29T10:00:00Z"
  And un producto fue actualizado a las 11:00
  When envía GET /v1/sync/pull?since=2026-06-29T10:00:00Z
  Then recibe solo el producto actualizado, no todos los productos
```

---

### UC-27-03: Push — procesar cola de operaciones offline

**Actor:** `owner`, `admin`
**Roles:** OW, AD

**Contrato:** `POST /v1/sync/push`

Request:
```json
{
  "operations": [
    {
      "operationId": "uuid",
      "entityType": "order",
      "operation": "create",
      "entityId": "client-uuid",
      "payload": { ... },
      "clientTimestamp": "2026-06-29T14:32:00Z",
      "entityUpdatedAt": null
    }
  ]
}
```

**Procesamiento en el servidor:**

1. Ordenar operaciones por `clientTimestamp` ASC
2. Para cada operación:
   a. Verificar `client_operation_id` en `sync_operations` — si existe, skip (idempotente)
   b. Aplicar matriz de conflictos (sección 5)
   c. Ejecutar la operación en DB
   d. Insertar en `sync_operations` con `status = processed`
3. Todo en una transacción PostgreSQL. Si alguna falla y no es tratable, rollback completo.
4. **Excepción al rollback completo:** operaciones de conflicto se excluyen del batch y se procesan las demás. El batch nunca falla solo por conflictos — solo por errores inesperados de DB.

Response 200:
```json
{
  "processed": ["op-uuid-1", "op-uuid-3"],
  "conflicts": [
    {
      "operationId": "op-uuid-2",
      "entityType": "cash_register",
      "reason": "La caja ya fue cerrada por otro usuario.",
      "serverState": { "status": "closed", "closedAt": "..." }
    }
  ],
  "failed": []
}
```

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Pago duplicado: orden ya tiene `status = paid` | `conflict` — "Este pedido ya fue cobrado." |
| E02 | Caja cerrada offline por otro admin | `conflict` — "La caja ya fue cerrada. Revisa el corte." |
| E03 | Producto referenciado no existe | `conflict` — "El producto fue eliminado. Revisa el pedido." |

**Criterios de aceptación:**

```gherkin
Scenario: Push procesa cola offline exitosamente
  Given un admin con 5 operaciones en cola (2 create order, 3 add items)
  When envía POST /v1/sync/push con las 5 operaciones
  Then recibe status 200 con 5 operationIds en processed
  And las órdenes y sus ítems existen en la DB
  And la cola local se vacía

Scenario: Re-envío de operación ya procesada se ignora
  Given la operación op-uuid-1 ya fue procesada
  When el cliente re-envía op-uuid-1 (por re-intento de red)
  Then el servidor responde 200 con op-uuid-1 en processed
  And no crea un duplicado en la DB

Scenario: Conflicto de caja no bloquea el resto del batch
  Given una cola con: [crear_orden, cerrar_caja_en_conflicto, agregar_item]
  When se envía POST /v1/sync/push
  Then crear_orden y agregar_item aparecen en processed
  And cerrar_caja aparece en conflicts con razón
  And solo la operación de caja queda pendiente en la cola local
```

---

## 7. PWA — instalación y cache (frontend)

### 7.1 Setup inicial

```bash
cd dewan-frontend
ng add @angular/pwa
```

Esto genera: `ngsw-worker.js`, `ngsw-config.json`, `manifest.webmanifest`, actualiza `index.html`.

### 7.2 `ngsw-config.json` — estrategias de cache

```json
{
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app-shell",
      "installMode": "prefetch",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js", "/assets/fonts/**"]
      }
    },
    {
      "name": "primeng-icons",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": { "urls": ["https://primefaces.org/cdn/**"] }
    }
  ],
  "dataGroups": [
    {
      "name": "catalog-api",
      "urls": ["/v1/products", "/v1/categories", "/v1/units", "/v1/tables", "/v1/suppliers"],
      "cacheConfig": { "strategy": "freshness", "timeout": "5s", "maxAge": "1h", "maxSize": 100 }
    }
  ]
}
```

### 7.3 Manifest — instalación como app

```json
{
  "name": "Dewan",
  "short_name": "Dewan",
  "description": "Gestión de tu negocio — siempre disponible",
  "theme_color": "#FF6B35",
  "background_color": "#1A1028",
  "display": "standalone",
  "scope": "/",
  "start_url": "/dashboard",
  "icons": [
    { "src": "assets/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "assets/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "assets/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 7.4 Registro en `app.config.ts`

```typescript
import { provideServiceWorker } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... providers existentes
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
```

---

## 8. Componentes y servicios nuevos (frontend)

### 8.1 `core/services/offline.service.ts`

Singleton central. Responsabilidades:
- Mantener `isOnline = signal<boolean>(true)`
- Ping periódico cada 30s a `/v1/sync/ping`
- Escuchar `window.online` / `window.offline`
- Disparar el protocolo pull → push al reconectar
- Exponer `pendingOps = signal<number>(0)`

```typescript
// API pública del servicio
isOnline(): boolean                          // signal computed
pendingOpsCount(): number                    // signal computed  
syncStatus(): 'idle' | 'syncing' | 'error'  // signal computed
manualSync(): Promise<SyncResult>           // trigger manual
```

### 8.2 `core/services/indexed-db.service.ts`

Wrapper Dexie.js. Define el schema de IndexedDB y expone métodos tipados por entidad.

```typescript
class DewanDb extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
  units!: Table<Unit>;
  tables!: Table<Table>;
  customers!: Table<Customer>;
  suppliers!: Table<Supplier>;
  orders!: Table<Order>;
  orderItems!: Table<OrderItem>;
  cashRegisters!: Table<CashRegister>;
  movements!: Table<Movement>;
  payments!: Table<Payment>;
  inventoryAdjustments!: Table<InventoryAdjustment>;
  purchases!: Table<Purchase>;
  purchaseItems!: Table<PurchaseItem>;
  notifications!: Table<Notification>;
  operationQueue!: Table<OfflineOperation>;
  syncMeta!: Table<SyncMeta>;
}
```

### 8.3 `core/interceptors/offline.interceptor.ts`

Interceptor HTTP funcional (`HttpInterceptorFn`). Lógica:

```
Para cada HTTP request:
  Si isOnline → pass-through normal
  Si isOffline:
    Si método GET → buscar en IndexedDB y retornar
    Si método POST/PATCH/PUT/DELETE:
      Si entityType está en allowedOfflineWrites → encolar y retornar respuesta optimista
      Si no → lanzar error "Esta operación requiere conexión"
```

`allowedOfflineWrites` incluye: `orders`, `order_items`, `order_status`, `customers`, `cash_registers`, `movements`, `payments`, `products`, `categories`, `inventory_adjustments`, `purchases`, `suppliers`, `notifications`.

### 8.4 `core/components/offline-banner.component.ts`

```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ Sin conexión  ·  12 cambios pendientes  [Sincronizar]   │
└─────────────────────────────────────────────────────────────┘
```

- Aparece solo cuando `isOnline() === false` o hay `pendingOpsCount() > 0`
- Color: naranja (`--dw-coral-600`) cuando offline, verde cuando sincronizando
- Botón "Sincronizar" dispara `manualSync()` (visible solo cuando vuelve la conexión)
- Se integra en `shell.component.ts` sobre el topbar

### 8.5 `core/components/install-prompt.component.ts`

Captura el evento `beforeinstallprompt` del navegador y muestra un prompt personalizado:

```
┌─────────────────────────────────────────────┐
│  📲 Instala Dewan en tu teléfono            │
│  Úsala sin conexión, desde el inicio.       │
│                                             │
│  [Instalar]              [Ahora no]         │
└─────────────────────────────────────────────┘
```

Se muestra solo si:
- El usuario es `owner` o `admin`
- El navegador soporta la instalación (PWA criteria met)
- El usuario no la ha dismisseado en los últimos 7 días

---

## 9. Gate de rol — quién tiene offline

En `OfflineService.init()`, verificar `authService.currentUser()?.role`:

```typescript
const offlineEligible = ['owner', 'admin'];
if (!offlineEligible.includes(user.role)) {
  // No activar IndexedDB, no registrar operación queue
  // Si pierde conexión → pantalla estándar de error de red
  return;
}
```

Los roles `cashier`, `waiter`, `kitchen`, `delivery` nunca entran al flujo offline. Si pierden conexión, ven el error de red estándar de Angular/PrimeNG.

---

## 10. Sincronización de reportes offline

Los reportes (SPEC-17) son computados desde datos transaccionales. Cuando el admin está offline, los reportes se calculan **desde IndexedDB** en lugar del backend.

- Los servicios de reportes (`ReportsService`) verifican `offlineService.isOnline()`
- Offline: agregan los datos locales de `orders`, `payments`, `movements`, `purchases` en el cliente
- Muestran un banner: `Datos al [lastSyncAt]. Conéctate para ver cifras actualizadas.`
- No se expone un endpoint de reportes offline — el cómputo es client-side

---

## 11. Criterios de aceptación globales

```gherkin
Scenario: Admin opera completamente sin internet
  Given un admin con la app instalada como PWA y datos pre-cargados
  And el dispositivo pierde la conexión a internet
  When el admin navega a Pedidos, Caja, Pagos, Inventario
  Then todas las pantallas cargan desde IndexedDB
  And puede crear órdenes, registrar pagos y ajustar stock
  And cada acción muestra el contador de "N cambios pendientes"
  And al volver la conexión, los cambios se sincronizan automáticamente

Scenario: Cashier ve error de red al perder conexión
  Given un usuario con rol cashier que pierde la conexión
  When intenta cargar cualquier pantalla
  Then ve el mensaje de error de red estándar
  And no tiene acceso al modo offline

Scenario: Conflicto de caja es notificado al admin
  Given admin A cerró la caja offline con total X
  And mientras tanto admin B cerró la misma caja online con total Y
  When admin A sincroniza
  Then la sincronización completa excepto el cierre de caja
  And recibe una notificación: "Conflicto en caja — revisa el corte manual"
  And la caja offline queda marcada como conflict en la cola

Scenario: Cola sobrevive a sesión expirada
  Given un admin con 8 operaciones en cola offline
  And su JWT de refresh expiró (más de 7 días offline)
  When intenta sincronizar
  Then ve la pantalla de login con aviso "8 cambios pendientes"
  When hace login
  Then la sincronización se ejecuta automáticamente con las 8 operaciones

Scenario: App se instala como PWA
  Given un admin en Android Chrome que abre la app
  When la app cumple los criterios de instalabilidad (service worker, manifest, HTTPS)
  Then aparece el prompt de instalación personalizado
  When el admin acepta
  Then la app aparece en el launcher del teléfono
  And al abrirla offline, funciona sin navegador visible

Scenario: Re-envío de cola no genera duplicados
  Given la cola tiene la operación "crear orden O-123"
  And la red falla a mitad del push
  When el cliente reintenta el push completo
  Then el servidor procesa op O-123 una sola vez (idempotencia por operationId)
  And la DB tiene exactamente una orden O-123
```

---

## 12. Orden de implementación

| Prioridad | Item | Esfuerzo | Valor |
|---|---|---|---|
| 1 | PWA básica — `ng add @angular/pwa` + manifest + íconos | 2h | Instalar en homescreen ya |
| 2 | `IndexedDbService` con Dexie.js + stores | 4h | Base de todo lo offline |
| 3 | `OfflineService` — detección de estado + signals | 3h | Saber si estás online/offline |
| 4 | `OfflineBannerComponent` en shell | 1h | UX visible inmediatamente |
| 5 | Backend: `SyncModule` + `GET /sync/ping` + `GET /sync/pull` | 6h | Permite primer sync |
| 6 | `OfflineInterceptor` — lectura offline desde IndexedDB | 6h | Todo el catálogo/lecturas offline |
| 7 | Backend: `POST /sync/push` + tabla `sync_operations` + matriz conflictos | 8h | Escrituras se sincronizan |
| 8 | Operaciones offline para Orders + Kitchen (subset más crítico) | 6h | Core del negocio offline |
| 9 | Operaciones offline para Caja + Pagos (con `offlineLock`) | 6h | Financiero offline |
| 10 | Operaciones offline para Inventario + Compras + Catálogo | 4h | Módulos de gestión offline |
| 11 | Reportes offline (compute desde IndexedDB) | 4h | Datos de gestión sin conexión |
| 12 | `InstallPromptComponent` + UX de sync con conflictos | 3h | Pulido de experiencia |

**Total estimado:** ~53h de desarrollo

---

## 13. Pendientes de infraestructura

- **HTTPS obligatorio en producción** — el Service Worker solo funciona en HTTPS (ya está: `api.getdewan.com` + Cloudflare)
- **Íconos PWA** — crear `icon-192x192.png` y `icon-512x512.png` (maskable) con el logo Dewan
- **Límite de storage** — IndexedDB tiene límite por dispositivo. Con 7 días de datos de un restaurante activo, estimado ~50–100 MB. Dentro del límite de todos los navegadores modernos
- **Migración de IndexedDB** — Dexie.js maneja versiones de schema con `versionChange()`. Al actualizar la app, las migraciones de IndexedDB se ejecutan automáticamente en el cliente
