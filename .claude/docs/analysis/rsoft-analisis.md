# R Soft — Documento de Análisis y Definición del Producto

> **Fase actual:** Fase 1 — Descubrimiento y definición del producto
> **Última actualización:** 2026-05-18
> **Estado:** Análisis de entidades completado — Listo para revisión final

---

## 1. Visión general

R Soft es una plataforma SaaS multi-tenant para negocios pequeños y medianos (restaurantes, cafeterías, tiendas, locales comerciales). Permite gestionar operaciones diarias: ventas, inventario, pedidos, caja y reportes.

El sistema contempla un **dashboard administrativo por negocio** y a futuro una **zona pública** para que los clientes visualicen el menú y realicen pedidos.

---

## 2. Decisiones generales

| # | Decisión | Detalle |
|---|----------|---------|
| D-01 | Multi-tenencia MVP | Un negocio = una sucursal. Múltiples sucursales queda para fase futura. |
| D-02 | Variantes y modificadores | Excluidos del MVP. Fase futura. |
| D-03 | Impuestos / IVA | Excluidos del MVP. Fase futura. |
| D-04 | Modelo de venta MVP | Modelo B (orden/comanda). Dejar puerta abierta para venta directa (tipo tienda) en el futuro. |
| D-05 | Nomenclatura técnica | Todas las entidades, atributos, relaciones y código se nombran en inglés. |

---

## 3. Entidades y reglas de negocio

---

### 3.1 `tenant`

Entidad raíz del modelo multi-tenant. Toda entidad del sistema pertenece a un tenant.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `name` | string | Sí | Nombre del negocio |
| `business_type` | string | No | Restaurante, tienda, cafetería, etc. |
| `logo` | string | No | URL o path de la imagen |
| `address` | string | No | |
| `phone` | string | No | |
| `email` | string | No | |
| `currency` | string | Sí | Ej: MXN, COP, USD |
| `status` | enum | Sí | `active`, `inactive` |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

**Regla:** Toda entidad del sistema debe estar asociada a un `tenant_id`. Ningún usuario puede ver datos de otro tenant.

---

### 3.2 `user`

Usuarios del sistema con autenticación y rol asignado.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Condicional | Null solo para `super_admin` |
| `name` | string | Sí | |
| `email` | string | Sí | Único dentro del tenant |
| `password_hash` | string | Sí | |
| `role` | enum | Sí | Ver tabla de roles |
| `status` | enum | Sí | `active`, `inactive` |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

#### Roles del sistema

| Rol | Alcance | Permisos clave |
|-----|---------|----------------|
| `super_admin` | Global — todos los tenants | Gestión de tenants, vista global del SaaS. No pertenece a ningún tenant. |
| `owner` | Su tenant | Acceso total: dashboard, pedidos, productos, inventario, caja, movimientos, reportes, usuarios, logs, configuración. |
| `admin` | Su tenant | Igual que owner excepto configuración de facturación/suscripción del SaaS. |
| `cashier` | Su tenant | Crear pedidos, cobrar, abrir/cerrar caja. |
| `waiter` | Su tenant | Crear pedidos locales, asignar a mesa, marcar como servido. |
| `kitchen` | Su tenant | Ver cola de pedidos entrantes, marcar como en preparación / preparado / rechazado. |
| `delivery` | Su tenant | Ver pedidos de domicilio asignados, marcar como en camino / entregado / dinero entregado. |

**Reglas:**
- El `super_admin` es único y global; no pertenece a ningún tenant.
- Un usuario pertenece a un solo tenant.
- El owner/admin puede activar/desactivar usuarios y resetear contraseñas.

---

### 3.3 `product`

