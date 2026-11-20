# Holograma Mundos · diseño

Variante de Holograma. Misma materia (seda holográfica, relleno holo dentro de las letras, contornos gigantes, barras, siluetas) con **mundos** de fondo y una línea de tiempo explícita que replica la referencia escena por escena.

## Mundos (bg)
void (negro azulado) · holo (seda holográfica animada con pliegues en diagonal, WebGL con respaldo 2D) · red (radial) · redflat (rojo plano #EE0A2B) · purple (degradado #10011E a #460B89) · violet · pale · ice (blanco hielo) · split (negro y rojo, parámetro cut) · media.

## Tipografía
Anton para la condensada y, con inclinación sintética, para la «extendida» (fw, scaleY 1,5 y relleno protegido contra el recorte del itálico). Noto Sans KR 900 para el coreano (fk).

## Línea de tiempo
`config.timeline[]`: { t0, t1?, type, bg, trans, p } por escena. Tipos: `intro`, `compose`, `outro` (v1/v2 según `config.outro.version` o `?outro=`).
Tiempos de corte medidos a 30 fps sobre la referencia (`work/tools/cuts.json`). El estribillo 2 (89,3 a 115,2 s) y el verso 2 (141,5 a 152,8 s) se generan repitiendo el estribillo 1 y el verso 1 con el desfase medido, como en el original. La Demo conserva esta coreografía y sus frases estáticas en `assets/config.json`. Al crear un prototipo, el servidor copia esa configuración y sustituye en el JSON del proyecto los textos de cada escena por palabras temporizadas de la transcripción elegida; ajusta el cierre a la duración del audio y omite texto cuando no hay palabras para ese instante. El motor compartido normaliza y reproduce ambas líneas de tiempo sin alterar el JSON fuente de la Demo.
`compose` dibuja `p.els` (text, rep, col, box, img, media, shape, orn, lab, ring, diag, dots, flash) con posición normalizada, relleno, entrada, tiempo (`at`, `to`) y movimiento (`mv`, `zm`, `rv`). Contrato completo en el comentario de components/worlds.js.
Tamaño del texto por **ancho** (`maxw`): fracción del ancho del cuadro que ocupa en la referencia.

## Arte
`img` usa las imágenes propias de assets/media/art como máscara (relleno holo, white, ink, color o gold) o tal cual (raw). `tone: "gold"` tiñe un objeto plateado. Medios en video: `look: "tint"` (escala de grises multiplicada por un color) o duotono holográfico.

## Movimiento
Entradas: cut, slide, stamp, glitch, spread, scatter (letras salteadas), words (palabra por palabra con tiempos `wt`), fade, wipeL/R/U/D, pop, rise. `sweep` rellena un contorno con un barrido. Cortes secos entre escenas, como la referencia; los glitches van en los elementos.
Reloj del motor (seek determinista). Sin Date.now ni azar sin semilla.

## Intro, cierres y miniatura
Intro = apertura real (emblema, silueta de perfil en seda, título y artista). Outro v1 = palabra gigante holográfica y tarjeta de marca (160 a 163 s). Outro v2 = tarjeta y seda final hasta el corte a negro (161 a 175 s). Miniatura: fotograma de 12 s («THE BADDEST» sobre la fila de siluetas).

## Límites conocidos
Sin arte de personajes ni logotipos (siluetas y emblemas propios). Objetos 3D y efectos finos aproximados. Vertical 9:16 legible pero sin recomponer. Coreano leído de los fotogramas.
