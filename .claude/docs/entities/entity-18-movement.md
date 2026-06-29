## 18. `movement`

**Module:** Cash Register
**Description:** Manual cash inflows and outflows that are not sales (e.g. paying a supplier, receiving a loan).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `cash_register_id` | `UUID` | `String` | No | — | FK → `cash_register.id` | Must be an open register |
| `type` | `movement_type` | `MovementType` | No | — | NOT NULL | `income`, `expense`, `cost`, `sales` |
| `amount` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL, > 0 | |
| `description` | `VARCHAR(255)` | `String` | No | — | NOT NULL | Reason for the movement |
| `reference` | `VARCHAR(100)` | `String?` | Yes | NULL | — | Receipt or voucher reference |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
MovementType: income | expense | cost | sales
```
- `income` — Non-sale cash inflows (e.g. debt collection, received loan).
- `expense` — Operational outflows (e.g. supplier payment, petty cash purchase).
- `cost` — General overhead (e.g. utilities, rent, payroll).
- `sales` — Auto-generated movement created by the system when a payment is registered for an order.

### Indexes

| Index | Columns | Type |
|---|---|---|
| `movement_pkey` | `id` | PRIMARY KEY |
| `movement_tenant_idx` | `tenant_id` | INDEX |
| `movement_cash_register_idx` | `cash_register_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `cash_register` | Many-to-One | `cash_register.id` |

### Notes
- Movements are immutable once registered. No edit or delete — only new corrective movements.
- Creating a movement updates the corresponding totals on the parent `cash_register` row.
