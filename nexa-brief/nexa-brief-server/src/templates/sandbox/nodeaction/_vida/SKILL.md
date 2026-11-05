---
name: vida-produce
description: Producir o adaptar episodios JSON de Vida en Escena con el motor existente, voces disponibles, acciones y cámara del catálogo. Usar para montaje de episodios; una capacidad nueva requiere ampliar el motor según VIDA.md.
---

# Producir un episodio Vida

## Entrada breve para crear y ampliar

Para crear o actualizar personajes, voces, animaciones o componentes, empezá por
`agent-guide/index.json` o ejecutá `node tools/agent-guide.mjs list` desde `_vida/`.
Luego ejecutá `node tools/agent-guide.mjs show <tarea>` y leé solo los archivos
indicados para ese caso. El resto de este documento es para montar episodios.

Leé solo estos tres recursos para empezar:

1. [Contrato breve](docs/EPISODIO.md): formato, tiempos, propiedad y revisión.
2. [Catálogo](catalog.json): consultá las secciones `actions`, `sets`, `shots`, `sceneTransitions`,
   `castModes`, `initialState` y `fx` que requiera la dirección; no hace falta cargar todos los rasgos del rig.
3. [Ejemplo ejecutable](../vida-en-escena/assets/episodes/capacidades.json). El
   [episodio completo](../vida-en-escena/assets/episode.json) muestra diálogos y anclas reales.

Trabajá en el JSON del episodio solicitado. Conservá los clips, timing, voces y láminas cuando el
pedido sea de montaje. Verificá que cada `say` tenga timing/audio antes de usarlo. Si falta un clip,
conservá el guion y dejá un beat mudo explícito con `gesture`/`fx`, anotando el faltante; no simules voz.

Planificá cada escena con poses/objetos iniciales y dueño único. Usá `start` para comenzar sentado o
con objetos, `stow` para bolsillo, `unwear` para mochila, `eat.item` para helado, `gesture` para actuación
muda y `fx` para glifos. Anclá los beats a palabras reales. La duración la calcula el compilador.
En mostradores usá `counter` y `behind: "id-del-mostrador"` en actor o ancla del set; ajustá
`surfaceY` a la cintura y el color a la lámina. No uses desk para una tapa frontal opaca.

Preferí el director automático y overrides breves para los beats pedidos; un dolly es un evento
con `zoomFrom/zoomTo`. Las transiciones se declaran en la escena entrante.

Desde esta carpeta, con las rutas del episodio elegido:

```sh
node tools/validate.mjs ../vida-en-escena/assets/episode.json
node tools/review.mjs ../vida-en-escena/assets/episode.json ../vida-en-escena/work/review-episodio --every 2
```

El encuadre usa el tamaño real del sujeto: no agregues offsets en píxeles para compensar charHeight.
`framing:"fit"` es el default y adapta el mismo episodio a landscape 1920×1080 o portrait
1080×1920. En wide/two/medium entran todos los actores de la escena, pelo, pies y objetos;
close protege cara/pelo e insert el objeto. El móvil aleja a los personajes si hace falta y rellena
con la misma lámina desenfocada. `locked:true` no permite recortar; `fit:false` en un override
lo solicita explícitamente. `framing:"tight"` conserva la composición anterior.
Revisá `failed`: `actores_completos`, `sin_zona_vacia`, `sujeto_suficiente` (fit: cuerpo ≥18%
portrait, ≥28% landscape; cara close ≥25%), `objeto_no_tapa_cuerpo` (35%, excepciones explícitas).
Review/validate usan `--view both` por defecto. El render usa `--view portrait` por defecto y
acepta `--framing fit|tight`; landscape sin salida explícita escribe `render/<id>-16x9.mp4`.

Corregí rutas, parámetros y encuadre hasta `passed:true`, y mirá la hoja de contacto. Entregá JSON,
hoja/métricas y un informe breve con duración y faltantes reales. El render y la mezcla solo se
hacen si están dentro del pedido vigente; no cambies el reproductor por episodio.

