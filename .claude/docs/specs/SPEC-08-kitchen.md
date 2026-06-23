# SPEC-08: Kitchen

**Descripción:** Vista en tiempo real para el personal de cocina. Reciben pedidos, gestionan su estado y comunican disponibilidad al salón.

**Actores:** `kitchen`, `owner`, `admin`

**Entidades:** `order`, `order_status_history`

-----

## UC-08-01: Ver cola de pedidos (kitchen view)

**Actor:** `kitchen`
**Roles permitidos:** KI, OW, AD

**Flujo principal:**

1. Actor envía `GET /kitchen/orders`.
1. Sistema retorna pedidos en `status = pending` u `in_kitchen` del tenant, ordenados por `created_at` ASC (FIFO).
1. Incluye `items` con nombre de producto y cantidad.
1. El frontend también suscribe al canal WebSocket `kitchen_[tenantId]` para recibir nuevos pedidos en tiempo real.

**Criterios de aceptación:**

```gherkin
Scenario: Kitchen recibe pedidos en tiempo real
  Given personal de cocina conectado al WebSocket
  When un cajero crea un nuevo pedido
  Then la cocina recibe evento "order:new" con los datos del pedido
  And el pedido aparece en la cola

Scenario: Cola FIFO
  Given tres pedidos pendientes creados en orden A, B, C
  When kitchen solicita GET /api/v1/kitchen/orders
  Then el pedido A es el primero en la lista
```

**Contrato API:**

`GET /api/v1/kitchen/orders`

Response 200:

```json
[
  {
    "id": "uuid",
    "type": "local",
    "status": "pending",
    "tableId": "uuid",
    "tableName": "Mesa 3",
    "createdAt": "...",
    "items": [
      { "productName": "Arepa con queso", "quantity": 2, "notes": "Sin sal" }
    ]
  }
]
```

**WebSocket:**

- Canal: `kitchen_[tenantId]`
- Eventos recibidos: `order:new` (nuevo pedido), `order:updated` (cambio de estado)

-----

## UC-08-02: Aceptar pedido (pending → in_kitchen)

**Actor:** `kitchen`
**Roles permitidos:** KI, OW, AD

**Precondiciones:**

- Pedido en `status = pending`.

**Flujo principal:**

1. Actor envía `PATCH /kitchen/orders/:id/accept`.
1. Sistema cambia `order.status` a `in_kitchen`.
1. Sistema descuenta stock automáticamente por cada `recipe_item` de cada producto en el pedido:
- `ingredient.current_stock -= (recipe_item.quantity × order_item.quantity)` (conversión de unidades si aplica).
1. Sistema inserta registro en `order_status_history`.
1. Sistema emite evento `order:updated` a sala `kitchen_[tenantId]` y `orders_[tenantId]`.
1. Sistema verifica si algún ingrediente queda bajo `minimum_stock` → emite notificación `low_stock` a OW/AD.
1. Registra `status_change` en `audit_log`.

**Excepciones:**

|ID |Condición             |Respuesta                                                                                         |
|---|----------------------|--------------------------------------------------------------------------------------------------|
|E01|Pedido no en `pending`|`409` — “Solo se pueden aceptar pedidos pendientes.”                                              |
|E02|Stock insuficiente    |Acepta el pedido con warning: “Stock insuficiente de [ingrediente]. Stock actual: X.” (no bloquea)|

**Reglas de negocio:**

- RN-22: El descuento de stock es irreversible al aceptar. Errores se corrigen con `inventory_adjustment`.
- RN-23: Stock negativo genera warning pero no bloquea (refleja la realidad operativa).

**Criterios de aceptación:**

```gherkin
Scenario: Aceptar pedido exitosamente
  Given pedido en status pending con 2 arepas (receta: 100g harina, 50g queso c/u)
  When kitchen envía PATCH /api/v1/kitchen/orders/:id/accept
  Then status cambia a "in_kitchen"
  And harina.current_stock -= 200g
  And queso.current_stock -= 100g
  And se emiten eventos WebSocket

Scenario: Ingrediente queda bajo mínimo tras aceptar
  Given harina con current_stock = 250g y minimum_stock = 500g
  When se acepta un pedido que usa 200g de harina
  Then se crea notificación low_stock para owner/admin
```

