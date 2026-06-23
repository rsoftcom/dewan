# R Soft — Arquitectura Técnica (Fase 3)

> **Fase actual:** Fase 3 — Arquitectura técnica
> **Última actualización:** 2026-05-19
> **Contexto MVP:** Un solo tenant (1 restaurante), 5-8 usuarios simultáneos

---

## 1. Visión general de la arquitectura

### Stack A mejorado — Recomendación final para producción

```
                         ┌──────────────────────────────────────┐
                         │            CLOUDFLARE                │
                         │  DNS + SSL + CDN + DDoS + Proxy      │
                         │           FREE PLAN                  │
                         └──────┬───────┬───────────────────────┘
                                │       │
                   ┌────────────┘       └────────────┐
                   ▼                                 ▼
    app.rsoft.com (frontend)          api.rsoft.com (backend)
                   │                                 │
                   ▼                                 ▼
      ┌────────────────────┐         ┌───────────────────────────────┐
      │  CLOUDFLARE PAGES  │         │        AWS EC2 t2.micro       │
      │  (SPA Angular)     │         │         Amazon Linux 2023     │
      │  Gratis permanente │         │                               │
      │  CI/CD automático  │         │  ┌─────────────────────────┐  │
      └────────────────────┘         │  │  Node.js 20 LTS         │  │
                                     │  │  NestJS + Prisma ORM    │  │
      ┌────────────────────┐         │  │  ├── API REST (:3000)   │  │
      │  CLOUDFLARE R2     │◄────────│  │  ├── WebSocket (Socket) │  │
      │  (logos + imágenes)│         │  │  └── Cron jobs          │  │
      │  10 GB gratis      │         │  └───────────┬─────────────┘  │
      │  Sin egress fees   │         │              │ localhost:5432  │
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

**Cambios respecto a la propuesta anterior:**
- `S3 + CloudFront` para el frontend → reemplazado por **Cloudflare Pages** (gratis permanente, CI/CD incluido)
- `S3` para imágenes → reemplazado por **Cloudflare R2** (10 GB gratis, sin cobro por transferencia de salida)
- `S3` para backups → se mantiene en **AWS S3** (pg_dump sigue siendo la estrategia)

---

## 2. Alternativas de despliegue evaluadas

Durante la Fase 3 se evaluaron todas las plataformas cloud relevantes para R Soft.
A continuación el análisis completo.

### 2.1 Plataformas candidatas — Resumen ejecutivo

| Plataforma | Backend NestJS | PostgreSQL | WebSockets | Costo base | Veredicto |
|---|---|---|---|---|---|
| **AWS (Stack A)** | ✅ EC2 | ✅ En EC2 | ✅ | ~$0 año 1 / ~$9/mes año 2 | ✅ **Recomendado producción** |
| **Fly.io + Neon (Stack B)** | ✅ VM | ✅ Gestionado | ✅ | $0 permanente | ✅ **Recomendado si AWS expira** |
| **Railway (Stack C)** | ✅ Nativo | ✅ Gestionado | ✅ | $5–7/mes | ✅ Válido, más simple |
| **Supabase + Fly.io (Stack D)** | ✅ Fly.io | ✅ Gestionado | ✅ Nativo | $0 dev / $25 prod | ⚠️ Sólo si se acepta lock-in |
| **Cloudflare Workers** | ❌ Incompatible | ❌ Sin PostgreSQL | ❌ | $0 | ❌ Solo frontend/CDN/DNS |
| **Vercel** | ❌ Sin WebSockets | ❌ No incluye DB | ❌ | $0–20/mes | ❌ Solo frontend |
| **Neon** | ❌ Solo DB | ✅ Serverless PG | ❌ | $0 | ✅ Complementario como DB |
| **Render** | ⚠️ Sleep en free | ⚠️ Expira 90 días | ✅ | $0–14/mes | ❌ Free tier inutilizable |

---

### 2.2 Análisis por plataforma

#### Supabase

Backend-as-a-Service sobre PostgreSQL. Ofrece DB, Auth, Storage, Realtime y Edge Functions.

| Recurso | Límite gratuito |
|---|---|
| Proyectos activos | 2 |
| PostgreSQL | 500 MB de datos |
| Auth (usuarios) | Ilimitados |
| Storage | 1 GB |
| Realtime (WebSockets) | 200 conexiones simultáneas |
| Ancho de banda | 5 GB/mes |
| **Pausa automática** | **Después de 1 semana sin uso** ⚠️ |

**Uso en R Soft:** Solo como capa de datos + auth; NestJS correría en Railway o Fly.io.

**Ventajas:** PostgreSQL gestionado, Realtime nativo, Row Level Security para multi-tenant, dashboard visual de datos.

**Desventajas:** Pausa automática en free tier (inaceptable en producción), 500 MB se llenan rápido con `audit_log` y `order_status_history`, Realtime usa protocolo propio (no Socket.io).

**Veredicto:** ✅ Excelente como base de datos en plan Pro ($25/mes). En free tier solo sirve para desarrollo.

---

#### Railway

PaaS que despliega contenedores directamente desde GitHub. Sin configurar servidores.

| Recurso | Plan Hobby ($5/mes fijo + uso) |
|---|---|
| NestJS | Despliega desde GitHub, siempre activo |
| PostgreSQL | Gestionado, backups automáticos |
| WebSockets | ✅ Soportados |
| Dominios custom | ✅ Gratis |
| SSL | ✅ Automático |
| CI/CD | ✅ Push = deploy automático |

**Costo estimado MVP (1 tenant):**

| Recurso | Costo/mes |
|---|---|
| NestJS Service | ~$3–5 |
| PostgreSQL | ~$1–2 |
| Egress ~2 GB | ~$0.10 |
| **Total** | **~$5–7/mes** |

**Ventajas:** El más simple de todos, CI/CD ya incluido, cero configuración de servidores, SSL y backups automáticos.

**Desventajas:** No es gratis después del trial ($5 de crédito inicial), menos control que EC2.

**Veredicto:** ✅ La opción más simple para el MVP. Por $5–7/mes tienes backend + DB + CI/CD sin configurar nada.

---

#### Render

PaaS similar a Railway con plan gratuito pero con limitaciones importantes.

| Recurso | Plan gratuito | Plan Individual |
|---|---|---|
| Web Services | Gratis — **sleep tras 15 min** ⚠️ | $7/mes |
| Static Sites | Gratis, sin sleep | Gratis |
| PostgreSQL | Gratis — **expira 90 días** ⚠️ | $7/mes |
| WebSockets | ✅ | ✅ |

**Problema crítico:** El sleep mode del plan gratuito corta las conexiones WebSocket. La vista de cocina en tiempo real no funciona.

**Costo si se usa plan pago:** Frontend gratis + NestJS $7/mes + PostgreSQL $7/mes = **$14/mes**.

**Veredicto:** ❌ Free tier inutilizable para producción. El plan pago a $14/mes es más caro que Railway por el mismo resultado.

---

#### Fly.io

Infraestructura de contenedores distribuida globalmente. Plan gratuito permanente (sin expiración de 12 meses).

| Recurso | Límite gratuito (permanente) |
|---|---|
| VMs | 3 VMs compartidas (256 MB RAM c/u) |
| Volúmenes | 3 GB total |
| Ancho de banda | 160 GB/mes salida |
| PostgreSQL (Fly Postgres) | ✅ Autogestionado en VM propia |
| SSL | ✅ Automático |
| WebSockets | ✅ Soportados |
| Sleep | ❌ No — siempre activo |

**Costo estimado MVP (1 tenant):**

| Recurso | Costo/mes |
|---|---|
| NestJS VM (256 MB) | $0 |
| PostgreSQL VM (256 MB) | $0 |
| Volumen DB (1 GB) | $0 |
| Egress ~2 GB | $0 |
| **Total** | **$0/mes permanente** |

> ⚠️ 256 MB RAM para NestJS es el límite. Si el proceso crece, upgrade a $1.94/mes por VM.

**Ventajas:** Genuinamente gratis sin expiración, VMs siempre activas, WebSockets funcionan perfectamente, múltiples regiones (puede estar cerca de Colombia).

**Desventajas:** 256 MB RAM puede ser insuficiente bajo carga, Fly Postgres es autogestionado (backups manuales), curva de aprendizaje media.

**Veredicto:** ✅ La mejor opción gratuita permanente para backend + WebSockets. Plan B ideal cuando el free tier de AWS expire.

---

#### Cloudflare (Pages + Workers + R2)

Plataforma edge distribuida. Frontend en Pages, backend en Workers (serverless), storage en R2.

**¿Puede ser el backend de R Soft?**

| Requisito R Soft | Cloudflare Workers | Compatible |
|---|---|---|
| NestJS (servidor HTTP) | Workers son serverless sin estado | ❌ |
| WebSockets (cocina) | Requiere Durable Objects ($$$) | ⚠️ |
| PostgreSQL (Prisma) | D1 es SQLite, no PostgreSQL | ❌ |
| Conexiones DB persistentes | No hay conexiones persistentes | ❌ |
| Socket.io | No funciona en Workers | ❌ |

**¿Dónde sí encaja en R Soft?**

| Uso | Plan | Costo |
|---|---|---|
| **Frontend Angular (Pages)** | Free | ✅ $0 permanente |
| **CDN del frontend** | Free | ✅ $0 incluido |
| **DNS autoritativo** | Free | ✅ $0 — ya decidido |
| **Storage imágenes (R2)** | Free (10 GB) | ✅ $0 — sin egress fees |
| **Proxy y protección DDoS** | Free | ✅ $0 |

**Veredicto:** ❌ Incompatible como backend. ✅ Perfecto para frontend, DNS, CDN y storage de imágenes. Cloudflare R2 reemplaza a S3 para imágenes (sin cobro por transferencia de salida).

---

#### Vercel

Plataforma para frontend y serverless functions. Optimizada para Next.js.

| Problema para R Soft | Detalle |
|---|---|
| WebSockets | ❌ No soportados en funciones serverless |
| PostgreSQL | ❌ No incluido |
| Uso comercial en Hobby | ❌ **Prohibido explícitamente** |
| NestJS real | ⚠️ Solo adaptable como función (sin estado) |

**Veredicto:** ❌ No sirve como backend. Para frontend, Cloudflare Pages es superior para Angular: más rápido, sin restricción de uso comercial y gratis.

---

#### Neon (PostgreSQL serverless)

PostgreSQL serverless que escala a cero. Plan gratuito permanente.

| Recurso | Límite gratuito |
|---|---|
| Proyectos | 1 |
| Almacenamiento | 0.5 GB |
| Cómputo | 191.9 horas/mes |
| Branches (git-like para DB) | 10 |
| Conexiones | Hasta 10,000 |

**Ventaja clave:** Branching de base de datos — crear ramas de la DB como si fueran ramas de Git. Ideal para probar migraciones sin riesgo.

**Uso en R Soft:** Complementario. Prisma se conecta igual que a PostgreSQL estándar, solo cambia `DATABASE_URL`.

**Veredicto:** ✅ Excelente complemento como PostgreSQL gratuito permanente, especialmente combinado con Fly.io.

---

## 3. Los cuatro stacks completos

### Stack A — AWS mejorado ⭐ Recomendado para producción

| Componente | Servicio | Costo/mes año 1 | Costo/mes año 2+ |
|---|---|---|---|
| Frontend | Cloudflare Pages | $0 | $0 |
| Backend NestJS | EC2 t2.micro + Nginx + PM2 | $0 | $8.63 |
| Base de datos | PostgreSQL en EC2 | $0 | $0 (incluido) |
| DNS + CDN + proxy | Cloudflare | $0 | $0 |
| SSL | Cloudflare + ACM | $0 | $0 |
| Storage imágenes | Cloudflare R2 (10 GB) | $0 | $0 |
| Backups | S3 + pg_dump | $0 | $0.01 |
| CI/CD | GitHub Actions | $0 | $0 |
| **Total** | | **~$0/mes** | **~$9/mes** |

**Pro:** Máximo control, precio mínimo post-free-tier, infraestructura profesional. 12 meses para validar sin gastar nada.

**Contra:** Free tier expira en 12 meses desde la creación de la cuenta. Configuración inicial más compleja.

---

### Stack B — Fly.io + Neon + Cloudflare ⭐ Plan B gratuito permanente

| Componente | Servicio | Costo/mes |
|---|---|---|
| Frontend | Cloudflare Pages | $0 |
| Backend NestJS | Fly.io (VM 256 MB) | $0 |
| Base de datos | Neon PostgreSQL (0.5 GB) | $0 |
| DNS + CDN + proxy | Cloudflare | $0 |
| SSL | Cloudflare + Fly.io | $0 |
| Storage imágenes | Cloudflare R2 (10 GB) | $0 |
| Backups | pg_dump → R2 (cron manual) | $0 |
| CI/CD | GitHub Actions | $0 |
| **Total** | | **$0/mes sin expiración** |

**Pro:** Gratis para siempre (no depende de los 12 meses de AWS). Stack moderno y sólido.

**Contra:** 256 MB RAM en Fly.io es ajustado bajo carga. Neon escala a cero (posible cold start en DB). Backups manuales.

**Cuándo migrar de A a B:** Cuando el free tier de EC2 expire y aún no haya revenue suficiente para pagar ~$9/mes.

---

### Stack C — Railway + Cloudflare — Opción simple de pago

| Componente | Servicio | Costo/mes |
|---|---|---|
| Frontend | Cloudflare Pages | $0 |
| Backend NestJS | Railway | ~$3–5 |
| Base de datos | Railway PostgreSQL | ~$1–2 |
| DNS + CDN + proxy | Cloudflare | $0 |
| SSL | Automático en Railway | $0 |
| Storage imágenes | Cloudflare R2 | $0 |
| Backups | Railway (automático) | $0 |
| CI/CD | Railway (automático desde GitHub) | $0 |
| **Total** | | **~$5–7/mes** |

**Pro:** El más simple. Push a GitHub = deploy. Backups, SSL y CI/CD sin configurar nada.

**Contra:** No es gratis. Menos control sobre el servidor.

**Cuándo elegir C sobre A/B:** Si el tiempo de configuración es un obstáculo o si se quiere lanzar lo más rápido posible sin gestionar servidores.

---

### Stack D — Supabase + Fly.io + Cloudflare — Híbrido BaaS

| Componente | Servicio | Costo/mes (dev) | Costo/mes (prod) |
|---|---|---|---|
| Frontend | Cloudflare Pages | $0 | $0 |
| Backend NestJS | Fly.io | $0 | $0 |
| Base de datos | Supabase PostgreSQL | $0 | $25 |
| Realtime (WebSockets) | Supabase Realtime | $0 | Incluido |
| Auth | Supabase Auth | $0 | Incluido |
| Storage | Supabase (1 GB) | $0 | Incluido |
| DNS + CDN | Cloudflare | $0 | $0 |
| **Total** | | **$0/mes** | **$25/mes** |

**Pro:** Supabase Realtime reemplaza Socket.io con menos código. Auth y storage incluidos. Dashboard visual para la DB. Branching de DB para desarrollo.

**Contra:** DB se pausa en free tier — requiere plan Pro ($25/mes) para producción. Mayor acoplamiento a Supabase (lock-in). El Realtime usa protocolo propio, no Socket.io estándar.

---

## 4. Tabla de decisión — Comparativa final

| Criterio | Stack A (AWS) | Stack B (Fly+Neon) | Stack C (Railway) | Stack D (Supabase) |
|---|---|---|---|---|
| Costo año 1 | $0 (free tier) | $0 permanente | $60–84 | $0–300 |
| Costo año 2+ | ~$9/mes | $0 permanente | $60–84 | $25+/mes |
| WebSockets | ✅ Completo | ✅ Completo | ✅ Completo | ✅ Nativo Supabase |
| PostgreSQL | ✅ Completo | ✅ (0.5 GB) | ✅ Gestionado | ✅ Gestionado |
| Complejidad setup | Alta | Media | Baja | Media |
| CI/CD incluido | ❌ GitHub Actions manual | ❌ GitHub Actions manual | ✅ Automático | ❌ Manual |
| Backups automáticos | ❌ Manual (pg_dump+cron) | ❌ Manual | ✅ Incluidos | ✅ Incluidos (Pro) |
| Control total | ✅ Máximo | ✅ Alto | ⚠️ Medio | ⚠️ Medio |
| Escalabilidad | ✅ Alta | ✅ Alta | ✅ Alta | ⚠️ Limitada por Supabase |
| Permanencia gratuita | ❌ 12 meses | ✅ Sin expiración | ❌ Pago | ❌ Pago en prod |
| Ideal para | Producción seria, escalar | MVP largo plazo gratis | Prototipo rápido | Prototipo con Realtime |

---

## 5. Hoja de ruta de despliegue recomendada

```
Hoy (mes 0)
└── Iniciar cuenta AWS → Arrancan los 12 meses de free tier
└── Configurar Stack A mejorado (EC2 + Cloudflare Pages + R2)
└── Desarrollar y validar el MVP con el primer tenant

