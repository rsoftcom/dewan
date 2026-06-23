# Comando: rsoft-frontend $ARGUMENTS

Genera SOLO el frontend Angular para un módulo específico.

**Argumento:** Nombre del spec, ejemplo: `SPEC-07-orders`

## Archivos a leer (SOLO estos)
1. `docs/specs/$ARGUMENTS.md` — El spec del módulo
2. `docs/conventions/coding-conventions.md` — Solo sección 2 (Frontend)
3. `docs/design-system/dewan-design-system.md` — Colores, tipografía, componentes

## Archivos a generar
```
src/frontend/features/{nombre}/
├── pages/
│   ├── {nombre}-list.component.ts      ← Listado con p-table
│   ├── {nombre}-detail.component.ts    ← Vista de detalle
│   └── {nombre}-form.component.ts      ← Crear/editar (si aplica)
├── components/
│   └── {nombre}-{sub}.component.ts     ← Componentes reutilizables del feature
├── services/
│   └── {nombre}.service.ts
├── models/
│   └── {nombre}.model.ts
└── routes.ts
```

## Reglas Angular obligatorias

**Componente standalone single-file:**
```typescript
@Component({
  selector: 'app-{nombre}-list',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, ...],
  template: `
    <app-page-header title="Nombre" (action)="onCreate()"/>
    @if (loading()) {
      <p-progressSpinner />
    } @else {
      <p-table [value]="items()" [paginator]="true" [rows]="20"
               [totalRecords]="totalRecords()" [lazy]="true"
               (onLazyLoad)="onPageChange($event)">
        ...
      </p-table>
    }
  `,
})
export class NombreListComponent {
  private readonly service = inject(NombreService);
  
  items = signal<Nombre[]>([]);
  loading = signal(true);
  totalRecords = signal(0);
  
  constructor() {
    this.loadData();
  }
  
  // ...
}
```

**Service:**
```typescript
@Injectable({ providedIn: 'root' })
export class NombreService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/nombre';

  findAll(query?: PaginationParams): Observable<PaginatedResponse<Nombre>> {
    return this.api.get(this.basePath, { params: query });
  }
  findOne(id: string): Observable<Nombre> {
    return this.api.get(`${this.basePath}/${id}`);
  }
  create(dto: CreateNombreRequest): Observable<Nombre> {
    return this.api.post(this.basePath, dto);
  }
  update(id: string, dto: UpdateNombreRequest): Observable<Nombre> {
    return this.api.patch(`${this.basePath}/${id}`, dto);
  }
  remove(id: string): Observable<void> {
    return this.api.delete(`${this.basePath}/${id}`);
  }
}
```

**Model:**
```typescript
export interface Nombre {
  id: string;
  tenantId: string;
  // campos del spec
  createdAt: string;
  updatedAt: string;
}

export type NombreStatus = 'active' | 'inactive';
```

**Routes:**
```typescript
import { Routes } from '@angular/router';

export const NOMBRE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./pages/nombre-list.component').then(m => m.NombreListComponent) },
  { path: 'new', loadComponent: () => import('./pages/nombre-form.component').then(m => m.NombreFormComponent) },
  { path: ':id', loadComponent: () => import('./pages/nombre-detail.component').then(m => m.NombreDetailComponent) },
  { path: ':id/edit', loadComponent: () => import('./pages/nombre-form.component').then(m => m.NombreFormComponent) },
];
```

## Design System — Tokens principales
- Primary: `--dw-coral-500` (#FF6B35) para botones y CTAs
- Surface: `--dw-surface-50` (#FFFAF6) para fondos de página
- Border radius: `--dw-radius-lg` (12px) para cards
- Fuente: Inter (body), Outfit (headings)
- Usar clases Tailwind para layout, PrimeNG Aura para componentes

## Reglas críticas aprendidas (NO omitir)

### Toasts — usar siempre ToastService, nunca MessageService directo
```typescript
// ✅ CORRECTO — el shell ya provee MessageService globalmente
private readonly toast = inject(ToastService);
// En template: NO agregar <p-toast>, NO agregar providers: [MessageService]

// ❌ INCORRECTO — causa NullInjectorError en todos los demás componentes
providers: [MessageService]  // NO
private readonly msg = inject(MessageService);  // NO
```
`MessageService` está en `app.config.ts` global. El `<p-toast>` global vive en el shell.
Los componentes que YA tienen `providers: [MessageService]` + `<p-toast>` propio siguen funcionando (patrón legacy), pero los nuevos no deben usarlo.

### ApiService — única fuente de HTTP, nunca inyectar HttpClient directamente
`ApiService` normaliza URLs (strip `/` inicial del path, strip `/` final del base).
Paths con o sin `/` inicial funcionan, pero la convención es sin slash.
Métodos disponibles: `get`, `post`, `patch`, `put`, `delete`.

```typescript
// ✅ CORRECTO
private readonly api = inject(ApiService);
private readonly basePath = 'products';           // sin slash inicial

return this.api.get<T>(this.basePath, params);    // → /api/v1/products
return this.api.get<T>(`${this.basePath}/${id}`); // → /api/v1/products/:id
return this.api.put<T>(`${this.basePath}/${id}/recipe`, items);

// ❌ INCORRECTO
private readonly http = inject(HttpClient);       // NO — usar ApiService
private readonly base = `${environment.apiUrl}/products`; // NO — construir URLs propias
```

### Navegación — registrar en shell.component.ts
Al generar un módulo nuevo, agregar su item al array `NAV_SECTIONS` en
`src/frontend/app/shell/shell.component.ts`. Sin esto el módulo no aparece en el menú.

## Validación de compilación (OBLIGATORIO antes del push)
Ejecuta el build del frontend. Si hay errores, corrígelos antes de continuar.

```bash
cd src/frontend && npm run build
```

Si el build falla: lee el error, corrige el archivo afectado, repite hasta que pase. Solo entonces continúa.

## Al finalizar
1. Actualizar `.claude/docs/tracking/dev-tracker.json`:
   - `modules.$ARGUMENTS.frontend` → `"done"`
2. Push a GitHub:
   ```bash
   git add .claude/docs/tracking/dev-tracker.json \
           src/frontend/app/app.routes.ts \
           src/frontend/features/{nombre}/
   git commit -m "feat($ARGUMENTS): implement frontend module\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   git push origin main
   ```
