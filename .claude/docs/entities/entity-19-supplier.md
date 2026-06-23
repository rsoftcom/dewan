## 19. `supplier`

**Module:** Suppliers
**Description:** Ingredient and supply vendors for the business.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | |
| `phone` | `VARCHAR(30)` | `String?` | Yes | NULL | — | |
| `email` | `VARCHAR(150)` | `String?` | Yes | NULL | — | |
| `address` | `TEXT` | `String?` | Yes | NULL | — | |
| `contact_name` | `VARCHAR(150)` | `String?` | Yes | NULL | — | Primary contact person |
| `notes` | `TEXT` | `String?` | Yes | NULL | — | |
| `status` | `supplier_status` | `SupplierStatus` | No | `'active'` | NOT NULL | `active`, `inactive` (soft delete) |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
SupplierStatus: active | inactive
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `supplier_pkey` | `id` | PRIMARY KEY |
| `supplier_tenant_idx` | `tenant_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `purchases` | One-to-Many | `purchase.supplier_id` |
