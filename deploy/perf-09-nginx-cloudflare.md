# PERF-09 — Caché de assets en Nginx y Cloudflare

> Última actualización: 2026-06-27  
> Prerequisito: PERF-01 ya implementado (compression en NestJS)  
> Tiempo estimado: ~15 min

---

## Parte A — Cloudflare Dashboard (5 min)

Entrar a [dash.cloudflare.com](https://dash.cloudflare.com) → dominio **getdewan.com**.

### A1. Habilitar Brotli

**Speed → Optimization → Content Optimization → Brotli → ON**

Brotli comprime ~15–20% mejor que gzip entre el usuario y Cloudflare (el tramo hasta el Droplet sigue siendo gzip de NestJS).

### A2. Habilitar Auto Minify

**Speed → Optimization → Content Optimization → Auto Minify**

Marcar las tres casillas: ✅ HTML ✅ CSS ✅ JS

### A3. Verificar caché de assets del frontend

Los chunks de Angular tienen hash en el nombre (`chunk-KGE6GRIR.js`), así que Cloudflare Pages los sirve con `Cache-Control: public, max-age=31536000, immutable` automáticamente.

Confirmar que no hay una regla custom que lo anule:

**Caching → Cache Rules** — verificar que ninguna regla baja el `max-age` de activos en `app.getdewan.com`

### A4. Verificar caché de index.html

Cloudflare Pages sirve `index.html` con `Cache-Control: public, max-age=0, must-revalidate` por defecto (correcto). Si existe una regla que lo cachea más, eliminarla.

---

## Parte B — Nginx en el Droplet (10 min)

```bash
ssh dewan@<tu-reserved-ip>
```

### B1. Activar gzip en nginx.conf

```bash
sudo nano /etc/nginx/nginx.conf
```

Dentro del bloque `http { }`, después de las líneas `limit_req_zone`:

```nginx
# PERF-09: Gzip para contenido text/*
# La API ya comprime a nivel app (compression middleware), esto cubre edge cases
gzip on;
gzip_vary on;
gzip_proxied expired no-cache no-store private auth;
gzip_min_length 1024;
gzip_types
    text/plain text/css text/xml text/javascript
    application/json application/javascript application/xml
    application/rss+xml font/woff2 image/svg+xml;
```

### B2. Caché de activos estáticos en el virtual host

```bash
sudo nano /etc/nginx/sites-available/dewan-api
```

Dentro del bloque `server { listen 443 ... }`, agregar **antes** del bloque `location /socket.io/`:

```nginx
    # PERF-09: Cache inmutable para activos estáticos (woff2, imágenes, etc.)
    # El backend actual no sirve estáticos, pero este bloque cubre /v1/static/ futuro.
    location ~* \.(woff2|woff|ttf|js|css|png|webp|jpg|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://nestjs;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
```

### B3. Verificar y recargar

```bash
sudo nginx -t
# Debe mostrar: syntax is ok / test is successful

sudo systemctl reload nginx
```

### B4. Verificar que gzip está activo

```bash
# Reemplazar <token> con un JWT válido de producción
curl -I \
  -H "Accept-Encoding: gzip" \
  -H "Authorization: Bearer <token>" \
  https://api.getdewan.com/v1/units | grep -i "content-encoding"
# Esperado: content-encoding: gzip
```

---

## Resumen de impacto

| Acción | Impacto | Tiempo |
|---|---|---|
| Brotli (Cloudflare) | ~15% adicional sobre gzip en chunks Angular | 1 min |
| Auto Minify (Cloudflare) | Reduce HTML/CSS/JS sin hash ~5–15% | 1 min |
| Verificar caché assets (Cloudflare) | Confirma que chunks JS no se re-descargan por visita | 2 min |
| Gzip en Nginx | Capa extra; NestJS ya hace gzip (PERF-01) | 5 min |

---

## Notas

- El `nginx -t` valida la config antes de aplicar — nunca hace reload sin pasar el test.
- Si aparece error `duplicate header "Cache-Control"` al agregar el `add_header` en Nginx, agregar `proxy_hide_header Cache-Control;` justo antes del `add_header` en ese bloque.
- PERF-10 (WebSocket singleton) ya fue implementado en SPEC-20.
