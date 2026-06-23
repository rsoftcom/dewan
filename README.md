# Dewan — Restaurant & Business Management SaaS

> **"De una o ya"** — gestión de negocios sin complicaciones.

Multi-tenant SaaS platform for restaurants, cafes, and local businesses in LATAM. Built with NestJS, Angular 18, PostgreSQL, and Prisma ORM.

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | NestJS · TypeScript · Node.js | NestJS 10 · Node 20 LTS |
| ORM | Prisma | 5.22 |
| Database | PostgreSQL | 16 |
| Frontend | Angular · PrimeNG (Aura) · Tailwind CSS | Angular 18.2 · PrimeNG 18 |
| Auth | JWT (access 15min + refresh 7d HttpOnly cookie) · bcrypt | — |
| WebSockets | Socket.io via NestJS Gateway | — |
| Hosting (front) | Cloudflare Pages | — |
| Hosting (back) | DigitalOcean Droplet (s-1vcpu-1gb) · PM2 | — |
| CI/CD | GitHub Actions (per repo) | — |
| Reverse Proxy | Nginx (SSL termination + WebSocket upgrade) | — |
| Domain | `app.getdewan.com` (front) · `api.getdewan.com` (back) | — |

---

## Project Structure

This root folder is **not** a git repo. It holds two **independent** git repos (each deployed
on its own) plus shared tooling and docs. The code lives at each repo's root — there is **no
`src/` wrapper**.

```
dewan/
├── CLAUDE.md                 # Root context for Claude Code (auto-loaded)
├── README.md
├── dewan-backend/            # git repo · github.com/rsoftcom/dewan-backend
│   ├── CLAUDE.md             # backend-specific instructions
│   ├── main.ts               # bootstrap: setGlobalPrefix('v1'), CORS, Swagger
│   ├── app.module.ts
│   ├── common/               # guards, decorators, interceptors, filters, services, gateway
│   ├── modules/{name}/       # one folder per module (controller/service/module/dto/tests)
│   └── prisma/               # schema.prisma · migrations · seed.ts · scripts/
├── dewan-frontend/           # git repo · github.com/rsoftcom/dewan-frontend
│   ├── CLAUDE.md             # frontend-specific instructions
│   ├── app/                  # app.config, app.routes, shell/, theme/dewan-preset.ts
│   ├── core/                 # auth/ (service, guard, interceptor) · services/ (api, toast)
│   ├── features/{name}/      # pages/, components/, services/, models/, routes.ts
│   └── environments/
├── scripts/                  # dev.sh (run both apps locally) + README
├── deploy/                   # deploy runbook + Cloudflare origin certs
└── .claude/
    ├── commands/             # slash commands: /rsoft-*, /review, /test, /deploy
    ├── skills/               # reusable Claude Code skills (see skills/README.md)
    └── docs/                 # specs · entities · conventions · design-system · tracking
```

> **Two repos, one workspace.** Commit inside the relevant app repo (or `git -C dewan-backend …`).
> Both repos work on branch `dev`; production deploys from `main`.

---

## Getting Started

### Prerequisites

- Node.js 20 LTS
- PostgreSQL 16
- npm 10+
- `cloudflared` (only for cloud mode — `brew install cloudflare/cloudflare/cloudflared`)

### First-time setup

```bash
# Backend
cd dewan-backend
npm install
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npx prisma migrate dev        # run migrations
npx prisma db seed            # optional: seed demo data

# Frontend
cd dewan-frontend
npm install
```

### Running the app

Use `scripts/dev.sh` from the project root — it starts both services and manages tunnels:

```bash
./scripts/dev.sh local    # http://localhost:4200  (CORS restricted to localhost)
./scripts/dev.sh cloud    # Cloudflare quick tunnels — URLs printed on startup
```

`Ctrl+C` stops everything (servers + tunnels).

#### What each mode does

| | `local` | `cloud` |
|---|---|---|
| CORS | Only `http://localhost:4200` | Any origin (reflected — compatible with credentials) |
| Angular host check | Default | `--allowed-hosts all` (required for Cloudflare tunnel) |
| Cloudflare tunnels | No | Yes — random `*.trycloudflare.com` URLs each run |

