# R Soft — Arquitectura Técnica (documento histórico de planificación)

> ⚠️ **DOCUMENTO HISTÓRICO** — Este archivo describe las decisiones de arquitectura tomadas en la
> fase de planeación (2026-05-18). El estado actual real está en
> [`architecture-summary.md`](architecture-summary.md).
>
> **Cambios respecto a este documento:**
> - Hosting: **AWS EC2 → DigitalOcean Droplet s-1vcpu-1gb** (producción real)
> - Dominio: `rsoft.com` → **`getdewan.com`** (`app.getdewan.com` / `api.getdewan.com`)
> - API prefix: `/api/v1` → **`/v1`** (sin `/api`)
> - Logging: Pino → **LoggingInterceptor propio** (no se instaló nestjs-pino)
> - Email: AWS SES → **console.log** (MVP, pendiente de integrar)
> - Cloudflare R2 (imágenes) → **no implementado en producción**
> - AWS S3 (backups) → **no implementado en producción**
> - Módulos: 19 → **21** (añadidos `owners` + tablas integradas en orders)
> - WebSocket rooms: patrón `tenant:{id}` → **`kitchen_[id]`, `orders_[id]`, `user_[id]`**
>
> El valor de este archivo está en los **decision records** (secciones 9–10), no en los diagramas operacionales.

---

> **Fase actual:** Fase 3 — Arquitectura técnica (planificación)
> **Última actualización:** 2026-05-18
> **Contexto MVP:** Un solo tenant (1 restaurante), 5-8 usuarios simultáneos

-----

## 1. Visión general de la arquitectura

```
                         ┌──────────────────────┐
                         │     CLOUDFLARE        │
                         │   (DNS + SSL + CDN)   │
                         │       FREE PLAN       │
                         └──────┬───────┬────────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ▼                                 ▼
    app.rsoft.com (frontend)          api.rsoft.com (backend)
                   │                                 │
                   ▼                                 ▼
      ┌────────────────────┐         ┌───────────────────────────────┐
      │   AWS CLOUDFRONT   │         │        AWS EC2 t2.micro       │
      │    (CDN - caché)   │         │         Amazon Linux 2023     │
      │                    │         │                               │
      │  Origin: S3 bucket │         │  ┌─────────────────────────┐  │
      └────────┬───────────┘         │  │  Node.js 20 LTS         │  │
               │                     │  │  NestJS + Prisma ORM    │  │
               ▼                     │  │  ├── API REST (:3000)   │  │
      ┌────────────────────┐         │  │  ├── WebSocket (Socket) │  │
      │      AWS S3        │         │  │  └── Cron jobs           │  │
      │  rsoft-frontend    │         │  └───────────┬─────────────┘  │
      │  (SPA Angular)     │         │              │ localhost:5432  │
      └────────────────────┘         │  ┌───────────▼─────────────┐  │
                                     │  │  PostgreSQL 16          │  │
      ┌────────────────────┐         │  │  └── rsoft_db           │  │
      │      AWS S3        │         │  └─────────────────────────┘  │
      │  rsoft-backups     │         │                               │
      │  (pg_dump diario)  │         │  Nginx (reverse proxy :443)   │
      └────────────────────┘         └───────────────────────────────┘
                                                    │
      ┌────────────────────┐                        │
      │      AWS SES       │◄───────────────────────┘
      │  (emails transac.) │
      └────────────────────┘

      ┌────────────────────┐
      │   AWS CLOUDWATCH   │
      │  (logs + alarmas)  │
      └────────────────────┘
```

-----

## 2. Stack tecnológico

### 2.1 Frontend

