# Brief · tactico-unidades (Astra xhigh) — familias B (peones/frentes) y C (barcos, aviones, portaaviones)

Antes: `work/briefs/_comun.md`. Es la tarea CRÍTICA: lee `PLAN.md` §4 C y §5 completos y `REFERENCIAS.md` tabla de la ref5 (portaaviones),
mira `work/ref/ref5-detalle-a/c/d.jpg`, `ref5-flota-51-58s.jpg`, `ref5-camara-26-30s.jpg`, `ref3-detalle.jpg`, `ref4-bombarderos-0-3s.jpg`.
Los sprites los hace la tarea `sprites` (`engine/tactico/sprites/sprites.json`): si aún no están, usa las siluetas vectoriales
de `sprites.js` y cambia solo cuando existan, sin cambiar la API.

Archivos: `units.js` (B), `naval.js`, `air.js`.
- B: `unit.token` (ficha octogonal con bandera, ref1), `unit.group` (varias fichas en formación), `unit.move`, `unit.advance` y
  `unit.retreat` (recorren una `path` con frente/estela), `fx.clash` (choque entre dos grupos).
- C naval: `naval.cargo` (variantes `tanker|container|bulk`), `naval.warship` (variantes `destroyer|frigate|cruiser`), `naval.submarine`
  (opaco y translúcido azul ref5 0:30 con rótulo y línea guía), `naval.group` (formación `line|diamond|box|escort-ring` con líder y escoltas
  por referencia a otros ids o por tipo), `naval.carrier`.
  Estados visuales de casco: `normal|detected|targeted|hit|burning|wrecked|sunk` (ref5: detectado = anillo/rótulo rojo; burning = sprite
  quemado + `fx.fire`/humo propios; wrecked = oscurecido; sunk = escora y hundimiento con espuma), transición interpolada por `states`.
  Orientación SIEMPRE por la trayectoria (`heading:"auto"`), estela de agua (V que se abre y se desvanece) y sombra proyectada.
  Escala por eslora relativa de `sprites.json` y modo `scaleMode:"screen"|"geo"`.
- `naval.carrier` según PLAN §5, JSON del ejemplo exacto: variantes `supercarrier|stovl|hero|inventory`; `deck.aircraft` (nº de aviones
  aparcados sobre la cubierta); `escorts:{formation,units}` que fabrica un `naval.group` coordinado (misma `path`, offset de formación,
  giros suaves); estados incl. `flightops` (luces/humo de catapulta); acciones `air.launch` y `air.recover` (aviones salen/entran
  por la cubierta angulada: ESTAS acciones no están en las referencias, documéntalo); `follow` ya lo resuelve el núcleo (camera macro).
  `variant:"hero"` = objeto gigante sobre un país (ref5 0:02) y `"inventory"` = cuadrícula de N portaaviones dentro de un territorio
  con `badge.count`-like contador (ref5 0:12; usa `badge.count` de `tactico-territorios` si ya existe o un contador local).
  Variantes claramente distinguibles de mercante y buque de guerra a tamaño de pantalla (silueta, color de casco, rótulo).
- C aire: `air.bomber` (variantes `wing|swept`), `air.jet` (`attack|fighter`), `air.helicopter` (cuerpo + rotor girando por `t`),
  `air.prop` (transporte), `air.drop` (caída de bombas con sombra que se acerca y destello; NO en las referencias), `air.launch`,
  `air.recover`. Orientación por rumbo, estela `trail.contrail` si la tarea fx ya existe (si no, el campo `contrail:true` guarda el
  parámetro y se activa cuando el componente esté), sombra desplazada que crece con la altura.
- `units.json` (en `engine/tactico/`): tipos → sprite, eslora relativa, velocidad nominal (nudos), sonido por defecto (`sfx`),
  dominio (`sea|air|land`).
Tira de movimiento: `work/tactico/sheets/unidades-tira-10fps.jpg` con un convoy girando, un portaaviones con escoltas virando
y 2 aviones despegando; verificar que el rumbo nunca salta y que la formación no se cruza.
Escena `work/tactico/scene-unidades.json` (incluir el portaaviones del ejemplo JSON de PLAN §5 y una cámara `follow`).

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
