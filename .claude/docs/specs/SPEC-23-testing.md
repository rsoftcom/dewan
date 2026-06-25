# SPEC-23: Estrategia de Testing y Cobertura

**Descripción:** Spec transversal que define la estrategia de tests unitarios, de integración y E2E para los dos repos de Dewan. No agrega funcionalidad — establece qué se testea, cómo se testea, los umbrales mínimos de cobertura y el orden de implementación. Es el documento de referencia para cualquier agente que escriba o revise tests en este proyecto.

**Actores:** Equipo de desarrollo, CI/CD pipeline

---

## Estado actual — inventario

### Backend (`dewan-backend/`) — Jest + NestJS Testing

| Área | Archivos `.spec.ts` | Estado |
|---|---|---|
| `modules/auth` | `auth.service.spec.ts`, `auth.controller.spec.ts` | Completo |
| `modules/users` | `users.service.spec.ts`, `users.controller.spec.ts` | Completo |
| `modules/tenants` | `tenants.service.spec.ts`, `tenants.controller.spec.ts` | Completo |
| `modules/units` | `units.service.spec.ts`, `units.controller.spec.ts` | Completo |
| `modules/categories` | `categories.service.spec.ts`, `categories.controller.spec.ts` | Completo |
| `modules/products` | `products.service.spec.ts`, `products.controller.spec.ts` | Completo |
| `modules/orders` | `orders.service.spec.ts`, `orders.controller.spec.ts` | Completo |
| `modules/kitchen` | `kitchen.service.spec.ts`, `kitchen.controller.spec.ts` | Completo |
| `modules/payments` | `payments.service.spec.ts`, `payments.controller.spec.ts` | Completo |
| `modules/cash-registers` | `cash-registers.service.spec.ts`, `cash-registers.controller.spec.ts` | Completo |
| `modules/movements` | `movements.service.spec.ts`, `movements.controller.spec.ts` | Completo |
| `modules/customers` | `customers.service.spec.ts`, `customers.controller.spec.ts` | Completo |
| `modules/delivery` | `delivery.service.spec.ts`, `delivery.controller.spec.ts` | Completo |
| `modules/suppliers` | `suppliers.service.spec.ts`, `suppliers.controller.spec.ts` | Completo |
| `modules/purchases` | `purchases.service.spec.ts`, `purchases.controller.spec.ts` | Completo |
| `modules/inventory` | `inventory.service.spec.ts`, `inventory.controller.spec.ts` | Completo |
| `modules/reports` | `reports.service.spec.ts`, `reports.controller.spec.ts` | Completo |
| `modules/notifications` | `notifications.service.spec.ts`, `notifications.controller.spec.ts` | Completo |
| `modules/audit-logs` | `audit-logs.service.spec.ts`, `audit-logs.controller.spec.ts` | Completo |
| `modules/owners` *(UC-21-05)* | `owners.service.spec.ts`, `owners.controller.spec.ts` | Completo |
| `common/guards` | — | **Falta** |
| `common/interceptors` | — | **Falta** |
| `common/filters` | — | **Falta** |
| `common/strategies` | — | **Falta** |
| `common/gateway` | — | **Falta** |
| E2E (Supertest) | — | **Falta** |

> El módulo `owners` es un artifact de SPEC-21 (UC-21-05 — dashboard multi-tenant). Vive en su propio módulo NestJS pero no es una entidad de negocio independiente.

### Frontend (`dewan-frontend/`) — Karma + Jasmine

| Área | Archivos `.spec.ts` | Estado |
|---|---|---|
| `core/auth/auth.service.ts` | — | **Falta** |
| `core/auth/auth.guard.ts` | — | **Falta** |
| `core/auth/jwt.interceptor.ts` | — | **Falta** |
| `core/services/api.service.ts` | — | **Falta** |
| `core/services/websocket.service.ts` | — | **Falta** |
| `core/services/toast.service.ts` | — | **Falta** |
| `features/auth` (componentes) | — | **Falta** |
| `features/dashboard` (componentes) | — | **Falta** |
| Resto de features (20 módulos) | — | **Falta** |
| E2E (Playwright) | — | **Falta** |

---

## Objetivos de cobertura

| Capa | Statements | Branches | Functions | Líneas |
|---|---|---|---|---|
| Backend — módulos de negocio | ≥ 85 % | ≥ 75 % | ≥ 85 % | ≥ 85 % |
| Backend — `common/` infrastructure | ≥ 90 % | ≥ 85 % | ≥ 90 % | ≥ 90 % |
| Frontend — `core/` services y guards | ≥ 80 % | ≥ 70 % | ≥ 80 % | ≥ 80 % |
| Frontend — componentes de features | ≥ 70 % | ≥ 60 % | ≥ 70 % | ≥ 70 % |

