#!/bin/bash
# Uso: ./scripts/dev.sh [local|cloud]
# local → http://localhost:4200  |  cloud → túneles Cloudflare

MODE=${1:-local}
# El script vive en scripts/; ROOT es el directorio padre (raíz del workspace)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  echo ""
  echo "Deteniendo servicios..."
  kill $(jobs -p) 2>/dev/null
  pkill -f cloudflared 2>/dev/null
  exit 0
}
trap cleanup INT TERM

# Liberar puertos si estaban ocupados
lsof -ti:3000,4200 | xargs kill -9 2>/dev/null || true
pkill -f cloudflared 2>/dev/null || true
sleep 1

echo "Modo: $MODE"
echo ""

ENV_FILE="$ROOT/dewan-frontend/environments/environment.ts"

# Parchear environment.ts según el modo
if [ "$MODE" = "local" ]; then
  cat > "$ENV_FILE" <<'EOF'
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/v1',
};
EOF
  echo "environment.ts → http://localhost:3000/v1"
fi

# Arrancar backend
(cd "$ROOT/dewan-backend" && npm run "start:$MODE" > /tmp/dewan-backend.log 2>&1) &

# Arrancar frontend
(cd "$ROOT/dewan-frontend" && npm run "start:$MODE" > /tmp/dewan-frontend.log 2>&1) &

# Esperar backend
echo -n "Backend  "
until grep -q "Nest application successfully started" /tmp/dewan-backend.log 2>/dev/null; do
  sleep 1; echo -n "."
done
echo " listo"

# Esperar frontend
echo -n "Frontend "
until curl -s http://localhost:4200 > /dev/null 2>&1; do
  sleep 1; echo -n "."
done
echo " listo"

if [ "$MODE" = "cloud" ]; then
  echo ""
  echo "Iniciando túneles Cloudflare..."
  cloudflared tunnel --url http://localhost:3000 --no-autoupdate > /tmp/cf-backend.log 2>&1 &
  cloudflared tunnel --url http://localhost:4200 --no-autoupdate > /tmp/cf-frontend.log 2>&1 &

  # Esperar URLs
  for i in $(seq 1 30); do
    BACK_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-backend.log 2>/dev/null | head -1)
    FRONT_URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cf-frontend.log 2>/dev/null | head -1)
    [ -n "$BACK_URL" ] && [ -n "$FRONT_URL" ] && break
    sleep 1
  done

  # Parchear environment.ts con la URL real del backend
  cat > "$ENV_FILE" <<EOF
export const environment = {
  production: false,
  apiUrl: '$BACK_URL/v1',
};
EOF
  echo "environment.ts → $BACK_URL/v1"

  echo ""
  echo "================================================"
  echo "  FRONTEND  $FRONT_URL"
  echo "  BACKEND   $BACK_URL"
  echo "================================================"
else
  echo ""
  echo "================================================"
  echo "  FRONTEND  http://localhost:4200"
  echo "  BACKEND   http://localhost:3000"
  echo "================================================"
fi

echo ""
echo "Ctrl+C para detener todo"
wait
