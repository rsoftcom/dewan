# SPEC-19: Audit Log

**Descripción:** Registro inmutable de todas las acciones críticas del sistema. Solo lectura. Append-only en DB.

**Actores:** Sistema (escribe), `super_admin` (lee — único rol con acceso)

**Entidades:** `audit_log`

> **Fase 2 — cambio de roles:** El módulo de audit log es **puramente técnico** y queda restringido exclusivamente al `super_admin`. Los roles `owner` y `admin` ya no tienen acceso. El SA accede al módulo en `/admin/audit-logs` seleccionando primero el tenant a auditar.

-----

## UC-19-01: Listar registros de auditoría de un tenant

**Actor:** `super_admin`
**Roles permitidos:** SA (único)

**Precondiciones:**

- SA ha seleccionado un tenant desde el listado (`GET /tenants`).

**Flujo principal:**

1. SA envía `GET /audit-logs?tenantId=<uuid>` con filtros opcionales.
2. Sistema verifica que el actor es SA (rol guard).
3. Sistema retorna registros del tenant indicado, paginados, ordenados por `created_at` DESC.

**Filtros soportados:**

- `tenantId` — **requerido** para SA (sin él, retorna `400`)
- `userId` — logs de un usuario específico dentro del tenant
- `entity` — entidad afectada (ej: `product`, `order`)
- `entityId` — registro específico afectado
- `action` — tipo de acción (ej: `create`, `update`, `login`)
- `dateFrom`, `dateTo` — rango de fechas

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Rol distinto a SA intenta acceder | `403` — "Acceso restringido." |
| E02 | `tenantId` no proporcionado | `400` — "Se requiere tenantId." |
| E03 | Tenant no existe | `404` |

**Criterios de aceptación:**

```gherkin
Scenario: SA lista logs de un tenant específico
  Given super_admin autenticado
  When envía GET /api/v1/audit-logs?tenantId=uuid-tenant&dateFrom=2026-05-19
  Then recibe logs solo de ese tenant
  And la respuesta incluye userName y action de cada log

Scenario: Owner intenta acceder al endpoint
  Given owner autenticado
  When envía GET /api/v1/audit-logs?tenantId=uuid
  Then recibe status 403

Scenario: SA omite tenantId
  When SA envía GET /api/v1/audit-logs sin tenantId
  Then recibe status 400
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

## UC-19-03: Panel de audit en el frontend (SA con selector de tenant)

**Actor:** `super_admin`
**Roles permitidos:** SA

**Descripción:** El super admin accede a `/admin/audit-logs`. Antes de ver logs debe seleccionar un tenant. La UI tiene un selector siempre visible en la parte superior.

**Flujo frontend:**

1. SA navega a `/admin/audit-logs`.
2. La página carga la lista de tenants vía `GET /tenants?status=active&limit=100` y la pone en un `<p-select>`.
3. SA selecciona un tenant del dropdown.
4. La tabla de logs carga con `GET /audit-logs?tenantId=<seleccionado>`.
5. SA puede filtrar por `entity`, `action`, `dateFrom`, `dateTo` sin cambiar el tenant seleccionado.
6. Al cambiar el tenant en el selector, la tabla se recarga.

**UX:**

- Ruta: `/admin/audit-logs` (protegida con `roleGuard('super_admin')`)
- El selector de tenant es el primer elemento de la página, siempre visible.
- Mientras no hay tenant seleccionado, la tabla muestra un estado vacío: "Selecciona un negocio para ver sus registros."
- Los filtros de entity/action/fechas son opcionales y se aplican sobre el tenant seleccionado.

**Criterios de aceptación:**

```gherkin
Scenario: SA selecciona un tenant y ve sus logs
  Given SA en /admin/audit-logs
  When selecciona "Restaurante El Rincón" del dropdown
  Then la tabla carga los audit logs de ese tenant

Scenario: SA cambia de tenant
  Given SA viendo logs de tenant-A
  When selecciona tenant-B en el dropdown
  Then la tabla se vacía y carga los logs de tenant-B

Scenario: Ruta inaccesible para otros roles
  Given owner autenticado
  When navega a /admin/audit-logs
  Then es redirigido a /unauthorized
```

-----

## Cambios en el backend

**`modules/audit-logs/audit-logs.controller.ts`:**

- Cambiar `@Roles(ROLES.OWNER, ROLES.ADMIN, ROLES.SUPER_ADMIN)` → `@Roles(ROLES.SUPER_ADMIN)` en todos los endpoints.
- Hacer `tenantId` requerido en el query param de `findAll` (antes era opcional para SA).

**`modules/audit-logs/audit-logs.service.ts`:**

- Remover la lógica de leer `tenantId` del JWT para OW/AD — ahora siempre viene del query param.
- Añadir validación: si `tenantId` está ausente, lanzar `BadRequestException`.

## Cambios en el frontend

- **Ruta**: mover de `/audit-logs` a `/admin/audit-logs` en `app.routes.ts`.
- **Guard**: `roleGuard('super_admin')` en la ruta.
- **Nav**: mover el ítem de "Audit Logs" en `shell.component.ts` de la sección "Administración" general a la sección "Super Admin" (junto a Tenants).
- **Componente**: añadir selector de tenant como primer elemento del `audit-logs-list.component.ts`.
