# R Soft — Architecture Summary (Quick Reference)

> Compact version for agent context. Full docs: rsoft-arquitectura-fase3.md

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18+ · PrimeNG (Aura) · Tailwind CSS · TypeScript |
| Backend | NestJS · Prisma ORM · TypeScript · Node.js 20 LTS |
| Database | PostgreSQL 16 (on EC2, localhost:5432) |
| Auth | JWT (access 15min + refresh 7d HttpOnly cookie) · bcrypt |
| WebSockets | Socket.io via NestJS Gateway |
| Hosting frontend | Cloudflare Pages (free, CI/CD from GitHub) |
| Hosting backend | AWS EC2 t2.micro (free tier 12 months) |
| Storage images | Cloudflare R2 (10GB free, S3-compatible API) |
| Backups | pg_dump + cron → AWS S3 (30-day retention) |
| DNS + CDN + SSL | Cloudflare (free plan) |
| Emails | AWS SES (from EC2) |
| Reverse proxy | Nginx (handles SSL + WebSocket upgrade) |
| CI/CD | GitHub Actions |
| Logging | Pino (nestjs-pino) → structured JSON |
| API docs | Swagger (@nestjs/swagger) |

## Key Patterns

- **Multi-tenant:** tenant_id on every entity, TenantGuard injects from JWT
- **API prefix:** `/api/v1`
- **Pagination:** `?page=1&limit=20` → `{ data, meta: { total, page, limit, totalPages } }`
- **Auth flow:** Login → accessToken (body) + refreshToken (HttpOnly cookie)
- **Soft delete:** status active/inactive, never physical DELETE on business entities
- **Audit:** AuditLogInterceptor on all critical endpoints
- **Error format:** `{ statusCode, message[], error }`
- **WebSocket rooms:** `kitchen_[tenantId]`, `orders_[tenantId]`, `user_[userId]`

## Deployment Architecture

```
Cloudflare (DNS+CDN+SSL) → Cloudflare Pages (Angular SPA)
                         → EC2 t2.micro (Nginx → NestJS:3000 + PG:5432)
Cloudflare R2 (images) ← NestJS (S3-compatible upload)
AWS S3 (backups) ← pg_dump cron
AWS SES ← NestJS (transactional emails)
```

## Cost

| Phase | Monthly Cost |
|---|---|
| Year 1 (AWS free tier) | ~$0 |
| Year 2+ (EC2 on-demand) | ~$9 |
| Fallback (Fly.io + Neon) | $0 permanent |
