# Retención de imágenes Docker

`make docker-build`, `scripts/docker-refresh.sh --build|--restart|--fresh` y `make docker-verify` ejecutan la limpieza después de una compilación exitosa; las variantes que recrean servicios la ejecutan después del arranque, y la verificación después de sus comprobaciones. El proceso elimina imágenes etiquetadas del proyecto Nexa anteriores a `latest` o sin etiqueta solo cuando ninguna etiqueta ajena ni ningún contenedor (incluido detenido o descendiente) las protege. Conserva las imágenes `latest` y usa `docker image rm` sin forzar; la limpieza no elimina contenedores ni volúmenes.

También ejecuta `docker builder prune --all --force --keep-storage 5GB`. La caché es compartida por todos los proyectos Docker: pueden ralentizarse compilaciones posteriores. Cinco GB es un objetivo para la caché, no un límite garantizado cuando hay datos protegidos o en uso. Invocar `docker compose build` o `docker compose up --build` directamente omite esta política; usa los comandos de arriba. Las imágenes de rollback explícitas dejan de estar disponibles si no están protegidas por contenedores o etiquetas ajenas.

La eliminación de la copia duplicada de `.venv` en el Dockerfile se aplicará en la siguiente compilación; no cambia la imagen ni los contenedores actuales.
