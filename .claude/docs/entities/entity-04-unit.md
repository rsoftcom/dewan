## 04. `unit`

**Module:** Products
**Description:** Units of measurement used across the system (for stock, recipes, and purchases).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `name` | `VARCHAR(50)` | `String` | No | — | NOT NULL, UNIQUE | e.g. gram, kilogram, liter, unit, slice |
| `abbreviation` | `VARCHAR(10)` | `String` | No | — | NOT NULL, UNIQUE | e.g. g, kg, L, ud, slc |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `unit_pkey` | `id` | PRIMARY KEY |
| `unit_name_key` | `name` | UNIQUE |
| `unit_abbreviation_key` | `abbreviation` | UNIQUE |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `conversions_from` | One-to-Many | `unit_conversion.from_unit_id` | |
| `conversions_to` | One-to-Many | `unit_conversion.to_unit_id` | |
| `products` | One-to-Many | `product.unit_id` | Base unit of a product |
| `recipe_items` | One-to-Many | `recipe_item.unit_id` | Unit used in a recipe line |
| `purchase_items` | One-to-Many | `purchase_item.unit_id` | Unit used in a purchase line |

### Notes
- Units are **global** (not tenant-scoped). Managed by `super_admin` or seeded at setup.
- Seeded values: `gram (g)`, `kilogram (kg)`, `milligram (mg)`, `liter (L)`, `milliliter (mL)`, `unit (ud)`, `slice (slc)`, `tablespoon (tbsp)`, `teaspoon (tsp)`, `portion (ptn)`.
- Units cannot be deleted if referenced by products, recipe items, or purchase items.
