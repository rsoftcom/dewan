## 27. `menu_page`

**Module:** Public Menu
**Description:** A single "sheet" of the canvas editor (e.g. "Comidas", "Bebidas", "Postres"). A `menu` has one or more pages, rendered as tabs/swipe sections in the public view.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `menu_id` | `UUID` | `String` | No | — | FK → `menu.id` | |
| `name` | `VARCHAR(50)` | `String` | No | — | NOT NULL | Tab label, e.g. "Bebidas" |
| `order` | `INTEGER` | `Int` | No | `0` | NOT NULL | Display/tab order (0-based) |
| `width` | `INTEGER` | `Int` | No | `1080` | NOT NULL | Canvas width in px (design space, mobile-first) |
| `height` | `INTEGER` | `Int` | No | `1920` | NOT NULL | Canvas height in px (design space) |
| `background_color` | `VARCHAR(20)` | `String?` | Yes | NULL | — | Hex color, e.g. `#FFFAF6` |
| `background_image` | `TEXT` | `String?` | Yes | NULL | — | Public URL (Cloudflare R2) |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |
| `updated_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type |
|---|---|---|
| `menu_page_pkey` | `id` | PRIMARY KEY |
| `menu_page_menu_id_idx` | `menu_id` | INDEX |
| `menu_page_menu_id_order_idx` | `(menu_id, order)` | INDEX |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `menu` | Many-to-One | `menu.id` | |
| `elements` | One-to-Many | `menu_element.menu_page_id` | Ordered by `z_index` for rendering |

### Notes
- A `menu` must always have **at least one** `menu_page` once `status = published` (validated on publish, not on every save of a draft).
- `width`/`height` define the design canvas size used by the editor (drag/resize coordinates are relative to this). The public view scales this canvas responsively to the visitor's screen.
- Reordering pages (`order`) does not affect `slug` or `qr_code_url`.
- Hard delete: deleting a `menu_page` cascades to its `menu_element` rows (no soft delete — these are design artifacts, not business records).