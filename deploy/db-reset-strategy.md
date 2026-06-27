# Estrategia de Reset de DB en Deploy (dewan-backend)

## Contexto

El workflow de GitHub Actions actual (`deploy.yml`) solo ejecuta `prisma migrate deploy` en cada push a `main`. No existe forma de resetear la base de datos ni de correr seeds desde el pipeline. Esto es un problema cuando:

- Se hacen cambios de estructura que requieren un reset limpio (ej: renombrar columnas, cambiar tipos, eliminar tablas)
- Se necesita repoblar datos de referencia (catálogos, roles iniciales, tenant demo) sin acceso SSH manual
- Se quiere hacer un deploy de QA/staging con datos de prueba frescos

El objetivo es agregar un parámetro `deploy_mode` al workflow con tres valores: `standard` (comportamiento actual), `with-seed` (migrate + seed), y `reset-and-seed` (drop + recreate + seed, destructivo).

---

## Archivos a modificar en `dewan-backend`

| Archivo | Cambio |
|---------|--------|
| `.github/workflows/deploy.yml` | Agregar `workflow_dispatch` con input `deploy_mode` y lógica condicional en el script SSH |
| `package.json` | Verificar/agregar configuración `"prisma": { "seed": "..." }` |

---

## Cambio 1: `package.json` — configurar el seed runner

Verificar que exista la sección `prisma.seed`. Si no está, agregarla. NestJS usa TypeScript, así que se necesita `ts-node` o `tsx` como devDependency.

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

> Si ya existe `tsx` como devDependency, preferir: `"seed": "tsx prisma/seed.ts"`

Verificar que `ts-node` o `tsx` esté en `devDependencies`. Si no, instalarlo:

```bash
npm install --save-dev ts-node
```

---

## Cambio 2: `.github/workflows/deploy.yml`

Reemplazar el workflow completo con la versión que soporta los tres modos:

```yaml
name: Deploy Backend to Droplet

on:
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      deploy_mode:
        description: 'Modo de deploy (standard | with-seed | reset-and-seed)'
        required: false
        default: 'standard'
        type: choice
        options:
          - standard
          - with-seed
          - reset-and-seed

jobs:
  deploy:
    name: Deploy to DigitalOcean Droplet
    runs-on: ubuntu-latest

    steps:
      - name: Checkout código
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Instalar dependencias
        run: npm ci

      - name: Compilar TypeScript
        run: npm run build

      - name: Deploy al Droplet
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DO_HOST }}
          username: ${{ secrets.DO_USER }}
          key: ${{ secrets.DO_SSH_KEY }}
          port: ${{ secrets.DO_PORT }}
          script: |
            set -e

            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

            DEPLOY_MODE="${{ github.event.inputs.deploy_mode || 'standard' }}"
            echo "==> Modo de deploy: $DEPLOY_MODE"

            cd /home/dewan/dewan-api

            echo "==> Descargando código nuevo"
            git pull origin main

            echo "==> Instalando todas las dependencias (incluye devDeps para build/seed)"
            npm ci

            echo "==> Compilando TypeScript"
            npm run build

            if [ "$DEPLOY_MODE" = "reset-and-seed" ]; then
              echo "==> RESET DESTRUCTIVO — deteniendo API para evitar conexiones activas"
              pm2 stop dewan-api || true

              echo "==> Reseteando base de datos (drop + recreate + migrate)"
              npx prisma migrate reset --force --skip-seed

              echo "==> Generando Prisma Client"
              npx prisma generate

              echo "==> Ejecutando seed"
              npx prisma db seed

            elif [ "$DEPLOY_MODE" = "with-seed" ]; then
              echo "==> Ejecutando migraciones"
              npx prisma migrate deploy

              echo "==> Generando Prisma Client"
              npx prisma generate

              echo "==> Ejecutando seed"
              npx prisma db seed

            else
              echo "==> Ejecutando migraciones"
              npx prisma migrate deploy

              echo "==> Generando Prisma Client"
              npx prisma generate
            fi

            echo "==> Limpiando devDependencies (solo producción)"
            npm ci --omit=dev

            echo "==> Reiniciando aplicación"
            pm2 restart dewan-api || pm2 start dist/main.js --name dewan-api

            echo "==> Estado"
            pm2 status dewan-api

            echo "==> Deploy completado — modo: $DEPLOY_MODE"
```

---

## Decisiones de diseño

**Por qué `--skip-seed` en `migrate reset` y luego `db seed` explícito:**
`prisma migrate reset --force` sin `--skip-seed` ejecutaría el seed automáticamente como parte del reset. Separarlo hace el flujo explícito y permite cambiar uno sin tocar el otro.

**Por qué `npm ci` completo antes del build:**
El seed (`prisma/seed.ts`) requiere `ts-node`/`tsx` de devDependencies. Se instalan todas las dependencias al inicio, se usa lo que necesita build/seed, y al final `npm ci --omit=dev` deja el entorno de producción limpio.

**Por qué `pm2 stop` solo en `reset-and-seed`:**
Un reset destructivo borra y recrea la DB. Si la app está corriendo, Prisma lanzará errores de conexión activas. En `with-seed` las migraciones son aditivas y la app puede seguir respondiendo.

**Fallback en push a `main`:**
Cuando el trigger es `push` (no `workflow_dispatch`), `github.event.inputs.deploy_mode` es `null` → el `|| 'standard'` lo convierte en `standard`, preservando el comportamiento actual sin cambios.

---

## Cómo ejecutar cada modo

### Push normal → `standard`
```bash
git push origin main
```

### Desde GitHub Actions UI
`Actions → Deploy Backend to Droplet → Run workflow → seleccionar modo`

### Desde GitHub CLI
```bash
# Con seed, sin resetear
gh workflow run deploy.yml --field deploy_mode=with-seed

# Reset destructivo + seed
gh workflow run deploy.yml --field deploy_mode=reset-and-seed
```

---

## Verificación

1. **Push estándar:** commit pequeño → verificar que el log termina con `Deploy completado — modo: standard` y PM2 `online`.
2. **with-seed:** correr con `with-seed` → verificar en logs `==> Ejecutando seed` y datos en DB.
3. **reset-and-seed:** correr con `reset-and-seed` → verificar `RESET DESTRUCTIVO`, PM2 detenido y reiniciado, DB con solo datos del seed.
4. **Fallo del seed:** `set -e` aborta el script; la app no se reinicia. Recuperar con `pm2 start dist/main.js --name dewan-api` en el droplet.
