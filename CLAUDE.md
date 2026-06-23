# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Dewan** ("De una o ya") is a multi-tenant SaaS platform for restaurants, cafés, and local
businesses in LATAM. The platform is **fully built**: all 19 functional modules (SPEC-01 to
SPEC-19) are implemented and running. Day-to-day work is now maintenance, bug-fixing, and
incremental features — not greenfield generation.

## Project State Tracker — read this first

**`.claude/docs/tracking/dev-tracker.json` is the live source of truth for module state.** Every
command, skill, and task should consult it before touching a module and update it after. For each
module it records `status` / `backend` / `frontend` / `tests`, `completedAt`, dependencies, and the
exact `files` (with real `dewan-backend/` · `dewan-frontend/` paths). When you finish work on a
module, update its entry (and `updatedAt` at the top). It currently reports all 19 modules `done`,
`phase: "maintenance"`.

## Repository Layout

This root folder is **not** a git repository. It contains two **independent** git repos plus
shared tooling and docs:

```
dewan/
├── CLAUDE.md                 ← this file (root context, auto-loaded)
├── README.md
├── dewan-backend/            ← git repo · github.com/rsoftcom/dewan-backend (branch: dev)
│   └── CLAUDE.md             ← backend-specific instructions
├── dewan-frontend/           ← git repo · github.com/rsoftcom/dewan-frontend (branch: dev)
│   └── CLAUDE.md             ← frontend-specific instructions
├── scripts/                  ← operational scripts (dev.sh)
├── deploy/                   ← deploy guide + Cloudflare origin certs
└── .claude/
    ├── commands/             ← project commands: /rsoft-*, /review, /test, /deploy
    ├── skills/               ← reusable Claude Code skills (see skills/README.md)
    └── docs/                 ← specs, entities, conventions, design system, tracking
```

**Two repos, one workspace.** When committing, `cd` into the relevant app repo (or use
`git -C dewan-backend …`). There is no umbrella repo at the root — never run `git` from the root
expecting a unified history.

## Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10 · Prisma 5.22 · PostgreSQL 16 · TypeScript 5.7 · Node.js 20 LTS |
| Frontend | Angular 18.2 (standalone) · PrimeNG 18 (Aura) · Tailwind CSS · TypeScript 5.5 |
| Auth | JWT (access 15min + refresh 7d HttpOnly cookie) · bcrypt · Passport |
| WebSockets | Socket.io via NestJS Gateway (`common/gateway/events.gateway.ts`) |
| Hosting | Cloudflare Pages (front) · DigitalOcean Droplet s-1vcpu-1gb + PM2 + Nginx (back) |
| Reverse proxy | Nginx (SSL termination + WebSocket upgrade) |
| Domain | `app.getdewan.com` (front) · `api.getdewan.com` (back) |

> The backend code lives **directly at the repo root** (`dewan-backend/modules`, `common`,
> `prisma`) — there is **no `src/` wrapper**. `nest-cli.json` sets `sourceRoot: "."`.
> Likewise the frontend code is at `dewan-frontend/` root (`features`, `core`, `app`).

## Running Locally

From the repo root:

```bash
./scripts/dev.sh local    # http://localhost:4200 (front) + http://localhost:3000 (back)
./scripts/dev.sh cloud    # Cloudflare quick tunnels — random URLs printed on startup
```

`dev.sh` starts both apps, waits for them to be ready, and patches
`dewan-frontend/environments/environment.ts` with the correct `apiUrl`. Logs go to
`/tmp/dewan-backend.log` and `/tmp/dewan-frontend.log`.

| Mode | Backend CORS | Angular host check | Tunnels |
|---|---|---|---|
| `local` | `FRONTEND_URL=http://localhost:4200` | default | no |
| `cloud` | `FRONTEND_URL` unset → `origin: true` | `--allowed-hosts all` | yes |

- **CORS cloud logic:** `origin: true` reflects the request `Origin` header — required when
  `credentials: true`, because browsers reject `Access-Control-Allow-Origin: *` with credentials.
- **Angular host check:** Angular 18's Vite dev server blocks unknown hostnames;
  `--allowed-hosts all` disables this for tunnel access.
- Each app can also be run on its own with `npm run start:local` / `start:cloud` in its folder.

## Critical Conventions

These apply across both apps. App-specific rules live in each app's `CLAUDE.md`.

