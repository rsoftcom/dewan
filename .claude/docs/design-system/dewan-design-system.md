# Dewan — Design System & Style Guide

> **Versión:** 1.0  
> **Última actualización:** 2026-05-20  
> **Stack UI:** Angular 18+ · PrimeNG (Aura) · Tailwind CSS · PrimeIcons  
> **Documento de referencia:** Este archivo es la fuente de verdad para todo el diseño visual del aplicativo Dewan. Cualquier pantalla, componente o módulo nuevo debe seguir estas directrices.

-----

## 1. Identidad de marca

|Atributo         |Valor                                                         |
|-----------------|--------------------------------------------------------------|
|**Nombre**       |Dewan                                                         |
|**Pronunciación**|/de-wan/ — como “de una”                                      |
|**Tagline**      |“De una o ya” — gestión de negocios sin complicaciones        |
|**Empresa**      |R Soft Company                                                |
|**Público**      |Restaurantes, cafeterías, tiendas, locales comerciales (LATAM)|
|**Dominio**      |dewan.com                                                     |
|**App URL**      |app.dewan.com                                                 |

### 1.1 Logo

El logo consta de dos elementos: el **ícono** (la letra D estilizada con líneas de velocidad) y el **wordmark** (“dewan” en texto). Se usan en combinación o por separado según el contexto:

|Contexto         |Variante                              |
|-----------------|--------------------------------------|
|Navbar del app   |Ícono (36px) + wordmark               |
|Favicon          |Solo ícono dentro de cuadrado coral   |
|App icon (mobile)|Solo ícono sobre fondo coral degradado|
|Footer           |Ícono + wordmark versión clara/oscura |
|Splash/Login     |Ícono centrado + wordmark + tagline   |

El wordmark usa la fuente **Outfit** (weight 800). La primera parte “de” va en color oscuro (`--dw-dark`) y “wan” en coral (`--dw-coral-500`).

-----

## 2. Paleta de colores

### 2.1 Colores primarios de marca

|Token           |Hex      |Uso                                                        |
|----------------|---------|-----------------------------------------------------------|
|`--dw-coral-50` |`#FFF4EE`|Fondos hover sutiles, backgrounds de badges                |
|`--dw-coral-100`|`#FFE0D0`|Fondos de alertas informativas, highlights                 |
|`--dw-coral-200`|`#FFC1A1`|Bordes activos en hover, barras de progreso suaves         |
|`--dw-coral-300`|`#FF9E6E`|Iconos secundarios, decoraciones                           |
|`--dw-coral-400`|`#FF8F5E`|Hover de botones secundarios                               |
|`--dw-coral-500`|`#FF6B35`|**Color principal de marca.** Botones primarios, links, CTA|
|`--dw-coral-600`|`#E85A28`|Hover de botones primarios, estados pressed                |
|`--dw-coral-700`|`#C44A1E`|Texto sobre fondos claros cuando se necesita contraste     |
|`--dw-coral-800`|`#9E3B17`|Badges sobre fondos oscuros                                |
|`--dw-coral-900`|`#7A2E11`|Sombras de marca, bordes de énfasis                        |

### 2.2 Colores de superficie (surface)

|Token             |Hex      |Uso                                                  |
|------------------|---------|-----------------------------------------------------|
|`--dw-surface-0`  |`#FFFFFF`|Fondo de cards, modales, popups                      |
|`--dw-surface-50` |`#FFFAF6`|Fondo principal del área de contenido (cream cálido) |
|`--dw-surface-100`|`#F7F5F0`|Fondo de secciones alternas, inputs deshabilitados   |
|`--dw-surface-200`|`#F0EDE6`|Fondo de sidebar en modo claro, separadores          |
|`--dw-surface-300`|`#E5E2DA`|Bordes de inputs, dividers                           |
|`--dw-surface-400`|`#C9BFB4`|Placeholder text, iconos inactivos                   |
|`--dw-surface-500`|`#9C8E82`|Texto secundario, labels, hints                      |
|`--dw-surface-600`|`#6B5E52`|Texto de párrafos, descripciones                     |
|`--dw-surface-700`|`#3D352E`|Texto de headings secundarios                        |
|`--dw-surface-800`|`#1A1028`|Sidebar oscuro, fondo de navbar en dark mode         |
|`--dw-surface-900`|`#0E0A14`|Fondo de modales overlay, fondo de pantalla de cocina|

