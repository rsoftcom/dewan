# SPEC-02: Users

**Descripción:** Gestión completa del ciclo de vida de usuarios dentro de un tenant. El `super_admin` gestiona usuarios de cualquier tenant.

**Actores:** `owner`, `admin` (gestión), cualquier usuario (perfil propio)

**Entidades:** `user`

-----

## UC-02-01: Crear usuario

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Precondiciones:**

- Existe un tenant activo.
- No existe otro usuario con el mismo `email` dentro del tenant.
- Un `admin` no puede crear un usuario con `role = owner`.

**Flujo principal:**

1. Actor envía `POST /users` con los datos del nuevo usuario.
1. Sistema valida que `email` sea único en el tenant.
1. Sistema valida que el rol asignado sea compatible con el rol del creador (ver RN-06).
1. Sistema genera `password_hash` con `bcrypt` (costo factor 12).
1. Sistema crea el usuario con `status = active`.
1. Sistema envía email de bienvenida con contraseña temporal vía SES.
1. Registra evento `create` en `audit_log`.
1. Retorna el usuario creado (sin `password_hash`).

**Excepciones:**

|ID |Condición                    |Respuesta                                             |
|---|-----------------------------|------------------------------------------------------|
|E01|Email duplicado en el tenant |`409` — “El email ya está registrado en este negocio.”|
|E02|Rol inválido para el creador |`403` — “No puedes asignar este rol.”                 |
|E03|Campos obligatorios faltantes|`400` — lista de errores                              |

**Reglas de negocio:**

- RN-06: Jerarquía de roles — un `admin` puede crear: `admin`, `cashier`, `waiter`, `kitchen`, `delivery`. Un `owner` puede crear cualquier rol excepto `super_admin`.
- RN-07: La contraseña inicial es generada por el sistema (random 12 chars). El usuario debe cambiarla en su primer login (futuro: flujo de cambio obligatorio).

**Criterios de aceptación:**

```gherkin
Scenario: Owner crea cajero exitosamente
  Given un owner autenticado en su tenant
  When envía POST /api/v1/users con { name, email, role: "cashier" }
  Then recibe status 201
  And el body contiene el usuario creado sin passwordHash
  And el usuario tiene status "active"
  And se registra en audit_log

Scenario: Admin intenta crear owner
  Given un admin autenticado
  When envía POST /api/v1/users con { role: "owner" }
  Then recibe status 403

Scenario: Email duplicado en el mismo tenant
  Given un usuario existente con email "x@rsoft.com" en el tenant
  When se intenta crear otro con el mismo email
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/users`

Request:

```json
{ "name": "Ana López", "email": "ana@rsoft.com", "role": "waiter" }
```

Response 201:

```json
{
  "id": "uuid", "name": "Ana López", "email": "ana@rsoft.com",
  "role": "waiter", "status": "active", "tenantId": "uuid",
  "createdAt": "2026-05-19T10:00:00Z"
}
```

-----

## UC-02-02: Listar usuarios del tenant

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /users` con filtros opcionales.
1. Sistema retorna solo usuarios del `tenantId` del token (inyectado por `TenantGuard`).
1. Soporta filtro por `role`, `status` y búsqueda por `name` o `email`.

**Criterios de aceptación:**

```gherkin
Scenario: Listado paginado
  Given un owner autenticado
  When envía GET /api/v1/users?page=1&limit=10
  Then recibe status 200
  And el body contiene { data: [...], meta: { total, page, limit, totalPages } }
  And TODOS los usuarios pertenecen al mismo tenant

Scenario: Filtro por rol
  When envía GET /api/v1/users?role=cashier
  Then solo retorna usuarios con role = cashier
```

**Contrato API:**

`GET /api/v1/users?role=cashier&status=active&search=ana&page=1&limit=20`

Response 200: Wrapper de paginación con array de usuarios.

-----

## UC-02-03: Obtener usuario por ID

**Actor:** `owner`, `admin`, o el mismo usuario
**Roles permitidos:** OW, AD (cualquier usuario del tenant) · Cualquier rol (solo su propio perfil)

**Flujo principal:**

1. Actor envía `GET /users/:id`.
1. Sistema verifica que el usuario pertenece al mismo `tenant_id`.
1. Un usuario sin rol gerencial solo puede ver su propio `id`.

**Excepciones:**

|ID |Condición                            |Respuesta                       |
|---|-------------------------------------|--------------------------------|
|E01|Usuario no encontrado en el tenant   |`404` — “Usuario no encontrado.”|
|E02|Intento de ver usuario de otro tenant|`404` (no revelar existencia)   |

**Contrato API:**

`GET /api/v1/users/:id`

Response 200: Objeto usuario sin `passwordHash`.

-----

## UC-02-04: Actualizar usuario

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /users/:id` con campos a modificar.
1. Sistema valida que el usuario pertenece al mismo tenant.
1. Si se cambia `email`, verifica que no esté duplicado.
1. Actualiza los campos enviados (merge parcial).
1. Registra evento `update` con metadata `{ before, after }` en `audit_log`.

