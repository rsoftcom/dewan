# SPEC-26: Public Menu (Canvas Editor + Public URL + QR)

**Descripción:** Cada negocio diseña su carta visualmente en un editor canvas libre (estilo Canva), organizada en páginas (ej. "Comidas", "Bebidas"). Al publicar, el sistema genera una URL pública fija y un código QR que apuntan siempre a la versión más reciente del menú — sin necesidad de reimprimir el QR cuando el contenido cambia.

**Actores:** `owner`, `admin` (edición) · público general sin autenticación (vista del menú)

**Entidades:** `menu`, `menu_page`, `menu_element` (ver `entity-26-menu.md`, `entity-27-menu-page.md`, `entity-28-menu-element.md`)

**Fuera de alcance de este spec:** pedidos desde el menú público (solo informativo — ver `rsoft-analisis.md` sección 10, "Zona pública" queda en fase futura para flujo de pedidos). Pagos, carrito, autenticación de clientes.

-----

## 1. Resumen del flujo

```
[Owner/Admin]                          [Editor]                       [Público]
     │                                     │                              │
     ├─ Entra a "Mi Menú" ─────────────────▶ Lazy-create `menu` (draft)   │
     │                                     │  + 1 `menu_page` inicial    │
     ├─ Diseña páginas y elementos ────────▶ Autoguardado (debounce)     │
     ├─ Arrastra producto al canvas ───────▶ Crea `menu_element`         │
     │                                     │  type=product_card          │
     ├─ Clic "Publicar" ───────────────────▶ status=published            │
     │                                     │  genera slug (si no existe) │
     │                                     │  genera QR (1 sola vez)     │
     │                                     │                              │
     │                                     │      getdewan.com/m/{slug} ─┼──▶ Ve el menú
     │                                     │                              │   (responsive,
     ├─ Sigue editando después ────────────▶ Solo actualiza contenido     │   sin login)
     │  (nunca cambia slug/QR)             │                              │
```

-----

## UC-26-01: Obtener/crear el menú del tenant (editor)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `GET /menu`.
1. Si el tenant no tiene `menu`, el sistema lo crea automáticamente: `slug` generado desde `tenant.name` (slugificado, minúsculas, sin tildes/espacios; si ya existe, sufijo numérico `-2`, `-3`...), `status = draft`, y una `menu_page` inicial (`name = "Mi Carta"`, `order = 0`, `width = 1080`, `height = 1920`).
1. Sistema retorna el `menu` con sus `pages` y `elements` anidados.

**Contrato API:**

`GET /api/v1/menu`

Response 200:

```json
{
  "id": "uuid",
  "slug": "el-buen-sabor",
  "status": "draft",
  "qrCodeUrl": null,
  "publishedAt": null,
  "pages": [
    {
      "id": "uuid",
      "name": "Mi Carta",
      "order": 0,
      "width": 1080,
      "height": 1920,
      "backgroundColor": "#FFFAF6",
      "backgroundImage": null,
      "elements": []
    }
  ]
}
```

-----

## UC-26-02: Gestionar páginas del menú (crear, reordenar, renombrar, eliminar)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal — crear página:**

1. Actor envía `POST /menu/pages` con `name`.
1. Sistema asigna `order = max(order) + 1` dentro del menú. Crea la página con `width`/`height` heredados del último estándar usado (o default 1080×1920).

**Flujo — reordenar:**

1. Actor envía `PATCH /menu/pages/reorder` con un array de `pageId` en el nuevo orden.
1. Sistema actualiza `order` de cada página según su posición en el array.

**Flujo — eliminar:**

1. Actor envía `DELETE /menu/pages/:id`.
1. Sistema verifica que no sea la **última página restante** si `menu.status = published` (un menú publicado no puede quedar sin páginas).
1. Elimina la página y, en cascada, sus `menu_element`.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Eliminar la única página de un menú publicado | `409` — "Un menú publicado debe tener al menos una página." |
| E02 | `pageId` no pertenece al tenant | `404` |

**Criterios de aceptación:**

```gherkin
Scenario: Crear segunda página
  Given un menú con 1 página "Comidas"
  When el owner envía POST /api/v1/menu/pages con { name: "Bebidas" }
  Then recibe status 201
  And la nueva página tiene order = 1

Scenario: Reordenar páginas
  Given un menú con páginas ["Comidas" (order 0), "Bebidas" (order 1)]
  When se envía PATCH /menu/pages/reorder con [bebidasId, comidasId]
  Then "Bebidas" queda con order = 0 y "Comidas" con order = 1

Scenario: Intentar eliminar la única página de un menú publicado
  Given un menú published con exactamente 1 página
  When se envía DELETE sobre esa página
  Then recibe status 409
```

**Contratos API:**

