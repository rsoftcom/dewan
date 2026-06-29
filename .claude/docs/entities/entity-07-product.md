## 07. `product`

**Module:** Products
**Description:** Central catalog entity. Two types: `prepared` (has a recipe, is sold) and `unprepared` (raw ingredient, tracked in stock).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | |
| `type` | `product_type` | `ProductType` | No | — | NOT NULL | `prepared`, `unprepared` |
| `description` | `TEXT` | `String?` | Yes | NULL | — | |
| `image` | `TEXT` | `String?` | Yes | NULL | — | Public URL (Cloudflare R2) |
| `unit_id` | `UUID` | `String` | No | — | FK → `unit.id` | Base unit for stock tracking |
| `current_stock` | `NUMERIC(12,4)` | `Decimal` | No | `0` | NOT NULL, ≥ 0 | Quantity in base unit |
| `minimum_stock` | `NUMERIC(12,4)` | `Decimal` | No | `0` | NOT NULL, ≥ 0 | Alert threshold |
| `sale_price` | `NUMERIC(12,2)` | `Decimal?` | Yes | NULL | > 0 when set | Required if `type = prepared` |
| `purchase_price` | `NUMERIC(12,2)` | `Decimal?` | Yes | NULL | > 0 when set | Unit cost in base unit. Only for `unprepared` |
| `desired_margin` | `NUMERIC(5,2)` | `Decimal?` | Yes | NULL | 0–100 | Target profit margin %. Only for `prepared` |
| `sellable` | `BOOLEAN` | `Boolean` | No | `false` | NOT NULL | Whether the product is available for sale in orders |
| `status` | `product_status` | `ProductStatus` | No | `'active'` | NOT NULL | `active`, `inactive` (soft delete) |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
ProductType:   prepared | unprepared
ProductStatus: active | inactive
```

### Computed fields (not stored — calculated on read)

| Field | Formula | Description |
|---|---|---|
| `calculated_cost` | `Σ (recipe_item.quantity × ingredient.purchase_price / conversion_factor)` | Total ingredient cost per unit |
| `suggested_price` | `calculated_cost / (1 - desired_margin / 100)` | Price to achieve target margin |
| `actual_margin` | `(sale_price - calculated_cost) / sale_price × 100` | Real margin at current sale price |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_pkey` | `id` | PRIMARY KEY |
| `product_tenant_idx` | `tenant_id` | INDEX |
| `product_tenant_name_key` | `(name, tenant_id)` | UNIQUE |
| `product_type_tenant_idx` | `(type, tenant_id)` | INDEX |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | |
| `unit` | Many-to-One | `unit.id` | Base unit |
| `product_categories` | One-to-Many | `product_category.product_id` | |
| `recipe_items_as_product` | One-to-Many | `recipe_item.product_id` | This product's recipe (if `prepared`) |
| `recipe_items_as_ingredient` | One-to-Many | `recipe_item.ingredient_id` | Where this is used as an ingredient |
| `order_items` | One-to-Many | `order_item.product_id` | |
| `purchase_items` | One-to-Many | `purchase_item.product_id` | Only `unprepared` |
| `inventory_adjustments` | One-to-Many | `inventory_adjustment.product_id` | |

### Notes
- `sale_price` is required for `prepared` products. A DB-level CHECK constraint enforces this.
- `purchase_price` is for `unprepared` only; it updates automatically when a new purchase is registered (latest price strategy in MVP).
- A `prepared` product can only reference `unprepared` products in its recipe (no recursive composition).
- `current_stock` is decremented when an order reaches `in_kitchen`, and incremented when a purchase is registered.
