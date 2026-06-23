# SPEC-16: Inventory

**Descripción:** Ajustes manuales de inventario para correcciones, pérdidas, mermas o conteos físicos.

**Actores:** `owner`, `admin`

**Entidades:** `inventory_adjustment`, `product`

-----

## UC-16-01: Crear ajuste de inventario

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /inventory/adjustments` con `productId`, `type`, `quantity` y `reason`.
1. Sistema valida que el producto pertenece al tenant.
1. Sistema aplica el ajuste al `current_stock`:
- `entry` (entrada): `stock += quantity`.
- `exit` (salida): `stock -= quantity`.
1. Si la salida resulta en stock negativo: genera warning pero no bloquea.
1. Crea el `inventory_adjustment`. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición             |Respuesta|
|---|----------------------|---------|
|E01|Producto no encontrado|`404`    |
|E02|`quantity <= 0`       |`400`    |
|E03|`reason` vacía        |`400`    |

**Reglas de negocio:**

- RN-30: Los ajustes son inmutables. Una corrección requiere un nuevo ajuste en sentido contrario.
- RN-31: La cantidad siempre es positiva; el `type` indica la dirección.

**Criterios de aceptación:**

```gherkin
Scenario: Ajuste de entrada por merma recuperada
  Given admin y harina con stock = 1000g
  When envía POST /api/v1/inventory/adjustments con { productId: "uuid", type: "entry", quantity: 500, reason: "Conteo físico - diferencia" }
  Then recibe status 201
  And harina.current_stock = 1500g

Scenario: Ajuste de salida que genera stock negativo
  Given queso con current_stock = 50g
  When envía exit de 100g con reason "Merma por caducidad"
  Then recibe status 201 con warning: "El stock quedó negativo: -50g."
  And queso.current_stock = -50g (registra la realidad)

Scenario: Reason vacía
  When envía ajuste sin reason
  Then recibe status 400
```

**Contrato API:**

`POST /api/v1/inventory/adjustments`

Request:

```json
{
  "productId": "uuid-harina",
  "type": "exit",
  "quantity": 100,
  "reason": "Merma por humedad"
}
```

Response 201:

```json
{
  "id": "uuid",
  "productId": "uuid-harina",
  "type": "exit",
  "quantity": 100,
  "reason": "Merma por humedad",
  "previousStock": 1500,
  "newStock": 1400,
  "warnings": [],
  "adjustedAt": "2026-05-19T11:00:00Z"
}
```

-----

## UC-16-02: Listar ajustes de inventario

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /inventory/adjustments` con filtros opcionales.
1. Soporta filtro por `productId`, `type`, `dateFrom`, `dateTo`.

**Contrato API:**

`GET /api/v1/inventory/adjustments?productId=uuid&type=exit&dateFrom=2026-05-01&page=1&limit=20`

Response 200: Wrapper paginado con ajustes.

-----

## UC-16-03: Listar productos con stock bajo

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD, (CA — solo visualización básica)

**Flujo principal:**

1. Actor envía `GET /inventory/low-stock`.
1. Sistema retorna productos donde `current_stock < minimum_stock`.
1. Para ingredientes (`unprepared`): incluye lista de productos `prepared` que dependen de ellos.

**Criterios de aceptación:**

```gherkin
Scenario: Listar ingredientes bajo mínimo
  Given harina con current_stock = 200g y minimum_stock = 500g
  When envía GET /api/v1/inventory/low-stock
  Then la respuesta incluye harina con los productos prepared que la usan

Scenario: Sin productos bajo mínimo
  Given todos los productos con stock >= minimum_stock
  When envía GET /api/v1/inventory/low-stock
  Then retorna array vacío
```

**Contrato API:**

`GET /api/v1/inventory/low-stock`

Response 200:

```json
[
  {
    "id": "uuid-harina",
    "name": "Harina de trigo",
    "type": "unprepared",
    "currentStock": 200,
    "minimumStock": 500,
    "unit": "g",
    "deficit": -300,
    "affectedProducts": [
      { "id": "uuid-arepa", "name": "Arepa con queso" }
    ]
  }
]
```
