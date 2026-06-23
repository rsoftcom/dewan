## 15. `order_status_history`

**Module:** Orders
**Description:** Immutable audit trail of every status transition on an order. Used for traceability and efficiency analysis.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `order_id` | `UUID` | `String` | No | — | FK → `order.id` ON DELETE CASCADE | |
| `status` | `order_status` | `OrderStatus` | No | — | NOT NULL | The status transitioned to |
| `changed_by` | `UUID` | `String` | No | — | FK → `user.id` | User who triggered the change |
| `changed_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `order_status_history_pkey` | `id` | PRIMARY KEY |
| `order_status_history_order_idx` | `order_id` | INDEX |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `order` | Many-to-One | `order.id` |
| `changed_by_user` | Many-to-One | `user.id` |

### Notes
- Records are **never updated or deleted**. Append-only.
- The first record is always `status = pending`, set at order creation.
- Time between consecutive statuses (e.g. `pending → in_kitchen`) is used for future performance reports.
