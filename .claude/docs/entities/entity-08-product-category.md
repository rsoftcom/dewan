## 08. `product_category`

**Module:** Products
**Description:** Join table for the M:N relationship between `product` and `category`.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `product_id` | `UUID` | `String` | No | — | FK → `product.id` ON DELETE CASCADE | Part of composite PK |
| `category_id` | `UUID` | `String` | No | — | FK → `category.id` ON DELETE CASCADE | Part of composite PK |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `product_category_pkey` | `(product_id, category_id)` | PRIMARY KEY (composite) |
| `product_category_category_idx` | `category_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `product` | Many-to-One | `product.id` |
| `category` | Many-to-One | `category.id` |

### Notes
- No additional columns. Pure join table.
- Cascade delete on both sides: removing a product or category cleans up this table automatically.