**Excepciones:**

|ID |Condición                                   |Respuesta|
|---|--------------------------------------------|---------|
|E01|Intento de cambiar `role` a uno no permitido|`403`    |
|E02|Email duplicado                             |`409`    |
|E03|Usuario no encontrado                       |`404`    |

**Reglas de negocio:**

- RN-08: No se puede modificar el `role` de un `owner` a menos que el actor sea `super_admin`.
- RN-09: `password_hash` no se puede modificar por esta vía. Usa UC-02-06.

**Criterios de aceptación:**

```gherkin
Scenario: Actualización parcial de nombre
  Given un owner y un usuario cajero en su tenant
  When envía PATCH /api/v1/users/:id con { name: "Nuevo Nombre" }
  Then recibe status 200
  And el usuario tiene el nuevo nombre
  And audit_log contiene before.name y after.name

Scenario: Cambio de email a uno existente
  When envía PATCH con email duplicado
  Then recibe status 409
```

**Contrato API:**

`PATCH /api/v1/users/:id`

Request: `{ "name": "Nuevo Nombre" }` (cualquier subconjunto de campos)

Response 200: Objeto usuario actualizado.

-----

## UC-02-05: Cambiar estado del usuario (activar / desactivar)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /users/:id/status` con `{ status: "inactive" }`.
1. Sistema verifica que el usuario pertenece al mismo tenant.
1. Sistema actualiza `status`.
1. Si se desactiva: las sesiones activas expiran de forma natural (Access Token en 15 min). Los Refresh Tokens se revocan inmediatamente.
1. Registra evento `status_change` en `audit_log`.

**Reglas de negocio:**

- RN-10: Un `owner` no puede desactivarse a sí mismo.
- RN-11: Un `admin` no puede desactivar a un `owner`.

**Criterios de aceptación:**

```gherkin
Scenario: Desactivar cajero
  Given un owner y un cajero activo
  When envía PATCH /api/v1/users/:id/status con { status: "inactive" }
  Then recibe status 200
  And el cajero tiene status "inactive"
  And sus refreshTokens quedan revocados
  And el cajero no puede hacer login

Scenario: Owner intenta desactivarse a sí mismo
  When un owner intenta desactivar su propia cuenta
  Then recibe status 403
```

**Contrato API:**

`PATCH /api/v1/users/:id/status`

Request: `{ "status": "inactive" }` o `{ "status": "active" }`

Response 200: `{ "id": "uuid", "status": "inactive" }`

-----

## UC-02-06: Resetear contraseña de un usuario (por admin)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /users/:id/reset-password`.
1. Sistema genera contraseña temporal aleatoria (12 chars, alfanumérica + especial).
1. Sistema actualiza `password_hash` con bcrypt.
1. Sistema revoca todos los Refresh Tokens del usuario.
1. Sistema envía email al usuario con la nueva contraseña temporal vía SES.
1. Registra evento `password_reset` en `audit_log`.

**Reglas de negocio:**

- RN-12: Un `admin` no puede resetear la contraseña de un `owner`.

**Criterios de aceptación:**

```gherkin
Scenario: Reset de contraseña exitoso
  Given un owner y un cajero en su tenant
  When envía POST /api/v1/users/:id/reset-password
  Then recibe status 200
  And el cajero recibe un email con nueva contraseña
  And sus sesiones anteriores son invalidadas
  And puede login con la nueva contraseña temporal
```

**Contrato API:**

`POST /api/v1/users/:id/reset-password`

Response 200: `{ "message": "Contraseña reseteada. Se envió email al usuario." }`

-----

## UC-02-07: Cambiar propia contraseña

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE

**Flujo principal:**

1. Actor envía `POST /users/me/change-password` con `currentPassword` y `newPassword`.
1. Sistema verifica que `currentPassword` coincide con `password_hash` actual.
1. Sistema actualiza `password_hash` con la nueva contraseña.
1. Sistema revoca todos los Refresh Tokens del usuario excepto el actual.
1. Registra evento `password_reset` en `audit_log`.

**Excepciones:**

|ID |Condición                       |Respuesta                                                                           |
|---|--------------------------------|------------------------------------------------------------------------------------|
|E01|`currentPassword` incorrecto    |`401` — “Contraseña actual incorrecta.”                                             |
|E02|`newPassword` no cumple política|`400` — “La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.”|

**Criterios de aceptación:**

```gherkin
Scenario: Cambio de contraseña exitoso
  Given un usuario autenticado
  When envía POST /api/v1/users/me/change-password con contraseñas válidas
  Then recibe status 200
  And puede autenticarse con la nueva contraseña
  And las otras sesiones quedan invalidadas

Scenario: Contraseña actual incorrecta
  When envía currentPassword incorrecto
  Then recibe status 401
```

**Contrato API:**

`POST /api/v1/users/me/change-password`

Request: `{ "currentPassword": "Vieja123!", "newPassword": "Nueva456!" }`

Response 200: `{ "message": "Contraseña actualizada correctamente." }`
