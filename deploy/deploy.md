# Dewan — Guía de Despliegue MVP en Producción

> **Última actualización:** 2026-06-08
> **Stack:** NestJS + Angular + PostgreSQL + DigitalOcean Droplet + Cloudflare
> **Dominio:** getdewan.com

---

## Arquitectura general

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│              CLOUDFLARE                  │
│   DNS + SSL + CDN + DDoS + Proxy        │
│              FREE PLAN                   │
└──────┬──────────────────┬───────────────┘
       │                  │
       ▼                  ▼
app.getdewan.com    api.getdewan.com
       │                  │
       ▼                  ▼
Cloudflare Pages    DO Droplet s-1vcpu-1gb
Angular SPA         Ubuntu 22.04 LTS
CI/CD automático    NestJS :3000
                    PostgreSQL localhost
                    Nginx :443
                    PM2
```

---

## Índice

1. [Preparar DigitalOcean](#1-preparar-digitalocean)
2. [Configurar el servidor](#2-configurar-el-servidor)
3. [Asociar dominio en Cloudflare](#3-asociar-dominio-en-cloudflare)
4. [Protección DDoS y seguridad](#4-protección-ddos-y-seguridad)
5. [CI/CD del backend — GitHub Actions](#5-cicd-del-backend--github-actions)
6. [Frontend en Cloudflare Pages](#6-frontend-en-cloudflare-pages)
7. [Verificación final](#7-verificación-final)

---

## 1. Preparar DigitalOcean

### 1.1 Activar alertas de billing

> ⚠️ Hacer esto ANTES de crear cualquier recurso.

**Billing → Spending Alerts → Create Alert:**

- Alerta al 80%: `$5`
- Alerta al 100%: `$7`
- Notificación: tu email

### 1.2 Crear Cloud Firewall

**Networking → Firewalls → Create Firewall:**

| Campo | Valor |
|---|---|
| Name | `dewan-firewall` |

**Inbound rules:**

| Type | Protocol | Port | Source | Description |
|---|---|---|---|---|
| SSH | TCP | 22 | All IPv4, All IPv6 | SSH (restringir a tu IP si es posible) |
| HTTP | TCP | 80 | All IPv4, All IPv6 | HTTP — redirige a HTTPS via Nginx |
| HTTPS | TCP | 443 | All IPv4, All IPv6 | HTTPS — API REST y WebSockets |

**Outbound rules:** dejar las reglas por defecto (All TCP/UDP/ICMP).

> ⚠️ El puerto 5432 (PostgreSQL) nunca debe abrirse. Solo escucha en localhost dentro del Droplet.

> 💡 Si quieres restringir SSH a tu IP, pon tu IP en el Source del puerto 22. Cuando cambie, actualiza la regla. Verifica tu IP en: https://checkip.amazonaws.com

### 1.3 Crear el Droplet

**Droplets → Create → Droplets:**

| Parámetro | Valor |
|---|---|
| Region | New York 3 (nyc3) o la más cercana a tus usuarios |
| OS | Ubuntu 22.04 LTS (x86_64) |
| Plan | Basic → Regular → **s-1vcpu-1gb** ($6/mes) |
| Authentication | SSH Key — agregar tu llave pública |
| Hostname | `dewan-api-prod` |
| Tags | `dewan`, `production` |
| Firewall | Seleccionar `dewan-firewall` |

> ⚠️ Asegúrate de tener tu llave SSH pública ya cargada en DigitalOcean (Settings → Security → SSH Keys) antes de crear el Droplet.

### 1.4 Asignar IP Reservada (estática)

**Networking → Reserved IPs → Reserve a new IP:**

- Region: la misma del Droplet
- Assign to Droplet: `dewan-api-prod`

> La IP Reservada es gratis mientras esté asignada a un Droplet encendido. Si el Droplet se destruye y la IP queda sin asignar, cobra $4/mes.

---

## 2. Configurar el servidor

Conectarse por SSH:

```bash
ssh root@<tu-reserved-ip>
```

### 2.1 Actualizar el sistema

```bash
a
```

### 2.2 Crear usuario de aplicación

```bash
# Crear usuario no-root para correr la app
adduser dewan
usermod -aG sudo dewan