### 2.3 Colores semánticos

|Token         |Hex      |Uso                                                       |
|--------------|---------|----------------------------------------------------------|
|`--dw-success`|`#16A34A`|Pedido listo, stock OK, operación exitosa, badges verdes  |
|`--dw-warning`|`#D97706`|Stock bajo, pedido pendiente, alertas no críticas         |
|`--dw-danger` |`#DC2626`|Error, pedido cancelado, stock agotado, validación fallida|
|`--dw-info`   |`#2563EB`|Información contextual, tooltips, links de ayuda          |

### 2.4 Colores de estado de pedidos (dominio)

Estos colores son específicos del flujo de pedidos y se mapean a badges (`p-tag`) del aplicativo:

|Estado      |Color fondo          |Color texto      |Badge severity|
|------------|---------------------|-----------------|--------------|
|`pending`   |`rgba(217,119,6,.1)` |`#D97706`        |`warn`        |
|`in_kitchen`|`rgba(255,143,94,.1)`|`#FF8F5E`        |custom coral  |
|`prepared`  |`rgba(37,99,235,.1)` |`#2563EB`        |`info`        |
|`served`    |`rgba(124,58,237,.1)`|`#7C3AED`        |custom violet |
|`paid`      |`rgba(22,163,74,.1)` |`#16A34A`        |`success`     |
|`completed` |`rgba(22,163,74,.08)`|`#16A34A` (opaco)|`success`     |
|`cancelled` |`rgba(220,38,38,.1)` |`#DC2626`        |`danger`      |

### 2.5 Colores complementarios

|Token              |Hex      |Uso                                                    |
|-------------------|---------|-------------------------------------------------------|
|`--dw-violet`      |`#7C3AED`|Acento secundario, badges “servido”, gráficas          |
|`--dw-violet-light`|`#A78BFA`|Fondos de hover en elementos violeta                   |
|`--dw-lime`        |`#C4F82A`|Indicadores positivos en dark mode, acentos en gráficas|

-----

## 3. Tipografía

El aplicativo usa la tipografía nativa del tema **Aura** de PrimeNG. No se agregan fuentes externas al app (las fuentes de la landing son diferentes del aplicativo).

|Nivel     |Fuente del sistema Aura     |Peso|Tamaño |Uso                                     |
|----------|----------------------------|----|-------|----------------------------------------|
|Display   |Sistema (Inter/system stack)|700 |1.75rem|Títulos de página principales           |
|Heading 1 |Sistema                     |700 |1.5rem |Títulos de secciones                    |
|Heading 2 |Sistema                     |600 |1.25rem|Subtítulos, nombres de cards            |
|Heading 3 |Sistema                     |600 |1.1rem |Labels de sección, títulos de dialogs   |
|Body      |Sistema                     |400 |0.95rem|Texto general, contenido de tablas      |
|Body small|Sistema                     |400 |0.85rem|Texto secundario, descripciones         |
|Caption   |Sistema                     |500 |0.75rem|Labels de formularios, timestamps       |
|Mono      |JetBrains Mono / monospace  |400 |0.85rem|Valores numéricos grandes, IDs de pedido|

PrimeNG Aura ya define su propia `font-family` basada en el stack del sistema. No sobreescribir.

-----

## 4. Espaciado y grid

Se usa el sistema de **8pt grid** para mantener ritmo visual consistente.

