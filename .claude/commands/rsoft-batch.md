# Comando: rsoft-batch $ARGUMENTS

Genera múltiples módulos en secuencia automática.

**Argumento (opcional):** Cantidad de módulos a generar. Default: 1.
Ejemplo: `/project:rsoft-batch 3` genera los próximos 3 módulos pendientes.

## Flujo
1. Lee `.claude/docs/tracking/dev-tracker.json`.
2. Identifica los próximos N módulos pendientes cuyas dependencias estén resueltas.
3. Para cada uno, ejecuta el flujo completo de `/project:rsoft-fullstack`.
4. Después de cada módulo, verifica si el siguiente módulo ahora tiene sus dependencias resueltas (porque se acaba de completar una de ellas).
5. Al terminar todos, muestra resumen global.

## Resumen final

```
═══════════════════════════════════════
BATCH COMPLETADO: X módulos generados
═══════════════════════════════════════

✅ SPEC-01-auth        — 4 endpoints, 8 tests
✅ SPEC-03-tenants     — 5 endpoints, 6 tests
✅ SPEC-02-users       — 7 endpoints, 12 tests

Total: XX archivos · XX endpoints · XX tests
Siguiente pendiente: SPEC-04-units
```

## Validación de compilación por módulo
Después de generar cada módulo y antes del push, ejecuta:

```bash
cd src/backend && npm run build
cd src/frontend && npm run build
```

Si algún build falla: corrige el error antes de avanzar al siguiente módulo. Nunca acumules errores entre módulos.

## Regla de seguridad
Si algún módulo falla durante la generación:
- Marca ese módulo como `"error"` en el tracker.
- Detén el batch.
- Reporta el error y qué módulos quedaron pendientes.
- NO continúes con el siguiente módulo si el actual falló (puede ser dependencia).