#### Individual scripts (if you need to run services separately)

```bash
# Backend
cd dewan-backend
npm run start:local   # CORS → localhost:4200 only
npm run start:cloud   # CORS → any origin

# Frontend
cd dewan-frontend
npm run start:local   # standard dev server
npm run start:cloud   # + --allowed-hosts all
```

### Environment variables (backend)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Secret for signing access/refresh tokens | — |
| `JWT_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`) | — |
| `PORT` | API port | `3000` |
| `FRONTEND_URL` | CORS allowed origin | Any origin (`origin: true`) |
| `NODE_ENV` | `production` disables Swagger at `/docs` | — |

> `FRONTEND_URL` is set inline by `start:local` (`http://localhost:4200`). Leave it unset for cloud/open mode — NestJS then reflects the request origin, which is required for cross-origin credentialed requests.

---

## API

- Base URL: `/v1` (set via `setGlobalPrefix('v1')` — e.g. `http://localhost:3000/v1`)
- Swagger UI: `http://localhost:3000/docs` (disabled when `NODE_ENV=production`)
- Auth: Bearer token (access token from `POST /v1/auth/login`)
- Pagination: `?page=1&limit=20` → `{ data[], meta: { total, page, limit, totalPages } }`
- Errors: `{ statusCode, message[], error }`

---

## Module Status

**All 19 modules are implemented and shipped.** Live source of truth:
[`.claude/docs/tracking/dev-tracker.json`](.claude/docs/tracking/dev-tracker.json) — update it
whenever a module changes.

| # | Module | Backend | Frontend | Tests | Status |
|---|--------|---------|----------|-------|--------|
| SPEC-01 | Auth (login, refresh, logout, /me) | ✅ | ✅ | ✅ | Done |
| SPEC-02 | Users CRUD | ✅ | ✅ | ✅ | Done |
| SPEC-03 | Tenants CRUD | ✅ | ✅ | ✅ | Done |
| SPEC-04 | Units & Conversions | ✅ | ✅ | ✅ | Done |
| SPEC-05 | Products (catalog + recipes) | ✅ | ✅ | ✅ | Done |
| SPEC-06 | Categories (hierarchical, 2 levels) | ✅ | ✅ | ✅ | Done |
| SPEC-07 | Orders (local + delivery) | ✅ | ✅ | ✅ | Done |
| SPEC-08 | Kitchen Display | ✅ | ✅ | ✅ | Done |
| SPEC-09 | Payments | ✅ | ✅ | ✅ | Done |
| SPEC-10 | Cash Register | ✅ | ✅ | ✅ | Done |
| SPEC-11 | Cash Movements | ✅ | ✅ | ✅ | Done |
| SPEC-12 | Customers | ✅ | ✅ | ✅ | Done |
| SPEC-13 | Delivery | ✅ | ✅ | ✅ | Done |
| SPEC-14 | Suppliers | ✅ | ✅ | ✅ | Done |
| SPEC-15 | Purchases | ✅ | ✅ | ✅ | Done |
| SPEC-16 | Inventory | ✅ | ✅ | ✅ | Done |
| SPEC-17 | Reports | ✅ | ✅ | ✅ | Done |
| SPEC-18 | Notifications | ✅ | ✅ | ✅ | Done |
| SPEC-19 | Audit Log | ✅ | ✅ | ✅ | Done |

---

## User Roles

| Role | Code | Description |
|---|---|---|
| Super Admin | `super_admin` | Platform administrator. Manages tenants. |
| Owner | `owner` | Business owner. Full access within their tenant. |
| Admin | `admin` | Business administrator. CRUD on most entities. |
| Cashier | `cashier` | POS access, cash register, payments. |
| Waiter | `waiter` | Order taking, table management. |
| Kitchen | `kitchen` | Kitchen display, order status updates. |
| Delivery | `delivery` | Delivery order management. |

---

## Architecture Decisions

