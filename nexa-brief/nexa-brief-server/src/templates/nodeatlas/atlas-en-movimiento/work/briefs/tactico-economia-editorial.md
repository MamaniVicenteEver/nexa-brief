# Brief · tactico-economia-editorial (Sol 6.1 xhigh) — familias D (sitios y economía) y F (editorial)

Antes: `work/briefs/_comun.md`. Referencias: ref2 (planta isométrica con extrusión, año y explosión), ref3 (iconos de petróleo, pilas de
dinero), ref4 (bases isométricas, prensa + recorte presidente Irán 0:10–0:15; NO replicar titular), ref5 (ficha de foto con haz 0:59).
Archivos `sites.js`, `economy.js`, `editorial.js` y el pipeline de medios `tools/media.mjs` + `assets/media/`.
- D: `site.plant`, `site.refinery`, `site.oilfield`, `site.port` (terminal con tanques y muelle), `site.base`, `site.platform`
  (plataforma petrolera), todos como edificios vistos desde arriba con falsa extrusión y sombra (isométrico simple dibujado con
  canvas; escala por zoom; estados `normal|hit|burning|ruined`), `money.stack` (pila de billetes, ref3), `money.flow` (billetes que
  viajan por una ruta), `route.lanes` ya lo hace `tactico-territorios`: usa el suyo si existe.
- F: `portrait.badge` (retrato circular/octogonal con cargo y fecha), `portrait.cutout` (recorte del retrato sobre una forma, borde
  y sombra), `editorial.press` (composición «retrato + documento/prensa» SIN texto de titular inventado: usa solo un `docText` que
  el episodio provee y atribuye con `credit`), `callout.photo` (ficha de foto/documento con haz de luz que baja hasta el punto del
  mapa, ref5 0:59, con `credit` visible y pie), `inventory.units` (rejilla de iconos de unidades con contador).
- Medios: descarga y prepara con `tools/media.mjs` (Node: fetch a Commons, recodifica con `sharp` si ya está instalado o con ffmpeg;
  no instales dependencias nuevas) las 23 candidatas de `work/research/MEDIOS.md` que se usen en la historia (ver ESTRUCTURA.md:
  retratos de los dirigentes del periodo y fotos A01 Stark, A04/A05 Iran Ajr, A06–A08 Mantis, A09/A10 resolución). Solo PD, CC0, CC BY, CC BY-SA.
  Guarda en `assets/media/` + `assets/media/credits.json` (autor, licencia, URL, fecha, uso) y `CREDITS.md`. Recortes de retratos con
  fondo liso o máscara suave (sin IA generativa). Si una foto no abre o la licencia no coincide, la omites y lo anotas.
Escena `work/tactico/scene-editorial.json`.

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
