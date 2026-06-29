## 12. Delivery person (no model — uses `user`)

**Module:** Delivery
**Description:** There is **no separate `DeliveryPerson` table** in the database. Delivery staff are
`User` records with `role = 'delivery'`. The `Order` model holds a nullable FK
`delivery_person_id → user.id` that is populated when the order is assigned to a delivery user.

### How delivery users are identified

```
User.role = 'delivery'
```

All users with this role appear in the delivery assignment UI and can be assigned to delivery orders.

### Relevant fields on related models

**`order.delivery_person_id`** (`UUID?` FK → `user.id`):
- NULL until a delivery order is assigned to a user.
- Set when order transitions from `prepared` → `assigned`.
- The assigned user must have `role = 'delivery'` and belong to the same tenant.

**`user` fields used for delivery context:**

| Field | Description |
|---|---|
| `id` | PK used as `order.delivery_person_id` |
| `name` | Displayed as the delivery person's name |
| `role` | Must be `delivery` |
| `status` | `active` to appear as assignable; `inactive` to hide |
| `tenant_id` | Scoped per tenant |

### Order status flow for delivery orders

```
pending → in_kitchen → prepared → assigned → on_the_way → delivered → money_collected → completed
                                  ↑
                          delivery_person_id set here
```

### Notes
- Delivery users **do** have system login credentials (email + password), unlike the old spec
  that described them as non-login operational records.
- Filtering active delivery users for assignment: `User.findMany({ where: { tenantId, role: 'delivery', status: 'active' } })`.
- A delivery user can be assigned to multiple orders simultaneously (no concurrency lock in MVP).
