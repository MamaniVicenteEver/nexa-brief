# living-landscape · diseño reproducible

Paisaje vivo con Shippori Mincho y Montserrat. Pétalos, aves, niebla, luciérnagas y estrellas en canvas; poema adaptable y cambios lentos de color.

Esta ficha se complementa con la [guía común de NodeMotion](../../DESIGN.md). Código del video: `index.html`; configuración: `assets/config.json`. Fuente editable del motor: `index.html`.

## Tipografía y color

Miniatura A: **Shippori Mincho 700**. B: **Shippori Mincho 700**. Estilo: `normal`. Las fuentes y combinaciones del video se conservan en el config y CSS originales:

```json
{}
```

Paleta declarada por el video:

```json
{
  "palette": {
    "petals": [
      {
        "fill": "#FFA500",
        "stroke": "#FF4500",
        "vein": "rgba(255,200,150,0.8)"
      },
      {
        "fill": "#FF4500",
        "stroke": "#D2691E",
        "vein": "rgba(255,180,100,0.7)"
      },
      {
        "fill": "#FFD700",
        "stroke": "#B8860B",
        "vein": "rgba(255,255,200,0.9)"
      },
      {
        "fill": "#FF8C00",
        "stroke": "#8B0000",
        "vein": "rgba(255,150,100,0.8)"
      },
      {
        "fill": "#D2691E",
        "stroke": "#5C2E0B",
        "vein": "rgba(200,100,50,0.6)"
      }
    ],
    "fog": "110,55,75",
    "bird": "#ff9a6c",
    "textCycle": [
      "#421A25",
      "#FFA500"
    ],
    "brand": "#ff9a6c",
    "firefly": "rgba(255, 215, 0, 0.6)",
    "star": "rgba(255, 240, 220, 0.85)"
  }
}
```

Los tokens complementarios de miniaturas se consultan en `../../design-tokens.json` → `templates.living-landscape`. No sustituir estos colores por la paleta de otra plantilla. Los campos dependientes del medio (filtro, contraste, mezcla) pertenecen al config del video; en miniaturas, ajustar el oscurecimiento del fondo sin perder su motivo.

## Composición y miniaturas

A ocupa el centro con hasta cinco palabras en una o dos filas. B admite una frase más larga en hasta cuatro filas. Mantener la paleta en ambas. Fondo independiente de imagen propia o del medio existente, con recorte a sangre y encuadre ajustable. Sin artista; «LETRAS» siempre debajo de la última fila, alineada a su extremo derecho, con el color principal de la plantilla a opacidad completa, al 24,3% en A y al 30% en B, con el hueco al 25,2% del original en A y al 28% en B. NODEMOTION queda discreta en la esquina inferior derecha.

![Miniaturas A y B de living-landscape](../../docs/previews/living-landscape.jpg)

## Movimiento, transiciones y componentes

Paisaje vivo con Shippori Mincho y Montserrat. Pétalos, aves, niebla, luciérnagas y estrellas en canvas; poema adaptable y cambios lentos de color.

Funciones disponibles en el motor (nombres reales para localizar el comportamiento):

`updateCache`, `createPetalImage`, `rotateVector`, `resize`, `initEntities`, `animate`, `fitHaikuToViewport`, `updateHaikuColors`, `initAudioContext`, `startAudioPlayback`, `boot`

Las funciones `loadDB/loadConfig` cargan datos; `loadLyrics` y las funciones `group/buildPlan/buildTimeline` organizan la letra; las funciones `place/build/make` construyen piezas; `frame/render/draw` actualizan el estado. Los nombres que no aparezcan arriba no forman parte de este motor. Conservar su separación al replicarlo.

Keyframes CSS declarados: no declara keyframes CSS; el movimiento se calcula en JavaScript/timeline.

Transiciones y animaciones CSS registradas en el código:

- `opacity 1.5s ease`
- `color 1.2s ease`
- `background 1.2s ease`
- `color 1.2s cubic-bezier(0.25, 1, 0.5, 1), text-shadow 1.2s ease, transform 1s ease`

## Receta para replicar

1. Cargar el config activo y los medios relativos; mantener paleta y familias tipográficas anteriores.
2. Seguir la descripción de composición y las funciones de escena. Conservar la semilla para que las elecciones aleatorias se repitan al buscar un tiempo.
3. Mantener los tiempos de transición indicados y los del timeline del código cuando no hay CSS. La entrada de cada palabra sigue `lyrics.json` y el reloj del audio.
4. Adaptar a 16:9 y 9:16 con las reglas originales de viewport; comprobar que la palabra dominante cabe completa.
5. Para miniaturas, usar el renderer compartido y las reglas A/B. Capturar ambas y comparar a tamaño pequeño; verificar también el JPEG final de la opción elegida.
