# SPEC-14: Suppliers

**Descripción:** Gestión del directorio de proveedores de insumos y materias primas.

**Actores:** `owner`, `admin`

**Entidades:** `supplier`

-----

## UC-14-01: Crear proveedor

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /suppliers` con los datos del proveedor.
1. Sistema crea con `status = active`. Registra `create` en `audit_log`.

**Contrato API:**

`POST /api/v1/suppliers`

Request:

```json
{
  "name": "Lácteos del Norte S.A.S",
  "phone": "3201234567",
  "email": "ventas@lacteosn.com",
  "address": "Zona Industrial #5",
  "contactName": "Roberto Díaz",
  "notes": "Entrega martes y viernes"
}
```

Response 201: Objeto proveedor creado.

-----

## UC-14-02: Listar proveedores

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /suppliers` con filtros opcionales (`status`, `search`).
1. Sistema retorna proveedores del tenant paginados.

**Contrato API:**

`GET /api/v1/suppliers?status=active&search=lacteos&page=1&limit=20`

Response 200: Wrapper paginado.

-----

## UC-14-03: Actualizar proveedor

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /suppliers/:id` con campos a modificar.
1. Sistema actualiza. Registra `update` con `{ before, after }` en `audit_log`.

**Contrato API:**

`PATCH /api/v1/suppliers/:id`

Request: Subconjunto de campos.

Response 200: Proveedor actualizado.

-----

## UC-14-04: Cambiar estado del proveedor

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /suppliers/:id/status`.
1. Sistema actualiza `status`. Registra `status_change` en `audit_log`.

**Reglas de negocio:**

- RN-27: Desactivar un proveedor no afecta las compras históricas.

**Contrato API:**

`PATCH /api/v1/suppliers/:id/status`

Request: `{ "status": "inactive" }`

Response 200: `{ "id": "uuid", "status": "inactive" }`