Mes 8–10
└── Evaluar revenue vs infraestructura
└── Si hay tenants pagando → preparar migración a EC2 t3.small + RDS (post-free-tier)
└── Si no hay revenue → preparar migración a Stack B (Fly.io + Neon)

Mes 12 (free tier EC2 expira)
├── Opción A: Quedar en AWS → ~$9/mes (si hay ingresos suficientes)
├── Opción B: Migrar a Fly.io + Neon → $0/mes (si aún se está validando)
└── Opción C: Migrar a Railway → $5–7/mes (si se prioriza simplicidad)

Mes 18–24 (crecimiento)
└── 5-10 tenants → EC2 t3.small + RDS db.t3.micro (~$23/mes)
└── Punto de equilibrio: 3 tenants a $10/mes cubren toda la infraestructura
```

---

## 6. Stack tecnológico

### 6.1 Frontend

| Componente | Tecnología | Justificación |
|---|---|---|
| Framework | **Angular 18+** | Framework completo: routing, HTTP, forms, DI integrados. Estructura opinada. |
| Lenguaje | **TypeScript** | Nativo en Angular. Tipado fuerte, coherencia con el backend. |
| Estilos | **Tailwind CSS** | Utilidades atómicas, complementa PrimeNG para layouts y espaciado. |
| Componentes UI | **PrimeNG** | +80 componentes listos: tablas, calendarios, menús, diálogos, charts, etc. |
| Iconos | **PrimeIcons** | Integrados con PrimeNG. +200 iconos SVG incluidos. |
| Tema | **Aura (PrimeNG)** | Tema moderno, personalizable con CSS variables. |
| Estado global | **Angular Signals + Services** | Reactivo, nativo de Angular 18+, sin dependencias externas. |
| HTTP client | **HttpClient (integrado)** | Interceptores para JWT, manejo centralizado de errores con RxJS. |
| WebSocket client | **ngx-socket-io** | Wrapper de Socket.io para Angular con observables. |
| Routing | **Angular Router (integrado)** | Lazy loading de módulos, guards de ruta por rol. |
| Forms | **Reactive Forms (integrado)** | Validaciones tipadas, control granular, integración con PrimeNG. |
| Tablas | **PrimeNG p-table** | Paginación server-side, filtrado, sorting, edición inline, exportación. |
| Gráficas | **PrimeNG Charts (wrapper Chart.js)** | Integrado con PrimeNG, line/bar/pie/doughnut para reportes. |
| Hosting | **Cloudflare Pages** | CI/CD automático desde GitHub, gratis permanente, sin sleep mode. |

### 6.2 Backend

| Componente | Tecnología | Justificación |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Estable, soporte largo, async I/O ideal para API + WebSockets. |
| Framework | **NestJS** | Estructura modular, DI, decoradores. Filosofía similar a Angular. |
| Lenguaje | **TypeScript** | Mismo lenguaje que el frontend, stack unificado. |
| ORM | **Prisma** | Esquema declarativo, migraciones, type-safe queries, excelente DX. |
| Autenticación | **JWT (jsonwebtoken)** | Access token (15 min) + Refresh token (7 días). Sin Cognito = cero costo. |
| Hash passwords | **bcrypt** | Estándar para hashing de contraseñas. |
| Validación | **class-validator + class-transformer** | DTOs validados en cada endpoint. |
| WebSockets | **Socket.io (vía NestJS Gateway)** | Eventos en tiempo real para cocina, meseros, cambios de estado. |
| Tareas programadas | **@nestjs/schedule (cron)** | Reportes, alertas de stock, limpieza. Mismo proceso, sin Lambda. |
| Emails | **@aws-sdk/client-ses** | Integración directa con SES desde el EC2. |
| File upload | **@aws-sdk/client-s3 + multer** | Subir logos e imágenes (destino: Cloudflare R2 vía API S3-compatible). |
| Logging | **Pino (vía nestjs-pino)** | Logs estructurados JSON, rápido, compatible con CloudWatch. |
| API docs | **Swagger (@nestjs/swagger)** | Documentación automática de endpoints. |
| Rate limiting | **@nestjs/throttler** | Protección básica contra abuso. |

> 💡 **Cloudflare R2 es compatible con la API de S3.** El backend usa `@aws-sdk/client-s3` apuntando al endpoint de R2 — sin cambiar el código si en el futuro se migra de vuelta a S3.

### 6.3 Base de datos

| Componente | Tecnología | Justificación |
|---|---|---|
| Motor | **PostgreSQL 16** | Relacional, robusto, JSONB para metadata, ideal para modelo multi-tenant. |
| Instalación | Directamente en el EC2 | Un solo tenant, ahorra el free tier de RDS para el futuro. |
| Migraciones | **Prisma Migrate** | Versionado del esquema, reproducible, integrado con el ORM. |
| Backups | **pg_dump + cron + S3** | Backup diario automático a S3 (dentro del free tier). |

---

## 7. Infraestructura AWS — Detalle Stack A

### 7.1 EC2 — Servidor principal

| Parámetro | Valor |
|---|---|
| Tipo de instancia | `t2.micro` (1 vCPU, 1 GB RAM) |
| AMI | Amazon Linux 2023 (x86_64, minimal) |
| Región | `us-east-1` (Virginia) — mayor cobertura de free tier |
| Availability Zone | Una sola AZ (ej: `us-east-1a`) — evita data transfer entre AZ |
| EBS volumen | 20 GB gp2 (free tier permite hasta 30 GB) |
| Elastic IP | 1 (gratis mientras esté asociada a instancia corriendo) |
| Key Pair | ED25519 para SSH |

**Software instalado en el EC2:**

```
Amazon Linux 2023
├── Node.js 20 LTS (via nvm)
├── PostgreSQL 16 (via dnf)
├── Nginx (reverse proxy + SSL termination)
├── PM2 (process manager para NestJS)
└── AWS CLI v2 (para scripts de backup a S3)
```

### 7.2 Security Groups — `rsoft-ec2-sg`

| Tipo | Protocolo | Puerto | Origen | Propósito |
|---|---|---|---|---|
| Inbound | TCP | 22 | Tu IP fija/rango | SSH administración |
| Inbound | TCP | 80 | 0.0.0.0/0 | HTTP (redirige a HTTPS) |
| Inbound | TCP | 443 | 0.0.0.0/0 | HTTPS (Nginx → NestJS) |
| Outbound | All | All | 0.0.0.0/0 | Salida (SES, S3, R2, updates, etc.) |

> ⚠️ PostgreSQL (5432) **NO** se expone a internet. Solo escucha en `localhost`.

### 7.3 Nginx — Reverse proxy

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

### 7.4 S3 — Buckets (solo backups)

| Bucket | Propósito | Acceso | Tamaño est. |
|---|---|---|---|
| `rsoft-backups-{id}` | pg_dump diario (retención 30 días) | Privado | ~500 MB |

> Los logos e imágenes de productos van a **Cloudflare R2**, no a S3.

### 7.5 Cloudflare R2 — Storage de imágenes

| Parámetro | Valor |
|---|---|
| Bucket | `rsoft-uploads` |
| Free tier | 10 GB almacenamiento, 1M operaciones clase A/mes, 10M clase B/mes |
| Egress | **$0** (sin cobro por transferencia de salida — ventaja clave vs S3) |
| API | Compatible con S3 — mismo SDK en el backend |
| Acceso público | URL pública para imágenes de productos |

### 7.6 SES

| Parámetro | Valor |
|---|---|
| Región | `us-east-1` |
| Uso | Reset contraseña, alertas stock, resúmenes diarios |
| Free tier | 62,000 emails/mes desde EC2 (siempre gratis) |
| Uso estimado | ~100 emails/mes |

> SES inicia en **sandbox** (solo emails verificados). Solicitar salida del sandbox antes de producción.

### 7.7 CloudWatch

| Recurso | Configuración |
|---|---|
| Log group | `/rsoft/api` — retención 7 días |
| Alarma 1 | CPU EC2 > 80% por 5 min → email |
| Alarma 2 | Disco EC2 > 80% → email |
| Alarma 3 | Billing > $1 USD → email |

### 7.8 IAM Role para EC2 — `rsoft-ec2-role`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::rsoft-backups-*",
        "arn:aws:s3:::rsoft-backups-*/*"
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

---

## 8. DNS — Cloudflare (gratuito)

### 8.1 ¿Por qué Cloudflare y no Route 53?

| Característica | Route 53 | Cloudflare Free |
|---|---|---|
| DNS autoritativo | $0.50/mes por zona | Gratis |
| Queries DNS | $0.40/millón | Ilimitadas gratis |
| Protección DDoS | No incluida | Incluida |
| SSL edge | No incluido | Incluido |
| Proxy/CDN básico | No incluido | Incluido |
| WAF básico | No incluido | 5 reglas gratis |
| Frontend hosting | No | Pages — gratis con CI/CD |
| Storage S3-compat. | No | R2 — 10 GB gratis sin egress |

### 8.2 Registros DNS

| # | Tipo | Nombre | Valor | Proxy | Propósito |
|---|---|---|---|---|---|
| 1 | A | `api` | `<Elastic IP del EC2>` | 🟠 ON | API + WebSockets |
| 2 | CNAME | `app` | `<proyecto>.pages.dev` | ⚪ OFF | Frontend SPA (Cloudflare Pages) |
| 3 | TXT | `_amazonses` | `<token verificación>` | ⚪ OFF | Verificar SES |

### 8.3 SSL/TLS

```
[Navegador] ──HTTPS──► [Cloudflare] ──HTTPS──► [EC2 Nginx]
                        (Origin Cert gratis,
                         válido 15 años)

