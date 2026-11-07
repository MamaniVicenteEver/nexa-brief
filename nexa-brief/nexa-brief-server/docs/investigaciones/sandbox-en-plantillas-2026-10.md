# Sandbox visible en /plantillas + botón "Pasar a producción"

Fecha: 2026-10-24 · Rama: `feat/nodetech-paquete-publicacion` · Servidor: alfred-server

## Qué se pide

En /plantillas, una pestaña más (**Sandbox**) junto a NodeTech / NodeHistory / NodeMotion /
NodePolitics / NodeEconomy. Dentro, una sub-pestaña por cada carpeta de
`src/templates/sandbox/`, con las tarjetas de lo que se está trabajando, y un botón
**Pasar a producción** que mueve la carpeta fuera del sandbox.

## Qué hay hoy en el sandbox

No son 4 carpetas, son 6 + `nuevos/`. Y no todo es del mismo tipo:

| Carpeta | Proyectos | Tipo | ¿Tiene `manifest.json`? |
|---|---|---|---|
| nodetech | clip-prueba | explainer-kit (rough) | sí (nuevo) |
| nodehistory | memorias-demo | explainer-kit | sí (nuevo) |
| nodehistory | bolivia-mar, fronteras-demo | motor `_mapas` + `_proto` | no (tienen render mp4) |
| nodepolitics | atlas-demo, imperio-demo | explainer-kit | sí (listo) |
| nodeeconomy | dinero-demo | explainer-kit | sí (listo) |
| nodeaction | paintwick, somme-1916(-3d), pizarra-demo, pizarra-olvido, avatar-demo, prueba-3d | motor propio `_engine` / `_pizarra` / `_avatar` | no |
| nodemotion | lyrics-final-cut, promo-fuerza-motivacion | HyperFrames (lyrics/promo) | no (`NOTAS.md`, `lyrics.json`) |
| nuevos | ejmplo1, ejmplo2 | solo mp4 de referencia | no |

Las carpetas `_algo` (`_engine`, `_mapas`, `_pizarra`, `_avatar`, `_proto`, `_referencias`,
`_codex`) son **motores o material compartido**, no videos: no se listan como tarjetas.

Ninguno tiene todavía `render/poster.jpg` (la tarjeta lo usa como portada).
Los mp4 no están en git (`*.mp4` en `.gitignore`), así que mover carpetas no infla el repo.

## Lo que ya existe y se reutiliza

- **`kit.py promote <id>`** (`_tools/explainer-kit/tools/kit.py`): ya hace exactamente
  "pasar a producción" para videos del explainer-kit: mueve `sandbox/<carpeta>/<id>` →
  `<carpeta>/<id>`, corrige la ruta `…/engine/loader.js` en `index.html` y exige estado
  `listo`/`renderizado` (o `--force`).
- **`core/explainer/catalog.py`**: `load_video()` y `list_videos(root=…)` ya aceptan una
  carpeta cualquiera; hoy excluyen el sandbox solo porque `video_roots()` no lo incluye.
- **Web**: `TemplatesGridView` elige la ventana por `category.engine` (`pipeline` /
  `explainer_kit`). Las tarjetas (`ExplainerVideoCard`) y el modal de preview en iframe
  (`PreviewFrameModal`) se pueden reusar tal cual.
- **`GET /explainer/files/{path}`**: sirve los archivos del iframe, pero hoy **solo** de
  `_tools/explainer-kit/` y de las carpetas de categoría. Hay que abrirle `sandbox/` (solo
  lectura).

## Qué implica

### Fase 1 — Ver el sandbox (solo lectura) · fácil · ~1 día

Backend
1. `core/explainer/sandbox.py`: recorre `sandbox/<carpeta>/<id>/` (saltando `_*` y carpetas
   sin `index.html` ni mp4). Si hay `manifest.json` usa `load_video()`; si no, una ficha
   genérica: título = id, tipo detectado (explainer-kit / nodeaction / mapas / hyperframes /
   referencia), mp4 de `render/`, si tiene `PLAN.md`/`NOTAS.md`.
2. `GET /explainer/sandbox` → `[{folder, items:[…]}]`.
3. `/explainer/files`: permitir `sandbox/…` además de lo actual. Los motores ya usan rutas
   relativas (`../_engine/core.js`, `../../_proto/proto.js`,
   `../../../_tools/explainer-kit/…`) que resuelven bien bajo la misma ruta, así que el
   iframe funciona sin tocar los HTML.

