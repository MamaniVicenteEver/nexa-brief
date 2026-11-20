# Miniaturas A/B · lyrics-hologram

Las dibuja el renderer real de la app, `renderHologramSvg` en `src/core/draft_thumbnail_renderer.js`
(estilo `lyrics-hologram`, layout `hologram`). Se editan en el editor de miniaturas del borrador
como las demás plantillas: el texto y el fondo son independientes.

## Opción A · escena «holoWord»

- Fondo casi negro con viñeta y marco fino.
- Título (1 a 5 palabras, hasta 2 renglones) en Bebas Neue enorme con degradado holográfico y halo.
- Ecos en contorno arriba y abajo, fila de rombos lila y rótulos diminutos en los bordes.
- Subtítulo espaciado si `design.subtitle` tiene texto.

## Opción B · escena «panel»

- Fotograma del video (fondo `frame`) en duotono holográfico, dentro de una ventana con marco
  iridiscente a la derecha.
- Frase condensada blanca a la izquierda, con la última palabra en holo.
- Barra iridiscente debajo, rombos cian y rótulos en los bordes.

## Colores

Roles de `design-tokens.json`: fondo `void`, texto `white`, acento `h1`. El degradado usa además los
tonos de la paleta holográfica de la plantilla.

## Contrato y estado

Cubierto por las pruebas parametrizadas de `tests/unit/test_draft_thumbnails.py`: layout propio,
paleta tomada del config, tipografía de los tokens y subtítulo del sistema.

Pendiente: guardar A/B desde un borrador real (requiere crear el borrador).
