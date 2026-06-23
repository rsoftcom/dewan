# Comando: rsoft-status

Muestra el estado completo del proyecto sin modificar nada.

## Instrucciones
1. Lee `.claude/docs/tracking/dev-tracker.json`.
2. Muestra el progreso de cada módulo.

## Formato de salida

```
═══════════════════════════════════════
R SOFT — Estado del Desarrollo
═══════════════════════════════════════

Progreso general: X/19 módulos completados (XX%)
Shared modules:   X/7 listos

 #  Módulo                Back   Front  Tests  Estado
─── ──────────────────── ────── ────── ────── ──────
 1  SPEC-01-auth          ✅     ✅     ✅     done
 2  SPEC-03-tenants       ✅     ✅     ⏳     in-progress
 3  SPEC-02-users         ⏳     ❌     ❌     pending (deps: ✅)
 4  SPEC-04-units         ❌     ❌     ❌     pending (deps: ✅)
 5  SPEC-07-orders        ❌     ❌     ❌     blocked (deps: SPEC-05 ❌)
...

Siguiente ejecutable: SPEC-02-users
→ /project:rsoft-fullstack SPEC-02-users
```

## NO hacer
- No generar código.
- No modificar archivos.
- Solo leer el tracker y reportar.
