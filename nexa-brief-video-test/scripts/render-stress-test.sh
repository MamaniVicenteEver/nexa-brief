#!/usr/bin/env bash
# Re-render de la composición "StressTest" (partículas + texto neón, 5 min a
# 30fps = 9000 frames) con la config ya validada por el usuario:
#   - fps 30 (no 60): la mitad de frames, sin pérdida perceptible en video
#     estático/musical para redes sociales.
#   - concurrency=2: en 8 núcleos, cada tab de Chrome headless ya usa varios
#     hilos internos (rasterizado + compositor); 2 tabs en paralelo saturan
#     la máquina sin llegar a swap. Ya se probó y terminó sin colgar el equipo.
#   - crf=18: calidad visual alta para web, sin pagar el costo de un crf bajo
#     (ej. 12) que casi duplica el tiempo de codificación.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p out
echo "=== StressTest: iniciando render ($(date '+%H:%M:%S')) ==="
time npx remotion render index.js StressTest out/stress-test.mp4 \
  --concurrency=2 \
  --codec=h264 \
  --crf=18 \
  --overwrite
echo "=== StressTest: listo -> out/stress-test.mp4 ==="
