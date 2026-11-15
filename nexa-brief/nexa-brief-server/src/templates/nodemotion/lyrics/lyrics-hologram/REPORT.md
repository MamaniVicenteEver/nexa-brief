# REPORT · lyrics-hologram

Fecha: 2026-11-14 · Ejecutor: Claude (chat directo, sin delegar) · Servidor: alfred-server.
Sin commit, push, render, grabación ni publicación.

## Identidad

- **ID estable:** `lyrics-hologram` · familia `lyrics` · nombre visible «Holograma».
- **Propósito:** plantilla de letras reutilizable que replica el lenguaje visual de la referencia
  `sandbox/referencias/nodemotion/LETRAS/8b4882f971a5fff36b142cd37d130998.mp4` (lyric video pop de
  2:55): relleno holográfico iridiscente, contornos gigantes y seda holográfica. Funciona con
  cualquier canción y su transcripción.
- **Renderer:** documento HTML del motor compartido con el reloj HyperFrames del proyecto. Sin Remotion.

## Archivos fuente

- **Motor:** `src/templates/_tools/nodemotion/lyrics/designs/lyrics-hologram/`
  - `manifest.json` incluye 8 alias de runtime y 31 alias de recursos.
  - `document.html` con `scripts/` y `styles/`.
  - `runtime/` con `player.js`, `gallery.html` y los 6 componentes.
  - `contract.json`, `QUICK.md`, `catalog.json` y `contracts/` (generados).
  - `revisions/`.
- **Compilador:** `src/templates/_tools/nodemotion/lyrics/compiler/hologram/build/lyrics-hologram.spec.json`.
- **Demo:** `src/templates/nodemotion/lyrics/lyrics-hologram/`
  - `index.html` (entrada mínima) y `assets/config.json`.
  - `assets/lyrics.json` y `assets/ejemplos/campana-ejemplo.json`.
  - `showcase/components.json`.
  - `DESIGN.md`, `MINIATURAS.md`, `CREDITS.md` y este informe.
- **Recursos:** 31 archivos en `_tools/nodemotion/shared/resources/<sha256>.<ext>`: canción, 6 clips,
  pósteres y variantes en duotono, recodificados con GOP 5.

## Componentes y contratos

Intro, 14 escenas del mazo, Outro v1 (predeterminado) y Outro v2, más 4 transiciones propias. El
catálogo `showcase/components.json` se generó desde el registro real que carga el navegador, con
tipos, rangos, opciones y valores por defecto. El descubrimiento produce 18 contratos de
componentes `documented` y 20 de configuración. La galería (`gallery.html`) admite `?only=<nombre>`
y `aspect=16:9|9:16`.

## Integración

- **Catálogo:** `templates.json` (categoría `lyrics`, `sort_order` 28). La API la lista como
  «Holograma» con `can_generate: true`.
- **Nicho `lyrics_video_hologram`:** en `niches.json` del repositorio y del perfil `profesional`
  (lista `node_motion → letras`).
- **Tokens:** `nodemotion/design-tokens.json`.
- **Miniaturas:** tema, paleta y layout `hologram` en `src/core/draft_thumbnails.py`, renderer
  `renderHologramSvg` en `src/core/draft_thumbnail_renderer.js`. Bebas Neue local (OFL) en
  `nodemotion/assets/fonts/` e `index.json`.
- **Tests:** `test_draft_thumbnails.py` (entradas parametrizadas).
- **Preparación editorial por chat:** no aplica. Es una plantilla de letras; el flujo de promos
  (`TEMPLATES`) no cambia.

## Recursos y licencias

- **Canción:** «Give It Up (Urban Mix)», djlang59 feat. Madam Snowflake (samples de Subliminal),
  CC BY 3.0, con atribución obligatoria. Recortada a 2:16.
- **Clips:** licencia Pixabay. **Fuentes:** OFL.
- **Descartada:** se probó primero otra canción de ccMixter y se descartó por letra sexual explícita.
- **Referencia:** no se usa nada suyo (canción, personajes, logotipos).

## Pruebas ejecutadas (resultado real)

- **Capturas por escena** (`__promo.seek`) de las 80 escenas en 16:9 y en 9:16. Sin avisos de config;
  los únicos mensajes de consola son las dos sondas opcionales de config del núcleo (404 esperado,
  común a todas las plantillas) y el aviso de rendimiento de WebGL «GPU stall due to ReadPixels».
