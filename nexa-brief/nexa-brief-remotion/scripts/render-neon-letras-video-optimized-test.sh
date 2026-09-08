#!/usr/bin/env bash
# TEST de optimización — comparar contra out/neon-letras-video-final.mp4
# (el aprobado: 2h02m22s, 136.1MB, calidad "impecable").
#
# De las 5 estrategias que evaluamos para acelerar el render, esta es la
# ÚNICA que aplica acá sin arriesgar calidad ni animaciones:
#   - Reducir la resolución de la FUENTE bg-video.mp4 (1280x720 -> 960x540)
#     antes de que Remotion la decodifique. Menos píxeles por frame =
#     decode más barato. NO toca color, NO toca el filtro CSS, NO toca las
#     animaciones de cámara/palabras — esas viven aparte, en neon-timeline.js
#     y no dependen de la resolución del video de fondo.
#
# Descartado a propósito (no entran en este script):
#   - Bajar los fps de la fuente (15fps): arriesga que el fondo se vea más
#     entrecortado — vos pediste explícitamente no tocar animaciones.
#   - Pre-cocinar el filtro de color (grayscale/sepia/hue-rotate) con
#     ffmpeg: los filtros de ffmpeg no son idénticos matemáticamente a los
#     de CSS, cambiaría el tono aunque sea un poco.
#   - Sprites PNG pre-renderizados para el glow de neón: SÍ preserva calidad
#     100%, pero es una reescritura de código (no un script), queda para
#     cuando integremos todo al pipeline del sistema.
#   - --codec=h264-qsv: no ataca el cuello de botella real (el encoding ya
#     tarda 11 segundos de 2 horas), así que no está acá.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=test/bg-video.mp4
LIGHT=test/bg-video-540p.mp4

if [ ! -f "$LIGHT" ]; then
  echo "=== Generando $LIGHT (960x540, mismos 30fps, sin audio) ==="
  ffmpeg -y -i "$SRC" -vf scale=960:540 -c:v libx264 -preset veryfast -crf 20 -an "$LIGHT"
fi

mkdir -p out
echo "=== Render de prueba con fondo optimizado (960x540) ==="
echo "=== Comparar el resultado contra out/neon-letras-video-final.mp4 ==="
time npx remotion render index.js NeonLetrasVideo out/neon-letras-video-optimized-test.mp4 \
  --concurrency=2 \
  --codec=h264 \
  --crf=23 \
  --timeout=120000 \
  --props='{"bgVideo":"bg-video-540p.mp4"}' \
  --overwrite

echo "=== Listo -> out/neon-letras-video-optimized-test.mp4 ==="
echo "=== Mirá los dos videos lado a lado antes de decidir si te sirve el ahorro de tiempo ==="