|Token   |Valor|Uso típico                                   |
|--------|-----|---------------------------------------------|
|`--sp-1`|4px  |Gap entre icono y texto en badges            |
|`--sp-2`|8px  |Padding interno de badges, gap de chips      |
|`--sp-3`|12px |Padding de celdas de tabla, gap de form group|
|`--sp-4`|16px |Padding de cards, margin entre inputs        |
|`--sp-5`|24px |Separación entre secciones dentro de cards   |
|`--sp-6`|32px |Padding de contenedores principales          |
|`--sp-7`|48px |Separación entre secciones de página         |
|`--sp-8`|64px |Padding vertical de secciones mayores        |

Equivalencias en Tailwind: `gap-1` = 4px, `gap-2` = 8px, `p-4` = 16px, etc. Usar las utilidades de Tailwind para layouts y el spacing nativo de PrimeNG para componentes.

-----

## 5. Border radius

|Token     |Valor |Uso                                               |
|----------|------|--------------------------------------------------|
|`--r-sm`  |6px   |Inputs, botones, badges, tags                     |
|`--r-md`  |10px  |Cards, paneles, dropdowns                         |
|`--r-lg`  |16px  |Modales, dialogs, cards destacadas                |
|`--r-xl`  |24px  |Cards de onboarding, contenedores hero            |
|`--r-full`|9999px|Avatares, chips, toggle switches, botones redondos|

PrimeNG Aura usa border-radius consistentes. Sobreescribir solo si se necesita ajustar el `--p-border-radius` global.

-----

## 6. Sombras

|Nivel |Valor CSS                       |Uso                        |
|------|--------------------------------|---------------------------|
|`sm`  |`0 1px 3px rgba(14,10,20,.06)`  |Cards en estado default    |
|`md`  |`0 4px 16px rgba(14,10,20,.08)` |Cards en hover, dropdowns  |
|`lg`  |`0 12px 40px rgba(14,10,20,.1)` |Modales, drawers           |
|`xl`  |`0 24px 60px rgba(14,10,20,.12)`|Overlays, pantalla completa|
|`glow`|`0 6px 24px rgba(255,107,53,.2)`|Botones primarios          |

-----

## 7. Configuración de PrimeNG Aura (definePreset)

Este es el archivo de configuración del tema personalizado de Dewan sobre Aura. Se ubica en `frontend/src/app/theme/dewan-preset.ts`:

```typescript
// dewan-preset.ts
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const DewanPreset = definePreset(Aura, {
  primitive: {
    // Paleta coral de marca (reemplaza la primary por defecto de Aura)
    coral: {
      50:  '#FFF4EE',
      100: '#FFE0D0',
      200: '#FFC1A1',
      300: '#FF9E6E',
      400: '#FF8F5E',
      500: '#FF6B35',
      600: '#E85A28',
      700: '#C44A1E',
      800: '#9E3B17',
      900: '#7A2E11',
      950: '#5C2009',
    },
  },
  semantic: {
    primary: {
      50:  '{coral.50}',
      100: '{coral.100}',
      200: '{coral.200}',
      300: '{coral.300}',
      400: '{coral.400}',
      500: '{coral.500}',
      600: '{coral.600}',
      700: '{coral.700}',
      800: '{coral.800}',
      900: '{coral.900}',
      950: '{coral.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color:        '{coral.500}',
          inverseColor: '#ffffff',
          hoverColor:   '{coral.600}',
          activeColor:  '{coral.700}',
        },
        highlight: {
          background:      '{coral.50}',
          focusBackground: '{coral.100}',
          color:           '{coral.700}',
          focusColor:      '{coral.800}',
        },
        surface: {
          0:   '#ffffff',
          50:  '#FFFAF6',
          100: '#F7F5F0',
          200: '#F0EDE6',
          300: '#E5E2DA',
          400: '#C9BFB4',
          500: '#9C8E82',
          600: '#6B5E52',
          700: '#3D352E',
          800: '#1A1028',
          900: '#0E0A14',
          950: '#080510',
        },
      },
      dark: {
        primary: {
          color:        '{coral.400}',
          inverseColor: '{coral.950}',
          hoverColor:   '{coral.300}',
          activeColor:  '{coral.200}',
        },
        highlight: {
          background:      'rgba(255, 107, 53, .16)',
          focusBackground: 'rgba(255, 107, 53, .24)',
          color:           'rgba(255,255,255,.87)',
          focusColor:      'rgba(255,255,255,.87)',
        },
        surface: {
          0:   '#121212',
          50:  '#1A1028',
          100: '#1E1830',
          200: '#241E38',
          300: '#2D2542',
          400: '#3D3556',
          500: '#6B5E7A',
          600: '#9C8E9F',
          700: '#C9BFC9',
          800: '#E5E2E8',
          900: '#F7F5F8',
          950: '#FDFCFD',
        },
      },
    },
  },
});
```

