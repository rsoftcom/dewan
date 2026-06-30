## 26. `menu`

**Module:** Public Menu
**Description:** Root entity of the public menu feature. One tenant has exactly one `menu` in MVP (1:1). Holds the public-facing identity (slug, QR) and publication state — independent from its visual content (`menu_page` / `menu_element`).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id`, UNIQUE | 1:1 with tenant in MVP |
| `slug` | `VARCHAR(60)` | `String` | No | — | UNIQUE, NOT NULL | Public URL segment: `getdewan.com/m/{slug}` |
| `status` | `menu_status` | `MenuStatus` | No | `'draft'` | NOT NULL | `draft`, `published` |
| `qr_code_url` | `TEXT` | `String?` | Yes | NULL | — | Public URL (Cloudflare R2) of the generated QR image (PNG/SVG) |
| `published_at` | `TIMESTAMPTZ` | `DateTime?` | Yes | NULL | — | Set on first publish. Never reset by content edits |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Enums

```
MenuStatus: draft | published
```

### Indexes

| Index | Columns | Type |
|---|---|---|
| `menu_pkey` | `id` | PRIMARY KEY |
| `menu_tenant_id_key` | `tenant_id` | UNIQUE |
| `menu_slug_key` | `slug` | UNIQUE |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | One-to-One | `tenant.id` | |
| `pages` | One-to-Many | `menu_page.menu_id` | Ordered by `menu_page.order` |

### Notes
- `slug` is generated automatically from `tenant.name` on first creation (slugified, lowercase, deduplicated with a numeric suffix if needed) and can be edited manually by `owner`/`admin` before the first publish. **Changing the `slug` after publishing regenerates the QR and invalidates the previous public URL** — this must be an explicit, warned action (see SPEC-26 UC-26-06).
- `qr_code_url` is generated **once**, the first time `status` transitions to `published`. Subsequent edits to pages/elements (content updates) never touch `slug` or `qr_code_url` — the public URL and QR remain permanently stable across content changes.
- While `status = draft`, the public URL returns `404` to anyone except authenticated tenant users (who see a preview).
- Soft delete does not apply; a tenant without a `menu` row simply has no public menu (lazy-created on first editor visit).