# SPEC-01: Auth

**Descripción:** Gestiona el ciclo de vida de la sesión: login, renovación de token y logout. No crea usuarios (responsabilidad de SPEC-02).

**Estrategia:** JWT sin estado. Access Token (15 min, header Bearer) + Refresh Token (7 días, cookie HttpOnly).

**Actores:** Cualquier usuario registrado · Sistema (automático).

**Entidades:** `user`, `refresh_token`

-----

## UC-01-01: Iniciar sesión

**Actor:** Cualquier usuario
**Roles permitidos:** Público (no requiere token)

**Precondiciones:**

- Usuario existe con `status = active`.
- Tiene `email` y `password_hash` registrados.

**Flujo principal:**

1. Cliente envía `POST /auth/login` con `email` y `password`.
1. Sistema busca `user` por `email` (case-insensitive, normalizado a minúsculas).
1. Sistema verifica `user.status = active`.
1. Sistema compara contraseña con `password_hash` vía `bcrypt.compare`.
1. Sistema genera Access Token JWT (payload: `{ sub, tenantId, role }`, exp 15 min).
1. Sistema genera Refresh Token opaco, almacena `SHA-256(token)` en `refresh_token` con `expires_at = now + 7d`.
1. Retorna Access Token en body y Refresh Token en cookie `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`.
1. Registra evento `login` en `audit_log`.

**Excepciones:**

|ID |Condición                |Respuesta                                               |
|---|-------------------------|--------------------------------------------------------|
|E01|Email no existe          |`401` — “Credenciales inválidas”                        |
|E02|`status = inactive`      |`403` — “Cuenta desactivada. Contacta al administrador.”|
|E03|Contraseña incorrecta    |`401` — “Credenciales inválidas”                        |
|E04|Campos vacíos o inválidos|`400` — lista de errores de validación                  |

**Reglas de negocio:**

- RN-01: Mensaje de error idéntico para email no encontrado y contraseña incorrecta (no revelar existencia de cuenta).
- RN-02: `super_admin` puede iniciar sesión con `tenant_id = null`.
- RN-03: Rate limit: máximo 5 intentos por minuto por IP (`@Throttle(5, 60)`).

**Criterios de aceptación:**

```gherkin
Scenario: Login exitoso
  Given un usuario activo con email "juan@rsoft.com" y contraseña "Segura123!"
  When envía POST /api/v1/auth/login con esas credenciales
  Then recibe status 200
  And el body contiene { accessToken, user: { id, name, role, tenantId } }
  And la respuesta incluye cookie HttpOnly "refreshToken"
  And se registra evento login en audit_log

Scenario: Login con contraseña incorrecta
  Given un usuario activo con email "juan@rsoft.com"
  When envía POST /api/v1/auth/login con contraseña incorrecta
  Then recibe status 401
  And el body contiene { message: "Credenciales inválidas" }
  And NO se incluye cookie refreshToken

Scenario: Login con cuenta inactiva
  Given un usuario con status "inactive"
  When envía POST /api/v1/auth/login con credenciales correctas
  Then recibe status 403
  And el mensaje indica cuenta desactivada

Scenario: Rate limit excedido
  Given 5 intentos fallidos en el último minuto desde la misma IP
  When se realiza un sexto intento
  Then recibe status 429
```

**Contrato API:**

`POST /api/v1/auth/login`

Request:

```json
{ "email": "juan@rsoft.com", "password": "Segura123!" }
```

Response 200:

```json
{
  "accessToken": "eyJ...",
  "user": { "id": "uuid", "name": "Juan Pérez", "email": "juan@rsoft.com", "role": "cashier", "tenantId": "uuid" }
}
```

Set-Cookie: `refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`

-----

## UC-01-02: Renovar Access Token

**Actor:** Sistema (llamado automáticamente por el frontend al recibir 401)
**Roles permitidos:** Público (usa cookie, no token)

**Precondiciones:**

- Cookie `refreshToken` presente y válida.
- Token existe en `refresh_token` con `revoked = false` y `expires_at > now()`.

