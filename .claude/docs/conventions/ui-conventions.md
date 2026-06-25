# R Soft — Convenciones de UI: Componentes Frontend

> **Versión:** 1.0
> **Fecha:** 2026-05-31
> **Referencia canónica:** `movement-list.component.ts` y `cash-register-current.component.ts`

---

## 0. Advertencia: Tailwind `@layer utilities` vs. PrimeNG

Tailwind v3 envuelve las utilidades en `@layer utilities { ... }`, lo que les da **menor especificidad** que los estilos globales de PrimeNG (que no usan `@layer`). Resultado: clases como `flex-col`, `w-full`, `gap-2`, etc., son silenciosamente sobreescritas por PrimeNG dentro del contexto de un dialog o cualquier componente anidado.

**Regla:** Para layout y dimensionamiento NUNCA usar clases Tailwind en el template de componentes que se renderizan dentro de `p-dialog`. Usar clases semánticas en el bloque `styles:` del componente:

```css
/* En styles: del componente — NO confiar en Tailwind para esto */
.field         { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.field-no-mb   { margin-bottom: 0; }
.field-label   { display: block; font-size: 0.875rem; font-weight: 500; color: #475569; }
input.p-inputtext { width: 100%; box-sizing: border-box; }
```

Tailwind sí puede usarse para espaciados simples (`mb-4`, `mt-2`) que no afectan `display` ni `flex-direction`.

---

## 1. Principio general: CSS en scope, no inline

Todos los componentes de página deben usar un bloque `styles:` con clases semánticas.
**Nunca** poner `style="..."` en elementos estructurales. Solo se permite en valores dinámicos (colores calculados en runtime).

```typescript
@Component({
  template: `<div class="page-wrap">...</div>`,
  styles: `
    .page-wrap { padding: 28px 32px; }
  `,
})
```

---

## 2. Layout de página (`page-wrap`)

Estructura obligatoria para todas las páginas con tabla o contenido principal:

```html
<div class="page-wrap">
  <div class="page-header">
    <div>
      <h1 class="page-title">Título del Módulo</h1>
      <p class="page-sub">Subtítulo descriptivo</p>
    </div>
    <p-button label="Acción principal" icon="pi pi-plus" (onClick)="..." />
  </div>

  <!-- contenido -->
</div>
```

CSS del layout:

```css
.page-wrap {
  padding: 28px 32px;
  width: 100%;
}
.page-header {
  display: flex;
  align-items: flex-start;   /* items-start: botón alineado al top del h1 */
  justify-content: space-between;
  margin-bottom: 36px;
}
.page-title {
  font-family: Outfit, sans-serif;
  font-size: 1.75rem;
  font-weight: 700;
  color: #1A1028;
  margin: 0;
}
.page-sub {
  color: #9C8E82;
  font-size: 0.875rem;
  margin: 6px 0 0;
}
```

---

## 3. Empty state

Cuando no hay datos o la funcionalidad está bloqueada (ej: sin caja abierta):

```html
<div class="empty-state-card">
  <div class="empty-icon-wrap">
    <i class="pi pi-{icono}" style="font-size:2rem; color:#FF6B35;"></i>
  </div>
  <h2 class="empty-title">Sin registros</h2>
  <p class="empty-sub">Mensaje de orientación al usuario.</p>
  <!-- CTA opcional -->
  <p-button label="Acción" icon="pi pi-plus" size="large" (onClick)="..." />
</div>
```

CSS del empty state:

```css
.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64px 32px;
  background: #fff;
  border: 1px solid #E8EDF2;
  border-radius: 16px;
}
.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: #FF6B3518;   /* coral con 9% opacidad */
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.empty-title {
  font-family: Outfit, sans-serif;
  font-size: 1.2rem;
  font-weight: 600;
  color: #1A1028;
  margin: 0 0 8px;
}
.empty-sub {
  color: #9C8E82;
  font-size: 0.875rem;
  margin: 0 0 28px;
  text-align: center;
  max-width: 280px;
}
```

---

## 4. Card de tabla / contenido

Nunca usar `p-card`. Usar un `div` con clase semántica y CSS en scope:

```html
<div class="mod-card">
  <p-table ...></p-table>
</div>
```

```css
.mod-card {           /* reemplaza "mod" por el nombre del módulo: mov-card, sup-card, etc. */
  background: #fff;
  border: 1px solid #E8EDF2;
  border-radius: 16px;
  overflow: hidden;
}
```

> No usar `shadow-sm` ni PrimeNG card. El borde `#E8EDF2` con `border-radius: 16px` es suficiente.

