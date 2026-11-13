# promo-sports · diseño reproducible

Roboto negra e inclinada, amarillo sobre negro. Metraje deportivo, polvo, contornos gigantes y marcos. Aparición de palabras, scramble y diagonales de energía.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `../../_tools/commercial/build/ (sports.js y promo-sports.spec.json)`.

## Tipografía y color

Miniatura A: **Roboto 900**. B: **Roboto 900**. Estilo: `italic`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{
  "googleUrl": "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@1,900&display=swap"
}
```

Paleta declarada por el video:

```json
{
  "palette": {
    "yellow": "#EBE609",
    "dark": "#050607",
    "white": "#F3F3F1",
    "ink": "#0B0B0B"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.promo-sports`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

Ambas opciones parten de escenas reales del video, pero no son copias: Roboto 900 cursiva, amarillo #EBE609, blanco #F3F3F1 y fondo #050607. Los grades del video se aplican como filtros SVG (`cine`: saturación .55, contraste 1,18, brillo .72; `duoYel`: #0A0A03→amarillo). Llevan viñeta y grano.

**A (escena «DEPORTE», segundo 1):** toma «cine» con un velo frío. La palabra más larga va en letras gigantes de piedra moteada (#DEDBD3), más pequeñas que en el video para que quepan enteras. El titular amarillo con espaciado va más grande (≈96 px sobre 720) sobre una franja oscura inclinada que sólo cubre el centro de la piedra.

**B (escena «ENERGÍA», segundo 15):** toma «cine» oscurecida con un velo frío #05080C (mínimo 50%), sin tinte amarillo, para que el contorno amarillo y el titular blanco sean los únicos colores. Una sola palabra de fondo, sólo en contorno amarillo y muy grande (unos 1500 px de ancho sobre 1280): se recorta un poco por los lados pero se lee. El titular blanco espaciado va más grande (≈112 px) con sombra y una raya amarilla inclinada.

Titular por defecto: el primer rótulo del guion sin # ^ ~ * (por ejemplo «DEPORTE»), porque Sports no tiene un rótulo de dos filas útil. Sin «LETRAS» ni artista.

![Miniaturas A y B de promo-sports](../../docs/previews/promo-sports.jpg)

## Movimiento, transiciones y componentes

Roboto negra e inclinada, amarillo sobre negro. Metraje deportivo, polvo, contornos gigantes y marcos. Aparición de palabras, scramble y diagonales de energía.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `deepMerge`, `mulberry32`, `lerpStr`, `easeFn`, `div`, `measure`, `canvasText`, `tx`, `duoFilter`, `asStill`, `blurPass`, `noiseTile`, `loadScript`, `linesOf`, `buildTimeline`, `lyricPhrases`, `lyricTimeline`, `enterFx`, `pickTrans`, `preloadMedia`, `mediaSpec`, `mbox`, `kenBurns`, `syncVideos`, `buildScene`, `begin`, `sceneAt`, `mount`, `render`, `frame`, `boot`, `footage`, `dust`, `outlineBig`, `word`, `scramble`, `frameBox`, `base`

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
