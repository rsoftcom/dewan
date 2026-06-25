# SPEC-21: Multi-Tenant Owner — Un Owner, Múltiples Negocios

**Descripción:** Un usuario con rol `owner` puede ser propietario de más de un tenant. Desde un único login puede cambiar de negocio activo mediante un selector en el navbar. En su dashboard puede ver el rendimiento de cada negocio.

**Actores:** `super_admin` (vincula owners), `owner` (usa el selector)

**Entidades:** `user`, `tenant`, `user_tenants` (nueva)

---

## Motivación y decisiones de diseño

El modelo actual tiene `user.tenant_id` como FK singular. Para soportar multi-tenant sin romper la arquitectura JWT existente adoptamos la estrategia más conservadora:

1. **Añadir tabla `user_tenants`** (m2m) sin eliminar `user.tenant_id`.
2. **`user.tenant_id` = tenant de origen** (donde fue creado el owner). No cambia.
3. **La sesión activa se controla por el JWT**. `tenantId` en el payload siempre refleja el tenant activo en esta sesión.
4. **Switch de tenant = nuevo JWT**. `POST /auth/switch-tenant` emite un access token + refresh cookie nuevos para el tenant solicitado, sin cambiar el `user.tenant_id` en DB.
5. El `TenantInterceptor` del backend no cambia — sigue leyendo `tenantId` del JWT.

---

## Cambio de esquema

```prisma
// Nueva tabla — añadir a prisma/schema.prisma
model UserTenant {
  userId   String
  tenantId String
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([userId, tenantId])
  @@map("user_tenants")
}

// Actualizar User:
model User {
  // ... campos existentes sin cambio ...
  extraTenants UserTenant[]  // ← añadir
}

// Actualizar Tenant:
model Tenant {
  // ... campos existentes sin cambio ...
  extraOwners  UserTenant[]  // ← añadir
}
```

**Migración:** La tabla `user_tenants` empieza vacía. Los owners existentes con un solo tenant no necesitan migración de datos — su tenant único sigue siendo `user.tenant_id`. Solo se insertan filas cuando un SA vincula a un owner con un segundo tenant.

---

## UC-21-01: Super admin vincula owner a un tenant adicional

**Actor:** `super_admin`
**Roles permitidos:** SA

**Precondiciones:**

- El `userId` existe y tiene `role = owner`.
- El `tenantId` existe con `status = active`.
- El owner no es ya el owner principal del tenant (no puede vincularse a su propio `tenant_id`).
- El owner no está ya vinculado al tenant en `user_tenants`.

**Flujo principal:**

1. SA envía `POST /tenants/:tenantId/link-owner` con `{ userId }`.
2. Sistema valida precondiciones.
3. Sistema inserta fila en `user_tenants(userId, tenantId)`.
4. Sistema retorna `200 OK` con resumen del vínculo.
5. Registra `link_owner` en `audit_log`.

**Flujo alternativo — desvincular:**

1. SA envía `DELETE /tenants/:tenantId/link-owner/:userId`.
2. Sistema elimina la fila de `user_tenants`.
3. Si el owner tiene una sesión activa en ese tenant (detectado por JWT activo): las sesiones existentes con ese `tenantId` no se invalidan automáticamente (duran máx 15 min). Los refresh tokens del owner en ese tenant se revocan.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Usuario no es owner | `400` — "Solo se pueden vincular usuarios con rol owner." |
| E02 | Vínculo ya existe | `409` — "El owner ya tiene acceso a este tenant." |
| E03 | Owner intenta vincularse a su propio tenant_id | `400` — "El owner ya pertenece a este negocio." |

**Criterios de aceptación:**

```gherkin
Scenario: SA vincula owner a segundo negocio
  Given owner "Carlos" con tenant_id = "tenant-A"
  And SA autenticado
  When SA envía POST /api/v1/tenants/tenant-B/link-owner con { userId: "carlos-uuid" }
  Then recibe status 200
  And existe fila en user_tenants (userId=carlos, tenantId=tenant-B)
  And Carlos puede llamar GET /auth/my-tenants y ver [tenant-A, tenant-B]

Scenario: Intentar vincular admin (no owner)
  When SA intenta vincular un usuario con role "admin"
  Then recibe status 400
```

**Contrato API:**

`POST /api/v1/tenants/:tenantId/link-owner`

