## 16. `payment`

**Module:** Payments
**Description:** Payments associated with an order. Multiple payments per order are supported (mixed payment methods).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `order_id` | `UUID` | `String` | No | — | FK → `order.id` ON DELETE CASCADE | |
| `method` | `payment_method` | `PaymentMethod` | No | — | NOT NULL | `cash`, `card`, `transfer` |
| `amount` | `NUMERIC(12,2)` | `Decimal` | No | — | NOT NULL, > 0 | Amount paid with this method |
| `change_amount` | `NUMERIC(12,2)` | `Decimal?` | Yes | NULL | ≥ 0 | Cash change given back. Only for `cash` |
| `reference` | `VARCHAR(100)` | `String?` | Yes | NULL | — | Transaction reference (card/transfer) |
| `registered_by` | `UUID` | `String` | No | — | FK → `user.id` | |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
PaymentMethod: cash | card | transfer
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `payment_pkey` | `id` | PRIMARY KEY |
| `payment_order_idx` | `order_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `order` | Many-to-One | `order.id` |
| `registered_by_user` | Many-to-One | `user.id` |

### Notes
- The sum of all `payment.amount` for an order must be ≥ `order.total`. Enforced at service layer.
- `change_amount` is calculated by the service: `amount - remaining_balance`. Stored for receipt/audit purposes.
- A `cash_register` must be open when registering a payment. Enforced at service layer.
