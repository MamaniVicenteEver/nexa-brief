#!/usr/bin/env bash
# ============================================================================
# CONFIG GANADORA — NO MODIFICAR.
# concurrency=2, crf=23, h264. Probada el 2026-07-23: 43m04s reales (54% cpu
# promedio, compartiendo máquina con una clase de Teams), 73MB de salida,
# calidad aprobada por el usuario ("un video increíble... impecable").
# Si querés experimentar con otros ajustes, usá render-neon-letras.sh (el de
# pruebas) o los comandos sueltos — dejá este archivo intacto como respaldo
# del resultado bueno.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p out
echo "=== NeonLetras (config final): iniciando render ($(date '+%H:%M:%S')) ==="
time npx remotion render index.js NeonLetras out/neon-letras-final.mp4 \
  --concurrency=2 \
  --codec=h264 \
  --crf=23 \
  --timeout=120000 \
  --overwrite
echo "=== NeonLetras (config final): listo -> out/neon-letras-final.mp4 ==="
