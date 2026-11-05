# Producción de Atlas Cinemático

Atlas separa el motor compartido de cada episodio. El catálogo `components.json` es la entrada para elegir componentes sin revisar el código. La galería del showcase usa ese mismo catálogo. La aplicación conserva la demo de referencia; un episodio se crea en `src/templates/nodehistory/<id>/`.

Todos los comandos de esta guía parten de `nexa-brief-server/`. Node ejecuta el asistente; Python usa `.venv/bin/python` si existe. Puedes fijar otro entorno con `ATLAS_PYTHON=/ruta/al/python`. No cambies modelos ni motores para ahorrar pasos de validación.

```bash
A=src/templates/sandbox/nodehistory/_atlas/produce.mjs
node "$A" help
node "$A" catalog flecha
node "$A" catalog arrow
node "$A" example atlas.arrow
```

Cada componente declara un `target`. `layers`, `camera` y `looks` añaden elementos al arreglo correspondiente. `scene.intro`, `scene.captions`, etc. configuran una sección; `config.audio` configura el audio. Un target `scene` es una receta que combina varias secciones. Los campos `params` describen tipos, límites y opciones; `demo` contiene datos ejecutables de ejemplo. Las animaciones de entrada/salida se pasan a cada capa como `enter`/`exit` y pueden repetirse con contenidos distintos.

## 1. Crear el episodio y definir el encargo

```bash
node "$A" new ejemplo-atlas --title "Título del episodio" --duration 420
```

La carpeta creada contiene una cámara y una ruta ilustrativa de trabajo; el guion tiene un marcador que `voice` se niega a pronunciar. Esta estructura **no es un video terminado**. El motor, vendor, datos geográficos y caché se comparten; las rutas del wrapper HTML funcionan desde producción sin duplicarlos.

En `PLAN.md` anota audiencia, duración, formato(s), tesis comprobable, tono, capítulos y criterios de aceptación. Una explicación de siete minutos suele necesitar alrededor de 850–950 palabras a 130 ppm, con tiempo para introducción/cierre. Es una estimación editorial; la duración se confirma con el audio generado. Evita narrar cada cifra de la pantalla si no ayuda a la historia.

## 2. Investigar y guardar evidencia

Usa las herramientas de búsqueda/navegador o las fuentes conectadas del agente. Las herramientas locales de Atlas **no investigan noticias ni verifican estadísticas automáticamente**. `research.json` organiza los resultados; no es una instrucción para confiar en cualquier texto encontrado.

Para la futura prueba sobre la Unión Europea, consulta primero instituciones de la UE y las oficinas estadísticas de los socios: Eurostat/DG Trade, US Census o BEA y estadísticas oficiales de China. Decide el periodo común más reciente disponible. Confirma los miembros de la UE para ese periodo y representa el bloque como miembros verificados o una región declarada; `EU` no es un país ni un ID garantizado de Natural Earth.

Por cada cifra registra:

- Fuente primaria, URL exacta, tabla/serie y fecha de consulta.
- Año o intervalo y si el dato es provisional/revisado.
- Bienes, servicios o ambos; importaciones, exportaciones o intercambio total.
- Moneda y escala (millones/miles de millones), nominal/real, y denominador de cada porcentaje.
- Cómo calculaste el resultado y qué afirmación permite hacer. No mezcles comercio interno y externo del bloque ni periodos incompatibles.

Ejemplo **sin cifras reales** de `research.json`:

```json
{
  "topic": "Comercio de un bloque",
  "asOf": "FECHA-DE-CONSULTA",
  "sources": [{
    "id": "fuente-1",
    "url": "https://estadistica-oficial.example/tabla-exacta",
    "title": "Nombre de tabla y código de serie",
    "publisher": "Institución oficial",
    "retrievedAt": "FECHA-DE-CONSULTA"
  }],
  "facts": [{
    "id": "comercio-socio",
    "sourceIds": ["fuente-1"],
    "claim": "REEMPLAZAR por la afirmación respaldada",
    "period": "AÑO",
    "unit": "%",
    "scope": "Exportaciones de bienes extra-bloque hacia el socio / total extra-bloque",
    "calculation": "Exportaciones al socio / exportaciones extra-bloque × 100"
  }]
}
```