### Universal
- All code in **English** (entities, variables, files, endpoints). UI copy is Spanish.
- **API prefix is `/v1`** (set in `dewan-backend/main.ts` via `setGlobalPrefix('v1')`).
  Full base URL: `http://localhost:3000/v1`. **Not** `/api/v1`.
- `tenant_id` on every business entity — injected from the JWT (see `TenantInterceptor`).
- **Soft delete** via `status: active | inactive` — never physical DELETE on business entities.
  (Exception: `Category` uses hard delete; it has no `status` field.)
- Pagination: `?page=1&limit=20` → `{ data, meta: { total, page, limit, totalPages } }`.
- Error format: `{ statusCode, message[], error }` (via `HttpExceptionFilter`).

### Roles
Defined in `common/constants/roles.constant.ts` (backend) and `core/auth/roles.constant.ts`
(frontend). Seven roles: `super_admin`, `owner`, `admin`, `cashier`, `waiter`, `kitchen`,
`delivery`. Backend helper groups: `MANAGEMENT_ROLES` (OW/AD), `OPERATIONAL_ROLES` (OW/AD/CA),
`ORDER_CREATORS` (OW/AD/CA/WA).

### WebSockets
- Rooms: `kitchen_[tenantId]`, `orders_[tenantId]`, `user_[userId]`.
- Event format: `{domain}:{action}` in snake_case — e.g. `order:status_changed`, `stock:low_alert`.

## The 19 Modules

All implemented. Backend modules in `dewan-backend/modules/`, frontend features in
`dewan-frontend/features/`:

`auth` · `tenants` · `users` · `units` · `categories` · `products` · `cash-registers` ·
`movements` · `customers` · `orders` (+ `tables`) · `kitchen` · `payments` · `delivery` ·
`suppliers` · `purchases` · `inventory` · `notifications` · `audit-logs` · `reports`.

Per-module specs (behavior, use cases, business rules) live in `.claude/docs/specs/SPEC-XX-*.md`.
Entity definitions in `.claude/docs/entities/`. **Read only the spec/entity files relevant to the
task — never bulk-read all docs.**

## Project Commands

In `.claude/commands/`, invoked as `/<name>`:

| Command | Purpose |
|---|---|
| `/rsoft-next`, `/rsoft-status` | Generation-phase helpers (historical; modules are done) |
| `/rsoft-backend`, `/rsoft-frontend`, `/rsoft-fullstack`, `/rsoft-prisma`, `/rsoft-batch` | Code generators (legacy — paths reference old `src/` layout) |
| `/rsoft-validate`, `/rsoft-ui-fix` | Validate a module against its spec / apply UI conventions |
| `/review` | Review a change in this codebase (correctness + conventions) |
| `/test` | How to write and run tests here |
| `/deploy` | Deploy steps for backend (DigitalOcean) and frontend (Cloudflare Pages) |

> The legacy `rsoft-*` generators were written for the old `src/backend` / `src/frontend`
> layout. The code has since moved to `dewan-backend/` and `dewan-frontend/`. Treat their
> paths as historical; the conventions they enforce are still valid.

## Deployment (summary)

- **Backend** → DigitalOcean Droplet. Push to `main` on `dewan-backend` triggers a GitHub
  Actions workflow (`.github/workflows/deploy.yml`): build → SCP `dist/` → `git pull` →
  `npm ci` → `prisma migrate deploy` → `pm2 restart dewan-api`.
- **Frontend** → Cloudflare Pages. Connected to the `dewan-frontend` repo; build
  `ng build --configuration production`, output `dist/dewan-frontend/browser`.
- Full runbook in `deploy/deploy.md`. See also `/deploy`.

> ⚠️ **Security note:** `deploy/cloudflare/private-key.pem` (a real Cloudflare Origin private
> key) and hardcoded secrets in `deploy/deploy.md` are committed. Rotate and move to secrets
> management before treating this as production-hardened.

## Environment Variables

**Backend** (`.env` in `dewan-backend/`, symlinked from `~/.env.dewan` in prod):

| Var | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret for access/refresh tokens |
| `JWT_EXPIRES_IN` | Refresh token lifetime (e.g. `7d`) |
| `FRONTEND_URL` | CORS origin; **unset = cloud mode** (`origin: true`) |
| `PORT` | API port (default `3000`) |
| `NODE_ENV` | `production` disables Swagger at `/docs` |

**Frontend**: no runtime env file — `apiUrl` is baked at build time via
`environments/environment.ts` (dev, patched by `dev.sh`) and `environment.prod.ts`
(`https://api.getdewan.com/v1`).