`POST /api/v1/menu/pages` → Request: `{ "name": "Bebidas" }` → Response 201: página creada
`PATCH /api/v1/menu/pages/reorder` → Request: `{ "pageIds": ["uuid2", "uuid1"] }` → Response 200
`PATCH /api/v1/menu/pages/:id` → Request: `{ "name": "Postres", "backgroundColor": "#F0EDE6" }` → Response 200
`DELETE /api/v1/menu/pages/:id` → Response 200

-----

## UC-26-03: Gestionar elementos del canvas (crear, mover/redimensionar, editar estilo, eliminar)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal — crear elemento libre (`text`/`image`/`shape`):**

1. Actor envía `POST /menu/pages/:pageId/elements` con `type`, posición inicial y `content`/`style` por defecto.
1. Sistema crea el `menu_element` con `z_index = max(z_index) + 1` en esa página.

**Flujo — crear tarjeta de producto (`product_card`):**

1. Actor arrastra un producto desde el panel de catálogo al canvas.
1. Cliente envía `POST /menu/pages/:pageId/elements` con `type: "product_card"`, `productId`, posición/tamaño, y `fieldConfig` por defecto (`showImage/showName/showPrice = true`, `showDescription = false`).
1. Sistema valida que `productId` pertenezca al tenant. Crea el elemento — **no copia** nombre/precio, solo guarda la referencia.

**Flujo — mover/redimensionar/editar estilo (autoguardado):**

1. El frontend envía cambios incrementales en debounce (ej. cada 800ms de inactividad o al soltar el drag) vía `PATCH /menu/elements/:id` con los campos modificados (`x`, `y`, `width`, `height`, `rotation`, `style`, `fieldConfig`).
1. Sistema actualiza solo los campos enviados.

**Flujo — eliminar:**

1. Actor envía `DELETE /menu/elements/:id`.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | `productId` no pertenece al tenant (en `product_card`) | `404` |
| E02 | `type = product_card` sin `productId` | `400` — "Selecciona un producto para esta tarjeta." |
| E03 | `width` o `height` ≤ 0 | `400` |

**Criterios de aceptación:**

```gherkin
Scenario: Agregar tarjeta de producto al canvas
  Given producto "Hamburguesa Clásica" activo y sellable en el catálogo
  When el admin envía POST /api/v1/menu/pages/:pageId/elements con
    { type: "product_card", productId: "uuid-hamburguesa", x: 100, y: 200, width: 300, height: 120 }
  Then recibe status 201
  And el elemento no almacena name ni price — solo productId

Scenario: Editar estilo de un texto libre
  Given un elemento type=text en el canvas
  When se envía PATCH /menu/elements/:id con { style: { fontSize: 24, color: "#FF6B35" } }
  Then el elemento refleja el nuevo estilo
  And slug y qrCodeUrl del menú no cambian

Scenario: Intentar crear product_card sin productId
  When se envía POST con { type: "product_card", x: 0, y: 0, width: 100, height: 100 }
  Then recibe status 400
```

**Contratos API:**

`POST /api/v1/menu/pages/:pageId/elements` → Request (ejemplo `product_card`):
```json
{
  "type": "product_card",
  "productId": "uuid",
  "x": 100, "y": 200, "width": 300, "height": 120, "rotation": 0,
  "fieldConfig": { "showImage": true, "showName": true, "showPrice": true, "showDescription": false }
}
```
Response 201: elemento creado con `id`, `zIndex` asignado.

`PATCH /api/v1/menu/elements/:id` → Request: cualquier subconjunto de campos editables → Response 200
`DELETE /api/v1/menu/elements/:id` → Response 200

-----

## UC-26-04: Publicar el menú (genera slug y QR de forma permanente)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Precondiciones:**

- El `menu` tiene al menos 1 `menu_page` con al menos 1 `menu_element` (no se publica un menú vacío).

**Flujo principal:**

1. Actor envía `POST /menu/publish`.
1. Sistema valida precondiciones.
1. Si `qr_code_url` es `null` (primera publicación): genera el código QR apuntando a `https://getdewan.com/m/{slug}`, lo sube a S3/R2, guarda la URL en `qr_code_url`. **Esta es la única vez que se genera el QR.**
1. Sistema cambia `status = published`. Si `published_at` es `null`, lo establece a `now()`.
1. Registra `publish` en `audit_log`.

**Flujo — republicar (ediciones posteriores):**

1. Actor sigue editando páginas/elementos con el menú ya en `published` (los cambios son visibles en vivo de inmediato — no existe un estado intermedio "cambios sin publicar" para el contenido; **solo el primer publish es una transición de estado real**).
1. No se requiere ninguna acción adicional ni se regenera el QR.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | Menú sin páginas o sin elementos | `409` — "Agrega al menos un elemento antes de publicar." |

