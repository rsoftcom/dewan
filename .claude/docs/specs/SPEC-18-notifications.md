# SPEC-18: Notifications

**Descripción:** Sistema de notificaciones in-app. Las notificaciones se crean internamente por el sistema y se entregan en tiempo real por WebSocket.

**Actores:** Sistema (crea), usuarios autenticados (leen)

**Entidades:** `notification`

> **Fase 2:** Los UC-18-04 y UC-18-05 añaden la capa real-time basada en `WebSocketService` (SPEC-20). El bell de notificaciones ya no usa un `signal(0)` estático — se actualiza en tiempo real.

-----

## UC-18-01: Listar notificaciones del usuario

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo principal:**

1. Actor envía `GET /notifications`.
1. Sistema retorna notificaciones del `user_id` del token, ordenadas por `created_at` DESC.
1. Soporta filtro `?isRead=false` para no leídas.
1. Incluye contador `unreadCount` en el header de respuesta.

**Contrato API:**

`GET /api/v1/notifications?isRead=false&page=1&limit=20`

Response 200:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Stock bajo: Harina",
      "message": "La harina tiene solo 200g disponibles (mínimo: 500g).",
      "type": "low_stock",
      "isRead": false,
      "entity": "product",
      "entityId": "uuid-harina",
      "createdAt": "2026-05-19T10:30:00Z"
    }
  ],
  "meta": { "total": 5, "unreadCount": 3 }
}
```

-----

## UC-18-02: Marcar notificaciones como leídas

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo principal (marcar todas):**

1. Actor envía `PATCH /notifications/read-all`.
1. Sistema actualiza `is_read = true` para todas las notificaciones del usuario.

**Flujo alternativo (marcar una):**

1. Actor envía `PATCH /notifications/:id/read`.
1. Sistema actualiza solo esa notificación.

**Criterios de aceptación:**

```gherkin
Scenario: Marcar todas como leídas
  Given usuario con 5 notificaciones no leídas
  When envía PATCH /api/v1/notifications/read-all
  Then recibe status 200
  And todas las notificaciones tienen is_read = true
  And unreadCount = 0

Scenario: Marcar una notificación
  When envía PATCH /api/v1/notifications/:id/read
  Then solo esa notificación tiene is_read = true
```

**Contrato API:**

`PATCH /api/v1/notifications/read-all` → Response 200: `{ "updated": 5 }`

`PATCH /api/v1/notifications/:id/read` → Response 200: Notificación actualizada.

-----

## UC-18-03: Entrega de notificaciones en tiempo real (sistema)

**Actor:** Sistema (interno)
**Roles permitidos:** N/A — proceso interno

**Descripción:** El sistema crea y entrega notificaciones automáticamente ante ciertos eventos. Este caso de uso documenta los disparadores.

**Disparadores:**

|Evento                                                           |Tipo           |Destinatarios|Título                                   |
|-----------------------------------------------------------------|---------------|-------------|-----------------------------------------|
|`product.current_stock < product.minimum_stock` al aceptar pedido|`low_stock`    |OW, AD       |“Stock bajo: [producto]”                 |
|Nuevo pedido creado                                              |`new_order`    |KI           |“Nuevo pedido #[id]”                     |
|Pedido `prepared` (local)                                        |`order_status` |CA, WA       |“Pedido [mesa] listo para servir”        |
|Pedido `prepared` (delivery)                                     |`order_status` |OW, AD, CA   |“Domicilio listo para asignar repartidor”|
|Caja cerrada                                                     |`cash_register`|OW, AD       |“Caja cerrada. Diferencia: [diff]”       |

**Flujo interno:**

1. El servicio correspondiente (OrderService, ProductService, etc.) llama a `NotificationService.create(...)`.
1. `NotificationService` persiste la notificación en DB.
1. `NotificationService` emite evento `notification:new` al canal WebSocket `user_[userId]`.

**WebSocket:**

- Canal por usuario: `user_[userId]`
- Evento: `notification:new`
- Payload: objeto `notification` completo

> La conexión WebSocket se gestiona mediante `WebSocketService` (SPEC-20). No hay conexión directa `io()` en este módulo.

-----

## UC-18-04: Conteo inicial de no leídas al montar el bell

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo:**

1. Al montar `NotificationBellComponent` (parte del shell, siempre activo post-login):
2. Llama `GET /notifications?isRead=false&limit=1` para obtener `meta.unreadCount`.
3. Almacena el valor en `unreadCount = signal(n)`.
4. Suscribe al evento `notification:new` del `WebSocketService`.
5. Por cada `notification:new` recibido: `unreadCount.update(c => c + 1)`.
6. Cuando el usuario abre la lista y marca como leído: `unreadCount.update(c => Math.max(0, c - n))`.

**Criterios de aceptación:**

```gherkin
Scenario: Bell carga conteo inicial
  Given usuario con 3 notificaciones no leídas
  When el shell monta (post-login)
  Then el bell llama GET /notifications?isRead=false&limit=1
  And muestra badge "3"

Scenario: Bell incrementa en tiempo real
  Given badge mostrando "3"
  When llega evento notification:new
  Then badge pasa a "4" instantáneamente
```

-----

## UC-18-05: Entrega real-time via WebSocketService

**Actor:** Sistema (interno)

**Descripción:** Cómo el sistema emite `notification:new` al canal del usuario usando el `WebSocketService` compartido (SPEC-20).

**Flujo de entrega:**

1. `NotificationService.create(userId, payload)` persiste la notificación en DB.
2. Llama `EventsGateway.emit(`user_${userId}`, 'notification:new', notification)`.
3. El socket del usuario (autenticado, sala `user_[userId]`) recibe el evento.
4. `WebSocketService.on<Notification>('notification:new')` emite el valor a todos los subscribers.
5. `NotificationBellComponent` y `NotificationListComponent` (si está abierto) actualizan su estado.

**Dependencia:** SPEC-20 UC-20-01 debe estar implementado (conexión autenticada con auto-join a `user_[userId]`).
