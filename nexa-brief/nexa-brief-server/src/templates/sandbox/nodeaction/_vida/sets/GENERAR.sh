#!/usr/bin/env bash
# Genera solo las láminas ausentes; no requiere scripts ni archivos previos de /tmp.
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
SETS=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
SERVER=$(cd -- "$SETS/../../../../../.." && pwd)
RUN_DIR=$(mktemp -d /tmp/vida-sets-generate-XXXXXX)
trap 'rm -rf -- "$RUN_DIR"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cd -- "$SERVER"
ids=(escuela-entrada aula parque casa-comedor)
if (($#)); then ids=("$@"); fi
for id in "${ids[@]}"; do
  case "$id" in escuela-entrada|aula|parque|casa-comedor) ;; *) echo "Escenario desconocido: $id" >&2; exit 2 ;; esac
  if [[ -s "$SETS/$id/plate.png" ]]; then
    echo "$id: plate.png ya existe; se conserva el original."
    continue
  fi
  echo "Generando $id (1536x1024)…"
  .venv/bin/python -B -m src.adapters.image_gen.cli generate \
    --task "vida-sets-$id" --model luna-xhigh \
    --prompt "$(cat -- "$SETS/$id/prompt.txt")" --size 1536x1024 \
    --ref "$SERVER/src/templates/sandbox/nodeaction/vida-en-escena/work/ref/v2-sheet.jpg" \
    --output-root "$RUN_DIR/$id" --timeout 240 \
    --out "$SETS/$id/plate.png" 2>&1 | tee "$SETS/$id/generation.log"
  .venv/bin/python -B - "$SETS/$id" <<'PYGEN'
import hashlib, json, sys
from pathlib import Path
from PIL import Image
folder=Path(sys.argv[1]); path=folder/'plate.png'
with Image.open(path) as im:
    if im.format != 'PNG' or im.size != (1536,1024):
        raise SystemExit(f"Salida inesperada: {im.format} {im.size}; se conserva para revisión.")
    im.verify()
meta=folder/'set.json'; data=json.loads(meta.read_text())
data['credits'].update(status='generated', sha256=hashlib.sha256(path.read_bytes()).hexdigest(), note='Original PNG copiado por el adaptador, sin recomprimir. Pendiente de revisión visual y calibración sobre la lámina.')
meta.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
PYGEN
done