---

## 5. Dialogs (`p-dialog`)

### 5.1 Atributos obligatorios

```html
<p-dialog
  header="Título"
  [(visible)]="dialogVisible"
  [modal]="true"
  [style]="{ width: '480px' }"
  [breakpoints]="{ '768px': 'calc(100vw - 32px)' }"
  [draggable]="false"
>
```

Anchos estándar por complejidad del formulario:
- 440px — 2 campos simples (ej: abrir caja)
- 480px — 4 campos simples (ej: nuevo movimiento)
- 520px — formulario con grid o más campos
- 580–660px — formularios complejos o multi-columna

> **Breakpoints obligatorio:** siempre incluir `[breakpoints]="{ '768px': 'calc(100vw - 32px)' }"`. PrimeNG establece el ancho del dialog vía JS — sin este atributo, el dialog se renderiza internamente a su ancho de escritorio en mobile, y las queries CSS del componente hijo no tienen efecto en el layout interno.

### 5.2 Estructura del body

**Contenedor:** `<div>` simple, sin clase de gap. El espaciado va en cada campo.

```html
<p-dialog ...>
  <div>

    <div class="flex flex-col gap-2 mb-4">
      <label class="text-sm font-medium" style="color:#475569;">
        Campo <span style="color:#dc2626;">*</span>
      </label>
      <!-- input aquí -->
    </div>

    <!-- último campo: sin mb-4 -->
    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium" style="color:#475569;">
        Último campo <span style="color:#9C8E82; font-weight:400;">(opcional)</span>
      </label>
      <!-- input aquí -->
    </div>

  </div>
  <ng-template pTemplate="footer">
    <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="..." />
    <p-button label="Guardar" icon="pi pi-check" [loading]="saving()" (onClick)="save()" />
  </ng-template>
</p-dialog>
```

> **Regla de espaciado:** `mb-4` (16px) en cada field wrapper excepto el último. NO usar `gap-N` en el contenedor padre — PrimeNG puede romper el flex al proyectar el contenido del dialog.

### 5.2b Componente embebido dentro del dialog (en lugar de inline template)

Cuando el formulario es un componente hijo que se renderiza dentro del `<p-dialog>`, no puede usar `pTemplate="footer"`. En ese caso:

1. El componente hijo usa `output<void>()` para `cancelled` y `created`/`saved`
2. El footer va DENTRO del template del componente hijo como `.form-footer`
3. El footer usa `position: sticky; bottom: 0; background: #fff` para mantenerse visible al scrollear

```css
/* En el componente hijo — hace sticky el footer dentro del p-dialog-content */
.form-footer {
  position: sticky;
  bottom: 0;
  background: #fff;
  border-top: 1px solid #E8EDF2;
  margin-top: 20px;
  padding-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

4. Los grids multi-columna dentro del componente usan `@media (max-width: 768px)` (no 640px) para que la media query coincida con el punto de quiebre en que `[breakpoints]` del dialog activa el ancho mobile.
5. Botones que usan el ancho disponible en mobile: agregar `:host ::ng-deep .mi-btn .p-button { width: 100%; }` dentro de la media query.

### 5.3 Campos de input

#### `p-inputNumber`
Requiere AMBOS atributos para estirarse correctamente:
```html
<p-inputNumber
  [(ngModel)]="form.valor"
  styleClass="w-full"
  [style]="{'width':'100%'}"
  placeholder="0.00"
/>
```
Y en el bloque `styles:`:
```css
:host ::ng-deep .p-inputnumber { width: 100%; }
:host ::ng-deep .p-inputnumber input { width: 100%; }
```

#### `textarea`
```html
<textarea
  pTextarea
  [(ngModel)]="form.notas"
  rows="3"
  style="width:100%; resize:none;"
></textarea>
```

#### `input` de texto
```html
<input pInputText [(ngModel)]="form.nombre" class="w-full" />
```

### 5.4 Fila de info/resumen dentro del dialog

Para mostrar un dato calculado antes de un campo (ej: saldo esperado antes de ingresar el cierre):

```html
<div class="mb-4" style="background:#F8FAFC; border:1px solid #e2e8f0; border-radius:8px; padding:14px 18px;">
  <span style="font-size:0.875rem; color:#64748b; margin-right:8px;">Etiqueta</span>
  <strong style="font-size:1rem; color:#1A1028;">Valor</strong>
