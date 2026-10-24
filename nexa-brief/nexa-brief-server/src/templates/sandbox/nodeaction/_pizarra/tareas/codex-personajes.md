# Tarea para Codex · personajes intercambiables de la pizarra

Claude (orquestador) revisa lo que entregues. Solo podés escribir en
`src/templates/sandbox/nodeaction/_pizarra/characters/` (archivos NUEVOS), en la tabla final de
`src/templates/sandbox/nodeaction/_pizarra/PERSONAJES.md` y en `src/templates/sandbox/nodeaction/_pizarra/tareas/`.
NO modifiques `rig.js`, `pizarra.js`, `props.js`, `palito.js` ni nada fuera de esas rutas. Sin git commit.

Leé: `PERSONAJES.md` (contrato), `rig.js` (helpers), `characters/palito.js` (ejemplo) y mirá la referencia
`src/templates/sandbox/nuevos/ejmplo1/videoplayback.mp4` (extraé cuadros con ffmpeg para ver el trazo).

## Personajes a crear (mismo trazo de la referencia, cada uno reconocible por su silueta)
1. `profe`: pelo corto peinado al costado, anteojos redondos, bigote, corbata (rombo) y saco abierto.
2. `nina`: estudiante joven, cola de caballo que se balancea con `o.t`, flequillo, falda trapecio.
3. `abuelo`: calvo con pelo a los costados, barba corta, anteojos, levemente encorvado (inclinar cabeza/torso con
   `extra` o dibujando el torso propio), bastón opcional `look.cane: true` en la mano izquierda.
4. `nino`: niño (scale.height ≈ 0.72, scale.head ≈ 1.25), gorra con visera, mochila (rectángulo redondeado
   detrás del torso, visible a los costados).
5. `obrera`: casco de seguridad, overol (rectángulo con tirantes), pelo recogido.
Cada uno respeta TODAS las poses de `rig.js` (stand, wave, think, point, pointL, shrug, shock, hold, write,
talk, cheer) y las 6 caras.

## Verificación (obligatoria)
- Hacé `tareas/personajes-test.html` (copiá la estructura de `../pizarra-demo/index.html`, cargando proto.js,
  rig.js, props.js y TODOS los characters) con una escena propia en `tareas/personajes-test/scene.json` y
  `config.json` (sin audio) que muestre los 6 personajes (palito incluido) en fila, uno por plano por pose.
  Capturá con Playwright (`.venv/bin/python`, `window.__promo.seek(t)`) una hoja `tareas/personajes-sheet.png`
  con cada personaje × cada pose. **Mirala** y corregí lo que se vea roto (miembros sueltos, accesorios que no
  siguen la cabeza al inclinarse, cosas cortadas).
- Completá la tabla "Personajes disponibles" de `PERSONAJES.md`.
- Reportá qué hiciste y cualquier límite del contrato que te haya molestado (no lo cambies: proponelo).