# Copiar llave SSH autorizada al nuevo usuario
mkdir -p /home/dewan/.ssh
cp ~/.ssh/authorized_keys /home/dewan/.ssh/
chown -R dewan:dewan /home/dewan/.ssh
chmod 700 /home/dewan/.ssh
chmod 600 /home/dewan/.ssh/authorized_keys
```

A partir de aquí, conectar como `dewan`:

```bash
ssh dewan@<tu-reserved-ip>
```

### 2.3 Instalar Node.js 20 via nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
node --version  # v20.x.x
npm --version
```

> ⚠️ `npm` está instalado via nvm, por eso `sudo npm` no funciona. Siempre usar `npm` sin sudo para instalar paquetes globales como PM2.

### 2.4 Instalar PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib

sudo systemctl enable postgresql
sudo systemctl start postgresql

# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER dewan_user WITH PASSWORD 'dewan_db';"
sudo -u postgres psql -c "CREATE DATABASE dewan_db OWNER dewan_user;"
```

**Configurar autenticación por contraseña (md5):**

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

> ⚠️ La ruta varía según la versión. Verificar con: `ls /etc/postgresql/`

Cambiar las líneas con `peer` o `ident` a `md5`:

```
# TYPE  DATABASE  USER  ADDRESS         METHOD
local   all       all                   md5
host    all       all   127.0.0.1/32    md5
host    all       all   ::1/128         md5
```

```bash
sudo systemctl restart postgresql
```

**Dar permisos completos al usuario:**

```bash
sudo -u postgres psql
```

```sql
\c dewan_db
GRANT ALL PRIVILEGES ON DATABASE dewan_db TO dewan_user;
GRANT ALL ON SCHEMA public TO dewan_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dewan_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dewan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO dewan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO dewan_user;
ALTER SCHEMA public OWNER TO dewan_user;
\q
```

**Verificar conexión:**

```bash
psql -U dewan_user -d dewan_db -h localhost -c "SELECT current_user, current_database();"
# Debe responder con dewan_user y dewan_db
```

### 2.5 Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2.6 Instalar PM2

```bash
# Sin sudo — usar el npm de nvm
npm install -g pm2

# Configurar arranque automático
pm2 startup
# Copiar y ejecutar el comando que muestra (incluye la ruta exacta de tu Node)

pm2 --version
```

### 2.7 Instalar fail2ban

```bash
sudo apt install -y fail2ban

