# Atlas · formato de `assets/scene.json`

La página carga Proto y después `_atlas/atlas.js`. La escena es independiente de la página. Tiempo en segundos o anclas de voz `@palabra`, `@frase#2`, `@palabra:end`, `@palabra+0.4`, resueltas por Proto. `duration` es la duración total; `end` también es aceptado por Proto. Coordenadas `[longitud, latitud]` en grados.

```json
{
  "format": "atlas-v1", "duration": 24, "lang": "es",
  "look": "satelite-realista",
  "looks": [{"t": 8, "look": "oscuro", "dur": 2}],
  "places": {"Austin": [-97.7431, 30.2672]},
  "regions": {"Mi región": {"bbox": [-100, 28, -95, 33], "label": [-97, 30]}},
  "datasets": {"vector": "texas"},
  "camera": [
    {"t": 0, "focus": "US-TX", "span": 24, "pitch": 45, "bearing": -10},
    {"t": "@austin", "focus": "Austin", "span": 3, "pitch": 60, "bearing": 12, "dur": 3, "ease": "out", "arc": 0.5, "drift": {"z": 0.01}, "through": false}
  ],
  "layers": [
    {"type": "highlight", "region": "US-TX", "style": "olive", "t": 1, "dur": 0.6, "out": 15, "border": true},
    {"type": "tag", "at": "Austin", "text": "Austin", "t": 4}
  ],
  "intro": {"style": "v1", "text": "TÍTULO", "dur": 4},
  "outro": {"channel": "NODEHISTORY", "handle": "youtube.com/@nodehistory", "dur": 6},
  "captions": {"y": 0.885, "yLandscape": 0.915},
  "lang": "es"
}
```

`focus` admite un nombre de `places`, ID o nombre de región, o coordenadas. El centro de región usa `label` o el centro de `bbox`. `span` es el ancho longitudinal en grados y se convierte a zoom según el ancho de pantalla; `zoom` tiene prioridad. Cuando se omite `span` en una región se encuadra su bbox con `pad` (0.18 por defecto). Cada key posterior inicia el vuelo en `t` y llega al cabo de `dur`; `ease`, `drift`, `settle`, `arc`, `through`, `pitch` y `bearing` siguen el contrato de `camera.js`. El ejemplo presupone una transcripción que contenga el ancla.

`lift` desplaza el centro de proyección hacia abajo como fracción de la altura del lienzo: 0 centra la vista y 0.3 sitúa el foco al 80 % de la altura. Se limita a [0, 0.9], se interpola como los demás canales de cámara y vale 0 en cada key que lo omite. Por ejemplo, para un cierre con el título arriba y el globo subiendo desde abajo, usa una proyección de globo y `pitch: 0`:

```json
"camera": [
  {"t": 0, "center": [0, 0], "zoom": 1, "pitch": 0, "lift": 0},
  {"t": 8, "center": [0, 0], "zoom": 1, "pitch": 0, "lift": 0.3, "dur": 3}
]
```

El área libre efectiva depende del tamaño del globo y del título. Este `lift` de cámara es independiente del `lift` de los arcos de overlays.

Las regiones resueltas por `_tools/atlas/atlas.py geo scene` viven en `assets/geo.resolved.json`; sin ese archivo se buscan los datos Natural Earth locales por ID, ISO3 o nombre. El resaltado reutiliza la geometría local cuando existe, y en otro caso la resuelta. `style` puede ser una clave de `highlight.styles` o `{ "fill":"#9aa33a", "opacity":0.55, "line":"#ffffff", "width":2 }`. `dur` determina la entrada y salida; `out` es opcional. Para otras capas y sus campos consultar [OVERLAYS.md](OVERLAYS.md).

Los looks disponibles son `satelite-realista`, `satelite-etiquetado`, `satelite-noticiero`, `oscuro`, `claro`, `politico`, `historico-papel` y `espacio`. Un cambio empieza en `t`: interpola números y colores con suavizado durante `dur`, conmuta booleanos a mitad y cambia la proyección en el instante inicial. Una transición puede interrumpir a otra. Cada JSON controla cielo, relieve, satélite, base, fronteras, etiquetas y estilos de resaltado. `sat.detail` selecciona un proveedor detallado; `sat.viirs` activa VIIRS. `datasets.vector` selecciona `cache/vector/detail-<id>.pmtiles` para localidades; si se omite se usa el archivo mundial.

`satelite-realista` deja apagadas las etiquetas y fronteras interiores; los resaltados conservan su borde. `satelite-etiquetado` activa nombres y fronteras, y habilita detalle USGS en su cobertura desde zoom 8. Las etiquetas de país, estado y condado usan puntos únicos; localidades y calles provienen del vector.

La proyección admite los strings existentes `mercator` y `globe`, una expresión de MapLibre directamente o un objeto `{"type": [...]}`. Para una salida a órbita, cambia el look con un evento como este:

```json
{"t": 8, "look": "satelite-realista", "overrides": {"projection": ["interpolate", ["linear"], ["zoom"], 1.2, "vertical-perspective", 2.6, "mercator"]}}
```

En el instante del evento la cámara debe estar en el tramo Mercator (zoom igual o superior a 2.6 en este ejemplo), para que el cambio de definición no se note. Al alejar la cámara y bajar el zoom, la expresión transforma continuamente el plano en esfera; por debajo de 1.2 queda en perspectiva vertical. La proyección pasa al valor destino al iniciar el evento, independientemente de `dur`.