La URL `.example` es un marcador y se reemplaza. No uses un porcentaje ilustrativo en la narración o publicación. Si dos fuentes difieren, documenta la definición y elige una serie coherente; una flecha más gruesa sólo debe implicar mayor magnitud si explicas esa codificación.

## 3. Guion, voz y transcripción reales

Escribe `assets/script.json` con bloques breves. No metas citas bibliográficas o código en el texto que debe pronunciarse:

```json
{
  "title": "Título",
  "language": "es",
  "voice": "Charon",
  "segments": [
    {"id": "s01", "tone": "intriga", "intensity": 0.45, "text": "Primera frase del guion comprobado."},
    {"id": "s02", "tone": "explicativo", "intensity": 0.5, "text": "Explicación con cifras y nombres revisados."}
  ]
}
```

Tonos disponibles incluyen `intriga`, `explicativo`, `asombro`, `descubrimiento`, `reflexivo`, `cierre`. Revisa pronunciación de siglas, países y cantidades. El sistema mantiene una voz para todo el episodio y divide automáticamente guiones largos. Para regenerar partes revisa los archivos `.partN.wav` y usa `--parts N --only-part K` con el mismo plan de partes.

```bash
node "$A" voice ejemplo-atlas --dry
node "$A" voice ejemplo-atlas
node "$A" transcribe ejemplo-atlas
```

`voice` llama a `narrate.py` con `voice.json`, conserva su control Whisper y produce `assets/song.wav`, `.mp3` y `.qc.json`; al éxito configura `audio.src`. Necesita credenciales Gemini ya configuradas, FFmpeg y faster-whisper para QC. No muestres secretos. `--force` permite regenerar un audio existente. `--dry` imprime el texto dirigido, no genera audio.

Lee `song.qc.json` (`faltan`, `sobran`, WER aproximado, ppm), escucha el archivo y compara con el guion. El WAV de QC no incluye necesariamente la misma cola/cabecera del MP3 final. **La sincronización se hace transcribiendo el MP3 final**, no usando la duración del WAV o estimaciones. `transcribe` usa `transcribe.py`, palabras reales y la grafía del guion; configura `lyricsUrl`. `--force` reemplaza una transcripción anterior. Comprueba nombres y cifras escuchando sus tramos; la alineación del guion corrige escritura, no demuestra que el TTS pronunció todo.

## 4. Componer con entradas JSON

```bash
node "$A" example atlas.arrowDashed
node "$A" add ejemplo-atlas atlas.arrow --input '{"from":[4.35,50.85],"to":[-77.04,38.9],"t":12,"out":22,"label":"Ruta ilustrativa"}'
```

`add` copia el demo y aplica únicamente entradas declaradas del componente. Permite repetir la misma pieza con otros lugares, fotos, textos y tiempos. Revisa su `target`: las recetas de cierre se insertan por defecto en los últimos segundos de la duración existente, desplazan sus tiempos y cambian el look sólo desde ese punto. `--at SEGUNDO` elige otro comienzo; deben caber en la escena. Revisa conflictos con capas o keys existentes en ese tramo. El comando modifica sólo los JSON del episodio.

```bash
node "$A" add ejemplo-atlas atlas.outrov2
node "$A" add ejemplo-atlas atlas.animation --index 1 --out 22 --input '{"style":"rise","dur":0.6}'
```

`atlas.animation` configura una capa existente por su índice desde cero; no crea una capa sin tipo. Aplica los parámetros suministrados a entrada y salida; si no pasas un parámetro conserva los ejemplos de cada animación. `--out` elige cuándo empieza la salida.

