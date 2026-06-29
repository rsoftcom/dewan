# Dewan — Architecture Summary (Quick Reference)

> Compact version for agent context. Full docs: `rsoft-arquitectura-fase3.md`
> **Última actualización:** 2026-06-28

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18.2 · PrimeNG 18 (Aura) · Tailwind CSS · TypeScript 5.5 |
| Backend | NestJS 10.4 · Prisma 5.22 · PostgreSQL 16 · TypeScript 5.7 · Node.js 20 LTS |
| Auth | JWT (access 15min + refresh 7d HttpOnly cookie) · bcrypt · Passport |
| WebSockets | Socket.io via NestJS Gateway (`common/gateway/events.gateway.ts`) |
| Hosting frontend | Cloudflare Pages (CI/CD from `dewan-frontend` repo, branch: dev) |
| Hosting backend | DigitalOcean Droplet s-1vcpu-1gb · PM2 + Nginx · PostgreSQL on droplet |
| Reverse proxy | Nginx (SSL termination + WebSocket upgrade) |
| Domain | `app.getdewan.com` (front) · `api.getdewan.com` (back) |
| CI/CD | GitHub Actions (one workflow per repo: `deploy.yml`) |
| API docs | Swagger at `/docs` (non-production only) |
| Email | Console logging (MVP — TODO: wire to AWS SES) |

## Key Patterns

- **Multi-tenant:** `tenant_id` on every business entity, `TenantInterceptor` copies from JWT
- **API prefix:** `/v1` (set in `main.ts` via `setGlobalPrefix('v1')`) — NOT `/api/v1`
- **Pagination:** `?page=1&limit=20` → `{ data, meta: { total, page, limit, totalPages } }`
- **Auth flow:** Login → `accessToken` (body) + `refreshToken` (HttpOnly cookie)
- **Soft delete:** `status: active | inactive`, never physical DELETE on business entities.
  Exception: `Category` uses hard delete (no `status` field).
- **Audit:** explicit `AuditLogService.log()` calls in service mutations (not an interceptor)
- **Error format:** `{ statusCode, message[], error }`
- **Rate limiting:** ThrottlerModule — 100 requests / 60 seconds
- **WebSocket rooms:** `kitchen_[tenantId]`, `orders_[tenantId]`, `user_[userId]`
- **WebSocket auth:** JWT token via `socket.handshake.auth.token` on connect

## Backend Middleware Stack (main.ts)

```
Request
  ↓ cookieParser()           — parses HttpOnly refresh token cookie
  ↓ compression()            — gzip for responses
  ↓ ValidationPipe           — whitelist: true, transform: true
  ↓ LoggingInterceptor       — global request/response logger (custom, not Pino)
  ↓ HttpExceptionFilter      — standard { statusCode, message[], error } format
  ↓ JwtAuthGuard (APP_GUARD) — Passport JWT, skips @Public endpoints
  ↓ RolesGuard (APP_GUARD)   — checks @Roles() decorator vs JWT role
  ↓ TenantInterceptor        — per-controller, copies user.tenantId → request.tenantId
  ↓ ThrottlerGuard           — 100 req / 60s
```

## Module Inventory (21 backend modules)

