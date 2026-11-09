# Territorios, rutas y rótulos

Los tres archivos de componentes se registran con `Tactico.component` y se descubren con el catálogo del núcleo. No agregan dependencias. Todos los tamaños son píxeles de diseño multiplicados por `env.U`. Los colores aceptan claves de `defs.palette` o colores del look.

## Galería

Desde un servidor que sirva `src/templates/`, abrir:

- `sandbox/nodehistory/atlas-en-movimiento/work/tactico/demo.html?items=scene-territorios.json`: escena completa, cuatro países, cuatro modos y 22 ejemplos sucesivos, 144 segundos.
- `demo.html?items=items-territory.json`, `items-routes.json` o `items-labels.json`: una familia por vez.
- `territorios.html`: visor de revisión con mapa fijo, selector y control de tiempo. Precarga teselas existentes; no escribe en la caché compartida.

La fuente Archivo 900 se sirve desde el archivo local existente en `_tools/explainer-kit/vendor/fonts/` (SIL OFL). `labels.js` la precarga antes de registrar los componentes; `scene-territorios.json` declara `defs.fonts.display:"AtlasDisplay"`. Ambos visores usan la misma fuente.

## Parámetros

Todos los items aceptan los campos comunes del contrato (`id`, `t`, `dur`, `out`, `fade`, `at`, `states`, `layer`, `z`). Los tiempos de estados son absolutos, incluidos los que usan anclas de voz. El núcleo resuelve esos tiempos antes de `prepare`.

| Componente | Campos propios principales |
|---|---|
| `territory.fill` | `region`, `color`, `opacity`, `border`; envuelve `c.territories.draw`, el renderer original de `engine/plano/territories.js` |
| `territory.flag` | `region`, `flag` (sin distinguir mayúsculas), `flagMode:"fill"|"marker"|"both"|"none"`, `flagAlign:"screen"|"country"`, `opacity`, `flagWidth` |
| `flag.marker` | `at` (también id de otra unidad), `flag`, `flagWidth:78`, `poleHeight:98`, `wave:true`, `scale:1` |
| `territory.hatch` | `region`, `color`, `spacing:18`, `width:2`, `opacity` |
| `territory.glow` | `region`, `color`, `width:2`, `pulse:true` |
| `territory.extrude` | `region`, `color`, `depth:16`, `offset:[10,16]` |
| `territory.state` | `region`, `state`, `stateColors`, `transition:"wipe"|"color"|"radial"`, `direction:"east"|"west"|"north"|"south"` |
| `arrow.route` | `via` o `from`/`to`, `width:4`, `color`, `reveal:1`, `head` |
| `arrow.curve` | anteriores; `control` geográfico opcional, `bend:.3`, `trail:.24`, `trailColor` |
| `arrow.bolt` | anteriores; `teeth:8`, `amplitude:24`, `seed:1` |
| `arrow.flow` | `via`, `width`, `color`, `amplitude:14`, `wavelength:150`, `heads:5`, `speed:.13` |
| `route.sea` | `via`, `width`, `color`, `speed:20`, `points:true`; tramos rectos en Mercator, sin suavizado que pueda invadir la costa |
| `route.lanes` | `via`, `lanes:5` (1–16), `spacing:14`, `width`, `text`, `chipAt:.5` |
| `front.line` | `via`, `width`, `color`; cada estado puede agregar otro `via` del mismo tamaño |
| `range.ring` | `at`, `radiusMode:"geo"` y `radiusKm:180` para alcance geodésico; `radiusMode:"screen"` y `radius:160` para radio simbólico, `color`, `pulse:true` |
| `label.callout` | `text`/`label`, `offset:[110,-100]`, `reveal:.65`, `size:32`, `width`, `height`, `color` |
| `label.neon` | `text`/`label`, `size:64`, `width:650`, `height:220`, `rotation:0`, `color`, `screen` opcional |
| `label.chip` | `text`/`label`, `size:30`, `width`, `height`, `padding:15`, `color` |
| `label.figure` | `value` numérico y `source` obligatorios, `unit`, `size:96`, `rotation:-8` |
| `text.year` | `text`/`label`, `size:180`, `width`, `height`, `rotation` |
| `badge.count` | `value` entero 0–999999, `radius:66`, `color`; los estados contienen `value` y `dur` |
| `icon.badge` | `icon:"plane"|"ship"|"oil"|"building"|"shield"|"star"`, `radius:60`, `color` |