[Navegador] ──HTTPS──► [Cloudflare Pages] (Angular SPA — gratis)

[Backend] ──HTTPS──► [Cloudflare R2] (imágenes — gratis)
```

---

## 9. Cloudflare Pages — Hosting del frontend

### 9.1 Configuración

| Parámetro | Valor |
|---|---|
| Tipo | Static site (Angular SPA) |
| Fuente | Repositorio GitHub |
| Build command | `ng build --configuration production` |
| Output directory | `dist/rsoft/browser` |
| Dominio custom | `app.rsoft.com` |
| SSL | ✅ Automático |
| CI/CD | ✅ Automático en cada push a `main` |
| Preview deployments | ✅ Por cada Pull Request |
| Ancho de banda | Ilimitado |
| Requests | Ilimitadas |
| Costo | **$0 permanente** |

### 9.2 Ventajas sobre S3 + CloudFront

| Característica | S3 + CloudFront (anterior) | Cloudflare Pages (nuevo) |
|---|---|---|
| CI/CD | ❌ Manual (GitHub Actions + AWS) | ✅ Automático incluido |
| Preview por PR | ❌ No | ✅ Sí |
| Costo año 2+ | ~$0.20/mes | $0 permanente |
| Configuración | Media | Mínima |
| Invalidación de caché | Manual | Automática en deploy |

---

## 10. Flujos de red

### 10.1 Usuario abre la app

```
1. https://app.rsoft.com
2. DNS → Cloudflare Pages (CNAME)
3. Cloudflare Pages sirve el bundle Angular directamente
4. Angular SPA carga en el navegador
5. Angular llama a https://api.rsoft.com/api/v1/*
```

### 10.2 Llamada a la API

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

### 10.3 WebSocket

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

### 10.4 Upload de imagen (logo / producto)

```
1. Frontend: POST /api/v1/uploads (multipart)
2. NestJS + multer → procesa el archivo
3. @aws-sdk/client-s3 → PutObject → Cloudflare R2 endpoint
4. R2 almacena el archivo, retorna URL pública
5. NestJS guarda la URL en PostgreSQL (product.image / tenant.logo)
```

### 10.5 Backup automático (3:00 AM)

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

---

## 11. Estructura del proyecto

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
│   │   └── deploy-api.sh
│   └── nginx/
│       └── rsoft-api.conf
│
├── .github/
│   └── workflows/
│       └── deploy-api.yml             # Solo backend — frontend lo maneja Cloudflare Pages
│
├── docker-compose.dev.yml             # PostgreSQL local para desarrollo
├── .env.example
└── README.md
```

