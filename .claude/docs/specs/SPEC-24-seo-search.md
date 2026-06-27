# SPEC-24: SEO y Búsqueda

**Descripción:** Mejoras transversales de visibilidad en buscadores (SEO) y experiencia de búsqueda
dentro de la app. No agrega funcionalidad de negocio; mejora la calidad técnica y la experiencia de
usuario en las páginas de listado.

**Actores:** Motores de búsqueda (SEO), todos los usuarios autenticados (búsqueda)

**Completado:** 2026-06-26

---

## Contexto

Dewan es una SaaS multi-tenant. La única página **públicamente indexable** es `/login`; el resto
requiere autenticación. Sin embargo, el SEO importa por:

1. **Compartir links:** cuando un link de la app se pega en WhatsApp, Slack o redes sociales, las
   plataformas leen los meta OG para generar la vista previa.
2. **Identidad de marca:** el título en la pestaña del navegador y en los resultados de Google
   refleja el módulo activo.
3. **Indexación correcta:** sin `robots.txt`, los crawlers pueden indexar páginas autenticadas que
   devuelven 401 → spam en el índice de Google.

---

## SEO

### SEO-01: Meta tags base en `index.html`

**Objetivo:** Que la página de login aparezca correctamente en Google y al compartir en redes.

**Cambios en `dewan-frontend/index.html`:**

| Tag | Valor |
|---|---|
| `<title>` | `Dewan — Gestión para restaurantes y negocios locales` |
| `meta description` | `Dewan es la plataforma todo-en-uno para restaurantes y negocios locales en LATAM: pedidos, caja, inventario, reportes y más, en tiempo real.` |
| `meta theme-color` | `#FF6B35` (coral primario de Dewan) |
| `meta robots` | `index, follow, max-snippet:-1` |
| `link canonical` | `https://app.getdewan.com/login` (actualizado dinámicamente por SeoService) |

**Open Graph:**

| Propiedad | Valor |
|---|---|
| `og:type` | `website` |
| `og:site_name` | `Dewan` |
| `og:title` | `Dewan — Gestión para restaurantes y negocios locales` |
| `og:description` | La misma que `meta description` |
| `og:url` | `https://app.getdewan.com` |
| `og:image` | `https://app.getdewan.com/assets/og-image.png` (1200×630) |
| `og:locale` | `es_CO` |

**Twitter Card:**

| Propiedad | Valor |
|---|---|
| `twitter:card` | `summary_large_image` |
| `twitter:title` | Igual que `og:title` |
| `twitter:description` | Igual que `og:description` |
| `twitter:image` | Igual que `og:image` |

**Criterio de aceptación:**

```gherkin
Scenario: Link de la app muestra vista previa en WhatsApp
  Given la URL https://app.getdewan.com/login
  When se pega el link en WhatsApp
  Then se muestra el título "Dewan — Gestión para restaurantes..."
  And se muestra la imagen og:image
  And se muestra la descripción de la plataforma
```

---

### SEO-02: `SeoService` — título y meta dinámicos por ruta

**Archivo:** `dewan-frontend/core/services/seo.service.ts`

El servicio se suscribe a eventos `NavigationEnd` del Router de Angular y actualiza:

- `<title>` → `{Nombre de página} | Dewan` (o solo `Dewan` si no hay título definido)
- `meta[name="description"]`
- `meta[property="og:title"]`
- `meta[property="og:description"]`
- `meta[property="og:url"]`
- `link[rel="canonical"]`

**Inicialización:** registrado como `APP_INITIALIZER` en `app.config.ts`. Se ejecuta una vez al
arrancar la app antes del primer render.

```typescript
{
  provide: APP_INITIALIZER,
  useFactory: (seo: SeoService) => () => seo.init(),
  deps: [SeoService],
  multi: true,
}
```

**Criterio de aceptación:**

```gherkin
Scenario: Título de la pestaña cambia al navegar entre módulos
  Given el usuario está autenticado como owner
  When navega a /products
  Then el título de la pestaña del navegador es "Productos | Dewan"
  When navega a /orders
  Then el título es "Pedidos | Dewan"
  When navega al dashboard
  Then el título es "Dashboard | Dewan"
```

---

### SEO-03: Route `data` con título y descripción por ruta

**Archivo:** `dewan-frontend/app/app.routes.ts`

Cada ruta tiene un campo `data` con las claves `title` y opcionalmente `description`:

```typescript
{
  path: 'products',
  data: {
    title: 'Productos',
    description: 'Gestiona el catálogo de productos e ingredientes de tu negocio.'
  },
  // ...
}
```

**Rutas con `title` definido:**

| Ruta | Título | Descripción |
|---|---|---|
| `/login` | *(vacío → solo "Dewan")* | Accede a Dewan... |
| `/dashboard` | Dashboard | Panel de control de tu negocio. |
| `/products` | Productos | Gestiona el catálogo de productos... |
| `/orders` | Pedidos | Crea y gestiona los pedidos en tiempo real. |
| `/customers` | Clientes | Gestiona el directorio de clientes... |
| `/cash-register` | Caja | Administra la apertura y cierre de caja... |
| `/movements` | Movimientos | Historial de ingresos y egresos de caja. |
| `/kitchen` | Cocina | Vista de cocina con pedidos en tiempo real. |
| `/inventory` | Inventario | Ajustes de inventario y alertas de stock bajo. |
| `/reports` | Reportes | Reportes de ventas, caja, compras e inventario. |
| `/users` | Usuarios | — |
| `/units` | Unidades | — |
| `/categories` | Categorías | — |
| `/suppliers` | Proveedores | — |
| `/purchases` | Compras | — |
| `/delivery` | Domicilios | — |
| `/notifications` | Notificaciones | — |
| `/profile` | Mi perfil | — |
| `/admin/tenants` | Plataforma | — |
| `/admin/audit-logs` | Audit Log | — |
| `/unauthorized` | Acceso denegado | — |

