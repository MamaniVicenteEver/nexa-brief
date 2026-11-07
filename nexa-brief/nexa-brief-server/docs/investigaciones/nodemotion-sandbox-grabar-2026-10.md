# NodeMotion · Sandbox → Preparar → Grabar y publicar (plan, 2026-10-14)

Objetivo: que el modal de una plantilla de NodeMotion (`/plantillas?cat=node_motion`) tenga el mismo
nivel que NodeHistory/NodeTech: prototipos con sus medios, previsualización, textos de publicación
completos (canción, títulos, descripciones, etiquetas por red) y una pestaña de grabar/publicar con
canales por marca, formato por cuenta y seguimiento en «Videos en proceso».
Incluye además: arreglos de Biblioteca (modal «Publicar ahora», formato al publicar, estado
«Publicando…» en la card) y el fallo de Instagram (error 2207077).

## 1. Lo que ya existe y se reutiliza

| pieza | dónde | se usa para |
|---|---|---|
| Drafts (preview persistido que se graba después) | `src/core/drafts.py`, `routers/drafts.py` | cada **prototipo** del Sandbox es un draft |
| Pipeline con `resume=True` | `src/core/pipeline.py` | grabar retoma el MISMO job del preview |
| Generación de textos (estrategias en `src/skills/output/copy`) | `modules/copy_writer.py`, `result_summarizer.py` | **Preparar** = generar los textos antes de grabar |
| Cola de publicación + `publish_entry` + evento `queue_entry_changed` | `core/schedule/engine.py`, `queue_repository.py` | publicar por (cuenta, formato) con estado visible |
| Agrupación de cuentas por marca + «Otros» | `explainer/components/ExplainerStudioSidebar.tsx` | se extrae a un componente compartido |
| Bandeja «Videos en proceso» | `create-video/components/JobsTray.tsx` + `jobs-tray-store` | la grabación de NodeMotion se agrega ahí |

## 2. Flujo para la persona

Sidebar del modal con 3 pestañas:

1. **Video original**: la plantilla tal cual (lo que se ve en el escenario por defecto), qué pide
   (canción, medios, textos) y con qué motores/formatos graba. Botón «Nuevo prototipo».
2. **Sandbox**: lista tipo cuaderno con los prototipos de ESTA plantilla (nombre, canción, estado).
   - Clic en uno → se abre en el sidebar: canción, video/imagen de fondo, textos (los mismos campos de hoy).
   - **Previsualizar** → crea su carpeta y el preview (draft). El escenario muestra el prototipo.
   - El botón pasa a **Preparar** → genera nombre de la canción, artista, título/descripción/etiquetas
     para YouTube, Facebook, Instagram y TikTok (mismas estrategias que hoy, más el resumen).
   - Ya preparado aparece **Detalles**: se ven y se editan esos textos antes de grabar.
   - Cambiar la canción o los medios después de previsualizar vuelve a pedir «Previsualizar».
3. **Grabar**: elegir un prototipo **preparado**; sus detalles en un acordeón cerrado (se abre si se quiere);
   motor (por defecto **HyperFrames** si la plantilla lo soporta); formatos (por defecto **16:9**);
   canales por marca en acordeón (igual que NodeHistory) con un formato por cuenta (solo los marcados);
   botón **Grabar**. La grabación aparece en «Videos en proceso» con su nombre
   («Grabando · <plantilla> · <prototipo>») y al terminar queda en Biblioteca.

Estados de un prototipo: `previewing → preview_ready → preparing → prepared → rendering → rendered`
(+ `failed`, recuperable como hoy).

## 3. Backend

### 3.1 Drafts (prototipos) — `src/core/drafts.py` + nuevo `src/core/draft_details.py`
- `Draft.name` (editable) y `Draft.details: DraftDetails | None`.
- `DraftDetails`: `song_name`, `artist`, `language`, `copies: {youtube|facebook|instagram|tiktok: {title, description, tags}}`,
  `generated_at`, `edited: bool`.
- Nuevos estados `preparing`, `prepared`. `can_render` acepta `preview_ready` y `prepared`.
- `draft_details.prepare(draft)`: usa el job guardado (HTML_GENERATED: ya tiene letra y música) y
  `copy_writer.write_copy` (las mismas estrategias activas, ahora con Instagram) → guarda `details`.
