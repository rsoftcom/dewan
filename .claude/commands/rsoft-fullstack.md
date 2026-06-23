# Comando: rsoft-fullstack $ARGUMENTS

Genera un módulo full-stack completo: Prisma → Backend → Frontend → Validación.

**Argumento:** Nombre del spec, ejemplo: `SPEC-07-orders`
Si no se proporciona argumento, lee `.claude/docs/tracking/dev-tracker.json` y toma el siguiente módulo pendiente cuyas dependencias estén resueltas.

## Flujo de ejecución

### Paso 0 — Preparación
1. Lee `.claude/docs/tracking/dev-tracker.json`.
2. Identifica el módulo: `$ARGUMENTS` o el siguiente pendiente.
3. Verifica que todas las dependencias estén `"done"`. Si no, aborta con mensaje claro.
4. Lee `docs/specs/SPEC-XX-nombre.md` (SOLO ese spec).
5. Identifica las entidades necesarias de la línea `**Entidades:**` del spec.

### Paso 1 — Prisma (si hay entidades nuevas)
Revisa si las entidades del módulo ya existen en `prisma/schema.prisma`.
- Si faltan entidades, genera/actualiza el schema.
- Lee SOLO: `docs/entities/entity-XX-nombre.md` de las entidades faltantes + `docs/entities/_entity-conventions.md`.
- Ejecuta `npx prisma format` y `npx prisma generate` para validar.
- Si el schema ya está completo para este módulo, salta este paso.

**Patrón Prisma obligatorio:**
```prisma
model NombreModelo {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  // ... campos en camelCase
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@map("nombre_modelos")  // snake_case plural
}
```

### Paso 2 — Backend NestJS
Genera el módulo backend completo. Lee SOLO:
- `docs/specs/SPEC-XX-nombre.md`
- `docs/conventions/coding-conventions.md` (sección 1: Backend)
- `docs/architecture/architecture-summary.md`

**Estructura de archivos a generar:**
```
src/backend/modules/{nombre}/
├── {nombre}.module.ts
├── {nombre}.controller.ts
├── {nombre}.service.ts
├── dto/
│   ├── create-{nombre}.dto.ts
│   ├── update-{nombre}.dto.ts
│   ├── {nombre}-query.dto.ts      (si tiene filtros)
│   └── {nombre}-response.dto.ts   (si necesita transformar output)
├── guards/
│   └── {nombre}-ownership.guard.ts (si tiene reglas de acceso especiales)
└── tests/
    ├── {nombre}.service.spec.ts
    └── {nombre}.controller.spec.ts
```

**Reglas del backend:**
- Controller: solo recibe request, valida, delega a service, retorna response.
- Service: toda la lógica de negocio. Usa PrismaService para queries.
- DTOs: class-validator decorators para validación. Swagger decorators para docs.
- Guards: `@Roles()` decorator + `RolesGuard` para permisos por rol.
- Tenant isolation: `@UseInterceptors(TenantInterceptor)` o `req.user.tenantId` en queries.
- Audit log: llamar `AuditLogService.log()` en acciones críticas.
- Paginación: usar `PaginationDto` compartido, retornar `{ data, meta }`.
- WebSocket: si el spec menciona eventos WS, emitir via `EventsGateway`.

**Para cada caso de uso (UC-XX-XX) del spec:**
1. Implementar el endpoint exacto del contrato API.
2. Implementar TODAS las excepciones listadas con sus status codes.
3. Implementar TODAS las reglas de negocio (RN-XX).
4. Generar al menos un test por cada scenario Gherkin del spec.

### Paso 3 — Frontend Angular
Genera el feature frontend completo. Lee SOLO:
- `docs/specs/SPEC-XX-nombre.md`
- `docs/conventions/coding-conventions.md` (sección 2: Frontend)
- `docs/design-system/dewan-design-system.md` (secciones relevantes)

**Estructura de archivos a generar:**
```
src/frontend/features/{nombre}/
├── pages/
│   ├── {nombre}-list.component.ts
│   ├── {nombre}-detail.component.ts
│   └── {nombre}-create.component.ts  (o form si es create+edit)
├── components/
│   ├── {nombre}-card.component.ts     (si aplica)
│   └── {nombre}-table.component.ts    (si tiene listado)
├── services/
│   └── {nombre}.service.ts
├── models/
│   └── {nombre}.model.ts
└── routes.ts
```

**Reglas del frontend:**
- Componentes standalone, single-file (template inline con backticks).
- Angular Signals para estado reactivo, `inject()` en vez de constructor DI.
- Nuevo control flow: `@if`, `@for`, `@switch`.
- Signal inputs/outputs.
- PrimeNG para componentes UI (p-table, p-dialog, p-button, p-toast, etc).
- Tailwind para layout y espaciado.
- Service con `providedIn: 'root'`, métodos CRUD: `findAll`, `findOne`, `create`, `update`, `remove`.
- Usar design tokens de `dewan-design-system.md` para colores y tipografía.