Entidad central del sistema. Dos tipos: preparado (con receta) y no preparado (ingrediente/insumo).

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | |
| `type` | enum | Sí | `prepared`, `unprepared` |
| `description` | string | No | |
| `image` | string | No | URL o path |
| `unit_id` | UUID (FK) | Sí | Unidad de medida base |
| `current_stock` | decimal | Sí | Cantidad disponible en unidad base |
| `minimum_stock` | decimal | Sí | Umbral de alerta definido por el usuario |
| `sale_price` | decimal | Condicional | Obligatorio si `prepared`. Opcional si `unprepared`. |
| `purchase_price` | decimal | Condicional | Solo para `unprepared`. Costo unitario en unidad base. |
| `desired_margin` | decimal | No | Solo para `prepared`. Porcentaje de ganancia deseado. |
| `status` | enum | Sí | `active`, `inactive` (soft delete) |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

**Regla:** Un `prepared` solo puede contener `unprepared` en su receta. No hay composición recursiva.

#### Campos calculados (no almacenados, se computan en tiempo real)

```
calculated_cost   = Σ (recipe_item.quantity × ingredient.purchase_price / conversion_factor)
suggested_price   = calculated_cost / (1 - desired_margin)
actual_margin     = (sale_price - calculated_cost) / sale_price × 100
```

---

### 3.4 `recipe_item`

Tabla intermedia: composición de un producto preparado.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `product_id` | UUID (FK) | Sí | Producto `prepared` |
| `ingredient_id` | UUID (FK) | Sí | Producto `unprepared` |
| `quantity` | decimal | Sí | Cantidad necesaria |
| `unit_id` | UUID (FK) | Sí | Unidad en la que se expresa (puede diferir de la unidad base del ingrediente) |

---

### 3.5 `unit`

Unidades de medida del sistema.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `name` | string | Sí | Ej: gram, kilogram, liter, unit, slice |
| `abbreviation` | string | Sí | Ej: g, kg, L, ud, slc |

---

### 3.6 `unit_conversion`

Factores de conversión entre unidades de medida.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `from_unit_id` | UUID (FK) | Sí | Unidad origen |
| `to_unit_id` | UUID (FK) | Sí | Unidad destino |
| `factor` | decimal | Sí | Ej: 1 kg = 1000 g → factor = 1000 |

**Uso:** El ingrediente tiene una unidad base (ej: g). Las compras pueden registrarse en otra unidad (ej: kg) y el sistema convierte automáticamente al stock en unidad base.

---

### 3.7 `category`

Organiza productos. Funciona como tags con jerarquía.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | Ej: Beverages, Starters, Desserts |
| `parent_id` | UUID (FK) | No | Null = categoría raíz. Con valor = subcategoría. |
| `created_at` | timestamp | Sí | |

---

### 3.8 `product_category`

Relación muchos a muchos entre producto y categoría.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `product_id` | UUID (FK) | Sí | PK compuesto |
| `category_id` | UUID (FK) | Sí | PK compuesto |

---

### 3.9 `table`

Mesas físicas del local.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | Configurable. Ej: "Mesa 1", "Barra", "Terraza 3" |
| `status` | enum | Sí | `available`, `occupied` |
| `created_at` | timestamp | Sí | |

**Reglas:**
- Configurables por el negocio.
- Una mesa solo puede tener un pedido activo a la vez.

---

### 3.10 `order`

Entidad central del flujo de venta.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `type` | enum | Sí | `local`, `delivery` |
| `status` | enum | Sí | Según máquina de estados |
| `table_id` | UUID (FK) | Condicional | Obligatorio si type = `local` |
| `customer_id` | UUID (FK) | Condicional | Obligatorio si type = `delivery` |
| `delivery_person_id` | UUID (FK) | Condicional | Se asigna al salir de cocina (solo `delivery`) |
| `created_by` | UUID (FK) | Sí | Usuario que creó el pedido |
| `notes` | text | No | Observaciones generales |
| `rejection_reason` | text | Condicional | Obligatorio si status = `rejected` |
| `total` | decimal | Sí | Calculado: suma de líneas con descuentos |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