| Module | Path | Notes |
|---|---|---|
| auth | `modules/auth/` | Login, refresh, me, my-tenants, switch-tenant, logout |
| tenants | `modules/tenants/` | CRUD, status, link-owner / unlink-owner |
| users | `modules/users/` | CRUD, password reset, role assignment |
| units | `modules/units/` | Global (not tenant-scoped) — measurement units + conversions |
| categories | `modules/categories/` | Tenant-scoped, hierarchical, **hard delete** |
| products | `modules/products/` | CRUD, recipes, images, stock tracking |
| cash-registers | `modules/cash-registers/` | Open/close daily registers |
| movements | `modules/movements/` | Income/expense/cost/sales (immutable after create) |
| customers | `modules/customers/` | Delivery customer directory |
| orders | `modules/orders/` | Create local/delivery, add/remove items, tables |
| kitchen | `modules/kitchen/` | Accept (deducts stock), ready, reject |
| payments | `modules/payments/` | Register payment, track change |
| delivery | `modules/delivery/` | Assign person, on_the_way, delivered, collect money |
| suppliers | `modules/suppliers/` | Vendor directory |
| purchases | `modules/purchases/` | Purchase orders (immutable after create) |
| inventory | `modules/inventory/` | List stock, create adjustments (immutable) |
| notifications | `modules/notifications/` | List, mark read, internal createForRoles |
| audit-logs | `modules/audit-logs/` | List/filter (super_admin only) |
| reports | `modules/reports/` | Sales, cash register, inventory aggregations |
| **owners** | `modules/owners/` | **Multi-tenant dashboard** — `GET /owners/dashboard` (owner only) |

Frontend features mirror backend modules plus: `dashboard/`, `tables/`, `profile/`.

## Multi-Tenant Architecture

Owners can manage multiple restaurants. The `UserTenant` junction table tracks extra tenants per user.

| Endpoint | Description |
|---|---|
| `GET /auth/my-tenants` | Lists all tenants owned by the current user |
| `POST /auth/switch-tenant` | Issues a new JWT for a different tenant context |
| `POST /tenants/:id/link-owner` | Links an owner user to an additional tenant |
| `DELETE /tenants/:id/link-owner/:userId` | Unlinks owner from tenant |
| `GET /owners/dashboard` | Aggregated stats across all owner's tenants |

## WebSocket Events

| Room | Receives |
|---|---|
| `kitchen_[tenantId]` | `order:new`, `order:updated` |
| `orders_[tenantId]` | `order:updated`, `stock:low_alert`, `order:assigned`, `order:paid` |
| `user_[userId]` | `notification:new` |

Event format: `{domain}:{action}` in snake_case (e.g. `order:new`, `stock:low_alert`).

## Order Status Machine

```
Local:    pending → in_kitchen → prepared → served → paid → completed
Delivery: pending → in_kitchen → prepared → assigned → on_the_way → delivered → money_collected → paid → completed
Both:     any non-terminal → rejected
```

## Deployment Architecture

```
Cloudflare (DNS + CDN + SSL)
  ↓
  ├── Cloudflare Pages → dewan-frontend SPA (ng build --configuration production)
  └── api.getdewan.com → DigitalOcean Droplet
        ├── Nginx (SSL + WebSocket upgrade)
        ├── PM2 → NestJS:3000
        └── PostgreSQL 16:5432
```

GitHub Actions on push to `main` (per repo):
- Backend: build → SCP `dist/` → `npm ci` → `prisma migrate deploy` → `pm2 restart`
- Frontend: Cloudflare Pages auto-builds from repo connection

## Common Layer (`dewan-backend/common/`)

```
common/
├── constants/roles.constant.ts     — ROLES + MANAGEMENT_ROLES, OPERATIONAL_ROLES, ORDER_CREATORS
├── decorators/                     — @CurrentUser(), @Public(), @Roles()
├── filters/http-exception.filter.ts
├── gateway/events.gateway.ts       — WebSocket hub (emit method used by all services)
├── guards/jwt-auth.guard.ts        — extends AuthGuard('jwt'), skips @Public
├── guards/roles.guard.ts           — checks @Roles vs JWT role
├── interceptors/tenant.interceptor.ts  — copies user.tenantId → request.tenantId
├── interceptors/audit-log.interceptor.ts
├── interceptors/logging.interceptor.ts
├── services/prisma.service.ts
├── services/audit-log.service.ts   — AuditLogService.log() called explicitly in services
├── services/email.service.ts       — MVP: console.log only
└── common.module.ts                — exports PrismaService, AuditLogService, EventsGateway
