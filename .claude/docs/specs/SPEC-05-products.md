# SPEC-05: Products

**Descripción:** Gestión del catálogo de productos (preparados e ingredientes) con sus recetas, precios, stock y márgenes.

**Actores:** `owner`, `admin` (CRUD), `cashier`/`waiter` (lectura de productos preparados para crear pedidos)

**Entidades:** `product`, `recipe_item`

-----

## UC-05-01: Crear producto no preparado (ingrediente)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /products` con `type = "unprepared"`.
1. Sistema valida que `name` sea único en el tenant.
1. Sistema crea el producto con `current_stock = 0` y `status = active`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                         |Respuesta            |
|---|----------------------------------|---------------------|
|E01|Nombre duplicado en el tenant     |`409`                |
|E02|`unitId` no existe                |`400`                |
|E03|`type = prepared` en este endpoint|`400` — Usar UC-05-02|

**Criterios de aceptación:**

```gherkin
Scenario: Crear ingrediente exitosamente
  Given owner autenticado
  When envía POST /api/v1/products con { name: "Harina", type: "unprepared", unitId: "uuid-g", minimumStock: 500, purchasePrice: 2.50 }
  Then recibe status 201
  And el producto tiene current_stock = 0

Scenario: Nombre duplicado
  Given un producto "Harina" ya existe en el tenant
  When se intenta crear otro con el mismo nombre
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/products`

Request:

```json
{
  "name": "Harina de trigo",
  "type": "unprepared",
  "unitId": "uuid-gram",
  "minimumStock": 500,
  "purchasePrice": 2.50,
  "description": "Harina todo uso"
}
```

Response 201: Objeto producto con `unit` incluido (eager load).

-----

## UC-05-02: Crear producto preparado (con receta)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /products` con `type = "prepared"`.
1. Sistema valida que `sale_price` esté presente.
1. Sistema crea el producto base.
1. Si se incluye `recipe`, sistema crea los `recipe_item` asociados:
- Verifica que cada `ingredientId` sea un producto `unprepared` del mismo tenant.
- Verifica que cada `unitId` exista y que haya conversión disponible si difiere de la unidad base del ingrediente.
1. Calcula y retorna `calculatedCost`, `suggestedPrice` y `actualMargin`.
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                                     |Respuesta                                              |
|---|----------------------------------------------|-------------------------------------------------------|
|E01|`salePrice` ausente                           |`400`                                                  |
|E02|Ingrediente no encontrado o no es `unprepared`|`400`                                                  |
|E03|Sin conversión disponible entre unidades      |`400` — “No existe conversión entre [unitA] y [unitB].”|
|E04|Nombre duplicado                              |`409`                                                  |

**Criterios de aceptación:**

```gherkin
Scenario: Crear producto preparado con receta
  Given owner y productos unprepared existentes
  When envía POST /api/v1/products con tipo prepared, salePrice y recipe
  Then recibe status 201
  And el body incluye calculatedCost, suggestedPrice, actualMargin
  And los recipe_items quedan vinculados

Scenario: Ingrediente de tipo prepared en la receta
  When incluye en recipe un producto de tipo prepared
  Then recibe status 400
```

**Contrato API:**

`POST /api/v1/products`

Request:

```json
{
  "name": "Arepa con queso",
  "type": "prepared",
  "unitId": "uuid-unit",
  "salePrice": 5000,
  "desiredMargin": 60,
  "description": "Arepa tradicional",
  "recipe": [
    { "ingredientId": "uuid-harina", "quantity": 100, "unitId": "uuid-gram" },
    { "ingredientId": "uuid-queso", "quantity": 50, "unitId": "uuid-gram" }
  ]
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Arepa con queso",
  "type": "prepared",
  "salePrice": 5000,
  "calculatedCost": 1250,
  "suggestedPrice": 3125,
  "actualMargin": 75,
  "recipe": [...]
}
```

-----

## UC-05-03: Listar productos

**Actor:** OW, AD (todos los productos), CA / WA (solo `prepared` y `active`)
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `GET /products` con filtros opcionales.
1. Sistema aplica filtro de tenant automáticamente.
1. CA/WA ven automáticamente solo productos `type = prepared, status = active`.
1. OW/AD pueden filtrar por `type`, `status`, `categoryId`, `search` (nombre).

**Criterios de aceptación:**

```gherkin
Scenario: Cajero lista productos preparados
  Given un cajero autenticado
  When envía GET /api/v1/products
  Then solo recibe productos { type: "prepared", status: "active" }

Scenario: Admin lista todos los productos
  Given un admin autenticado
  When envía GET /api/v1/products
  Then recibe productos de todos los tipos y estados
```

**Contrato API:**

`GET /api/v1/products?type=prepared&status=active&categoryId=uuid&search=arepa&page=1&limit=20`

