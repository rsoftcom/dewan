# scripts/

Scripts operativos del workspace de Dewan. Se ejecutan **desde la raíz** del proyecto.

| Script | Qué hace |
|---|---|
| `dev.sh [local\|cloud]` | Levanta backend (`:3000`) y frontend (`:4200`) a la vez. En modo `cloud` crea túneles Cloudflare y parchea `environment.ts` con la URL pública. `Ctrl+C` detiene todo. |

```bash
./scripts/dev.sh local    # http://localhost:4200 + http://localhost:3000
./scripts/dev.sh cloud    # túneles trycloudflare.com (URLs impresas al arrancar)
```

Logs en `/tmp/dewan-backend.log` y `/tmp/dewan-frontend.log` (y `/tmp/cf-*.log` en modo cloud).

## Notas
- `dev.sh` calcula la raíz del workspace como el directorio padre de `scripts/`, así que
  **debe permanecer dentro de `scripts/`**. Si lo mueves, ajusta la línea `ROOT=`.
- Los detalles de cada modo (CORS, host check de Angular, túneles) están en el `CLAUDE.md` raíz,
  sección *Running Locally*.

## Otros scripts del proyecto
- **Migraciones / seed de DB** → no van aquí; viven en `dewan-backend/` (`npx prisma …`,
  `npm run` para el seed).
- **Mantenimiento puntual de datos** → `dewan-backend/prisma/scripts/` (se corren con `ts-node`,
  p. ej. `reset-cubanitos-passwords.ts`).
- **Despliegue** → automatizado por GitHub Actions en cada repo; ver `/deploy` y `deploy/deploy.md`.
