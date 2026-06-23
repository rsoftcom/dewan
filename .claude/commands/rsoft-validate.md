# Comando: rsoft-validate $ARGUMENTS

Valida que el código generado para un módulo cumpla al 100% con su spec.

**Argumento:** Nombre del spec, ejemplo: `SPEC-07-orders`

## Archivos a leer
1. `docs/specs/$ARGUMENTS.md` — La spec de referencia (fuente de verdad)
2. Código generado del módulo en `src/backend/modules/{nombre}/`
3. Código generado del módulo en `src/frontend/features/{nombre}/`

## Validaciones a ejecutar

### Backend — Cobertura de endpoints
Por cada endpoint en el spec (sección "Contrato API"):
- [ ] ¿Existe el método en el controller con la ruta y método HTTP exactos?
- [ ] ¿Los roles en `@Roles()` coinciden con los del spec?
- [ ] ¿El DTO de request valida todos los campos obligatorios del spec?
- [ ] ¿El response tiene la estructura documentada en el contrato?

**Reportar:** `✅ POST /orders — OK` o `❌ POST /orders — Falta validación de tableId`

### Backend — Excepciones
Por cada tabla de excepciones (E01, E02...) en el spec:
- [ ] ¿El service maneja esa condición?
- [ ] ¿Retorna el status code correcto?
- [ ] ¿El mensaje de error coincide o es equivalente?

### Backend — Reglas de negocio
Por cada RN-XX del spec:
- [ ] ¿Está implementada en el service?
- [ ] ¿Hay un test que la cubra?

### Backend — Tests
Por cada bloque `Scenario:` en los criterios de aceptación Gherkin:
- [ ] ¿Existe un test (`it('should ...')`) que cubra ese escenario?
- [ ] ¿El test verifica el status code esperado?
- [ ] ¿El test verifica el cuerpo de la respuesta?

### Frontend — Cobertura de pantallas
- [ ] ¿Hay página de listado si el spec tiene endpoint GET (lista)?
- [ ] ¿Hay página de detalle si el spec tiene endpoint GET /:id?
- [ ] ¿Hay formulario de creación si el spec tiene endpoint POST?
- [ ] ¿Hay formulario de edición si el spec tiene endpoint PATCH?
- [ ] ¿El service tiene método para cada endpoint del spec?
- [ ] ¿El model define la interfaz con todos los campos del response?

### Frontend — Roles
- [ ] ¿Las rutas están protegidas con guard de rol?
- [ ] ¿Los botones de acción se ocultan según rol del usuario?

### Prisma
- [ ] ¿Todas las entidades del spec existen en schema.prisma?
- [ ] ¿Los campos coinciden con el entity doc?
- [ ] ¿Los índices requeridos están definidos?

## Formato de reporte

```
═══════════════════════════════════════
VALIDACIÓN: SPEC-XX-nombre
═══════════════════════════════════════

📡 Endpoints:     X/X implementados
⚠️  Excepciones:  X/X manejadas
📏 Reglas negocio: X/X implementadas
🧪 Tests:         X/X scenarios cubiertos
🖥️  Pantallas:     X/X creadas

❌ PROBLEMAS ENCONTRADOS:
  1. [descripción del problema]
  2. [descripción del problema]

🔧 CORRECCIONES APLICADAS:
  1. [qué se corrigió y en qué archivo]
```

## Validación de compilación (OBLIGATORIO antes del push)
Tras aplicar cualquier corrección, ejecuta los builds para confirmar que el proyecto compila:

```bash
cd src/backend && npm run build
cd src/frontend && npm run build
```

Si el build falla tras las correcciones: sigue corrigiendo hasta que ambos pasen.

## Comportamiento
- Si encuentra problemas, **corrígelos automáticamente** y reporta lo que hizo.
- Si todo está correcto, actualiza el tracker y reporta éxito.
- Al finalizar, actualiza `modules.$ARGUMENTS.tests` → `"done"` en el tracker.
- Siempre hace push de las correcciones (o confirmación de validación) a GitHub:
  ```bash
  git add .claude/docs/tracking/dev-tracker.json \
          src/backend/modules/{nombre}/ \
          src/frontend/features/{nombre}/
  git commit -m "fix($ARGUMENTS): validation fixes\n\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  git push origin main
  ```
