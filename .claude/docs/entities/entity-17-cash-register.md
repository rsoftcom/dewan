## 17. `cash_register`

**Module:** Cash Register
**Description:** Daily cash register session for a tenant. Only one session can be open at a time.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `date` | `DATE` | `DateTime` | No | — | NOT NULL | Operating date |
| `initial_amount` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL, ≥ 0 | Cash at opening |
| `final_amount` | `NUMERIC(12,2)` | `Decimal?` | Yes | NULL | ≥ 0 | Cash at closing (set on close) |
| `total_sales` | `NUMERIC(12,2)` | `Decimal` | No | `0` | NOT NULL | Auto: sum of completed order payments |
| `total_income` | `NUMERIC(12,2)` | `Decimal` | No | `0` | NOT NULL | Auto: sum of `movement.type = income` |
| `total_expense` | `NUMERIC(12,2)` | `Decimal` | No | `0` | NOT NULL | Auto: sum of `movement.type = expense | cost` |
| `difference` | `NUMERIC(12,2)` | `Decimal?` | Yes | NULL | — | Set on close: `final - (initial + sales + income - expense)` |
| `status` | `cash_register_status` | `CashRegisterStatus` | No | `'open'` | NOT NULL | `open`, `closed` |
| `open_notes` | `TEXT` | `String?` | Yes | NULL | — | |
| `close_notes` | `TEXT` | `String?` | Yes | NULL | — | |
| `opened_by` | `UUID` | `String` | No | — | FK → `user.id` | |
| `closed_by` | `UUID` | `String?` | Yes | NULL | FK → `user.id` | Set on close |
| `opened_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `closed_at` | `TIMESTAMPTZ` | `DateTime?` | Yes | NULL | — | Set on close |

### Enums

```
CashRegisterStatus: open | closed
```

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `cash_register_pkey` | `id` | PRIMARY KEY | |
| `cash_register_tenant_idx` | `tenant_id` | INDEX | |
| `cash_register_open_tenant_key` | `tenant_id` WHERE `status = 'open'` | UNIQUE PARTIAL | Enforces one open register per tenant |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `opened_by_user` | Many-to-One | `user.id` |
| `closed_by_user` | Many-to-One | `user.id` |
| `movements` | One-to-Many | `movement.cash_register_id` |

### Notes
- The partial unique index on `(tenant_id WHERE status = 'open')` is the key constraint that prevents two simultaneous open registers.
- `total_sales`, `total_income`, and `total_expense` are updated in real time as payments and movements are registered.
- `difference` is only calculated and stored at closing time.