---

## 12. Entorno de desarrollo local

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

---

## 13. Costos — Tres escenarios detallados

### Tipos de Free Tier en AWS

| Tipo | Duración | Ejemplos |
|---|---|---|
| **12 meses gratis** | Desde que creas la cuenta AWS | EC2, EBS, S3, RDS |
| **Siempre gratis** | Sin expiración, para siempre | Lambda (1M req), SES (62K), CloudWatch, ACM |
| **Prueba corta** | 30-90 días según servicio | Lightsail (3 meses) |

> ⚠️ Los 12 meses empiezan cuando **creas la cuenta AWS**, no cuando activas cada servicio.

---

### 13.1 Año 1 — Free Tier activo (Stack A — 1 tenant, MVP)

| Servicio | Límite Free Tier (12 meses) | Uso estimado | Costo/mes |
|---|---|---|---|
| EC2 t2.micro | 750 hrs/mes | 744 hrs (24/7) | $0.00 |
| EBS 20 GB gp2 | 30 GB | 20 GB | $0.00 |
| Elastic IP | 1 gratis (asociada a EC2) | 1 | $0.00 |
| S3 (solo backups) | 5 GB | ~500 MB | $0.00 |
| S3 requests | 20K GET + 2K PUT | ~500 PUT | $0.00 |
| ACM certificado | ∞ (siempre gratis) | 1 | $0.00 |
| SES emails | 62,000/mes desde EC2 (∞) | ~100 | $0.00 |
| CloudWatch logs | 5 GB ingesta (∞) | ~500 MB | $0.00 |
| CloudWatch alarmas | 10 alarmas (∞) | 3 | $0.00 |
| Cloudflare (DNS + Pages + R2) | ∞ gratis | Todo | $0.00 |
| **Dominio .com** | No aplica | 1 | **~$1.00** |
| **Total mensual** | | | **~$1** |
| **Total Año 1** | | | **~$12** |