Los umbrales se aplican vía configuración de Jest (backend) y `karma.conf.js` (frontend). El pipeline de CI falla si no se alcanzan.

---

## TEST-01: Corregir `collectCoverageFrom` en Jest (backend)

**Problema actual:** `"collectCoverageFrom": ["**/*.(t|j)s"]` incluye `prisma/seed.ts`, archivos de configuración, DTOs sin lógica y los propios archivos `.spec.ts`. Los porcentajes de cobertura resultantes son engañosos.

**Cambio en `dewan-backend/package.json`** (sección `jest`):

```json
"collectCoverageFrom": [
  "modules/**/*.ts",
  "common/**/*.ts",
  "!**/*.spec.ts",
  "!**/*.module.ts",
  "!**/*.dto.ts",
  "!**/*.constant.ts",
  "!main.ts",
  "!prisma/**"
]
```

**Razón de cada exclusión:**

| Patrón excluido | Por qué |
|---|---|
| `**/*.spec.ts` | Son los propios tests, no código de producción |
| `**/*.module.ts` | Solo wiring de NestJS, no lógica testeable |
| `**/*.dto.ts` | Interfaces de validación de entrada; la lógica está en los servicios |
| `**/*.constant.ts` | Constantes inmutables sin lógica de rama |
| `main.ts` | Bootstrap de la app, no tiene unidades testeables |
| `prisma/**` | Seeds y migraciones, fuera del dominio de la app |

**Criterio de aceptación:**

```gherkin
Scenario: El reporte de cobertura refleja solo código de lógica de negocio
  When se ejecuta npm run test:cov en dewan-backend
  Then el reporte no incluye archivos de prisma/seed.ts
  And no incluye archivos *.module.ts
  And los porcentajes reflejan únicamente la cobertura de servicios, controladores, guards e interceptores
```

---

## TEST-02: Tests unitarios de `common/` (backend)

La capa `common/` es infraestructura transversal: todos los módulos dependen de ella. Un bug aquí rompe toda la app.

### Archivos a cubrir

| Archivo | Qué testear | Prioridad |
|---|---|---|
| `common/guards/roles.guard.ts` | Permite acceso con rol correcto; lanza 403 si falta rol; lanza 403 si no hay user; permite si no hay roles requeridos | Alta |
| `common/guards/jwt-auth.guard.ts` | Delega a Passport correctamente; lanza 401 si falta token | Alta |
| `common/interceptors/tenant.interceptor.ts` | Inyecta `req.tenantId` desde `req.user.tenantId`; no falla si `tenantId` es null | Alta |
| `common/interceptors/logging.interceptor.ts` | Registra método, URL y duración; no altera la respuesta | Media |
| `common/interceptors/audit-log.interceptor.ts` | Llama a `AuditLogService.log` con la info correcta | Alta |
| `common/filters/http-exception.filter.ts` | Formatea `{ statusCode, message[], error }` para HttpException; incluye mensaje de 500 genérico para errores no HTTP | Alta |
| `common/strategies/jwt.strategy.ts` | Extrae payload y lo retorna como user; lanza 401 si payload inválido | Alta |
| `common/gateway/events.gateway.ts` | `emit()` llama a `server.to(room).emit(event, data)`; maneja conexión/desconexión | Media |

### Estructura de archivos

```
dewan-backend/common/
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── tests/
│       ├── jwt-auth.guard.spec.ts
│       └── roles.guard.spec.ts
├── interceptors/
│   ├── audit-log.interceptor.ts
│   ├── logging.interceptor.ts
│   ├── tenant.interceptor.ts
│   └── tests/
│       ├── audit-log.interceptor.spec.ts
│       ├── logging.interceptor.spec.ts
│       └── tenant.interceptor.spec.ts
├── filters/
│   ├── http-exception.filter.ts
│   └── tests/
│       └── http-exception.filter.spec.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── tests/
│       └── jwt.strategy.spec.ts
└── gateway/
    ├── events.gateway.ts
    └── tests/
        └── events.gateway.spec.ts
```

### Patrón para RolesGuard