</div>
```

### 5.5 Inicialización de campos numéricos

Campos de monto/cantidad deben inicializarse en `null`, no en `0`, para que el placeholder sea visible:

```typescript
form: Omit<CreateXxxRequest, 'amount'> & { amount: number | null } = {
  amount: null,
  ...
};

isFormValid() {
  return (this.form.amount ?? 0) > 0 && ...;
}
```

---

## 6. Selector de tipo (color-coded chips)

Sustituye `p-selectButton` cuando hay opciones con semántica de color (estados, categorías, tipos):

```html
<div class="type-selector">
  @for (opt of typeOptions; track opt.value) {
    <button
      type="button"
      class="type-chip"
      [class.active]="form.type === opt.value"
      [attr.data-type]="opt.value"
      (click)="form.type = opt.value"
    >
      <span class="type-dot" [attr.data-type]="opt.value"></span>
      {{ opt.label }}
    </button>
  }
</div>
```

CSS (adaptar colores según los tipos del módulo):

```css
.type-selector {
  display: flex;
  gap: 8px;
}
.type-chip {
  flex: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 2px solid #E8EDF2;
  background: #F8FAFC;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  font-family: inherit;
}
.type-chip:hover { border-color: #cbd5e1; }

/* Activos — un bloque por valor de tipo */
.type-chip[data-type="expense"].active { border-color:#dc2626; background:#FEF2F2; color:#dc2626; }
.type-chip[data-type="income"].active  { border-color:#16a34a; background:#F0FDF4; color:#16a34a; }
.type-chip[data-type="cost"].active    { border-color:#d97706; background:#FFFBEB; color:#d97706; }

/* Dot indicador */
.type-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #cbd5e1;
}
.type-dot[data-type="expense"] { background: #dc2626; }
.type-dot[data-type="income"]  { background: #16a34a; }
.type-dot[data-type="cost"]    { background: #d97706; }
```

TypeScript — tipar el array para evitar errores de asignación:

```typescript
typeOptions: { label: string; value: MyType }[] = [
  { label: 'Opción A', value: 'a' },
  { label: 'Opción B', value: 'b' },
];
```

---

## 7. Disposición de elementos

### 7.1 Página con tabla (list page)

Orden vertical obligatorio:

```
┌─────────────────────────────────────────────────┐
│  Título                        [Botón acción]   │  ← .page-header
│  Subtítulo                                      │
├─────────────────────────────────────────────────┤
│  [Filtro 1]  [Filtro 2]  [Buscar...]            │  ← fila de filtros (mb-8)
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │  COLUMNA A  │  COLUMNA B  │  MONTO  │ … │    │  ← .{mod}-card con p-table
│  │─────────────┼─────────────┼─────────┼───│    │
│  │  dato       │  dato       │  0.00   │ ⚙ │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

Reglas:
- **Título a la izquierda, botón de acción a la derecha** — siempre en `.page-header`
- **Filtros antes de la tabla**, nunca intercalados ni debajo
- **Separación entre filtros y tabla:** `mb-8` en la fila de filtros
- **Columnas de texto:** `text-left` (default)
- **Columnas numéricas (montos, cantidades):** `class="text-right"` tanto en `<th>` como en `<td>`
- **Columna de acciones:** siempre la **última** columna, header vacío o `"Acciones"`
- **Badges/tags de estado o tipo:** primera o segunda columna, nunca al final
- **Fecha de creación:** penúltima columna (antes de acciones)

### 7.1b Página de creación / detalle (back-header)

Para páginas con formulario de creación o detalle donde hay un botón de volver:

```html
<div class="page-wrap">
  <div class="back-header">
    <p-button icon="pi pi-arrow-left" [text]="true" severity="secondary" [routerLink]="['/modulo']" />
    <div>
      <h1 class="page-title">Nueva compra</h1>
      <p class="page-sub">Subtítulo descriptivo</p>
    </div>
  </div>
  <!-- contenido -->
</div>
```

```css
.back-header { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 36px; }
```

> **Centrado obligatorio:** Cuando el `.page-wrap` tiene `max-width`, **siempre** agregar `margin: 0 auto` para centrarlo en la pantalla. Sin esto, el contenido queda pegado a la izquierda en pantallas anchas.
>
> ```css
> /* Correcto */
> .page-wrap { padding: 28px 32px; width: 100%; max-width: 900px; margin: 0 auto; }
>
> /* Incorrecto — se ve bien estrecho pero a la izquierda */
> .page-wrap { padding: 28px 32px; width: 100%; max-width: 900px; }
> ```

### 7.1c Secciones dentro de página de formulario

Cuando hay múltiples secciones (ej: datos generales + agregar ítems + tabla), usar `.section-card`:

```html
<div class="section-card mb-5">
  <h2 class="section-title">Datos generales</h2>
  <!-- campos -->
</div>
```

```css
.section-card {
  background: #fff;
  border: 1px solid #E8EDF2;
  border-radius: 16px;
  padding: 20px;
}
.section-title { font-size: 0.9375rem; font-weight: 600; color: #475569; margin: 0 0 16px; }
.mb-5 { margin-bottom: 20px; }
```

### 7.1d Card de tabla con header interno (card-inner-header)

Cuando la tabla tiene un título interno (dentro del `.{mod}-card`), usar `.card-inner-header`:

```html
<div class="pur-card">
  <div class="card-inner-header">
    <h2 class="section-title card-title">Ítems</h2>
    <p class="section-sub">Descripción opcional</p>  <!-- omitir si no aplica -->
  </div>
  <p-table ...></p-table>
</div>
```

```css
.card-inner-header { padding: 16px 20px 12px; }
.card-title { margin-bottom: 2px; }  /* sobreescribe el 16px del section-title standalone */
.section-sub { font-size: 0.8125rem; color: #9C8E82; margin: 0 0 4px; }
```

> **Regla:** NUNCA usar `style="margin-bottom:..."` inline en `section-title`. Usar la clase `.card-title` cuando está dentro de `.card-inner-header`.

### 7.1e Filtros de búsqueda de texto (`p-iconfield`)

Para módulos con búsqueda de texto libre en la `filter-row`:

```html
<div class="filter-row">
  <p-iconfield iconPosition="right">
    <input
      pInputText
      placeholder="Buscar por nombre..."
      [(ngModel)]="searchTerm"
      (ngModelChange)="onSearchChange()"
    />
    <p-inputicon styleClass="pi pi-search" />
  </p-iconfield>
  <!-- dropdowns adicionales -->
</div>
```

CSS necesario (PrimeNG no posiciona el ícono correctamente sin esto):

```css
:host ::ng-deep .filter-row .p-iconfield {
  width: 280px;
  position: relative;
}
:host ::ng-deep .filter-row .p-iconfield input { width: 100%; }
:host ::ng-deep .filter-row .p-inputicon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  right: 0.75rem;
}
/* Responsive */
@media (max-width: 768px) {
  :host ::ng-deep .filter-row .p-iconfield { width: 100%; }
}
```

Imports necesarios: `IconFieldModule`, `InputIconModule` de `primeng`.

> **Nota:** `iconPosition="right"` + el CSS `position: absolute` es el patrón correcto para el ícono de búsqueda en PrimeNG Aura. Sin el CSS, el ícono se posiciona fuera del input.

### 7.2 Página de entidad única (single-entity view)

Para módulos sin lista (ej: caja diaria, perfil, configuración):

```
┌─────────────────────────────────────────────────┐
│  Título                                         │  ← .page-header (sin botón derecho
│  Subtítulo                                      │     o con estado/tag)
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │  [ícono]  Nombre/fecha           [Tag]  │    │  ← card header con .reg-header
│  ├─────────────────────────────────────────┤    │
│  │  Stat A        │        Stat B          │    │  ← grid 2×2 de stats
│  │────────────────┼────────────────────────│    │
│  │  Stat C        │        Stat D          │    │
│  ├─────────────────────────────────────────┤    │
│  │  Etiqueta resumen              Valor    │    │  ← balance bar (#F8FAFC)
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

Reglas:
- El ícono de la card siempre en un `.reg-icon` (44×44, `#FF6B3518`)
- Stats numéricos: label en `11px uppercase` (#9C8E82), valor en `1.5rem bold`
- Separadores entre stats: `border:1px solid #E8EDF2`
- La barra de resumen/total en la parte inferior con fondo `#F8FAFC`

### 7.3 Formulario en dialog

Orden de campos dentro del dialog:

1. **Selector de tipo** (si aplica) — primero, porque condiciona lo demás
2. **Campos de identificación** (nombre, referencia externa)
3. **Campos numéricos** (monto, cantidad, precio)
4. **Campos de texto largo** (descripción, notas) — siempre como `textarea` al final del grupo principal
5. **Campos opcionales** (referencia, notas adicionales) — al final, sin `mb-4`

```
┌──────────────────────────────────┐
│  Nuevo movimiento              × │
├──────────────────────────────────┤
│  Tipo *                          │
│  [Egreso ●] [Ingreso ●] [Costo ●]│  ← tipo chips (si aplica)
│                                  │
│  Monto *                         │
│  [         0.00                ] │  ← inputNumber null init
│                                  │
│  Descripción *                   │
│  [                             ] │  ← textarea rows=3
│  [                             ] │
│  [                             ] │
│                                  │
│  Referencia (opcional)           │
│  [                             ] │  ← último campo: sin mb-4
├──────────────────────────────────┤
│             [Cancelar] [✓ Guardar]│  ← footer alineado a la derecha
└──────────────────────────────────┘
```

Reglas del footer:
- **Cancelar** siempre a la izquierda: `severity="secondary"` + `[text]="true"`
- **Submit** siempre a la derecha: `icon="pi pi-check"` + `[loading]="saving()"`
- Submit en rojo (`severity="danger"`) solo para acciones destructivas (cerrar caja, rechazar pedido)

### 7.4 Formulario multi-columna (grid)

Cuando hay muchos campos de igual peso (ej: crear proveedor, crear tenant):

```html
<div class="grid grid-cols-2 gap-5 mb-4">
  <div class="flex flex-col gap-2">
    <label ...>Nombre *</label>
    <input pInputText ... />
  </div>
  <div class="flex flex-col gap-2">
    <label ...>Email *</label>
    <input pInputText ... />
  </div>
</div>
```

Reglas:
- Ancho mínimo de dialog para grid 2 columnas: **520px**
- Campos de texto largo (`textarea`) siempre en columna completa (`col-span-2`)
- Agrupar campos relacionados en la misma fila (nombre + apellido, precio + unidad)

---

## 8. Tokens de diseño (Dewan)

| Token | Valor | Uso |
|---|---|---|
| `--dw-coral-500` | `#FF6B35` | Primario, CTAs, íconos de acento |
| `#FF6B3518` | coral 9% opacidad | Fondo de íconos wrap (empty state, card header) |
| `#1A1028` | casi negro | Títulos principales, valores importantes |
| `#475569` | gris oscuro | Labels de formulario |
| `#64748b` | gris medio | Texto secundario en dialogs |
| `#9C8E82` | gris arena | Subtítulos de página, texto opcional |
| `#E8EDF2` | gris muy claro | Bordes de cards, divisores |
| `#F8FAFC` | casi blanco | Fondos alternativos, info rows |
| Outfit | font-family | Títulos (`page-title`, `empty-title`) |
| Inter | font-family | Cuerpo de texto (hereda de body) |

---

## 9. Restricciones — qué NO hacer

| Prohibido | Alternativa |
|---|---|
| `p-card` | `div` con `.mod-card` y CSS en scope |
| `<p-toast />` en el componente | Toast global en `shell.component.ts`. Inyectar `ToastService` |
| `providers: [MessageService]` | No necesario; `MessageService` está en `app.config.ts` |
| `gap-N` en contenedor de dialog | `mb-4` en cada field wrapper |
| `p-selectButton` para tipos con color | Chips custom (sección 6) |
| `style="..."` en divs estructurales | Clases en bloque `styles:` |
| `amount: 0` en form init | `amount: null` para mostrar placeholder |
| `class="w-full"` solo en `p-inputNumber` | También `styleClass="w-full"` + `[style]="{'width':'100%'}"` |

---

## 10. Checklist de revisión rápida

Antes de considerar un componente de página terminado, verificar:

- [ ] Root es `<div class="page-wrap">` con CSS en scope
- [ ] Si `.page-wrap` tiene `max-width`, también tiene `margin: 0 auto`
- [ ] Header usa `.page-header / .page-title / .page-sub`
- [ ] Empty state usa `.empty-state-card` con `.empty-icon-wrap` tintado en coral
- [ ] Tabla/contenido dentro de `.{mod}-card` (sin `p-card`, sin `shadow-sm`)
- [ ] Dialogs tienen `[draggable]="false"` y ancho apropiado
- [ ] Body del dialog es `<div>` simple; campos con `mb-4` excepto el último
- [ ] `p-inputNumber` usa `styleClass="w-full"` + `[style]="{'width':'100%'}"` + `::ng-deep` en styles
- [ ] `textarea` usa `style="width:100%; resize:none;"`
- [ ] Tipos con semántica de color usan chips custom (no `p-selectButton`)
- [ ] Campos numéricos inicializados en `null` (no `0`)
- [ ] No hay `<p-toast />` ni `providers: [MessageService]` en el componente
- [ ] No hay `style="..."` en divs estructurales
