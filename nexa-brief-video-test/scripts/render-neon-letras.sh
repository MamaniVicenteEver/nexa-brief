#!/usr/bin/env bash
# Render de la composición "NeonLetras" (video-lírico real, test/index.html
# portado a Remotion): dura exactamente lo que dura song.mp3 (251.57s a 30fps
# = 7547 frames), con audio incluido.
#   - fps 30, crf 18, h264: misma base que StressTest, para comparar en
#     igualdad de condiciones.
#   - concurrency=2: aunque hay menos elementos por frame que en StressTest
#     (≤26 palabras vs 40 partículas), cada palabra puede llevar hasta 3
#     drop-shadow encadenados (glow neón), que son más caros de rasterizar
#     que un box-shadow simple. Se arranca en 2 para no arriesgar el mismo
#     equipo que ya tiene ~21GB de RAM en uso por otros programas; si el
#     render va sobrado (revisar htop mientras corre) se puede subir a 3.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p out
echo "=== NeonLetras: iniciando render ($(date '+%H:%M:%S')) ==="
time npx remotion render index.js NeonLetras out/neon-letras.mp4 \
  --concurrency=2 \
  --codec=h264 \
  --crf=18 \
  --overwrite
echo "=== NeonLetras: listo -> out/neon-letras.mp4 ==="
