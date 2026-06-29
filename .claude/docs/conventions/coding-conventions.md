# R Soft — Convenios de Código: Naming

> **Versión:** 1.0
> **Fecha:** 2026-05-19
> **Stack:** NestJS · Prisma · PostgreSQL 16 · Angular 18+ · Socket.io
> **Decisión base:** D-24 — Nomenclatura en inglés (entidades, atributos, relaciones y código)

-----

## 1. Backend — NestJS + Prisma

### 1.1 Archivos y carpetas

**Convención:** `kebab-case` con sufijo que indica el tipo.

```
modules/
  orders/
    orders.controller.ts
    orders.service.ts
    orders.module.ts
    dto/
      create-order.dto.ts
      update-order.dto.ts
      order-response.dto.ts
      order-query.dto.ts
    entities/
      order.entity.ts
    guards/
      order-ownership.guard.ts
    tests/
      orders.service.spec.ts
      orders.controller.spec.ts
```

**Regla:** el nombre del archivo siempre refleja la clase que contiene. Un archivo = una clase exportada principal.

-----

### 1.2 Clases

**Convención:** `PascalCase` con sufijo que indica su rol.

|Tipo        |Patrón                            |Ejemplo                     |
|------------|----------------------------------|----------------------------|
|Controller  |`{Entity}Controller`              |`OrdersController`          |
|Service     |`{Entity}Service`                 |`OrdersService`             |
|Module      |`{Entity}Module`                  |`OrdersModule`              |
|Guard       |`{Descriptivo}Guard`              |`RolesGuard`, `TenantGuard` |
|Interceptor |`{Descriptivo}Interceptor`        |`AuditLogInterceptor`       |
|Filter      |`{Descriptivo}Filter`             |`HttpExceptionFilter`       |
|Decorator   |sin sufijo, camelCase como función|`@Roles()`, `@CurrentUser()`|
|Gateway (WS)|`{Módulo}Gateway`                 |`EventsGateway`             |
|Task (cron) |`{Descriptivo}Task`               |`StockAlertTask`            |

-----

### 1.3 Métodos

**Convención:** `camelCase`. El nombre expresa la acción sin ambigüedad.

#### En Controllers — reflejan la operación HTTP

|Acción       |Método HTTP    |Nombre del método                                   |
|-------------|---------------|----------------------------------------------------|
|Crear        |POST           |`create()`                                          |
|Listar       |GET (colección)|`findAll()`                                         |
|Obtener uno  |GET (/:id)     |`findOne()`                                         |
|Actualizar   |PATCH          |`update()`                                          |
|Eliminar     |DELETE         |`remove()`                                          |
|Acción custom|POST/PATCH     |verbo descriptivo: `accept()`, `close()`, `assign()`|

#### En Services — mismos nombres públicos + métodos internos

```typescript
// Públicos (llamados desde controller)
create(dto: CreateOrderDto): Promise<Order>
findAll(query: OrderQueryDto): Promise<PaginatedResult<Order>>
findOne(id: string): Promise<Order>
update(id: string, dto: UpdateOrderDto): Promise<Order>
remove(id: string): Promise<void>

// Internos (lógica de negocio)
private calculateTotal(items: OrderItemDto[]): number
private validateStockAvailability(items: OrderItemDto[]): Promise<void>
private emitOrderEvent(order: Order, event: string): void
```

**Regla:** métodos privados con `private`, prefijo descriptivo del dominio. No usar prefijos como `_` o `get` innecesarios.

-----

### 1.4 Variables y constantes

|Contexto            |Convención                 |Ejemplo                              |
|--------------------|---------------------------|-------------------------------------|
|Variables locales   |camelCase                  |`const orderTotal = 150`             |
|Propiedades de clase|camelCase                  |`private prisma: PrismaService`      |
|Constantes de módulo|UPPER_SNAKE_CASE           |`const MAX_ITEMS_PER_ORDER = 50`     |
|Constantes globales |UPPER_SNAKE_CASE           |`export const JWT_EXPIRATION = '15m'`|
|Enums (nombre)      |PascalCase                 |`OrderStatus`                        |
|Enums (valores)     |snake_case (match DB)      |`in_kitchen`, `on_the_way`           |
|Booleanos           |prefijo `is/has/can/should`|`isActive`, `hasStock`, `canCancel`  |

