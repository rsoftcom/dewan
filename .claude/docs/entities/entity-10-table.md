## 10. `table`

**Module:** Orders
**Description:** Physical tables or spots in the venue. Configurable per tenant.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(50)` | `String` | No | — | NOT NULL | e.g. "Table 1", "Bar", "Terrace 3" |
| `status` | `table_status` | `TableStatus` | No | `'available'` | NOT NULL | `available`, `occupied` |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
TableStatus: available | occupied
```

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `table_pkey` | `id` | PRIMARY KEY | |
| `table_tenant_idx` | `tenant_id` | INDEX | |
| `table_name_tenant_key` | `(name, tenant_id)` | UNIQUE | |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | |
| `orders` | One-to-Many | `order.table_id` | At most one active order per table |

### Notes
- `status` changes to `occupied` when an order is created for that table, and back to `available` when the order reaches `completed`.
- A table cannot be deleted while it has active orders.