### 7.1 Registro del tema en app.config.ts

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { DewanPreset } from './theme/dewan-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: DewanPreset,
        options: {
          prefix: 'p',
          darkModeSelector: '.app-dark',
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities',
          },
        },
      },
    }),
  ],
};
```

### 7.2 Orden de capas CSS (cssLayer)

PrimeNG y Tailwind conviven sin conflictos usando CSS layers:

```
tailwind-base → primeng → tailwind-utilities
```

En `styles.scss`:

```scss
@layer tailwind-base, primeng, tailwind-utilities;

@layer tailwind-base {
  @tailwind base;
}

@layer tailwind-utilities {
  @tailwind components;
  @tailwind utilities;
}
```

-----

## 8. Configuración de Tailwind (colores extendidos)

En `tailwind.config.js`, extender los colores para que Tailwind pueda usar la paleta Dewan con clases utilitarias:

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        coral: {
          50:  '#FFF4EE',
          100: '#FFE0D0',
          200: '#FFC1A1',
          300: '#FF9E6E',
          400: '#FF8F5E',
          500: '#FF6B35',
          600: '#E85A28',
          700: '#C44A1E',
          800: '#9E3B17',
          900: '#7A2E11',
          950: '#5C2009',
        },
        dark: {
          DEFAULT: '#0E0A14',
          800: '#1A1028',
          700: '#241E38',
          600: '#2D2542',
        },
        surface: {
          cream: '#FFFAF6',
          warm:  '#F0EDE6',
        },
      },
    },
  },
  plugins: [],
};
```

Uso: `bg-coral-500`, `text-coral-700`, `border-coral-200`, `bg-dark-800`, `bg-surface-cream`.

-----

## 9. Layout del aplicativo

### 9.1 Estructura base

