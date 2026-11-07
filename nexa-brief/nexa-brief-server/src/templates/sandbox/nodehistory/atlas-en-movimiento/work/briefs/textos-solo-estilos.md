# Brief · textos-solo-estilos (Sol 6.1 high) — REHACER `diseno-textos.html`: SOLO los estilos de texto, en GRANDE

## Qué pidió el usuario (literal) y por qué la versión anterior está MAL
«Quiero la transcripción en grande, todo el diseño de la transcripción, quiero ver el color como está, y lo mismo de los demás. En el index solo poner el texto con el estilo, no quiero ver mapas, nada, solo los estilos de los textos que usamos en el video.»
La versión anterior (`diseno-textos.html` de la tarea inventario-textos) puso las muestras pequeñas dentro de paneles, con fondo satelital, filtros y complementos que no salen en el video. **Eso es lo que NO quiere.**

## Qué debe ser la página nueva (reescribe `diseno-textos.html`; guarda la anterior como `diseno-textos.v1.html`)
- **SOLO texto sobre fondo LISO.** Ningún mapa, ninguna imagen satelital, ningún cuadro de video, ni iframes. Fondo liso con un selector de 3 fondos (oscuro `#0b1620`, negro, claro `#f4efe3`). Nada más en la pantalla que los estilos de texto y sus datos.
- **GRANDE.** Cada estilo ocupa el ancho de la página (una columna, muestras al menos 2,5× el tamaño real del video: el texto de la transcripción que en el video mide 45 U debe verse a ≥ 110 px de alto de letra). Nada de miniaturas.
- **El color a la vista, exacto.** Junto a cada muestra: la ficha con recuadros de color (muestras de color con su código hex escrito) para relleno, contorno, fondo de caja y borde; fuente (familia y peso real), tamaño en px a 1080 de ancho, grosor de contorno, radio, sombra, mayúsculas.
- **Orden:**
  1. **TRANSCRIPCIÓN (subtítulos)**: lo primero y lo más grande, a todo el ancho, con la letra REAL de `assets/lyrics.json` (un tramo de 12–15 s) animada palabra a palabra con su animación real (grupos de hasta 3 palabras, escala 0,85→1 en 0,18 s, pausas 0,45 s), botón «Reiniciar» y control de velocidad. Debajo, la ficha completa (relleno `#f6edb4`, contorno negro, Archivo Black, etc., verificados en el código, no de memoria).
  2. Rótulos: chip de fecha, chip de leyenda, etiqueta de nombre (unidad/instalación), callout con línea guía, país neón (IRÁN / IRAK), año gigante, cifra, etiqueta de frente (rosa/rojo), chip de ruta (ORMUZ), crédito/atribución.
  3. Tarjetas con texto: pie de retrato (nombre, cargo, fecha, crédito), tarjeta de documento/prensa (titular de la ficha, línea de procedencia), pie de foto con crédito.
  4. Título de intro (titular + subtítulo + año) y texto de cierre del canal (gracias, nombre, «me gusta», suscribirse, apoyo, handle).
- **Cada muestra con su animación real** (entrada y salida o karaoke) y un botón «Repetir».
- El texto de ejemplo debe ser el REAL del video (frases de `assets/scene.json`), no inventado.
- Mantén la marca «DESAGRADA» (un distintivo pequeño) en los que el usuario señaló: transcripción, cajas con borde, rosa del frente, tarjeta con octógono.
- Debe servir por `http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/diseno-textos.html` sin errores y cargar en menos de 5 s (solo fuentes locales, sin teselas, sin motor de mapa).

## Cómo hacerlo fiel
Reutiliza los valores REALES de `engine/tactico/components/labels.js`, `routes.js`, `editorial.js`, `intro.js`, `captions.js` y `../_proto/proto.js` (captions), y `work/texto/INVENTARIO.md`. Dibuja con canvas 2D (mismo código de texto y contorno que el video, escalado ×2,5 o más con `devicePixelRatio`) o con CSS equivalente; en cualquier caso **compáralo con un recorte real** de `work/escena/cuadros/` (misma frase) y confirma que se ve igual (pega la comparación lado a lado en `work/texto/capturas/comparacion-transcripcion.png`).
Mejora la lectura: nada de paneles dentro de paneles, mucho espacio, títulos de sección claros.

## Entrega
`diseno-textos.html` nueva, `work/texto/capturas/` con: página completa a 1440 px de ancho (varias capturas por secciones), zoom de la transcripción en cada instante de su animación (tira de 6 cuadros), y la comparación con el video. **Mira tus capturas**: si ves mapas, cajas pequeñas o texto a menos de 2,5×, la entrega está mal; corrígela. `work/results/textos-solo-estilos.md`.
Reglas: escribir solo en `atlas-en-movimiento/`; no tocar `assets/scene.json`, `_proto/`, `.py`, ni la web; sin emojis; `nice -n 15`, un Chromium a la vez; no grabar MP4.