Request: `{ "userId": "uuid-owner" }`

Response 200:
```json
{
  "userId": "uuid-owner",
  "tenantId": "uuid-tenant-B",
  "ownerName": "Carlos Ruiz",
  "tenantName": "Restaurante El Mar"
}
```

`DELETE /api/v1/tenants/:tenantId/link-owner/:userId` → Response 200: `{ "unlinked": true }`

---

## UC-21-02: Owner lista sus tenants accesibles

**Actor:** `owner`
**Roles permitidos:** OW

**Flujo principal:**

1. Owner envía `GET /auth/my-tenants`.
2. Sistema busca `user.tenant_id` (tenant principal) + todas las filas en `user_tenants` donde `userId = sub`.
3. Retorna la lista deduplicada, marcando cuál es el tenant activo en la sesión actual (`isActive: true`).

**Criterios de aceptación:**

```gherkin
Scenario: Owner con un solo negocio
  Given owner con tenant_id = "tenant-A" y sin filas en user_tenants
  When llama GET /api/v1/auth/my-tenants
  Then recibe lista con un elemento { id: tenant-A, isActive: true }

Scenario: Owner con dos negocios, sesión en tenant-A
  Given owner vinculado a tenant-A (principal) y tenant-B (user_tenants)
  And JWT activo tiene tenantId = "tenant-A"
  When llama GET /api/v1/auth/my-tenants
  Then recibe [{ id: tenant-A, name: "...", isActive: true }, { id: tenant-B, name: "...", isActive: false }]
```

**Contrato API:**

`GET /api/v1/auth/my-tenants`

Response 200:
```json
[
  { "id": "uuid-A", "name": "Restaurante El Rincón", "logo": null, "businessType": "restaurant", "isActive": true },
  { "id": "uuid-B", "name": "Café El Mar", "logo": "https://...", "businessType": "cafe", "isActive": false }
]
```

---

## UC-21-03: Cambiar de tenant activo (switch)

**Actor:** `owner`
**Roles permitidos:** OW

**Precondiciones:**

- El owner tiene acceso al `tenantId` solicitado (su `user.tenant_id` o en `user_tenants`).
- El tenant destino tiene `status = active`.

**Flujo principal:**

1. Owner envía `POST /auth/switch-tenant` con `{ tenantId }`.
2. Sistema verifica que el owner tiene acceso al tenant.
3. Sistema verifica que el tenant está activo.
4. Sistema genera nuevo Access Token con `{ sub, tenantId: <nuevo>, role: 'owner' }`.
5. Sistema revoca el Refresh Token actual y genera uno nuevo (misma rotación que UC-01-02).
6. Retorna nuevo Access Token en body + Refresh Token en cookie `HttpOnly`.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Owner no tiene acceso al tenant solicitado | `403` — "No tienes acceso a este negocio." |
| E02 | Tenant inactivo | `403` — "Este negocio está desactivado." |
| E03 | Mismo tenant que ya está activo | `200` — retorna nuevo token igualmente (idempotente) |

**Criterios de aceptación:**

```gherkin
Scenario: Switch exitoso
  Given owner con acceso a [tenant-A, tenant-B], sesión activa en tenant-A
  When envía POST /api/v1/auth/switch-tenant con { tenantId: "tenant-B" }
  Then recibe status 200 con nuevo accessToken (tenantId = tenant-B en payload)
  And la cookie refreshToken se actualiza
  And el AT anterior (tenant-A) queda válido hasta su expiración natural (15min)

Scenario: Intento de acceso a tenant no vinculado
  When owner envía switch-tenant con un tenantId al que no tiene acceso
  Then recibe status 403
```

**Contrato API:**

`POST /api/v1/auth/switch-tenant`

Request: `{ "tenantId": "uuid-tenant-B" }`

Response 200:
```json
{ "accessToken": "eyJ...", "tenant": { "id": "uuid-B", "name": "Café El Mar" } }
```

---

## UC-21-04: Selector de tenant en el navbar

**Actor:** `owner` con más de un tenant
**Roles:** OW

**Descripción:** Componente visual en `ShellComponent` que permite cambiar de negocio activo.

**Flujo frontend:**