Response 200: Wrapper paginado con productos. Incluye `calculatedCost`, `actualMargin` para `prepared`.

-----

## UC-05-04: Obtener producto por ID

**Actor:** OW, AD, CA, WA
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `GET /products/:id`.
1. Sistema retorna el producto con su `recipe` (ingredientes) si es `prepared`.
1. Para `prepared`: incluye `calculatedCost`, `suggestedPrice`, `actualMargin`.

**Excepciones:**

|ID |Condición                            |Respuesta|
|---|-------------------------------------|---------|
|E01|No encontrado en el tenant           |`404`    |
|E02|CA/WA intenta ver producto `inactive`|`404`    |

**Contrato API:**

`GET /api/v1/products/:id`

Response 200: Producto completo con `recipe` (eager load), `unit`, `categories`.

-----

## UC-05-05: Actualizar producto

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /products/:id` con campos a modificar.
1. Si se actualiza `recipe`: el sistema reemplaza todos los `recipe_item` existentes con los nuevos (replace, no merge).
1. Recalcula `calculatedCost`, `suggestedPrice`, `actualMargin`.
1. Registra `update` con `{ before, after }` en `audit_log`.

**Reglas de negocio:**

- RN-16: No se puede cambiar el `type` de un producto existente.
- RN-17: Cambiar `purchasePrice` de un ingrediente actualiza los `calculatedCost` de los productos preparados que lo usan (recalculado on-read, no afecta valores almacenados).

**Criterios de aceptación:**

```gherkin
Scenario: Actualizar precio de venta
  Given admin y un producto prepared
  When envía PATCH /api/v1/products/:id con { salePrice: 6000 }
  Then recibe status 200
  And salePrice = 6000
  And actualMargin se recalcula

Scenario: Actualizar receta completa
  When envía PATCH con nuevo array recipe
  Then los recipe_items anteriores son eliminados y reemplazados por los nuevos
```

**Contrato API:**

`PATCH /api/v1/products/:id`

Request: Subconjunto de campos, incluyendo `recipe` opcional (array completo = replace).

Response 200: Producto actualizado con campos calculados.

-----

## UC-05-06: Cambiar estado del producto

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /products/:id/status`.
1. Sistema actualiza `status` (soft delete si `inactive`).
1. Registra `status_change` en `audit_log`.

**Reglas de negocio:**

- RN-18: Un producto `inactive` no aparece en la lista de pedidos para CA/WA.
- RN-19: Un ingrediente `inactive` que es parte de una receta activa genera un warning en el response (no bloquea).

**Criterios de aceptación:**

```gherkin
Scenario: Desactivar producto
  Given admin y un producto prepared activo
  When envía PATCH /api/v1/products/:id/status con { status: "inactive" }
  Then el producto tiene status "inactive"
  And no aparece en listados de CA/WA

Scenario: Desactivar ingrediente usado en receta activa
  Given un ingrediente usado en la receta de un producto activo
  When se desactiva el ingrediente
  Then recibe status 200 con warning: "Este ingrediente está en recetas activas."
```

**Contrato API:**

`PATCH /api/v1/products/:id/status`

Request: `{ "status": "inactive" }`

Response 200: `{ "id": "uuid", "status": "inactive", "warnings": [] }`

-----

## UC-05-07: Gestionar receta de un producto preparado

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal (agregar/actualizar ingrediente):**

1. Actor envía `PUT /products/:id/recipe` con el array completo de ingredientes.
1. Sistema valida cada ingrediente.
1. Sistema reemplaza toda la receta (transacción atómica: DELETE + INSERT).
1. Retorna el producto con la receta actualizada y métricas recalculadas.

**Flujo alternativo (eliminar ingrediente individual):**

1. Actor envía `DELETE /products/:id/recipe/:ingredientId`.
1. Sistema elimina solo ese `recipe_item`.

**Criterios de aceptación:**

```gherkin
Scenario: Reemplazar receta completa
  Given admin y producto prepared con 3 ingredientes
  When envía PUT /api/v1/products/:id/recipe con 2 ingredientes nuevos
  Then la receta tiene exactamente esos 2 ingredientes
  And calculatedCost se recalcula

Scenario: Eliminar un ingrediente de la receta
  When envía DELETE /api/v1/products/:id/recipe/:ingredientId
  Then ese ingrediente se elimina de la receta
  And los demás se mantienen
```

**Contrato API:**

`PUT /api/v1/products/:id/recipe`

Request: `[ { "ingredientId": "uuid", "quantity": 100, "unitId": "uuid" } ]`

Response 200: Producto con receta actualizada y `calculatedCost`.

`DELETE /api/v1/products/:id/recipe/:ingredientId` → Response 200.
