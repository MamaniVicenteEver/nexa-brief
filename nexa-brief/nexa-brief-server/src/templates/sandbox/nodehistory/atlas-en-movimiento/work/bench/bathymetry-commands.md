# Propuesta para el responsable de la caché (NO ejecutada)

Agregar el objeto de `provider-bathymetry.proposed.json` a `_atlas/providers.json` antes de ejecutar comandos de descarga. El identificador, la matriz `GoogleMapsCompatible_Level8`, JPEG y la ausencia de dimensión temporal se verificaron en las [capacidades WMTS de GIBS](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml). La tesela mundial de prueba respondió 200 y 256×256; se conserva el resultado en `bathymetry-probe.json`, sin instalar medios nuevos.

Para reproducir el recorrido con batimetría, el motor plano solo necesita cambiar `tiles.provider` a `gibs-bluemarble-bathymetry` y regenerar el inventario. `atlas.py plan` actualmente fija `gibs-bluemarble` como base; no selecciona el proveedor de `scene.tiles`. Por eso se propone este comando exacto de `fetch` para cada key del inventario necesario.

Desde `nexa-brief-server/`, después de agregar el proveedor:

```sh
.venv/bin/python src/templates/_tools/atlas/atlas.py fetch gibs-bluemarble-bathymetry 0 0 0
```

Para precargar el mismo conjunto de 676 keys del banco (la lista se genera por el renderer y se conserva como `required-tiles.json`):

```sh
.venv/bin/python - <<'PY'
import json, subprocess
from pathlib import Path
project = Path('src/templates/sandbox/nodehistory/atlas-en-movimiento')
for key in json.loads((project / 'work/bench/required-tiles.json').read_text()):
    z, x, y = key.split('/')
    subprocess.run(['.venv/bin/python', 'src/templates/_tools/atlas/atlas.py',
                    'fetch', 'gibs-bluemarble-bathymetry', z, x, y], check=True)
PY
```

Para completar solamente los faltantes actuales de Blue Marble, usar el mismo bucle con `missing-tiles.json` y proveedor `gibs-bluemarble`. Cada entrada de ese archivo conserva el prefijo del proveedor; separar con `_, z, x, y = key.split('/')`.

La licencia propuesta habilita uso comercial **editorial e informativo** con crédito y sin atribuir respaldo institucional. NASA permite generalmente reutilizar sus imágenes con esas condiciones, pero señala excepciones para material de terceros. Véanse [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) y la [procedencia de la imagen y datos GEBCO/BODC](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/). La entrada propuesta no equivale a una aprobación universal de usos publicitarios.
