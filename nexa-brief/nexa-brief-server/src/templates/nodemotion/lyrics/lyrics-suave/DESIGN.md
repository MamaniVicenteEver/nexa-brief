# lyrics-suave · diseño reproducible

Anton y Permanent Marker, fondo fotográfico oscuro y cálido. Filas de lectura, polvo y cámara suave; opacidad, desplazamiento y desenfoque progresivos.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Anton 400**. B: **Anton 400**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{}
```

Paleta declarada por el video:

```json
{}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-suave`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-suave](../../docs/previews/lyrics-suave.jpg)

## Movimiento, transiciones y componentes

Anton y Permanent Marker, fondo fotográfico oscuro y cálido. Filas de lectura, polvo y cámara suave; opacidad, desplazamiento y desenfoque progresivos.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `mulberry32`, `buildCard`, `loadLyrics`, `groupIntoRows`, `fontSizeFor`, `placeRow`, `aimCamera`, `mulberrySeed`, `seedDust`, `drawDust`, `begin`, `maybeOutro`, `frame`, `setupBg`, `start`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `bgBreath`, `gsh`, `hintPulse`.

Transiciones y animaciones CSS registradas en el código:

- `opacity 1s ease`
- `bgBreath 50s ease-in-out infinite alternate`
- `opacity 0.9s ease, transform 0.9s cubic-bezier(0.2, 0.7, 0.3, 1), filter 1.4s ease`
- `gsh 1.1s steps(4) infinite`
- `opacity 1.3s ease`
- `opacity 1.8s ease`
- `hintPulse 2s ease infinite`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.

## Miniaturas: revisión de fidelidad

Fuente: Anton 400 normal. Fondo de respaldo #0A0A0B; título #EFEFF0; «LETRAS» #EFEFF0. Medio original por defecto: `assets/bg.jpg`; se conserva el medio con una capa negra del 20%. Las dos opciones comparten estilo y paleta y permiten cambiar imagen o fotograma. Las fuentes de color fijo provienen del CSS original; los colores configurables siguen el config activo.
