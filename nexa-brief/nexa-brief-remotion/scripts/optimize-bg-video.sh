#!/usr/bin/env bash
# Genera copias más livianas de test/bg-video.mp4 para probar si decodificar
# MENOS píxeles por frame (no más — escalar hacia ARRIBA empeora, no ayuda)
# baja el tiempo de render de NeonLetrasVideo. No pisa el original.
#
# No corre ningún render/benchmark — solo prepara los archivos. Los comandos
# para probarlos están al final (usan --props para no tocar código).
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=test/bg-video.mp4
[ -f "$SRC" ] || { echo "No existe $SRC"; exit 1; }

echo "=== Generando test/bg-video-540p.mp4 (960x540, mismos 30fps) ==="
ffmpeg -y -i "$SRC" -vf scale=960:540 -c:v libx264 -preset veryfast -crf 20 -an test/bg-video-540p.mp4

echo "=== Generando test/bg-video-540p-15fps.mp4 (960x540, 15fps) ==="
ffmpeg -y -i "$SRC" -vf scale=960:540,fps=15 -c:v libx264 -preset veryfast -crf 20 -an test/bg-video-540p-15fps.mp4

echo "=== Listo. Tamaños: ==="
ls -lh test/bg-video*.mp4

cat <<'EOF'

=== Para probar cada variante con el benchmark rápido (30s de muestra) ===

# Baseline (720p, 30fps, la que ya tenés):
npx remotion benchmark index.js NeonLetrasVideo --concurrencies=2 --runs=1 --duration=900 --every-nth-frame=3 --codec=h264 --crf=23

# 540p, 30fps:
npx remotion benchmark index.js NeonLetrasVideo --concurrencies=2 --runs=1 --duration=900 --every-nth-frame=3 --codec=h264 --crf=23 --props='{"bgVideo":"bg-video-540p.mp4"}'

# 540p, 15fps:
npx remotion benchmark index.js NeonLetrasVideo --concurrencies=2 --runs=1 --duration=900 --every-nth-frame=3 --codec=h264 --crf=23 --props='{"bgVideo":"bg-video-540p-15fps.mp4"}'

Comparando los 3 tiempos vas a saber si vale la pena, y cuánto, antes de
comprometerte a un render completo con la variante que gane.
EOF
