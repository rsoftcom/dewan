# SPEC-11: Movements

**Descripción:** Registro de ingresos, egresos y costos que no son ventas directas. Siempre asociados a una caja abierta.

**Actores:** `cashier`, `owner`, `admin`

**Entidades:** `movement`

-----

## UC-11-01: Crear movimiento

**Actor:** `cashier`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Existe caja abierta en el tenant.

**Flujo principal:**

1. Actor envía `POST /movements` con `type`, `amount`, `description` y `reference` opcional.
1. Sistema verifica que haya caja abierta.
1. Sistema crea el movimiento vinculado a la caja activa.
1. Sistema actualiza totales de la caja:
- `income`: suma a `cash_register.total_income`.
- `expense` o `cost`: suma a `cash_register.total_expense`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición          |Respuesta                                                    |
|---|-------------------|-------------------------------------------------------------|
|E01|Sin caja abierta   |`409` — “No hay una caja abierta para registrar movimientos.”|
|E02|`amount <= 0`      |`400`                                                        |
|E03|`description` vacía|`400`                                                        |

**Reglas de negocio:**

- RN-26: Los movimientos son inmutables. No se pueden editar ni eliminar. Las correcciones se hacen con movimientos contrarios.

**Criterios de aceptación:**

```gherkin
Scenario: Registrar egreso por compra de gas
  Given caja abierta con total_expense = 0
  When cajero envía POST /api/v1/movements con { type: "expense", amount: 30000, description: "Compra de gas doméstico" }
  Then recibe status 201
  And cash_register.total_expense = 30000

Scenario: Registrar ingreso por cobro de deuda
  When envía POST con { type: "income", amount: 50000, description: "Cobro a cliente Pedro" }
  Then cash_register.total_income += 50000

Scenario: Sin caja abierta
  When se intenta crear movimiento sin caja
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/movements`

Request:

```json
{
  "type": "expense",
  "amount": 30000,
  "description": "Compra de gas doméstico",
  "reference": "REF-001"
}
```

Response 201:

```json
{
  "id": "uuid",
  "type": "expense",
  "amount": 30000,
  "description": "Compra de gas doméstico",
  "cashRegisterId": "uuid",
  "createdAt": "2026-05-19T10:30:00Z"
}
```

-----

## UC-11-02: Listar movimientos de una caja

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Flujo principal:**

1. Actor envía `GET /movements?cashRegisterId=uuid` o `GET /movements?current=true`.
1. Sistema retorna movimientos filtrados por caja, con filtros opcionales por `type`.

**Contrato API:**

`GET /api/v1/movements?cashRegisterId=uuid&type=expense&page=1&limit=50`

Response 200: Wrapper paginado con movimientos.