---

### SEO-04: `robots.txt` y `sitemap.xml`

**`dewan-frontend/public/robots.txt`:**

```
User-agent: *
Allow: /login
Disallow: /

Sitemap: https://app.getdewan.com/sitemap.xml
```

Racional: solo `/login` es público; el resto requiere autenticación. Bloquear el rastreo de rutas
autenticadas evita errores 401/redirect en el índice de Google.

**`dewan-frontend/public/sitemap.xml`:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://app.getdewan.com/login</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

---

### SEO-05: JSON-LD — datos estructurados de la aplicación

**Archivo:** `dewan-frontend/index.html` (bloque `<script type="application/ld+json">`)

Tipo: `SoftwareApplication`. Permite que Google muestre una ficha de app en los resultados de
búsqueda al buscar "Dewan gestión restaurantes".

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Dewan",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Plataforma todo-en-uno para restaurantes y negocios locales en LATAM.",
  "url": "https://app.getdewan.com",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "publisher": { "@type": "Organization", "name": "R Soft Company" }
}
```

---

### SEO-06: Canonical URL dinámico

El `SeoService` actualiza `<link rel="canonical">` en cada navegación apuntando a la URL limpia
(sin query params). El `index.html` incluye el canonical inicial apuntando a `/login`.

---

## Búsqueda

### SRCH-01: Icono de lupa en inputs de búsqueda

**Módulos afectados:** `product-list`, `user-list` (nuevo). `customer-list` ya lo tenía.

Se usa el componente `p-iconfield` + `p-inputicon` de PrimeNG 18:

```html
<p-iconfield iconPosition="right">
  <input pInputText [(ngModel)]="searchTerm"
    placeholder="Buscar por nombre..."
    (input)="onSearch()" autocomplete="off" />
  @if (searchTerm) {
    <p-inputicon styleClass="pi pi-times" style="cursor:pointer" (click)="clearSearch()" />
  } @else {
    <p-inputicon styleClass="pi pi-search" />
  }
</p-iconfield>
```

**Comportamiento:**
- Sin texto → icono `pi-search` (lupa gris, decorativo)
- Con texto → icono `pi-times` (×, cliqueable, limpia la búsqueda)

**Imports necesarios:** `IconFieldModule`, `InputIconModule` de `primeng/iconfield` y
`primeng/inputicon`.

---

### SRCH-02: Botón de limpiar búsqueda

**Módulos afectados:** `product-list`, `customer-list`, `user-list`

Cada componente expone el método `clearSearch()`:

```typescript
clearSearch(): void {
  this.searchTerm = '';
  this.page = 1;        // o currentPage / this.currentPage según el componente
  this.load();          // o this.loadUsers() según el componente
}
```

**Criterio de aceptación:**

```gherkin
Scenario: Limpiar búsqueda con un clic
  Given el usuario ha escrito "café" en el buscador de Productos
  And la tabla muestra resultados filtrados
  When hace clic en el ícono × del campo de búsqueda
  Then el campo queda vacío
  And la tabla se recarga mostrando todos los productos
```

```gherkin
Scenario: Icono adaptativo según estado del campo
  Given el campo de búsqueda está vacío
  Then se muestra el ícono de lupa (pi-search)
  When el usuario escribe cualquier carácter
  Then el ícono cambia a × (pi-times)
```

---

## Archivos modificados / creados

### Nuevos
| Archivo | Descripción |
|---|---|
| `dewan-frontend/core/services/seo.service.ts` | Servicio de SEO dinámico |
| `dewan-frontend/public/robots.txt` | Directivas para crawlers |
| `dewan-frontend/public/sitemap.xml` | Sitemap con solo /login |

### Modificados
| Archivo | Cambio |
|---|---|
| `dewan-frontend/index.html` | Meta tags, OG, Twitter Card, JSON-LD, canonical |
| `dewan-frontend/app/app.config.ts` | Registro de `SeoService` como `APP_INITIALIZER` |
| `dewan-frontend/app/app.routes.ts` | Campo `data: { title, description }` en todas las rutas |
| `dewan-frontend/features/products/pages/product-list.component.ts` | `IconFieldModule`, `InputIconModule`, wrapper iconfield, `clearSearch()` |
| `dewan-frontend/features/customers/pages/customer-list.component.ts` | Icono adaptativo (× cuando hay texto), `clearSearch()` |
| `dewan-frontend/features/users/pages/user-list.component.ts` | `IconFieldModule`, `InputIconModule`, wrapper iconfield, `clearSearch()` |

---

## Notas de implementación

- **`og:image`:** el archivo `assets/og-image.png` (1200×630) debe crearse y subirse a producción.
  Hasta entonces, la imagen OG no se muestra pero el resto de los tags funciona correctamente.
- **`apple-touch-icon`:** el archivo `assets/icons/apple-touch-icon.png` (180×180) se referencia
  en `index.html`; si no existe, el navegador lo ignora silenciosamente.
- **Canonical dinámico vs. estático:** el `index.html` define el canonical estático apuntando a
  `/login`. El `SeoService` lo actualiza en cada navegación via `document.querySelector`.
- **SPA y SEO:** Angular no tiene SSR activado. Los meta tags OG y JSON-LD son estáticos en el
  HTML inicial; Google puede leer el HTML post-JavaScript, pero WhatsApp/Facebook/LinkedIn solo leen
  el HTML estático. Para las páginas autenticadas esto no importa (privadas), y para `/login` los
  tags están en el `index.html` estático.
