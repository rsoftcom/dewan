# SPEC-03: Tenants

**Descripción:** Gestión de negocios (tenants) por parte del `super_admin`. Cada tenant es un negocio independiente en el sistema.

**Actores:** `super_admin` (CRUD completo), `owner`/`admin` (ver y actualizar su propio tenant)

**Entidades:** `tenant`

-----

## UC-03-01: Crear tenant

**Actor:** `super_admin`
**Roles permitidos:** SA

**Flujo principal:**

1. SA envía `POST /tenants` con datos del nuevo negocio.
1. Sistema valida que `email` (si se proporciona) no esté duplicado globalmente.
1. Sistema crea el tenant con `status = active`.
1. Sistema crea automáticamente el usuario `owner` inicial para ese tenant (nombre, email y contraseña temporal).
1. Sistema envía email de bienvenida al owner con credenciales temporales.
1. Registra evento `create` en `audit_log` (con `tenant_id` del nuevo tenant).

**Excepciones:**

|ID |Condición                            |Respuesta                                    |
|---|-------------------------------------|---------------------------------------------|
|E01|Email del tenant duplicado           |`409` — “Ya existe un negocio con ese email.”|
|E02|Email del owner ya existe globalmente|`409` — “El email del owner ya está en uso.” |
|E03|`currency` inválido (no ISO 4217)    |`400`                                        |

**Criterios de aceptación:**

```gherkin
Scenario: Creación exitosa de tenant con owner inicial
  Given un super_admin autenticado
  When envía POST /api/v1/tenants con datos del negocio y owner inicial
  Then recibe status 201
  And el tenant tiene status "active"
  And se crea un usuario owner vinculado al tenant
  And el owner recibe email con credenciales temporales

Scenario: Email del tenant duplicado
  When se crea un tenant con email ya registrado
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/tenants`

Request:

```json
{
  "name": "Restaurante El Rincón",
  "businessType": "restaurant",
  "currency": "COP",
  "email": "contacto@elrincon.com",
  "phone": "+573001234567",
  "address": "Calle 10 # 20-30, Bogotá",
  "owner": {
    "name": "Carlos Ruiz",
    "email": "carlos@elrincon.com"
  }
}
```

Response 201:

```json
{
  "id": "uuid",
  "name": "Restaurante El Rincón",
  "businessType": "restaurant",
  "currency": "COP",
  "status": "active",
  "createdAt": "2026-05-19T10:00:00Z",
  "owner": { "id": "uuid", "name": "Carlos Ruiz", "email": "carlos@elrincon.com" }
}
```

-----

## UC-03-02: Listar tenants

**Actor:** `super_admin`
**Roles permitidos:** SA

**Flujo principal:**

1. SA envía `GET /tenants` con filtros opcionales.
1. Sistema retorna lista paginada de todos los tenants.
1. Soporta filtro por `status` y búsqueda por `name`.

**Contrato API:**

`GET /api/v1/tenants?status=active&search=rincon&page=1&limit=20`

Response 200: Wrapper de paginación con array de tenants (sin datos de usuarios).

-----

## UC-03-03: Obtener tenant por ID

**Actor:** `super_admin`, `owner`, `admin`
**Roles permitidos:** SA (cualquier tenant) · OW, AD (solo su tenant)

**Flujo principal:**

1. Actor envía `GET /tenants/:id`.
1. Sistema valida acceso: SA puede ver cualquier tenant; OW/AD solo su `tenantId` del token.
1. Retorna los datos completos del tenant.

**Excepciones:**

|ID |Condición                    |Respuesta|
|---|-----------------------------|---------|
|E01|Tenant no encontrado         |`404`    |
|E02|OW/AD intenta ver otro tenant|`403`    |

**Contrato API:**

`GET /api/v1/tenants/:id`

Response 200: Objeto tenant completo.

-----

## UC-03-04: Actualizar tenant

**Actor:** `super_admin`, `owner`, `admin`
**Roles permitidos:** SA (cualquier tenant) · OW, AD (solo su tenant, campos limitados)

**Flujo principal:**

1. Actor envía `PATCH /tenants/:id` con campos a modificar.
1. Sistema valida permisos de acceso.
1. OW/AD solo pueden modificar: `name`, `logo`, `address`, `phone`, `email`, `businessType`.
1. SA puede modificar cualquier campo incluyendo `currency`.
1. Actualiza los campos. Registra `update` en `audit_log`.

**Reglas de negocio:**

- RN-13: Cambiar `currency` requiere ser SA. Se advierte que los precios históricos no se convierten.

**Criterios de aceptación:**

```gherkin
Scenario: Owner actualiza dirección de su negocio
  Given un owner autenticado
  When envía PATCH /api/v1/tenants/:id con { address: "Nueva Dirección" }
  Then recibe status 200 con datos actualizados

Scenario: Owner intenta cambiar currency
  When un owner envía PATCH con { currency: "USD" }
  Then recibe status 403
```

**Contrato API:**

`PATCH /api/v1/tenants/:id`

Request: Subconjunto de campos permitidos.

Response 200: Objeto tenant actualizado.

-----

## UC-03-05: Cambiar estado del tenant

**Actor:** `super_admin`
**Roles permitidos:** SA

**Flujo principal:**

1. SA envía `PATCH /tenants/:id/status` con `{ status: "inactive" }`.
1. Sistema actualiza `status` del tenant.
1. Si `status = inactive`: todos los usuarios del tenant quedan imposibilitados de hacer login (verificación en UC-01-01 paso 3, a nivel de tenant).
1. Registra `status_change` en `audit_log`.

**Reglas de negocio:**

- RN-14: Desactivar un tenant no elimina datos. Es reversible.
- RN-15: Los Refresh Tokens activos de los usuarios del tenant se revocan al desactivar.

**Criterios de aceptación:**

```gherkin
Scenario: Desactivar tenant
  Given un super_admin y un tenant activo
  When envía PATCH /api/v1/tenants/:id/status con { status: "inactive" }
  Then recibe status 200
  And ningún usuario del tenant puede hacer login
  And los refreshTokens de los usuarios quedan revocados

Scenario: Reactivar tenant
  When envía { status: "active" }
  Then el tenant se reactiva y sus usuarios pueden volver a autenticarse
```

**Contrato API:**

`PATCH /api/v1/tenants/:id/status`

Request: `{ "status": "inactive" }`

Response 200: `{ "id": "uuid", "status": "inactive" }`