sudo bash -c 'cat > /etc/fail2ban/jail.local << EOF
[sshd]
enabled = true
port = ssh
maxretry = 5
bantime = 3600
findtime = 600
EOF'

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status sshd
```

### 2.8 Clonar el repositorio y configurar el proyecto

```bash
cd ~
ssh-keygen -t ed25519 -C "dewan-droplet" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub
```

### Configurar SSH en Github

github.com/rsoftcom/dewan-backend → Settings → Deploy keys → Add deploy key

Luego configura SSH para que use esa llave al conectarse a GitHub:

```bash
bashnano ~/.ssh/config
```

Pega esto:

```bash
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
```

```bash
git clone git@github.com:rsoftcom/dewan-backend.git dewan-api
cd dewan-api
```

**Crear el archivo `.env` de producción:**

```bash
nano ~/.env.dewan
```

```env
# App
NODE_ENV=production
DATABASE_URL="postgresql://dewan_user:dewan_db@localhost:5432/dewan_db"
JWT_SECRET="d2e0w2a6n"
JWT_EXPIRES_IN="7d"
FRONTEND_URL=https://app.getdewan.com
PORT=3000
```

```bash
# Crear symlink
ln -s ~/.env.dewan ~/dewan-api/.env
```

**Instalar dependencias, compilar y migrar:**

```bash
cd ~/dewan-api
npm install
npm run build
npx prisma migrate deploy
```

**Iniciar con PM2:**

```bash
pm2 start dist/main.js --name dewan-api
pm2 save
pm2 status
```

---

## 3. Asociar dominio en Cloudflare

### 3.1 Registros DNS

**Cloudflare → getdewan.com → DNS → Records → Add record:**

| Tipo | Nombre | Contenido | Proxy | Propósito |
|---|---|---|---|---|
| A | `api` | `<Reserved IP del Droplet>` | 🟠 ON (Proxied) | API + WebSockets |
| CNAME | `app` | `<proyecto>.pages.dev` | ⚪ OFF | Frontend Angular |

> ⚠️ El proxy en `api` DEBE estar en 🟠 Proxied. Esto activa DDoS protection y oculta la IP real del Droplet.

### 3.2 Configurar SSL en Cloudflare

**SSL/TLS → Overview → seleccionar "Full (strict)"**

### 3.3 Generar Cloudflare Origin Certificate

**SSL/TLS → Origin Server → Create Certificate:**

- Genera certificado gratuito válido 15 años
- Descarga `certificate.pem` y `private-key.pem`
- Copiar al servidor:

```bash
sudo mkdir -p /etc/nginx/ssl

# Crear el archivo del certificado
sudo nano /etc/nginx/ssl/certificate.pem
# Pegar el contenido de certificate.pem

# Crear el archivo de la llave privada
sudo nano /etc/nginx/ssl/private-key.pem
# Pegar el contenido de private-key.pem

sudo chmod 600 /etc/nginx/ssl/private-key.pem
```

### 3.4 Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/dewan-api
```

```nginx
upstream nestjs {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.getdewan.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.getdewan.com;

    ssl_certificate     /etc/nginx/ssl/certificate.pem;
    ssl_certificate_key /etc/nginx/ssl/private-key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Rate limiting
    limit_req zone=api burst=10 nodelay;

    location / {
        proxy_pass http://nestjs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket para Socket.io
    location /socket.io/ {
        proxy_pass http://nestjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 3600s;   # conexiones WS son de larga duración
        proxy_send_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dewan-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default  # Eliminar sitio por defecto
```

**Agregar rate limiting al nginx.conf principal:**

```bash
sudo nano /etc/nginx/nginx.conf
```

Dentro del bloque `http { }` agregar:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
client_max_body_size 10m;
```

```bash
sudo nginx -t        # verificar configuración
sudo systemctl reload nginx
```
 
 

## 4. Protección DDoS y seguridad

### 4 capas de defensa

```
Internet → Cloudflare (DDoS L3/L4) → Nginx (rate limit) → NestJS (throttler) → PostgreSQL (localhost)
```

### 4.1 Cloudflare — Capa 1

Al estar en modo 🟠 Proxied se activa automáticamente:
- DDoS protection nivel 3/4 (volumétrico)
- IP real del Droplet oculta
- SSL entre cliente y Cloudflare

**Activar Bot Fight Mode:**
Security → Bots → Bot Fight Mode → ON

**Reglas WAF custom** (Security → WAF → Custom Rules):

| Regla | Campo | Operador | Valor | Acción |
|---|---|---|---|---|
| Rate limit login | `http.request.uri.path` | `contains` | `/auth/login` | Rate limit 5/min |
| Bloquear User-Agent vacío | `http.user_agent` | `eq` | `` | Block |
| Bloquear path traversal | `http.request.uri` | `contains` | `../` | Block |

**Security → Settings:**
- Security Level: `Medium`
- Challenge Passage: `30 minutes`

### 4.2 NestJS Throttler — Capa 3

En `app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 1000,
    limit: 10,    // max 10 req/seg por IP
  },
  {
    name: 'medium',
    ttl: 60000,
    limit: 100,   // max 100 req/min por IP
  },
])
```

---

## 5. CI/CD del backend — GitHub Actions

### 5.1 Generar llave SSH para GitHub Actions

En tu **máquina local**:

```bash
ssh-keygen -t ed25519 -C "github-actions-dewan" -f ~/.ssh/github_actions -N ""