---

### 13.2 Año 2+ — Free Tier expirado (Stack A — misma infraestructura)

| Servicio | Precio bajo demanda | Uso estimado | Costo/mes |
|---|---|---|---|
| EC2 t2.micro | $0.0116/hr | 744 hrs | **$8.63** |
| EBS 20 GB gp2 | $0.10/GB-mes | 20 GB | **$2.00** |
| Elastic IP | $0.005/hr | 744 hrs | **$3.72** |
| S3 (backups) | $0.023/GB-mes | ~1 GB | **$0.02** |
| ACM, SES, CloudWatch | ∞ gratis | OK | $0.00 |
| Cloudflare (DNS + Pages + R2) | ∞ gratis | OK | $0.00 |
| Dominio | | 1 | ~$1.00 |
| **Total mensual** | | | **~$9/mes** |
| **Total anual** | | | **~$108** |

> 💡 Si ~$9/mes parece mucho antes de tener revenue, migrar al Stack B (Fly.io + Neon) a $0/mes. La arquitectura del código es idéntica.

---

### 13.3 Alternativa post-free-tier: AWS Lightsail $5/mes

| Plan Lightsail | vCPU | RAM | SSD | Transfer | IP estática | Costo/mes |
|---|---|---|---|---|---|---|
| Nano | 2 | 512 MB | 20 GB | 1 TB | Incluida | $3.50 |
| Micro | 2 | 1 GB | 40 GB | 2 TB | Incluida | **$5.00** |
| Small | 2 | 2 GB | 60 GB | 3 TB | Incluida | $10.00 |

