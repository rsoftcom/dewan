## 12. `delivery_person`

**Module:** Delivery
**Description:** Delivery staff records. In MVP they do not have system login; they are operational records only.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(150)` | `String` | No | — | NOT NULL | |
| `phone` | `VARCHAR(30)` | `String` | No | — | NOT NULL | |
| `status` | `delivery_person_status` | `DeliveryPersonStatus` | No | `'available'` | NOT NULL | `available`, `on_delivery` |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
DeliveryPersonStatus: available | on_delivery
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `delivery_person_pkey` | `id` | PRIMARY KEY |
| `delivery_person_tenant_idx` | `tenant_id` | INDEX |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | |
| `orders` | One-to-Many | `order.delivery_person_id` | Orders currently assigned |

### Notes
- `status` changes to `on_delivery` when assigned to an order, and back to `available` when the order reaches `money_collected`.
- Future: will be linked to a `user` with `role = delivery` for app-based tracking.
