# Banderas de Atlas en Movimiento

Las banderas no se estilizan: representan a un país y conservan sus colores reales (la de EE. UU. no toma el rojo del estilo). El estilo solo decide su tamaño en el rótulo de unidad (`estilos.unidad.bandera`, 30 × 16 px en V4) y dónde va.

## Qué existe hoy
- Banderas de reserva dibujadas por código en `components/units.js` (`flagFill`): **US, RU, UA, IR, IQ, FR, GB** (franjas simples; US con cantón). Se usan cuando la escena no aporta una imagen.
- Si el contexto aporta una imagen (`env.flag(code)`), `flagFill` la usa en lugar del dibujo de reserva. Referencia de banderas ya preparadas en otros prototipos: `nodeatlas/japon-expansion-prueba/assets/flags/` y `_mapas/flags.js`.
- Una unidad elige su bandera con `flag:"US"`. En el rótulo de unidad la bandera solo aparece si la unidad es protagonista (`main:true`) o lleva `labelFlag:true`.
- Pendiente de comprobar (no se verificó): el camino exacto por el que una imagen nueva llega a `env.flag(code)` en una escena real. Hazlo con una bandera de prueba antes de generar muchas.

## Banderas que probablemente faltan
Irak y Irán ya están; faltan, según los videos previstos: Reino Unido (hay GB de reserva), Argentina, China, Israel, Alemania, Japón, Corea del Sur y del Norte, Bolivia, Chile, Perú, Brasil, México, Turquía, Arabia Saudita, Kuwait, Siria, Egipto, India, Pakistán, Italia, España, Países Bajos, OTAN, ONU.

## Prompt plantilla para crear una bandera (imagen)
```
Bandera oficial de {PAÍS}, vista frontal plana, proporción {3:2 | 2:1 | 1:1 según la bandera oficial}, colores y
proporciones exactos de la bandera oficial vigente en {AÑO}, sin texto añadido, sin mástil, sin ondulación,
sin brillos ni degradados, bordes rectos y nítidos, fondo transparente, PNG de 480 x 320 px.
Debe leerse bien reducida a 30 x 16 px: simplifica detalles finos del escudo sin cambiar su color ni su posición.
```
Reglas: usa la bandera de la época del video (Irak 1980 no es la de hoy; Alemania 1940 no es la de hoy); no uses emblemas con derechos de marca; guarda como `<CÓDIGO>.png` y registra el código en el catálogo de banderas del prototipo. Si hay variantes históricas, usa códigos distintos (`IQ-1980`).

## Banderas animadas (ondeo)
`army.*` dibuja la bandera con ondeo propio (`drawGroundFlag`); el ondeo es animación y mantiene sus colores. Solo cambia la imagen de la bandera, no su movimiento.
