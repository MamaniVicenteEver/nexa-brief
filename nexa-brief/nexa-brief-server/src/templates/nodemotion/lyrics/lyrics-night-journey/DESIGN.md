# lyrics-night-journey · diseño reproducible

Viaje nocturno con Figtree, Noto Serif Display, Alegreya Sans y Newsreader. Luna, túnel, papel y rutas; asignación de escenas, entradas y salidas calculadas sobre el audio.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Noto Serif Display 800**. B: **Noto Serif Display 800**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{
  "googleUrl": "https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;800;900&family=Noto+Serif+Display:wdth,wght@62.5..100,300..800&family=Alegreya+Sans:wght@400;500;700&family=Newsreader:opsz,wght@6..72,400..500&display=swap",
  "ui": "\"Figtree\", system-ui, sans-serif",
  "display": "\"Noto Serif Display\", \"Times New Roman\", serif",
  "humanist": "\"Alegreya Sans\", \"Gill Sans\", sans-serif",
  "book": "\"Newsreader\", Georgia, serif"
}
```

Paleta declarada por el video:

```json
{}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-night-journey`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-night-journey](../../docs/previews/lyrics-night-journey.jpg)

## Movimiento, transiciones y componentes

Viaje nocturno con Figtree, Noto Serif Display, Alegreya Sans y Newsreader. Luna, túnel, papel y rutas; asignación de escenas, entradas y salidas calculadas sobre el audio.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `applyTheme`, `mulberry32`, `pickWeighted`, `rgba`, `el`, `setS`, `setV`, `applyFrame`, `buildScreen`, `splitInto`, `loadLines`, `allocate`, `sceneShell`, `makeCard`, `layout`, `render`, `makePath`, `enter`, `exit`, `makeMoon`, `makeTunnel`, `makePaper`, `wavy`, `begin`, `maybeOutro`, `init`, `frame`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `grainShift`, `hintPulse`.

Transiciones y animaciones CSS registradas en el código:

- `filter 1.8s ease, opacity 1.8s ease`
- `none`
- `grainShift 0.9s steps(5) infinite`
- `opacity 1.2s ease, filter 1.2s ease`
- `opacity .35s ease !important`
- `hintPulse 2s ease infinite`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.

## Miniaturas: revisión de fidelidad

Fuente: Noto Serif Display 800 normal. Fondo de respaldo #0B2B4F; título #FFF3DC; «LETRAS» #F0955A. Medio original por defecto: `assets/path.mp4`; se conserva el medio con una capa negra del 20%. Las dos opciones comparten estilo y paleta y permiten cambiar imagen o fotograma. Las fuentes de color fijo provienen del CSS original; los colores configurables siguen el config activo.