#### Máquina de estados

```
                       ┌──── rejected
                       │
pending → in_kitchen → prepared → served → paid → completed          (LOCAL)
                               → assigned → on_the_way → delivered → money_collected → completed  (DELIVERY)
```

#### Transiciones permitidas por rol

| Desde | Hacia | Rol(es) | Condición |
|-------|-------|---------|-----------|
| `pending` | `in_kitchen` | kitchen | — |
| `pending` | `rejected` | kitchen, admin, owner | Requiere `rejection_reason` |
| `in_kitchen` | `prepared` | kitchen | — |
| `prepared` | `served` | waiter, cashier | Solo type = `local` |
| `prepared` | `assigned` | admin, owner, cashier | Solo type = `delivery`. Asigna `delivery_person_id`. |
| `assigned` | `on_the_way` | delivery | Solo type = `delivery` |
| `on_the_way` | `delivered` | delivery | Solo type = `delivery` |
| `delivered` | `money_collected` | delivery | Solo type = `delivery` |
| `served` | `paid` | cashier, admin, owner | Solo type = `local`. Se registra pago. |
| `money_collected` | `completed` | admin, owner | Solo type = `delivery`. Admin confirma recepción. |
| `paid` | `completed` | admin, owner, cashier | Solo type = `local`. |

**Propósito de los estados:** Permiten medir tiempos entre cada operación para análisis de eficiencia.

#### Descuento automático de stock

Cuando un pedido pasa a `in_kitchen`, el sistema descuenta automáticamente del stock de cada ingrediente las cantidades definidas en la receta (`recipe_item`) de cada producto del pedido. Si un ingrediente no tiene stock suficiente, se genera alerta pero no se bloquea el pedido.

---

### 3.11 `order_status_history`

Registra cada cambio de estado para trazabilidad.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `order_id` | UUID (FK) | Sí | |
| `status` | enum | Sí | Estado al que cambió |
| `changed_by` | UUID (FK) | Sí | Usuario que realizó el cambio |
| `changed_at` | timestamp | Sí | |

---

### 3.12 `order_item`

Líneas de detalle del pedido.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `order_id` | UUID (FK) | Sí | |
| `product_id` | UUID (FK) | Sí | |
| `quantity` | decimal | Sí | |
| `unit_price` | decimal | Sí | Snapshot del precio al momento de la venta |
| `discount` | decimal | No | Monto de descuento aplicado a esta línea |
| `subtotal` | decimal | Sí | (unit_price × quantity) - discount |
| `notes` | text | No | Ej: "sin cebolla" |

---

### 3.13 `payment`

Pagos asociados a un pedido. Soporta pagos mixtos.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `order_id` | UUID (FK) | Sí | |
| `method` | enum | Sí | `cash`, `card`, `transfer` |
| `amount` | decimal | Sí | Cantidad pagada con este método |
| `change_amount` | decimal | No | Solo si method = `cash` y monto > restante |
| `reference` | string | No | Número de referencia (tarjeta o transferencia) |
| `registered_by` | UUID (FK) | Sí | Usuario que registró el pago |
| `created_at` | timestamp | Sí | |

**Regla:** La suma de todos los pagos de un pedido debe ser ≥ al total del pedido.

---

### 3.14 `customer`

Información del cliente, relevante para pedidos a domicilio.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | |
| `phone` | string | Sí | Clave de búsqueda rápida |
| `address` | text | No | Relevante para domicilios |
| `email` | string | No | |
| `notes` | text | No | Preferencias, referencias de ubicación |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

**Comportamiento:** Al crear un pedido `delivery`, el sistema busca por `phone`. Si existe, precarga datos. Si no, crea registro nuevo.

---

### 3.15 `delivery_person`

Personal de entregas a domicilio. Registro operativo, no usuario del sistema en el MVP.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | |
| `phone` | string | Sí | |
| `status` | enum | Sí | `available`, `on_delivery` |
| `created_at` | timestamp | Sí | |