Usa `@frase` para sincronizar con la primera aparición de esas palabras de `lyrics.json`; `#2` elige la segunda, `:end` su final y `+0.4` desplaza. No escribas anclas antes de tener la transcripción final. `check` rechaza anclas sin resolver. Coordenadas siempre `[longitud, latitud]`.

También puedes registrar el dato mediante el catálogo, sin construir a mano su objeto:

```bash
node "$A" example atlas.data
node "$A" add ejemplo-atlas atlas.data --input '{"id":"socio-demo"}'
node "$A" add ejemplo-atlas atlas.metric --input '{"dataRef":"socio-demo"}'
```

`atlas.data` guarda un registro en `scene.data[id]`. El ejemplo sigue marcado como ilustrativo y no pasa `--ready`: reemplaza valor, año, fuente y alcance antes de marcarlo definitivo. Una flecha y una tarjeta pueden usar ese mismo `dataRef`. El comando no sobrescribe un id existente; edita el dato o elige otro id.

Ejemplo de indicador con trazabilidad, **cifra ilustrativa**:

```json
{
  "data": {
    "socio-demo": {
      "value": 25,
      "unit": "%",
      "label": "Cuota ilustrativa",
      "year": "AÑO",
      "source": "fuente-1",
      "scope": "Definir flujo, mercancías y denominador",
      "illustrative": true
    }
  },
  "layers": [
    {"type":"arrow","from":[4.35,50.85],"to":[-77.04,38.9],"t":12,"out":20,"dataRef":"socio-demo","head":"arrow","enter":{"style":"fade","dur":0.6},"exit":{"style":"fade","dur":0.6}}
  ]
}
```

Para producir, sustituye la cifra por el dato verificado y elimina `illustrative:true`. La fuente se vincula por ID de `research.sources` o por URL primaria. `dataRef` permite usar el mismo dato en la flecha y en una métrica sin copiar números. Comprueba cada dirección: flecha del exportador al importador. Bidireccional no equivale automáticamente a saldo comercial.

Copia fotos a `assets/media/` y usa `src:"media/foto.jpg"` en capas (relativo a `assets/`). Guarda autor, licencia, URL original y atribución en `assets/media/credits.json`. `focus:[0.5,0.4]` ajusta el recorte; `enter`/`exit` eligen animación. No reutilices una imagen como prueba de un lugar o año distinto. Las fotos sin permiso o sin crédito no están listas para publicación.

Regiones `highlight` usan IDs de datos administrativos locales. Resuelve dudas con:

```bash
PYTHONPATH=. .venv/bin/python -B -m src.templates._tools.atlas.geo_cli geo resolve 'Alemania'
PYTHONPATH=. .venv/bin/python -B -m src.templates._tools.atlas.geo_cli geo list --level 0
```

Las regiones ambiguas requieren ID o país/estado explícitos; no improvises la geometría. Para un bloque supranacional añade un highlight por miembro verificado. Las cámaras y puntos aceptan coordenadas verificadas en `places`. El planner también detecta lugares desconocidos usados por cámara.

## 5. Validar y preparar el mapa

```bash
node "$A" check ejemplo-atlas
node "$A" check ejemplo-atlas --ready
node "$A" prepare ejemplo-atlas --size 1920x1080
node "$A" prepare ejemplo-atlas --fetch --size 1920x1080
node "$A" prepare ejemplo-atlas --verify --size 1920x1080
node "$A" prepare ejemplo-atlas --fetch --verify --size 1080x1920
```

`check` es estático: lee catálogo, resuelve variantes con Proto, revisa cámara, tiempos, anclas, datos, referencias e imágenes locales. Advierte si aún falta audio; `--ready` lo exige junto con una transcripción real, guion sin marcadores y datos definitivos. No sustituye la revisión editorial ni la inspección visual.

