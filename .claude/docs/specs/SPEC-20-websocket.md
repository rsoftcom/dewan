# SPEC-20: WebSocket Infrastructure — Capa Real-Time

**Descripción:** Infraestructura centralizada de WebSockets para toda la aplicación. Reemplaza la conexión por componente (actual kitchen-view) y el `unreadCount` estático del bell de notificaciones con un servicio singleton autenticado y compartido por toda la app.

**Actores:** Sistema · todos los usuarios autenticados

**Afecta:** SPEC-07 (orders), SPEC-08 (kitchen), SPEC-18 (notifications)

> Esta especificación describe la capa de transporte. Los eventos concretos que dispara cada módulo siguen documentados en sus specs respectivos.

---

## Problema actual

| Síntoma | Causa |
|---|---|
| `KitchenViewComponent` crea su propio `io()` al montar | No hay servicio singleton — cada componente conecta por su cuenta |
| `NotificationBellComponent.unreadCount = signal(0)` hardcodeado | Nunca se conecta al socket |
| La conexión al socket no lleva JWT | El backend no puede identificar al usuario ni asignarlo a las salas correctas |
| CORS del gateway es `origin: '*'` | No coincide con la política del resto de la API |
| No hay reconexión ante token refresh | Si el AT expira y rota, la sesión WS queda obsoleta |

---

## UC-20-01: Conexión autenticada al WebSocket

**Actor:** Sistema (iniciado por `AuthService` después del login)
**Roles permitidos:** OW, AD, CA, WA, KI, DE, SA

**Flujo principal:**

1. Tras login exitoso, `AuthService` llama a `WebSocketService.connect(accessToken)`.
2. El frontend abre conexión Socket.io enviando el token en el handshake:
   ```
   io(WS_URL, { auth: { token: accessToken }, transports: ['websocket'] })
   ```
3. El backend valida el token en `EventsGateway.handleConnection()` usando `JwtService.verify()`.
4. Si válido: el servidor almacena `{ sub, tenantId, role }` en `client.data.user`.
5. El servidor auto-une al cliente a las salas correspondientes según rol (ver tabla UC-20-02).
6. El socket permanece abierto hasta logout o desconexión.

**Excepciones:**

| ID | Condición | Acción |
|---|---|---|
| E01 | Token ausente o inválido | `client.disconnect(true)` — sin sala, sin eventos |
| E02 | Token expirado | `client.disconnect(true)` → frontend reconecta tras refresh |
| E03 | Tenant inactivo | `client.disconnect(true)` |

**Reglas de negocio:**

- RN-WS-01: Solo existe **una** conexión WebSocket por sesión de usuario (singleton en Angular).
- RN-WS-02: Al hacer `POST /auth/refresh`, el frontend emite `authenticate` con el nuevo token para que el servidor actualice `client.data.user` sin reconectar.
- RN-WS-03: Al hacer `POST /auth/logout`, `WebSocketService.disconnect()` se llama antes de limpiar el token.
- RN-WS-04: Socket.io reconecta automáticamente ante cortes de red. Al reconectar, re-emite `authenticate`.

**Backend — `EventsGateway` (cambios):**

```typescript
// common/gateway/events.gateway.ts
@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || true, credentials: true },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  // Valida JWT → une a salas → guarda user en socket.data
  async handleConnection(client: Socket) { ... }

  // Cleanup (opcional — Socket.io gestiona salas automáticamente al desconectar)
  handleDisconnect(client: Socket) { ... }

  // Escucha evento para re-autenticar sin reconectar (tras token refresh)
  @SubscribeMessage('authenticate')
  async handleAuthenticate(client: Socket, token: string) { ... }

  // Método interno — no cambia su firma
  emit(room: string, event: string, data: unknown) {
    this.server.to(room).emit(event, data);
  }
}
```

**Frontend — `WebSocketService` (nuevo):**

```typescript
// core/services/websocket.service.ts
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private socket: Socket | null = null;
  private readonly subjects = new Map<string, Subject<unknown>>();

  connect(token: string): void { ... }
  disconnect(): void { ... }
  refreshToken(newToken: string): void { ... }  // emite 'authenticate'
  on<T>(event: string): Observable<T> { ... }   // retorna Subject como Observable
}
```

**Integración en `AuthService`:**

```typescript
// Después de login exitoso:
this.websocket.connect(res.accessToken);

// Después de refresh exitoso:
this.websocket.refreshToken(res.accessToken);

// Antes de logout:
this.websocket.disconnect();
```

---

## UC-20-02: Auto-unión a salas por rol

**Actor:** Sistema (durante `handleConnection`)
**Roles permitidos:** N/A — proceso interno

El servidor une automáticamente al cliente a las salas según su rol. No se emite evento `join` desde el cliente.

| Rol | Salas auto-joined |
|---|---|
| `kitchen` | `kitchen_[tenantId]` |
| `cashier`, `waiter` | `orders_[tenantId]` |
| `owner`, `admin` | `kitchen_[tenantId]`, `orders_[tenantId]` |
| `super_admin` | (ninguna — SA no recibe eventos operativos por defecto) |
| Todos los roles | `user_[userId]` (notificaciones personales) |

**Criterios de aceptación:**