| Componente       | Tecnología                            | Justificación                                                                |
|------------------|---------------------------------------|------------------------------------------------------------------------------|
| Framework        | **Angular 18+**                       | Framework completo: routing, HTTP, forms, DI integrados. Estructura opinada. |
| Lenguaje         | **TypeScript**                        | Nativo en Angular. Tipado fuerte, coherencia con el backend.                 |
| Estilos          | **Tailwind CSS**                      | Utilidades atómicas, complementa PrimeNG para layouts y espaciado.           |
| Componentes UI   | **PrimeNG**                           | +80 componentes listos: tablas, calendarios, menús, diálogos, charts, etc.   |
| Iconos           | **PrimeIcons**                        | Integrados con PrimeNG. +200 iconos SVG incluidos.                           |
| Tema             | **Aura (PrimeNG)**                    | Tema moderno, personalizable con CSS variables.                              |
| Estado global    | **Angular Signals + Services**        | Reactivo, nativo de Angular 18+, sin dependencias externas.                  |
| HTTP client      | **HttpClient (integrado)**            | Interceptores para JWT, manejo centralizado de errores con RxJS.             |
| WebSocket client | **ngx-socket-io**                     | Wrapper de Socket.io para Angular con observables.                           |
| Routing          | **Angular Router (integrado)**        | Lazy loading de módulos, guards de ruta por rol.                             |
| Forms            | **Reactive Forms (integrado)**        | Validaciones tipadas, control granular, integración con PrimeNG.             |
| Tablas           | **PrimeNG p-table**                   | Paginación server-side, filtrado, sorting, edición inline, exportación.      |
| Gráficas         | **PrimeNG Charts (wrapper Chart.js)** | Integrado con PrimeNG, line/bar/pie/doughnut para reportes.                  |
| Build output     | Archivos estáticos (HTML/JS/CSS)      | `ng build` genera bundle que se sube a S3+CloudFront.                        |

### 2.2 Backend

| Componente         | Tecnología                          | Justificación                                                              |
|--------------------|-------------------------------------|----------------------------------------------------------------------------|
| Runtime            | **Node.js 20 LTS**                  | Estable, soporte largo, async I/O ideal para API + WebSockets.             |
| Framework          | **NestJS**                          | Estructura modular, DI, decoradores. Filosofía similar a Angular.          |
| Lenguaje           | **TypeScript**                      | Mismo lenguaje que el frontend, stack unificado.                           |
| ORM                | **Prisma**                          | Esquema declarativo, migraciones, type-safe queries, excelente DX.         |
| Autenticación      | **JWT (jsonwebtoken)**              | Access token (15 min) + Refresh token (7 días). Sin Cognito = cero costo. |
| Hash passwords     | **bcrypt**                          | Estándar para hashing de contraseñas.                                      |
| Validación         | **class-validator + class-transformer** | DTOs validados en cada endpoint.                                       |
| WebSockets         | **Socket.io (vía NestJS Gateway)**  | Eventos en tiempo real para cocina, meseros, cambios de estado.            |
| Tareas programadas | **@nestjs/schedule (cron)**         | Reportes, alertas de stock, limpieza. Mismo proceso, sin Lambda.           |
| Emails             | **@aws-sdk/client-ses**             | Integración directa con SES desde el EC2.                                  |
| File upload        | **@aws-sdk/client-s3 + multer**     | Subir logos e imágenes a S3.                                               |
| Logging            | **Pino** (vía nestjs-pino)          | Logs estructurados JSON, rápido, compatible con CloudWatch.                |
| API docs           | **Swagger (@nestjs/swagger)**       | Documentación automática de endpoints.                                     |
| Rate limiting      | **@nestjs/throttler**               | Protección básica contra abuso.                                            |

### 2.3 Base de datos

| Componente   | Tecnología                  | Justificación                                                              |
|--------------|-----------------------------|----------------------------------------------------------------------------|
| Motor        | **PostgreSQL 16**           | Relacional, robusto, JSONB para metadata, ideal para modelo multi-tenant.  |
| Instalación  | Directamente en el EC2      | Un solo tenant, ahorra el free tier de RDS para el futuro.                 |
| Migraciones  | **Prisma Migrate**          | Versionado del esquema, reproducible, integrado con el ORM.                |
| Backups      | **pg_dump + cron + S3**     | Backup diario automático a S3 (dentro del free tier).                      |

-----

## 3. Infraestructura AWS — Detalle completo

### 3.1 EC2 — Servidor principal