`screen:[x,y]` usa fracciones 0…1 del cuadro. Los rótulos ajustan líneas y tamaño a una caja dentro del 8–80 % vertical y respetan esa caja al rotar. Los textos largos se dividen por palabras o caracteres si hace falta. No se descarta texto. `fit` siempre se aplica para conservar la zona segura.

## Estados

```json
{"id":"estado","type":"territory.state","region":"IQ","t":0,"dur":9,
 "transition":"wipe","direction":"east",
 "states":[{"at":1,"state":"disputado","dur":1},
           {"at":3,"state":"ocupado","dur":1},
           {"at":6,"state":"liberado","dur":1}]}
```

Los estados territoriales son `normal`, `ocupado`, `disputado`, `liberado`. Los del frente son `advance`, `retreat`, `hold`, con `via` en cada cambio. `badge.count` usa `state:"count"` y `value` explícito. Las posiciones del frente se interpolan en Mercator; la animación de cada componente es una función del tiempo absoluto y tolera seeks fuera de orden.

## Validación y reproducción de QA

```sh
node work/tactico/build-territorios.mjs
node engine/tactico/tools/catalog.mjs
node engine/tactico/tools/validate.mjs work/tactico/scene-territorios.json
node --test work/tactico/territorios.test.mjs
mkdir -p /tmp/tactico-territorios
cp work/tactico/check-territorios.py.txt /tmp/tactico-territorios/check.py
PYTHONDONTWRITEBYTECODE=1 nice -n 15 ../../../../../.venv/bin/python /tmp/tactico-territorios/check.py
```

No sobrescribir una copia de QA que siga ejecutándose. El script usa un servidor temporal, un Chromium, una página, SwiftShader, raster con dos hilos y un lock cooperativo en `/tmp/atlas-tactico-chromium.lock`. Los módulos y las imágenes se cargan desde archivos locales. No se graba video.

La captura se extrae del canvas; la comprobación de seek compara SHA-256 de sus píxeles. El rendimiento informa tanto el envío de órdenes JS como el coste hasta completar el raster con `getImageData`, descontando una lectura de control. No confundir estos dos tiempos. Las mediciones finales y las limitaciones están en `work/results/tactico-territorios.md`.

Se reutilizan las longitudes y geometrías de las curvas y carriles. Las puntas de flecha conservan todos los vértices al revelar una ruta. Se cachean las banderas decodificadas, patrones de rayado, mástiles y el borde luminoso; la caché del borde se limita a 16 Mpx, y la del mástil a ocho entradas. El relleno de color sigue llamando al renderer original en cada dibujo. No se cachea la composición completa del satélite.

`validateSeaRoute(path,land)` se exporta desde `components/routes.js` para reutilizar la misma comprobación. Usa `landIndex` y `seaCrossings` del núcleo. Detecta bordes además de puntos interiores, respeta huecos y antimeridiano. El diagnóstico identifica segmento, país y necesidad de agregar waypoints. No calcula automáticamente una ruta navegable ni certifica cartas náuticas; su precisión es la del Natural Earth disponible.

## Banderas y procedencia

El archivo `../_mapas/flags.js` se importa en lectura y dibuja las banderas. `KW` no está en su catálogo; `territory.js` agrega esa entrada únicamente en memoria, usando el mismo renderer. Su geometría sigue la [Embajada de Kuwait](https://www.kuwait-embassy.or.jp/E_outline_06.html). El emblema de `IR` del catálogo era una estrella; la extensión local lo reemplaza por el emblema y las inscripciones del [SVG de Commons](https://commons.wikimedia.org/wiki/File:Flag_of_Iran.svg), declarado de dominio público, sin modificar el archivo compartido. Se conserva una copia del SVG fuente en `work/research/flag-ir.svg`. `none` no solicita ni valida una identidad de bandera. El catálogo original también carece de `OM`; la escena coloca Omán en `none`. No se reemplaza una bandera desconocida por otra.

Los iconos son trazados vectoriales propios. El mapa y las fronteras usan los recursos existentes de NASA GIBS/Blue Marble y Natural Earth. Las cifras de ejemplo son valores técnicos expresamente identificados: cuatro países presentes y un contador sintético 2→3. Los cambios territoriales del ejemplo no representan hechos históricos.

Lecciones de la reanudación: capturar el canvas evita el timeout de `page.screenshot` observado antes de la pausa. Cachear texturas grandes con transparencia empeoró el raster de relleno con bandera, rayado y extrusión en este servidor: se conservan sus trazados directos. Las cachés del mástil y del borde luminoso sí redujeron el coste. Los cambios de estado de frentes, contadores y barridos de esta demostración se programan sin solapar sus transiciones; no se ha certificado continuidad de transiciones interrumpidas.
