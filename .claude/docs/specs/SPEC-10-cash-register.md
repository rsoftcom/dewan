# SPEC-10: Cash Register

**Descripción:** Gestión de la caja diaria del negocio. Solo puede existir una caja abierta por tenant a la vez.

**Actores:** `owner`, `admin`, `cashier`

**Entidades:** `cash_register`

-----

## UC-10-01: Abrir caja

**Actor:** `cashier`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- No existe `cash_register` con `status = open` para el tenant (índice parcial DB garantiza unicidad).

**Flujo principal:**

1. Actor envía `POST /cash-registers` con `initialAmount` y `openNotes` opcionales.
1. Sistema verifica que no haya caja abierta.
1. Sistema crea la caja con `status = open`, `date = today`, `total_sales = 0`, etc.
1. Registra evento `open` en `audit_log`.

**Excepciones:**

|ID |Condición             |Respuesta                                     |
|---|----------------------|----------------------------------------------|
|E01|Ya existe caja abierta|`409` — “Ya existe una caja abierta para hoy.”|
|E02|`initialAmount < 0`   |`400`                                         |

**Criterios de aceptación:**

```gherkin
Scenario: Abrir caja exitosamente
  Given no hay caja abierta en el tenant
  When cajero envía POST /api/v1/cash-registers con { initialAmount: 50000 }
  Then recibe status 201 con caja en status "open"

Scenario: Intentar abrir segunda caja
  Given ya existe una caja abierta
  When se intenta abrir otra
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/cash-registers`

Request: `{ "initialAmount": 50000, "openNotes": "Inicio de turno mañana" }`

Response 201:

```json
{
  "id": "uuid",
  "status": "open",
  "date": "2026-05-19",
  "initialAmount": 50000,
  "totalSales": 0,
  "totalIncome": 0,
  "totalExpense": 0,
  "openedAt": "2026-05-19T08:00:00Z",
  "openedBy": { "id": "uuid", "name": "Juan" }
}
```

-----

## UC-10-02: Cerrar caja

**Actor:** `cashier`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA

**Precondiciones:**

- Existe caja abierta en el tenant.
- No hay pedidos activos (status != `completed`, `rejected`) — WARNING, no bloqueo.

**Flujo principal:**

1. Actor envía `PATCH /cash-registers/current/close` con `finalAmount`.
1. Sistema calcula `difference = finalAmount - (initialAmount + totalSales + totalIncome - totalExpense)`.
1. Sistema cambia `status = closed`, guarda `finalAmount`, `difference`, `closedAt`, `closedBy`.
1. Registra evento `close` en `audit_log`.

**Excepciones:**

|ID |Condición                |Respuesta                       |
|---|-------------------------|--------------------------------|
|E01|Sin caja abierta         |`404` — “No hay caja abierta.”  |
|E02|`finalAmount < 0`        |`400`                           |
|E03|Pedidos activos al cierre|Warning en response (no bloquea)|

**Criterios de aceptación:**

```gherkin
Scenario: Cierre exitoso con diferencia cero
  Given caja con initialAmount=50000, totalSales=200000, totalExpense=30000
  When cajero envía PATCH con { finalAmount: 220000 }
  Then difference = 220000 - (50000 + 200000 - 30000) = 0
  And caja queda en status "closed"

Scenario: Diferencia negativa (faltante)
  Given finalAmount menor al esperado
  When cierra la caja
  Then difference < 0 (registrado como faltante)
  And recibe status 200 con el reporte final
```

**Contrato API:**

`PATCH /api/v1/cash-registers/current/close`

Request: `{ "finalAmount": 220000, "closeNotes": "Todo cuadró" }`

Response 200:

```json
{
  "id": "uuid",
  "status": "closed",
  "initialAmount": 50000,
  "totalSales": 200000,
  "totalIncome": 5000,
  "totalExpense": 30000,
  "finalAmount": 220000,
  "difference": -5000,
  "closedAt": "2026-05-19T22:00:00Z",
  "warnings": []
}
```

-----

## UC-10-03: Obtener estado actual de caja

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA

**Flujo principal:**

1. Actor envía `GET /cash-registers/current`.
1. Sistema retorna la caja con `status = open` del tenant, incluyendo totales actuales.
1. Si no hay caja abierta: retorna `404` con indicación.

**Contrato API:**

`GET /api/v1/cash-registers/current`

Response 200: Objeto de caja abierta con totales en tiempo real.
Response 404: `{ "message": "No hay caja abierta actualmente." }`
