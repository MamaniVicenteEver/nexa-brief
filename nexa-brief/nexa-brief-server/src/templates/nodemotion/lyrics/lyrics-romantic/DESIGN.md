# lyrics-romantic · diseño reproducible

Composición romántica y lectura pausada. Serif de contraste y caligrafía según la plantilla; fondos oscuros, cámara suave, desenfoque, bokeh y latidos contenidos.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Great Vibes 400**, normal, rosa `colors.script`, como el título de la intro. B: **Playfair Display 500**, itálica, rosa `colors.script`, igual que A. LETRAS usa Playfair Display 700 itálica en ambas opciones: marfil en A y B. El rótulo de B crece un 15% y ambos se refuerzan con un trazo del mismo color. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{
  "googleUrl": "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@1,500;1,700&family=Great+Vibes&display=swap",
  "serif": "\"Playfair Display\", serif",
  "script": "\"Great Vibes\", cursive"
}
```

Paleta declarada por el video:

```json
{
  "colors": {
    "serif": "#F2E7DA",
    "script": "#D89A9E",
    "muted": "#cbb8ad"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-romantic`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. A usa caligrafía rosa y B serif itálica rosa, ambas sólidas y medidas con las fuentes locales reales. Se toman los hexadecimales del config activo, sin reinterpretarlos. El fondo utiliza la imagen o el video existente con recorte a sangre y encuadre ajustable. La imagen conserva sus colores originales, con una única capa negra del 20% por defecto y sin los filtros del video. Sin medio se conserva la paleta oscura. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color complementario nativo de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B. El hueco de A es el 90% del común. NODEMOTION queda discreta en la esquina inferior derecha, con peso 900 y trazo de 0,4 px.

![Miniaturas A y B de lyrics-romantic](../../docs/previews/lyrics-romantic.jpg)

## Movimiento, transiciones y componentes

Composición romántica y lectura pausada. Serif de contraste y caligrafía según la plantilla; fondos oscuros, cámara suave, desenfoque, bokeh y latidos contenidos.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `applyTheme`, `mulberry32`, `loadLyrics`, `groupIntoRows`, `fontSizeFor`, `placeRow`, `aimCamera`, `seedBokeh`, `drawBokeh`, `begin`, `maybeOutro`, `frame`, `setupBg`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `bgBreath`, `heartbeat`, `gsh`, `hintPulse`.

Transiciones y animaciones CSS registradas en el código:

- `opacity 1.2s ease`
- `bgBreath 58s ease-in-out infinite alternate`
- `opacity 1.6s ease, filter 1.8s ease, transform 1.2s ease`
- `opacity 0.5s ease, filter 0.7s ease`
- `heartbeat 1.6s ease 0.35s 1`
- `gsh 1.3s steps(4) infinite`
- `opacity 1.6s ease`
- `opacity 2.2s ease`
- `hintPulse 2.4s ease infinite`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.
