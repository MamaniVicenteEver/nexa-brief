# Brief · tactico-terrestre (Sol 6.1 xhigh) — familia terrestre y grupos de fichas, nivel profesional

Antes: `work/briefs/_comun.md`. Lee `engine/tactico/components/units.js` (fichas octogonales: `unit.token/group/move/advance/retreat`, `fx.clash`) y `naval.js`/`air.js` (cómo usan sprites con
respaldo vectorial vía `sprites.js`), y mira `work/ref/ref1-detalle.jpg`, `ref1-hoja-a.jpg`, `ref2-detalle.jpg`, `ref4-detalle.jpg`. Las capturas actuales de `unit.advance` son correctas pero planas:
objetivo = **profesional, animado y con más presencia**, como las referencias o un poco más allá.

## Archivos que puedes tocar
`engine/tactico/components/ground.js` (nuevo), `engine/tactico/components/army.js` (nuevo), `engine/tactico/units.json` (SOLO añadir entradas; no cambiar las existentes), `work/tactico/*terrestre*`, `work/results/tactico-terrestre.md`.
Sprites: los vehículos los modela la tarea `sprites-vehiculos` (`engine/tactico/sprites2/sprites2.json`, puede no existir aún). Programa con respaldo vectorial MUY cuidado (casco, orugas, torreta, ruedas con sombra, contorno oscuro)
y usa el sprite cuando exista, sin cambiar la API. NO edites `core.js`, `util.js`, `sprites.js`, ni los `.js` de otras familias.

## Componentes a entregar
- `ground.tank` (variantes `main|light`), `ground.apc`, `ground.truck` (`cargo|fuel`), `ground.jeep`, `ground.artillery` (`towed|self`; disparo con retroceso y fogonazo programable por `states`/`fire:[t…]`),
  `ground.launcher` (lanzador de misiles; `fire` lanza `strike.missile`), `ground.ambulance` (`cross|crescent`, luces intermitentes en `t`, rumbo por la ruta).
  Todos con `path` (rumbo `auto`), orugas/ruedas animadas por la distancia recorrida, **polvo y huellas** (`fx.dust` propio dentro del archivo: partículas deterministas con `env.rng`), sombra, y estados
  `normal|hit|burning|destroyed` (ardiendo reutiliza `fx.fire`/`fx.smoke` si están registrados).
- `ground.convoy`: columna de N vehículos que siguen una ruta con separación, giros suaves, polvo, bandera líder; mezcla de tipos por lista.
- **Grupos de fichas que avanzan** (lo que pidió el usuario): `army.advance` (una «ola» de 10–40 fichas octogonales con bandera que avanzan en formación hacia un frente: filas escalonadas, ondulación, banderola del
  ejército al frente, flecha de ataque que se dibuja, frente luminoso, humo/polvo atrás), `army.retreat`, `army.hold` (línea que resiste con pulso), `army.encircle` (dos brazos que se cierran),
  `army.clash` (choque con destellos y fichas que caen), `army.banner` (estandarte con rótulo y fecha), `army.supply` (línea de abastecimiento con camiones pequeños).
  Debe verse bien con 8–40 fichas a 1080x1920 y rendir (≤ 8 ms por cuadro con 40 fichas; mide y optimiza con caché de sprites en OffscreenCanvas).
- Interactivo/animado en la galería: cada componente declara parámetros ajustables (`params`) con rangos para que el Showcase los muestre; entradas, salidas y estados suaves.

## Revisión visual obligatoria
Capturas a resolución completa de cada componente (recorte de 540x540 sobre el sujeto, NO miniaturas de la región entera) y una tira a 10 fps de `army.advance` y `ground.convoy`.
Mira las capturas y mejora hasta que se vean con volumen (sombras, contornos, brillos) y no como iconos planos. `work/tactico/sheets/terrestre.jpg` + `work/tactico/sheets/army-tira-10fps.jpg`.
Pruebas: `node --test` propias, validación de la escena demo (`node engine/tactico/tools/validate.mjs`), seek fuera de orden estable, catálogo regenerado (`node engine/tactico/tools/catalog.mjs`).
Ritmo: `nice -n 15`, una sola página de Chromium, una prueba a la vez.