- **Multi-tenant isolation:** `tenant_id` on every business entity. `TenantInterceptor` injects it from JWT on every request.
- **Soft delete only:** Business entities use `status: active | inactive`. No physical `DELETE`.
- **Refresh token rotation:** Each refresh issues a new token and revokes the previous one.
- **Audit log:** Critical actions call `AuditLogService.log()` directly until SPEC-19 completes the interceptor.
- **WebSocket rooms:** `kitchen_[tenantId]`, `orders_[tenantId]`, `user_[userId]`.
- **Email:** `EmailService` logs to console in development. Wire to Resend (free tier) for production.

---

## Development with Claude Code

This project uses [Claude Code](https://claude.ai/code). Context is loaded from `CLAUDE.md` at the
root and inside each app, plus the docs under `.claude/docs/`. The **live state of every module**
lives in [`.claude/docs/tracking/dev-tracker.json`](.claude/docs/tracking/dev-tracker.json) — treat
it as the source of truth and keep it updated when a module changes.

### Slash commands

| Command | Description |
|---|---|
| `/review` | Review a change for correctness + Dewan conventions |
| `/test` | How to write and run tests (Jest backend · Karma frontend) |
| `/deploy` | Deploy steps (DigitalOcean backend · Cloudflare Pages frontend) |
| `/rsoft-status`, `/rsoft-next` | Read the tracker / show next module (generation-phase helpers) |
| `/rsoft-fullstack`, `/rsoft-backend`, `/rsoft-frontend`, `/rsoft-prisma` | Code generators (legacy — reference the old `src/` layout) |
| `/rsoft-validate SPEC-XX`, `/rsoft-ui-fix COMPONENT` | Validate a module against spec / apply UI conventions |

> The `rsoft-*` generators were built for the original `src/backend` / `src/frontend` layout. The
> code has since moved to `dewan-backend/` and `dewan-frontend/`, and all 19 modules are done, so
> these are mostly historical. Their conventions remain valid.

### Build order (historical)

Original dependency order, recorded in `dev-tracker.json` → `buildOrder`:

```
auth → tenants → users
units, categories → products
cash-register → movements
customers
products + cash-register + customers → orders → kitchen, payments, delivery
suppliers → purchases
products → inventory
notifications, audit-log
reports (last)
```

---

## Coding Conventions

- **All code in English** — entities, variables, files, endpoints.
- **Backend files:** `kebab-case` with type suffix (`orders.service.ts`, `create-order.dto.ts`).
- **Backend classes:** `PascalCase` with role suffix (`OrdersController`, `OrdersService`).
- **Controller methods:** `create`, `findAll`, `findOne`, `update`, `remove`.
- **Prisma models:** `PascalCase` singular with `@@map("snake_case_plural")`.
- **Frontend components:** standalone, single-file (inline template), Angular Signals, `inject()`.
- **Frontend control flow:** `@if`, `@for`, `@switch` — never `*ngIf`, `*ngFor`.
- **WebSocket events:** `{domain}:{action}` in snake_case — e.g. `order:status_changed`.

Full conventions in [`.claude/docs/conventions/coding-conventions.md`](.claude/docs/conventions/coding-conventions.md),
and per-app rules in [`dewan-backend/CLAUDE.md`](dewan-backend/CLAUDE.md) /
[`dewan-frontend/CLAUDE.md`](dewan-frontend/CLAUDE.md).

---

## Design System

The UI uses the **Dewan** brand built on PrimeNG Aura:

- **Primary color:** Coral `#FF6B35`
- **Surface background:** Cream `#FFFAF6`
- **Sidebar:** Always dark (`#1A1028`)
- **Fonts:** System stack via Aura (Inter-like); Outfit 800 for the logo wordmark

Full guide in [`.claude/docs/design-system/dewan-design-system.md`](.claude/docs/design-system/dewan-design-system.md)
and UI patterns in [`.claude/docs/conventions/ui-conventions.md`](.claude/docs/conventions/ui-conventions.md).

---

## License

Private — R Soft Company © 2026