```typescript
// roles.guard.spec.ts
describe('RolesGuard', () => {
  it('allows access when no roles required', () => { ... });
  it('allows access when user has required role', () => { ... });
  it('throws 403 when user lacks required role', () => { ... });
  it('throws 403 when no user in request', () => { ... });
});
```

**Criterio de aceptación:**

```gherkin
Scenario: Acceso denegado cuando rol no coincide
  Given un endpoint que requiere rol "admin"
  And un usuario autenticado con rol "waiter"
  When el guard evalúa la solicitud
  Then lanza ForbiddenException con mensaje "Acceso denegado. Roles permitidos: admin."

Scenario: Acceso libre sin decorador @Roles
  Given un endpoint sin decorador @Roles
  When el guard evalúa la solicitud
  Then devuelve true sin consultar el rol del usuario
```

---

## TEST-03: Tests E2E de integración — backend (Supertest)

Los tests E2E del backend levantan el módulo NestJS completo (sin base de datos real — Prisma mockeado o en memoria) y hacen peticiones HTTP reales. Testean la capa HTTP: autenticación, validación de DTOs, guards, filtros de error y serialización de respuesta.

### Ubicación

```
dewan-backend/
└── test/
    ├── app.e2e-spec.ts           ← bootstrap y helpers
    ├── auth.e2e-spec.ts          ← flujo login → refresh → logout
    ├── orders.e2e-spec.ts        ← flujo crear pedido → cambiar estado → pagar
    ├── kitchen.e2e-spec.ts       ← flujo recibir pedido → en proceso → listo
    └── jest-e2e.json             ← configuración Jest para e2e
```

### Script en `package.json`

```json
"test:e2e": "jest --config ./test/jest-e2e.json",
"test:e2e:watch": "jest --config ./test/jest-e2e.json --watch"
```

### `test/jest-e2e.json`

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "moduleNameMapper": {
    "^@common/(.*)$": "<rootDir>/common/$1",
    "^@modules/(.*)$": "<rootDir>/modules/$1"
  }
}
```

### Flujos críticos a cubrir (prioridad alta)

| Flujo | Archivo | Use Cases |
|---|---|---|
| Login → Refresh → Logout | `auth.e2e-spec.ts` | UC-01-01, UC-01-02, UC-01-03 |
| Crear pedido → Cambiar estado → Pagar | `orders.e2e-spec.ts` | UC-07-01, UC-07-03, UC-09-01 |
| Cocina recibe → procesa → entrega | `kitchen.e2e-spec.ts` | UC-08-01, UC-08-02 |
| Validación de DTOs rechaza entrada inválida | `app.e2e-spec.ts` | Transversal |
| Guard 401 sin token / 403 con rol incorrecto | `app.e2e-spec.ts` | Transversal |

### Patrón de un test E2E

```typescript
// auth.e2e-spec.ts
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: { user: { findFirst: jest.Mock } /* ... */ };

  beforeAll(async () => {
    prisma = buildPrismaMock(); // helper que devuelve todos los mocks vacíos

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .compile();

    app = module.createNestApplication();
    // mismos middlewares que main.ts: cookie-parser, pipes, filtros
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(() => app.close());

  it('POST /v1/auth/login devuelve 200 con accessToken (UC-01-01)', async () => {
    prisma.user.findFirst.mockResolvedValue(activeUserFixture);

    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: 'juan@test.com', password: 'Segura123!' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined(); // refresh cookie
  });
});
```

**Criterio de aceptación:**

```gherkin
Scenario: Pipeline E2E pasa en CI
  Given el backend arranca con PrismaService mockeado
  When se ejecuta npm run test:e2e
  Then todos los flujos críticos pasan
  And ningún test tarda más de 10 segundos
```

---

## TEST-04: Setup de cobertura — frontend (karma-coverage)

El proyecto ya tiene `karma-coverage` instalado. Solo falta configurarlo para generar reportes y aplicar umbrales.

### Cambio en `angular.json` (test options)

```json
"test": {
  "builder": "@angular-devkit/build-angular:karma",
  "options": {
    "polyfills": ["zone.js", "zone.js/testing"],
    "tsConfig": "tsconfig.spec.json",
    "codeCoverage": true,
    "codeCoverageExclude": [
      "src/environments/**",
      "**/*.module.ts",
      "src/main.ts"
    ],
    "assets": ["favicon.ico", { "glob": "**/*", "input": "assets", "output": "assets" }],
    "styles": ["styles.scss"],
    "scripts": []
  }
}
```

### `karma.conf.js` — umbral de cobertura

```javascript
coverageReporter: {
  dir: require('path').join(__dirname, './coverage/dewan-frontend'),
  subdir: '.',
  reporters: [
    { type: 'html' },
    { type: 'text-summary' },
    { type: 'lcovonly' }      // para CI: Codecov / SonarQube
  ],
  check: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70
    }
  }
}
```

### Script en `package.json`

```json
"test:cov": "ng test --watch=false --code-coverage"
```

**Criterio de aceptación:**

```gherkin
Scenario: npm run test:cov genera reporte de cobertura
  When se ejecuta npm run test:cov en dewan-frontend
  Then se crea coverage/dewan-frontend/index.html
  And el proceso termina con código 0 si los umbrales se cumplen
  And termina con código 1 si algún umbral no se alcanza