```gherkin
Scenario: Kitchen se conecta y recibe pedidos
  Given personal de cocina inicia sesión
  When WebSocketService.connect() es llamado
  Then el servidor auto-une al socket a kitchen_[tenantId] y user_[userId]
  And el cliente NO emite evento join manualmente

Scenario: Token inválido rechazado
  Given un token manipulado o expirado
  When se intenta conectar al WebSocket
  Then el servidor llama client.disconnect(true)
  And el cliente NO recibe ningún evento

Scenario: Token renovado mantiene sesión WebSocket
  Given una sesión activa y token expirado
  When el JwtInterceptor llama a /auth/refresh y obtiene nuevo accessToken
  Then WebSocketService.refreshToken() emite 'authenticate' al servidor
  And el servidor actualiza client.data.user con el nuevo token
  And la conexión continúa sin interrupción
```

---

## UC-20-03: Catálogo de eventos WebSocket

**Actor:** Sistema (servidor → cliente)

Todos los eventos son unidireccionales: **servidor → cliente**. Ningún evento fluye de cliente a servidor (las acciones van vía REST).

| Evento | Sala destino | Disparado por | Payload |
|---|---|---|---|
| `order:new` | `kitchen_[tenantId]` | `OrdersService.create()` | `KitchenOrder` completo |
| `order:updated` | `kitchen_[tenantId]`, `orders_[tenantId]` | `KitchenService.accept()` | `{ id, status, tenantId }` |
| `order:ready` | `orders_[tenantId]` | `KitchenService.ready()` | `{ id, type, tableName, tenantId }` |
| `order:rejected` | `kitchen_[tenantId]`, `orders_[tenantId]` | `KitchenService.reject()` | `{ id, rejectionReason }` |
| `order:served` | `orders_[tenantId]` | `OrdersService.serve()` | `{ id }` |
| `notification:new` | `user_[userId]` | `NotificationService.create()` | `Notification` completo |

**Regla de payload:** Siempre se incluye `tenantId` en eventos de sala de tenant (ya implícito en la sala, pero útil si el frontend reutiliza handlers).

---

## UC-20-04: Migración de `KitchenViewComponent`

**Descripción:** Eliminación del `io()` raw en kitchen y adopción de `WebSocketService`.

**Antes (actual):**
```typescript
// KitchenViewComponent
private socket: Socket | null = null;

ngOnInit() {
  this.socket = io(environment.apiUrl.replace('/v1', ''), { transports: ['websocket'] });
  this.socket.emit('join', `kitchen_${user.tenantId}`);
  this.socket.on('order:new', ...);
}
ngOnDestroy() { this.socket?.disconnect(); }
```

**Después:**
```typescript
// KitchenViewComponent — ya no gestiona el socket
private readonly ws = inject(WebSocketService);
private readonly subs: Subscription[] = [];

ngOnInit() {
  this.loadOrders();
  this.subs.push(
    this.ws.on<KitchenOrder>('order:new').subscribe(order => { ... }),
    this.ws.on<{ id: string; status: string }>('order:updated').subscribe(data => { ... }),
  );
}
ngOnDestroy() { this.subs.forEach(s => s.unsubscribe()); }
```

---

## UC-20-05: Notification Bell en tiempo real

**Descripción:** `NotificationBellComponent` muestra el conteo real de notificaciones no leídas, actualizándose sin polling.

**Flujo:**

1. Al montar el bell, llama a `GET /notifications?isRead=false&limit=1` para obtener `meta.unreadCount` inicial.
2. Suscribe al evento `notification:new` via `WebSocketService.on<Notification>('notification:new')`.
3. Cada vez que llega `notification:new`, incrementa el contador local.
4. Al marcar como leído (desde `NotificationListComponent`), el bell actualiza su contador vía un `Signal` compartido o re-fetch del conteo.

**Criterios de aceptación:**

```gherkin
Scenario: Bell se actualiza al llegar notificación
  Given owner con 2 notificaciones no leídas, bell muestra badge "2"
  When el sistema emite notification:new al canal user_[userId]
  Then el badge del bell pasa a "3" sin que el usuario recargue la página

Scenario: Bell refleja estado inicial al cargar
  Given owner con 5 notificaciones no leídas
  When el shell carga (post-login)
  Then el bell hace GET /notifications?isRead=false&limit=1
  And muestra badge "5"
```

---

## Cambios en el backend

### `events.gateway.ts` (reemplazar completo)

- Implementa `OnGatewayConnection` y `OnGatewayDisconnect`
- Inyecta `JwtService` para verificar tokens
- Lógica de salas en `handleConnection`
- Evento `@SubscribeMessage('authenticate')` para re-auth sin reconexión
- CORS: `process.env.FRONTEND_URL || true` (alinear con `main.ts`)

### `common/gateway/events.module.ts` (si existe)

- Añadir `JwtModule.register({ secret: process.env.JWT_SECRET })` a los imports del módulo del gateway

---

## Archivos afectados

**Backend:**
- `common/gateway/events.gateway.ts` — reescritura completa
- `app.module.ts` — verificar que JwtModule esté disponible en el contexto del gateway

**Frontend:**
- `core/services/websocket.service.ts` — **NUEVO**
- `core/auth/auth.service.ts` — integrar `WebSocketService`
- `features/kitchen/pages/kitchen-view.component.ts` — usar `WebSocketService`
- `features/notifications/components/notification-bell.component.ts` — real-time count
- `features/orders/pages/*.component.ts` — suscribir a `order:ready`, `order:served`
- `app/app.config.ts` — ningún cambio (singleton via `providedIn: 'root'`)
