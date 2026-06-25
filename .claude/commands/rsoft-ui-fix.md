# Comando: rsoft-ui-fix $ARGUMENTS

Aplica las convenciones de UI/UX a uno o más componentes frontend para que sigan el estándar visual establecido.

**Argumento:** ruta relativa al componente o nombre del módulo.
Ejemplos:
- `rsoft-ui-fix src/frontend/features/suppliers/pages/supplier-list.component.ts`
- `rsoft-ui-fix suppliers` (busca automáticamente los componentes del módulo)
- `rsoft-ui-fix all` (aplica a todos los componentes de `src/frontend/features/`)

---

## Archivos a leer antes de actuar

1. `docs/conventions/ui-conventions.md` — fuente de verdad de patrones UI
2. El/los componente(s) indicados en `$ARGUMENTS`

---

## Checklist de validación (ejecutar en orden)

Por cada componente, verificar y corregir cada punto:

### 1. Layout de página
- [ ] Root es `<div class="page-wrap">` (no `<div class="p-6">` ni otro padding inline)
- [ ] Existe `.page-header` con `items-start justify-between` y `margin-bottom: 36px`
- [ ] Título usa `.page-title` (Outfit, 1.75rem, #1A1028) — no inline `style="font-family:..."`
- [ ] Subtítulo usa `.page-sub` (#9C8E82, 0.875rem) — no inline `style="color:..."`
- [ ] El botón de acción principal está dentro del `.page-header`
- [ ] Si `.page-wrap` tiene `max-width`, también tiene `margin: 0 auto` para centrar (sin esto el contenido queda pegado a la izquierda)

### 2. Empty state
- [ ] Usa `.empty-state-card` (flex-col center, white, border, radius 16px, padding 64px 32px)
- [ ] Tiene `.empty-icon-wrap` (72×72, radius 18px, fondo `#FF6B3518`)
- [ ] Ícono dentro del wrap con `color:#FF6B35` y `font-size:2rem`
- [ ] Título con `.empty-title` (Outfit, 1.2rem, #1A1028)
- [ ] Subtítulo con `.empty-sub` (#9C8E82, max-width 280px, centrado)

### 3. Card de tabla/contenido
- [ ] No hay `p-card` — reemplazar con `<div class="{mod}-card">`
- [ ] CSS del card: `background:#fff; border:1px solid #E8EDF2; border-radius:16px; overflow:hidden`
- [ ] No hay `shadow-sm` en la card

### 4. Dialogs
- [ ] Todos los `p-dialog` tienen `[draggable]="false"`
- [ ] Ancho apropiado según número de campos (440/480/520/580px)
- [ ] Body es `<div>` simple — sin `gap-N` en el contenedor padre
- [ ] Cada field wrapper tiene `class="flex flex-col gap-2 mb-4"` excepto el último (sin `mb-4`)
- [ ] Labels: `class="text-sm font-medium"` + `style="color:#475569;"`
- [ ] Requeridos: `<span style="color:#dc2626;">*</span>`
- [ ] Opcionales: `<span style="color:#9C8E82; font-weight:400;">(opcional)</span>`
- [ ] Footer: Cancelar (`severity="secondary"` + `[text]="true"`) + Submit (`icon="pi pi-check"`)

### 5. p-inputNumber y inputs PrimeNG en flex rows
- [ ] Tiene `styleClass="w-full"` Y `[style]="{'width':'100%'}"` (ambos, no solo uno)
- [ ] En bloque `styles:` tiene `::ng-deep .p-inputnumber { width:100%; }` y el `input` también
- [ ] Inicializado en `null` (no `0`) para mostrar placeholder
- [ ] Si el input está en una fila flex junto a un botón u otro elemento: usa un `<div class="input-wrap">` wrapper con `flex: 1; min-width: 0` — NO aplicar `flex:1` ni `width:100%` directamente al input PrimeNG (ver sección 0b de ui-conventions.md)

### 6. textarea
- [ ] Usa `pTextarea` con `style="width:100%; resize:none;"` (no `class="w-full"`)
- [ ] Tiene `rows="3"` (mínimo)

### 7. Selector de tipo con color
- [ ] No usa `p-selectButton` para opciones con semántica de color
- [ ] Reemplazado por `.type-selector` con `.type-chip` y `.type-dot` (ver sección 6 de ui-conventions.md)
- [ ] El array de opciones está tipado: `{ label: string; value: MyType }[]`

### 8. Scoped CSS
- [ ] Existe bloque `styles:` con todas las clases semánticas del componente
- [ ] No hay `style="..."` en divs estructurales (page-wrap, headers, cards, empty state)
- [ ] Los únicos `style="..."` permitidos son en valores dinámicos de runtime (ej: `[style.color]="..."`)

### 9. Toast y providers
- [ ] No hay `<p-toast />` en el template
- [ ] No hay `ToastModule` en el array `imports`
- [ ] No hay `providers: [MessageService]` en el decorador
- [ ] Se inyecta `ToastService` (no `MessageService` directamente)

### 10. Disposición de elementos en página con tabla
- [ ] Orden correcto: header → (filtros opcionales con `mb-8`) → card con tabla
- [ ] Filtros/búsqueda antes de la tabla, nunca después
- [ ] Acciones de fila (editar, borrar) en la última columna de la tabla
- [ ] Columnas numéricas con `class="text-right"` en header y celdas

---

## Formato de reporte

```
═══════════════════════════════════════
UI FIX: {nombre del componente}
═══════════════════════════════════════

✅ Cumple:    X/10 secciones sin cambios
⚠️  Corregido: X problemas

🔧 CORRECCIONES APLICADAS:
  1. [descripción] → [archivo:línea]
  2. ...

📋 CHECKLIST FINAL:
  ✅ Layout de página
  ✅ Empty state
  ✅ Card de tabla
  ❌ Dialogs — se corrigió mb-4 en 3 field wrappers
  ✅ p-inputNumber
  ...
```

---

## Comportamiento

1. Lee `docs/conventions/ui-conventions.md` primero.
2. Lee el/los componente(s) target.
3. Ejecuta el checklist completo.
4. Aplica **todas** las correcciones automáticamente.
5. Si el argumento es `all`, procesa cada componente en `src/frontend/features/` y reporta un resumen total.
6. Al finalizar, hace commit y push:

```bash
git add src/frontend/features/{modulo}/
git commit -m "fix(ui): apply UI conventions to {modulo} components

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin main
```

> Si se procesan múltiples módulos, un solo commit con todos los archivos.