# Copiar llave pública al servidor
ssh-copy-id -i ~/.ssh/github_actions.pub dewan@<tu-reserved-ip>
# O manualmente en el servidor:
# cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys

# Ver la llave privada — copiar para GitHub Secrets
cat ~/.ssh/github_actions
```

**Verificar conexión:**

```bash
ssh -i ~/.ssh/github_actions dewan@<tu-reserved-ip> "echo conexion exitosa"
# Debe responder: conexion exitosa
```

### 5.2 Habilitar autenticación por llave pública en SSH

En el servidor:

```bash
sudo nano /etc/ssh/sshd_config
```

Verificar que estas líneas estén presentes y **sin comentar**:

```
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

Si hiciste cambios:

```bash
sudo systemctl restart ssh
```

### 5.3 Configurar GitHub Secrets

**GitHub → repo backend → Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Valor |
|---|---|
| `DO_HOST` | Tu Reserved IP (solo la IP, ej: `143.198.45.67`) |
| `DO_USER` | `dewan` |
| `DO_SSH_KEY` | Contenido completo de `~/.ssh/github_actions` (desde `-----BEGIN` hasta `KEY-----`) |
| `DO_PORT` | `22` |

> ⚠️ `DO_SSH_KEY` debe ser la llave **privada** (el archivo `github_actions`, no `github_actions.pub`). Copiar el contenido completo incluyendo las líneas `-----BEGIN OPENSSH PRIVATE KEY-----` y `-----END OPENSSH PRIVATE KEY-----`.

### 5.4 Crear el workflow de GitHub Actions

```bash
mkdir -p .github/workflows
```

`.github/workflows/deploy.yml`:

```yaml
name: Deploy Backend to Droplet

on:
  push:
    branches:
      - main

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

            # Cargar nvm — necesario porque npm/node están instalados via nvm
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

            echo "==> Entrando al directorio del proyecto"
            cd /home/dewan/dewan-api

            echo "==> Descargando código nuevo"
            git pull origin main

            echo "==> Instalando dependencias"
            npm ci --omit=dev

            echo "==> Compilando TypeScript"
            npm run build

            echo "==> Ejecutando migraciones"
            npx prisma migrate deploy

            echo "==> Generando Prisma Client"
            npx prisma generate

            echo "==> Reiniciando aplicación"
            pm2 restart dewan-api

            echo "==> Estado"
            pm2 status dewan-api

            echo "✅ Deploy completado exitosamente"
```

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: agregar workflow de deploy automático al Droplet"
git push origin main
```

> ⚠️ Error común de `i/o timeout`: el Cloud Firewall bloquea a GitHub. Verificar que el puerto 22 tiene Source `All IPv4`.

> ⚠️ Error común de `Permission denied (cd)`: la ruta en el script es incorrecta. Verificar que el path sea `/home/dewan/dewan-api`.

> ⚠️ Error común de `npm: command not found` en el script: falta el bloque de carga de nvm. El `export NVM_DIR` y `source nvm.sh` son obligatorios en el script remoto.

---

## 6. Frontend en Cloudflare Pages

### 6.1 Conectar repositorio

**Cloudflare → Workers & Pages → Create → Pages → Connect to Git:**

1. Seleccionar GitHub → autorizar Cloudflare
2. Buscar repo del frontend → Begin setup

### 6.2 Configurar el build

| Campo | Valor |
|---|---|
| Project name | `dewan-frontend` |
| Production branch | `main` |
| Build command | `ng build --configuration production` |
| Build output directory | `dist/dewan-frontend/browser` |

> ⚠️ El output directory varía según el nombre de tu proyecto Angular. Verificar en `angular.json` → `projects → tu-proyecto → architect → build → options → outputPath`.

### 6.3 Variables de entorno

Antes de guardar, agregar en Environment variables:

| Variable | Valor | Entorno |
|---|---|---|
| `NG_APP_API_URL` | `https://api.getdewan.com` | Production |
| `NG_APP_WS_URL` | `wss://api.getdewan.com` | Production |
| `NODE_VERSION` | `20` | Production |

