## 23. `notification`

**Module:** Notifications
**Description:** In-app notifications for system users. Push and email are out of scope for MVP.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `user_id` | `UUID` | `String` | No | — | FK → `user.id` | Recipient |
| `title` | `VARCHAR(150)` | `String` | No | — | NOT NULL | Short title |
| `message` | `TEXT` | `String` | No | — | NOT NULL | Full notification content |
| `type` | `notification_type` | `NotificationType` | No | — | NOT NULL | See enum below |
| `is_read` | `BOOLEAN` | `Boolean` | No | `false` | NOT NULL | |
| `entity` | `VARCHAR(50)` | `String?` | Yes | NULL | — | Related entity name (e.g. `product`, `order`) |
| `entity_id` | `UUID` | `String?` | Yes | NULL | — | Related entity ID for deep-link navigation |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
NotificationType: low_stock | new_order | order_status | cash_register | system
```

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `notification_pkey` | `id` | PRIMARY KEY | |
| `notification_user_idx` | `user_id` | INDEX | |
| `notification_tenant_idx` | `tenant_id` | INDEX | |
| `notification_unread_user_idx` | `(user_id, is_read)` | INDEX | Fast unread count queries |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `tenant` | Many-to-One | `tenant.id` |
| `user` | Many-to-One | `user.id` |

### Notes
- Notifications are delivered in real time via WebSocket (`notification:new` event).
- Marking as read is a bulk operation: `PATCH /notifications/read-all` sets all `is_read = true` for a user.
- Old read notifications should be cleaned up by a cron job (e.g. retain last 90 days).
- `entity` + `entity_id` enable frontend deep-linking: clicking a `low_stock` notification navigates to the product detail page.
