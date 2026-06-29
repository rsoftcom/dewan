## 02. `user`

**Module:** Users / Auth
**Description:** System users with assigned roles. Authenticated via JWT. `super_admin` is the only user without a `tenant_id`.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String?` | Yes | NULL | FK → `tenant.id` | NULL only for `super_admin` |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | Full name |
| `email` | `VARCHAR(150)` | `String` | No | — | NOT NULL | Login email |
| `password_hash` | `TEXT` | `String` | No | — | NOT NULL | bcrypt hash |
| `role` | `user_role` | `UserRole` | No | — | NOT NULL | See enum below |
| `status` | `user_status` | `UserStatus` | No | `'active'` | NOT NULL | `active`, `inactive` |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
UserRole:   super_admin | owner | admin | cashier | waiter | kitchen | delivery
UserStatus: active | inactive
```

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `user_pkey` | `id` | PRIMARY KEY | |
| `user_email_tenant_key` | `(email, tenant_id)` | UNIQUE | Email unique per tenant |
| `user_email_global_key` | `email` WHERE `tenant_id IS NULL` | UNIQUE PARTIAL | Ensures super_admin email is globally unique |
| `user_tenant_idx` | `tenant_id` | INDEX | Tenant isolation queries |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | NULL for `super_admin` |
| `extra_tenants` | One-to-Many | `user_tenant.user_id` | Additional tenants for multi-tenant ownership |
| `refresh_tokens` | One-to-Many | `refresh_token.user_id` | Active sessions |
| `orders_created` | One-to-Many | `order.created_by` | Orders created by this user |
| `orders_as_delivery` | One-to-Many | `order.delivery_person_id` | Orders where this user is the delivery person (role: delivery) |
| `payments_registered` | One-to-Many | `payment.registered_by` | |
| `order_status_changes` | One-to-Many | `order_status_history.changed_by` | |
| `cash_registers_opened` | One-to-Many | `cash_register.opened_by` | |
| `cash_registers_closed` | One-to-Many | `cash_register.closed_by` | |
| `purchases_registered` | One-to-Many | `purchase.registered_by` | |
| `notifications` | One-to-Many | `notification.user_id` | Notifications for this user |
| `audit_logs` | One-to-Many | `audit_log.user_id` | Actions performed by this user |

### Notes
- `password_hash` is **never** returned in any API response. The NestJS `UserService` must explicitly exclude it.
- A `super_admin` user bypasses tenant guards. There should be exactly **one** `super_admin` in the system; seeded during setup.
- `status = inactive` prevents login; existing tokens remain valid until expiry (15 min max).
- Email is case-insensitive at login; stored in lowercase.