**Nota:** No tiene login en el MVP. Futuro: se vincula a un `user` con rol `delivery`.

---

### 3.16 `cash_register`

Caja diaria del negocio.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `date` | date | Sí | Día de operación |
| `initial_amount` | decimal | Sí | Efectivo al abrir |
| `final_amount` | decimal | Condicional | Se registra al cerrar |
| `total_sales` | decimal | Automático | Suma de pagos de pedidos completados |
| `total_income` | decimal | Automático | Suma de movimientos tipo `income` |
| `total_expense` | decimal | Automático | Suma de movimientos tipo `expense` + `cost` |
| `difference` | decimal | Automático | final_amount - (initial_amount + sales + income - expense) |
| `status` | enum | Sí | `open`, `closed` |
| `open_notes` | text | No | |
| `close_notes` | text | No | |
| `opened_by` | UUID (FK) | Sí | |
| `closed_by` | UUID (FK) | Condicional | |
| `opened_at` | timestamp | Sí | |
| `closed_at` | timestamp | Condicional | |

**Reglas:**
- Solo una caja abierta a la vez por tenant.
- No se pueden completar (`completed`) pedidos si no hay caja abierta.
- Solo `owner`, `admin` y `cashier` pueden abrir/cerrar caja.

---

### 3.17 `movement`

Entradas y salidas de dinero que no son ventas.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `cash_register_id` | UUID (FK) | Sí | Caja abierta al momento del registro |
| `type` | enum | Sí | `income`, `expense`, `cost` |
| `amount` | decimal | Sí | |
| `description` | text | Sí | Motivo del movimiento |
| `reference` | string | No | Comprobante |
| `created_by` | UUID (FK) | Sí | |
| `created_at` | timestamp | Sí | |

**Tipos:**
- `income` — Entradas que no son ventas (ej: cobro de deuda, préstamo recibido).
- `expense` — Salidas operativas (ej: compra de insumos, pago a proveedor).
- `cost` — Gastos generales (ej: servicios, arriendo, nómina).

---

### 3.18 `supplier`

Proveedores de insumos.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `name` | string | Sí | |
| `phone` | string | No | |
| `email` | string | No | |
| `address` | text | No | |
| `contact_name` | string | No | Persona de contacto |
| `notes` | text | No | |
| `status` | enum | Sí | `active`, `inactive` |
| `created_at` | timestamp | Sí | |
| `updated_at` | timestamp | Sí | |

---

### 3.19 `purchase`

Registro de compras de insumos a proveedores.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `supplier_id` | UUID (FK) | Sí | Proveedor al que se compró |
| `total` | decimal | Sí | Calculado: suma de líneas |
| `notes` | text | No | |
| `registered_by` | UUID (FK) | Sí | Usuario que registró la compra |
| `created_at` | timestamp | Sí | |

**Efecto:** Al registrar una compra, el stock de cada ingrediente se incrementa automáticamente (convertido a unidad base).

---

### 3.20 `purchase_item`

Líneas de detalle de una compra.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `purchase_id` | UUID (FK) | Sí | |
| `product_id` | UUID (FK) | Sí | Solo productos `unprepared` |
| `quantity` | decimal | Sí | Cantidad comprada |
| `unit_id` | UUID (FK) | Sí | Unidad en la que se compró (puede diferir de la base) |
| `unit_price` | decimal | Sí | Precio por unidad de compra |
| `subtotal` | decimal | Sí | quantity × unit_price |

---

### 3.21 `inventory_adjustment`

Ajustes manuales de stock que no son ventas ni compras.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `product_id` | UUID (FK) | Sí | Producto ajustado |
| `type` | enum | Sí | `entry`, `exit` |
| `quantity` | decimal | Sí | Cantidad del ajuste (en unidad base) |
| `reason` | text | Sí | Motivo en texto libre |
| `adjusted_by` | UUID (FK) | Sí | Usuario que realizó el ajuste |
| `created_at` | timestamp | Sí | |