Si el catálogo no ofrece una capacidad, no inventes campos ni objetos invisibles fuera del plano:
seguí [Cuando falta una acción](VIDA.md#cuando-falta-una-acción-cómo-incorporarla-sin-romper-lo-existente)
si el pedido autoriza ampliar el motor; de lo contrario registrá la limitación concreta.

## Recorrido completo de un episodio nuevo (desde `_vida/`)

Guía de seis pasos, ejemplos de guion/escena, lotes y límites: [docs/PRODUCCION.md](docs/PRODUCCION.md).

```sh
node tools/new-episode.mjs agua-001 --title "Cómo ahorrar agua en casa" --sets escuela-entrada --cast tomas,nico
# Editar assets/episode.json: guion + montaje; reemplazar los wait de ejemplo por say.
node tools/produce.mjs agua-001 --dry-run --views portrait,landscape
node tools/produce.mjs agua-001 --provisional-timing --until review
# Con guion final, claves, dependencias y cuota: genera solo clips pendientes.
node tools/produce.mjs agua-001 --until voice --resume
# Escuchar voces nuevas, ajustar anclas a Whisper y mirar las hojas de ambas vistas.
node tools/produce.mjs agua-001 --resume --views portrait,landscape --nice
```

El diseño provisional solo crea timing estimado en `/tmp`, marcado `provisional:true`; nunca escribe
en `assets/` ni permite mezcla/render. No sustituye la voz real. Tras generar voz se repiten validate
y review con timing real. El pipeline exige `failed: []` en ambas vistas, cero `start_clicks`,
−16 ±0,5 LUFS y TP ≤ −1,5 dBTP antes de renderizar; si falla clave/cuota o QC, se detiene sin
cambiar voz/modelo ni inventar audio. Guarda pasos, hashes, duración, métricas y faltantes en
`../<id>/render/produce.json`. `--resume` comprueba entradas y salidas antes de omitir un paso.
Un render a la vez; portrait por defecto, landscape en `<id>-16x9.mp4`.

## HTML compartido del episodio

Copiá los dos prototipos vigentes: un solo `<audio>`, canvas, ▶ y `#status`, con
`<script type="module" src="../_vida/player.js"></script>`. El estilo del canvas debe ser:

```html
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#e8ded0}
body{display:grid;place-items:center}
canvas{display:block;width:100vw;height:100dvh;object-fit:contain}
[hidden]{display:none}
</style>
<audio id="audio" preload="auto"></audio>
<canvas aria-label="Vida en Escena, episodio animado"></canvas>
<button id="play" aria-label="Reproducir" hidden>▶</button>
<p id="status" role="alert" hidden></p>
<script id="default-config" type="application/json">{"episode":"assets/episode.json"}</script>
<script type="module" src="../_vida/player.js"></script>
```

Conservá los estilos de ▶/error de los prototipos. El player fija las dimensiones del canvas y su
tamaño CSS según el iframe. `?view=auto` elige orientación por aspecto y reevalúa en resize sin
perder tiempo ni reproducción; `?view=portrait|landscape` la fija. `?t=30&controls=1` conserva su contrato.

## Cámara profesional

Consultar [docs/CAMARA.md](docs/CAMARA.md) para el contrato JSON vigente y ejemplos.
Usar `camera.style` global y movimientos motivados por acciones o líneas; revisar
`compiled.camera.warnings` y `cameraAt(...).motion.warnings`. `fit` protege sujetos
con envolvente anticipada; `locked` solo fija la decisión editorial. Validar ambas
vistas con `review.mjs`, incluyendo velocidad, aceleración, jerk, bombeo y saltos.
No imponer cortes periódicos a una escena sin beats. Los límites pueden alargar
el movimiento, nunca los tiempos del diálogo ni los cortes explícitos.
