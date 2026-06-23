# SPEC-07: Orders

**Descripción:** Creación y gestión de pedidos locales y de domicilio. Punto de entrada al flujo operativo central.

**Actores:** `cashier`, `waiter` (crear pedidos), `owner`, `admin` (gestión completa)

**Entidades:** `order`, `order_item`, `order_status_history`

-----

## UC-07-01: Crear pedido local

**Actor:** `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Precondiciones:**

- La mesa (`tableId`) existe en el tenant con `status = available`.
- Al menos un ítem en el pedido.
- Todos los productos son `prepared` y `active`.

**Flujo principal:**

1. Actor envía `POST /orders` con `type = "local"`, `tableId` y `items`.
1. Sistema valida que la mesa esté disponible.
1. Sistema valida cada ítem (producto activo, preparado, del tenant).
1. Sistema toma snapshot de `sale_price` de cada producto en `order_item.unit_price`.
1. Sistema calcula `subtotal` por ítem y `total` del pedido.
1. Sistema crea el pedido con `status = pending`.
1. Sistema cambia la mesa a `status = occupied`.
1. Sistema inserta primer registro en `order_status_history` (`status = pending`).
1. Sistema emite evento WebSocket `order:new` a la sala `kitchen_[tenantId]`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                                      |Respuesta                                   |
|---|-----------------------------------------------|--------------------------------------------|
|E01|Mesa ocupada                                   |`409` — “La mesa ya tiene un pedido activo.”|
|E02|Mesa no encontrada en el tenant                |`404`                                       |
|E03|Producto no encontrado, inactivo o no preparado|`400`                                       |
|E04|Sin ítems en el pedido                         |`400`                                       |

**Reglas de negocio:**

- RN-20: Los ítems solo se pueden modificar mientras el pedido esté en `pending`. Una vez en `in_kitchen`, el pedido es inmutable.
- RN-21: `unit_price` es snapshot al momento de crear el pedido.

**Criterios de aceptación:**

```gherkin
Scenario: Crear pedido local exitoso
  Given mesero autenticado y mesa 3 disponible
  When envía POST /api/v1/orders con { type: "local", tableId: "uuid-mesa3", items: [...] }
  Then recibe status 201 con el pedido en status "pending"
  And la mesa 3 cambia a status "occupied"
  And kitchen recibe evento WebSocket order:new
  And se registra en order_status_history

Scenario: Mesa ya ocupada
  Given mesa 3 con pedido activo
  When intenta crear pedido en mesa 3
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/orders`

Request:

```json
{
  "type": "local",
  "tableId": "uuid-mesa3",
  "notes": "Sin cebolla en todo",
  "items": [
    { "productId": "uuid-arepa", "quantity": 2, "notes": "Bien caliente" },
    { "productId": "uuid-jugo", "quantity": 1 }
  ]
}
```

Response 201:

```json
{
  "id": "uuid",
  "type": "local",
  "status": "pending",
  "tableId": "uuid-mesa3",
  "total": 15000,
  "items": [
    { "id": "uuid", "productId": "uuid-arepa", "quantity": 2, "unitPrice": 5000, "subtotal": 10000 }
  ],
  "createdAt": "2026-05-19T10:00:00Z"
}
```

-----

## UC-07-02: Crear pedido de domicilio

**Actor:** `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Precondiciones:**

- Datos del cliente (al menos `phone`).
- Al menos un ítem en el pedido.

**Flujo principal:**

1. Actor envía `POST /orders` con `type = "delivery"` y `customer: { phone, name?, address? }`.
1. Sistema busca cliente por `phone` en el tenant.
- Si existe: usa el `customer.id` existente. Opcionalmente actualiza `address` si se proporciona uno diferente.
- Si no existe: crea nuevo `customer`.
1. Sistema crea el pedido con `type = delivery, status = pending`.
1. Sistema inserta en `order_status_history`.
1. Sistema emite evento WebSocket `order:new` a la sala `kitchen_[tenantId]`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición               |Respuesta|
|---|------------------------|---------|
|E01|`phone` no proporcionado|`400`    |
|E02|Sin ítems               |`400`    |
|E03|Producto inválido       |`400`    |