-----

### 1.5 DTOs

**Patrón:** `{Acción}{Entidad}Dto`

```typescript
// Input DTOs (request body)
CreateOrderDto        // POST
UpdateOrderDto        // PATCH
AssignDeliveryDto     // acción custom

// Query DTOs (query params — filtros y paginación)
OrderQueryDto         // GET con filtros
ProductQueryDto

// Response DTOs (lo que retorna la API)
OrderResponseDto
PaginatedResponseDto<T>
```

**Regla:** los DTOs de input usan `class-validator` decorators. Los de response son opcionales (Prisma ya tipea el retorno), pero se usan si se quiere controlar qué campos exponer o documentar en Swagger.

-----

### 1.6 Prisma Schema

```prisma
// Modelos: PascalCase singular
model Product {
  id            String   @id @default(uuid())
  tenantId      String   @map("tenant_id")
  name          String
  currentStock  Decimal  @map("current_stock")
  createdAt     DateTime @default(now()) @map("created_at")

  // Relaciones: camelCase
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
  orderItems    OrderItem[]

  // Tabla en DB: snake_case plural
  @@map("products")
}

// Enums: PascalCase nombre, snake_case valores
enum OrderStatus {
  pending
  in_kitchen
  prepared
  served
  paid
  completed
  cancelled

  @@map("order_status")
}
```

#### Resumen de mapeo Prisma ↔ DB

|Capa             |Convención         |Ejemplo                     |
|-----------------|-------------------|----------------------------|
|Prisma model     |PascalCase singular|`Product`, `OrderItem`      |
|Prisma field     |camelCase          |`currentStock`, `tenantId`  |
|DB table         |snake_case plural  |`products`, `order_items`   |
|DB column        |snake_case         |`current_stock`, `tenant_id`|
|Prisma enum name |PascalCase         |`OrderStatus`               |
|Prisma enum value|snake_case         |`in_kitchen`                |

-----

### 1.7 WebSocket Events

**Formato:** `{dominio}:{acción}` en snake_case

```typescript
// Servidor → cliente
'order:new'
'order:status_changed'
'stock:low_alert'
'cash_register:opened'

// Cliente → servidor (si aplica)
'order:subscribe'
'kitchen:acknowledge'
```

-----

## 2. Frontend — Angular 18+ (Standalone, Single-File)

### 2.1 Archivos y carpetas

**Componentes single-file:** sin `.html` separado. Solo `.ts` y `.scss` (cuando los estilos lo ameriten).

```
features/
  orders/
    pages/
      order-list.component.ts         # página completa (routed)
      order-detail.component.ts
      order-create.component.ts
    components/
      order-card.component.ts          # componente reutilizable del módulo
      order-status-badge.component.ts
      order-items-table.component.ts
    services/
      orders.service.ts
    models/
      order.model.ts                   # interfaces y types
    routes.ts                          # rutas lazy del feature

shared/
  components/
    confirm-dialog.component.ts
    data-table.component.ts
    page-header.component.ts
    empty-state.component.ts
  pipes/
    currency-format.pipe.ts
    relative-time.pipe.ts
  directives/
    click-outside.directive.ts
    role-visible.directive.ts

core/
  auth/
    auth.service.ts
    auth.guard.ts
    jwt.interceptor.ts
  services/
    api.service.ts
    socket.service.ts
    toast.service.ts
  models/
    user.model.ts
    api-response.model.ts
```

#### Estructura por feature

|Carpeta      |Contenido                                   |
|-------------|--------------------------------------------|
|`pages/`     |Componentes que son rutas (una por pantalla)|
|`components/`|Componentes internos del feature, no routed |
|`services/`  |Servicios específicos del feature           |
|`models/`    |Interfaces, types, enums del feature        |
|`routes.ts`  |Lazy routes del feature                     |

-----

### 2.2 Reglas del componente single-file

