# Brief · tactico-territorios (Sol 6.1 xhigh) — familias A (territorios y banderas), rutas y flechas, rótulos

Antes: `work/briefs/_comun.md`. Referencias: ref1 completa (rellenos con bandera, fichas octogonales, choque, frentes), ref2
(banderas en postes, flechas curvas), ref3 (rótulos neón, carriles de ruta con chip, flechas de flujo), ref4 (anillo de alcance, rayo).

Componentes a entregar (archivos `territory.js`, `routes.js`, `labels.js`):
- Territorios: `territory.fill` (heredar y envolver el relleno de `engine/plano/territories.js`; NO lo reescribas, llámalo),
  `territory.flag` con **dos modos por JSON**: `flagMode:"fill"` (relleno con la bandera recortada al país, mezcla multiply+screen+overlay
  igual que ref1) y `"marker"` (bandera sobre poste con sombra, ref2), también `"both"` y `"none"`; las banderas salen de `../_mapas/flags.js`
  (148 banderas, se importa en lectura). Más `territory.hatch` (rayado), `territory.glow` (borde neón), `territory.extrude` (falsa
  extrusión con sombra desplazada), `territory.state` (cambio de estado fechado: ocupado/disputado/liberado con transición de color).
- `flag.marker` (independiente del territorio, p. ej. banderas en dos mercantes o capitales).
- `front.line` (línea de frente discontinua con rótulo «aproximado», avanza/retrocede entre posiciones fechadas por `states`),
  `range.ring` (anillo de alcance con pulso), `arrow.route`, `arrow.curve` (curva con punta y estela animada), `arrow.bolt`
  (rayo/zigzag entre dos puntos, ref4 0:08), `arrow.flow` (flechas de flujo onduladas, ref4 0:20+), `route.sea` (ruta marítima
  con puntos y trazo punteado animado; `validate` NO debe cruzar tierra: usa la utilidad de `core`/`validate.mjs`; si el núcleo aún
  no la expone, implementa tu comprobación local reutilizable), `route.lanes` (carriles de ruta con chip, ref3).
- Rótulos: `label.callout` (línea guía + ficha), `label.neon` (texto neón, ref3), `label.chip` (fecha/ficha pequeña), `label.figure`
  (cifra grande con unidad; sin inventar cifras), `text.year` (año gigante), `badge.count` (contador con número que rueda, ref5
  0:12), `icon.badge` (medallón con icono vectorial propio; set pequeño: avión, barco, petróleo, edificio, escudo, estrella).
Los textos largos se ajustan (`fit`) y nunca se salen del cuadro vertical; tipografía con contorno legible sobre satélite.
Escena de demostración `work/tactico/scene-territorios.json` con Irán/Irak/Kuwait/Omán y todos los modos de bandera.

## REANUDACIÓN Y RITMO (añadido el 2026-11-03; obligatorio)
- Esta tarea se interrumpió antes de terminar (se pausó el servidor por exceso de carga). **Revisa primero lo que ya existe** en tus
  carpetas y en tu log de trabajo previo (`work/logs/<tarea>.log` está vacío porque se reinició; mira los archivos). **Continúa y
  termina; no rehagas lo que ya funciona.**
- El servidor tiene 4 núcleos y 11 GB sin GPU, y se comparte. Trabaja con calma: ejecuta SIEMPRE los comandos pesados con
  `nice -n 15`; **un solo proceso pesado a la vez** (un Chromium O un Blender O un ffmpeg largo, nunca dos); Blender con
  `--threads 1`; Chromium con una sola página; espera a que termine cada prueba antes de lanzar otra; nada en paralelo.
- Si una prueba tarda minutos, espera: no es un fallo. Si el sistema te corta una prueba (SIGSTOP/SIGKILL externo por exceso de
  carga), vuelve a lanzarla más tarde, de una en una.
- Cierra siempre tus procesos hijos (Chromium, Blender) al terminar cada prueba para liberar RAM.
