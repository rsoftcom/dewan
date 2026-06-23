# SPEC-15: Purchases

**Descripción:** Registro de compras de ingredientes a proveedores. Actualiza el stock automáticamente al confirmar.

**Actores:** `owner`, `admin`

**Entidades:** `purchase`, `purchase_item`

-----

## UC-15-01: Registrar compra

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Precondiciones:**

- El proveedor existe y está `active`.
- Todos los productos en la compra son `unprepared` y `active`.

**Flujo principal:**

1. Actor envía `POST /purchases` con `supplierId`, `items[]` y `notes` opcionales.
1. Sistema valida cada ítem:
- Producto existe, es `unprepared` y pertenece al tenant.
- `unitId` existe y hay conversión disponible hacia la unidad base del producto.
1. Sistema calcula `subtotal` de cada ítem: `quantity × unitPrice`.
1. Sistema calcula `purchase.total = Σ(subtotal)`.
1. En transacción atómica:
- Crea el `purchase` y todos los `purchase_items`.
- Por cada ítem, incrementa `product.current_stock`:
  `stock += quantity × conversion_factor` (convertido a unidad base del producto).
- Actualiza `product.purchase_price` con el `unitPrice` de la compra (convertido a unidad base).
1. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                         |Respuesta                                                           |
|---|----------------------------------|--------------------------------------------------------------------|
|E01|Proveedor no encontrado o inactivo|`400`                                                               |
|E02|Producto `prepared` en la compra  |`400` — “Solo se pueden comprar ingredientes (tipo unprepared).”    |
|E03|Sin conversión entre unidades     |`400` — “No existe conversión de [unitA] a [unitB] para [producto].”|
|E04|Sin ítems en la compra            |`400`                                                               |
|E05|`quantity` o `unitPrice` <= 0     |`400`                                                               |

**Reglas de negocio:**

- RN-28: Las compras son inmutables tras su creación. Las correcciones se hacen con `inventory_adjustment`.
- RN-29: `product.purchase_price` se actualiza con la estrategia “último precio” (sobrescribe con el nuevo).

**Criterios de aceptación:**

```gherkin
Scenario: Registrar compra exitosa
  Given admin, proveedor activo, harina (unidad: g, stock actual: 500)
  When envía POST /api/v1/purchases con { supplierId: "uuid", items: [{ productId: "uuid-harina", quantity: 5, unitId: "uuid-kg", unitPrice: 3500 }] }
  Then recibe status 201
  And harina.current_stock = 500 + (5 × 1000) = 5500g (conversión kg→g)
  And harina.purchase_price = 3500 / 1000 = 3.50 (por gramo)
  And purchase.total = 17500

Scenario: Producto prepared en la compra
  When incluye un producto de tipo prepared
  Then recibe status 400

Scenario: Sin conversión disponible
  Given harina con unidad base "gram" y se intenta comprar en "liter" sin conversión
  When se registra la compra
  Then recibe status 400 indicando la falta de conversión
```

**Contrato API:**

`POST /api/v1/purchases`

Request:

```json
{
  "supplierId": "uuid-supplier",
  "notes": "Compra semanal",
  "items": [
    { "productId": "uuid-harina", "quantity": 5, "unitId": "uuid-kg", "unitPrice": 3500 },
    { "productId": "uuid-queso", "quantity": 2, "unitId": "uuid-kg", "unitPrice": 15000 }
  ]
}
```

Response 201:

```json
{
  "id": "uuid",
  "supplierId": "uuid-supplier",
  "total": 47500,
  "items": [
    { "productId": "uuid-harina", "quantity": 5, "unitId": "uuid-kg", "unitPrice": 3500, "subtotal": 17500 },
    { "productId": "uuid-queso", "quantity": 2, "unitId": "uuid-kg", "unitPrice": 15000, "subtotal": 30000 }
  ],
  "stockUpdates": [
    { "productId": "uuid-harina", "previousStock": 500, "addedStock": 5000, "newStock": 5500, "unit": "g" }
  ],
  "createdAt": "2026-05-19T09:00:00Z"
}
```

-----

## UC-15-02: Listar compras

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /purchases` con filtros opcionales.
1. Soporta filtro por `supplierId`, `dateFrom`, `dateTo`.

**Contrato API:**

`GET /api/v1/purchases?supplierId=uuid&dateFrom=2026-05-01&dateTo=2026-05-19&page=1&limit=20`

Response 200: Wrapper paginado con compras (sin `items` en el listado).

-----

## UC-15-03: Obtener detalle de compra

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /purchases/:id`.
1. Sistema retorna la compra con `items`, `supplier` y `registeredBy` incluidos.

**Contrato API:**

`GET /api/v1/purchases/:id`

Response 200: Compra completa con relaciones (eager load).