|Regla            |Convención                                                    |
|-----------------|--------------------------------------------------------------|
|Template         |Siempre inline con `template:` (backticks). Sin `templateUrl` |
|Estilos mínimos  |Inline con `styles:` (backtick). Solo si son <15 líneas       |
|Estilos complejos|Archivo separado `.scss` con `styleUrl`                       |
|Standalone       |Siempre `standalone: true`. Nunca usar NgModules propios      |
|Selector         |Siempre prefijo `app-` en kebab-case: `app-order-list`        |
|Imports          |Cada componente importa lo que usa. No hay módulos compartidos|

-----

### 2.3 Prácticas modernas Angular 18+ (obligatorias)

#### Inyección con `inject()` — nunca constructor injection

```typescript
// ✅ Correcto
private readonly ordersService = inject(OrdersService);
private readonly router = inject(Router);

// ❌ Prohibido
constructor(private ordersService: OrdersService) {}
```

#### Signals para estado reactivo — nunca propiedades planas

```typescript
// ✅ Correcto
orders = signal<Order[]>([]);
loading = signal(false);
selectedOrder = signal<Order | null>(null);
totalCount = computed(() => this.orders().length);

// ❌ Prohibido
orders: Order[] = [];
loading = false;
```

#### Nuevo control flow — nunca directivas estructurales legacy

```html
<!-- ✅ Correcto -->
@if (loading()) {
  <app-spinner />
} @else if (orders().length === 0) {
  <app-empty-state message="No hay pedidos" />
} @else {
  <div>contenido</div>
}

@for (order of orders(); track order.id) {
  <app-order-card [order]="order" />
} @empty {
  <p>Sin resultados</p>
}

@switch (order.status) {
  @case ('pending') { <p-tag value="Pendiente" severity="warn" /> }
  @case ('completed') { <p-tag value="Completado" severity="success" /> }
  @default { <p-tag [value]="order.status" /> }
}

<!-- ❌ Prohibido -->
<div *ngIf="loading">
<div *ngFor="let order of orders">
<div [ngSwitch]="order.status">
```

#### Input/Output con señales

```typescript
// ✅ Correcto — Angular 18+ signal inputs/outputs
export class OrderCardComponent {
  order = input.required<Order>();
  showActions = input(true);

  statusChanged = output<string>();

  isDelivery = computed(() => this.order().type === 'delivery');

  onChangeStatus(status: string): void {
    this.statusChanged.emit(status);
  }
}

// ❌ Prohibido — decoradores legacy
@Input() order!: Order;
@Output() statusChanged = new EventEmitter<string>();
```

#### Guards e interceptores funcionales

```typescript
// auth.guard.ts
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

// role.guard.ts
export const roleGuard = (...allowedRoles: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    return allowedRoles.includes(authService.currentUser()?.role ?? '');
  };
};

// jwt.interceptor.ts
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.accessToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req);
};
```

#### Rutas lazy con `loadComponent`

```typescript
// features/orders/routes.ts
export const ORDER_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard, roleGuard('owner', 'admin', 'cashier', 'waiter')],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/order-list.component')
            .then(m => m.OrderListComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./pages/order-create.component')
            .then(m => m.OrderCreateComponent),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/order-detail.component')
            .then(m => m.OrderDetailComponent),
      },
    ],
  },
];

// app.routes.ts
export const APP_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login.component')
        .then(m => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: 'orders',
        loadChildren: () =>
          import('./features/orders/routes')
            .then(m => m.ORDER_ROUTES),
      },
      {
        path: 'products',
        loadChildren: () =>
          import('./features/products/routes')
            .then(m => m.PRODUCT_ROUTES),
      },
    ],
  },
];
```

-----

### 2.4 Naming de clases Angular

