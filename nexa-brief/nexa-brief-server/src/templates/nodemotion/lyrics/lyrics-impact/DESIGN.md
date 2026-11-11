# lyrics-impact · diseño reproducible

Anton roja sobre metraje oscurecido. Una palabra dominante por grupo, revelado breve, punch de cámara y sacudidas. Respiración lenta del fondo y grano discontinuo.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Anton 400**. B: **Anton 400**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{
  "googleUrl": "https://fonts.googleapis.com/css2?family=Anton&display=swap",
  "display": "\"Anton\", sans-serif"
}
```

Paleta declarada por el video:

```json
{
  "colors": {
    "ink": "#D2222A",
    "feats": "#8f8f92",
    "hint": "#a09da0"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.lyrics-impact`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 30% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de lyrics-impact](../../docs/previews/lyrics-impact.jpg)

## Movimiento, transiciones y componentes

Anton roja sobre metraje oscurecido. Una palabra dominante por grupo, revelado breve, punch de cámara y sacudidas. Respiración lenta del fondo y grano discontinuo.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`loadDB`, `applyTheme`, `mulberry32`, `loadLyrics`, `groupClusters`, `bigIndex`, `beginCluster`, `revealWord`, `punch`, `applyShake`, `begin`, `maybeOutro`, `frame`, `setupBg`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: `bgBreath`, `gsh`, `hintPulse`.

Transiciones y animaciones CSS registradas en el código:

- `opacity 0.9s ease`
- `bgBreath 40s ease-in-out infinite alternate`
- `transform 0.5s ease, opacity 0.5s ease, filter 0.5s ease`
- `transform 0.16s cubic-bezier(0.2, 1.3, 0.4, 1), opacity 0.12s ease`
- `gsh 0.9s steps(4) infinite`
- `opacity 1.1s ease`
- `opacity 1.6s ease`
- `opacity 1.6s ease, filter 1.6s ease`
- `hintPulse 2s ease infinite`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.
