## 09. `recipe_item`

**Module:** Products
**Description:** Defines the composition of a `prepared` product. Each row is one ingredient line.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `product_id` | `UUID` | `String` | No | — | FK → `product.id` ON DELETE CASCADE | The `prepared` product |
| `ingredient_id` | `UUID` | `String` | No | — | FK → `product.id` | Must be `type = unprepared` |
| `quantity` | `NUMERIC(12,4)` | `Decimal` | No | — | NOT NULL, > 0 | Amount needed per unit of product |
| `unit_id` | `UUID` | `String` | No | — | FK → `unit.id` | Unit of the quantity (may differ from ingredient's base unit) |

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `recipe_item_pkey` | `id` | PRIMARY KEY | |
| `recipe_item_product_ingredient_key` | `(product_id, ingredient_id)` | UNIQUE | No duplicate ingredient per recipe |
| `recipe_item_product_idx` | `product_id` | INDEX | |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `product` | Many-to-One | `product.id` | The parent prepared product |
| `ingredient` | Many-to-One | `product.id` | The ingredient (unprepared product) |
| `unit` | Many-to-One | `unit.id` | Unit used in this recipe line |

### Notes
- `ingredient_id` must reference a product with `type = unprepared`. Enforced at application layer (NestJS service) and recommended as a DB-level CHECK.
- `unit_id` can differ from the ingredient's `product.unit_id`. The system uses `unit_conversion` to translate quantities for stock deduction.
- When a product is deleted (soft delete → `inactive`), recipe items are retained for historical cost calculations.
