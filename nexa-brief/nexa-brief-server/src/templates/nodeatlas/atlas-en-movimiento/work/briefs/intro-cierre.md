# Brief · intro-cierre (Sol 6.1 high)

Antes: `work/briefs/_comun.md`. Intro ≤6 s y cierre ≤8 s NUEVOS, dirigidos por datos (JSON), en el lenguaje visual de Atlas (mapa,
rótulos neón, tipografía de las referencias), sin copiar las de bolivia-mar ni las del explainer-kit. Revisa cómo las resuelve `../_proto/proto.js`
(`intro`, `outro`, `captions`) y `../_mapas/ESCENA.md` para integrarte sin modificarlo: si Proto permite componentes propios de intro/outro,
úsalo; si no, implementa `intro.title` y `outro.channel` como items de `engine/tactico/components/intro.js` en la capa 90 que ocupan
t 0–6 y los últimos 8 s.
- `intro.title`: título + subtítulo + año, con un gancho visual propio (p. ej. el mapa se «enfoca» desde un anillo que cierra sobre el
  Golfo, trazo neón del título, `fx.ring`), parámetros: `title`, `subtitle`, `kicker`, `focus`, `style` (3 variantes) y `dur`.
- `outro.channel`: orden fijo gracias → nombre del canal → «me gusta» → suscribirse + campana → apoyo → handle (sin recuadro; ver
  `../../EXPLAINER.md` §4; el handle real del canal lo confirma el usuario: usa el parámetro `handle` sin inventarlo, por defecto
  `youtube.com/@nodehistory`), mapa quieto de fondo y atenuación, ≤8 s.
Hoja con ambos en 9:16 y 16:9 (`work/tactico/sheets/intro-cierre.jpg`), demo `work/tactico/scene-intro.json`, RESULT.

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
