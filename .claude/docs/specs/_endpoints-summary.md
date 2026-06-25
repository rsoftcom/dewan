# R Soft — Resumen de Endpoints y WebSocket

## Resumen de endpoints

|Módulo              |Método|Endpoint                            |Roles         |
|--------------------|------|------------------------------------|--------------|
|**Auth**            |POST  |`/auth/login`                       |Público       |
|                    |POST  |`/auth/refresh`                     |Público       |
|                    |POST  |`/auth/logout`                      |Todos         |
|                    |GET   |`/auth/me`                          |Todos         |
|                    |GET   |`/auth/my-tenants`                  |OW            |
|                    |POST  |`/auth/switch-tenant`               |OW            |
|**Users**           |POST  |`/users`                            |OW, AD        |
|                    |GET   |`/users`                            |OW, AD        |
|                    |GET   |`/users/:id`                        |OW, AD, self  |
|                    |PATCH |`/users/:id`                        |OW, AD        |
|                    |PATCH |`/users/:id/status`                 |OW, AD        |
|                    |POST  |`/users/:id/reset-password`         |OW, AD        |
|                    |POST  |`/users/me/change-password`         |Todos         |
|**Tenants**         |POST  |`/tenants`                          |SA            |
|                    |GET   |`/tenants`                          |SA            |
|                    |GET   |`/tenants/:id`                      |SA, OW, AD    |
|                    |PATCH |`/tenants/:id`                      |SA, OW, AD    |
|                    |PATCH |`/tenants/:id/status`               |SA            |
|                    |POST  |`/tenants/:id/link-owner`           |SA            |
|                    |DELETE|`/tenants/:id/link-owner/:userId`   |SA            |
|**Units**           |GET   |`/units`                            |Todos         |
|                    |POST  |`/units/conversions`                |SA            |
|                    |GET   |`/units/conversions`                |SA, OW, AD    |
|**Products**        |POST  |`/products`                         |OW, AD        |
|                    |GET   |`/products`                         |OW, AD, CA, WA|
|                    |GET   |`/products/:id`                     |OW, AD, CA, WA|
|                    |PATCH |`/products/:id`                     |OW, AD        |
|                    |PATCH |`/products/:id/status`              |OW, AD        |
|                    |PUT   |`/products/:id/recipe`              |OW, AD        |
|                    |DELETE|`/products/:id/recipe/:ingredientId`|OW, AD        |
|                    |PUT   |`/products/:id/categories`          |OW, AD        |
|**Categories**      |POST  |`/categories`                       |OW, AD        |
|                    |GET   |`/categories`                       |OW, AD, CA, WA|
|                    |PATCH |`/categories/:id`                   |OW, AD        |
|                    |DELETE|`/categories/:id`                   |OW, AD        |
|**Orders**          |POST  |`/orders`                           |OW, AD, CA, WA|
|                    |GET   |`/orders`                           |Todos         |
|                    |GET   |`/orders/:id`                       |Todos         |
|                    |POST  |`/orders/:id/items`                 |OW, AD, CA, WA|
|                    |DELETE|`/orders/:id/items/:itemId`         |OW, AD, CA, WA|
|                    |PATCH |`/orders/:id/serve`                 |OW, AD, CA, WA|
|                    |PATCH |`/orders/:id/complete`              |OW, AD, CA    |
|                    |PATCH |`/orders/:id/assign`                |OW, AD, CA    |
|                    |PATCH |`/orders/:id/on-the-way`            |OW, AD, CA    |
|                    |PATCH |`/orders/:id/delivered`             |OW, AD, CA    |
|                    |PATCH |`/orders/:id/money-collected`       |OW, AD, CA    |
|**Kitchen**         |GET   |`/kitchen/orders`                   |KI, OW, AD    |
|                    |PATCH |`/kitchen/orders/:id/accept`        |KI, OW, AD    |
|                    |PATCH |`/kitchen/orders/:id/ready`         |KI, OW, AD    |
|                    |PATCH |`/kitchen/orders/:id/reject`        |KI, OW, AD    |
|**Payments**        |POST  |`/orders/:id/payments`              |OW, AD, CA    |
|**Cash Register**   |GET   |`/cash-registers`                   |OW, AD, CA    |
|                    |POST  |`/cash-registers`                   |OW, AD, CA    |
|                    |GET   |`/cash-registers/current`           |OW, AD, CA    |
|                    |PATCH |`/cash-registers/current/close`     |OW, AD, CA    |
|**Movements**       |POST  |`/movements`                        |OW, AD, CA    |
|                    |GET   |`/movements`                        |OW, AD, CA    |
|**Customers**       |GET   |`/customers/search`                 |OW, AD, CA, WA|
|                    |POST  |`/customers`                        |OW, AD, CA, WA|
|                    |PATCH |`/customers/:id`                    |OW, AD, CA, WA|
|                    |GET   |`/customers`                        |OW, AD        |
|**Delivery Persons**|POST  |`/delivery-persons`                 |OW, AD        |
|                    |GET   |`/delivery-persons`                 |OW, AD, CA    |
|**Suppliers**       |POST  |`/suppliers`                        |OW, AD        |
|                    |GET   |`/suppliers`                        |OW, AD        |
|                    |PATCH |`/suppliers/:id`                    |OW, AD        |
|                    |PATCH |`/suppliers/:id/status`             |OW, AD        |
|**Purchases**       |POST  |`/purchases`                        |OW, AD        |
|                    |GET   |`/purchases`                        |OW, AD        |
|                    |GET   |`/purchases/:id`                    |OW, AD        |
|**Inventory**       |POST  |`/inventory/adjustments`            |OW, AD        |
|                    |GET   |`/inventory/adjustments`            |OW, AD        |
|                    |GET   |`/inventory/low-stock`              |OW, AD, CA    |
|**Reports**         |GET   |`/reports/sales`                    |OW, AD        |
|                    |GET   |`/reports/cash-register`            |OW, AD        |
|                    |GET   |`/reports/movements`                |OW, AD        |
|                    |GET   |`/reports/low-stock`                |OW, AD        |
|                    |GET   |`/reports/purchases`                |OW, AD        |
|**Notifications**   |GET   |`/notifications`                    |Todos         |
|                    |PATCH |`/notifications/read-all`           |Todos         |
|                    |PATCH |`/notifications/:id/read`           |Todos         |
|**Audit Log**       |GET   |`/audit-logs`                       |SA            |
|                    |GET   |`/audit-logs/entity/:entity/:id`    |SA            |
|**Owners**          |GET   |`/owners/dashboard`                 |OW            |

-----

## WebSocket — Canales y eventos

|Canal               |Suscriptores      |Eventos emitidos                                                                      |
|--------------------|------------------|--------------------------------------------------------------------------------------|
|`kitchen_[tenantId]`|KI, OW, AD        |`order:new`, `order:updated`, `order:rejected`                                        |
|`orders_[tenantId]` |CA, WA, OW, AD    |`order:ready`, `order:served`, `order:completed`, `order:assigned`, `order:on_the_way`|
|`user_[userId]`     |Usuario individual|`notification:new`                                                                    |

-----

*Fin del documento SDD — R Soft v1.1 — 22 módulos (19 Fase 1 + 3 Fase 2) · actualizado 2026-06-24*
