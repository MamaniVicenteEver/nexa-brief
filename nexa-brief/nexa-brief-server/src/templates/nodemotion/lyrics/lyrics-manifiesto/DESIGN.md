# lyrics-manifiesto · diseño reproducible

Manifiesto editorial en papel y tinta. Láminas tipográficas de pleno, columna, contrapunto, microtexto y borde. Cambios de escala y composición al ritmo de frases, con grano sutil.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Archivo 900**. B: **Archivo 900**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{}
```

Paleta declarada por el video:

```json
{
  "colors": {
    "paper": "#F4F2EE",
    "ink": "#0A0A0A"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-manifiesto`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 34,5% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-manifiesto](../../docs/previews/lyrics-manifiesto.jpg)

## Movimiento, transiciones y componentes

Manifiesto editorial en papel y tinta. Láminas tipográficas de pleno, columna, contrapunto, microtexto y borde. Cambios de escala y composición al ritmo de frases, con grano sutil.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `mulberry32`, `buildCard`, `loadLyrics`, `groupPhrases`, `shuffledDeck`, `nextMode`, `fitInner`, `buildPleno`, `buildColumna`, `buildContra`, `buildMicro`, `buildBorde`, `placeLamina`, `begin`, `maybeOutro`, `updateMeta`, `frame`, `setupBg`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `bgDrift`, `gsh`.

Transiciones y animaciones CSS registradas en el código:

- `opacity 0.7s ease`
- `bgDrift 52s ease-in-out infinite alternate`
- `gsh 1.1s steps(4) infinite`
- `opacity 0.9s ease`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.

## Miniaturas: revisión de diseño

Archivo negra sobre el papel #F4F2EE del config. A y B alternan pleno y contorno editorial cuando hay varias filas; no hay medio de fondo por defecto. Las dos opciones comparten paleta; el texto, el fondo y el encuadre siguen siendo independientes.
