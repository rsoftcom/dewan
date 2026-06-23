## 21. `purchase_item`

**Module:** Purchases
**Description:** Individual ingredient lines within a purchase.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `purchase_id` | `UUID` | `String` | No | — | FK → `purchase.id` ON DELETE CASCADE | |
| `product_id` | `UUID` | `String` | No | — | FK → `product.id` | Must be `type = unprepared` |
| `quantity` | `NUMERIC(12,4)` | `Decimal` | No | — | NOT NULL, > 0 | Quantity purchased |
| `unit_id` | `UUID` | `String` | No | — | FK → `unit.id` | Unit used in this purchase (may differ from base unit) |
| `unit_price` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL, > 0 | Price per purchased unit |
| `subtotal` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL | `quantity × unit_price` |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `purchase_item_pkey` | `id` | PRIMARY KEY |
| `purchase_item_purchase_idx` | `purchase_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `purchase` | Many-to-One | `purchase.id` |
| `product` | Many-to-One | `product.id` |
| `unit` | Many-to-One | `unit.id` |

### Notes
- `product_id` must reference an `unprepared` product. Enforced at application layer.
- `unit_price` updates `product.purchase_price` on the referenced ingredient (latest-price strategy for MVP).
