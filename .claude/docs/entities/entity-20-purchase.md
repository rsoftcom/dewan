## 20. `purchase`

**Module:** Purchases
**Description:** Records a purchase of ingredients from a supplier. Automatically increments stock on registration.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `supplier_id` | `UUID` | `String` | No | — | FK → `supplier.id` | |
| `total` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL | Sum of `purchase_item.subtotal` values |
| `notes` | `TEXT` | `String?` | Yes | NULL | — | |
| `registered_by` | `UUID` | `String` | No | — | FK → `user.id` | |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `purchase_pkey` | `id` | PRIMARY KEY |
| `purchase_tenant_idx` | `tenant_id` | INDEX |
| `purchase_created_at_idx` | `created_at` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `supplier` | Many-to-One | `supplier.id` |
| `registered_by_user` | Many-to-One | `user.id` |
| `purchase_items` | One-to-Many | `purchase_item.purchase_id` |

### Notes
- Purchase registration is atomic: the record and all items are created in a single transaction.
- On commit, stock is incremented for each item: `quantity × conversion_factor` applied to ingredient's base unit.
- Purchases are immutable after creation. Errors are corrected via `inventory_adjustment`.
