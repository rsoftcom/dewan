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

---

## UC-11-03: Consultar movimientos de cajas históricas

**Actor:** `owner`, `admin`, `cashier`
**Roles permitidos:** OW, AD, CA

**Descripción:** Permite ver los movimientos de cajas ya cerradas sin necesidad de que haya una caja abierta. El selector de caja en la pantalla de movimientos muestra todas las cajas del tenant (activa + históricas) ordenadas de más reciente a más antigua.

**Flujo principal:**

1. Usuario abre la pantalla de movimientos.
2. Frontend llama `GET /cash-registers?page=1&limit=50` para cargar el historial de cajas.
3. Se muestra un dropdown con las cajas ordenadas por fecha DESC. La caja abierta (si existe) aparece primero con el indicador "● Abierta"; las cerradas con "○ Cerrada".
4. Al seleccionar una caja, el frontend llama:
   - Si la caja está abierta: `GET /movements?current=true&page=1&limit=20`.
   - Si la caja está cerrada: `GET /movements?cashRegisterId=<id>&page=1&limit=20`.
5. La tabla muestra los movimientos de la caja seleccionada.
6. El botón "Nuevo movimiento" solo aparece cuando la caja seleccionada está **abierta**. Las cajas cerradas son de solo lectura (se muestra el badge "Solo lectura").

**Reglas de negocio:**

- RN-26: Las cajas cerradas son inmutables. El frontend no permite agregar movimientos a una caja con `status = 'closed'`.
- El dropdown carga hasta 50 cajas. Para tenants con más historial, se puede extender el `limit`.

**Criterios de aceptación:**

```gherkin
Scenario: Consultar movimientos de una caja cerrada sin caja abierta
  Given no hay caja abierta
  And existe historial de 3 cajas cerradas
  When el usuario abre la pantalla de movimientos
  Then ve el dropdown con las 3 cajas (más reciente seleccionada)
  And puede navegar entre cajas y ver sus movimientos
  And el botón "Nuevo movimiento" no aparece

Scenario: Cambiar de caja activa a histórica
  Given hay una caja abierta (seleccionada por defecto)
  When el usuario selecciona una caja cerrada del dropdown
  Then la tabla muestra los movimientos de esa caja
  And aparece el badge "Solo lectura"
  And desaparece el botón "Nuevo movimiento"
```

**Nuevo endpoint backend (UC-10-04):**

`GET /api/v1/cash-registers?page=1&limit=50`

Response 200: Wrapper paginado de cajas, ordenadas por `openedAt DESC`.

**Archivos afectados:**

- `dewan-backend/modules/cash-registers/cash-registers.service.ts` — nuevo método `findAll()`
- `dewan-backend/modules/cash-registers/cash-registers.controller.ts` — nuevo `@Get()`
- `dewan-frontend/features/cash-registers/services/cash-registers.service.ts` — nuevo método `findAll()`
- `dewan-frontend/features/cash-registers/models/cash-register.model.ts` — nuevo tipo `CashRegisterListResponse`
- `dewan-frontend/features/movements/pages/movement-list.component.ts` — selector de caja, lógica de historial