```

---

## TEST-05: Tests unitarios de servicios core (frontend)

Prioridad alta — estos servicios los usan todos los componentes.

### Archivos y qué testear

| Archivo | Qué testear |
|---|---|
| `core/auth/auth.service.ts` | `login()` guarda tokens, `logout()` limpia estado, `isLoggedIn()` es reactivo, `currentUser` signal se actualiza |
| `core/services/api.service.ts` | `get/post/put/delete` construyen la URL correcta con `/v1`; reenvían errores HTTP |
| `core/auth/auth.guard.ts` | Redirige a `/login` si no autenticado; permite paso si autenticado |
| `core/auth/jwt.interceptor.ts` | Añade header `Authorization: Bearer <token>` cuando hay accessToken |
| `core/services/websocket.service.ts` | `connect()` llama a `io()` una sola vez; `on()` registra listeners; `disconnect()` cierra la conexión |
| `core/services/toast.service.ts` | `success/error/warn()` llaman a `MessageService.add()` con la severidad correcta |

### Estructura de archivos

```
dewan-frontend/core/
├── auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts      ← nuevo
│   ├── auth.guard.ts
│   ├── auth.guard.spec.ts        ← nuevo
│   ├── jwt.interceptor.ts
│   └── jwt.interceptor.spec.ts   ← nuevo
└── services/
    ├── api.service.ts
    ├── api.service.spec.ts       ← nuevo
    ├── websocket.service.ts
    ├── websocket.service.spec.ts ← nuevo
    ├── toast.service.ts
    └── toast.service.spec.ts     ← nuevo
```

### Patrón para servicios Angular con HttpClient

```typescript
// api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GET construye URL con prefijo /v1', () => {
    service.get<{ id: string }>('products').subscribe();
    const req = httpMock.expectOne('/v1/products');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```

### Patrón para servicios con signals (AuthService)

```typescript
// auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AuthService, provideRouter([])]
    });
    service = TestBed.inject(AuthService);
  });

  it('isLoggedIn() es false por defecto', () => {
    expect(service.isLoggedIn()).toBeFalse();
  });

  it('setSession() actualiza currentUser y isLoggedIn()', () => {
    service.setSession({ id: 'u1', name: 'Juan', role: 'cashier', tenantId: 't1' }, 'mock-token');
    expect(service.isLoggedIn()).toBeTrue();
    expect(service.currentUser()?.name).toBe('Juan');
  });

  it('logout() limpia el estado', () => {
    service.setSession({ id: 'u1', name: 'Juan', role: 'cashier', tenantId: 't1' }, 'token');
    service.logout();
    expect(service.isLoggedIn()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  });
});
```

**Criterio de aceptación:**

```gherkin
Scenario: Todos los servicios core tienen cobertura ≥ 80%
  When se ejecuta npm run test:cov
  Then auth.service.ts tiene statements ≥ 80%
  And api.service.ts tiene statements ≥ 80%
  And auth.guard.ts tiene statements ≥ 80%
  And jwt.interceptor.ts tiene statements ≥ 80%
