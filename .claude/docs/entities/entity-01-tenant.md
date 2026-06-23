## 01. `tenant`

**Module:** Tenants
**Description:** Root entity of the multi-tenant model. Every other business entity references this one. One tenant = one business = one venue (in MVP).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | Unique identifier |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | Business name |
| `business_type` | `VARCHAR(50)` | `String?` | Yes | NULL | — | e.g. restaurant, store, cafe |
| `logo` | `TEXT` | `String?` | Yes | NULL | — | Public URL (Cloudflare R2) |
| `address` | `VARCHAR(255)` | `String?` | Yes | NULL | — | Physical address |
| `phone` | `VARCHAR(30)` | `String?` | Yes | NULL | — | Contact phone |
| `email` | `VARCHAR(150)` | `String?` | Yes | NULL | UNIQUE | Contact email |
| `currency` | `VARCHAR(3)` | `String` | No | `'USD'` | NOT NULL | ISO 4217 code: USD, COP, MXN |
| `status` | `tenant_status` | `TenantStatus` | No | `'active'` | NOT NULL | `active`, `inactive` |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | Last update (auto-managed by Prisma) |

### Enums

```
TenantStatus: active | inactive
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `tenant_pkey` | `id` | PRIMARY KEY |
| `tenant_email_key` | `email` | UNIQUE (nullable — only enforced when not null) |

### Relationships

| Relation | Type | Target | FK | Notes |
|---|---|---|---|---|
| `users` | One-to-Many | `user.tenant_id` | — | All users belonging to this tenant |
| `products` | One-to-Many | `product.tenant_id` | — | |
| `categories` | One-to-Many | `category.tenant_id` | — | |
| `tables` | One-to-Many | `table.tenant_id` | — | |
| `orders` | One-to-Many | `order.tenant_id` | — | |
| `customers` | One-to-Many | `customer.tenant_id` | — | |
| `delivery_persons` | One-to-Many | `delivery_person.tenant_id` | — | |
| `cash_registers` | One-to-Many | `cash_register.tenant_id` | — | |
| `movements` | One-to-Many | `movement.tenant_id` | — | |
| `suppliers` | One-to-Many | `supplier.tenant_id` | — | |
| `purchases` | One-to-Many | `purchase.tenant_id` | — | |
| `inventory_adjustments` | One-to-Many | `inventory_adjustment.tenant_id` | — | |
| `notifications` | One-to-Many | `notification.tenant_id` | — | |
| `audit_logs` | One-to-Many | `audit_log.tenant_id` | — | |

### Notes
- Managed exclusively by `super_admin`.
- `status = inactive` disables login for all users of that tenant.
- `currency` applies to all monetary values within the tenant; changing it after data exists requires a migration plan.
