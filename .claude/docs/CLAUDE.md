# Dewan — Documentación del proyecto

> **El CLAUDE.md autoritativo es `../../CLAUDE.md`** (raíz del workspace), más
> `dewan-backend/CLAUDE.md` y `dewan-frontend/CLAUDE.md`. Este archivo describe **solo la carpeta
> de documentación** (`.claude/docs/`) y cómo consumirla. Si algo aquí contradice al CLAUDE.md
> raíz, manda el raíz.

## Stack (resumen)
- **Frontend:** Angular 18 · PrimeNG (Aura) · Tailwind CSS — repo `dewan-frontend/`
- **Backend:** NestJS 10 · Prisma 5 · PostgreSQL 16 — repo `dewan-backend/`
- **Auth:** JWT propio (access 15min + refresh 7d HttpOnly cookie)
- **WebSockets:** Socket.io vía NestJS Gateway
- **Hosting:** Cloudflare Pages (front) + DigitalOcean Droplet (back) — **ya no se usa AWS**
- **CI/CD:** GitHub Actions (uno por repo)
- **API prefix:** `/v1` (no `/api/v1`)

## Estado del proyecto
**Fase: mantenimiento.** Los 19 módulos (SPEC-01 a SPEC-19) están **implementados y desplegados**.
La fuente de verdad viva del estado por módulo es
[`tracking/dev-tracker.json`](tracking/dev-tracker.json) — **manténlo actualizado** cuando un
módulo cambie (status, archivos, `completedAt`). El historial de decisiones de implementación vive
en el CLAUDE.md raíz (sección que las recopila) y en este árbol de specs.

## Estructura de esta carpeta (`.claude/docs/`)
```
docs/
├── specs/              ← 19 specs (SPEC-01..SPEC-19) + _global-conventions, _endpoints-summary, _spec-index
├── entities/           ← 24 entidades + _entity-conventions, _entity-relationships
├── architecture/       ← architecture-summary.md (LEER PRIMERO) + arquitectura detallada
├── conventions/        ← coding-conventions.md · ui-conventions.md
├── design-system/      ← dewan-design-system.md (marca Dewan)
├── analysis/           ← análisis funcional completo
└── tracking/           ← dev-tracker.json ← estado vivo de cada módulo
```

## Reglas para agentes
1. **NUNCA leer todo.** Lee SOLO los archivos que la tarea necesita.
2. **Empieza por el tracker:** `tracking/dev-tracker.json` dice qué existe y dónde
   (campo `files` por módulo, ya con rutas reales `dewan-backend/` · `dewan-frontend/`).
3. **Trabajo en backend:** 1 spec + `dewan-backend/CLAUDE.md` (+ `conventions/` si aplica).
4. **Trabajo en frontend:** 1 spec + `dewan-frontend/CLAUDE.md` + `conventions/ui-conventions.md`
   + `design-system/dewan-design-system.md`.
5. **Cambios de datos/Prisma:** entidades relevantes + `entities/_entity-conventions.md`.
6. **Validación:** 1 spec + el código real del módulo en su repo.

## Convenciones críticas (ver detalle en los CLAUDE.md de cada app)
- Todo el código en **inglés**; copy de UI en español.
- Archivos **kebab-case** con sufijo de tipo · Clases **PascalCase** con sufijo de rol.
- DB tables **snake_case plural** · columns **snake_case** · Prisma models **PascalCase singular** con `@@map`.
- **API prefix `/v1`**. Aislamiento por `tenant_id` desde el JWT. Soft delete (`status`).
- Angular: componentes **standalone** single-file, `signal()`/`computed()`, `inject()`, `@if`/`@for`.