|Tipo                   |Patrón nombre                      |Patrón archivo              |
|-----------------------|-----------------------------------|----------------------------|
|Page component         |`OrderListComponent`               |`order-list.component.ts`   |
|UI component           |`OrderCardComponent`               |`order-card.component.ts`   |
|Service                |`OrdersService`                    |`orders.service.ts`         |
|Pipe                   |`CurrencyFormatPipe`               |`currency-format.pipe.ts`   |
|Directive              |`ClickOutsideDirective`            |`click-outside.directive.ts`|
|Guard (funcional)      |`authGuard` (camelCase, es función)|`auth.guard.ts`             |
|Interceptor (funcional)|`jwtInterceptor` (camelCase)       |`jwt.interceptor.ts`        |
|Model/Interface        |`Order`, `OrderItem`               |`order.model.ts`            |
|Enum                   |`OrderStatus`                      |dentro de `order.model.ts`  |
|Route constant         |`ORDER_ROUTES`                     |`routes.ts`                 |

-----

### 2.5 Modelos e interfaces

```typescript
// features/orders/models/order.model.ts

export interface Order {
  id: string;
  tenantId: string;
  orderNumber: number;
  type: OrderType;
  status: OrderStatus;
  tableId: string | null;
  customerId: string | null;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes: string | null;
}

export type OrderType = 'local' | 'delivery';

export type OrderStatus =
  | 'pending'
  | 'in_kitchen'
  | 'prepared'
  | 'served'
  | 'assigned'         // delivery: entregado a repartidor
  | 'on_the_way'       // delivery: en camino
  | 'delivered'        // delivery: entregado al cliente
  | 'money_collected'  // delivery: efectivo cobrado
  | 'paid'
  | 'completed'
  | 'rejected';        // terminal: pedido rechazado (no 'cancelled')
```

#### Reglas de modelos

|Regla                |Convención                                           |
|---------------------|-----------------------------------------------------|
|Interfaces de dominio|`interface` (no `class`). Representan datos de la API|
|Enums simples        |`type` union de strings (más ligero, JSON-compatible)|
|Enums complejos      |`enum` solo si necesitan mapeo display o lógica      |
|Un archivo model     |Puede contener la entidad + sus tipos relacionados   |
|Nunca prefijo `I`    |`Order`, nunca `IOrder`                              |

-----

### 2.6 Services — patrón estándar

```typescript
// features/orders/services/orders.service.ts

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/orders';

  findAll(query: PaginationParams): Observable<PaginatedResponse<Order>> {
    return this.api.get(this.basePath, { params: query });
  }

  findOne(id: string): Observable<Order> {
    return this.api.get(`${this.basePath}/${id}`);
  }

  create(dto: CreateOrderRequest): Observable<Order> {
    return this.api.post(this.basePath, dto);
  }

  update(id: string, dto: UpdateOrderRequest): Observable<Order> {
    return this.api.patch(`${this.basePath}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.api.delete(`${this.basePath}/${id}`);
  }

  accept(id: string): Observable<Order> {
    return this.api.patch(`${this.basePath}/${id}/accept`, {});
  }
}
```

**Reglas:**

- Siempre `providedIn: 'root'` (tree-shakeable).
- Los nombres de métodos coinciden con los del backend: `findAll`, `findOne`, `create`, `update`, `remove`.
- Acciones de dominio con verbos descriptivos: `accept()`, `close()`, `assign()`.

-----

### 2.7 Ejemplo completo — componente single-file

```typescript
// order-list.component.ts
import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { OrdersService } from '../services/orders.service';
import { Order } from '../models/order.model';
import { OrderStatusBadgeComponent } from '../components/order-status-badge.component';
import { PageHeaderComponent } from '../../../shared/components/page-header.component';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    OrderStatusBadgeComponent,
    PageHeaderComponent,
    CurrencyFormatPipe,
  ],
  template: `
    <app-page-header
      title="Pedidos"
      subtitle="Gestión de pedidos activos"
    />

    @if (loading()) {
      <p-table [value]="[]" [loading]="true" />
    } @else {
      <p-table
        [value]="orders()"
        [paginator]="true"
        [rows]="20"
        [lazy]="true"
        (onLazyLoad)="onPageChange($event)"
      >
        <ng-template pTemplate="header">
          <tr>
            <th>Nº</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Total</th>
            <th>Acciones</th>
          </tr>
        </ng-template>

        <ng-template pTemplate="body" let-order>
          <tr>
            <td>{{ order.orderNumber }}</td>
            <td>{{ order.type }}</td>
            <td><app-order-status-badge [status]="order.status" /></td>
            <td>{{ order.total | currencyFormat }}</td>
            <td>
              <p-button
                icon="pi pi-eye"
                [text]="true"
                [routerLink]="['/orders', order.id]"
              />
            </td>
          </tr>
        </ng-template>
      </p-table>
    }
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class OrderListComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);

  orders = signal<Order[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadOrders();
  }

  onPageChange(event: any): void {
    this.loadOrders(event.first / event.rows + 1);
  }

  private loadOrders(page = 1): void {
    this.loading.set(true);
    this.ordersService.findAll({ page, limit: 20 }).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
```