### Paso 4 — Validación
Revisa el código generado contra el spec:
- ¿Cada endpoint del spec tiene su controller method?
- ¿Cada excepción tiene su manejo con el status code correcto?
- ¿Los roles están correctamente aplicados con `@Roles()`?
- ¿Los DTOs validan todos los campos requeridos?
- ¿Los tests cubren los scenarios Gherkin?
- ¿El frontend tiene página/componente para cada operación del spec?

Lista discrepancias encontradas y corrígelas.

### Paso 5 — Validación de compilación (OBLIGATORIO antes del push)
Ejecuta los builds de backend y frontend. Si hay errores, corrígelos antes de continuar.

```bash
# Backend — compilación TypeScript
cd src/backend && npm run build

# Frontend — compilación Angular
cd src/frontend && npm run build
```

**Si el build falla:**
1. Lee el error completo.
2. Corrige el archivo afectado (nunca saltes este paso).
3. Vuelve a ejecutar el build hasta que pase.
4. Reporta qué se corrigió.

**Solo continúa al Paso 6 cuando ambos builds sean exitosos.**

### Paso 6 — Actualizar tracker
1. Actualiza `.claude/docs/tracking/dev-tracker.json`:
   - `modules.SPEC-XX.status` → `"done"`
   - `modules.SPEC-XX.backend` → `"done"`
   - `modules.SPEC-XX.frontend` → `"done"`
   - `modules.SPEC-XX.tests` → `"done"`
   - `modules.SPEC-XX.completedAt` → fecha actual
   - `modules.SPEC-XX.files` → lista de archivos generados
2. Actualiza `CLAUDE.md` → agrega el módulo a "Módulos completados".

### Paso 7 — Push a GitHub
1. Stagea todos los archivos del módulo y los archivos modificados (tracker, schema, app.module, app.routes, CLAUDE.md):
   ```bash
   git add CLAUDE.md \
           .claude/docs/tracking/dev-tracker.json \
           src/backend/prisma/schema.prisma \
           src/backend/app.module.ts \
           src/frontend/app/app.routes.ts \
           src/backend/modules/{nombre}/ \
           src/frontend/features/{nombre}/
   ```
2. Crea el commit con el formato:
   ```
   feat(SPEC-XX): implement {nombre} module (backend + frontend + tests)

   - Prisma: <entidades agregadas o "no new entities">
   - Backend: <N> files — controller, service, DTOs, tests
   - Frontend: <N> files — model, service, list component, routes
   - Endpoints: <N>/<N> implemented
   - UC-XX-XX deferred to SPEC-YY if applicable

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
3. Ejecuta `git push origin main`.
4. Reporta la URL del commit o confirma éxito del push.

3. Muestra resumen final:

```
═══════════════════════════════════════
✅ MÓDULO COMPLETADO: SPEC-XX-nombre
═══════════════════════════════════════

Backend:  X archivos generados
Frontend: X archivos generados
Tests:    X tests
Endpoints: X/X implementados
Cobertura spec: 100%

🚀 Push: origin/main ✅

Siguiente módulo → SPEC-YY-nombre
Ejecutar: /project:rsoft-fullstack SPEC-YY-nombre
```

## Manejo de módulos compartidos (solo primera ejecución)

Si es el PRIMER módulo que se genera (no existe `src/backend/`), crear antes:
- `src/backend/prisma/schema.prisma` con datasource y generators
- `src/backend/common/dto/pagination.dto.ts`
- `src/backend/common/decorators/roles.decorator.ts`
- `src/backend/common/decorators/current-user.decorator.ts`
- `src/backend/common/guards/jwt-auth.guard.ts`
- `src/backend/common/guards/roles.guard.ts`
- `src/backend/common/interceptors/tenant.interceptor.ts`
- `src/backend/common/interceptors/audit-log.interceptor.ts`
- `src/backend/common/filters/http-exception.filter.ts`
- `src/backend/common/services/prisma.service.ts`
- `src/frontend/core/auth/auth.service.ts`
- `src/frontend/core/auth/jwt.interceptor.ts`
- `src/frontend/core/services/api.service.ts`
- `src/frontend/core/services/toast.service.ts`
Marcar `sharedModules` correspondientes como `"done"` en el tracker.

## Regla de oro
Lee el MÍNIMO de archivos. Si necesitas saber cómo se ve un controller ya generado, lee ESE archivo — no releas la spec de otro módulo.
