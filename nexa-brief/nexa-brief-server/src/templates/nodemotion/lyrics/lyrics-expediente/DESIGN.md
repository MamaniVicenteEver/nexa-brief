# lyrics-expediente · diseño reproducible

Expediente con Special Elite, Oswald y Caveat. Grupos de palabras, papeles rasgados, hilos y lámpara. Golpe corto de entrada, polvo y parpadeo discontinuo.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Special Elite 400**. B: **Special Elite 400**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{}
```

Paleta declarada por el video:

```json
{}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-expediente`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-expediente](../../docs/previews/lyrics-expediente.jpg)

## Movimiento, transiciones y componentes

Expediente con Special Elite, Oswald y Caveat. Grupos de palabras, papeles rasgados, hilos y lámpara. Golpe corto de entrada, polvo y parpadeo discontinuo.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `mulberry32`, `loadLyrics`, `newCluster`, `fontSizeFor`, `tornPoly`, `makeThread`, `placeWord`, `begin`, `maybeOutro`, `sizeDust`, `drawDust`, `frame`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `slam`, `lampFlick`, `gsh`, `hintPulse`.

Transiciones y animaciones CSS registradas en el código:

- `stroke-dashoffset 0.55s cubic-bezier(0.3, 0.7, 0.3, 1)`
- `opacity 0.9s ease, filter 0.9s ease`
- `slam 0.17s cubic-bezier(0.15, 0.9, 0.3, 1.2)`
- `opacity 0.3s ease`
- `lampFlick 9s steps(1, end) infinite`
- `gsh 1s steps(4) infinite`
- `opacity 0.5s ease-out`
- `opacity 1.3s ease`
- `hintPulse 2s ease infinite`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.

## Miniaturas: revisión de diseño

Special Elite crema #EFE6CF sobre el negro cálido #14110C; «LETRAS» usa #E0503E, tomado de los acentos del expediente. No hay imagen de fondo por defecto. Las dos opciones comparten paleta; el texto, el fondo y el encuadre siguen siendo independientes.
