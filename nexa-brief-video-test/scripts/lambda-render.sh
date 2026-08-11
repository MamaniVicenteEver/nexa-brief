#!/usr/bin/env bash
# Render en AWS Lambda — reemplaza a scripts/render-neon-letras-final.sh
# cuando se decida migrar de local a la nube. Mismo códec/crf que la config
# local ganadora, para comparar calidad en igualdad de condiciones.
#
# Requiere haber corrido scripts/lambda-deploy.sh al menos una vez, y pegar
# acá abajo el "Serve URL" que ese script imprimió.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Falta .env — ver scripts/lambda-deploy.sh"; exit 1; }

SERVE_URL="https://remotionlambda-useast1-t5y0wcmlss.s3.us-east-1.amazonaws.com/sites/nexa-brief-neon-letras/index.html"

echo "=== Renderizando NeonLetrasVideo en Lambda ==="
time npx remotion lambda render "$SERVE_URL" NeonLetrasVideo \
  --codec=h264 \
  --crf=23 \
  --out-name=out/neon-letras-lambda.mp4