**Contrato API:**

`PATCH /api/v1/kitchen/orders/:id/accept`

Response 200:

```json
{
  "id": "uuid",
  "status": "in_kitchen",
  "warnings": ["Stock insuficiente de Harina. Stock actual: -50g."]
}
```

-----

## UC-08-03: Marcar pedido como preparado (in_kitchen → prepared)

**Actor:** `kitchen`
**Roles permitidos:** KI, OW, AD

**Precondiciones:**

- Pedido en `status = in_kitchen`.

**Flujo principal:**

1. Actor envía `PATCH /kitchen/orders/:id/ready`.
1. Sistema cambia `status` a `prepared`.
1. Inserta en `order_status_history`.
1. Emite evento `order:ready` a sala `orders_[tenantId]`:
- Para pedidos `local`: notifica al mesero/cajero que el pedido está listo.
- Para pedidos `delivery`: notifica para asignación de repartidor.
1. Registra `status_change` en `audit_log`.

**Criterios de aceptación:**

```gherkin
Scenario: Marcar como preparado
  Given pedido en status in_kitchen
  When kitchen envía PATCH /api/v1/kitchen/orders/:id/ready
  Then status = "prepared"
  And frontend del salón recibe evento order:ready
```

**Contrato API:**

`PATCH /api/v1/kitchen/orders/:id/ready`

Response 200: `{ "id": "uuid", "status": "prepared" }`

-----

## UC-08-04: Rechazar pedido

**Actor:** `kitchen`
**Roles permitidos:** KI, OW, AD

**Precondiciones:**

- Pedido en `status = pending` o `in_kitchen`.

**Flujo principal:**

1. Actor envía `PATCH /kitchen/orders/:id/reject` con `rejectionReason`.
1. Sistema cambia `status` a `rejected` y guarda `rejection_reason`.
1. Si el pedido estaba en `in_kitchen`: el stock ya fue descontado → no se revierte automáticamente. El sistema crea automáticamente `inventory_adjustment` de tipo `entry` para cada ingrediente afectado, con reason “Pedido rechazado #[orderId]”.
1. Para pedidos `local`: libera la mesa (`table.status = available`).
1. Inserta en `order_status_history`. Emite `order:rejected`.
1. Registra `status_change` en `audit_log`.

**Excepciones:**

|ID |Condición                             |Respuesta                                     |
|---|--------------------------------------|----------------------------------------------|
|E01|Sin `rejectionReason`                 |`400` — “El motivo de rechazo es obligatorio.”|
|E02|Pedido no en `pending` ni `in_kitchen`|`409`                                         |

**Criterios de aceptación:**

```gherkin
Scenario: Rechazar pedido en pending
  Given pedido local en status pending en mesa 3
  When kitchen envía PATCH reject con { rejectionReason: "Sin gas" }
  Then status = "rejected"
  And mesa 3 vuelve a status "available"
  And NO se crean inventory_adjustments (el stock no fue descontado)

Scenario: Rechazar pedido en in_kitchen
  Given pedido en status in_kitchen (stock ya descontado)
  When kitchen rechaza el pedido
  Then se crean inventory_adjustments de tipo entry para reponer el stock
```

**Contrato API:**

`PATCH /api/v1/kitchen/orders/:id/reject`

Request: `{ "rejectionReason": "Sin ingredientes disponibles" }`

Response 200: `{ "id": "uuid", "status": "rejected", "rejectionReason": "..." }`

-----

## UC-08-05: Marcar pedido local como servido (prepared → served)

**Actor:** `waiter`, `cashier`
**Roles permitidos:** OW, AD, CA, WA

**Precondiciones:**

- Pedido `local` en `status = prepared`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/serve`.
1. Sistema verifica `type = local` y `status = prepared`.
1. Cambia `status` a `served`.
1. Inserta en `order_status_history`. Emite `order:served`.
1. Registra `status_change` en `audit_log`.

**Criterios de aceptación:**

```gherkin
Scenario: Marcar como servido
  Given pedido local en status prepared
  When mesero envía PATCH /api/v1/orders/:id/serve
  Then status = "served"
  And cliente puede pedir la cuenta
```

**Contrato API:**

`PATCH /api/v1/orders/:id/serve`

Response 200: `{ "id": "uuid", "status": "served" }`
