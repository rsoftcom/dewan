# Comando: review $ARGUMENTS

Revisa un cambio en este proyecto buscando **errores de corrección** y **violaciones de las
convenciones** de Dewan. No reescribe nada por su cuenta: reporta hallazgos y, si el usuario lo
pide, aplica las correcciones.

**Argumento (opcional):** ruta de archivo, nombre de módulo, o vacío para revisar el diff actual.

## Qué leer
0. `.claude/docs/tracking/dev-tracker.json` — estado y archivos reales del módulo afectado.
1. El diff a revisar:
   - Sin argumento → `git -C dewan-backend diff` y `git -C dewan-frontend diff` (ambos repos).
   - Con módulo (ej. `orders`) → `dewan-backend/modules/orders/` + `dewan-frontend/features/orders/`.
2. La spec del módulo afectado: `.claude/docs/specs/SPEC-XX-<modulo>.md`.
3. Las convenciones del lado tocado: `dewan-backend/CLAUDE.md` o `dewan-frontend/CLAUDE.md`,
   y para UI `.claude/docs/conventions/ui-conventions.md`.

## Checklist backend (NestJS)
- [ ] Toda query filtra por `tenantId` tomado del JWT (`@CurrentUser()`), **nunca** del body.
- [ ] Endpoints con `@Roles(...)` correctos según la spec; prefijo `/v1` respetado.
- [ ] Lógica de negocio en el `service`, no en el `controller`.
- [ ] DTOs con `class-validator` + `@ApiProperty`. Sin campos sin validar.
- [ ] Soft delete (`status: inactive`), no `prisma.*.delete` en entidades de negocio.
- [ ] Mutaciones críticas registran `AuditLogService.log()`.
- [ ] Operaciones multi-tabla en `$transaction`.
- [ ] Eventos WebSocket con formato `{domain}:{action}` y sala correcta; triggers de
      notificación fire-and-forget (`.catch(() => undefined)`).
- [ ] Cambios de schema acompañados de migración (`prisma migrate dev`).

## Checklist frontend (Angular 18)
- [ ] Componente standalone single-file; `inject()`, `signal()`/`computed()`, `@if`/`@for`.
- [ ] `input.required<T>()` / `output<T>()`; guards/interceptors funcionales; rutas lazy.
- [ ] HTTP **solo** vía `ApiService` (nunca `HttpClient`); `basePath` sin `/` inicial.
- [ ] `ToastService`, nunca `MessageService` ni `<p-toast>` ni `ToastModule` en el módulo.
- [ ] Sin `p-card` (usar `.mod-card`). Diálogos `[draggable]="false"`, `mb-4` por campo.
- [ ] Campos numéricos inicializados en `null`. Tokens `--dw-*` para colores.
- [ ] Módulo nuevo → item de navegación añadido en `app/shell/shell.component.ts`.

## Corrección
- Lee primero código vecino para imitar densidad de comentarios, naming e idioma.
- Verifica que compila: backend `npm run build`, frontend `npm run build`.
- Reporta cada hallazgo como `archivo:línea` con la causa y el fix propuesto, ordenados por
  severidad (corrección > convención > estilo).
