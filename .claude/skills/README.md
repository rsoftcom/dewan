# Skills de Dewan

Esta carpeta contiene **skills** de Claude Code: capacidades reutilizables que el modelo invoca
automáticamente cuando una tarea coincide con su `description`, o que tú lanzas a mano con
`/<nombre>`. A diferencia de un comando suelto en `.claude/commands/`, una skill vive en su propia
carpeta y puede agrupar instrucciones, plantillas y scripts de apoyo.

## De dónde viene la "lógica de IA" de este proyecto

El patrón ya existe en `.claude/commands/rsoft-*.md`. Esos comandos codifican el flujo de
generación de Dewan y comparten una idea central que **toda skill nueva debe respetar**:

> **Leer solo lo necesario.** Cada flujo lee únicamente los archivos que precisa
> (1 spec + las convenciones del lado tocado), nunca toda la documentación.

Mapa de referencia (fuente de verdad por tarea):
- **Estado y archivos de cada módulo → `.claude/docs/tracking/dev-tracker.json`** (consúltalo
  primero en toda skill que toque un módulo, y actualízalo al terminar)
- Comportamiento de un módulo → `.claude/docs/specs/SPEC-XX-<modulo>.md`
- Modelo de datos → `.claude/docs/entities/` + `_entity-conventions.md`
- Convenciones backend/frontend → `dewan-backend/CLAUDE.md` / `dewan-frontend/CLAUDE.md`
- UI → `.claude/docs/conventions/ui-conventions.md`
- Diseño visual → `.claude/docs/design-system/dewan-design-system.md`

Una skill nueva debería apoyarse en esos archivos en vez de repetir su contenido.

## Estructura de una skill

```
.claude/skills/
└── mi-skill/
    ├── SKILL.md          # obligatorio: frontmatter + instrucciones
    ├── templates/        # opcional: plantillas de código/docs
    └── scripts/          # opcional: helpers (bash, ts-node)
```

`SKILL.md` lleva frontmatter YAML con `name` y `description`. La `description` es lo que el modelo
usa para decidir cuándo activarla: sé concreto sobre el *cuándo*, no solo el *qué*.

```markdown
---
name: mi-skill
description: Usa esta skill cuando <situación concreta y detectable>. Hace <X> leyendo <Y>.
---

# mi-skill

## Cuándo aplica
<una o dos frases>

## Qué leer (solo esto)
1. <archivo/spec relevante>
2. <convención del lado tocado>

## Pasos
1. ...
2. ...

## Verificación
- Backend: `npm run build` / `npm test`
- Frontend: `npm run build`
- Reporta resultados reales; no afirmes "funciona" sin haber corrido.
```

## Cómo crear una skill nueva (checklist)

1. **Acota el disparador.** ¿En qué situación exacta debe activarse? Eso va en `description`.
2. **Crea `.claude/skills/<nombre>/SKILL.md`** con el frontmatter y las secciones de arriba.
3. **Reutiliza, no dupliques.** Apunta a las specs/convenciones existentes; no copies reglas que
   ya viven en un `CLAUDE.md` o en `docs/`.
4. **Respeta las convenciones de Dewan:** `/v1`, aislamiento por `tenantId`, soft delete, roles,
   y los gotchas de cada app (`ApiService`/`ToastService` en frontend, `$transaction` y
   `AuditLogService` en backend).
5. **Incluye verificación.** Toda skill que genere o modifique código debe terminar compilando
   y/o corriendo tests, y reportar el resultado honestamente.
6. **Pruébala** invocándola con `/<nombre>` y ajusta la `description` si no se activa cuando debe.

## Skill vs. comando vs. CLAUDE.md

- **CLAUDE.md** — contexto siempre cargado (convenciones, layout). No es accionable por sí solo.
- **Comando** (`.claude/commands/<n>.md`) — un prompt reutilizable que lanzas con `/<n>`.
  Bueno para flujos de un solo archivo (ver `/review`, `/test`, `/deploy`).
- **Skill** (`.claude/skills/<n>/SKILL.md`) — como un comando pero auto-invocable por
  `description` y capaz de empaquetar plantillas/scripts. Úsala cuando quieras que el modelo la
  active solo, o cuando el flujo necesite recursos además del prompt.
