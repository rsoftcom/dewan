# R Soft — Entity Relationships

## Entity Relationship Summary

```
tenant ──────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├── user ──── refresh_token                                         │
  │                                                                   │
  ├── unit ──── unit_conversion                                       │
  │                                                                   │
  ├── category (self-ref: parent_id)                                  │
  │                                                                   │
  ├── product ─── product_category ─── category                      │
  │     └─────── recipe_item (product → ingredient)                  │
  │                                                                   │
  ├── table                                                           │
  │                                                                   │
  ├── customer                                                        │
  │                                                                   │
  ├── delivery_person                                                 │
  │                                                                   │
  ├── order ─── order_item ─── product                               │
  │     ├────── order_status_history                                  │
  │     └────── payment                                               │
  │                                                                   │
  ├── cash_register ─── movement                                      │
  │                                                                   │
  ├── supplier ─── purchase ─── purchase_item ─── product            │
  │                                                                   │
  ├── inventory_adjustment ─── product                               │
  │                                                                   │
  ├── notification ─── user                                           │
  │                                                                   │
  └── audit_log ─── user                                             │
                                                                      │
All entities above reference tenant ──────────────────────────────────┘
```

---

*End of entity reference — R Soft v1.0*
