# lyrics-kinetic-noir · diseño reproducible

Cinético Noir: tipografía cinética en blanco sobre azul casi negro. Cada frase de la letra ocupa una composición propia, con trazos finos de luz que derivan en el fondo y humo gris ocasional abajo. Se complementa con la [guía común de NodeMotion](../../DESIGN.md).

Referencia visual: video de Klickpin «Vision Journal Ideas Everyone Is Loving» (pin 810999845419237013). Se tomó el lenguaje (tipos pesados, recuadros, barras, inversiones, cortes en bandas), no el audio, el texto ni el fondo.

## Tipografía y color

| Uso | Fuente | Licencia |
|---|---|---|
| `expanded` (pila, marco, caja, intro) | Archivo Expanded Black | OFL |
| `condensed` (barra, cita, resaltado) | Anton | OFL |
| `slab` (eco, subtítulo, outro v1) | Alfa Slab One | OFL |
| `sans` (subtítulos pequeños espaciados) | Archivo variable, peso 800 | OFL |
| `script` (crédito de la cita) | Kaushan Script | OFL |

Colores (`config.colors`): fondo `#05070C`, resplandor `#111726`, tinta `#FFFFFF`, gris de entrada `#7D8698`, cursor `#E5332A`, crédito `#7FD3FF`, humo `#9DA3AE`.

## Cómo se arma el video

1. La letra Whisper se divide en versos (cambio de segmento, mayúscula inicial o silencio) y cada verso largo se reparte en partes equilibradas (`phrase.maxWords`, `maxChars`, `maxSec`).
2. Cada frase elige una composición por peso (`layouts.deck`) entre las que admiten su tamaño, sin repetir las dos últimas. La semilla fija el resultado.
3. Cada palabra entra en su tiempo cantado. Los huecos largos muestran una pausa. Hay intro si la letra empieza después de `intro.minSec` y outro al final.
4. El reloj es `audio.currentTime`. Cada cuadro se dibuja desde el tiempo, sin estado acumulado, así que el seek es exacto.

| Composición | Capacidad | Movimiento |
|---|---|---|
| `bar` | 1-5 palabras, ≤ 26 letras | barra que se abre; texto en diferencia sobre la barra; sale encogiendo |
| `stack` | ≥ 3 palabras | renglones cortos con sangrías alternas; tecleo con mezcla de caracteres |
| `quote` | ≥ 3 palabras | palabras en gris que se encienden; crédito manuscrito |
| `ghost` | 1-2 palabras, ≤ 16 letras | entrada inclinada; dos copias tenues desplazadas |
| `subtitle` | 2-7 palabras | slab tecleada con cursor rojo; resto pequeño espaciado |
| `frame` | 1-4 palabras, ≤ 26 letras | recuadro que se traza; sale borrando letras de derecha a izquierda |
| `box` | ≥ 4 palabras | primer renglón en caja blanca invertida |
| `highlight` | ≥ 4 palabras | palabra cantada en bloque blanco |

Efectos comunes: corte en bandas al entrar cada palabra (0,07 s) y al cerrar la escena (`effects.glitchSec`, 0,18 s). En 9:16 las composiciones reparten el texto en más renglones.

## Vista previa y piezas

`showcase/index.html?only=noir.<pieza>&aspect=16:9|9:16&t=<s>&p=<json>` muestra una pieza suelta. El catálogo de piezas está en `showcase/components.json`. En el video completo, `?t=<s>` congela un instante y `?debug=1` muestra la escena activa.
