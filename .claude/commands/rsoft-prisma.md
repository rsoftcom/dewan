# Comando: rsoft-prisma $ARGUMENTS

Genera o actualiza el schema Prisma para las entidades de un módulo.

**Argumento:** Nombre del spec, ejemplo: `SPEC-07-orders`

## Archivos a leer (SOLO estos)
1. `docs/specs/$ARGUMENTS.md` — Línea `**Entidades:**` para saber cuáles necesita
2. `docs/entities/entity-XX-nombre.md` — SOLO las entidades listadas en el spec
3. `docs/entities/_entity-conventions.md` — Convenciones de tipos y mapeo
4. `src/backend/prisma/schema.prisma` — Schema actual (si existe)

## Lógica
1. Del spec, extraer las entidades listadas en `**Entidades:**`.
2. Por cada entidad, verificar si ya existe en `schema.prisma`.
3. Si falta, leer su `entity-XX-nombre.md` y agregar el modelo.
4. Si ya existe, verificar que tenga todos los campos del entity doc.
5. Ejecutar `npx prisma format` para formatear.
6. Ejecutar `npx prisma validate` para verificar.

## Convenciones obligatorias

```prisma
// Modelo: PascalCase singular
model Order {
  id            String      @id @default(uuid())
  tenantId      String      @map("tenant_id")
  // campos: camelCase en Prisma
  orderNumber   Int         @map("order_number")
  status        OrderStatus @default(pending)
  total         Decimal     @db.Decimal(12, 2)
  notes         String?
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  // Relaciones: camelCase
  tenant        Tenant      @relation(fields: [tenantId], references: [id])
  items         OrderItem[]

  // Índices
  @@index([tenantId])
  // Tabla: snake_case plural
  @@map("orders")
}

// Enum: PascalCase nombre, snake_case valores
enum OrderStatus {
  pending
  in_kitchen
  prepared
  served
  paid
  completed
  cancelled

  @@map("order_status")
}
```

## Reglas
- Todos los UUIDs como `String @id @default(uuid())`
- Precios y cantidades: `Decimal @db.Decimal(12, 2)`
- Timestamps: `DateTime @db.Timestamptz`
- Nullable: `String?` (con `?`)
- Índice obligatorio en `tenantId` para toda tabla con tenant
- UNIQUE constraints según el entity doc (ej: email+tenant_id)
- Las relaciones Many-to-One siempre con `@relation(fields: [...], references: [id])`

## Si es la primera vez (no existe schema.prisma)
Crear con:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Luego agregar las entidades.

## Al finalizar
- Ejecutar `npx prisma format`
- Ejecutar `npx prisma validate`
- Reportar éxito o errores
- Actualizar `.claude/docs/tracking/dev-tracker.json` → `prisma.initialized: true` si es primera vez