| Parámetro           | Valor                                                          |
|---------------------|----------------------------------------------------------------|
| Tipo de instancia   | `t2.micro` (1 vCPU, 1 GB RAM)                                 |
| AMI                 | Amazon Linux 2023 (x86_64, minimal)                            |
| Región              | `us-east-1` (Virginia) — mayor cobertura de free tier          |
| Availability Zone   | Una sola AZ (ej: `us-east-1a`) — evita data transfer entre AZ |
| EBS volumen         | 20 GB gp2 (free tier permite hasta 30 GB)                      |
| Elastic IP          | 1 (gratis mientras esté asociada a instancia corriendo)        |
| Key Pair            | ED25519 para SSH                                               |

**Software instalado en el EC2:**

```
Amazon Linux 2023
├── Node.js 20 LTS (via nvm)
├── PostgreSQL 16 (via dnf)
├── Nginx (reverse proxy + SSL termination)
├── PM2 (process manager para NestJS)
└── AWS CLI v2 (para scripts de backup a S3)
```

### 3.2 Security Groups — `rsoft-ec2-sg`

| Tipo     | Protocolo | Puerto | Origen           | Propósito                      |
|----------|-----------|--------|------------------|--------------------------------|
| Inbound  | TCP       | 22     | Tu IP fija/rango | SSH administración             |
| Inbound  | TCP       | 80     | 0.0.0.0/0        | HTTP (redirige a HTTPS)        |
| Inbound  | TCP       | 443    | 0.0.0.0/0        | HTTPS (Nginx → NestJS)         |
| Outbound | All       | All    | 0.0.0.0/0        | Salida (SES, S3, updates, etc.)|

> ⚠️ PostgreSQL (5432) **NO** se expone a internet. Solo escucha en `localhost`.

### 3.3 Nginx — Reverse proxy

```nginx
# /etc/nginx/conf.d/rsoft-api.conf

upstream nestjs {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name api.rsoft.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.rsoft.com;

    ssl_certificate     /etc/nginx/ssl/rsoft.crt;
    ssl_certificate_key /etc/nginx/ssl/rsoft.key;

    location / {
        proxy_pass http://nestjs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /socket.io/ {
        proxy_pass http://nestjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 3.4 S3 — Buckets

| Bucket                      | Propósito                        | Acceso    | Tamaño est. |
|-----------------------------|----------------------------------|-----------|-------------|
| `rsoft-frontend-{id}`       | SPA Angular (ng build)           | Solo CF   | ~80 MB      |
| `rsoft-backups-{id}`        | pg_dump diario (retención 30 días)| Privado  | ~500 MB     |
| `rsoft-uploads-{id}`        | Logos, imágenes de productos     | Público   | ~100 MB     |

### 3.5 CloudFront

| Parámetro           | Valor                                         |
|---------------------|-----------------------------------------------|
| Origin              | S3 `rsoft-frontend` (OAC privado)             |
| Default root        | `index.html`                                  |
| Error pages         | 403/404 → `index.html` (Angular routing)      |
| Price class         | `PriceClass_100` (NA + EU, más económico)     |
| SSL                 | ACM gratuito (`*.rsoft.com`)                  |
| Alternate domain    | `app.rsoft.com`                               |

### 3.6 SES

| Parámetro      | Valor                                              |
|----------------|----------------------------------------------------|
| Región         | `us-east-1`                                        |
| Uso            | Reset contraseña, alertas stock, resúmenes diarios |
| Free tier      | 62,000 emails/mes desde EC2 (siempre gratis)       |
| Uso estimado   | ~100 emails/mes                                    |

> SES inicia en **sandbox** (solo emails verificados). Solicitar salida del sandbox antes de producción.

### 3.7 CloudWatch

| Recurso         | Configuración                          |
|-----------------|----------------------------------------|
| Log group       | `/rsoft/api` — retención 7 días        |
| Alarma 1        | CPU EC2 > 80% por 5 min → email        |
| Alarma 2        | Disco EC2 > 80% → email               |
| Alarma 3        | Billing > $1 USD → email              |

### 3.8 IAM Role para EC2 — `rsoft-ec2-role`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::rsoft-backups-*",
        "arn:aws:s3:::rsoft-backups-*/*",
        "arn:aws:s3:::rsoft-uploads-*",
        "arn:aws:s3:::rsoft-uploads-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/rsoft/*"
    }
  ]
}
```