**Flujo principal:**

1. Cliente envía `POST /auth/refresh` (sin body).
1. Sistema extrae Refresh Token de la cookie.
1. Calcula `SHA-256(token)` y busca en `refresh_token`.
1. Verifica `revoked = false` y `expires_at > now()`.
1. Marca el token actual como `revoked = true` (rotación obligatoria).
1. Genera nuevo Access Token y nuevo Refresh Token.
1. Persiste el nuevo token. Retorna nuevo Access Token y actualiza cookie.

**Excepciones:**

|ID |Condición                        |Respuesta                                   |
|---|---------------------------------|--------------------------------------------|
|E01|Sin cookie                       |`401` — “No autenticado”                    |
|E02|Token no encontrado en DB        |`401` + revocar todos los tokens del usuario|
|E03|Token expirado                   |`401` — “Sesión expirada”                   |
|E04|Token ya revocado (reutilización)|`401` + revocar todos los tokens del usuario|

**Reglas de negocio:**

- RN-04: Rotación obligatoria en cada uso.
- RN-05: Reutilización detectada → invalidar toda la familia de tokens (protección contra robo).

**Criterios de aceptación:**

```gherkin
Scenario: Renovación exitosa
  Given cookie refreshToken válida
  When envía POST /api/v1/auth/refresh
  Then recibe status 200 con nuevo accessToken
  And la cookie se actualiza con nuevo refreshToken
  And el token anterior queda revoked = true en DB

Scenario: Reutilización de token revocado
  Given un refreshToken que ya fue usado (revoked = true)
  When se envía ese token
  Then recibe status 401
  And TODOS los refreshTokens del usuario quedan revocados
```

**Contrato API:**

`POST /api/v1/auth/refresh` — Sin body. Cookie automática.

Response 200:

```json
{ "accessToken": "eyJ..." }
```

-----

## UC-01-03: Cerrar sesión

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE, SA

**Flujo principal:**

1. Cliente envía `POST /auth/logout` con Access Token en header.
1. Sistema revoca el Refresh Token activo del usuario (`revoked = true`).
1. Sistema elimina la cookie enviando `Set-Cookie: refreshToken=; Max-Age=0`.
1. Retorna `200 OK`.
1. Registra evento `logout` en `audit_log`.

**Notas de implementación:**

- El Access Token no se invalida (stateless, expira en 15 min). Esto es aceptable por la corta vida del token.
- Si no hay Refresh Token en cookie, retorna `200` igualmente (idempotente).

**Criterios de aceptación:**

```gherkin
Scenario: Logout exitoso
  Given un usuario con Access Token válido y cookie refreshToken
  When envía POST /api/v1/auth/logout
  Then recibe status 200
  And la cookie refreshToken es eliminada
  And el refreshToken queda revocado en DB
  And uso posterior del refreshToken retorna 401
```

**Contrato API:**

`POST /api/v1/auth/logout` — Header: `Authorization: Bearer <token>`

Response 200:

```json
{ "message": "Sesión cerrada correctamente" }
```

-----

## UC-01-04: Obtener perfil del usuario autenticado

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA, KI, DE, SA

**Flujo principal:**

1. Cliente envía `GET /auth/me` con Access Token válido.
1. `JwtAuthGuard` valida el token.
1. Sistema retorna datos del usuario (sin `password_hash`).

**Criterios de aceptación:**

```gherkin
Scenario: Perfil con token válido
  Given un Access Token válido
  When envía GET /api/v1/auth/me
  Then recibe status 200
  And el body contiene { id, name, email, role, tenantId, status }
  And NO contiene passwordHash

Scenario: Perfil con token expirado
  Given un Access Token expirado
  When envía GET /api/v1/auth/me
  Then recibe status 401
```

**Contrato API:**

`GET /api/v1/auth/me`

Response 200:

```json
{
  "id": "uuid", "name": "Juan Pérez", "email": "juan@rsoft.com",
  "role": "cashier", "tenantId": "uuid", "status": "active"
}
```