1. Al cargar el shell, `AuthService` llama `GET /auth/my-tenants` si el rol es `owner`.
2. Si `myTenants().length > 1`: muestra el selector de tenant en el navbar.
3. El selector muestra el nombre del tenant activo con un ícono de chevron.
4. Al seleccionar otro tenant:
   a. Llama `AuthService.switchTenant(tenantId)` → `POST /auth/switch-tenant`.
   b. Almacena el nuevo `accessToken` y actualiza `currentUser.tenantId`.
   c. Llama `WebSocketService.refreshToken(newToken)` para mantener la sesión WS.
   d. Navega a la ruta home del rol (dashboard) para refrescar el contexto visual.

**UX:**

- Selector visible solo cuando `myTenants().length > 1`.
- Muestra logo del tenant (si existe) o inicial del nombre.
- Indica el tenant activo con un check.
- Si solo hay un tenant: muestra el nombre del negocio sin selector (sin dropdown).

**Implementación:**

```typescript
// En AuthService — nuevas adiciones
readonly myTenants = signal<TenantSummary[]>([]);

loadMyTenants(): Observable<TenantSummary[]> { ... }  // GET /auth/my-tenants

switchTenant(tenantId: string): Observable<SwitchTenantResponse> {
  return this.http.post<SwitchTenantResponse>('/auth/switch-tenant', { tenantId }, { withCredentials: true }).pipe(
    tap(res => {
      this._accessToken.set(res.accessToken);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      // Actualizar currentUser.tenantId
      this._currentUser.update(u => u ? { ...u, tenantId } : null);
      localStorage.setItem(USER_KEY, JSON.stringify(this._currentUser()));
    }),
  );
}
```

**Criterios de aceptación:**

```gherkin
Scenario: Owner con un solo negocio no ve selector
  Given owner vinculado a un solo tenant
  When navega al shell
  Then ve el nombre del negocio en el navbar pero sin dropdown

Scenario: Owner cambia de negocio
  Given owner con dos negocios en el navbar
  When selecciona "Café El Mar" en el selector
  Then el sistema llama switch-tenant
  And el navbar actualiza el nombre al nuevo negocio
  And se navega al dashboard
  And todos los módulos (pedidos, productos, etc.) muestran datos de "Café El Mar"
```

---

## UC-21-05: Dashboard multi-tenant — resumen de negocios

**Actor:** `owner` con más de un tenant
**Roles:** OW

**Descripción:** Panel en el dashboard que muestra métricas básicas de hoy para cada negocio accesible, sin necesidad de hacer switch.

**Flujo:**

1. Si `myTenants().length > 1`, el dashboard muestra una sección "Mis Negocios".
2. Para cada tenant en `myTenants()`, el frontend llama `GET /reports/summary?tenantId=X&date=today` usando el switch-tenant temporalmente no — ver nota.
3. **Implementación práctica:** El backend expone `GET /owners/summary` que retorna stats básicas de todos los tenants accesibles del owner autenticado, en una sola llamada.

**Nuevo endpoint backend:**

`GET /api/v1/owners/dashboard`

Response 200:
```json
[
  {
    "tenantId": "uuid-A",
    "tenantName": "Restaurante El Rincón",
    "today": {
      "ordersCount": 23,
      "revenue": 345000,
      "pendingOrders": 2
    }
  },
  {
    "tenantId": "uuid-B",
    "tenantName": "Café El Mar",
    "today": {
      "ordersCount": 8,
      "revenue": 95000,
      "pendingOrders": 0
    }
  }
]
```

**Implementación backend:**

- `OwnersDashboardService` que itera sobre los tenants accesibles del owner (sin cambiar el contexto del JWT) usando queries directas en Prisma con `tenantId IN [...]`.
- Solo accesible si el usuario es `owner`.
- Los datos son solo de hoy (fecha del servidor).

**Criterios de aceptación:**

```gherkin
Scenario: Dashboard con dos negocios
  Given owner con acceso a [tenant-A, tenant-B]
  When abre el dashboard (tenant activo = tenant-A)
  Then ve el panel "Mis Negocios" con una card por cada tenant
  And cada card muestra nombre, ingresos de hoy y pedidos activos
  And hacer clic en otra card llama switch-tenant y navega
```

---

## Notas de implementación y correcciones (2026-06-24)

### UC-21-04 — Selector de tenant: bugs corregidos

