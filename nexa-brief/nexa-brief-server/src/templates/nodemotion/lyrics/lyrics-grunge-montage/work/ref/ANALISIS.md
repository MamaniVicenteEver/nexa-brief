# Análisis de referencia: lyrics-grunge-montage (letras)

Fecha: 2026-11-16. Referencia: `src/templates/sandbox/referencias/nodemotion/LETRAS/34168690.mp4` (1920x1080, 25 fps, 68,06 s, 279 MB; solo en este equipo).
Base: `lyrics-grunge` (Grunge Rojo). ID propuesto: `lyrics-grunge-montage`. Nombre visible propuesto: Grunge Montaje (pendiente de confirmar).

## Hallazgos clave
- El audio del video es la canción de `lyrics-grunge` con 0,22 s de silencio inicial (correlación de envolvente 0,92). Por eso el proyecto fija `timeOffsetSec = 0.22` y reutiliza la canción ya registrada; no se copia el audio de la referencia.
- El texto en pantalla del video es una letra mal transcrita (por ejemplo «BOWL FULL OF PLENTY» donde la canción dice «Roll up 20, deep low»). Por orden del usuario se usa la letra real (transcripción Whisper de `lyrics-grunge`) en el mismo orden de escenas y tiempos.
- `lyrics-grunge` genera las escenas con un mazo aleatorio ponderado. La referencia es un montaje fijo de unas 53 tomas con composiciones propias; por eso la variante añade una línea de tiempo explícita (cambio propuesto: `montage`).

## Estructura por segundos (tiempos de la referencia)
| Tramo | Contenido |
|---|---|
| 0,0-1,4 | Línea roja con brillo que se junta desde tracking ancho; «DEEP» pasa de fino espaciado a pesado; corona de tiza y flecha roja hueca. Papel rasgado arriba y abajo. |
| 1,4-3,1 | Línea blanca cuyas palabras crecen una a una de fina espaciada a condensada; palabra roja ancha fina que engorda y se encierra en elipse de pincel blanco. |
| 3,1-4,6 | Palabra roja espaciada y palabra blanca espaciada que bajan al centro, flechas de tiza arriba y abajo; luego línea roja con garabato en espiral. |
| 4,6-7,0 | Línea roja que se encoge, tachón sobre una palabra, segunda línea blanca por palabras, subrayado y flecha curva, corte «scan» (franjas desplazadas). |
| 7,0-7,8 | Palabra roja tachada con pincel blanco; sube y aparece palabra blanca gigante debajo. |
| 7,8-11,4 | Línea blanca fina con iconos de reproductor (anterior, siguiente, play) dibujados en tiza; se apilan líneas roja y blanca; rayo rojo y blanco; corte scan. |
| 11,4-14,0 | Línea roja ancha, barra de tiza arriba, línea blanca pequeña y marco de tiza que se cierra. |
| 14,0-16,3 | Palabras gigantes una por pulso (blanca, roja, blanca ancha, roja con rayos de tiza), corte scan. |
| 16,3-20,9 | Pila de 5 repeticiones, línea roja con cruces de tiza, línea blanca fina que se corta, palabra roja encerrada en elipse, palabra blanca con arco. |
| 20,9-23,9 | Palabra roja enorme subrayada con fantasma; palabra blanca con flechas; rejilla de letras con tachones sobre negro. |
| 23,9-28,0 | Foco de escenario: palabras blancas y rojas apiladas con fantasma; línea blanca con flecha roja y anillo rojo. |
| 28,0-29,9 | Interludio instrumental solo con garabatos: corona, X, cara, ojos. |
| 29,9-61,4 | Repite las frases con tratamientos nuevos: bandas de papel negro, tachones con pincel, rejillas, pilas, palabras gigantes, cortes scan; cierre con marca roja gigante. |
| 61,4-64,0 | Resumen: collage de miniaturas de todas las piezas y garabatos que se desvanecen. |
| 64,0-68,0 | Tarjeta de papel gris con corona de tiza, marca roja y subrayado; papel vacío. |

## Estilo
Anton (condensada, desgastada con máscara), Archivo ancha y Oswald fina; rojo #E8292E, blanco, negro y papel claro; metraje en blanco y negro duro con niebla y viñeta; grano global; tiza y pincel con borde rugoso.

## Riesgos y diferencias conocidas
- El metraje de la referencia (stock de terceros) no se usa: se rotan los 6 clips Pexels de `lyrics-grunge`; la composición y el texto sí replican la referencia.
- Tiempos medidos a 0,2 s; animaciones internas aproximadas; el collage final no reproduce cada miniatura.
- Sin render ni validación HyperFrames (requiere permiso).
