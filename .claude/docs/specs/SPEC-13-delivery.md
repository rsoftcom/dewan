# SPEC-13: Delivery

**Descripción:** Gestión de repartidores y el flujo de estados de los pedidos de domicilio desde que salen de cocina hasta que el dinero llega al local.

**Actores:** `owner`, `admin` (asignación y gestión), `cashier` (cobro), personal de delivery (sin login en MVP)

**Entidades:** `delivery_person`, `order`

-----

## UC-13-01: Crear repartidor

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /delivery-persons` con `name` y `phone`.
1. Sistema crea el repartidor con `status = available`.
1. Registra `create` en `audit_log`.

**Contrato API:**

`POST /api/v1/delivery-persons`

Request: `{ "name": "Luis Martínez", "phone": "3001112222" }`

Response 201: `{ "id": "uuid", "name": "Luis Martínez", "phone": "3001112222", "status": "available" }`

-----

## UC-13-02: Listar repartidores

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Flujo principal:**

1. Actor envía `GET /delivery-persons`.
1. Sistema retorna repartidores del tenant con su `status` actual.
1. Soporta filtro `?status=available`.

**Contrato API:**

`GET /api/v1/delivery-persons?status=available`

Response 200: Array de repartidores.

-----

## UC-13-03: Asignar repartidor a pedido (prepared → assigned)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido `delivery` en `status = prepared`.
- Repartidor con `status = available`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/assign` con `deliveryPersonId`.
1. Sistema verifica precondiciones.
1. Sistema cambia `order.status` a `assigned` y asigna `delivery_person_id`.
1. Sistema cambia `delivery_person.status` a `on_delivery`.
1. Inserta en `order_status_history`. Emite `order:assigned`.
1. Registra `status_change` en `audit_log`.

**Excepciones:**

|ID |Condición                               |Respuesta                                           |
|---|----------------------------------------|----------------------------------------------------|
|E01|Pedido no en `prepared`                 |`409`                                               |
|E02|Repartidor no disponible (`on_delivery`)|`409` — “El repartidor ya tiene un pedido en curso.”|
|E03|Repartidor no pertenece al tenant       |`404`                                               |

**Criterios de aceptación:**

```gherkin
Scenario: Asignación exitosa
  Given pedido delivery en prepared y repartidor Luis disponible
  When admin envía PATCH /api/v1/orders/:id/assign con { deliveryPersonId: "uuid-luis" }
  Then order.status = "assigned"
  And luis.status = "on_delivery"

Scenario: Repartidor ya tiene pedido
  Given repartidor Luis en status "on_delivery"
  When se intenta asignarlo a otro pedido
  Then recibe status 409
```

**Contrato API:**

`PATCH /api/v1/orders/:id/assign`

Request: `{ "deliveryPersonId": "uuid-luis" }`

Response 200: `{ "id": "uuid", "status": "assigned", "deliveryPersonId": "uuid-luis" }`

-----

## UC-13-04: Marcar pedido en camino (assigned → on_the_way)

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido `delivery` en `status = assigned`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/on-the-way`.
1. Sistema cambia `status` a `on_the_way`.
1. Inserta en `order_status_history`. Emite `order:on_the_way`.

**Contrato API:**

`PATCH /api/v1/orders/:id/on-the-way`

Response 200: `{ "id": "uuid", "status": "on_the_way" }`

-----

## UC-13-05: Marcar pedido entregado (on_the_way → delivered)

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido en `status = on_the_way`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/delivered`.
1. Sistema cambia `status` a `delivered`.
1. Inserta en `order_status_history`.

**Contrato API:**

`PATCH /api/v1/orders/:id/delivered`

Response 200: `{ "id": "uuid", "status": "delivered" }`

-----

## UC-13-06: Registrar dinero entregado (delivered → money_collected)

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido en `status = delivered`.
- Existe caja abierta.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/money-collected`.
1. Sistema verifica caja abierta.
1. Sistema registra el pago (`payment`) con el monto del pedido y `method = cash` (u otro si se indica).
1. Sistema cambia `order.status` a `money_collected`.
1. Sistema libera repartidor: `delivery_person.status = available`.
1. Actualiza `cash_register.total_sales`.
1. Inserta en `order_status_history`. Emite `order:money_collected`.
1. Registra `status_change` en `audit_log`.

**Excepciones:**

|ID |Condición       |Respuesta|
|---|----------------|---------|
|E01|Sin caja abierta|`409`    |

**Criterios de aceptación:**

```gherkin
Scenario: Registrar dinero entregado
  Given pedido delivery en status delivered, caja abierta, repartidor Luis on_delivery
  When cajero envía PATCH /api/v1/orders/:id/money-collected con { method: "cash" }
  Then order.status = "money_collected"
  And luis.status = "available"
  And cash_register.total_sales aumenta
  And se puede llamar UC-09-03 para completar el pedido
```

**Contrato API:**

`PATCH /api/v1/orders/:id/money-collected`

Request: `{ "method": "cash" }` (o `card`, `transfer`)

Response 200: `{ "id": "uuid", "status": "money_collected" }`
