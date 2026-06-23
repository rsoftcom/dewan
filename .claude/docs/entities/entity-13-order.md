## 13. `order`

**Module:** Orders
**Description:** Central sales entity. Supports two types: `local` (dine-in) and `delivery`. Drives the real-time kitchen and delivery flows.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `type` | `order_type` | `OrderType` | No | — | NOT NULL | `local`, `delivery` |
| `status` | `order_status` | `OrderStatus` | No | `'pending'` | NOT NULL | See state machine below |
| `table_id` | `UUID` | `String?` | Yes | NULL | FK → `table.id` | Required if `type = local` |
| `customer_id` | `UUID` | `String?` | Yes | NULL | FK → `customer.id` | Required if `type = delivery` |
| `delivery_person_id` | `UUID` | `String?` | Yes | NULL | FK → `delivery_person.id` | Assigned when leaving kitchen |
| `created_by` | `UUID` | `String` | No | — | FK → `user.id` | |
| `notes` | `TEXT` | `String?` | Yes | NULL | — | General order notes |
| `rejection_reason` | `TEXT` | `String?` | Yes | NULL | — | Required if `status = rejected` |
| `total` | `NUMERIC(12,2)` | `Decimal` | No | `0` | NOT NULL, ≥ 0 | Sum of `order_item.subtotal` values |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
OrderType:   local | delivery

OrderStatus: pending | in_kitchen | prepared | served | assigned |
             on_the_way | delivered | money_collected | paid | completed | rejected
```

### State machine

```
LOCAL:    pending → in_kitchen → prepared → served → paid → completed
                 ↘ rejected (from pending or in_kitchen)

DELIVERY: pending → in_kitchen → prepared → assigned → on_the_way → delivered → money_collected → completed
                 ↘ rejected (from pending or in_kitchen)
```

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `order_pkey` | `id` | PRIMARY KEY | |
| `order_tenant_idx` | `tenant_id` | INDEX | |
| `order_status_tenant_idx` | `(status, tenant_id)` | INDEX | Kitchen and dashboard queries |
| `order_table_idx` | `table_id` | INDEX | |
| `order_created_at_idx` | `created_at` | INDEX | Report date-range queries |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | |
| `table` | Many-to-One | `table.id` | NULL for delivery orders |
| `customer` | Many-to-One | `customer.id` | NULL for local orders |
| `delivery_person` | Many-to-One | `delivery_person.id` | NULL until assigned |
| `created_by_user` | Many-to-One | `user.id` | |
| `order_items` | One-to-Many | `order_item.order_id` | |
| `status_history` | One-to-Many | `order_status_history.order_id` | |
| `payments` | One-to-Many | `payment.order_id` | |

### Notes
- Stock deduction happens automatically when status transitions to `in_kitchen`.
- `total` is recalculated on every `order_item` change before the order reaches `in_kitchen`. After that, it is immutable.
- An open `cash_register` must exist to complete an order (`paid` or `completed`). Enforced at service layer.
- `rejection_reason` is mandatory if `status = rejected`. CHECK constraint at DB level.
