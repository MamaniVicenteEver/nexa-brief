# Brief · promover-motor (Sol 6.1 xhigh) — mover el motor a su sitio definitivo, SIN romper nada

## Decisión del usuario (aprobada): mover Atlas plano a `_atlas/plano/` y la biblioteca táctica a `_tactico/`
Hoy el motor vive dentro del prototipo: `atlas-en-movimiento/engine/plano/` (renderizador), `engine/tactico/` (biblioteca: núcleo, componentes, sprites, sfx, herramientas) y `engine/looks/tactico.json`.
Destino, relativo a `sandbox/nodehistory/` (carpeta hermana de `_atlas/`, `_mapas/`, `atlas-en-movimiento/`):
- `_atlas/plano/` ← `engine/plano/*`  y  `_atlas/looks/tactico.json` ← `engine/looks/tactico.json`
- `_tactico/` ← `engine/tactico/*` (core.js, util.js, sprites.js, components/, sprites/, sfx.json, units.json, components.json, tools/, test/, README.md, CONTRATO.md, PORTAAVIONES.md, audio*.js)
Guía previa en `engine/plano/README.md` («promoción a `_atlas/plano/`»: `paths.js` → `ATLAS` pasa de `../../../_atlas/` a `../`, y el look se mueve a `_atlas/looks/`).

## Permisos (autorizados por el usuario y por el lanzador)
Escribir en: el prototipo `atlas-en-movimiento/`, **solo la carpeta nueva `_atlas/plano/` y el archivo nuevo `_atlas/looks/tactico.json`** dentro de `_atlas/` (PROHIBIDO tocar cualquier otro archivo de `_atlas/`, en especial `cache/`, `camera.js`, `atlas.js`, `providers.json`, `looks/*` existentes),
la carpeta nueva `_tactico/`, y `nexa-brief-web/src/features/showcase/**` si hace falta adaptar el catálogo del Showcase. NO edites ningún `.py` ni nada bajo `nexa-brief-server/src/` fuera de `src/templates/sandbox/` (uvicorn con `--reload`). Sin emojis.

## Método (obligatorio: copiar → verificar → conmutar; NO BORRAR)
1. **Copia** (no muevas) los archivos a sus destinos, preservando fechas. Deja intacto el original en `engine/` hasta que el usuario apruebe borrarlo.
2. **Corrige las rutas relativas** de TODO lo que cambia de lugar o apunta a lo movido: imports ES (`plano.js` → `../tactico/core.js` pasa a `../../_tactico/core.js`, etc.), `paths.js`, rutas de sprites/sfx/units en `sprites.js`/`audio.js`/componentes, las herramientas Node (`validate.mjs`, `catalog.mjs`, `mixdown.mjs`, tests),
   la galería `work/tactico/demo.html` y demás páginas de `work/` que cargan el motor, los scripts de QA, y `info.json → catalog` (rutas de `components.json`, `sprites.json`, `sheet`, `gallery`). Busca TODAS las referencias con `grep -rn` (excluye `work/logs`, `work/escena/cuadros`, `work/tactico/shots`).
3. **Entrada del prototipo**: añade `index.new.html` que carga el motor de la ubicación definitiva y comprueba que el episodio carga (`assets/scene.json`, `assets/config.json`, mezcla). Solo si TODO lo siguiente pasa, haz que `index.html` apunte a la ubicación nueva (guarda el anterior como `index.engine-local.html`).
4. **Verificación obligatoria** (una prueba pesada a la vez, `nice -n 15`, un Chromium; usa los scripts de QA existentes `work/escena/check.py.txt` / `work/tactico/check*.py.txt` copiándolos a `/tmp`):
   - `node --test` de `_tactico/test/` y de `_atlas/` (`cd _atlas && node --test test/ camera.test.js`: 23/23 debe seguir verde);
   - `node _tactico/tools/validate.mjs assets/scene.json`: 0 errores; `node _tactico/tools/catalog.mjs` regenera el mismo `components.json` (86 componentes);
   - **Render idéntico**: los 8 instantes de `work/escena/qa.json` (195,10; 32; 233,90; 13,50; 161,95; 55; 124,50; 83 s) con el motor ANTIGUO y el NUEVO dan los mismos hashes SHA-256 de píxeles; si no, explica la diferencia y corrígela;
   - `mixdown.mjs` con rutas nuevas reproduce `assets/mix.plan.json`;
   - Showcase: `info.json → catalog` sigue sirviendo por `GET /api/v1/explainer/files/...` (curl 200 de cada archivo) y la galería abre un componente (`demo.html?only=naval.carrier&bare=1`); si la validación de rutas del Showcase impide rutas fuera del prototipo, adapta
     `lib/sandbox-catalog.ts` para aceptar una base de catálogo en `sandbox/nodehistory/` (con validación contra `..` fuera de `sandbox/`), actualiza sus tests y corre SOLO `src/features/showcase/__tests__/sandbox-showcase.test.tsx` (`nice -n 19`).
5. Actualiza `README.md` de `_tactico/` y `_atlas/plano/` (nuevas rutas, cómo reutilizar el portaaviones sin tocar el motor) y anota en `info.json → notes` el movimiento.

## Entregable
`work/results/promover-motor.md`: tabla de qué se copió y a dónde, lista de rutas corregidas, resultados de cada verificación (con hashes), qué queda del motor antiguo en `engine/` (para borrar tras OK del usuario), y lo no verificado. No grabes MP4.
