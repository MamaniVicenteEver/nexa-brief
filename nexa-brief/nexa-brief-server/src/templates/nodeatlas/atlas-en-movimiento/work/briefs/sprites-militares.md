# Brief · sprites-militares (Sol 6.1 high) — TODO MILITAR (Blender por MCP + skills, SERVIDOR)

## Qué pasó y qué pide el usuario (literal): «el vehículo tiene que ser militar, todo militar»
Los 24 sprites de `engine/tactico/sprites2/` (hoja `hoja2.png`) salieron en **gris claro casi blanco**: el blindado, el jeep, las ambulancias y los camiones parecen vehículos CIVILES.
Hay que dejarlos **inequívocamente militares**, con pintura, detalles y acabado reales de uso en campaña.

## Método (idéntico al de `work/briefs/sprites-vehiculos.md`: LÉELO y cumple su sección «MÉTODO OBLIGATORIO»)
Skills `blender-core`, `blender-asset-qa`, `blender-pbr-materials` (en `/home/alfred/.agents/skills/`), MCP `mcp__blender_servidor__*`, modo seguro, `look`, QA acotado, `user_prompt` con el texto literal del usuario
(«EL VEHÍCULO TIENE QUE SER MILITAR, TODO MILITAR»), escena viva COMPARTIDA (solo tu colección `AEM_militar`, lejos del origen, no borres nada ajeno), renders headless de un hilo ya probados en la tanda anterior
(puedes usar `--threads 2` si `cat /proc/loadavg` marca menos de 2). Parte de los `.blend` y del código ya existentes (`sprites2/blend/*.blend`, `tools/sprites2/*.py.txt`, `render-final.py.txt`, `delivery.py.txt`); NO modifiques los originales:
guarda los nuevos en `engine/tactico/sprites3/` (PNG, máscaras, `sprites3.json`, `blend/`, `hoja3.png`) y su código en `engine/tactico/tools/sprites3/`.

## Requisitos de lo militar
- **Pintura**: oliva mate (olive drab), arena de desierto (tan) y **camuflaje de 2–3 tonos** procedural y determinista en el shader (manchas orgánicas, sin repetir teselas visibles), gris naval (haze grey) y gris oscuro para buques y aviones.
  PROHIBIDO el gris claro/blanco de pintura civil. Desgaste: suciedad, polvo, rozaduras en aristas, manchas de escape, barro en orugas y ruedas.
- **Detalles militares reconocibles desde arriba**: tanques (escotillas del comandante y cargador, ametralladora, lanzahumos, cajas y bidones de estiba, cables de remolque, antena, ruedas de apoyo y rodillos), blindado de transporte (torreta con cañón, escotillas, antenas),
  camiones (lona o cabina blindada, bidones, rueda de repuesto, red de camuflaje opcional), cisterna **militar** (tanque oliva, mangueras), jeep militar abierto con ametralladora montada, rueda de repuesto y antena, obuses con escudo y cureña, lanzador con tubos de misil,
  **ambulancia militar** (caja oliva o arena, cruz roja o media luna roja SOLO como marca en cuadro blanco, sin texto), vehículo de ingenieros blindado con pala.
- **Buques**: anfibio con rampas y cubierta de vuelo, patrullera con montura de cañón y radar, y **reemplaza** `ship-tug` y `ship-tanker-vlcc` (civiles) por `ship-oiler` (buque nodriza de combustible naval, gris) y `ship-landing-craft` (lancha de desembarco) o `ship-corvette`.
  Retira los dos civiles de `sprites3.json` y dilo en el RESULT.
- **Aviones y helicópteros**: bombarderos, caza, transporte, helicóptero pesado y dron en gris militar o camuflaje; transporte y helicóptero en oliva; ningún acabado de línea aérea civil.
- Sin banderas, matrículas, escudos ni textos. Misma eslora relativa y mismo esquema de `sprites2.json` (archivo, máscara, ancla, proa, eslora, `variant`, `states`). Estados `detected`, `burning`, `wrecked` como en la tanda anterior (PIL).
- **Libreas**: para los vehículos terrestres, entrega la librea principal `olive` (nombre base, p. ej. `tank-main`) y `desert` (`tank-main-desert`) más una `camo`; para buques y aviones una librea militar principal.
- Contraste: comprueba sobre OCÉANO oscuro y DESIERTO claro que la silueta se lee (el vehículo arena no debe desaparecer sobre desierto: añade contorno oscuro y sombra).

## Entregable
`hoja3.png` (todas las libreas y estados, océano y desierto, rótulos) + `hoja3-escalas.png` (cada vehículo a 120, 240 y 480 px), `sprites3.json`, `work/results/sprites-militares.md` con la tabla por sprite (modelado MCP, materiales, QA ejecutado, `look` revisados, guardado, render) y qué quedó simplificado.
MIRA tus propias hojas y corrige todo lo que siga viéndose claro, plano o civil antes de entregar. Ritmo: un render a la vez, `nice -n 19`, cierra procesos al terminar cada sprite.