Las etapas de `interpolate` sobre `zoom` también admiten `{ "span": N }`, con el mismo ancho longitudinal en grados que las keys de cámara:

```json
{"type":["interpolate",["linear"],["zoom"],{"span":520},"vertical-perspective",{"span":170},"mercator"]}
```

El motor convierte cada span al zoom correspondiente al ancho real del lienzo, incluso al redimensionar; así los mismos encuadres producen las mismas etapas en horizontal y vertical. Los números siguen siendo zoom y pueden combinarse con span. Las etapas convertidas deben quedar en orden estrictamente ascendente de zoom: entre spans, eso significa orden descendente. En este ejemplo la cámara debe partir con span igual o menor que 170 para estar en el tramo Mercator.

`lookOverrides` mezcla recursivamente tokens sobre el look inicial y cada look posterior. Cada entrada de `looks[]` admite `overrides` (o `lookOverrides`), aplicado después del override de escena. Los arreglos se sustituyen completos. Por ejemplo: `"lookOverrides":{"groups":{"labels":{"visible":true},"borders":{"admin1":{"minzoom":4}}},"highlight":{"styles":{"olive":{"fill":"#9aae3b"}}}}`. También se admiten `labels` y `borders` directamente, sin `groups`.

En Atlas, si no se declara `intro`, `outro` o `captions`, ese elemento no se dibuja ni reserva tiempo; `outro:false` también desactiva el cierre. Los créditos de las fotos usadas se leen de `assets/media/credits.json`, si existe. La escena de otra ruta se puede previsualizar con `?scene=assets/scene-zoom.json`.

La estructura de `intro`, `outro`, `captions` y las ventanas opcionales de medios es la de [Mapas](../_mapas/ESCENA.md). `captions.y` y `yLandscape` son fracciones de la altura. El motor construye la atribución abreviada de las fuentes activas automáticamente.

La precarga interactiva opcional `?preload=1` barre la duración en pasos de 0,25 s con progreso; por defecto no dibuja el barrido; WebDriver no la inicia, y `?warm=1` deja el barrido a la herramienta de calentamiento sin barra. `?online=1` consulta teselas raster upstream y muestra ONLINE; el modo normal usa solo caché. APIs: `await __promo.seek(t)`, `__promo.missingTiles()`, `await __atlas.ready`, `await __atlas.sweep(step)`, `__atlas.missingTiles()`, `__atlas.stats()` y `__atlas.fps()` (media y p95 de los últimos 120 cuadros). Un timeout de 20 s se registra y no bloquea indefinidamente.

`view.project` usa la proyección de MapLibre y su prueba de oclusión del horizonte/terreno. La API pública `map.project` no expone altura: actualmente `altM` se ignora; los arcos de overlays pueden usar su propio `lift`. La escala de perspectiva es una aproximación local mediante distancia proyectada y está limitada a 0,35–1,5.

Prueba manual para el orquestador: `python _atlas/test/smoke.py` con Playwright y Chromium instalados. Usa SwiftShader, sirve `src/templates` con el manejador de medios y soporte Range para PMTiles y deja capturas en `/tmp/atlas-smoke/`. El script informa errores de consola, recursos faltantes y tiempos. Si el servidor no admite HTTP Range para PMTiles, el motor conserva el archivo completo en memoria y usa cortes locales; con Range solo pide los segmentos necesarios.


## Plan sin navegador

Desde `nexa-brief-server/`: `.venv/bin/python src/templates/_tools/atlas/atlas.py plan src/templates/sandbox/nodehistory/atlas-cinematico/assets/scene-zoom.json --fetch`. Sin `--fetch` solo estima faltantes y bytes; `--step 0.25` y `--maxdist 2.6` ajustan muestreo y alcance. La cámara es la misma que usa el motor, y se estiman esquinas, horizonte, margen, niveles y cobertura del proveedor; es conservador, no garantiza coincidir con todas las decisiones internas de MapLibre. Las anclas se resuelven con la transcripción indicada en el config de la página; el plan rechaza anclas sin resolver. El detalle vectorial se prepara por separado con `atlas.py vector`. `warm --verify` queda para una comprobación opcional con navegador (paso predeterminado de 5 s); no es el flujo normal de preparación.

### Relieve y créditos

El relieve usa `terrain-land`, derivado de Terrarium con el fondo marino a cero. Ejecuta `atlas.py terrain-land` para convertir la caché existente; `atlas.py plan escena.json --fetch` convierte o descarga las teselas faltantes. Un look puede seleccionar el relieve original con `dem: "raw"`.

Ejecuta `atlas.py credits assets/scene.json` para imprimir y escribir `assets/credits.txt` con fuentes y fotografías para la descripción. En el cuadro aparece solo la atribución abreviada de las capas visibles.

## Kit para agentes

Para crear un episodio con este diseño existente: `SKILL.md` y `PRODUCIR.md`. Catálogo machine-readable: `components.json`; ficha del showcase: `production.json`. No confundir con `explainer-kit/designs/atlas`, que es un diseño 2D diferente.

El planificador resuelve `when`, `$by` y `$param` con la misma selección de componentes que Proto. Usa la selección por defecto de `info.json`; para otra variante, `atlas.py plan <scene> --selection 'c=atlas.outrov2'`. Las opciones `--width 1080 --height 1920` preparan el formato vertical. `warm --verify` acepta los mismos parámetros. Una estimación de caché no sustituye la comprobación en navegador.