```
┌─────────────────────────────────────────────────────┐
│  Topbar (68px) — logo, tenant name, user menu       │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ Sidebar  │           Content Area                   │
│  (240px) │                                          │
│          │   ┌──────────────────────────────────┐   │
│  Menú    │   │  Page Header                     │   │
│  de nav  │   │  (título + acciones)             │   │
│          │   ├──────────────────────────────────┤   │
│          │   │                                  │   │
│          │   │  Page Content                    │   │
│          │   │  (cards, tablas, forms)           │   │
│          │   │                                  │   │
│          │   └──────────────────────────────────┘   │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### 9.2 Reglas de layout

|Zona             |Fondo                      |Ancho     |
|-----------------|---------------------------|----------|
|Topbar           |`--dw-surface-0` (blanco)  |100%      |
|Sidebar          |`--dw-surface-800` (oscuro)|240px fijo|
|Sidebar colapsado|`--dw-surface-800`         |64px      |
|Content area     |`--dw-surface-50` (cream)  |Fluido    |
|Cards dentro     |`--dw-surface-0` (blanco)  |Fluido    |

El sidebar siempre es **oscuro** con texto claro. El ítem activo usa fondo `--dw-coral-500` con texto blanco. Los ítems inactivos usan `rgba(255,255,255,.45)`.

En pantallas < 768px, el sidebar se oculta y se muestra como drawer/overlay.

### 9.3 Pantalla de cocina (caso especial)

La pantalla de cocina (`/kitchen`) usa un layout **fullscreen dark** sin sidebar:

|Zona              |Fondo                          |
|------------------|-------------------------------|
|Fondo completo    |`--dw-surface-900` (muy oscuro)|
|Cards de pedidos  |`--dw-surface-800`             |
|Badge de prioridad|Coral con glow                 |
|Texto principal   |Blanco                         |
|Texto secundario  |`rgba(255,255,255,.45)`        |

-----

## 10. Guía de componentes PrimeNG

### 10.1 Botones (p-button)

|Variante |Cuándo usar                                 |Config PrimeNG                       |
|---------|--------------------------------------------|-------------------------------------|
|Primary  |Acción principal (Guardar, Crear, Confirmar)|`severity="primary"` (default)       |
|Secondary|Acción secundaria (Cancelar, Volver)        |`severity="secondary"`               |
|Success  |Confirmar pedido, aceptar                   |`severity="success"`                 |
|Danger   |Eliminar, cancelar pedido                   |`severity="danger"`                  |
|Outlined |Acciones terciarias, filtros                |`[outlined]="true"`                  |
|Text     |Acciones inline (ver detalle, editar)       |`[text]="true"`                      |
|Icon only|Acciones en tablas (ojo, lápiz, basura)     |`icon="pi pi-eye"` `[rounded]="true"`|

Reglas: máximo 1 botón primario por vista. Si hay 2 acciones, una es primaria y la otra outlined o secondary.

### 10.2 Tablas (p-table)

Las tablas son el componente más usado en Dewan. Configuración estándar:

```html
<p-table
  [value]="items()"
  [paginator]="true"
  [rows]="20"
  [lazy]="true"
  [showCurrentPageReport]="true"
  currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords}"
  [rowHover]="true"
  styleClass="p-datatable-sm"
  (onLazyLoad)="onPageChange($event)"
