# Comando: rsoft-backend $ARGUMENTS

Genera SOLO el backend NestJS para un módulo específico.

**Argumento:** Nombre del spec, ejemplo: `SPEC-07-orders`

## Archivos a leer (SOLO estos)
1. `docs/specs/$ARGUMENTS.md` — El spec del módulo
2. `docs/conventions/coding-conventions.md` — Solo sección 1 (Backend)
3. `docs/architecture/architecture-summary.md` — Referencia rápida del stack

## Archivos a generar
```
src/backend/modules/{nombre}/
├── {nombre}.module.ts
├── {nombre}.controller.ts
├── {nombre}.service.ts
├── dto/
│   ├── create-{nombre}.dto.ts
│   ├── update-{nombre}.dto.ts
│   └── {nombre}-query.dto.ts
└── tests/
    ├── {nombre}.service.spec.ts
    └── {nombre}.controller.spec.ts
```

## Checklist por cada UC del spec
- [ ] Endpoint implementado con método HTTP, ruta y roles correctos
- [ ] Todas las excepciones con status code exacto del spec
- [ ] Todas las reglas de negocio (RN-XX) implementadas
- [ ] DTOs con class-validator para cada campo requerido
- [ ] Swagger decorators (@ApiTags, @ApiOperation, @ApiResponse)
- [ ] Tenant isolation (query filtrada por tenantId del JWT)
- [ ] Audit log en acciones críticas
- [ ] Test con al menos un scenario por cada bloque Gherkin

## Patrones obligatorios

**Controller:**
```typescript
@ApiTags('nombre')
@Controller('nombre')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NombreController {
  constructor(private readonly nombreService: NombreService) {}

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Crear...' })
  create(@Body() dto: CreateNombreDto, @CurrentUser() user: JwtPayload) {
    return this.nombreService.create(dto, user.tenantId, user);
  }
}
```

**Service:**
```typescript
@Injectable()
export class NombreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateNombreDto, tenantId: string, user: JwtPayload) {
    // Toda la lógica aquí
    // Siempre filtrar por tenantId
    // Registrar en audit_log
  }
}
```

**DTO:**
```typescript
export class CreateNombreDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: '...' })
  name: string;
}
```

## Validación de compilación (OBLIGATORIO antes del push)
Ejecuta el build del backend. Si hay errores, corrígelos antes de continuar.

```bash
cd src/backend && npm run build
```

Si el build falla: lee el error, corrige el archivo afectado, repite hasta que pase. Solo entonces continúa.

## Al finalizar
1. Actualizar `.claude/docs/tracking/dev-tracker.json`:
   - `modules.$ARGUMENTS.backend` → `"done"`
   - Si frontend y tests también están done → `modules.$ARGUMENTS.status` → `"done"`
2. Push a GitHub:
   ```bash
   git add .claude/docs/tracking/dev-tracker.json \
           src/backend/prisma/schema.prisma \
           src/backend/app.module.ts \
           src/backend/modules/{nombre}/
   git commit -m "feat($ARGUMENTS): implement backend module\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
   git push origin main
   ```
