# Banco de Atlas plano

La entrega de rendimiento está en `../results/plano-rendimiento.md`. `results/metrics.json` conserva la medición histórica; la nueva es **`results/metrics-v2.json`**, con sus imágenes y serie en `results/v2/`. La referencia exacta con el mismo inventario está en `reference/` (código) y `results/reference/` (751 cuadros). No reemplazar esas referencias al repetir una prueba.

Desde `atlas-en-movimiento/`:

```sh
mkdir -p /tmp/atlas-plano-bench
cp work/bench/bench.py.txt /tmp/atlas-plano-bench/bench.py
nice -n 15 env PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 ../../../../../.venv/bin/python /tmp/atlas-plano-bench/bench.py --project "$PWD"
```

La fuente se conserva como `bench.py.txt` porque el brief prohíbe escribir `.py` bajo `src/` y uvicorn vigila ese árbol. El ejecutable es `/tmp/atlas-plano-bench/bench.py`. No copiarlo sobre un proceso que todavía esté ejecutándose.

El script abre su propio servidor temporal con el manejador Range del smoke de Atlas. Usa Chromium/ANGLE/SwiftShader, 1080×1920, DPR 1. No inicia ni reinicia los servicios del proyecto y no escribe en `_atlas/cache/`. Bloquea solicitudes externas. Regenera el inventario de archivos existentes y mantiene los faltantes en `missingTiles()`.

Ejecutar **un solo proceso pesado a la vez**, siempre con `nice -n 15`; el banco limita además su afinidad y la de Chromium a dos CPU (`--cpu-limit 2`). Solo hay una página. El navegador se cierra en `finally`, también ante fallos. No modificar una copia de Python mientras se está ejecutando; usar otra ruta en `/tmp` para una revisión posterior.

Por defecto mide **751 seeks**, 0–25 s inclusive a 30 fps, por base. Incluye la espera de `__promo.seek` (dos rAF de Proto) y una lectura RGBA completa que fuerza el trabajo diferido del canvas. SHA-256, codificación PNG, hojas y escritura de archivos quedan fuera de `frameMs`. La precarga y dos cuadros de calentamiento se informan por separado. Los hashes son de todos los píxeles, no del archivo PNG.

`--quick` toma solamente doce instantes; sirve para diagnosticar y NO confirma el presupuesto de rendimiento. `--bases plano` o `--bases atlas3d` permite correr una base. `--out ruta` cambia la carpeta de resultados. Ejecutar una sola base/render a la vez para comparar tiempos.

Salida: `metrics.json`, series `*-frames.json`, doce capturas en `*-sheet.jpg`, tira 2–10 s a 10 fps en `*-flight-10fps.jpg`, y dos PNG a resolución completa por base. No se produce MP4. Los cinco instantes de determinismo son 0, 8, 15, 19 y 25 s; se repiten en orden 25, 0, 19, 8, 15 después del barrido.

## Reproducir v2

Copiar primero `bench.py.txt` a una ruta libre en `/tmp`. Ejecutar desde este prototipo, en serie:

```sh
nice -n 15 env PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 ../../../../../.venv/bin/python /tmp/atlas-plano-bench/bench.py --project "$PWD" --inventory work/bench/cache-inventory-reference.json --out work/bench/results/v2 --metrics-name ../metrics-v2.json --captures
```

`--inventory` congela la cobertura para comparar imágenes; no fabrica archivos presentes ni elimina faltantes. Para validar una caché recién completada, omitirlo y usar otra carpeta de salida. Los hashes SHA-256 de módulos, escena e inventario, afinidad, nice, versión de Chromium y carga del sistema quedan en las métricas.

Opciones adicionales:

- `--engine-root work/bench/reference` sirve la referencia sobre las mismas URL, conservando imports y sin sobrescribir el motor.
- `--scene-overrides '{"motionBlur":{"mode":"exact","samples":4,"fps":30,"shutter":0.5,"thresholdPx":2}}'` compara el camino exacto de v2.
- `--phase-flush --quick` materializa tiles, territorios y look con una lectura de un píxel. Atribuye el trabajo diferido; sus tiempos no son los del recorrido normal.
- `--canvas-read false --quick` prueba quitar `willReadFrequently` sin editar módulos.
- `--captures` conserva los PNG de la hoja y la tira a 1080×1920 en `full/`. `compare.py.txt` calcula MAE RGBA, PSNR RGB y SSIM RGB a resolución nativa; copiarlo a `/tmp` y ejecutarlo después de cerrar Chromium, con `OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1`.

