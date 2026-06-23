## 14. `order_item`

**Module:** Orders
**Description:** Individual line items within an order. Unit price is snapshotted at order time.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `order_id` | `UUID` | `String` | No | — | FK → `order.id` ON DELETE CASCADE | |
| `product_id` | `UUID` | `String` | No | — | FK → `product.id` | |
| `quantity` | `NUMERIC(8,2)` | `Decimal` | No | — | NOT NULL, > 0 | |
| `unit_price` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL | Snapshot of `product.sale_price` at order time |
| `discount` | `NUMERIC(12,2)` | `Decimal` | No | `0` | NOT NULL, ≥ 0 | Line-level discount amount |
| `subtotal` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL | `(unit_price × quantity) - discount` |
| `notes` | `TEXT` | `String?` | Yes | NULL | — | e.g. "no onion" |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `order_item_pkey` | `id` | PRIMARY KEY |
| `order_item_order_idx` | `order_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `order` | Many-to-One | `order.id` |
| `product` | Many-to-One | `product.id` |

### Notes
- `unit_price` is a snapshot. Future price changes on `product.sale_price` do **not** affect past orders.
- `subtotal` is stored (not computed on read) to ensure report consistency over time.
- Items cannot be modified once the order status moves past `pending`.
