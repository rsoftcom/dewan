# Comando: deploy $ARGUMENTS

Pasos para desplegar Dewan. **Backend** → DigitalOcean Droplet (CI/CD por GitHub Actions).
**Frontend** → Cloudflare Pages. El runbook completo de infraestructura está en
`deploy/deploy.md`; este comando es la guía operativa del día a día.

**Argumento (opcional):** `backend` | `frontend` | vacío (ambos).

> Antes de tocar un módulo en el deploy, revisa su estado en
> `.claude/docs/tracking/dev-tracker.json`.

## Antes de desplegar (siempre)
1. Estás en el repo correcto (`dewan-backend` o `dewan-frontend`), rama `dev` limpia.
2. `npm run build` pasa localmente. Backend: `npm test`. Frontend: `npm run build:prod`.
3. Si tocaste el schema: hay migración commiteada en `prisma/migrations/`.
4. Producción despliega desde **`main`** → mergea `dev` → `main` cuando esté listo.

## Backend (DigitalOcean Droplet)

El deploy es automático al hacer push a `main` en `dewan-backend`. El workflow
`.github/workflows/deploy.yml`:
1. `npm ci` + `npm run build` en el runner.
2. SCP de `dist/` al Droplet (`/home/dewan/dewan-api/`).
3. En el servidor: `git pull` → `npm ci --omit=dev` → `prisma generate` →
   `prisma migrate deploy` → `pm2 restart dewan-api`.

```bash
git -C dewan-backend checkout main
git -C dewan-backend merge dev
git -C dewan-backend push origin main      # dispara el deploy
```

- **Con seed:** GitHub → Actions → "Deploy Backend to Droplet" → Run workflow → opción
  `with seed` (instala devDeps, corre `prisma db seed`, reinstala solo prod).
- **Verificar:** `pm2 status dewan-api`, `pm2 logs dewan-api`, y `curl https://api.getdewan.com/v1`.
- **Secrets de Actions:** `DO_HOST`, `DO_USER`, `DO_SSH_KEY` (privada), `DO_PORT`.

> Errores comunes: `npm: command not found` en el script remoto → falta cargar nvm;
> `i/o timeout` → el firewall del Droplet bloquea el puerto 22 a GitHub.

## Frontend (Cloudflare Pages)

Conectado al repo `dewan-frontend`. Cada push a `main` dispara un build de Pages; cada PR a una
rama no-producción genera una URL de preview.

| Campo | Valor |
|---|---|
| Build command | `ng build --configuration production` |
| Output directory | `dist/dewan-frontend/browser` |
| Production branch | `main` |

```bash
git -C dewan-frontend checkout main
git -C dewan-frontend merge dev
git -C dewan-frontend push origin main      # dispara el build de Pages
```

- `apiUrl` de producción está fijado en `environments/environment.prod.ts`
  (`https://api.getdewan.com/v1`) — se hornea en build, no es variable de runtime.
- **Verificar:** abrir `https://app.getdewan.com`, comprobar en DevTools → Network que las
  llamadas van a `https://api.getdewan.com/v1` y responden 200.

## Confirmación antes de pushear a `main`
Desplegar a producción es una acción difícil de revertir. Confirma con el usuario antes de
`push origin main` en cualquiera de los dos repos, salvo que ya te lo haya autorizado.
