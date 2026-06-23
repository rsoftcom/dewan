## 24. `audit_log`

**Module:** Audit
**Description:** Immutable record of all critical system actions. Append-only. Never updated or deleted.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `user_id` | `UUID` | `String` | No | — | FK → `user.id` | Actor |
| `user_name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | Snapshot of user name at action time |
| `action` | `VARCHAR(50)` | `String` | No | — | NOT NULL | e.g. `create`, `update`, `delete`, `status_change`, `login` |
| `entity` | `VARCHAR(50)` | `String` | No | — | NOT NULL | Name of the affected entity (e.g. `product`, `order`) |
| `entity_id` | `UUID` | `String` | No | — | NOT NULL | ID of the affected record |
| `metadata` | `JSONB` | `Json?` | Yes | NULL | — | Previous/new values or additional context |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `audit_log_pkey` | `id` | PRIMARY KEY | |
| `audit_log_tenant_idx` | `tenant_id` | INDEX | |
| `audit_log_user_idx` | `user_id` | INDEX | |
| `audit_log_entity_idx` | `(entity, entity_id)` | INDEX | Filter by specific record history |
| `audit_log_created_at_idx` | `created_at` | INDEX | Date-range filtering |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `user` | Many-to-One | `user.id` |

### Logged actions

| Entity | Actions logged |
|---|---|
| `user` | `create`, `update`, `status_change`, `login`, `logout`, `password_reset` |
| `product` | `create`, `update`, `status_change` |
| `order` | `create`, `status_change` |
| `payment` | `create` |
| `cash_register` | `open`, `close` |
| `movement` | `create` |
| `purchase` | `create` |
| `inventory_adjustment` | `create` |
| `supplier` | `create`, `update`, `status_change` |
| `tenant` | `create`, `update`, `status_change` |

### Notes
- `user_name` is a snapshot to preserve the display name even if the user is later renamed or deleted.
- `metadata` in JSONB stores before/after values for `update` actions: `{ "before": {...}, "after": {...} }`.
- Implemented as a NestJS interceptor (`AuditLogInterceptor`) applied to all critical endpoints.
- `super_admin` actions on `tenant` entities are also logged here, using the tenant being affected.
- Access restricted to `owner` and `admin` roles via `RolesGuard`.