-----

## 4. DNS — Cloudflare (gratuito)

### 4.1 ¿Por qué Cloudflare y no Route 53?

Route 53 cobra **$0.50 USD/mes** por zona alojada + $0.40/millón de queries.
Cloudflare Free cubre todo eso y más, sin costo.

| Característica        | Route 53           | Cloudflare Free     |
|-----------------------|--------------------|---------------------|
| DNS autoritativo      | $0.50/mes por zona | Gratis              |
| Queries DNS           | $0.40/millón       | Ilimitadas gratis   |
| Protección DDoS       | No incluida        | Incluida            |
| SSL edge              | No incluido        | Incluido            |
| Proxy/CDN básico      | No incluido        | Incluido            |
| WAF básico            | No incluido        | 5 reglas gratis     |
| Integración nativa AWS| Sí                 | No                  |

La integración nativa de Route 53 con AWS (ACM auto-validación, health checks
con failover) no se necesita en un MVP de un solo servidor. Si el proyecto
crece a multi-región, se evalúa entonces.

### 4.2 Registros DNS

| # | Tipo  | Nombre        | Valor                     | Proxy    | Propósito          |
|---|-------|---------------|---------------------------|----------|--------------------|
| 1 | A     | `api`         | `<Elastic IP del EC2>`    | 🟠 ON    | API + WebSockets   |
| 2 | CNAME | `app`         | `<id>.cloudfront.net`     | ⚪ OFF   | Frontend SPA       |
| 3 | TXT   | `_amazonses`  | `<token verificación>`    | ⚪ OFF   | Verificar SES      |

### 4.3 SSL/TLS

```
[Navegador] ──HTTPS──► [Cloudflare] ──HTTPS──► [EC2 Nginx]
                        (Origin Cert gratis,           
                         válido 15 años)        

[Navegador] ──HTTPS──► [CloudFront] ──────────► [S3 privado]
                        (ACM cert gratis)         (OAC)
```

-----

## 5. Flujos de red

### 5.1 Usuario abre la app

```
1. https://app.rsoft.com
2. DNS → CloudFront (CNAME)
3. CloudFront: caché HIT → retorna | MISS → pide a S3
4. Angular SPA carga en el navegador
5. Angular llama a https://api.rsoft.com/api/v1/*
```

### 5.2 Llamada a la API

```
1. POST https://api.rsoft.com/api/v1/orders
2. DNS → Cloudflare proxy → Elastic IP EC2
3. Cloudflare: DDoS check + SSL
4. Nginx :443 → proxy_pass → NestJS :3000
5. NestJS: rate limit → JWT auth → tenant guard
6. Controller → Service → Prisma → PostgreSQL localhost
7. Respuesta JSON → emite evento WebSocket "order:new"
8. Cocina recibe notificación en tiempo real
```

### 5.3 WebSocket

```
1. wss://api.rsoft.com/socket.io/
2. Cloudflare permite WebSocket nativo
3. Nginx upgrade → Socket.io NestJS
4. Autenticación JWT en el handshake
5. Room: tenant:{tenant_id}
6. Eventos:
   ├── order:new     → cocina
   ├── order:status  → mesero + cocina
   ├── stock:low     → owner/admin
   └── cash:opened   → cajero
```

### 5.4 Backup automático (3:00 AM)

```bash
#!/bin/bash
# /home/ec2-user/scripts/backup.sh
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
BACKUP_FILE="/tmp/rsoft_backup_${TIMESTAMP}.sql.gz"
S3_BUCKET="s3://rsoft-backups-xxx/daily/"

pg_dump -U rsoft_user rsoft_db | gzip > "$BACKUP_FILE"
aws s3 cp "$BACKUP_FILE" "$S3_BUCKET"
rm -f "$BACKUP_FILE"
echo "[$(date)] Backup OK: ${BACKUP_FILE}" >> /var/log/rsoft-backup.log
```

