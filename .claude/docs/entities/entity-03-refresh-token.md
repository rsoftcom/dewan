## 03. `refresh_token`

**Module:** Auth
**Description:** Persistent store for JWT refresh tokens. Enables token rotation and revocation. Only the hash of the token is stored, never the raw value.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `user_id` | `UUID` | `String` | No | — | FK → `user.id` ON DELETE CASCADE | Token owner |
| `token_hash` | `TEXT` | `String` | No | — | NOT NULL, UNIQUE | SHA-256 hash of the raw token |
| `tenant_id` | `UUID` | `String?` | Yes | NULL | — | Tenant context at token issuance; NULL for `super_admin` |
| `expires_at` | `TIMESTAMPTZ` | `DateTime` | No | — | NOT NULL | `issued_at + 7 days` |
| `revoked` | `BOOLEAN` | `Boolean` | No | `false` | NOT NULL | True after use or explicit logout |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | Issuance timestamp |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `refresh_token_pkey` | `id` | PRIMARY KEY |
| `refresh_token_hash_key` | `token_hash` | UNIQUE |
| `refresh_token_user_idx` | `user_id` | INDEX |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `user` | Many-to-One | `user.id` | CASCADE DELETE: if user is deleted, all tokens are removed |

### Notes
- Token rotation is mandatory: every refresh call revokes the current token and issues a new one.
- If a revoked token is presented again, **all** tokens for that user are revoked immediately (stolen token protection).
- A daily cron job (`@nestjs/schedule`) should clean up rows where `expires_at < now()` AND `revoked = true`.
- Raw token is stored only in the `HttpOnly` cookie on the client. The database only holds `SHA-256(token)`.
