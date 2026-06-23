## 22. `inventory_adjustment`

**Module:** Inventory
**Description:** Manual stock corrections that are not the result of a sale or purchase (waste, counting errors, spoilage, etc.).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `product_id` | `UUID` | `String` | No | — | FK → `product.id` | Product being adjusted |
| `type` | `adjustment_type` | `AdjustmentType` | No | — | NOT NULL | `entry`, `exit` |
| `quantity` | `NUMERIC(12,4)` | `Decimal` | No | — | NOT NULL, > 0 | Quantity in product's base unit |
| `reason` | `TEXT` | `String` | No | — | NOT NULL | Free-text reason |
| `adjusted_by` | `UUID` | `String` | No | — | FK → `user.id` | |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
AdjustmentType: entry | exit
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `inventory_adjustment_pkey` | `id` | PRIMARY KEY |
| `inventory_adjustment_tenant_idx` | `tenant_id` | INDEX |
| `inventory_adjustment_product_idx` | `product_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `product` | Many-to-One | `product.id` |
| `adjusted_by_user` | Many-to-One | `user.id` |

### Notes
- `entry` increases `product.current_stock`; `exit` decreases it.
- Records are immutable. A correction requires a new adjustment in the opposite direction.
- An `exit` that would result in negative stock generates a warning but is not blocked (allows recording reality).
