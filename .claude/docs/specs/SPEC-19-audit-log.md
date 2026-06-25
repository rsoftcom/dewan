# SPEC-19: Audit Log

**Descripción:** Registro inmutable de todas las acciones críticas del sistema. Solo lectura. Append-only en DB.

**Actores:** Sistema (escribe), `super_admin` (lee — único rol con acceso)

**Entidades:** `audit_log`

> **Fase 2 — implementada:** El módulo de audit log es **puramente técnico** y está restringido
> exclusivamente al `super_admin`. El SA accede a los logs de cada tenant mediante un botón
> **"Ver auditoría"** (`pi pi-shield`) en la fila de cada tenant en `/admin/tenants`.
> No hay entrada de menú lateral para Auditoría.

-----

## UC-19-01: Listar registros de auditoría de un tenant

**Actor:** `super_admin`
**Roles permitidos:** SA (único)

**Precondiciones:**

- SA está en `/admin/tenants` y hace clic en "Ver auditoría" de un tenant.

**Flujo principal:**

1. SA hace clic en el botón de auditoría de un tenant en la lista de tenants.
2. El frontend navega a `/admin/audit-logs?tenantId=<uuid>`.
3. La página carga automáticamente los logs de ese tenant (`GET /audit-logs?tenantId=<uuid>`).
4. SA puede filtrar por `entity`, `action`, `userId`, `dateFrom`, `dateTo`.

**Filtros soportados:**

- `tenantId` — **requerido** (viene del query param de la URL)
- `userId` — logs de un usuario específico dentro del tenant
- `entity` — entidad afectada (ej: `product`, `order`)
- `entityId` — registro específico afectado
- `action` — tipo de acción (ej: `create`, `update`, `login`)
- `dateFrom`, `dateTo` — rango de fechas

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Rol distinto a SA intenta acceder | `403` — "Acceso restringido." |
| E02 | `tenantId` no proporcionado | `400` — "tenantId is required." |
| E03 | Tenant no existe | `404` |

**Criterios de aceptación:**

```gherkin
Scenario: SA ve logs de un tenant desde la lista
  Given super_admin en /admin/tenants
  When hace clic en el botón de auditoría de "Restaurante El Rincón"
  Then navega a /admin/audit-logs?tenantId=uuid-tenant
  And la tabla carga los logs de ese tenant automáticamente

Scenario: Owner intenta acceder al endpoint
  Given owner autenticado
  When envía GET /api/v1/audit-logs?tenantId=uuid
  Then recibe status 403

Scenario: SA omite tenantId
  When SA navega a /admin/audit-logs sin tenantId
  Then la página muestra el estado vacío "Abre la auditoría desde la lista de negocios"
```

**Contrato API:**

`GET /api/v1/audit-logs?tenantId=uuid&entity=order&action=status_change&dateFrom=2026-05-01&page=1&limit=50`

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userName": "Juan Pérez",
      "action": "status_change",
      "entity": "order",
      "entityId": "uuid-order",
      "metadata": {
        "before": { "status": "pending" },
        "after": { "status": "in_kitchen" }
      },
      "createdAt": "2026-05-19T10:05:00Z"
    }
  ],
  "meta": { "total": 234, "page": 1, "limit": 50, "totalPages": 5 }
}
```

-----

## UC-19-02: Ver historial completo de un registro

**Actor:** `super_admin`
**Roles permitidos:** SA (único)

**Descripción:** Atajo para ver todos los cambios sobre una entidad específica, ordenados cronológicamente.

**Flujo principal:**

1. SA envía `GET /audit-logs/entity/:entity/:entityId?tenantId=<uuid>`.
2. Sistema retorna todos los logs de ese registro, ordenados por `created_at` ASC.

**Criterios de aceptación:**

```gherkin
Scenario: SA ve historia completa de un pedido
  Given un pedido que pasó por pending → in_kitchen → prepared → served → paid → completed
  When SA envía GET /api/v1/audit-logs/entity/order/:orderId?tenantId=uuid
  Then recibe 6 registros en orden cronológico con los cambios de cada transición
