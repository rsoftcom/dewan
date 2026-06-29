# Dewan — Entity Relationships

> **Última actualización:** 2026-06-28

## Entity Relationship Summary

```
┌── unit ──── unit_conversion    [GLOBAL — no tenant_id, shared across all tenants]
│
tenant ──────────────────────────────────────────────────────────────┐
  │                                                                   │
  ├── user ──── refresh_token                                         │
  │     └────── user_tenant (junction: owner → extra tenants)        │
  │                                                                   │
  ├── category (self-ref: parent_id)    [HARD DELETE — no status]    │
  │                                                                   │
  ├── product ─── product_category ─── category                      │
  │     └──────── recipe_item (product → ingredient [product])        │
  │                                                                   │
  ├── table                                                           │
  │                                                                   │
  ├── customer                                                        │
  │                                                                   │
  ├── order ──── order_item ──── product                             │
  │     │  [order.deliveryPersonId → user (role: delivery)]          │
  │     ├─────── order_status_history                                 │
  │     └─────── payment                                              │
  │                                                                   │
  ├── cash_register ──── movement                                     │
  │                                                                   │
  ├── supplier ──── purchase ──── purchase_item ──── product         │
  │                                                                   │
  ├── inventory_adjustment ──── product                              │
  │                                                                   │
  ├── notification ──── user                                          │
  │                                                                   │
  └── audit_log ──── user                                            │
                                                                      │
All entities above (except unit/unit_conversion) reference tenant ───┘
```

## Key Notes

- **`unit` / `unit_conversion`** — global entities, not tenant-scoped. Shared across all tenants.
- **Delivery person** — there is no separate `DeliveryPerson` model. Delivery staff are `User` records with `role: delivery`. `Order.deliveryPersonId` is a foreign key to `User.id`.
- **`UserTenant`** — junction table for multi-tenant ownership. An owner's primary tenant comes from `User.tenantId`; additional tenants are stored in `UserTenant` rows. Used by `GET /auth/my-tenants` and `GET /owners/dashboard`.
- **`Category`** — only entity with **hard delete** (no `status` field). All other business entities use `status: active | inactive` (soft delete).
- **`Purchase` / `InventoryAdjustment` / `Movement`** — immutable after creation (no edit/delete endpoints).
- **`AuditLog`** — all mutations call `AuditLogService.log()` explicitly in service methods. `super_admin` actions are NOT logged (no tenantId).

## Prisma Model Count

24 models in `prisma/schema.prisma`:
`Tenant`, `User`, `UserTenant`, `RefreshToken`, `AuditLog`,
`Unit`, `UnitConversion`,
`Category`, `Product`, `ProductCategory`, `RecipeItem`,
`Table`, `Customer`,
`Order`, `OrderItem`, `OrderStatusHistory`, `Payment`,
`CashRegister`, `Movement`,
`Supplier`, `Purchase`, `PurchaseItem`,
`InventoryAdjustment`, `Notification`

---

*Dewan entity relationships — updated 2026-06-28*
