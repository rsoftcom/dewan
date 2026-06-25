# R Soft — Spec-Driven Development (SDD)

## Especificaciones completas de casos de uso

> **Versión:** 1.0
> **Fecha:** 2026-05-19
> **Stack:** NestJS · Prisma · PostgreSQL 16 · Angular 18 · Socket.io
> **Convención:** Todos los endpoints usan el prefijo base `/v1` (configurado en `main.ts` via `setGlobalPrefix('v1')`). **No** `/api/v1`. Auth requerida salvo indicación contraria. Todos los listados soportan paginación con `?page=1&limit=20`.

-----

## Tabla de contenido

|#                                |Módulo       |Casos de uso       |
|---------------------------------|-------------|-------------------|
|[SPEC-01](#spec-01-auth)         |Auth         |UC-01-01 a UC-01-04|
|[SPEC-02](#spec-02-users)        |Users        |UC-02-01 a UC-02-07|
|[SPEC-03](#spec-03-tenants)      |Tenants      |UC-03-01 a UC-03-05|
|[SPEC-04](#spec-04-units)        |Units        |UC-04-01 a UC-04-03|
|[SPEC-05](#spec-05-products)     |Products     |UC-05-01 a UC-05-07|
|[SPEC-06](#spec-06-categories)   |Categories   |UC-06-01 a UC-06-05|
|[SPEC-07](#spec-07-orders)       |Orders       |UC-07-01 a UC-07-06|
|[SPEC-08](#spec-08-kitchen)      |Kitchen      |UC-08-01 a UC-08-05|
|[SPEC-09](#spec-09-payments)     |Payments     |UC-09-01 a UC-09-03|
|[SPEC-10](#spec-10-cash-register)|Cash Register|UC-10-01 a UC-10-03|
|[SPEC-11](#spec-11-movements)    |Movements    |UC-11-01 a UC-11-02|
|[SPEC-12](#spec-12-customers)    |Customers    |UC-12-01 a UC-12-04|
|[SPEC-13](#spec-13-delivery)     |Delivery     |UC-13-01 a UC-13-06|
|[SPEC-14](#spec-14-suppliers)    |Suppliers    |UC-14-01 a UC-14-04|
|[SPEC-15](#spec-15-purchases)    |Purchases    |UC-15-01 a UC-15-03|
|[SPEC-16](#spec-16-inventory)    |Inventory    |UC-16-01 a UC-16-03|
|[SPEC-17](#spec-17-reports)      |Reports      |UC-17-01 a UC-17-05|
|[SPEC-18](#spec-18-notifications)|Notifications|UC-18-01 a UC-18-03|
|[SPEC-19](#spec-19-audit-log)    |Audit Log    |UC-19-01 a UC-19-02|

-----

## Convenciones globales

### Roles y permisos

|Rol          |Abreviatura|
|-------------|-----------|
|`super_admin`|SA         |
|`owner`      |OW         |
|`admin`      |AD         |
|`cashier`    |CA         |
|`waiter`     |WA         |
|`kitchen`    |KI         |
|`delivery`   |DE         |

### Formato de respuesta de error estándar

```json
{
  "statusCode": 400,
  "message": ["campo requerido", "formato inválido"],
  "error": "Bad Request"
}
```

### Paginación estándar (todos los listados)

**Query params:** `?page=1&limit=20`

**Response wrapper:**

```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

-----

-----
