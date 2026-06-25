# Dewan — Spec Index

> Reference for the orchestrator. Lists all specs with their module, use case count, and key entities.

## Fase 1 — Módulos base (SPEC-01 a SPEC-19)

| File | Module | Use Cases | Key Entities | Endpoints |
|---|---|---|---|---|
| SPEC-01-auth.md | Auth | UC-01-01 to UC-01-04 | user, refresh_token | 4 |
| SPEC-02-users.md | Users | UC-02-01 to UC-02-07 | user | 7 |
| SPEC-03-tenants.md | Tenants | UC-03-01 to UC-03-05 | tenant | 5 |
| SPEC-04-units.md | Units | UC-04-01 to UC-04-03 | unit, unit_conversion | 3 |
| SPEC-05-products.md | Products | UC-05-01 to UC-05-07 | product, recipe_item | 8 |
| SPEC-06-categories.md | Categories | UC-06-01 to UC-06-05 | category, product_category | 5 |
| SPEC-07-orders.md | Orders | UC-07-01 to UC-07-06 | order, order_item, order_status_history | 11 |
| SPEC-08-kitchen.md | Kitchen | UC-08-01 to UC-08-05 | order, order_status_history | 4 |
| SPEC-09-payments.md | Payments | UC-09-01 to UC-09-03 | payment | 3 |
| SPEC-10-cash-register.md | Cash Register | UC-10-01 to UC-10-03 | cash_register | 3 |
| SPEC-11-movements.md | Movements | UC-11-01 to UC-11-02 | movement | 2 |
| SPEC-12-customers.md | Customers | UC-12-01 to UC-12-04 | customer | 4 |
| SPEC-13-delivery.md | Delivery | UC-13-01 to UC-13-06 | delivery_person, order | 8 |
| SPEC-14-suppliers.md | Suppliers | UC-14-01 to UC-14-04 | supplier | 4 |
| SPEC-15-purchases.md | Purchases | UC-15-01 to UC-15-03 | purchase, purchase_item | 3 |
| SPEC-16-inventory.md | Inventory | UC-16-01 to UC-16-03 | inventory_adjustment | 3 |
| SPEC-17-reports.md | Reports | UC-17-01 to UC-17-05 | (aggregation queries) | 5 |
| SPEC-18-notifications.md | Notifications | UC-18-01 to UC-18-05 | notification | 3 |
| SPEC-19-audit-log.md | Audit Log *(SA only — actualizado fase 2)* | UC-19-01 to UC-19-03 | audit_log | 2 |

## Fase 2 — Evolución de plataforma (SPEC-20 a SPEC-22)

| File | Module | Use Cases | Afecta |
|---|---|---|---|
| SPEC-20-websocket.md | WebSocket Infrastructure | UC-20-01 to UC-20-05 | SPEC-07, SPEC-08, SPEC-18 |
| SPEC-21-multi-tenant-owner.md | Multi-Tenant Owner | UC-21-01 to UC-21-05 | SPEC-01, SPEC-03, DB schema |
| SPEC-22-performance.md | Performance | PERF-01 to PERF-10 | Transversal |

## Fase 3 — Calidad y operaciones (SPEC-23+)

| File | Module | Items | Afecta |
|---|---|---|---|
| SPEC-23-testing.md | Testing y Cobertura | TEST-01 to TEST-09 | Transversal (ambos repos) |

**Fase 1:** 19 módulos · 57 use cases · 90+ endpoints  
**Fase 2:** 3 specs transversales · cambios en schema, auth y capa real-time  
**Fase 3:** calidad de código, testing y operaciones

## Cambios de fase 2 sobre specs existentes

| Spec | Cambio |
|---|---|
| SPEC-18 | Añade UC-18-04 (conexión autenticada) y UC-18-05 (bell real-time) — ver SPEC-20 |
| SPEC-19 | Acceso restringido a SA (elimina OW/AD). Ruta frontend → `/admin/audit-logs`. Añade UC-19-03 (selector de tenant) |
| SPEC-01 | Añadir endpoints `GET /auth/my-tenants` y `POST /auth/switch-tenant` — ver SPEC-21 |
| SPEC-03 | Añadir endpoints `POST /tenants/:id/link-owner` y `DELETE /tenants/:id/link-owner/:userId` — ver SPEC-21 |

## Bugfixes post-lanzamiento (2026-06-24)

| Módulo | Bug | Fix |
|---|---|---|
| SPEC-21 | Tenant selector visible para `super_admin` tras sesión de owner | `setSession()` limpia `_myTenants`; `showTenantSelector` guarda por `role==='owner'` |
| SPEC-21 | Dashboard "Mis Negocios" vacío en primer login (race condition) | `login.component` llama `loadMyTenants()` antes de navegar; `dashboard.component` usa `effect()` reactivo |