---

### 3.22 `notification`

Notificaciones in-app para usuarios.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `user_id` | UUID (FK) | Sí | Destinatario |
| `title` | string | Sí | Título breve |
| `message` | text | Sí | Contenido de la notificación |
| `type` | enum | Sí | `low_stock`, `new_order`, `order_status`, `cash_register`, `system` |
| `is_read` | boolean | Sí | Default: false |
| `entity` | string | No | Entidad relacionada (ej: `product`, `order`) |
| `entity_id` | UUID | No | ID de la entidad relacionada (para navegación) |
| `created_at` | timestamp | Sí | |

**Entrega:** Solo in-app en el MVP. Push/email queda para fase futura.

---

### 3.23 `audit_log`

Registro automático de acciones críticas.

| Atributo | Tipo | Obligatorio | Notas |
|----------|------|-------------|-------|
| `id` | UUID | Sí | PK |
| `tenant_id` | UUID (FK) | Sí | |
| `user_id` | UUID (FK) | Sí | Quién realizó la acción |
| `user_name` | string | Sí | Snapshot del nombre |
| `action` | string | Sí | `create`, `update`, `delete`, `status_change`, etc. |
| `entity` | string | Sí | Nombre de la entidad afectada |
| `entity_id` | UUID | Sí | ID del registro afectado |
| `metadata` | jsonb | No | Datos adicionales (valores anteriores/nuevos) |
| `created_at` | timestamp | Sí | |

**Acciones que generan log:**
- CRUD de productos, usuarios, proveedores
- Crear pedido, cada cambio de estado
- Registrar pago
- Abrir / cerrar caja
- Registrar movimientos
- Registrar compras
- Ajustes manuales de inventario

**Acceso:** Solo `owner` y `admin`. Filtrable por usuario, entidad, acción y rango de fechas.

---

## 4. Resumen de entidades

| # | Entidad | Descripción |
|---|---------|-------------|
| 1 | `tenant` | Negocio (raíz multi-tenant) |
| 2 | `user` | Usuarios con roles y autenticación |
| 3 | `product` | Productos preparados e ingredientes |
| 4 | `recipe_item` | Composición/receta de un producto preparado |
| 5 | `unit` | Unidades de medida |
| 6 | `unit_conversion` | Factores de conversión entre unidades |
| 7 | `category` | Categorías jerárquicas tipo tag |
| 8 | `product_category` | Relación M:N producto ↔ categoría |
| 9 | `table` | Mesas del local |
| 10 | `order` | Pedidos (local y domicilio) |
| 11 | `order_status_history` | Historial de cambios de estado |
| 12 | `order_item` | Líneas de detalle del pedido |
| 13 | `payment` | Pagos (mixtos) |
| 14 | `customer` | Clientes (domicilio) |
| 15 | `delivery_person` | Repartidores |
| 16 | `cash_register` | Caja diaria |
| 17 | `movement` | Ingresos, egresos y gastos |
| 18 | `supplier` | Proveedores |
| 19 | `purchase` | Compras de insumos |
| 20 | `purchase_item` | Detalle de compras |
| 21 | `inventory_adjustment` | Ajustes manuales de stock |
| 22 | `notification` | Notificaciones in-app |
| 23 | `audit_log` | Log de auditoría |

---

## 5. Alertas del sistema

| Alerta | Condición | Impacto |
|--------|-----------|---------|
| Stock bajo (ingrediente) | `current_stock < minimum_stock` en producto `unprepared` | Se alerta y se listan los productos `prepared` dependientes |
| Stock bajo (preparado) | `current_stock < minimum_stock` en producto `prepared` | Alerta directa |
| Caja no abierta | Se intenta completar un pedido sin caja abierta | Bloquea la finalización |