**Bug 1 — Selector visible para `super_admin` tras sesión de owner.**
Síntoma: al iniciar sesión como super_admin después de una sesión de owner, el selector de tenant seguía visible en el navbar.

Causa raíz: `setSession()` en `AuthService` no limpiaba `_myTenants`. El signal conservaba la lista de tenants de la sesión anterior.

Corrección:
```typescript
// core/auth/auth.service.ts — setSession()
private setSession(res: LoginResponse): void {
  this._accessToken.set(res.accessToken);
  this._currentUser.set(res.user);
  this._myTenants.set([]);   // ← limpiar tenants de sesión anterior
  localStorage.setItem(TOKEN_KEY, res.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(res.user));
}
```

Corrección adicional defensiva en `ShellComponent`:
```typescript
// Antes: solo comprueba longitud
showTenantSelector = computed(() => this.auth.myTenants().length > 1);

// Después: guarda por rol además de longitud
showTenantSelector = computed(() => this.user()?.role === 'owner' && this.auth.myTenants().length > 1);
```

---

**Bug 2 — Dashboard sin cards "Mis Negocios" en el primer login.**
Síntoma: al entrar como owner por primera vez, la sección "Mis Negocios" no mostraba las business cards.

Causa raíz: race condition. `DashboardComponent.ngOnInit` se ejecutaba cuando `auth.myTenants()` aún era `[]` (la llamada `loadMyTenants()` del shell no había terminado). La condición era `false` y `getOwnerDashboard()` nunca se disparaba. Cuando el signal se actualizaba, el `@if` aparecía pero sin datos.

**Corrección 1 — login.component.ts (primer login):**

Para el rol `owner`, `loadMyTenants()` se llama antes de navegar, garantizando que el signal esté poblado cuando el dashboard renderice:

```typescript
next: res => {
  const home = this.authService.getHomeRouteForRole(res.user.role);
  if (res.user.role === 'owner') {
    this.authService.loadMyTenants().subscribe({
      next: () => this.router.navigateByUrl(home),
      error: () => this.router.navigateByUrl(home),  // navegar aunque falle
    });
  } else {
    this.router.navigateByUrl(home);
  }
},
```

**Corrección 2 — dashboard.component.ts (page refresh + resiliencia):**

`ngOnInit` fue reemplazado por un `effect()` que reacciona reactivamente al signal `myTenants()`. El booleano `statsFetched` (no signal) evita llamadas duplicadas sin crear ciclos reactivos:

```typescript
// Antes — condición evaluada una sola vez en ngOnInit, ignorada si myTenants aún es []
ngOnInit(): void {
  if (this.auth.myTenants().length > 1) {
    this.loadingStats.set(true);
    this.dashboardService.getOwnerDashboard().subscribe(...);
  }
}

// Después — effect reactivo que espera a que myTenants esté disponible
private statsFetched = false;

constructor() {
  effect(() => {
    const tenants = this.auth.myTenants();
    if (tenants.length > 1 && !this.statsFetched) {
      this.statsFetched = true;
      this.fetchStats();
    }
  }, { allowSignalWrites: true });
}
```

Este patrón cubre tanto el primer login (si `loadMyTenants` del login falla) como el page refresh (donde la llamada del shell sigue siendo asíncrona respecto al render del dashboard).

---

## Archivos afectados

**Backend:**
- `prisma/schema.prisma` — añadir `UserTenant` model
- `prisma/migrations/` — nueva migración (`add_user_tenants_table`)
- `modules/auth/auth.service.ts` — `myTenants()`, `switchTenant()`
- `modules/auth/auth.controller.ts` — `GET /my-tenants`, `POST /switch-tenant`
- `modules/tenants/tenants.controller.ts` — `POST /link-owner`, `DELETE /link-owner/:userId`
- `modules/tenants/tenants.service.ts` — lógica de vinculación
- `modules/owners/` — **NUEVO** módulo con `owners.controller.ts`, `owners.service.ts` (endpoint `/owners/dashboard`)

**Frontend:**
- `core/auth/auth.service.ts` — `myTenants` signal, `loadMyTenants()`, `switchTenant()`
- `core/models/auth.model.ts` — `TenantSummary`, `SwitchTenantResponse`
- `app/shell/shell.component.ts` — selector de tenant en navbar
- `features/dashboard/` — sección "Mis Negocios" + `DashboardSummaryService`