```sh
cp work/bench/compare.py.txt /tmp/atlas-plano-bench/compare.py
nice -n 15 env OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 ../../../../../.venv/bin/python /tmp/atlas-plano-bench/compare.py work/bench/results/reference work/bench/results/v2 --out work/bench/results/difference-v2.json
cp work/bench/qa-v2.py.txt /tmp/atlas-plano-bench/qa-v2.py
nice -n 15 env PYTHONDONTWRITEBYTECODE=1 ../../../../../.venv/bin/python /tmp/atlas-plano-bench/qa-v2.py
nice -n 15 node --test work/bench/view.test.mjs
```

La QA exige cuatro llamadas tácticas con los mismos tiempos y matriz identidad, invalidación por `key(t)`, retorno exacto ante fade/corte extremo, blur nulo en reposo, continuidad de mip, cero cargas durante seeks, controles y resize horizontal. La cobertura de las vistas sintéticas se prepara aparte; sus faltantes no sustituyen los del recorrido.

## Teselas pendientes

`audit-missing.py.txt` es una estimación offline reproducible: copiar a `/tmp` y ejecutar desde esta carpeta. Comprueba las 128 rutas originales, las dos adicionales y los 130 comandos de `fetch-missing.sh.txt`; solo lee `_atlas/cache`. `atlas.py fetch` no ofrece `--dry`. La estimación usa tamaños reales de los 433 JPEG locales de z8 y distingue los archivos ya presentes. No es una cota de tamaño remoto garantizada.

Para quien tenga permiso de completar la caché, desde este prototipo:

```sh
sh work/bench/fetch-missing.sh.txt
```

Cada línea usa `nice -n 15 env PYTHONDONTWRITEBYTECODE=1 ../../../../../.venv/bin/python ../../../_tools/atlas/atlas.py fetch gibs-bluemarble Z X Y`. El script es serial, idempotente y se detiene ante errores. **No fue ejecutado por esta tarea**. El inventario congelado seguirá declarando ausencias tras descargar: omitir `--inventory` para verificar la cobertura nueva.

## Comparación

Las dos páginas usan `scene-bench.json` y la misma `camera.js`. Atlas 3D usa `atlas.js`, `style.js`, geodatos y caché originales, con un adaptador **local** en `atlas-raster.js`: exageración cero pasa a `setTerrain(null)` y se ocultan las capas de etiquetas, hillshade, admin1 y admin2 que esta escena no utiliza. Es necesario porque Atlas mantiene el DEM activo incluso con exageración cero. El resultado es la variante raster sin relieve pedida en el brief; no representa el coste de Atlas con terreno ni cambia otros proyectos.

El aspecto no es idéntico: plano mezcla territorios con multiply/screen/overlay, aplica tinte geográfico al océano, viñeta y cuatro muestras de movimiento. Atlas conserva sus rellenos normales y no tiene ese desenfoque. No se deben interpretar diferencias de color o desenfoque como errores de cámara.

## Vista previa

Con un servidor que sirva `src/templates/`, abrir:

- `sandbox/nodehistory/atlas-en-movimiento/work/bench/index.html?base=plano&controls=1`
- `sandbox/nodehistory/atlas-en-movimiento/work/bench/index.html?base=atlas3d&controls=1`

`?t=19` congela un instante. La entrada principal del prototipo no se cambia: estas son páginas de medición, no el demo narrado final.

La comprobación adicional de controles, formato horizontal, continuidad de niveles y activación del desenfoque se ejecuta después del benchmark (no simultáneamente):

```sh
cp work/bench/qa.py.txt /tmp/atlas-plano-bench/qa.py
nice -n 15 env PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 ../../../../../.venv/bin/python /tmp/atlas-plano-bench/qa.py
```