---

## 6. Vistas por rol

| Rol | Módulos accesibles |
|-----|--------------------|
| `super_admin` | Gestión de tenants, vista global de la plataforma |
| `owner` | Dashboard, Pedidos, Productos, Inventario, Compras, Proveedores, Caja, Movimientos, Reportes, Usuarios, Logs, Configuración |
| `admin` | Dashboard, Pedidos, Productos, Inventario, Compras, Proveedores, Caja, Movimientos, Reportes, Usuarios, Logs |
| `cashier` | Crear pedidos, Cobrar, Caja (abrir/cerrar) |
| `waiter` | Crear pedidos locales, Ver sus pedidos activos, Marcar como servido |
| `kitchen` | Cola de pedidos en tiempo real, Cambiar estado |
| `delivery` | Pedidos de domicilio asignados, Actualizar estado de entrega |

---

## 7. Flujos principales

### Flujo pedido LOCAL

```
waiter/cashier crea order (local) + asigna table → [pending] (table → occupied)
kitchen acepta → [in_kitchen] (se descuenta stock de ingredientes)
kitchen termina → [prepared]
waiter entrega en mesa → [served]
cashier/admin cobra → [paid] (se registra payment)
cashier/admin finaliza → [completed] (table → available)
```

### Flujo pedido DELIVERY

```
waiter/cashier crea order (delivery) + datos customer → [pending]
kitchen acepta → [in_kitchen] (se descuenta stock de ingredientes)
kitchen termina → [prepared]
admin asigna delivery_person → [assigned] (delivery_person → on_delivery)
delivery_person sale → [on_the_way]
delivery_person entrega → [delivered]
delivery_person entrega dinero en local → [money_collected] (delivery_person → available)
admin confirma → [completed]
```

### Flujo de caja diaria

```
owner/admin/cashier abre cash_register con initial_amount → [open]
    ├── Pedidos completed → suman a total_sales
    ├── Movements tipo income → suman
    └── Movements tipo expense/cost → restan
owner/admin/cashier cierra con final_amount → [closed]
    └── difference = final_amount - (initial_amount + total_sales + total_income - total_expense)
```

### Flujo de compra

```
owner/admin registra purchase + supplier + items
    └── Por cada purchase_item:
        stock del product se incrementa (quantity × conversion_factor a unidad base)
```

---

## 8. Reportes MVP

| Reporte | Descripción | Roles |
|---------|-------------|-------|
| Ventas por rango de fechas | Pedidos completados, ingresos totales, top productos | owner, admin |
| Reporte diario de caja | Apertura, cierre, diferencia, ventas y movimientos | owner, admin |
| Reporte de movimientos | Income, expense, cost por rango de fechas | owner, admin |
| Productos con stock bajo | Productos e ingredientes bajo `minimum_stock` | owner, admin |
| Historial de compras | Compras por proveedor y por rango de fechas | owner, admin |

---

## 9. Notas técnicas (para Fase 3 — Arquitectura)

| Concepto | Nota |
|----------|------|
| Tiempo real | WebSockets para notificar a cocina (nuevo pedido) y actualizar estados entre roles |
| Máquina de estados | Transiciones validadas centralmente. Transición inválida → error |
| Snapshots | `unit_price` en `order_item` es snapshot. Cambios futuros de precio no afectan pedidos anteriores |
| Paginación | Todos los endpoints de listado soportan paginación |
| Soft delete | Productos, usuarios, proveedores se marcan `inactive`, no se eliminan |
| Búsqueda de cliente | Al crear pedido delivery, buscar por `phone`. Existe → precargar. No existe → crear nuevo |
| Nomenclatura | Todo el código, archivos, carpetas, variables, clases y endpoints en inglés |

---

## 10. Funcionalidades excluidas del MVP (fase futura)

