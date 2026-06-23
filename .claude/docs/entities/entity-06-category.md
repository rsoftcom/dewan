## 06. `category`

**Module:** Products
**Description:** Hierarchical product categories (parent → child). A product can belong to multiple categories (tag-like model).

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `tenant_id` | `UUID` | `String` | No | — | FK → `tenant.id` | |
| `name` | `VARCHAR(100)` | `String` | No | — | NOT NULL | e.g. Beverages, Starters, Desserts |
| `parent_id` | `UUID` | `String?` | Yes | NULL | FK → `category.id` | NULL = root category |
| `created_at` | `TIMESTAMPTZ` | `DateTime` | No | `now()` | NOT NULL | |

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `category_pkey` | `id` | PRIMARY KEY | |
| `category_tenant_idx` | `tenant_id` | INDEX | |
| `category_name_tenant_key` | `(name, tenant_id)` | UNIQUE | Name unique per tenant |

### Relationships

| Relation | Type | Target | Notes |
|---|---|---|---|
| `tenant` | Many-to-One | `tenant.id` | |
| `parent` | Many-to-One (self) | `category.id` | NULL for root categories |
| `children` | One-to-Many (self) | `category.parent_id` | Subcategories |
| `product_categories` | One-to-Many | `product_category.category_id` | |

### Notes
- Maximum hierarchy depth: 2 levels (parent → child). Deeper nesting is not supported in MVP.
- Deleting a category with children requires reassigning or deleting children first.
- Deleting a category unlinks it from all products (delete `product_category` rows) but does not delete the products.