Para 1 tenant el plan **Micro ($5/mes)** cubre perfectamente con precio fijo.

---

### 13.4 Multi-tenant — Crecimiento a N negocios

#### Escenario A: 5-10 tenants (~30-80 usuarios concurrentes)

| Servicio | Especificación | Costo/mes |
|---|---|---|
| EC2 t3.small | 2 vCPU, 2 GB RAM | **$15.18** |
| EBS 30 GB gp3 | $0.08/GB-mes | **$2.40** |
| Elastic IP | $0.005/hr | **$3.72** |
| RDS db.t3.micro | Free tier propio¹ | **$0.00** |
| Cloudflare (Pages + R2 + DNS) | ∞ gratis | $0.00 |
| S3 backups | ~5 GB | **$0.12** |
| SES, CloudWatch | ∞ gratis | $0.00 |
| Dominio | | ~$1.00 |
| **Total mensual** | | **~$22/mes** |

> ¹ RDS tiene su propio free tier de 12 meses desde que se activa por primera vez. Al activarlo en el año 2, se obtienen otros 12 meses gratis. Después: ~$12.41/mes (db.t3.micro on-demand).

#### Escenario B: 50+ tenants (~200+ usuarios concurrentes)

| Servicio | Especificación | Costo/mes |
|---|---|---|
| EC2 t3.medium | 2 vCPU, 4 GB RAM | **$30.37** |
| EBS 50 GB gp3 | $0.08/GB-mes | **$4.00** |
| Elastic IP | $0.005/hr | **$3.72** |
| RDS db.t3.small | 2 vCPU, 2 GB RAM | **$24.82** |
| RDS storage 50 GB | $0.115/GB-mes | **$5.75** |
| Cloudflare (Pages + R2 + DNS) | ∞ gratis | $0.00 |
| S3 backups | ~10 GB | **$0.23** |
| CloudWatch extras | ~3 GB sobre límite | **$1.50** |
| Dominio | | ~$1.00 |
| **Total mensual** | | **~$71/mes** |