-----

## 6. Estructura del proyecto

```
rsoft/
├── frontend/                          # Angular 18+
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                  # Singleton: guards, interceptors, services
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   ├── role.guard.ts
│   │   │   │   │   └── jwt.interceptor.ts
│   │   │   │   └── services/
│   │   │   │       ├── api.service.ts
│   │   │   │       ├── socket.service.ts
│   │   │   │       └── toast.service.ts
│   │   │   ├── shared/                # Componentes reutilizables
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar/
│   │   │   │   │   └── header/
│   │   │   │   └── pipes/
│   │   │   ├── features/              # Módulos lazy-loaded
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── orders/
│   │   │   │   ├── products/
│   │   │   │   ├── inventory/
│   │   │   │   ├── kitchen/           # Vista tiempo real
│   │   │   │   ├── cash-register/
│   │   │   │   ├── delivery/
│   │   │   │   ├── reports/
│   │   │   │   ├── users/
│   │   │   │   ├── customers/
│   │   │   │   ├── suppliers/
│   │   │   │   └── purchases/
│   │   │   ├── app.component.ts
│   │   │   ├── app.config.ts
│   │   │   └── app.routes.ts
│   │   ├── environments/
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   ├── styles.scss                # Tailwind + PrimeNG theme
│   │   └── main.ts
│   ├── angular.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # NestJS
│   ├── src/
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── tenant.guard.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   ├── interceptors/
│   │   │   │   └── audit-log.interceptor.ts
│   │   │   └── decorators/
│   │   │       ├── roles.decorator.ts
│   │   │       └── current-user.decorator.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── tenants/
│   │   │   ├── users/
│   │   │   ├── products/
│   │   │   ├── orders/
│   │   │   ├── cash-register/
│   │   │   ├── inventory/
│   │   │   ├── customers/
│   │   │   ├── suppliers/
│   │   │   ├── purchases/
│   │   │   ├── reports/
│   │   │   └── audit-log/
│   │   ├── websockets/
│   │   │   └── events.gateway.ts
│   │   ├── tasks/
│   │   │   └── stock-alert.task.ts
│   │   ├── prisma/
│   │   │   └── prisma.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── package.json
│
├── infra/
│   ├── scripts/
│   │   ├── setup-ec2.sh               # Bootstrap del servidor
│   │   ├── backup.sh                  # pg_dump → S3
│   │   ├── deploy-api.sh
│   │   └── deploy-frontend.sh         # ng build + s3 sync + CF invalidation
│   └── nginx/
│       └── rsoft-api.conf
│
├── .github/
│   └── workflows/
│       ├── deploy-api.yml
│       └── deploy-frontend.yml
│
├── docker-compose.dev.yml             # PostgreSQL local para desarrollo
├── .env.example
└── README.md
```

-----

## 7. Entorno de desarrollo local

