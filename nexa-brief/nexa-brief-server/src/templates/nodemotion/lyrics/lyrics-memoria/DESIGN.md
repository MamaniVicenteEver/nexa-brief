# lyrics-memoria · diseño reproducible

Special Elite, Caveat y VT323 en crema, sepia y rosa. Película antigua, weave, HUD VHS y polaroids; escritura, borrado y cambios de lámina.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `../../_tools/lyrics-sad/build/ (sad-common.js + estilo)`.

## Tipografía y color

Miniatura A: **Special Elite 400**. B: **Special Elite 400**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{
  "googleUrl": "https://fonts.googleapis.com/css2?family=Caveat:wght@500&family=Special+Elite&family=VT323&display=swap"
}
```

Paleta declarada por el video:

```json
{
  "palette": {
    "dark": "#1A1410",
    "cream": "#EADFC8",
    "sepia": "#A88B62",
    "rose": "#B9877A",
    "ink": "#3A2A1E",
    "vhs": "#E8A84A"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-memoria`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-memoria](../../docs/previews/lyrics-memoria.jpg)

## Movimiento, transiciones y componentes

Special Elite, Caveat y VT323 en crema, sepia y rosa. Película antigua, weave, HUD VHS y polaroids; escritura, borrado y cambios de lámina.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `deepMerge`, `mulberry32`, `lerpStr`, `easeFn`, `div`, `measure`, `canvasText`, `tx`, `duoFilter`, `asStill`, `blurPass`, `noiseTile`, `loadScript`, `linesOf`, `buildTimeline`, `lyricPhrases`, `lyricTimeline`, `enterFx`, `pickTrans`, `preloadMedia`, `mediaSpec`, `mbox`, `kenBurns`, `syncVideos`, `buildScene`, `begin`, `sceneAt`, `mount`, `render`, `frame`, `boot`, `rows`, `footage`, `vignette`, `tint`, `fog`, `letterbox`, `rainFx`, `motes`, `word`, `line`, `lineNested`, `reveal`, `drip`, `crumble`, `smokeOut`, `burnChars`, `typeErase`, `later`, `leave`, `heartbeat`, `oldFilm`, `weave`, `vhsHud`, `polaroid`, `makeTimeline`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: no declara keyframes CSS; el movimiento se calcula en JavaScript/timeline.

Transiciones y animaciones CSS registradas en el código:

El timeline de JavaScript define los tiempos y las curvas. Usar las funciones de escena y `render/frame`, con el audio como reloj; no convertirlas en animaciones CSS independientes.

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.

## Miniaturas: revisión de fidelidad

Fuente: Special Elite 400 normal. Fondo de respaldo #1A1410; título #EADFC8; «LETRAS» #B9877A. Medio original por defecto: `assets/media/family-kitchen.mp4`; se conserva el medio con una capa negra del 20%. Las dos opciones comparten estilo y paleta y permiten cambiar imagen o fotograma. Las fuentes de color fijo provienen del CSS original; los colores configurables siguen el config activo.
