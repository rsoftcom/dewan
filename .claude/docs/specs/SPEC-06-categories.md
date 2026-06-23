# SPEC-06: Categories

**Descripción:** Categorías jerárquicas (hasta 2 niveles) para organizar el catálogo de productos.

**Actores:** `owner`, `admin` (CRUD), cualquier usuario (lectura)

**Entidades:** `category`, `product_category`

-----

## UC-06-01: Crear categoría

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `POST /categories` con `name` y opcionalmente `parentId`.
1. Sistema verifica que `name` sea único en el tenant.
1. Si `parentId` existe: verifica que sea una categoría raíz (sin `parent_id`). Profundidad máxima: 2.
1. Crea la categoría. Registra `create` en `audit_log`.

**Excepciones:**

|ID |Condición                     |Respuesta                                         |
|---|------------------------------|--------------------------------------------------|
|E01|Nombre duplicado en el tenant |`409`                                             |
|E02|`parentId` es una subcategoría|`400` — “Solo se admiten 2 niveles de categorías.”|
|E03|`parentId` no encontrado      |`404`                                             |

**Criterios de aceptación:**

```gherkin
Scenario: Crear categoría raíz
  Given owner autenticado
  When envía POST /api/v1/categories con { name: "Bebidas" }
  Then recibe status 201 con la categoría creada

Scenario: Crear subcategoría
  Given categoría padre "Bebidas"
  When envía POST con { name: "Jugos", parentId: "uuid-bebidas" }
  Then recibe status 201

Scenario: Intento de crear tercer nivel
  Given subcategoría "Jugos" con parent "Bebidas"
  When se intenta crear una sub-sub de "Jugos"
  Then recibe status 400
```

**Contrato API:**

`POST /api/v1/categories`

Request: `{ "name": "Bebidas", "parentId": null }`

Response 201: `{ "id": "uuid", "name": "Bebidas", "parentId": null, "tenantId": "uuid" }`

-----

## UC-06-02: Listar categorías

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** OW, AD, CA, WA

**Flujo principal:**

1. Actor envía `GET /categories`.
1. Sistema retorna árbol de categorías del tenant (raíces con sus hijos incluidos).

**Contrato API:**

`GET /api/v1/categories`

Response 200:

```json
[
  {
    "id": "uuid", "name": "Bebidas",
    "children": [
      { "id": "uuid", "name": "Jugos", "children": [] }
    ]
  }
]
```

-----

## UC-06-03: Actualizar categoría

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /categories/:id` con `name` o `parentId`.
1. Sistema valida unicidad de nombre si cambia.
1. Actualiza la categoría. Registra `update` en `audit_log`.

**Contrato API:**

`PATCH /api/v1/categories/:id`

Request: `{ "name": "Bebidas Frías" }`

Response 200: Categoría actualizada.

-----

## UC-06-04: Eliminar categoría

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `DELETE /categories/:id`.
1. Sistema verifica que no tenga subcategorías activas. Si tiene: error.
1. Sistema elimina los `product_category` vinculados (CASCADE).
1. Sistema elimina la categoría. Registra `delete` en `audit_log`.

**Excepciones:**

|ID |Condición          |Respuesta                                              |
|---|-------------------|-------------------------------------------------------|
|E01|Tiene subcategorías|`409` — “Elimina o reasigna las subcategorías primero.”|

**Criterios de aceptación:**

```gherkin
Scenario: Eliminar categoría sin subcategorías
  Given categoría "Postres" sin hijos y con 3 productos asignados
  When envía DELETE /api/v1/categories/:id
  Then recibe status 200
  And los 3 productos pierden esa categoría pero no son eliminados

Scenario: Eliminar categoría con subcategorías
  Given categoría "Bebidas" con hijo "Jugos"
  When envía DELETE sobre "Bebidas"
  Then recibe status 409
```

**Contrato API:**

`DELETE /api/v1/categories/:id`

Response 200: `{ "message": "Categoría eliminada correctamente." }`

-----

## UC-06-05: Asignar categorías a un producto

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PUT /products/:id/categories` con array de `categoryIds`.
1. Sistema reemplaza todas las categorías del producto por las enviadas.
1. Valida que cada `categoryId` pertenezca al mismo tenant.

**Criterios de aceptación:**

```gherkin
Scenario: Asignar dos categorías a un producto
  Given admin y un producto sin categorías
  When envía PUT /api/v1/products/:id/categories con ["uuid-cat1", "uuid-cat2"]
  Then el producto tiene exactamente esas 2 categorías

Scenario: Remover todas las categorías
  When envía PUT con array vacío []
  Then el producto queda sin categorías
```

**Contrato API:**

`PUT /api/v1/products/:id/categories`

Request: `["uuid-cat1", "uuid-cat2"]`

Response 200: Producto con `categories` actualizadas.
