# Brief de trabajo · sprites (Sol 6.1 xhigh) — usa CPU: lanzar con el servidor libre

## Objetivo
Generar con **Blender** (instalado en el servidor: `~/.local/opt/blender-5.2.3-linux-x64/blender`, modo
`--background --python`) los sprites cenitales de las unidades navales y aéreas, con calidad parecida a la ref5
(recortes fotorrealistas grises con contorno oscuro) y variantes claramente distinguibles.

## Contexto mínimo a leer
- `atlas-en-movimiento/PLAN.md` §4 C y §5 (portaaviones y variantes).
- Imágenes: `work/ref/ref5-detalle-a.jpg` (0:02, 0:12: portaaviones), `ref5-detalle-b.jpg` (0:30–0:33 submarinos),
  `ref5-detalle-c.jpg` (buques: normal, detectado, en llamas, calcinado), `ref5-flota-51-58s.jpg` (grupo de combate),
  `ref3-detalle.jpg` (mercantes en llamas, 57.5 y 61.8), `ref4-bombarderos-0-3s.jpg` (bombarderos con estela).

## Archivos que puede tocar
- Crear `atlas-en-movimiento/engine/tactico/sprites/` y `atlas-en-movimiento/engine/tactico/tools/sprites/` (scripts bpy). Tu sandbox de escritura es solo el prototipo, `/tmp` y las cachés: Claude moverá `engine/tactico/` a `_tactico/` cuando el usuario apruebe. Para Blender usá `BLENDER_USER_CONFIG=/tmp/blender-cfg BLENDER_USER_SCRIPTS=/tmp/blender-scripts`.

## Entregable exacto
1. Scripts bpy reproducibles (modelado procedural, sin modelos descargados salvo CC0 con licencia anotada) que
   rendericen en ortográfica cenital, luz de sol fija desde arriba-izquierda, fondo transparente, 1024 px de lado
   largo, y exporten además una **máscara de sombra** separada (silueta para desplazar y desenfocar en tiempo real):
   - `carrier-super` (cubierta en ángulo, isla a estribor, marcas de cubierta, 10–14 aviones aparcados; variante
     `carrier-super-empty` sin aviones para despegues), `carrier-stovl` (rampa de esquí),
   - `warship-destroyer`, `warship-frigate`, `warship-cruiser`,
   - `cargo-tanker` (casco ancho, tuberías en cubierta, superestructura a popa), `cargo-container`, `cargo-bulk`,
   - `submarine` (vista cenital, también versión translúcida azul como ref5 0:30),
   - `air-bomber-wing` (ala volante), `air-bomber-swept` (alas en flecha, 4 motores), `air-jet-attack`,
     `air-jet-fighter`, `air-helicopter-body` + `air-helicopter-rotor` (capa separada para girar), `air-prop-transport`.
2. Estados por casco (pos-proceso en Python/PIL, no en tiempo real): `*-burning` (zonas carbonizadas + base para
   fuego), `*-wrecked` (oscurecido, quemado), y paleta neutra gris para poder teñir identidad si hace falta.
3. `engine/tactico/sprites/sprites.json`: por sprite → archivo, máscara, ancla (centro), proa (vector), eslora relativa
   real (para escalas coherentes: carrier 1.0, destroyer ≈ 0.45, frigate ≈ 0.38, tanker ≈ 1.05, submarine ≈ 0.48),
   `variant`, `states`.
4. `engine/tactico/sprites/hoja.png`: todas las variantes y estados lado a lado sobre un recorte de océano oscuro
   (puede usar una tesela de `_atlas/cache/gibs-bluemarble`), con rótulos.
5. `work/results/sprites.md` (en `atlas-en-movimiento/work/results/`): rutas, tiempos de render, decisiones.

## Cómo verificar
- La hoja debe distinguir a simple vista carga / buque / portaaviones / submarino y los 4 estados.
- Sin emojis ni texto en los sprites. Tamaño total de `sprites/` ≤ 40 MB (PNG optimizados).

## Prohibido
- Escribir fuera de lo autorizado. Más de 2 hilos de Blender (`--threads 2`): el servidor es compartido.

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
