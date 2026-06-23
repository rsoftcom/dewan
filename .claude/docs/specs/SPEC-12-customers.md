# SPEC-12: Customers

**Descripción:** Gestión del directorio de clientes del negocio, principalmente para pedidos de domicilio.

**Actores:** `cashier`, `waiter` (búsqueda y creación automática), `owner`, `admin` (CRUD completo)

**Entidades:** `customer`

-----

## UC-12-01: Buscar cliente por teléfono

**Actor:** `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `GET /customers/search?phone=3001234567`.
1. Sistema busca por `phone` en el tenant (búsqueda exacta).
1. Retorna el cliente si existe, o `null` si no.

**Notas de implementación:** Este endpoint es llamado automáticamente por el frontend al crear un pedido de domicilio cuando el usuario termina de escribir el teléfono (blur event o debounce).

**Contrato API:**

`GET /api/v1/customers/search?phone=3001234567`

Response 200: `{ "customer": { "id": "uuid", "name": "María García", "phone": "3001234567", "address": "..." } }` o `{ "customer": null }`

-----

## UC-12-02: Crear cliente

**Actor:** `cashier`, `waiter`, `owner`, `admin`
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `POST /customers` con `name`, `phone` obligatorios y demás opcionales.
1. Sistema verifica que `phone` sea único en el tenant.
1. Crea el cliente. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                     |Respuesta                                       |
|---|------------------------------|------------------------------------------------|
|E01|`phone` duplicado en el tenant|`409` — “Ya existe un cliente con ese teléfono.”|

**Criterios de aceptación:**

```gherkin
Scenario: Crear cliente nuevo
  Given cajero y phone "3009876543" no registrado en el tenant
  When envía POST /api/v1/customers con { name: "Pedro López", phone: "3009876543" }
  Then recibe status 201 con el cliente creado

Scenario: Teléfono duplicado
  Given cliente existente con phone "3009876543"
  When se intenta crear otro con el mismo phone
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/customers`

Request:

```json
{
  "name": "Pedro López",
  "phone": "3009876543",
  "address": "Carrera 5 # 10-20",
  "email": "pedro@email.com",
  "notes": "Alérgico a mariscos"
}
```

Response 201: Objeto cliente creado.

-----

## UC-12-03: Actualizar cliente

**Actor:** `owner`, `admin`, `cashier`, `waiter`
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `PATCH /customers/:id` con campos a modificar.
1. Sistema verifica que el cliente pertenece al tenant.
1. Actualiza y registra `update` en `audit_log`.

**Contrato API:**

`PATCH /api/v1/customers/:id`

Request: Subconjunto de campos.

Response 200: Cliente actualizado.

-----

## UC-12-04: Listar clientes

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /customers` con filtros opcionales.
1. Sistema retorna clientes del tenant paginados.
1. Soporta búsqueda por `name` o `phone`.

**Contrato API:**

`GET /api/v1/customers?search=pedro&page=1&limit=20`

Response 200: Wrapper paginado con clientes.