>
```

Reglas de tablas:

- Siempre usar `p-datatable-sm` para densidad cómoda
- Paginación server-side con `[lazy]="true"`
- `[rowHover]="true"` siempre
- Columnas de acciones alineadas a la derecha
- Columnas numéricas (totales, cantidades) alineadas a la derecha
- Los IDs de pedido (#0051) se muestran en `font-weight: 700` y monospace

### 10.3 Cards (p-card)

Las cards se usan para agrupar información relacionada. No abusar; preferir diseño plano cuando la agrupación es obvia.

Variantes:

- **Card estándar:** fondo blanco, border `--dw-surface-300`, radius `--r-md`
- **Card de stat:** compacta, muestra un valor numérico grande + label + cambio porcentual
- **Card de pedido (cocina):** fondo oscuro, badge de estado, lista de ítems

### 10.4 Tags / Badges (p-tag)

Usar `p-tag` para estados de pedido, roles de usuario y categorías:

```html
<!-- Estados de pedido -->
<p-tag value="Pendiente" severity="warn" />
<p-tag value="En cocina" [style]="{'background': 'rgba(255,143,94,.1)', 'color': '#FF8F5E'}" />
<p-tag value="Listo" severity="success" />
<p-tag value="Servido" [style]="{'background': 'rgba(124,58,237,.1)', 'color': '#7C3AED'}" />
<p-tag value="Pagado" severity="success" />
<p-tag value="Cancelado" severity="danger" />
```

### 10.5 Formularios

Configuración estándar de formularios con PrimeNG:

- Labels arriba del input (no floating labels)
- Usar `pInputText` para inputs de texto
- Usar `p-select` (antes p-dropdown) para selects
- Usar `p-inputNumber` para valores numéricos y precios
- Errores en rojo debajo del input con `<small class="p-error">`
- Inputs agrupados en grids de 2 o 3 columnas en desktop, 1 en mobile

### 10.6 Diálogos (p-dialog)

|Tipo             |Ancho|Uso                               |
|-----------------|-----|----------------------------------|
|Confirmación     |400px|Eliminar, cancelar pedido         |
|Formulario corto |500px|Crear producto, agregar usuario   |
|Formulario largo |700px|Editar pedido completo, receta    |
|Pantalla completa|90vw |Reportes detallados, configuración|

Siempre incluir: título descriptivo, botón de cerrar (X), acciones al footer (Cancelar + Acción primaria).

### 10.7 Toast / Mensajes

Usar `p-toast` posicionado en `top-right`. Severidades:

- `success` → operación exitosa (guardado, creado, actualizado)
- `error` → fallo de operación
- `warn` → alerta (stock bajo, conexión inestable)
- `info` → informativo (nuevo pedido entrante vía WebSocket)

Duración: 3 segundos para success/info, 5 segundos para warn/error.

### 10.8 Menú de navegación (sidebar)

Estructura del menú principal con `p-menu` o `p-panelmenu`:

```
📊  Dashboard
─────────────
📋  Pedidos
🛒  Productos
📦  Inventario
─────────────
💰  Caja
📊  Reportes
🧑‍🍳  Cocina
─────────────
👥  Equipo
⚙️  Configuración
```

Iconos: usar PrimeIcons (`pi pi-chart-bar`, `pi pi-list`, `pi pi-box`, etc.). Complementar con emojis solo en la pantalla de cocina fullscreen.

### 10.9 Gráficas (PrimeNG Charts / Chart.js)

Paleta de colores para gráficas, en orden de uso:

```typescript
export const CHART_COLORS = {
  primary:   '#FF6B35',  // coral — serie principal
  secondary: '#7C3AED',  // violet — serie secundaria
  tertiary:  '#2563EB',  // blue — serie terciaria
  success:   '#16A34A',  // green — positivo
  warning:   '#D97706',  // amber — atención
  danger:    '#DC2626',  // red — negativo
  muted:     '#C9BFB4',  // gris cálido — referencia/baseline
};
```

Reglas: fondo de gráficas siempre blanco. Grid lines en `rgba(0,0,0,.06)`. Tooltips con fondo oscuro y texto blanco.

-----

## 11. Breakpoints y responsive

|Nombre|Ancho mínimo|Uso                                        |
|------|------------|-------------------------------------------|
|`sm`  |576px       |Celulares landscape                        |
|`md`  |768px       |Tablets portrait — sidebar colapsa a drawer|
|`lg`  |1024px      |Tablets landscape — layout completo        |
|`xl`  |1280px      |Desktop estándar                           |
|`2xl` |1536px      |Monitores grandes                          |

Estos coinciden con los breakpoints de Tailwind por defecto. PrimeNG respeta estos mismos breakpoints para sus componentes responsive.

La pantalla de **POS / toma de pedidos** está optimizada para tablets de 10” (1024px) en modo landscape.

-----

## 12. Iconografía

Usar **PrimeIcons** como fuente primaria. Están integrados con PrimeNG y se usan así:

```html
<i class="pi pi-shopping-cart"></i>
<p-button icon="pi pi-plus" label="Nuevo pedido" />
```

Iconos más usados en el aplicativo:

|Concepto      |Icono PrimeIcons  |
|--------------|------------------|
|Dashboard     |`pi pi-chart-bar` |
|Pedidos       |`pi pi-list`      |
|Productos     |`pi pi-tag`       |
|Inventario    |`pi pi-box`       |
|Caja          |`pi pi-wallet`    |
|Reportes      |`pi pi-chart-line`|
|Cocina        |`pi pi-stopwatch` |
|Usuarios      |`pi pi-users`     |
|Configuración |`pi pi-cog`       |
|Buscar        |`pi pi-search`    |
|Agregar       |`pi pi-plus`      |
|Editar        |`pi pi-pencil`    |
|Eliminar      |`pi pi-trash`     |
|Ver detalle   |`pi pi-eye`       |
|Cerrar        |`pi pi-times`     |
|Menú          |`pi pi-bars`      |
|Notificaciones|`pi pi-bell`      |
|Salir         |`pi pi-sign-out`  |

-----

## 13. Reglas generales de diseño

1. **Consistencia sobre creatividad.** El aplicativo no es una landing — es una herramienta de trabajo. Priorizar claridad y eficiencia sobre efectos visuales.
1. **Densidad cómoda.** Los usuarios pasan horas en el sistema. Ni demasiado compacto (fatiga visual) ni demasiado espaciado (scroll innecesario). El `p-datatable-sm` de PrimeNG es la densidad correcta.
1. **Un color primario.** El coral `#FF6B35` se usa solo para acciones primarias, enlaces y el estado activo del sidebar. No usar coral para decoración. Si todo es coral, nada destaca.
1. **Fondos cálidos, no blancos puros.** El área de contenido usa cream `#FFFAF6`, no `#FFFFFF`. Las cards sí usan blanco puro para crear contraste sutil con el fondo.
1. **El sidebar siempre es oscuro.** No hay variante de sidebar claro. Esto crea una separación visual clara entre navegación y contenido.
1. **Toasts, no alertas inline.** Las confirmaciones y errores de operaciones se muestran como toasts, no como banners dentro del contenido. Los errores de validación de formularios sí son inline.
1. **Tablas antes que cards.** Para listas de datos (pedidos, productos, inventario), preferir tablas con `p-table`. Las cards se reservan para dashboards y vistas de resumen.
1. **Sin animaciones innecesarias.** PrimeNG ya incluye transiciones suaves. No agregar animaciones CSS extra salvo en la pantalla de cocina (donde el movimiento llama la atención del equipo).
1. **Mobile-first en componentes críticos.** La toma de pedidos y la pantalla de cocina deben funcionar impecablemente en tablet. Las tablas usan scroll horizontal en mobile; los forms se apilan a 1 columna.
1. **Accesibilidad.** Todos los inputs con labels visibles. Contraste mínimo 4.5:1. Focus visible en todos los elementos interactivos (PrimeNG Aura lo maneja por defecto).