Clic en **Save and Deploy**.

### 6.4 Asignar dominio personalizado

Cuando termine el primer build:

**Pages → tu proyecto → Custom domains → Set up a custom domain:**

- Escribir: `app.getdewan.com`
- Cloudflare detecta el dominio y configura el CNAME automáticamente
- Clic en **Activate domain**

SSL se activa automáticamente.

### 6.5 Activar Preview Deployments

**Settings → Builds & deployments:**

| Setting | Valor |
|---|---|
| Production branch | `main` |
| Preview branches | `All non-production branches` |

Cada Pull Request tendrá su propia URL de preview.

---

## 7. Verificación final

### Cloudflare — WebSockets

> ⚠️ **Obligatorio para que funcionen los WebSockets:** En el dashboard de Cloudflare, verificar:
> - **Network → WebSockets → ON** (está ON por defecto; si alguien lo desactivó, Socket.io no conecta)

### Backend

```bash
# Verificar que Nginx está corriendo
sudo systemctl status nginx

# Verificar que PM2 tiene la API corriendo
pm2 status

# Verificar logs en tiempo real
pm2 logs dewan-api

# Probar el endpoint de salud
curl https://api.getdewan.com/health
# Respuesta esperada: {"status":"ok"}
```

### Frontend

Abrir en el navegador: `https://app.getdewan.com`

Verificar en DevTools → Network que las llamadas van a `https://api.getdewan.com` y responden `200`.

### CI/CD

Hacer un cambio mínimo en el backend, commit y push a `main`. En GitHub → Actions verificar que el workflow corre y termina en verde ✅.

---

## Costos estimados

| Servicio | Plan | Costo/mes |
|---|---|---|
| DO Droplet s-1vcpu-1gb | 1 vCPU, 1 GB RAM, 25 GB SSD, 1 TB transfer | $6.00 |
| DO Reserved IP | Gratis si está asignada al Droplet | $0.00 |
| Cloudflare DNS + CDN | Free plan permanente | $0.00 |
| Cloudflare Pages | Free plan permanente | $0.00 |
| Upstash Redis | Free tier: 10k req/día | $0.00 |
| Resend | Free tier: 3,000 emails/mes | $0.00 |
| GitHub Actions | Free: 2,000 min/mes repos privados | $0.00 |
| **Total** | | **$6.00/mes** |

> ⚠️ **Cuándo escalar:** Cuando la DB supere ~80% del disco o el CPU esté constantemente por encima del 80%, agregar DO Managed PostgreSQL ($15/mes) o hacer resize del Droplet a s-1vcpu-2gb ($12/mes).

---

## Comandos útiles de referencia

```bash
# Ver logs de la API en tiempo real
pm2 logs dewan-api

# Reiniciar la API manualmente
pm2 restart dewan-api

# Ver estado de todos los procesos
pm2 status

# Recargar Nginx sin downtime
sudo systemctl reload nginx

# Ver logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Conectarse a PostgreSQL
psql -U dewan_user -d dewan_db -h localhost

# Ver IPs baneadas por fail2ban
sudo fail2ban-client status sshd

# Verificar uso de disco
df -h

# Verificar uso de memoria
free -m

# Verificar tu IP pública actual (para actualizar regla SSH)
curl https://checkip.amazonaws.com
```

---