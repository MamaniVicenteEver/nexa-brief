# Corrección de personajes (revisión de Claude sobre la hoja real de Playwright)

Mismas reglas de archivos que `codex-personajes.md` (solo `characters/` nuevos —no palito.js—, PERSONAJES.md, tareas/).
Claude agregó a `rig.js` el parámetro `parts` de `tubes` y la regla de capas en `PERSONAJES.md`: leelos.

Problemas vistos en la hoja (pose wave/grin a 1920×1080):
1. **La ropa tapa los brazos**: el saco de `profe`, el overol de `obrera` y la falda de `nina` se dibujan encima
   del brazo y la mano. Usá el orden: atrás → `tubes(legs, torso)` → ropa → `tubes(arms)` → manos → cabeza.
2. `profe`: el saco es un rectángulo ancho que parece un cartel. Tiene que seguir el cuerpo: trapecio de hombros
   (un poco más ancho que los hombros) a cadera, con solapas en V abiertas y la corbata en el medio. Más angosto.
3. `nino`: la mochila se ve como un marco delante del cuerpo. Va DETRÁS (antes de los tubes): solo asoman los
   costados y una correa que cruza el hombro por delante.
4. `obrera`: el overol tapa el brazo (punto 1) y hay una forma rara tipo "Q" en el costado del casco: sacala.
   El overol: peto rectangular chico en el pecho + tirantes a los hombros + pantalón que cubre las piernas
   hasta la rodilla (trapecio).
5. `nina`: no se ve la cola de caballo; hacela visible (detrás de la cabeza, del lado contrario a la cara, que
   se balancee con `o.t`).
6. `abuelo`: está bien; que el bastón apoye en el suelo (`J.legL[1][1]`) en todas las poses.

Sin Chrome en tu sandbox no podés capturar: hacé los cambios con cuidado y dejá en tu reporte qué cambiaste.
Claude vuelve a capturar la hoja.
