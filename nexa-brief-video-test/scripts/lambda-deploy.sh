#!/usr/bin/env bash
# Setup de UNA SOLA VEZ para Remotion Lambda — no es el render en sí.
# Requiere: cuenta AWS + IAM ya configurado (ver guia_migracion_remotion_lambda.md
# en nexa-brief-docs/) y el archivo .env con REMOTION_AWS_ACCESS_KEY_ID /
# REMOTION_AWS_SECRET_ACCESS_KEY ya completado.
#
# No se ejecuta todavía (no hay cuenta AWS armada) — queda listo para cuando
# se decida migrar de local a Lambda.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Falta .env — copiá .env.example a .env y completá las credenciales."; exit 1; }

echo "=== Verificando permisos IAM ==="
npx remotion lambda policies validate

echo "=== Desplegando la función Lambda (una vez, o de nuevo si cambia la versión de Remotion) ==="
# Timeout subido a 300s (default 120s): la composición NeonLetrasVideo (drop-shadow/glow
# pesado + fondo de video) no llega a combinar los ~108 chunks dentro de 120s.
npx remotion lambda functions deploy --timeout=900

echo "=== Publicando el bundle (el 'site') con las composiciones actuales ==="
# Se re-sube cada vez que cambie index.js, test/NeonLetrasVideo.js, test/neon-timeline.js,
# o cualquier asset en test/ (bg-video.mp4, song.mp3, config.json, lyrics.json).
npx remotion lambda sites create index.js --site-name=nexa-brief-neon-letras

echo "=== Listo. Guardá el 'Serve URL' que imprimió el comando de arriba —"
echo "    lo necesita scripts/lambda-render.sh para saber qué bundle renderizar."
