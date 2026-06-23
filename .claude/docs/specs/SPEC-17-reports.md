# SPEC-17: Reports

**Descripción:** Reportes de negocio basados en datos históricos. Solo lectura. Todos requieren rango de fechas.

**Actores:** `owner`, `admin`

**Entidades:** Vistas y queries agregadas sobre `order`, `payment`, `cash_register`, `movement`, `purchase`, `product`

-----

## UC-17-01: Reporte de ventas por rango de fechas

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /reports/sales?dateFrom=2026-05-01&dateTo=2026-05-19`.
1. Sistema calcula sobre pedidos `status = completed` en el rango:
- `totalRevenue`: suma de `order.total`.
- `totalOrders`: conteo de pedidos.
- `averageTicket`: `totalRevenue / totalOrders`.
- `byType`: desglose `local` vs `delivery`.
- `byPaymentMethod`: desglose por método de pago.
- `topProducts`: top 10 productos más vendidos (por `order_item.quantity`).
- `revenueByDay`: array con ingresos por día del rango.

**Criterios de aceptación:**

```gherkin
Scenario: Reporte de ventas de mayo
  Given pedidos completados entre 2026-05-01 y 2026-05-19
  When envía GET /api/v1/reports/sales?dateFrom=2026-05-01&dateTo=2026-05-19
  Then recibe reporte con totalRevenue, totalOrders, topProducts y revenueByDay
  And solo incluye pedidos con status = "completed"
```

**Contrato API:**

`GET /api/v1/reports/sales?dateFrom=2026-05-01&dateTo=2026-05-19`

Response 200:

```json
{
  "period": { "from": "2026-05-01", "to": "2026-05-19" },
  "totalRevenue": 1500000,
  "totalOrders": 85,
  "averageTicket": 17647,
  "byType": { "local": 60, "delivery": 25 },
  "byPaymentMethod": { "cash": 900000, "card": 450000, "transfer": 150000 },
  "topProducts": [
    { "productId": "uuid", "name": "Arepa con queso", "quantitySold": 120, "revenue": 600000 }
  ],
  "revenueByDay": [
    { "date": "2026-05-01", "revenue": 75000, "orders": 4 }
  ]
}
```

-----

## UC-17-02: Reporte diario de caja

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /reports/cash-register/:id` o `GET /reports/cash-register?date=2026-05-19`.
1. Sistema retorna el reporte completo de esa caja: apertura, ventas, movimientos, cierre y diferencia.

**Contrato API:**

`GET /api/v1/reports/cash-register?date=2026-05-19`

Response 200:

```json
{
  "cashRegisterId": "uuid",
  "date": "2026-05-19",
  "status": "closed",
  "openedBy": "Juan",
  "openedAt": "08:00",
  "closedBy": "Juan",
  "closedAt": "22:00",
  "initialAmount": 50000,
  "totalSales": 500000,
  "totalIncome": 20000,
  "totalExpense": 35000,
  "expectedAmount": 535000,
  "finalAmount": 530000,
  "difference": -5000,
  "movements": [...]
}
```

-----

## UC-17-03: Reporte de movimientos

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /reports/movements?dateFrom=...&dateTo=...`.
1. Sistema agrupa movimientos por `type` y calcula totales.

**Contrato API:**

`GET /api/v1/reports/movements?dateFrom=2026-05-01&dateTo=2026-05-19`

Response 200:

```json
{
  "period": { "from": "...", "to": "..." },
  "totals": { "income": 150000, "expense": 85000, "cost": 40000 },
  "netFlow": 25000,
  "movements": [...]
}
```

-----

## UC-17-04: Reporte de stock bajo

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Descripción:** Idéntico a UC-16-03 pero formateado como reporte con fecha de generación. Puede descargarse como CSV en el futuro.

**Contrato API:**

`GET /api/v1/reports/low-stock`

Response 200: Igual que UC-16-03 pero envuelto en objeto `{ generatedAt, items: [...] }`.

-----

## UC-17-05: Historial de compras

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /reports/purchases?dateFrom=...&dateTo=...&supplierId=...`.
1. Sistema agrega compras del período:
- Total gastado por proveedor.
- Productos más comprados.
- Evolución del costo de ingredientes clave.

**Contrato API:**

`GET /api/v1/reports/purchases?dateFrom=2026-05-01&dateTo=2026-05-19`

Response 200:

```json
{
  "period": { "from": "...", "to": "..." },
  "totalSpent": 850000,
  "totalPurchases": 12,
  "bySupplier": [
    { "supplierName": "Lácteos Norte", "totalSpent": 450000, "purchaseCount": 7 }
  ],
  "topIngredients": [
    { "productName": "Harina", "totalQuantity": 50000, "unit": "g", "totalCost": 175000 }
  ]
}
```