```

---

## TEST-06: Tests unitarios de componentes Angular (frontend)

Prioridad media. Los componentes son standalone con signals — requieren un patrón específico de TestBed.

### Componentes prioritarios (orden de implementación)

| Componente | Por qué primero | Use Cases |
|---|---|---|
| `features/auth/pages/login.component.ts` | Punto de entrada de todos los usuarios | UC-01-01 |
| `features/orders/pages/orders-list.component.ts` | Feature más usada, lógica de filtros | UC-07-05 |
| `features/kitchen/pages/kitchen-view.component.ts` | Tiempo real, actualización reactiva | UC-08-01..05 |
| `features/cash-registers/pages/cash-register-detail.component.ts` | Cálculo de totales en UI | UC-10-01..03 |
| `features/dashboard/pages/dashboard.component.ts` | Vista owner multi-tenant, race condition conocida | UC-21-04 |

### Patrón para componentes standalone con signals

```typescript
// login.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('AuthService', ['login'], {
      isLoggedIn: jasmine.createSpy().and.returnValue(false),
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],          // standalone: se importa el componente
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('crea el componente', () => {
    expect(component).toBeTruthy();
  });

  it('muestra error de validación si el email está vacío', () => {
    component.form.get('email')?.setValue('');
    component.form.get('email')?.markAsTouched();
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('[data-testid="email-error"]');
    expect(el).toBeTruthy();
  });

  it('llama a AuthService.login con las credenciales correctas', async () => {
    authSpy.login.and.resolveTo(undefined);
    component.form.setValue({ email: 'test@test.com', password: 'pass123' });

    await component.onSubmit();

    expect(authSpy.login).toHaveBeenCalledWith({ email: 'test@test.com', password: 'pass123' });
  });
});
```

### Convenciones para atributos de test en plantillas

Añadir `data-testid` en elementos clave de las plantillas para que los tests no dependan de clases CSS ni estructura DOM:

```html
<!-- botón de submit -->
<p-button data-testid="submit-btn" [loading]="loading()" label="Ingresar" />

<!-- mensaje de error -->
<small data-testid="email-error" *ngIf="...">Email inválido</small>
```

**Criterio de aceptación:**

```gherkin
Scenario: Componente de login muestra error con email vacío
  Given el componente LoginComponent está montado
  When el campo email se toca sin valor
  Then se muestra el mensaje de validación de email

Scenario: Login llama al servicio con las credenciales del formulario
  Given el formulario tiene email y password válidos
  When el usuario hace submit
  Then AuthService.login es llamado exactamente una vez con esos datos
```

---

## TEST-07: Tests unitarios de guards e interceptores (frontend)

### AuthGuard

```typescript
// auth.guard.spec.ts
describe('AuthGuard', () => {
  it('permite la navegación cuando el usuario está autenticado', () => { ... });
  it('redirige a /login cuando el usuario no está autenticado', () => { ... });
});
```

### JwtInterceptor

```typescript
// jwt.interceptor.spec.ts
describe('JwtInterceptor', () => {
  it('añade Authorization: Bearer cuando hay token', () => { ... });
  it('deja pasar la petición sin header cuando no hay token', () => { ... });
  it('captura 401 y llama a AuthService.logout()', () => { ... });
});
```

---

## TEST-08: E2E end-to-end con Playwright

Playwright testea flujos completos de usuario en el navegador real contra la app levantada localmente (backend + frontend).

### Instalación

```bash
cd dewan-frontend
npm i -D @playwright/test
npx playwright install chromium
```

### Estructura

```
dewan-frontend/
└── e2e/
    ├── playwright.config.ts
    ├── fixtures/
    │   └── auth.fixture.ts        ← helper para hacer login programático
    └── specs/
        ├── auth.spec.ts           ← login / logout
        ├── orders.spec.ts         ← crear y gestionar pedidos
        ├── kitchen.spec.ts        ← flujo cocina real-time
        ├── cash-register.spec.ts  ← apertura / cierre de caja
        └── multi-tenant.spec.ts   ← switch tenant (UC-21-02)
```

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  fullyParallel: false,        // secuencial: comparten estado de DB de test
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4200',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start:local',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Flujos E2E prioritarios

| Flujo | Archivo | Use Cases cubiertos |
|---|---|---|
| Login exitoso → dashboard | `auth.spec.ts` | UC-01-01 |
| Logout limpia sesión y redirige | `auth.spec.ts` | UC-01-03 |
| Crear pedido local con mesa | `orders.spec.ts` | UC-07-01 |
| Cocina cambia estado a "en proceso" | `kitchen.spec.ts` | UC-08-02 |
| Abrir caja, registrar venta, cerrar caja | `cash-register.spec.ts` | UC-10-01, UC-10-02 |
| Owner cambia de tenant | `multi-tenant.spec.ts` | UC-21-02 |

### Patrón de test E2E

```typescript
// auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('login exitoso redirige al dashboard (UC-01-01)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@test.com');
    await page.fill('[data-testid="password-input"]', 'Segura123!');
    await page.click('[data-testid="submit-btn"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
  });

  test('credenciales incorrectas muestra error 401 (E01)', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'ghost@test.com');
    await page.fill('[data-testid="password-input"]', 'wrong');
    await page.click('[data-testid="submit-btn"]');

    await expect(page.locator('[data-testid="login-error"]')).toContainText('Credenciales inválidas');
  });
});
```

**Criterio de aceptación:**

```gherkin
Scenario: Suite E2E pasa con la app corriendo
  Given el backend y el frontend están corriendo en modo local
  When se ejecuta npx playwright test
  Then los 6 flujos críticos pasan
  And los screenshots de fallos se guardan en e2e/test-results/
