# Comando: rsoft-next

Determina el siguiente módulo a construir y muestra su contexto.

## Instrucciones

1. Lee `.claude/docs/tracking/dev-tracker.json`.
2. Encuentra el primer módulo en `buildOrder` cuyo `status` en `modules` sea `"pending"`.
3. Verifica que todas sus `dependencies` estén en `"done"`.
   - Si alguna dependencia no está `"done"`, salta al siguiente módulo que sí tenga todas sus dependencias resueltas.
4. Muestra un resumen:
   - Nombre del módulo y su SPEC
   - Dependencias (y su estado)
   - Qué archivos debe leer el agente backend y frontend
   - Entidades involucradas
   - Cantidad de endpoints y casos de uso
5. Pregunta si se quiere ejecutar con `/project:rsoft-fullstack` o paso a paso.

## Formato de salida

```
═══════════════════════════════════════
SIGUIENTE MÓDULO: SPEC-XX-nombre
═══════════════════════════════════════

📋 Descripción: [del spec]
📦 Entidades: [lista]
🔗 Dependencias: [lista con ✅/❌]
📡 Endpoints: [cantidad]
🧪 Casos de uso: [UC-XX-XX a UC-XX-XX]

📁 Archivos para backend:
   - docs/specs/SPEC-XX-nombre.md
   - docs/entities/entity-XX-nombre.md
   - docs/conventions/coding-conventions.md

📁 Archivos para frontend:
   - docs/specs/SPEC-XX-nombre.md
   - docs/design-system/dewan-design-system.md
   - docs/conventions/coding-conventions.md

¿Ejecutar? → /project:rsoft-fullstack SPEC-XX-nombre
```

## NO hacer
- No leer las specs completas — solo el índice (`docs/specs/_spec-index.md`) y el tracker.
- No generar código en este comando — solo informar.
