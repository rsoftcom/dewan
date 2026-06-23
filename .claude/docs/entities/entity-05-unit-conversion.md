## 05. `unit_conversion`

**Module:** Products
**Description:** Conversion factors between units of measurement. Enables buying in one unit and consuming in another.

### Attributes

| Column | PostgreSQL Type | Prisma Type | Nullable | Default | Constraints | Description |
|--------|----------------|-------------|----------|---------|-------------|-------------|
| `id` | `UUID` | `String` | No | `gen_random_uuid()` | PK | |
| `from_unit_id` | `UUID` | `String` | No | — | FK → `unit.id` | Source unit |
| `to_unit_id` | `UUID` | `String` | No | — | FK → `unit.id` | Target unit |
| `factor` | `NUMERIC(18,8)` | `Decimal` | No | — | NOT NULL, > 0 | Multiplier: `from * factor = to`. e.g. 1 kg → g: factor = 1000 |

### Indexes

| Index | Columns | Type | Notes |
|---|---|---|---|
| `unit_conversion_pkey` | `id` | PRIMARY KEY | |
| `unit_conversion_pair_key` | `(from_unit_id, to_unit_id)` | UNIQUE | A pair can only have one conversion |

### Relationships

| Relation | Type | Target |
|---|---|---|
| `from_unit` | Many-to-One | `unit.id` |
| `to_unit` | Many-to-One | `unit.id` |

### Notes
- Conversions are global (not tenant-scoped).
- Conversion is unidirectional. To convert both ways, two records are needed: `kg→g (1000)` and `g→kg (0.001)`.
- `factor` uses 8 decimal places to handle micro-unit conversions accurately.
- The system uses this table when a `recipe_item.unit_id` differs from the ingredient's `product.unit_id`.