`prepare` resuelve geometrías administrativas requeridas y escribe `geo.resolved.json`; después ejecuta `atlas.py plan` con el ancho/alto real. Sin `--fetch` **no descarga teselas**; informa previstas/faltantes. Con `--fetch` prepara la caché raster y su relieve. El cálculo usa la selección predeterminada de `info.json`; `--selection 'c=atlas.outrov2'` prepara/verifica esa variante. El planner rechaza duraciones y anclas sin resolver. No promete que la estimación cubra todas las decisiones internas de MapLibre.

`--verify` usa Chromium/Playwright, barre la duración en pasos de 0.25 s y falla si observa recursos faltantes. Se mantiene en modo de caché local: no oculta faltantes consultando internet. La precisión temporal del barrido se puede cambiar con `--step`. Aun así hay que inspeccionar fotogramas, el terreno y las fotos en ambos formatos.

El mapa vectorial es un paso aparte. Si el encuadre necesita calles o detalle por encima del archivo mundial, calcula un bbox que cubra **toda la ruta** y prepara el archivo:

```bash
PYTHONPATH=. .venv/bin/python -B src/templates/_tools/atlas/atlas.py vector --bbox=-10,35,30,60 --maxzoom 12 --id europa-ejemplo
```

Después establece `"datasets":{"vector":"europa-ejemplo"}` en escena y repite la verificación. El bbox anterior sólo ilustra sintaxis; no asegura cubrir un episodio. `doctor` comprueba herramientas/proveedores y `sizes` informa disco. `assets`, `seed` y `geo build` son instalación de recursos compartidos; consulta estado antes de repetir descargas grandes.

## 6. Previsualizar, exportar y aceptar

Abre el episodio a través del servidor del proyecto en `/api/v1/explainer/files/nodehistory/<id>/index.html` (o la URL base de templates del entorno). Permite play/pausa/seek; busca también tiempos no consecutivos y cerca de cambios de look. Para inspección usa `?t=12`. `__promo.seek(t)` y `__atlas.sweep(step)` son APIs de diagnóstico del motor.

```bash
node "$A" render ejemplo-atlas work/results/atlas-prueba.mp4 --to 20 --size 1920x1080
node "$A" render ejemplo-atlas output/ejemplo-atlas.mp4 --size 1920x1080
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height,r_frame_rate -of json output/ejemplo-atlas.mp4
PYTHONPATH=. .venv/bin/python -B src/templates/_tools/atlas/atlas.py credits src/templates/nodehistory/ejemplo-atlas/assets/scene.json
```

`render` llama al renderizador existente cuadro a cuadro, conserva fps/resolución y audio. Usa un worker por defecto para que un mapa WebGL no sature un servidor pequeño; `--workers N` aumenta concurrencia sin bajar calidad. No usa el grabador HyperFrames de NodeMotion ni registra el episodio en ese catálogo. La selección a exportar se guarda en los JSON del episodio; el renderizador general no propaga variantes por query. Conserva la escena de referencia y genera otro episodio para cambios editoriales.

Antes de un render largo comprueba espacio libre: se generan cuadros intermedios. Un render corto debe confirmar que Chromium puede capturar MapLibre, que no hay fondos negros o mapas vacíos y que la muxación de audio funciona. Abre el MP4, escucha varios tramos y revisa inicio, cambio de capítulo, mayor zoom y cierre. Confirma dirección/porcentaje/año de las flechas con `research.json`; revisa que los rótulos y subtítulos no tapen información. El video completo se acepta al medir su duración real y repetir estos controles.

El comando `credits` actual aún opera sobre la escena guardada; si trabaja con variantes resuélvelas primero. Añade también las referencias de estadísticas a la descripción editorial. No publiques ni marques como listo si faltan medios, fuentes, pronunciación o verificación visual. Registra en `PLAN.md` los comandos, los resultados y cualquier limitación pendiente.