-----

## 14. Archivos de referencia del proyecto

|Archivo                             |Contenido                                    |
|------------------------------------|---------------------------------------------|
|`rsoft-arquitectura.md`             |Stack completo, decisiones de infraestructura|
|`rsoft-arquitectura-fase3.md`       |Arquitectura actualizada fase 3              |
|`rsoft-coding-conventions-naming.md`|Convenciones de código y nomenclatura        |
|`rsoft-entities.md`                 |Modelo de entidades de base de datos         |
|`rsoft-sdd-specs.md`                |Especificaciones funcionales del sistema     |
|`rsoft-analisis.md`                 |Análisis de requerimientos                   |
|**Este archivo**                    |Design system y guía de estilos visual       |

-----

## 15. Registro de decisiones — Diseño

|#    |Fecha     |Decisión                                       |Justificación                                         |
|-----|----------|-----------------------------------------------|------------------------------------------------------|
|DS-1 |2026-05-20|Nombre del producto: **Dewan**                 |“De wan” = “de una”. Dominio .com libre, sin conflicto|
|DS-2 |2026-05-20|Color primario: coral `#FF6B35`                |Energético, food-friendly, diferente de competencia   |
|DS-3 |2026-05-20|Tema PrimeNG: **Aura** personalizado           |Moderno, CSS variables, soporte dark mode             |
|DS-4 |2026-05-20|Sidebar siempre oscuro                         |Separación visual clara navegación vs contenido       |
|DS-5 |2026-05-20|Fondo cream cálido `#FFFAF6`                   |Evita blanco frío, reduce fatiga visual               |
|DS-6 |2026-05-20|Fuentes: sistema (Aura default), no custom     |Mejor rendimiento, menor bundle, consistencia PrimeNG |
|DS-7 |2026-05-20|cssLayer order: tailwind-base, primeng, tw-util|Evita conflictos entre Tailwind y PrimeNG             |
|DS-8 |2026-05-20|Dark mode selector: `.app-dark`                |Toggle manual, no automático por sistema              |
|DS-9 |2026-05-20|Cocina: layout fullscreen dark sin sidebar     |Optimizado para pantallas grandes en cocina           |
|DS-10|2026-05-20|Densidad: `p-datatable-sm` estándar            |Balance entre info density y comfort                  |