- Al grabar, los detalles se vuelcan al job (`artifacts.summary`) y `result_summarizer` **no** vuelve a
  pedir los textos a la IA si ya vienen preparados: solo los registra en `08_resumen_final.json`.

### 3.2 API — `routers/drafts.py` (archivos chicos: router fino, lógica en core)
| método | ruta | qué hace |
|---|---|---|
| PATCH | `/drafts/{id}` | renombrar (`name`) |
| POST | `/drafts/{id}/prepare` | genera los detalles (202, estado `preparing` → `prepared`) |
| PUT | `/drafts/{id}/details` | guarda los detalles editados (`edited=true`) |
| POST | `/drafts/{id}/render` | + `formats: ["16x9","9x16"]`, `account_formats: {selector: "16x9"\|"9x16"}`, `privacy` |

### 3.3 Grabar solo los formatos elegidos
- `JobInput.formats` (None = los del nicho, como hoy). El pipeline filtra `niche_cfg.video.formats`
  una sola vez al cargarlo; recorder y packager ya trabajan sobre esa lista.

### 3.4 Publicar por cuenta y formato (mismo camino que Biblioteca)
- Las cuentas elegidas al grabar ya NO van por `social_publisher` (mandaba siempre el 16:9, también a
  Instagram): al terminar la grabación se crea una entrada de cola por (cuenta, formato) y se publica con
  `engine.publish_entry`. Así la card de Biblioteca muestra «Publicando… · canal» y el resultado.
- `job_tracker` guarda `format_paths {"16x9", "9x16"}` también para los jobs del pipeline.

### 3.5 Biblioteca — publicar ahora con formato
- `PublishNowRequest.format` opcional; el motor usa `format_paths[format]`.

### 3.6 Instagram (fallo del 13/10, «2207077»)
- Causa: el 9:16 de Deep Blue pesaba **381 MB**; Reels acepta hasta **300 MB** (y audio ≤ 128 kbps).
  YouTube y Facebook aceptan más, por eso esos sí salieron.
- `render_promo.py`: codificar más liviano (`-crf 23 -maxrate 6M -bufsize 12M`, audio 128k/48 kHz, faststart).
- `instagram_adapter.py`: si el archivo pasa ~290 MB o el audio > 128 kbps, se transcodifica una copia
  apta para Reels y se sube esa.
- No re-crear el contenedor (y re-descargar 380 MB) en cada reintento por timeout; ventana de espera
  acorde al tamaño.
- `copy_prompt.py`: falta `instagram` en `_PLATFORM_NAMES` (KeyError del test) → se completa.

## 4. Web

### 4.1 Estructura (componentes chicos)
```
features/studio/
  components/
    StudioSidebar.tsx            ← solo pestañas (original | sandbox | grabar)
    original/OriginalTab.tsx
    sandbox/SandboxTab.tsx       ← lista ↔ editor
    sandbox/PrototypeList.tsx
    sandbox/PrototypeEditor.tsx  ← RequirementsForm + acción principal
    sandbox/PrototypeActions.tsx ← Previsualizar / Preparar / Detalles
    sandbox/DetailsEditor.tsx
    record/RecordTab.tsx
    record/PrototypePicker.tsx
    record/DetailsAccordion.tsx
  hooks/usePrototypes.ts, usePrototypeActions.ts
shared/components/publish/
  groupAccountsByBrand.ts        ← lógica pura (marca = grupo con canal de YouTube; «Otros» al final)
  BrandAccountPicker.tsx         ← acordeón por marca + formato por cuenta (usado por NodeMotion y explainer)
```
### 4.2 Biblioteca
- `PublishNowDialog`: las secciones no se encogen (`shrink-0`), la lista hace scroll.
- Si el video tiene 16:9 y 9:16: selector de formato por cuenta antes de publicar.
- `VideoCard`: chip «Publicando… · <canal>» aunque el video ya esté publicado en otra cuenta.

## 5. Fases
1. Instagram + textos de Instagram + Biblioteca (formato al publicar, modal, card).
2. Backend de prototipos: nombre, preparar, detalles, formatos, publicación por cola.
3. Web: componente compartido de cuentas por marca; pestañas Video original / Sandbox / Grabar.
4. Pruebas: tests, tsc/biome, flujo completo con una plantilla (previsualizar → preparar → grabar en 16:9 sin publicar).