#### Resumen comparativo

| Escenario | Tenants | Usuarios | Costo/mes | Costo/año |
|---|---|---|---|---|
| Año 1 — Free Tier (Stack A) | 1 | 5-8 | ~$1 | ~$12 |
| Año 2+ — Stack A | 1 | 5-8 | ~$9 | ~$108 |
| Año 2+ — Stack B (Fly+Neon) | 1 | 5-8 | $0 | $0 |
| Año 2+ — Stack C (Railway) | 1 | 5-8 | ~$7 | ~$84 |
| Año 2+ — Lightsail (alternativa) | 1 | 5-8 | ~$5 | ~$60 |
| Crecimiento — 5 a 10 tenants | 5-10 | 30-80 | ~$22 | ~$264 |
| Crecimiento — 50+ tenants | 50+ | 200+ | ~$71 | ~$852 |

#### Punto de equilibrio (rentabilidad)

| Precio por tenant | Tenants para cubrir $22/mes | Tenants para cubrir $71/mes |
|---|---|---|
| $10 USD/mes | 3 tenants | 8 tenants |
| $20 USD/mes | 2 tenants | 4 tenants |
| $50 USD/mes | 1 tenant | 2 tenants |

---

## 14. Alertas de riesgo — Trampas de costos

| ⚠️ Trampa | Costo potencial | Cómo evitarla |
|---|---|---|
| NAT Gateway | $32/mes mínimo | No usar. EC2 en subnet pública con IP elástica. |
| Elastic IP sin asociar | $3.65/mes | Siempre asociar. Liberar si no usas. |
| RDS durante el MVP | Quema free tier 12m | PostgreSQL en EC2. Guardar RDS para crecer. |
| Data transfer entre AZs | $0.01/GB | Todo en una sola AZ. |
| ALB / ELB | ~$16/mes | Nginx en el EC2 reemplaza al ALB. |
| CloudWatch logs excesivos | $0.50/GB sobre 5 GB | Retención 7 días, log level `warn` en prod. |
| Route 53 | $0.50/mes por zona | Usar Cloudflare (gratis). |
| EBS snapshots | $0.05/GB-mes | pg_dump + S3 en vez de snapshots EBS. |
| S3 egress para imágenes | $0.09/GB | Usar Cloudflare R2 (egress gratis). |
| Elastic IP post-2024 | $3.72/mes | Considerar Lightsail o Fly.io post-free-tier. |
| Cognito | Complejidad y costo | JWT propio. Suficiente para el MVP. |
| Vercel en producción comercial | Prohibido en Hobby | Usar Cloudflare Pages (gratis, sin restricción). |

