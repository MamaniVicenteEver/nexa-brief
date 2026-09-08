#!/usr/bin/env sh
# Reconstruye la imagen elegida y recrea únicamente su contenedor.
# Redis, los volúmenes persistentes y el servicio no seleccionado no se tocan.
# Si el modo local ocupa 4000/3000, se puede ejecutar con SERVER_PORT=4001
# WEB_PORT=3001 NEXT_PUBLIC_API_URL=http://localhost:4001.
set -eu

usage() {
  cat <<'EOF'
Uso: ./scripts/rebuild-app-images.sh [web|server|all] [--no-cache]

Destinos:
  web       reconstruye y actualiza solamente el frontend.
  server    reconstruye y actualiza solamente el backend/worker.
  all       reconstruye y actualiza frontend y backend (valor por defecto).

Opciones:
  --no-cache  ignora el caché de Docker durante el build.
  -h, --help  muestra esta ayuda.
EOF
}

target="all"
target_was_set="false"
no_cache="false"

for argument in "$@"; do
  case "$argument" in
    web|server|all)
      if [ "$target_was_set" = "true" ]; then
        echo "Solo se puede indicar un destino: web, server o all." >&2
        exit 64
      fi
      target="$argument"
      target_was_set="true"
      ;;
    --no-cache)
      no_cache="true"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argumento no válido: $argument" >&2
      usage >&2
      exit 64
      ;;
  esac
done

docker compose config --quiet

build_target() {
  if [ "$no_cache" = "true" ]; then
    docker compose build --no-cache "$1"
  else
    docker compose build "$1"
  fi
}

case "$target" in
  web)
    services="web"
    ;;
  server)
    services="server"
    ;;
  all)
    services="server web"
    ;;
esac

echo "Reconstruyendo: $services"
for service in $services; do
  build_target "$service"
done

echo "Actualizando contenedor(es): $services"
docker compose up -d --force-recreate $services
docker compose ps $services

echo "OK: imágenes y contenedores actualizados: $services."
