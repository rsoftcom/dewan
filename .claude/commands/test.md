# Comando: test $ARGUMENTS

Escribe y/o ejecuta tests en Dewan. Backend usa **Jest** (NestJS); frontend usa **Karma +
Jasmine** (Angular).

**Argumento (opcional):** nombre de módulo (ej. `orders`) o vacío para correr toda la suite.

> Consulta `.claude/docs/tracking/dev-tracker.json` para ver qué archivos de test ya existen por
> módulo (campo `files`) y su estado (`tests`). Tras añadir o cambiar tests, actualiza ese campo.

## Cómo correr

**Backend** (`dewan-backend/`):
```bash
npm test                         # toda la suite (*.spec.ts)
npm test -- orders               # filtra por nombre de archivo/describe
npm run test:watch               # modo watch
npm run test:cov                 # cobertura → coverage/
```
Config en `package.json` → `jest`: `testRegex: .*\.spec\.ts$`, `rootDir: .`, alias
`@common/*` y `@modules/*`. Los tests viven en `modules/{name}/tests/`.

**Frontend** (`dewan-frontend/`):
```bash
npm test                         # ng test (Karma, Chrome)
```
Specs `*.spec.ts` junto al componente/servicio.

## Cómo escribir un test de backend

- Ubícalo en `modules/{name}/tests/{name}.service.spec.ts`.
- Usa `Test.createTestingModule` y **mockea `PrismaService`** (no toques una DB real).
  Mockea también `AuditLogService`, `EventsGateway` y `NotificationsService` cuando el service
  los inyecte.
- Cubre, por cada método del service:
  - El camino feliz.
  - **Aislamiento de tenant:** que la query incluya `where: { tenantId }`.
  - Reglas de negocio del spec (`.claude/docs/specs/SPEC-XX-<modulo>.md`, sección "Reglas").
  - Errores esperados (`NotFoundException`, `ConflictException`, `BadRequestException`,
    `ForbiddenException`).
  - Atomicidad: que operaciones multi-tabla usen `$transaction`.

```ts
const prisma = { product: { findFirst: jest.fn(), create: jest.fn() }, $transaction: jest.fn() };
// ...
const module = await Test.createTestingModule({
  providers: [
    ProductsService,
    { provide: PrismaService, useValue: prisma },
    { provide: AuditLogService, useValue: { log: jest.fn() } },
  ],
}).compile();
```

## Cómo escribir un test de frontend

- Para servicios: provee `ApiService` mockeado y verifica el `basePath` y el método HTTP usados.
- Para componentes: `TestBed.configureTestingModule` con el componente standalone en `imports`;
  mockea sus servicios de feature y `ToastService`.
- Verifica estado expuesto vía `signal()`/`computed()` y el render condicional `@if`/`@for`.

## Antes de dar por bueno un cambio
1. Tests del módulo en verde.
2. Compila: `npm run build` en el repo tocado.
3. Si tocaste schema Prisma: `npx prisma validate`.
4. Reporta resultados reales — si algo falla, muéstralo; no afirmes "pasa" sin haber corrido.