---

## 15. Registro de decisiones — Fase 3

| # | Fecha | Decisión | Justificación |
|---|---|---|---|
| D-25 | 2026-05-18 | EC2 monolito (no Lambda) para MVP | Evita RDS Proxy ($15/mes), simplifica WebSockets |
| D-26 | 2026-05-18 | PostgreSQL en EC2 (no RDS) | Preserva free tier de RDS para crecimiento futuro |
| D-27 | 2026-05-18 | Cloudflare como DNS (no Route 53) | Route 53 cobra $0.50/mes. Cloudflare es gratis |
| D-28 | 2026-05-18 | Frontend: Angular 18+ + PrimeNG + Tailwind | Framework completo, +80 componentes UI |
| D-29 | 2026-05-18 | Backend: NestJS + TypeScript + Prisma | Modular, tipado, ORM declarativo, misma filosofía Angular |
| D-30 | 2026-05-18 | JWT propio (no Cognito) | Cero costo, control total, suficiente para MVP |
| D-31 | 2026-05-18 | WebSockets: Socket.io vía NestJS Gateway | Nativo, sin API Gateway WebSocket, sin DynamoDB |
| D-32 | 2026-05-18 | SSL: Cloudflare Origin Cert (API) + Cloudflare Pages (frontend) | Gratis en ambos casos, cifrado extremo a extremo |
| D-33 | 2026-05-18 | Backups: pg_dump + cron + S3 (retención 30 días) | Simple, dentro del free tier, protege los datos |
| D-34 | 2026-05-18 | Región: us-east-1 | Mayor cobertura de servicios free tier |
| D-35 | 2026-05-18 | Todo en una sola AZ | Evita costos de data transfer entre AZs |
| D-36 | 2026-05-18 | Nginx como reverse proxy | Evita ALB ($16/mes), maneja SSL y WebSocket |
| D-37 | 2026-05-18 | Post-free-tier: evaluar Stack B (Fly.io + Neon) | Gratis permanente si aún no hay revenue |
| D-38 | 2026-05-18 | Multi-tenant: migrar DB a RDS al crecer | Separa cómputo de datos, usa free tier guardado |
| D-39 | 2026-05-19 | Frontend hosting: Cloudflare Pages (reemplaza S3+CloudFront) | Gratis permanente, CI/CD automático, preview por PR |
| D-40 | 2026-05-19 | Storage de imágenes: Cloudflare R2 (reemplaza S3 para uploads) | 10 GB gratis, sin egress fees, API compatible con S3 |
| D-41 | 2026-05-19 | Plan B confirmado: Fly.io + Neon si AWS free tier expira sin revenue | Migración directa, arquitectura NestJS+Prisma idéntica |
| D-42 | 2026-05-19 | Vercel descartado | Uso comercial prohibido en Hobby, sin WebSockets, sin DB |
| D-43 | 2026-05-19 | Render descartado para producción | Sleep mode en free tier incompatible con WebSockets |
| D-44 | 2026-05-19 | Cloudflare Workers descartado como backend | Incompatible con NestJS, PostgreSQL y Socket.io |
| D-45 | 2026-05-19 | Supabase válido solo como complemento (no principal) | Pausa en free tier inaceptable en producción |