```yaml
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: rsoft_db
      POSTGRES_USER: rsoft_user
      POSTGRES_PASSWORD: rsoft_dev_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- Backend: `npm run start:dev` (NestJS hot reload)
- Frontend: `ng serve` (Angular dev server con hot reload)
- Base de datos: Docker Compose (sin instalar PostgreSQL en la máquina)

-----

## 8. Costos — Tres escenarios detallados

### Tipos de Free Tier en AWS

Antes de los costos, es importante entender que AWS tiene tres tipos de
gratuidad distintos:

| Tipo                  | Duración                        | Ejemplos                                     |
|-----------------------|---------------------------------|----------------------------------------------|
| **12 meses gratis**   | Desde que creas la cuenta AWS   | EC2, EBS, S3, CloudFront, RDS                |
| **Siempre gratis**    | Sin expiración, para siempre    | Lambda (1M req), SES (62K), CloudWatch, ACM  |
| **Prueba corta**      | 30-90 días según servicio       | Lightsail (3 meses), SageMaker               |

> ⚠️ Los 12 meses empiezan cuando **creas la cuenta AWS**, no cuando activas
> cada servicio. Si tu cuenta ya tiene 6 meses, solo quedan 6 meses de
> free tier para EC2/S3/CloudFront.

-----

### 8.1 Año 1 — Free Tier activo (1 tenant, MVP)

| Servicio            | Límite Free Tier (12 meses)       | Uso estimado        | Costo/mes |
|---------------------|-----------------------------------|---------------------|-----------|
| EC2 t2.micro        | 750 hrs/mes                       | 744 hrs (24/7)      | $0.00     |
| EBS 20 GB gp2       | 30 GB                             | 20 GB               | $0.00     |
| Elastic IP          | 1 gratis (asociada a EC2)         | 1                   | $0.00     |
| S3 almacenamiento   | 5 GB                              | ~700 MB             | $0.00     |
| S3 requests         | 20K GET + 2K PUT                  | ~5K GET + ~500 PUT  | $0.00     |
| CloudFront transfer | 1 TB/mes                          | ~2 GB               | $0.00     |
| CloudFront requests | 10M/mes                           | ~10K                | $0.00     |
| ACM certificado     | ∞ (siempre gratis)                | 1                   | $0.00     |
| SES emails          | 62,000/mes desde EC2 (∞)          | ~100                | $0.00     |
| CloudWatch logs     | 5 GB ingesta (∞)                  | ~500 MB             | $0.00     |
| CloudWatch alarmas  | 10 alarmas (∞)                    | 3                   | $0.00     |
| Cloudflare DNS      | ∞ (siempre gratis)                | 1 dominio           | $0.00     |
| **Dominio .com**    | No aplica                         | 1                   | **~$1.00**|
| **Total mensual**   |                                   |                     | **~$1**   |
| **Total Año 1**     |                                   |                     | **~$12**  |

> 💡 Prácticamente gratis. El único gasto real es el dominio (~$10-15/año).

-----

### 8.2 Año 2+ — Free Tier expirado (1 tenant, misma infraestructura)

Los servicios "siempre gratis" continúan sin costo. Los de "12 meses" empiezan
a cobrar a precio bajo demanda en `us-east-1`.

| Servicio            | Precio bajo demanda               | Uso estimado        | Costo/mes  |
|---------------------|-----------------------------------|---------------------|------------|
| EC2 t2.micro        | $0.0116/hr                        | 744 hrs             | **$8.63**  |
| EBS 20 GB gp2       | $0.10/GB-mes                      | 20 GB               | **$2.00**  |
| Elastic IP          | $0.005/hr ¹                       | 744 hrs             | **$3.72**  |
| S3 almacenamiento   | $0.023/GB-mes                     | ~1 GB               | **$0.02**  |
| S3 requests         | $0.0004/1K GET                    | ~5K GET             | **$0.01**  |
| CloudFront transfer | $0.085/GB                         | ~2 GB               | **$0.17**  |
| ACM certificado     | ∞ gratis                          | 1                   | $0.00      |
| SES emails          | ∞ gratis (desde EC2)              | ~100                | $0.00      |
| CloudWatch          | ∞ gratis (dentro del límite)      | OK                  | $0.00      |
| Cloudflare DNS      | ∞ gratis                          | 1                   | $0.00      |
| Dominio             |                                   | 1                   | ~$1.00     |
| **Total mensual**   |                                   |                     | **~$15.56**|
| **Total anual**     |                                   |                     | **~$187**  |

> ¹ Desde febrero 2024, AWS cobra las Elastic IP incluso asociadas a instancias
> en ejecución ($0.005/hr). Antes era gratis.

#### Alternativa post-free-tier: AWS Lightsail $3.50/mes

Si los ~$16/mes parecen mucho después del año gratis, Lightsail es la
alternativa más económica dentro del ecosistema AWS:

| Plan Lightsail  | vCPU | RAM  | SSD  | Transfer | IP estática | Costo/mes |
|-----------------|------|------|------|----------|-------------|-----------|
| Nano            | 2    | 512MB| 20GB | 1 TB     | Incluida    | $3.50     |
| Micro           | 2    | 1GB  | 40GB | 2 TB     | Incluida    | $5.00     |
| Small           | 2    | 2GB  | 60GB | 3 TB     | Incluida    | $10.00    |

> Para 1 tenant, el plan **Micro ($5/mes)** cubre perfectamente y es
> precio fijo (sin sorpresas). Incluye IP, disco y transferencia.

-----

### 8.3 Multi-tenant — Crecimiento a N negocios

Cuando el MVP esté validado y quieras sumar más negocios, se mueve PostgreSQL
a RDS (usando el free tier de RDS que se guardó durante el MVP).

#### Escenario A: 5-10 tenants (~30-80 usuarios concurrentes)

| Servicio            | Especificación                    | Uso estimado        | Costo/mes  |
|---------------------|-----------------------------------|---------------------|------------|
| EC2 t3.small        | 2 vCPU, 2 GB RAM                  | 744 hrs (24/7)      | **$15.18** |
| EBS 30 GB gp3       | $0.08/GB-mes                      | 30 GB               | **$2.40**  |
| Elastic IP          | $0.005/hr                         | 744 hrs             | **$3.72**  |
| RDS db.t3.micro     | 2 vCPU, 1 GB RAM                  | Free tier ²         | **$0.00**  |
| S3                  | $0.023/GB-mes                     | ~5 GB               | **$0.12**  |
| CloudFront          | $0.085/GB                         | ~10 GB              | **$0.85**  |
| SES / CloudWatch    | ∞ gratis                          | OK                  | $0.00      |
| Dominio             |                                   | 1                   | ~$1.00     |
| **Total mensual**   |                                   |                     | **~$23**   |
| **Total anual**     |                                   |                     | **~$276**  |

> ² RDS tiene su propio free tier de 12 meses desde que se activa por primera
> vez. Al activarlo en el año 2 del proyecto, se obtienen otros 12 meses
> gratis. Después pasa a ~$12.41/mes (db.t3.micro on-demand).

#### Escenario B: 50+ tenants (~200+ usuarios concurrentes)

| Servicio            | Especificación                    | Uso estimado        | Costo/mes  |
|---------------------|-----------------------------------|---------------------|------------|
| EC2 t3.medium       | 2 vCPU, 4 GB RAM                  | 744 hrs             | **$30.37** |
| EBS 50 GB gp3       | $0.08/GB-mes                      | 50 GB               | **$4.00**  |
| Elastic IP          | $0.005/hr                         | 744 hrs             | **$3.72**  |
| RDS db.t3.small     | 2 vCPU, 2 GB RAM                  | 744 hrs             | **$24.82** |
| RDS storage 50 GB   | $0.115/GB-mes gp2                 | 50 GB               | **$5.75**  |
| S3                  | $0.023/GB-mes                     | ~20 GB              | **$0.46**  |
| CloudFront          | $0.085/GB                         | ~50 GB              | **$4.25**  |
| CloudWatch extras   | $0.50/GB después de 5 GB          | ~3 GB extra         | **$1.50**  |
| SES                 | ∞ gratis                          | ~2K emails          | $0.00      |
| Dominio             |                                   | 1                   | ~$1.00     |
| **Total mensual**   |                                   |                     | **~$76**   |
| **Total anual**     |                                   |                     | **~$912**  |

#### Resumen comparativo

| Escenario                         | Tenants | Usuarios  | Costo/mes | Costo/año |
|-----------------------------------|---------|-----------|-----------|-----------|
| Año 1 — Free Tier (MVP)          | 1       | 5-8       | ~$1       | ~$12      |
| Año 2+ — Misma infra             | 1       | 5-8       | ~$16      | ~$187     |
| Año 2+ — Lightsail (alternativa) | 1       | 5-8       | ~$5       | ~$60      |
| Crecimiento — 5 a 10 tenants     | 5-10    | 30-80     | ~$23      | ~$276     |
| Crecimiento — 50+ tenants        | 50+     | 200+      | ~$76      | ~$912     |

#### Punto de equilibrio (rentabilidad)

Si cobras una tarifa mensual por tenant, ¿cuántos necesitas para cubrir
la infraestructura?

| Precio por tenant | Tenants para cubrir $23/mes | Tenants para cubrir $76/mes |
|-------------------|-----------------------------|------------------------------|
| $10 USD/mes       | 3 tenants                   | 8 tenants                    |
| $20 USD/mes       | 2 tenants                   | 4 tenants                    |
| $50 USD/mes       | 1 tenant                    | 2 tenants                    |

> 💡 El modelo es rentable desde muy temprano. Con 3-4 clientes pagando
> $20/mes ya cubres toda la infraestructura del escenario de 5-10 tenants.

-----

## 9. Alertas de riesgo — Trampas de costos

| ⚠️ Trampa                  | Costo potencial       | Cómo evitarla                                   |
|----------------------------|-----------------------|-------------------------------------------------|
| NAT Gateway                | $32/mes mínimo        | No usar. EC2 en subnet pública con IP elástica. |
| Elastic IP sin asociar     | $3.65/mes             | Siempre asociar. Liberar si no usas.            |
| RDS durante el MVP         | Quema free tier 12m   | PostgreSQL en EC2. Guardar RDS para crecer.     |
| Data transfer entre AZs    | $0.01/GB              | Todo en una sola AZ.                            |
| ALB / ELB                  | ~$16/mes              | Nginx en el EC2 reemplaza al ALB.               |
| CloudWatch logs excesivos  | $0.50/GB sobre 5 GB   | Retención 7 días, log level `warn` en prod.     |
| Route 53                   | $0.50/mes por zona    | Usar Cloudflare (gratis).                       |
| EBS snapshots              | $0.05/GB-mes          | pg_dump + S3 en vez de snapshots EBS.           |
| Elastic IP post-2024       | $3.72/mes             | Considerar Lightsail post-free-tier.            |
| Cognito                    | Complejidad y costo   | JWT propio. Suficiente para el MVP.             |

-----

## 10. Registro de decisiones — Fase 3

| #    | Fecha      | Decisión                                               | Justificación                                               |
|------|------------|--------------------------------------------------------|-------------------------------------------------------------|
| D-25 | 2026-05-18 | EC2 monolito (no Lambda) para MVP                      | Evita RDS Proxy ($15/mes), simplifica WebSockets            |
| D-26 | 2026-05-18 | PostgreSQL en EC2 (no RDS)                             | Preserva free tier de RDS para crecimiento futuro           |
| D-27 | 2026-05-18 | Cloudflare como DNS (no Route 53)                      | Route 53 cobra $0.50/mes. Cloudflare es gratis              |
| D-28 | 2026-05-18 | Frontend: Angular 18+ + PrimeNG + Tailwind             | Framework completo, +80 componentes UI, build estático S3   |
| D-29 | 2026-05-18 | Backend: NestJS + TypeScript + Prisma                  | Modular, tipado, ORM declarativo, misma filosofía Angular   |
| D-30 | 2026-05-18 | JWT propio (no Cognito)                                | Cero costo, control total, suficiente para MVP              |
| D-31 | 2026-05-18 | WebSockets: Socket.io vía NestJS Gateway               | Nativo, sin API Gateway WebSocket, sin DynamoDB             |
| D-32 | 2026-05-18 | SSL: Cloudflare Origin Cert (API) + ACM (CloudFront)   | Gratis en ambos casos, cifrado extremo a extremo            |
| D-33 | 2026-05-18 | Backups: pg_dump + cron + S3 (retención 30 días)       | Simple, dentro del free tier, protege los datos             |
| D-34 | 2026-05-18 | Región: us-east-1                                      | Mayor cobertura de servicios free tier                      |
| D-35 | 2026-05-18 | Todo en una sola AZ                                    | Evita costos de data transfer entre AZs                     |
| D-36 | 2026-05-18 | Nginx como reverse proxy                               | Evita ALB ($16/mes), maneja SSL y WebSocket                 |
| D-37 | 2026-05-18 | Post-free-tier: evaluar Lightsail $5/mes               | Precio fijo, incluye IP + disco + transfer                  |
| D-38 | 2026-05-18 | Multi-tenant: migrar DB a RDS al crecer                | Separa cómputo de datos, usa free tier guardado             |
