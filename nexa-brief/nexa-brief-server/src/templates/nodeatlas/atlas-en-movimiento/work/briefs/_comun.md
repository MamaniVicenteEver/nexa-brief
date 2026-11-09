# Preámbulo común de las tareas de componentes (léelo antes que tu brief)

1. Lee `engine/tactico/CONTRATO.md` (API, escena, capas, prohibiciones) y `engine/tactico/README.md` (cómo añadir y probar un
   componente; lo escribe `tactico-core`). Si `core.js` aún no existe cuando empieces, programa contra el contrato (§4) y
   comprueba cuando aparezca; no lo reescribas ni lo dupliques.
2. Lee `PLAN.md` §4 (familias y nombres de componentes), `REFERENCIAS.md` (tabla de la referencia que corresponda y la matriz) y
   mira las imágenes de evidencia de `work/ref/` que cita tu brief. Replica el LENGUAJE VISUAL de las referencias (relieve
   satelital, rellenos teñidos, siluetas realistas con contorno oscuro, rótulos neón, movimiento con desenfoque); no copies
   marcas, textos ni titulares.
3. Un archivo por familia en `engine/tactico/components/<familia>.js`, `import {Tactico} from '../core.js'` y
   `Tactico.component(...)`. No toques `core.js`, `util.js`, `sprites.js` ni `engine/plano/*`: si falta algo, pídelo en tu RESULT
   con el diff exacto, y mientras tanto implementa un helper local dentro de tu archivo.
4. Cada componente: `summary`, `params` con valores por defecto, `states` si aplica, `validate`, `demo` (item de ejemplo),
   determinismo estricto (función pura de `t`, `env.rng(seed)`), tamaños con `env.U`, sin emojis, colores de la paleta.
5. Pruebas: añade tus demos a la galería `work/tactico/demo.html` (carga `?items=<archivo>.json`), saca capturas en 3 instantes por
   componente (entrada, pleno, salida) a `work/tactico/shots/<familia>/`, y arma una hoja de contacto por familia
   (`work/tactico/sheets/<familia>.jpg`). MIRA las hojas y corrige lo que se vea mal (recortes, borde duro, parpadeo, tamaño
   ilegible a 9:16 1080x1920). Chromium con los flags swiftshader del smoke de Atlas; UNA sola página abierta a la vez.
6. Rendimiento: medir ms/cuadro del componente con 20 instancias a la vez (1080x1920, SwiftShader); meta ≤5 ms por familia.
   Informar en el RESULT; si es peor, optimizar (caché de sprites tintados en OffscreenCanvas, no por cuadro).
7. Entrega `work/results/<tarea>.md`: componentes, parámetros, estados, capturas (rutas), medidas, límites, qué no se pudo verificar.
8. NO grabes MP4. NO reinicies servicios. Escribe solo dentro de `atlas-en-movimiento/`, `/tmp` y cachés. Máximo 1 Chromium y 2
   hilos de CPU pesados a la vez (el servidor es compartido).

9. RITMO (obligatorio): comandos pesados con `nice -n 15`, un solo proceso pesado a la vez, Blender `--threads 1`, una sola página
   de Chromium, cerrar hijos al terminar cada prueba. Mira `## REANUDACIÓN Y RITMO` de tu brief.

## REGLA PERMANENTE DE VISTAS PREVIAS Y DOCUMENTACIÓN DE ANIMACIONES (instrucción expresa del usuario; aplica a TODO componente nuevo)
1. **La vista previa de un componente se ve SOLA y DIRECTO: animación en bucle y automática, sin pulsar «Reproducir».** El usuario entra al Showcase y debe ver el efecto moviéndose.
2. **SIN MAPA** (ni satelital ni de ningún tipo) en las vistas previas, salvo que el componente SEA el mapa (territorio, bandera, ruta, frente). Fondo liso: **blanco por defecto**. Si el efecto no se ve sobre blanco (mezclas aditivas como fx, strike, trail, o texto crema), declara en su JSON `preview.bg:"dark"` y la vista previa usa un fondo liso oscuro; nunca un mapa.
3. **Cada animación/componente tiene un JSON de especificación con nombre y descripción** (`animations/<nombre>.json` + índice `animations/index.json`): qué hace, cuándo usarla, duración, bucle, parámetros con valor por defecto y rango, estados, sonidos asociados, item de ejemplo listo para pegar en una escena y `preview`. **El agente de un próximo video lee el índice y el JSON, NO el código.** Todo componente nuevo debe generar o actualizar su JSON (`node engine/tactico/tools/animations-spec.mjs`).
4. Pocos recursos: previsualizaciones con carga perezosa (solo se animan las visibles; máximo 6 a la vez).
