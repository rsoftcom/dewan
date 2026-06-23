## 11. `customer`

**Module:** Customers
**Description:** Customer records, primarily used for delivery orders. Looked up by phone number at order creation.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | |
| `phone` | `VARCHAR(30)` | `String` | No | — | NOT NULL | Primary lookup key |
| `address` | `TEXT` | `String?` | Yes | NULL | — | Default delivery address |
| `email` | `VARCHAR(150)` | `String?` | Yes | NULL | — | |
| `notes` | `TEXT` | `String?` | Yes | NULL | — | Preferences, location references |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `customer_pkey` | `id` | PRIMARY KEY | |
| `customer_tenant_idx` | `tenant_id` | INDEX | |
| `customer_phone_tenant_key` | `(phone, tenant_id)` | UNIQUE | Phone unique per tenant |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `orders` | One-to-Many | `order.customer_id` |

### Notes
- At delivery order creation: if a customer exists with that `phone` within the tenant, their data is preloaded. Otherwise a new record is created automatically.
- Customers are tenant-scoped. The same phone can belong to different customers across tenants.