**Regla de negocio:**

- **RN-26-01:** El QR se genera **una sola vez**, en el primer `publish`. Ediciones de contenido posteriores (mover elementos, agregar páginas, cambiar productos) **nunca** regeneran el QR ni cambian `slug`.
- **RN-26-02:** Mientras `status = draft`, la URL pública retorna `404` para visitantes anónimos. Los usuarios del tenant autenticados pueden previsualizarla vía `GET /menu/preview`.

**Criterios de aceptación:**

```gherkin
Scenario: Primera publicación genera slug y QR
  Given un menú draft con 1 página y 3 elementos, qrCodeUrl = null
  When el owner envía POST /api/v1/menu/publish
  Then recibe status 200
  And menu.status = "published"
  And menu.qrCodeUrl ya no es null
  And menu.publishedAt queda registrado

Scenario: Editar contenido después de publicar no afecta la URL ni el QR
  Given un menú published con qrCodeUrl = "https://...qr-abc.png" y slug = "el-buen-sabor"
  When el admin mueve 5 elementos y agrega una página nueva
  Then menu.slug sigue siendo "el-buen-sabor"
  And menu.qrCodeUrl sigue siendo "https://...qr-abc.png"

Scenario: Publicar un menú vacío
  Given un menú draft con 1 página y 0 elementos
  When se envía POST /menu/publish
  Then recibe status 409
```

**Contrato API:**

`POST /api/v1/menu/publish` → Response 200:
```json
{ "id": "uuid", "status": "published", "slug": "el-buen-sabor", "qrCodeUrl": "https://...", "publishedAt": "2026-06-28T10:00:00Z" }
```

-----

## UC-26-05: Ver el menú público (sin autenticación)

**Actor:** Público general (sin login)

**Flujo principal:**

1. Cliente abre `https://getdewan.com/m/{slug}` (o escanea el QR, que apunta a la misma URL).
1. Sistema busca `menu` por `slug` con `status = published`. Si no existe o está en `draft`: `404`.
1. Sistema retorna las `pages` ordenadas con sus `elements`. Para cada `element` de tipo `product_card`, hace `JOIN` en vivo con `product` y **omite** la tarjeta si `product.status = inactive` o `product.sellable = false`.
1. Frontend público renderiza el canvas de forma responsive (escala el `width`/`height` de diseño al viewport del visitante) y muestra pestañas/swipe para navegar entre páginas.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | `slug` no existe | `404` — página "Menú no encontrado" |
| E02 | `menu.status = draft` | `404` (mismo comportamiento que no-existe, para no filtrar info) |

**Criterios de aceptación:**

```gherkin
Scenario: Visitante ve el menú publicado
  Given un menú published en slug "el-buen-sabor" con 2 páginas
  When un visitante anónimo abre GET /api/v1/public/menu/el-buen-sabor
  Then recibe status 200 con las páginas y elementos
  And cada product_card incluye name/price/image leídos en vivo del producto

Scenario: Tarjeta de un producto desactivado se oculta
  Given un product_card vinculado a un producto con status = inactive
  When se obtiene el menú público
  Then esa tarjeta no aparece en la respuesta

Scenario: Menú en borrador no es visible públicamente
  Given un menú con status = draft
  When un visitante anónimo intenta acceder a su slug
  Then recibe status 404
```

**Contrato API (público, sin auth):**

`GET /api/v1/public/menu/:slug`

Response 200:
```json
{
  "tenantName": "El Buen Sabor",
  "logo": "https://...",
  "pages": [
    {
      "name": "Comidas",
      "order": 0,
      "width": 1080, "height": 1920,
      "backgroundColor": "#FFFAF6",
      "elements": [
        {
          "type": "product_card",
          "x": 100, "y": 200, "width": 300, "height": 120, "rotation": 0, "zIndex": 1,
          "product": { "name": "Hamburguesa Clásica", "salePrice": 18000, "image": "https://...", "description": "..." },
          "fieldConfig": { "showImage": true, "showName": true, "showPrice": true, "showDescription": false }
        },
        { "type": "text", "x": 50, "y": 50, "width": 400, "height": 60, "content": { "text": "Bienvenidos" }, "style": { "fontSize": 28 } }
      ]
    }
  ]
}
```

Response 404: `{ "message": "Menú no encontrado." }`

-----

## UC-26-06: Cambiar el slug manualmente (acción explícita y advertida)

**Actor:** `owner`, `admin`
**Roles permitidos:** OW, AD

**Flujo principal:**