| Funcionalidad | Prioridad | Notas |
|---------------|-----------|-------|
| Múltiples sucursales | Alta | N sucursales con inventario independiente por tenant |
| Variantes de producto | Media | Tamaños, opciones que cambian precio y composición |
| Modificadores | Media | Extras, ajustes al momento del pedido |
| Impuestos / IVA | Media | Cálculo y desglose |
| Venta directa (modo tienda) | Media | Flujo rápido sin comanda ni mesa |
| Zona pública (menú online) | Media | Clientes ven menú y hacen pedidos |
| Notificaciones push/email | Media | Complemento a las notificaciones in-app |
| Reportes avanzados | Baja | Tiempos por estado, eficiencia, tendencias |
| App móvil para repartidores | Baja | App dedicada para gestión de entregas |
| Stock mínimo calculado | Baja | Sistema calcula umbral basado en consumo promedio |

---

## 11. Registro de decisiones

| # | Fecha | Decisión | Justificación |
|---|-------|----------|---------------|
| D-01 | 2026-05-18 | Multi-tenencia: 1 negocio = 1 sucursal en MVP | Simplifica modelo de datos e inventario |
| D-02 | 2026-05-18 | Composición no recursiva | Prepared solo contiene unprepared. Evita cálculos recursivos |
| D-03 | 2026-05-18 | Unidades con conversiones | Flexible: se compra en una unidad, se usa en otra |
| D-04 | 2026-05-18 | Stock mínimo manual | Simple para MVP. Calculado queda para futuro |
| D-05 | 2026-05-18 | Precio: sugerido + manual | Sistema sugiere, usuario decide. Muestra margen real |
| D-06 | 2026-05-18 | Categorías tipo tag con jerarquía | Múltiples categorías por producto. Padre-hijo |
| D-07 | 2026-05-18 | Sin variantes ni modificadores en MVP | Reduce complejidad |
| D-08 | 2026-05-18 | Sin impuestos/IVA en MVP | Reduce complejidad |
| D-09 | 2026-05-18 | Pagos mixtos: cash, card, transfer | Descuento solo a nivel de product |
| D-10 | 2026-05-18 | Modelo comanda (MVP), venta directa (futuro) | Flujo restaurante: pedidos local y delivery |
| D-11 | 2026-05-18 | Mesas configurables, un pedido por mesa | Simple y claro |
| D-12 | 2026-05-18 | 7 roles: super_admin, owner, admin, cashier, waiter, kitchen, delivery | Cubren todos los perfiles operativos |
| D-13 | 2026-05-18 | Caja: una por tenant, open/closed | Obligatoria para completar pedidos |
| D-14 | 2026-05-18 | Movimientos: income, expense, cost | Flujo de dinero manual no vinculado a ventas |
| D-15 | 2026-05-18 | Audit log automático | Acciones críticas registradas con metadata |
| D-16 | 2026-05-18 | Order status history | Trazabilidad y análisis de tiempos |
| D-17 | 2026-05-18 | Descuento de stock en `in_kitchen` | Automático al aceptar en cocina |
| D-18 | 2026-05-18 | Delivery person como registro, no usuario en MVP | Sin login. Futuro: se vincula a user con rol delivery |
| D-19 | 2026-05-18 | Customer se busca por phone | Existe → precarga. No existe → crea nuevo |
| D-20 | 2026-05-18 | Compras con proveedor (supplier + purchase) | Trazabilidad completa de entradas de inventario |
| D-21 | 2026-05-18 | Ajustes de inventario simples: entry/exit + reason | Sin tipos predefinidos de motivo |
| D-22 | 2026-05-18 | Notificaciones solo in-app en MVP | Push/email queda para fase futura |
| D-23 | 2026-05-18 | Configuración = datos del Tenant | No se agrega módulo de config adicional en MVP |
| D-24 | 2026-05-18 | Nomenclatura en inglés | Entidades, atributos, relaciones y código en inglés |