```

**Contrato API:**

`GET /api/v1/audit-logs/entity/order/:id?tenantId=uuid`

Response 200:

```json
[
  { "action": "create", "userName": "Ana López", "createdAt": "10:00:00", "metadata": {} },
  { "action": "status_change", "userName": "Pedro Ramos", "createdAt": "10:02:00", "metadata": { "before": { "status": "pending" }, "after": { "status": "in_kitchen" } } }
]
```

-----

## UC-19-03: Acceso a auditoría desde la lista de tenants

**Actor:** `super_admin`
**Roles permitidos:** SA

**Descripción:** El SA accede a los logs de un tenant específico mediante un botón en la fila del tenant en `/admin/tenants`. No hay entrada de menú lateral para Auditoría.

**Flujo frontend:**

1. SA está en `/admin/tenants` (Plataforma).
2. En la columna de acciones de cada tenant hay un botón `pi pi-shield` ("Ver auditoría").
3. Al hacer clic, el frontend navega a `/admin/audit-logs?tenantId=<id-del-tenant>`.
4. La página `/admin/audit-logs` lee `tenantId` del query param y carga los logs automáticamente.
5. SA puede filtrar por entity/action/userId/fechas sobre el tenant seleccionado.
6. SA hace clic en cualquier fila de la tabla para abrir el dialog de detalle con el log completo.
7. Un botón "Negocios" en la cabecera permite volver a `/admin/tenants`.

**UX:**

- Ruta: `/admin/audit-logs?tenantId=<uuid>` (protegida con `roleGuard('super_admin')`)
- Si el SA navega a `/admin/audit-logs` sin `tenantId`, la página muestra un estado vacío con enlace a la lista de tenants.
- No hay selector de tenant dentro de la página de auditoría — el tenantId siempre viene de la URL.
- **Dialog de detalle:** al hacer clic en una fila, se abre un `<p-dialog>` con todos los campos del log (acción, entidad, ID entidad, usuario, fecha) y el `metadata` formateado con `JSON.stringify(…, null, 2)` en un bloque `<pre>` con scroll.

**Criterios de aceptación:**

```gherkin
Scenario: SA accede a logs desde la lista de tenants
  Given SA en /admin/tenants
  When hace clic en el botón "Ver auditoría" de un tenant
  Then navega a /admin/audit-logs?tenantId=uuid
  And la tabla carga los logs de ese tenant

Scenario: SA ve el detalle completo de un log
  Given SA viendo la tabla de logs
  When hace clic en cualquier fila
  Then se abre un dialog con todos los campos del log
  And el metadata se muestra como JSON indentado

Scenario: SA navega directamente sin tenantId
  Given SA en /admin/audit-logs (sin query param)
  Then la página muestra estado vacío con enlace a /admin/tenants

Scenario: Ruta inaccesible para otros roles
  Given owner autenticado
  When navega a /admin/audit-logs
  Then es redirigido a /unauthorized
```

-----

## Implementación (estado actual)

### Backend (`modules/audit-logs/`)

- **Controller**: `@Roles(ROLES.SUPER_ADMIN)` en clase. Sin `TenantInterceptor`.
- **`findAll`**: `tenantId` requerido en query param; lanza `BadRequestException` si ausente.
- **`findByEntity`**: acepta `tenantId` como query param; lanza `BadRequestException` si ausente.

### Frontend

- **Ruta**: `/admin/audit-logs` con `canActivate: [roleGuard(ROLES.SUPER_ADMIN)]`.
- **Nav**: Sin entrada en el menú lateral — acceso exclusivo desde tenant-list.
- **`tenant-list.component.ts`**: botón `pi pi-shield` en la columna de acciones de cada fila.
  Navega a `/admin/audit-logs?tenantId=<id>`.
- **`audit-log-list.component.ts`**: lee `tenantId` de `ActivatedRoute.snapshot.queryParams`.
  Si no hay `tenantId`, muestra estado vacío. Si hay, carga y filtra logs.