1. Actor envía `PATCH /menu/slug` con `newSlug`.
1. Sistema valida formato (`^[a-z0-9-]{3,60}$`) y unicidad global.
1. **Si `menu.status = published` y `qr_code_url` ya existe**, el sistema debe mostrar (a nivel de frontend, antes de confirmar) una advertencia explícita: cambiar el slug invalida el QR impreso actual y genera uno nuevo.
1. Tras confirmación, sistema actualiza `slug`, regenera `qr_code_url` apuntando a la nueva URL, y reemplaza el archivo anterior en R2.
1. Registra `update` en `audit_log` con `metadata: { oldSlug, newSlug }`.

**Excepciones:**

| ID | Condición | Respuesta |
|---|---|---|
| E01 | `newSlug` ya usado por otro tenant | `409` — "Esta URL ya está en uso." |
| E02 | Formato inválido | `400` |

**Criterios de aceptación:**

```gherkin
Scenario: Cambiar slug regenera el QR
  Given un menú published con slug "el-buen-sabor" y qrCodeUrl existente
  When el owner envía PATCH /api/v1/menu/slug con { newSlug: "buen-sabor-bogota" }
  Then recibe status 200
  And menu.slug = "buen-sabor-bogota"
  And menu.qrCodeUrl apunta a una imagen QR distinta de la anterior

Scenario: Slug ya tomado
  Given el slug "pizza-loca" ya pertenece a otro tenant
  When se intenta cambiar a "pizza-loca"
  Then recibe status 409
```

**Contrato API:**

`PATCH /api/v1/menu/slug` → Request: `{ "newSlug": "buen-sabor-bogota" }` → Response 200: menú actualizado con nuevo `slug` y `qrCodeUrl`.

-----

## 2. Notas de UI (complementan `dewan-design-system.md`)

- El editor canvas vive como una pantalla de **pantalla completa** propia (no dentro del layout sidebar+topbar estándar), similar a la convención de "Pantalla completa" para reportes/configuración (ver tabla de diálogos en el design system), porque necesita todo el espacio para el área de trabajo.
- Panel lateral izquierdo: lista de productos del catálogo (drag source). Panel lateral derecho: propiedades del elemento seleccionado (estilo, posición, `fieldConfig` si es `product_card`).
- Tabs superiores para las `menu_page`, con botón `+` para agregar página (icono `pi pi-plus`) y opción de arrastrar para reordenar.
- Botón primario "Publicar" (coral, `--dw-coral-500`) en la topbar del editor. Cuando `status = published`, el botón cambia a "Ver menú público" + ícono de QR (`pi pi-qrcode`) que abre un modal con el QR descargable (PNG/SVG) y el link copiable — **nunca regenera nada al abrir este modal**, solo muestra lo ya generado.
- Autoguardado: mostrar un indicador discreto tipo "Guardado" / "Guardando..." (similar a Google Docs), no un botón de "Guardar" explícito para el contenido del canvas.
- Cambiar el `slug` (UC-26-06) vive en un modal de confirmación separado, con texto de advertencia explícito y botón secundario (no el botón primario de acción) para evitar clics accidentales.

-----

## 3. Funcionalidades excluidas de este spec (fase futura)

| Funcionalidad | Notas |
|---|---|
| Pedidos desde el menú público | Requiere carrito, identificación de cliente y conexión con SPEC-07 (Orders). Excluido por decisión confirmada en esta conversación. |
| Múltiples menús por tenant | MVP asume 1:1 tenant↔menu. Útil a futuro para sucursales (relacionado con SPEC-21). |
| Plantillas predefinidas / galería de diseños | Acelerador de UX, no bloqueante para el MVP. |
| Analítica de visitas al menú (vistas, escaneos de QR) | Requeriría tracking adicional; no incluido en este spec. |
| Versionado/historial de diseños (undo más allá de la sesión actual) | El autoguardado sobrescribe el estado actual; no hay historial persistente en MVP. |

-----

## 4. Registro de decisiones (de esta conversación)

| # | Decisión | Justificación |
|---|----------|----------------|
| D-26-01 | Editor canvas libre (posición x/y arbitraria), no solo configurador de temas | Decisión explícita del usuario — prioriza flexibilidad de diseño sobre velocidad de desarrollo |
| D-26-02 | Menú público es solo informativo, sin pedidos | Decisión explícita del usuario — coincide con "Zona pública" ya marcada como fase futura en `rsoft-analisis.md` |
| D-26-03 | Soporta múltiples páginas por menú | Decisión explícita del usuario |
| D-26-04 | `product_card` totalmente editable en estilo y campos visibles, pero con datos (`name`/`price`) siempre en vivo desde `product` | Balance entre flexibilidad visual y evitar inconsistencias de precio entre catálogo y menú público |
| D-26-05 | `slug` y `qr_code_url` permanecen fijos a través de ediciones de contenido; solo cambian con una acción explícita y advertida | Decisión explícita del usuario — el QR impreso no debe quedar obsoleto cada vez que el negocio edita su carta |