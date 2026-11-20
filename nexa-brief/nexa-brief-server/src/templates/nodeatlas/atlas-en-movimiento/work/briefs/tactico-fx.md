# Brief · tactico-fx (Sol 6.1 xhigh) — familia E (efectos) y ataques

Antes: `work/briefs/_comun.md`. Referencias: ref2 (explosión y humo en planta, estelas rojas de misil), ref3 (mercantes en llamas
0:57–1:02), ref4 (rayo, estelas de bombarderos), ref5 (salvas, torpedos, onda de agua 0:57, anillos de sonar/objetivo).
Archivos `fx.js`, `strike.js`.

Componentes: `fx.explosion` (bola, chispas, destello, escombros; variantes `air|ground|naval`), `fx.impact` (impacto con
anillo; variante `water` con columna y espuma), `fx.shockwave` (onda circular con refracción simulada, ref5 0:57), `fx.smoke`
(columna/rastro con deriva, determinista por semilla), `fx.fire` (llamas sobre una posición/casco, bucle seguro), `fx.ring`
(sonar/objetivo/detección: anillos concéntricos pulsantes, ref5), `fx.flash`.
Ataques: `strike.missile` (misil con estela roja y cabeza luminosa, trayectoria curva de A a B con rumbo; al llegar dispara un
impacto programable `onHit:{fx:"fx.impact",...}`), `strike.salvo` (N misiles escalonados, ref5), `strike.torpedo` (estela
blanca bajo el agua con zigzag y burbujas), `strike.shell` (trazadora corta), `trail.contrail` (estela de condensación para
aviones: se engancha a un item por `follow:"id"` y usa su `path`; ancho y fade configurables).
Todo se dibuja con `ctx` 2D y mezcla `lighter`/`screen`; sin imágenes externas (partículas procedurales deterministas con
`env.rng`). Cada efecto declara `dur` y límite de partículas (≤300 por instancia). Debe verse bien SOBRE satélite oscuro y claro.
Eventos de sonido derivados: `sfx()` devuelve `explosion-near|explosion-far|water-impact|missile-pass|torpedo|bomb-whistle`
según el efecto (ids de `sfx.json`, que escribe la tarea `sonido`; los ids son el contrato).
Escena de demostración `work/tactico/scene-fx.json`.

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
