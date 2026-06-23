# SPEC-09: Payments

**Descripción:** Registro de pagos para pedidos. Soporta métodos mixtos (efectivo + tarjeta + transferencia). Requiere caja abierta.

**Actores:** `cashier`, `owner`, `admin`

**Entidades:** `payment`, `order`

-----

## UC-09-01: Registrar pago

**Actor:** `cashier`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- El pedido está en `served` (local) o `money_collected` (delivery).
- Existe una `cash_register` con `status = open` en el tenant.

**Flujo principal:**

1. Actor envía `POST /orders/:id/payments` con método y monto.
1. Sistema verifica que haya caja abierta.
1. Sistema calcula el saldo pendiente del pedido: `order.total - Σ(payments.amount)`.
1. Si `method = cash`: calcula `change_amount = amount - pending_balance` (si amount > pending).
1. Sistema crea el `payment`.
1. Si el total pagado cubre `order.total`:
- Pedido `local`: cambia status a `paid`.
- Pedido `delivery`: este UC solo registra el pago; el status de delivery se maneja en SPEC-13.
1. Actualiza `cash_register.total_sales`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                               |Respuesta                                                       |
|---|----------------------------------------|----------------------------------------------------------------|
|E01|Sin caja abierta                        |`409` — “No hay una caja abierta. Abre la caja antes de cobrar.”|
|E02|Pedido no en estado cobrable            |`409` — “El pedido no está en estado de pago.”                  |
|E03|`amount <= 0`                           |`400`                                                           |
|E04|Pago excede el saldo pendiente (no cash)|`400` — “El monto supera el saldo pendiente.”                   |

**Reglas de negocio:**

- RN-24: Solo `method = cash` puede tener `amount > pending_balance` (para dar cambio).
- RN-25: Se pueden registrar múltiples pagos por pedido (ej: mitad efectivo, mitad tarjeta).

**Criterios de aceptación:**

```gherkin
Scenario: Pago total en efectivo con cambio
  Given pedido served con total = 15000 y sin pagos previos
  When cajero envía POST con { method: "cash", amount: 20000 }
  Then recibe status 201
  And payment.change_amount = 5000
  And order.status = "paid"
  And cash_register.total_sales += 15000

Scenario: Pago mixto (efectivo + tarjeta)
  Given pedido con total = 20000
  When se registra payment cash de 10000 y luego card de 10000
  Then el segundo pago completa el cobro
  And order.status = "paid"

Scenario: Sin caja abierta
  Given sin cash_register open en el tenant
  When se intenta registrar un pago
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/orders/:id/payments`

Request:

```json
{ "method": "cash", "amount": 20000, "reference": null }
```

Response 201:

```json
{
  "id": "uuid",
  "method": "cash",
  "amount": 20000,
  "changeAmount": 5000,
  "orderId": "uuid",
  "orderStatus": "paid",
  "registeredAt": "2026-05-19T11:00:00Z"
}
```

-----

## UC-09-02: Completar pedido local (paid → completed)

**Actor:** `cashier`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido `local` en `status = paid`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/complete`.
1. Sistema cambia `status` a `completed`.
1. Sistema libera la mesa: `table.status = available`.
1. Inserta en `order_status_history`. Emite `order:completed`.
1. Registra `status_change` en `audit_log`.

**Criterios de aceptación:**

```gherkin
Scenario: Completar pedido local pagado
  Given pedido local en status "paid" en mesa 5
  When cajero envía PATCH /api/v1/orders/:id/complete
  Then status = "completed"
  And mesa 5 vuelve a status "available"
```

**Contrato API:**

`PATCH /api/v1/orders/:id/complete`

Response 200: `{ "id": "uuid", "status": "completed" }`

-----

## UC-09-03: Completar pedido de domicilio (money_collected → completed)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Pedido `delivery` en `status = money_collected`.

**Flujo principal:**

1. Actor envía `PATCH /orders/:id/complete`.
1. Sistema cambia `status` a `completed`.
1. Sistema libera al repartidor: `delivery_person.status = available`.
1. Registra pago si aún no se ha registrado (en la práctica, el pago se registra en UC-13-06).
1. Inserta en `order_status_history`. Emite `order:completed`.
1. Registra `status_change` en `audit_log`.