**Criterios de aceptación:**

```gherkin
Scenario: Cliente nuevo en primer pedido de domicilio
  Given cajero y cliente con phone "3001234567" no registrado
  When envía POST /api/v1/orders con type "delivery" y datos del cliente
  Then recibe status 201
  And se crea automáticamente el customer en DB
  And el pedido tiene status "pending"

Scenario: Cliente existente reconocido por teléfono
  Given cliente registrado con phone "3001234567"
  When se crea pedido delivery con ese phone
  Then el pedido usa el customer existente sin crear uno nuevo
```

**Contrato API:**

`POST /api/v1/orders`

Request:

```json
{
  "type": "delivery",
  "customer": {
    "phone": "3001234567",
    "name": "María García",
    "address": "Calle 15 # 30-40"
  },
  "items": [ { "productId": "uuid", "quantity": 1 } ]
}
```

Response 201: Pedido creado con `customer` incluido.

-----

## UC-07-03: Agregar ítem a pedido

**Actor:** `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Precondiciones:**

- El pedido existe en el tenant con `status = pending`.

**Flujo principal:**

1. Actor envía `POST /orders/:id/items` con el ítem a agregar.
1. Sistema verifica que el pedido esté en `pending`.
1. Si el producto ya existe en el pedido: incrementa `quantity`.
1. Si es nuevo: crea el `order_item` con snapshot de precio.
1. Recalcula `order.total`.

**Excepciones:**

|ID |Condición             |Respuesta                                                            |
|---|----------------------|---------------------------------------------------------------------|
|E01|Pedido no en `pending`|`409` — “No se pueden modificar ítems de un pedido enviado a cocina.”|
|E02|Producto inválido     |`400`                                                                |

**Contrato API:**

`POST /api/v1/orders/:id/items`

Request: `{ "productId": "uuid", "quantity": 1, "notes": "sin sal" }`

Response 200: Pedido actualizado con ítems y nuevo total.

-----

## UC-07-04: Eliminar ítem de pedido

**Actor:** `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Precondiciones:**

- El pedido está en `pending`.
- El ítem existe en el pedido.

**Flujo principal:**

1. Actor envía `DELETE /orders/:id/items/:itemId`.
1. Sistema verifica `status = pending`.
1. Sistema elimina el ítem.
1. Recalcula `order.total`.
1. Si el pedido queda sin ítems: retorna warning pero no elimina el pedido.

**Contrato API:**

`DELETE /api/v1/orders/:id/items/:itemId`

Response 200: Pedido actualizado.

-----

## UC-07-05: Obtener detalle de pedido

**Actor:** Cualquier usuario autenticado del tenant
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo principal:**

1. Actor envía `GET /orders/:id`.
1. Sistema retorna pedido con `items`, `customer` (si delivery), `table` (si local), `statusHistory`, `payments`.

**Excepciones:**

|ID |Condición                                     |Respuesta                           |
|---|----------------------------------------------|------------------------------------|
|E01|No encontrado en tenant                       |`404`                               |
|E02|Rol `kitchen` intenta ver pedido no en su cola|Retorna igualmente (sin restricción)|

**Contrato API:**

`GET /api/v1/orders/:id`

Response 200: Objeto pedido completo con relaciones.

-----

## UC-07-06: Listar pedidos

**Actor:** OW, AD (todos), CA/WA (sus propios activos), KI (activos en cocina), DE (sus asignados)
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo principal:**

1. Actor envía `GET /orders` con filtros.
1. Sistema aplica filtros según rol:
- KI: solo `status IN (pending, in_kitchen)`.
- DE: solo `type = delivery, status IN (assigned, on_the_way, delivered)`.
- CA/WA: filtro libre pero solo dentro del tenant.
1. Soporta filtro por `type`, `status`, `dateFrom`, `dateTo`, `tableId`.

**Contrato API:**

`GET /api/v1/orders?status=pending&type=local&dateFrom=2026-05-01&dateTo=2026-05-19&page=1&limit=20`

Response 200: Wrapper paginado con pedidos (sin `items` en el listado — se obtienen en el detalle).
