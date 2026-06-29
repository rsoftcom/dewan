## 25. `user_tenant`

**Module:** Tenants / Auth
**Description:** Junction table for multi-tenant ownership. Allows an `owner` user to be linked to
more than one tenant. The user's **primary** tenant comes from `User.tenantId`; additional tenants
are stored here as `UserTenant` rows.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `user_id` | `UUID` | `String` | No | — | PK part, FK → `user.id` ON DELETE CASCADE | The owner user |
| `tenant_id` | `UUID` | `String` | No | — | PK part, FK → `tenant.id` ON DELETE CASCADE | The additional tenant |

### Primary Key

Composite PK: `(user_id, tenant_id)`.

### Indexes

| Index | Columns | Type |
|---|---|---|
| `user_tenants_pkey` | `(user_id, tenant_id)` | PRIMARY KEY (composite) |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `user` | Many-to-One | `user.id` | The owner user. CASCADE DELETE |
| `tenant` | Many-to-One | `tenant.id` | The linked tenant. CASCADE DELETE |

### Notes
- Only `owner` role users are expected to have extra tenants via this table, but there is no DB constraint enforcing this — it is enforced at service layer.
- Used by `GET /auth/my-tenants` to return all tenants an owner can access (primary + extras).
- Used by `GET /owners/dashboard` to aggregate data across tenants.
- Deleting a user or tenant cascades to remove the corresponding junction rows automatically.
- A row here does NOT give the user a different role in the extra tenant — they inherit their base `role` field.
