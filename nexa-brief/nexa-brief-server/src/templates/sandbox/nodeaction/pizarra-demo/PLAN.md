# pizarra-demo · prototipo de pizarra plana (NodeAction)

Réplica del estilo de `sandbox/nuevos/ejmplo1/videoplayback.mp4` ("The English Narratives", 6:46, 16:9).
Prototipo, 2026-10-22. No es un video para publicar.

## Material reutilizado (sin gastar voz)

Voz y letra de `nodehistory/turing-enigma`, recortadas a 0–48 s (hasta "…empezar de cero").

## Lo estándar (motor `../_pizarra/pizarra.js`, el entorno NO cambia)

- Fondo gris claro liso `#efefef`, sin cámara: cada plano es un corte seco.
- Monigote de doble trazo (silueta negra rellena del color del fondo), cabeza redonda con mechones.
- Dibujos de línea negra que entran con un "pop" (escala con rebote).
- Texto negro DM Sans tipeado palabra por palabra · títulos en arco letra por letra · rótulo verde
  manuscrito (Fraunces) · rayita bajo un dato.

## Lo que cambia por video (solo `assets/scene.json`)

El personaje del medio: posición, tamaño, `poses` (stand, wave, think, point, pointL, shrug, shock, hold,
write, talk, cheer) y caras (smile, grin, worried, shock, think, talk), y qué dibujos y textos aparecen.
Props: clock, bulb, enigma, letter, rotor, papers (pila que crece), paper (se puede sostener con
`hold: "m:R"`), lock, x, check, arrow (`curly`), universe, envelope, question, sub.

## Formato de la escena

`shots[]` = planos con `t` (número o `"@palabra"`) e `items[]`: `man`, `prop`, `type`, `arc`, `script`,
`label`, `rule`, `vs`. Cada item: `x`, `y` (lienzo 1920×1080), `at` (cuándo aparece), `out`, `move`.

## Pendiente si se promueve

- Solo 16:9 (la referencia es 16:9). Para 9:16 hace falta una posición por formato (`portrait`).
- Más props según el tema (cada video nuevo pide sus dibujos) y andar/caminar del monigote.
