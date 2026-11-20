# REPORT · promo-mono (2026-11-14)

- **ID / familia:** `promo-mono` · promo (`category_id: commercial`). Diseño nuevo, basado en el contrato de componentes de `promo-pulse`.
- **Propósito:** promo de marca/servicio/causa con interfaz monocroma minimalista (réplica generalizada de un anuncio entregado por el usuario; sin su marca, audio ni clips).

## Archivos fuente
- Compilador: `src/templates/_tools/nodemotion/promo/compiler/build/promo-mono.spec.json`, `mono.js`, `component-player.js` (orquestador compartido nuevo, parametrizado con `COMPONENT_FILES`; `promo-pulse` no se tocó).
- Motor: `src/templates/_tools/nodemotion/promo/designs/promo-mono/` (extraído con `extract.py --extract promo-mono`; runtime `components/{kit,transitions,intro,scenes,outro-v1,outro-v2}.js`, `showcase/index.html`).
- Demo mínima: `src/templates/nodemotion/commercial/promo-mono/` (`index.html` de 472 B, `assets/config.json`, `assets/lyrics.json`, `info.json`, `DESIGN.md`, `CREDITS.md`, `thumbnail-style.json`, `showcase/components.json`).
- Medios de demo: 41 archivos en `_tools/nodemotion/shared/resources/` por hash (`plan_demo_resources` + `apply_demo_resource_plan`: 41 enlazados, 41 retirados).

## Componentes
15 escenas (`headline`, `playline`, `cardfan`, `wordgrid`, `chips` float/pile, `linetext`, `pin`, `footage`, `numbers`, `pattern`, `spaced`, `phonechat`, `coupon`, `codeinput`, `contact`), `intro`, `outroV1`, `outroV2`, transiciones `dots`, `lineSweep`, `blink`, `pillPop` (+ las del núcleo). Contratos derivados en `QUICK.md`/`contracts/` desde `showcase/components.json` (`refresh_catalogs.py promo-mono`).

## Integración
- `templates.json` → `promo-mono`; nichos `promo_video_mono` en `niches.json` del repo y del perfil `profesional` (NodeMotion → promos); `design-tokens.json` (Inter Tight 800). Solo entradas nuevas (comparado con copias previas en `work/promo-mono-2026-11-14/*.pre.json`).
- La API en marcha ya sirve `/api/v1/templates/promo-mono/source`, `/showcase/index.html` y `/components`.
- **No integrado:** preparación por chat de promos (`TEMPLATES` en `src/core/nodemotion/promo/prompts.py`, `PROMO_IDS` web, contrato `production/templates/promo-mono.json`, esquemas). Declarado pendiente.
- **Renderer:** reloj HyperFrames insertado por el compilador; **no** añadido a la lista validada (sin render).

## Revisiones del motor
Tras la extracción se publicaron cambios de runtime (burbujas de chat, ajuste de la cuadrícula en 9:16). Cada vez: `archive_engine()` de la revisión vigente (archivadas `81a401…`, `750bfc…`, `235b7a…`), copia del archivo y registro de su hash real en `migration_runtime_sha256`; `extract.py --check promo-mono` ✓. No existe todavía una API de publicación de runtime: se recomienda añadir `update_runtime()` a `assemble.py`.

## Recursos y licencias
Música «Funk Game Loop» y «Carefree», Kevin MacLeod, CC BY 4.0 (atribución obligatoria). Clips Pixabay (licencia Pixabay). Inter (OFL). Marca ficticia «Rutalia».

## Pruebas reales
- Chromium local y del servidor por la API: 16:9 (800×450, 960×540) y 9:16 (405×720, 540×960); los 6 componentes cargan; sin errores ni avisos de validación (corregido un aviso propio de `count`).
- Rendimiento con audio: 33–60 fps en escenas de semitono (antes 6–8 fps; causas medidas: `mix-blend-mode` y grano sobre canvas, rasterizado diferido de trazados en GPU por software; solución: búfer de píxeles). `wordgrid` 31 fps en local sin pregradado.
- Determinismo del DOM en 7 instantes ✓ (diferencia solo en un elemento oculto ya corregido).
- `extract.py --check promo-mono` ✓. Pruebas NodeMotion: ver resultado en el informe al usuario.

## Prototipo
`$NEXA_PROFILE_DIR/sandbox/nodemotion/promo-mono-adopcion/` (ver su `REPORT.md`).

## Pendientes
Render HyperFrames y su habilitación; preparación por chat; miniaturas A/B en un borrador real; tarjeta en `/plantillas` (catálogo en caché hasta reiniciar el backend).
