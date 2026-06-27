# Optimizaciones del servidor — 2026-06-27

Cambios aplicados en el Droplet de producción (`api.getdewan.com`, `209.38.117.98`).

## Resumen de cambios

| Componente | Antes | Después | Por qué |
|---|---|---|---|
| Nginx rate limit | `30r/m` (0.5 req/s) | `600r/m` (10 req/s) | Los reloads de página disparan 8-10 requests simultáneos agotando el burst |
| Nginx burst | `10` | `60` | Absorber picos de carga sin rechazar requests |
| PM2 exec mode | `fork_mode` | `cluster` | Zero-downtime en crashes; reinicio limpio por worker |
| PM2 instancias | 1 | 2 | Resiliencia: si un worker cae, el otro sigue |
| Node.js heap | sin límite | `--max-old-space-size=300` | Evitar que el proceso crezca hasta matar el servidor |
| PM2 max_memory | sin límite | `350M` por worker | Auto-restart si hay memory leak |
| Swap | 0 bytes | 1 GB | Red de seguridad contra OOM killer |

---

## Detalles de cada cambio

### 1. Nginx — Rate limiting (`/etc/nginx/nginx.conf`)

**Antes:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

**Después:**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=600r/m;
```

### 2. Nginx — Burst (`/etc/nginx/sites-enabled/dewan-api`)

**Antes:**
```nginx
limit_req zone=api burst=10 nodelay;
```

**Después:**
```nginx
limit_req zone=api burst=60 nodelay;
```

### 3. PM2 — Cluster mode + heap (`/home/dewan/dewan-api/ecosystem.config.js`)

Archivo creado en el servidor:

```js
module.exports = {
  apps: [{
    name: "dewan-api",
    script: "./dist/main.js",
    cwd: "/home/dewan/dewan-api",
    instances: 2,
    exec_mode: "cluster",
    node_args: "--max-old-space-size=300",
    max_memory_restart: "350M",
    merge_logs: true,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: "production"
    }
  }]
}
```

**Comandos para arrancar / reiniciar:**
```bash
# Arrancar con ecosystem (primera vez o tras un reinicio del droplet)
pm2 start /home/dewan/dewan-api/ecosystem.config.js
pm2 save

# Reload sin downtime (para deploys)
pm2 reload dewan-api

# Ver estado
pm2 list
pm2 monit
```

> ⚠️ El `deploy.yml` de GitHub Actions usa `pm2 restart dewan-api`. Cambiar a `pm2 reload dewan-api` para aprovechar el zero-downtime del cluster mode.

### 4. Swap — 1 GB swapfile

```bash
# Crear (ya aplicado)
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Persistente en /etc/fstab (ya añadido)
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab

# Swappiness conservadora (el OS usará swap solo en emergencia)
sudo sysctl vm.swappiness=10
echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.conf
```

**Verificar:**
```bash
free -h
swapon --show
```

---

## Diagnóstico previo (causa raíz de los ERR_FAILED)

Los tests E2E `check-503` detectaron errores intermitentes `ERR_FAILED` y `ERR_ABORTED` en
todas las secciones. La causa era el rate limit de Nginx demasiado restrictivo:

- `30r/m = 0.5 req/s` con `burst=10 nodelay`
- Una recarga de página en el frontend dispara 8-10 requests API simultáneos
- Los 10 slots del burst se agotaban al instante
- El siguiente request antes de que el bucket se recargara (2 segundos) recibía **503**
- Con reloads rápidos, el bucket nunca se recuperaba → 503 en cascada

---

## SSH al servidor desde Claude Code

La clave SSH para conectarse desde la sesión de Claude Code está guardada en `~/.ssh/dewan_server`.

```bash
# Conexión directa
ssh dewan-prod

# O explícitamente
ssh -i ~/.ssh/dewan_server dewan@209.38.117.98
```

Entrada en `~/.ssh/config`:
```
Host dewan-prod
    HostName 209.38.117.98
    User dewan
    IdentityFile ~/.ssh/dewan_server
    StrictHostKeyChecking no
```

> Para añadir esta clave al servidor (si se regenera), ejecutar desde una terminal con acceso:
> ```bash
> ssh dewan@209.38.117.98 "echo '<public_key>' >> ~/.ssh/authorized_keys"
> ```

---

## Monitoreo post-cambio

```bash
# Conectar al servidor
ssh dewan-prod

# Ver estado PM2
pm2 list
pm2 monit

# Ver memoria en tiempo real
watch -n 2 free -h

# Ver logs de nginx (errores 503)
sudo tail -f /var/log/nginx/error.log

# Ver logs de la app
pm2 logs dewan-api --lines 50
```
