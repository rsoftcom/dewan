# SPEC-04: Units

**Descripción:** Unidades de medida globales y conversiones entre ellas. Son gestionadas por `super_admin` y usadas en todo el sistema.

**Actores:** `super_admin` (escritura), cualquier usuario autenticado (lectura)

**Entidades:** `unit`, `unit_conversion`

-----

## UC-04-01: Listar unidades

**Actor:** Cualquier usuario autenticado
**Roles permitidos:** SA, OW, AD, CA, WA, KI, DE

**Flujo principal:**

1. Actor envía `GET /units`.
1. Sistema retorna todas las unidades disponibles (sin paginación, lista corta).

**Notas de implementación:** La respuesta se cachea en memoria (NestJS `CacheModule`, TTL 1 hora). Las unidades cambian raramente.

**Contrato API:**

`GET /api/v1/units`

Response 200:

```json
[
  { "id": "uuid", "name": "gram", "abbreviation": "g" },
  { "id": "uuid", "name": "kilogram", "abbreviation": "kg" },
  { "id": "uuid", "name": "liter", "abbreviation": "L" },
  { "id": "uuid", "name": "unit", "abbreviation": "ud" }
]
```

-----

## UC-04-02: Crear conversión entre unidades

**Actor:** `super_admin`
**Roles permitidos:** SA

**Flujo principal:**

1. SA envía `POST /units/conversions` con `fromUnitId`, `toUnitId` y `factor`.
1. Sistema verifica que el par `(fromUnitId, toUnitId)` no exista ya.
1. Sistema crea la conversión.
1. Opcionalmente, si se indica `bidirectional: true`, crea también la conversión inversa (`factor = 1 / factor`).

**Excepciones:**

|ID |Condición                |Respuesta                                             |
|---|-------------------------|------------------------------------------------------|
|E01|Par ya existe            |`409` — “Esta conversión ya está registrada.”         |
|E02|`factor <= 0`            |`400`                                                 |
|E03|`fromUnitId === toUnitId`|`400` — “No se puede convertir una unidad a sí misma.”|

**Criterios de aceptación:**

```gherkin
Scenario: Crear conversión kg → g
  Given super_admin y unidades kg y g existentes
  When envía POST /api/v1/units/conversions con { fromUnitId: "kg-uuid", toUnitId: "g-uuid", factor: 1000 }
  Then recibe status 201 con la conversión creada

Scenario: Conversión bidireccional
  When incluye bidirectional: true
  Then también se crea la conversión g → kg con factor 0.001
```

**Contrato API:**

`POST /api/v1/units/conversions`

Request:

```json
{ "fromUnitId": "uuid-kg", "toUnitId": "uuid-g", "factor": 1000, "bidirectional": true }
```

Response 201:

```json
[
  { "id": "uuid", "fromUnitId": "uuid-kg", "toUnitId": "uuid-g", "factor": 1000 },
  { "id": "uuid", "fromUnitId": "uuid-g", "toUnitId": "uuid-kg", "factor": 0.001 }
]
```

-----

## UC-04-03: Listar conversiones

**Actor:** Cualquier usuario autenticado (OW, AD en práctica)
**Roles permitidos:** SA, OW, AD

**Flujo principal:**

1. Actor envía `GET /units/conversions`.
1. Sistema retorna todas las conversiones con sus unidades relacionadas.

**Contrato API:**

`GET /api/v1/units/conversions`

Response 200: Array de conversiones con objetos `fromUnit` y `toUnit` incluidos (eager load).