Web
4. Pestaña **Sandbox** en `CategoryWindowTabs` (no es una categoría de `niches.json`; es un
   item fijo extra, para no meterla en el planner, publicación ni estadísticas).
5. `SandboxWindow`: sub-pestañas por carpeta (NodeTech, NodeHistory, NodePolitics,
   NodeEconomy, NodeAction, NodeMotion, Nuevos) con contador; tarjetas reutilizando
   `ExplainerVideoCard`, badge del tipo, y preview en el modal (iframe del `index.html`, o el
   mp4 de `render/` si no hay HTML).
6. Portadas: para los que no tengan poster, mostrar el primer frame del mp4 (`<video
   preload="metadata">`) o un placeholder. Más adelante `kit.py poster` puede generarlos.

Riesgo: casi nulo. No se mueve nada y no toca producción.

### Fase 2 — Botón "Pasar a producción" · media · ~1 día (solo explainer-kit)

1. Sacar la lógica de `cmd_promote` a una función de core (`promote_video(dir)`), que use
   tanto `kit.py` como la API — una sola implementación.
2. `POST /explainer/sandbox/{folder}/{id}/promote` con las mismas reglas: estado
   `listo`/`renderizado`, destino libre, y **no** promover si hay una producción del agente
   corriendo en esa carpeta.
3. En la web: botón con confirmación ("se mueve a NodePolitics y aparece en Preparación"),
   y al terminar invalidar `/explainer/videos` y `/explainer/sandbox`.

Quedan habilitados de entrada: dinero-demo, atlas-demo, imperio-demo (ya `listo`);
memorias-demo y clip-prueba cuando terminen los pasos.

### Lo difícil: lo que NO es explainer-kit

Para nodeaction, `_mapas` (bolivia-mar, fronteras-demo) y nodemotion el botón tiene que
salir **deshabilitado con el motivo**, porque mover solo la carpeta del video rompe el video:

- **NodeAction / mapas / pizarra**: el `index.html` carga el motor con `../_engine/…`,
  `../_mapas/…`, `../../_proto/…`. Esos motores viven **dentro** del sandbox. Para
  producirlos primero hay que "graduar" el motor (p. ej. `sandbox/nodeaction/_engine` →
  `_tools/nodeaction-engine/`), reescribir las rutas de todos los videos que lo usan y darle
  un `manifest.json` para que el catálogo y la grabación los reconozcan. Además NodeAction no
  es una de las 5 categorías de `niches.json` (habría que decidir si es categoría propia o
  un diseño dentro de NodeHistory). Es trabajo de ~1–2 días **por motor**, una sola vez.
- **NodeMotion (lyrics-final-cut, promo-fuerza)**: producción no es "mover carpeta", es dar
  de alta la plantilla en `templates.json` (inputs, config, `category_id`, prompts) para que
  el pipeline la pueda usar con canciones nuevas. Eso es un alta manual de plantilla, no un
  botón.
- **nuevos/**: son referencias; no tiene sentido promoverlas.

### Detalles a cuidar

- `uvicorn --reload --reload-dir src`: mover una carpeta que contiene `.py`
  (p. ej. `nodeaction/tools/`) **reinicia el servidor** y corta producciones en curso. Los
  videos del explainer-kit no traen `.py`, así que la Fase 2 no lo dispara; graduar motores sí.
- Mover es un `git mv` lógico: los archivos versionados quedan como cambios sin commit;
  conviene que el endpoint no haga commit solo.
- La pestaña Sandbox debería ser solo para la cuenta admin (es el taller).

## Costo resumido

| Parte | Dificultad | Tiempo aprox. |
|---|---|---|
| Fase 1: ver sandbox con previews | fácil | ~1 día |
| Fase 2: promover explainer-kit desde la web | media-baja (ya existe `kit.py promote`) | ~0,5–1 día |
| Graduar un motor propio (nodeaction, mapas, pizarra) | media | ~1–2 días c/u, cuando haga falta |
| NodeMotion a producción | manual por plantilla | depende de la plantilla |

## Recomendación

**Sí vale la pena**, pero en dos pasos:

1. Hacer ya la **Fase 1**. Es barata, no arriesga nada y resuelve lo principal: ver de un
   vistazo qué hay en el taller sin entrar por SSH.
2. Hacer la **Fase 2 solo para videos del explainer-kit**, reusando `kit.py promote`. Para el
   resto, el botón aparece deshabilitado con el motivo ("motor todavía en sandbox").
3. **No** mover motores ahora. Cuando un video de NodeAction o de mapas esté listo para
   publicar, se gradúa ese motor una vez y desde ahí el botón funciona para todos sus videos.
