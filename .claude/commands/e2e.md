# Comando: e2e — Pruebas E2E con Playwright

Ejecuta pruebas de interfaz realistas contra el app en producción o local.
Simula un usuario real, detecta errores 503/CORS y verifica flujos críticos.

## PASO 1 — Pedir datos al usuario (SIEMPRE, antes de cualquier otra acción)

Usa la herramienta AskUserQuestion con estas preguntas:

**Pregunta 1 — URL:**
- Producción: `https://app.getdewan.com`
- Local: `http://localhost:4200`
- Opciones: "Producción (app.getdewan.com)" | "Local (localhost:4200)" | "Otra"

**Pregunta 2 — Escenario:**
- `smoke` — Login + carga de todas las secciones principales
- `check-503` — Detectar errores 503/CORS durante navegación y reloads repetidos
- `orders` — Verificar flujo de órdenes (filtros, botones, listado)
- `custom` — El usuario describe el flujo a probar

**Pregunta 3 — Email de login** (texto libre)

**Pregunta 4 — Contraseña** (texto libre)

---

## PASO 2 — Setup (solo si node_modules no existe)

```bash
cd scripts/e2e
npm install
npx playwright install chromium --with-deps
```

---

## PASO 3 — Ejecutar el test

Según el escenario elegido, ejecutar en `scripts/e2e/`:

### smoke
```bash
BASE_URL=<url> TEST_EMAIL=<email> TEST_PASSWORD=<password> \
  npx playwright test tests/smoke.spec.ts --reporter=list
```

### check-503
```bash
BASE_URL=<url> TEST_EMAIL=<email> TEST_PASSWORD=<password> RELOADS=5 \
  npx playwright test tests/check-503.spec.ts --reporter=list
```
El parámetro `RELOADS` controla cuántas veces recarga cada página (default 5).

### orders
```bash
BASE_URL=<url> TEST_EMAIL=<email> TEST_PASSWORD=<password> \
  npx playwright test tests/orders.spec.ts --reporter=list
```

### custom
1. Pedir al usuario que describa el flujo detalladamente.
2. Generar un archivo temporal `scripts/e2e/tests/temp-custom.spec.ts` con los pasos descritos.
3. Ejecutar:
```bash
BASE_URL=<url> TEST_EMAIL=<email> TEST_PASSWORD=<password> \
  npx playwright test tests/temp-custom.spec.ts --reporter=list
```
4. Tras la ejecución, eliminar `temp-custom.spec.ts`.

---

## PASO 4 — Reportar resultados

Después de ejecutar, mostrar:

1. **Resumen**: cuántos tests pasaron / fallaron
2. **Errores detectados**: si `check-503`, listar las URLs y status codes que fallaron con timestamps
3. **Screenshots**: si hubo fallos, informar la ruta `scripts/e2e/test-results/`
4. **Conclusión**: en 1–2 oraciones, qué significa el resultado para el estado del sistema

Si todos los tests pasan en producción → el servidor está sano en ese momento.
Si `check-503` detecta errores → listar los endpoints exactos que fallaron para investigación.

---

## Estructura de archivos

```
scripts/e2e/
├── package.json
├── playwright.config.ts
├── helpers/
│   └── auth.ts          ← login reutilizable
└── tests/
    ├── smoke.spec.ts    ← navegación básica
    ├── check-503.spec.ts ← detección de 503
    └── orders.spec.ts   ← flujo de órdenes
```

## Notas

- Usa `headless: true` por defecto (sin ventana). Para ver el browser, añadir `--headed`.
- El timeout por test es 60 segundos. Suficiente para carga en producción con red variable.
- `workers: 1` para evitar disparar rate limiting de Nginx con requests concurrentes.
- Si el login falla porque hay un selector de negocio (owner multi-tenant), el helper lo maneja automáticamente eligiendo el primero disponible.