```

---

## TEST-09: CI/CD — enforcement de cobertura

### Backend (`.github/workflows/test.yml` en `dewan-backend`)

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:cov
      - uses: codecov/codecov-action@v4   # opcional
        with: { files: ./coverage/lcov.info }

  e2e:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:e2e
```

### Frontend (`.github/workflows/test.yml` en `dewan-frontend`)

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test:cov -- --browsers=ChromeHeadless

  e2e:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
```

---

## Convenciones de tests en Dewan

### Backend (Jest + NestJS Testing)

| Convención | Detalle |
|---|---|
| Ubicación | `modules/<name>/tests/<name>.service.spec.ts` y `<name>.controller.spec.ts` |
| ID de escenario | Referenciar UC-XX-YY o error codes (E01, E02…) en los `it()` |
| Mocks de Prisma | Inline en `beforeEach` como objeto literal con `jest.fn()` — NO usar librerías de mocking de Prisma |
| Mocks de AuditLogService | `{ log: jest.fn().mockResolvedValue(undefined) }` |
| Mocks de EventsGateway | `{ emit: jest.fn() }` |
| Nombre de `it()` | Describe el comportamiento observable, no la implementación |
| Escenarios de error | Un `it()` por cada código de error del spec |

### Frontend (Karma + Jasmine)

| Convención | Detalle |
|---|---|
| Ubicación | Mismo directorio que el archivo fuente: `auth.service.spec.ts` junto a `auth.service.ts` |
| Imports de componentes standalone | `imports: [MyComponent]` en `TestBed.configureTestingModule` |
| Mocks de servicios | `jasmine.createSpyObj('ServiceName', ['method1', 'method2'])` |
| Signals en tests | Leer con `component.mySignal()` — son funciones síncronas en el contexto de test |
| `data-testid` | Obligatorio en elementos interactivos clave para que los selectores de test no rompan con refactors de clases CSS |
| `fixture.detectChanges()` | Llamar después de cada mutación de estado en tests de componentes |

### Exclusiones globales (lo que NO se testea)

| Qué | Por qué |
|---|---|
| `*.module.ts` | Solo wiring de inyección de dependencias, sin lógica |
| Archivos `*.dto.ts` | La validación la hace `class-validator` (librería externa testeada); lo que importa es que el servicio rechace datos inválidos |
| `prisma/seed.ts` | Script de datos de prueba, no lógica de producción |
| Constantes (`*.constant.ts`) | Valores inmutables sin ramificaciones |
| Plantillas HTML/SCSS | Testeadas implícitamente a través de los tests de componentes |

---

## Orden de implementación (mayor valor primero)

| Prioridad | Item | Esfuerzo estimado | Valor |
|---|---|---|---|
| 1 | TEST-01: Corregir `collectCoverageFrom` | 15 min | Alto — métricas correctas de inmediato |
| 2 | TEST-02: Tests de `common/` (guards, interceptors, filters) | 3–4 h | Alto — infraestructura transversal |
| 3 | TEST-05: Tests de `core/` servicios frontend | 4–5 h | Alto — base para todos los features |
| 4 | TEST-04: Setup karma-coverage frontend | 30 min | Medio — sin esto no hay reporte frontend |
| 5 | TEST-03: E2E backend (Supertest) — flujos críticos | 4–6 h | Alto — primer test de integración real |
| 6 | TEST-06: Componentes de login y dashboard | 3–4 h | Medio — más visibles al usuario |
| 7 | TEST-07: Guards e interceptores frontend | 2 h | Medio — seguridad de navegación |
| 8 | TEST-08: E2E con Playwright — 6 flujos críticos | 6–8 h | Alto — validación end-to-end |
| 9 | TEST-09: CI/CD enforcement | 1–2 h | Alto — consolida todo lo anterior |

> La implementación de los tests sigue las convenciones de este spec. Antes de escribir cualquier test en un módulo, leer el SPEC funcional correspondiente (SPEC-01 a SPEC-22) para referenciar los UC correctos.