-----

## 3. Resumen rápido — Tabla de convenciones

|Elemento           |Backend (NestJS)               |Frontend (Angular)            |Base de datos      |
|-------------------|-------------------------------|------------------------------|-------------------|
|Archivos           |`kebab-case` + sufijo          |`kebab-case` + sufijo         |N/A                |
|Clases             |`PascalCase` + sufijo          |`PascalCase` + sufijo         |N/A                |
|Métodos            |`camelCase`                    |`camelCase`                   |N/A                |
|Variables          |`camelCase`                    |`camelCase`                   |N/A                |
|Constantes         |`UPPER_SNAKE_CASE`             |`UPPER_SNAKE_CASE`            |N/A                |
|Interfaces         |`PascalCase` (sin prefijo `I`) |`PascalCase` (sin prefijo `I`)|N/A                |
|Enums (nombre)     |`PascalCase`                   |`PascalCase` o `type` union   |N/A                |
|Enums (valores)    |`snake_case`                   |`snake_case`                  |`snake_case`       |
|Tablas             |N/A                            |N/A                           |`snake_case` plural|
|Columnas           |N/A                            |N/A                           |`snake_case`       |
|Prisma models      |`PascalCase` singular          |N/A                           |mapeado con `@@map`|
|Prisma fields      |`camelCase`                    |N/A                           |mapeado con `@map` |
|DTOs               |`{Acción}{Entidad}Dto`         |N/A (usa interfaces)          |N/A                |
|Selectores         |N/A                            |`app-{kebab-case}`            |N/A                |
|WS events          |`{dominio}:{acción}` snake_case|mismos nombres                |N/A                |
|Routes const       |N/A                            |`UPPER_SNAKE_CASE`            |N/A                |
|Guards/Interceptors|`PascalCase` (clase)           |`camelCase` (funcional)       |N/A                |
|Booleanos          |`is/has/can/should`            |`is/has/can/should`           |`is_/has_`         |

-----

## 4. Registro de decisiones — Naming

|#   |Decisión                                  |Justificación                                           |
|----|------------------------------------------|--------------------------------------------------------|
|N-01|Todo en inglés                            |Coherencia global. Decisión D-24                        |
|N-02|Componentes single-file                   |Reduce archivos, más legible, estándar moderno Angular  |
|N-03|Standalone obligatorio                    |NgModules deprecados en Angular 18+                     |
|N-04|`inject()` sobre constructor              |API moderna, menos boilerplate, funciona en funciones   |
|N-05|Signals sobre propiedades planas          |Reactividad nativa, mejor rendimiento con OnPush        |
|N-06|Nuevo control flow (`@if`, `@for`)        |Reemplaza directivas legacy, mejor tree-shaking         |
|N-07|Signal inputs/outputs                     |Reactividad automática, composable con `computed()`     |
|N-08|Guards/interceptores funcionales          |Estándar Angular 18+, más simple y tree-shakeable       |
|N-09|`type` union sobre `enum` para TS         |Más ligero, JSON-compatible, sin overhead de compilación|
|N-10|Interfaces sin prefijo `I`                |Convención TypeScript moderna, coherente con Angular    |
|N-11|`providedIn: 'root'` en services          |Tree-shakeable, sin necesidad de providers array        |
|N-12|Métodos CRUD consistentes backend↔frontend|`findAll`, `findOne`, `create`, `update`, `remove`      |