- **Por la API:** `/source` (200, 99 681 B, mismo `source_sha256`), `/components` (200) y
  `/showcase/index.html`: 6 componentes cargados, medios y canción servidos por alias (206/200),
  16:9, 9:16 y `?outro=v2`.
- **Config de campaña de ejemplo:** paleta dorada, Outro v2, sin avisos.
- **Config inválido:** 16 errores detectados y corregidos con aviso; el video sigue renderizando.
- **Integridad:** `extract.py --check` de `lyrics-hologram`, `lyrics-rasgado`, `promo-breaking` y
  `promo-pulse`, todo ✓. La extracción no cambió ningún archivo de otros diseños (huella de 941
  archivos antes y después).
- **HyperFrames:** `optimize.py --check lyrics-hologram` ✓.
- **pytest:** engines, execution, http, integration_contracts, migration, retirement y
  draft_thumbnails dan **288 passed**. El grupo `-k "lyric or template or niche or catalog or
  showcase or design"` da 499 passed y 45 failed: los 45 ya fallaban en la línea base
  `/tmp/nodemotion-completed-suite.xml` (0 nuevos).
- **Miniaturas A/B:** dibujadas con el renderer real (Bebas Neue local, fotograma de fondo).

## Decisiones para revisar

1. **Corrección del Outro v1 tras la extracción.** En 9:16 la barra tapaba el subtítulo. Se archivó
   la revisión `0a9cb3f4…` (documento y runtime), se publicó `runtime/components/outro-v1.js`
   corregido (revisión actual `cfadbebb…`) y se actualizó en `manifest.json` solo la entrada
   `migration_runtime_sha256["components/outro-v1.js"]`, con el hash calculado del archivo
   publicado. No existe herramienta oficial para cambios de runtime tras la extracción. Copia del
   manifiesto anterior: `/tmp/claude-promo/backup3/hologram-manifest-before-outro.json`.
2. **CLI de recursos con fallo.** `bundled.py --apply` falla (`args.design` en vez de
   `args.designs`). Se usó la API `apply_demo_resource_plan` con el plan revisado
   (`/tmp/claude-promo/backup3/holo-plan.json`). No se modificó la CLI.
3. **Medios fuera de Git.** El `.gitignore` excluye `*.mp3` y `*.mp4`, igual que para el resto de
   diseños.

## Render de validación (30 s) — hecho, pendiente de revisión humana

- **Resultado:** `output/hf-val-lyrics-hologram/youtube_video.mp4` (1920×1080, H.264, AAC, 30,0 s) y
  `reels_video.mp4` (1080×1920, 30,0 s). Copias para revisar en
  `/home/university/Descargas/lyrics-hologram-validacion-30s-16x9.mp4` y `…-9x16.mp4`.
- **Verificación:** cuadros con contenido en 5, 12, 20 y 27 s (luminancia 24, 53, 206 y 18: no
  está en blanco). Sincronía comprobada en 4,9–5,1 s («IS» aparece justo cuando se canta; el
  cuadro de 5,29 s cae en un corte entre escenas y por eso la comprobación automática no lo ve).
- **Método:** no se usó `render_demo.py` directamente. Ese script pasa la entrada delgada de la
  demo al adaptador, que carga `/api/v1/…/source` y sale en blanco (así salió el primer intento,
  `output/hf-demo-lyrics-hologram/`, que queda sin tocar para revisión). El render válido monta la
  composición completa: documento ensamblado, runtime, config, letra, canción y medios por hash,
  con el marcador de render. Script: `/tmp/claude-promo/hf_validate_holo.py`.
- **Limitación conocida:** `HF_VALIDATED_LYRICS_TEMPLATE_IDS` (en `hyperframes_adapter.py`) no
  incluye `lyrics-hologram`. El flujo real de grabación de letras no aceptará la plantilla hasta
  añadirla, y eso solo se hace tras la revisión.

## Pendientes

- Tu revisión del video. Si está bien, se añade a `HF_VALIDATED_LYRICS_TEMPLATE_IDS`.
- Guardar las miniaturas A/B desde un borrador real.
- Recargar la web para ver la plantilla en Plantillas → Videos de letras (la API ya la lista).

## Qué revisar

- El video 16:9 y el 9:16 (copias en Descargas).
- La galería: `/api/v1/templates/lyrics-hologram/showcase/gallery.html`.
- La demo en Plantillas → Videos de letras → Holograma.
- Las decisiones 1 y 2 de este informe.
