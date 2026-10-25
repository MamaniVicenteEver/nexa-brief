# Integración de publicaciones con imágenes en Facebook e Instagram

**Fecha:** 2026-10-25  
**Alcance:** análisis de solo lectura del código de Nexa Brief. La investigación de endpoints y requisitos vigentes de Meta queda a cargo de la tarea paralela; las referencias de este documento describen lo implementado por este repo.  
**Convención:** cada referencia `ruta:línea` apunta a una línea concreta del checkout revisado.

## Resumen

La integración actual ya tiene las cuentas de Facebook e Instagram, sus tokens cifrados, la fachada de publicación, la cola programada, el historial de publicaciones, sincronización de canales y un mecanismo para que Meta descargue un MP4 desde una URL pública firmada. En Instagram, ese camino publica **Reels**; en Facebook, publica **videos/Reels**.

La brecha principal es de dominio y flujo: `PublisherPort`, los endpoints, la cola y el motor de programación modelan un `video_path` ligado a un `job_id`. No existe un tipo `ImagePost` o `Carousel`, ni un renderer de imágenes publicables, ni publicación fotográfica en los adaptadores de Meta. La sincronización de los canales también filtra o consulta videos. Por eso, configurar seis horarios diarios por red no produciría la mezcla pedida: el auto-fill buscaría seis videos empaquetados y no dos imágenes más un video.

La vía de menor impacto es reutilizar el sistema de horarios, cuentas/tokens, `DataStore`, estrategias editoriales y componentes visuales, y agregar un flujo de contenido y entrega tipado para imágenes. Conviene separar **contenido** (una imagen o un carrusel reutilizable) de **entregas** (una publicación por red/cuenta), renderizar los artes como archivos estáticos, y ampliar los puertos de publicación y catálogo. Para las cuentas conectadas actualmente, el objetivo equivale a **12 entregas diarias**: 2 categorías × 3 piezas por día × 2 redes, antes de sumar otras cuentas.

## 1. Pipeline de publicación actual

| Tramo | Comportamiento actual | Evidencia |
|---|---|---|
| Contrato de publicación | `PublisherPort.publish()` recibe ruta a un video, título, descripción, tags y alias; devuelve ID y URL. El resultado y los metadatos también se llaman `PublishVideoResult` y `VideoMetadata`. | `src/core/ports/publisher_port.py:24`, `src/core/ports/publisher_port.py:62` |
| Adaptadores Meta | `FacebookAdapter.publish()` sube video normal o Reel; `InstagramAdapter.publish()` crea y publica contenedores de Reel. Ninguno implementa una operación fotográfica o de carrusel. | `src/adapters/publishing/facebook_adapter.py:243`, `src/adapters/publishing/instagram_adapter.py:175` |
| Fachada | `PublisherFacade` crea y conserva un `TokenManager` y adapta TikTok, YouTube, Facebook e Instagram. `publish_video()` resuelve `plataforma:alias` y despacha al adaptador. | `src/adapters/publishing/publisher_facade.py:50`, `src/adapters/publishing/publisher_facade.py:65`, `src/adapters/publishing/publisher_facade.py:104` |
| Publicación manual | `POST /api/v1/publish/` acepta `ManualPublishRequest.video_path`, llama a `publish_video()` y registra el resultado. La descripción del endpoint y el esquema son explícitamente de video. | `src/presentation/api/routers/publisher.py:117`, `src/presentation/api/schemas/publisher_schema.py:14` |
| Programación por slots | `ScheduleSlot` guarda plataforma, alias, días, horas UTC y un filtro de categoría. Las rutas `/schedule/slots` permiten CRUD; `/schedule/slots/{id}/assign` asigna un `job_id` a una ocurrencia concreta. | `src/core/schedule/models.py:39`, `src/presentation/api/routers/schedule.py:61`, `src/presentation/api/routers/schedule.py:118` |
| Cola | `QueueEntry` requiere `job_id`, plataforma y alias; permite `format`, `slot_id`, fecha programada, estado, ID/URL del post y error. Hay rutas de consulta, creación ad-hoc, cancelación y publicación inmediata. | `src/core/schedule/models.py:53`, `src/presentation/api/routers/schedule.py:150`, `src/presentation/api/routers/schedule.py:171`, `src/presentation/api/routers/schedule.py:218` |
| Motor y auto-fill | `publish_entry()` busca el `job` y su resumen, decide un archivo de video en `file_paths`, genera el copy por red y llama a la fachada. `_fill_gaps()` busca el job empaquetado más antiguo de la categoría y evita reutilizarlo para la misma plataforma/cuenta. | `src/core/schedule/engine.py:107`, `src/core/schedule/engine.py:136`, `src/core/schedule/engine.py:177`, `src/core/schedule/engine.py:261` |
| Tick | Con auto-publicación habilitada, APScheduler invoca `_automation_tick()` y `engine.process_tick()` cada `schedule_tick_interval_seconds`; el motor recupera entradas atascadas, llena slots vencidos y publica entradas debidas. Por separado, se refrescan tokens cada 15 minutos y se sincronizan canales en el intervalo configurado. | `src/adapters/publishing/scheduler.py:41`, `src/adapters/publishing/scheduler.py:125`, `src/adapters/publishing/scheduler.py:134`, `src/adapters/publishing/scheduler.py:168`, `src/adapters/publishing/scheduler.py:195` |
| Plan semanal | `/schedule/planner/chat` propone fecha, hora, categoría, diseño y tema; el plan se guarda como borrador en `content_plan`. Producir un ítem llama al productor explainer. La automatización actual cubre categorías y diseños, no un formato de publicación fotográfica. | `src/core/schedule/planner.py:116`, `src/core/schedule/planner.py:158`, `src/core/schedule/planner.py:213`, `src/presentation/api/routers/schedule.py:303`, `src/presentation/api/routers/schedule.py:344` |

### Flujo actual (texto)

```text
Plan semanal IA (categoría + diseño + tema + hora)
  → content_plan (borrador)
  → producción explainer-kit y grabación
  → job listo en job_tracker (stage=packaged; archivos en file_paths)
  → ScheduleSlot (plataforma + alias + categoría + días/horas UTC)
  → QueueEntry (job_id + formato de video + fecha)
  → scheduler tick → schedule.engine.publish_entry()
  → job_tracker resumen/archivo → copy_for_platform()
  → PublisherFacade → Facebook video/Reel o Instagram Reel
  → QueueEntry published + published_videos
  → ChannelCatalogPort / channel_sync actualiza catálogo y métricas
```

`POST /api/v1/schedule/publish-now` evita esperar al siguiente tick y delega en el mismo `publish_entry()`. El scheduler respeta UTC; `ScheduleSlot.times` documenta esa zona horaria. No hay un timezone local por cuenta. Referencias: `src/presentation/api/routers/schedule.py:218`, `src/core/schedule/models.py:45`, `src/core/schedule/engine.py:17`.

### Persistencia, canales y credenciales

`core.data` entrega el contrato `DataStore`; la implementación configurada hoy es JSON. `layout.py` asigna `schedule_slots` a `data/schedule/slots.json`, `queue_entries` a `data/schedule/queue.json`, `image_assets` a `data/library/images.json`, los binarios de imagen a `data/library/files/images/`, y el registro de canales/publicaciones a `data/canales/`. Eso permite reutilizar los nombres lógicos desde repositorios y mantener abierta una migración futura de backend. Referencias: `src/core/ports/data_port.py:39`, `src/core/ports/data_port.py:87`, `src/core/data.py:20`, `src/adapters/data/factory.py:9`, `src/adapters/data/layout.py:13`, `src/adapters/data/layout.py:47`.

Las credenciales quedan fuera del `DataStore`: `TokenStorage` guarda tokens cifrados en el archivo indicado por `ACCOUNTS_JSON_PATH`; no inspeccioné el archivo ni ningún secreto. Los registros se direccionan por pareja `(platform, alias)`, exponen un `target_id` y el manager entrega un token válido o pide reautenticación. El scheduler revisa expiración proactivamente. Las Pages de Facebook quedan como cuentas `facebook:<alias>` con Page ID; la conexión de Instagram descubre el perfil profesional vinculado a una Page y guarda su ID profesional y el ID/nombre de la Page enlazada bajo `instagram:<alias>`. Referencias: `src/config/settings.py:283`, `src/adapters/publishing/token_storage.py:34`, `src/adapters/publishing/token_storage.py:139`, `src/adapters/publishing/token_manager.py:63`, `src/adapters/publishing/token_manager.py:67`, `src/adapters/publishing/token_manager.py:167`, `src/presentation/api/routers/publisher.py:1016`, `src/presentation/api/routers/publisher.py:1239`, `src/presentation/api/routers/publisher.py:1280`, `src/presentation/api/routers/publisher.py:1337`.

### Historial y sincronización

La cola es la fuente de estado de cada intento (`queued`, `publishing`, `published`, `failed`, etc.); al tener éxito el motor actualiza la cola y llama a `publish_log.record_published_video()`. Ese registro conserva plataforma, alias, post ID, URL, título, fecha, `job_id`, origen y datos adicionales. `channel_sync` reconcilia por ID, agrega publicaciones remotas importadas y guarda un objeto `metrics` con vistas, likes, comentarios y fecha de sincronización. Referencias: `src/core/schedule/models.py:23`, `src/core/schedule/queue_repository.py:60`, `src/core/schedule/queue_repository.py:175`, `src/core/schedule/queue_repository.py:180`, `src/core/publish_log.py:22`, `src/core/channel_sync.py:43`, `src/core/channel_sync.py:78`.

La interfaz de catálogo sigue siendo video-céntrica: `ChannelCatalogPort` devuelve `RemoteVideo`; Facebook consulta sus edges `/{page-id}/videos` y `/{page-id}/video_reels`, e Instagram descarta medios que no sean `VIDEO` o `REELS`. El sync, por tanto, no ofrece un catálogo tipado para fotos/carruseles. Instagram mapea `media_count` a `ChannelStats.video_count`, aunque el campo remoto cuenta media en general. Referencias: `src/core/ports/channel_catalog_port.py:17`, `src/core/ports/channel_catalog_port.py:42`, `src/adapters/publishing/facebook_adapter.py:182`, `src/adapters/publishing/instagram_adapter.py:112`, `src/adapters/publishing/instagram_adapter.py:133`, `src/adapters/publishing/instagram_adapter.py:170`.

### Paquete editorial explainer

`publish.json` v2 ya estandariza categoría, miniaturas, títulos, descripción, fuentes, créditos, tags, comentario fijado y `strategies_used`. Incluye una copia de Facebook y otra de TikTok, y `ThumbnailWithImage` guarda una imagen candidata, composición y revisiones editoriales. `src/skills/explainer/strategies` valida largo/cantidad de títulos, miniaturas, hashtags y cifras contrastándolas con guion/transcripción; hay una estrategia de miniatura con criterios de imagen. Es una base editorial aprovechable, pero es un paquete para acompañar un video y su thumbnail: no modela `ImagePost`, carrusel, caption IG, alt text ni una secuencia de artes. Referencias: `src/core/explainer/publishing/package.py:36`, `src/core/explainer/publishing/package.py:59`, `src/core/explainer/publishing/package.py:91`, `src/core/explainer/publishing/package.py:156`, `src/core/explainer/publishing/strategies.py:83`, `src/skills/explainer/README.md:43`.

### URL pública y límite de tamaño de Instagram

Instagram ya publica Reels a través de un archivo dentro de `OUTPUT_DIR`: `create_signed_media_token()` limita el path a MP4 existente bajo esa raíz, agrega expiración y HMAC; `/api/v1/publish/instagram/media/{token}` sirve el archivo con soporte de Range y caché corta. El adapter forma la URL con `PUBLIC_APP_URL`. La entrada pública del túnel termina en la web `localhost:3000`, y Next reescribe `/api/v1/*` hacia la API local en `:8000`; por tanto, el archivo ya se sirve por el origen público configurado. Para imágenes se necesita una ruta firmada compatible con JPEG/PNG/WebP y su MIME, no la URL local de una captura. Referencias: `src/adapters/publishing/instagram_media_url.py:21`, `src/adapters/publishing/instagram_media_url.py:36`, `src/presentation/api/routers/publisher.py:1395`, `src/adapters/publishing/instagram_adapter.py:203`, `src/adapters/publishing/instagram_adapter.py:215`, `nexa-brief-web/next.config.ts:25`, `cloudflare-tunnel/README.md:24`.

El arreglo actual de videos para Reels se centraliza en `instagram_media.py`: rechaza más de 15 minutos; si el archivo supera 290 MiB, genera/reutiliza una copia `-ig.mp4` con objetivo de 280 MiB y parámetros H.264/AAC/faststart. `needs_transcode()` decide por tamaño; la duración sí se comprueba, pero la rutina no fuerza una transcodificación solo por bitrate de audio. No aplica a artes estáticos. Referencias: `src/adapters/publishing/instagram_media.py:23`, `src/adapters/publishing/instagram_media.py:77`, `src/adapters/publishing/instagram_media.py:94`, `src/adapters/publishing/instagram_media.py:117`.

## 2. Qué sirve para imágenes y qué falta

| Área | Ya disponible | Falta para imágenes y carruseles |
|---|---|---|
| Cuentas y selección de red | Alias por plataforma, target Page/IG, token cifrado/renovación, OAuth, estados de reconexión y fachadas. `PublisherFacade` ya resuelve `facebook:alias` e `instagram:alias`. | En principio no hace falta un almacén de credenciales nuevo. Las publicaciones deben recibir la cuenta objetivo y validar el tipo de cuenta/permisos antes de enviar. |
| Metadatos de publicación | Copy por plataforma, hashtags y estrategia de títulos en `publish.json` v2. La estrategia registra revisiones de imágenes para la miniatura del video. | Campo de tipo (`image`, `carousel`, `video`), copy/caption final por Facebook e Instagram, texto alternativo por imagen y por slide, orden y rol de portada del carrusel, metadatos del archivo/ratio, fuente/licencia de cada asset e ID de la plantilla renderizadora. |
| Contrato de publicación | El resultado normalizado incluye ID, URL, plataforma, alias y respuesta cruda. Hay manejo común de errores y reintentos en adaptadores. | Añadir contrato de imagen/carrusel sin confundirlo con `video_path`. Hoy `ManualPublishRequest` exige esa ruta y no contiene `alt_text`, slides ni media kind (`src/presentation/api/schemas/publisher_schema.py:14`). |
| Instagram | Existe creación de contenedor, espera a `FINISHED`, publicación mediante `media_publish`, permalink y caption de Reel (título + descripción + hashtags, truncado a 2200 caracteres). | No hay camino `image_url`, carrusel ni fields para alt text. El flow actual envía `media_type=REELS` y `video_url` (`src/adapters/publishing/instagram_adapter.py:233`). Implementar endpoints según la investigación de Meta, validar el procesamiento del contenedor y mapear IDs resultantes. |
| Facebook | Carga de video normal y Reel con token y Page ID. | No hay `photos` o álbum/carrusel ni metadatos de publicación fotográfica en `FacebookAdapter`. Implementar el camino que valide la investigación paralela de Meta. |
| Validación de medios | Existe probe/transcode de video para Reels, una miniatura YouTube con JPEG/PNG hasta 2 MB, y en stock se normalizan dimensiones/orientación. | Validación previa de formato MIME real, extensión, bytes, resolución mínima/máxima, orientación y proporción según el tipo de post/plataforma; reencode determinista (p. ej. RGB/RGBA, JPEG/PNG) y rechazo de archivos corruptos. Las reglas por red y carrusel quedan pendientes de la validación de Meta. |
| Catálogo y métricas | El sync existente normaliza enlaces, métricas básicas y número de seguidores/cuenta; el log permite guardar campos extra. | `RemoteVideo` y los edges actuales no incorporan posts fotográficos. Añadir un tipo `RemotePost` (o equivalente) con media kind, caption, permalink, orden/slides y métricas; separar conteo de medios de conteo de videos. Para aprender, persistir snapshots de insights en el tiempo; hoy `metrics` se reemplaza en cada sync. |
| Revisión humana | El plan semanal es borrador, producción es explícita, la cola deja cancelar lo `queued`, y el paquete v2 valida reglas editoriales. | Estado editorial específico `draft → rendered → needs_review/approved → queued → publishing → published/failed`; vista previa y aprobación opcional antes de habilitar la entrega. El flujo de video actual no representa un arte que aún espera revisión. |

No conviene reutilizar el nombre `VideoMetadata` ni añadir `image_path` como un parámetro suelto al adaptador de Reel: eso escondería un cambio de tipo de contenido y dejaría el scheduler y el historial inconsistentes.

## 3. Origen y generación de las imágenes

| Herramienta o fuente | Qué hace hoy | Encaje propuesto |
|---|---|---|
| `tools/poster.py` del explainer-kit | Abre la página final del video con Playwright, busca un beat `main` (o recibe `--t`), ejecuta `window.__promo.seek(t)` y guarda `render/poster.jpg` a 960×540. Es una portada/póster de video, no un generador de posts de feed. | Reutilizar el patrón Playwright + `seek(t)` como renderer de cuadros. No usar ese tamaño/aspecto de forma fija para entrega social. `src/templates/_tools/explainer-kit/tools/poster.py:24`, `src/templates/_tools/explainer-kit/tools/poster.py:27`, `src/templates/_tools/explainer-kit/tools/poster.py:38`, `src/templates/_tools/explainer-kit/tools/poster.py:45`. |
| `tools/thumbnail.py` del explainer-kit | Renderiza un componente elegido con parámetros, busca un cuadro estable, captura 1280×720 y guarda JPEG + WebP. La propia guía explica que es la intro de un video para YouTube y que debe ser igual a lo que abre el video. | Es la base más directa para una plantilla de tarjeta: dar al renderer un tamaño/aspect ratio de salida y definir un componente `imagepost.*` o storyboard de una sola escena; usar el `t`/seek determinista para el cuadro fijo. Separar `render/social/` de la thumbnail YouTube. `src/templates/_tools/explainer-kit/tools/thumbnail.py:2`, `src/templates/_tools/explainer-kit/tools/thumbnail.py:58`, `src/templates/_tools/explainer-kit/tools/thumbnail.py:71`, `src/templates/_tools/explainer-kit/tools/thumbnail.py:77`. |
| `modules/thumbnail_maker.py` | Extrae un frame estable cerca del segundo que declara la intro, de un video 16:9 ya grabado; produce `thumbnail.jpg` para YouTube (≤2 MiB) y copia WebP para la web. Se activa hoy desde el motor de publicación para YouTube. | Puede servir para elegir una imagen fija derivada de un video como asset secundario, pero no para diseñar tarjetas informativas nuevas. Extender esta función no debe convertir la miniatura en el arte social por defecto. `src/modules/thumbnail_maker.py:1`, `src/modules/thumbnail_maker.py:28`, `src/modules/thumbnail_maker.py:150`, `src/modules/thumbnail_maker.py:164`. |
| Miniaturas del sandbox | Playwright captura `index.html` a 1280×720, cachea JPEG por carpeta/plantilla, y en la ruta explainer se sirve con `require_internal`. En los diseños explainer el helper añade `?t=1`; no es una URL pública para que Meta consuma. | Reusar caché, renderer y mecanismo de invalidación para previews internas. El archivo aprobado para publicar debe salir de una ruta/exportación distinta, con dimensión de post, versión y URL firmada. `src/core/explainer/sandbox_thumbs.py:16`, `src/core/explainer/sandbox_thumbs.py:24`, `src/core/explainer/sandbox_thumbs.py:62`, `src/core/explainer/sandbox_thumbs.py:166`, `src/presentation/api/routers/sandbox.py:97`. |
| Componentes/designs del explainer-kit | Componentes parametrizados ya dibujan texto, fotos, cifras, cronologías y diagramas; las miniaturas A/B ya los usan. NodeTech tiene `rough` (trazo manual y lima); NodeHistory usa `binary` (fotos B/N, retratos en dígitos) y también dispone de otros diseños históricos. | Para una tarjeta “dato histórico” conviene un componente estático con fecha/cifra, fuente corta y foto/mapa; para “5 datos” conviene un carrusel de varias slides con retícula consistente y número de slide. Reusar componentes por parámetros, no copiar el motor ni atar el diseño a un tema de un solo post. `nexa-brief-server/niches.json:2943`, `nexa-brief-server/niches.json:2998`, `src/templates/_tools/explainer-kit/designs/rough/DESIGN.md:5`, `src/templates/_tools/explainer-kit/designs/binary/DESIGN.md:5`, `src/templates/_tools/explainer-kit/CATALOG.md:17`. |
| Fábrica de prototipos | `sandbox/PROTOTIPO.md` define el flujo desde referencia: seleccionar motor y plantilla similar, plan, componentes reutilizables, ensamblado y revisión en sandbox. Está descrito como fábrica de **videos** y el sandbox no publica. | Aplicar sus puertas de diseño para una plantilla nueva de imagen, pero incorporar un export de arte estático y revisión visual como entregables explícitos. Las plantillas de post no deben promoverse/publicarse por el endpoint de promover video hasta que exista ese contrato. `src/templates/sandbox/PROTOTIPO.md:1`, `src/templates/sandbox/PROTOTIPO.md:50`, `src/templates/sandbox/PROTOTIPO.md:65`, `src/templates/sandbox/PROTOTIPO.md:95`. |
| Pexels/Pixabay/Unsplash y medios históricos | `StockMediaPort` busca resultados normalizados de imagen/video con dimensión, orientación, autor, URL de origen y licencia; el flujo de librería puede importar el medio elegido. El `ImagePort` más antiguo descarga fondos y asume paisaje. El CLI del kit permite Commons, Pexels y Pixabay y registra crédito. | Reusar `StockMediaPort` para buscar, elegir, importar y acreditar fotos; mantener autor, URL fuente, licencia y media ID junto al post. Pexels puede cubrir imágenes ilustrativas; en posts históricos, distinguir una imagen editorial de stock de un documento/archivo histórico real. Preferir Commons/archivos con licencia comprobada para esta última categoría. `src/core/ports/stock_media_port.py:22`, `src/core/ports/stock_media_port.py:26`, `src/adapters/stock/pexels.py:48`, `src/adapters/stock/pixabay.py:50`, `src/core/ports/image_port.py:22`, `src/templates/_tools/explainer-kit/tools/media.py:19`. |
| Gemini | `AIPort` ofrece `complete_json`, `complete_text`, `analyze_image` y `analyze_image_full`; Gemini implementa análisis multimodal contra criterios y extracción estructurada. No encontré un adapter de generación de imagen/text-to-image. | Usar Gemini como control de calidad opcional (legibilidad, criterio visual, coherencia con el dato, texto no recortado) o extracción de detalles de medios; renderizar el arte con componentes reproducibles. Si más adelante se incorpora síntesis de imagen, que tenga un puerto/adaptador propio y derechos/procedencia registrados. `src/core/ports/ai_port.py:7`, `src/core/ports/ai_port.py:32`, `src/core/ports/ai_port.py:50`, `src/adapters/ai/infrastructure/gemini_flash_adapter.py:106`, `src/adapters/ai/infrastructure/gemini_flash_adapter.py:153`. |

### Encaje de una plantilla de imagen

La categoría ya define diseño y estrategia, y el renderer de video ya sabe reproducir componentes deterministas. Propongo un arte por categoría con plantilla versionada y parámetros explícitos:

- **NodeTech (`node_tech`, daily):** estilo `rough`, titulares cortos, dato tecnológico central, diagrama o foto ilustrativa enmarcada a mano. La categoría define tono y fórmulas; su regla prohíbe prometer un dato que no figure en el material verificado (`nexa-brief-server/niches.json:2954`).
- **NodeHistory (`node_history`, daily):** `binary` para cifras/retratos y variantes como `carta`, `cronica` o `periodico` cuando el material visual se preste. Mantener blanco/negro, fecha/lugar y fuente visible; tratar muertes y guerras sin morbo (`nexa-brief-server/niches.json:3004`, `nexa-brief-server/niches.json:3048`).
- Una “plantilla de imagen” representa una composición de post, no un video de cero segundos: renderer recibe `template_id`, versión, datos verificados, medios y salida (`feed`, `story` u otra variante confirmada por la investigación de Meta). Para carrusel, renderiza una lista ordenada de slides con una misma identidad, y cada archivo es un asset separado.
- El catálogo del sandbox hoy se enfoca en carpetas con HTML y/o video. La fábrica debe añadir el tipo de plantilla/arte estático y una ruta de exportación; las miniaturas actuales son una previsualización y no son el archivo final de publicación (`src/core/explainer/sandbox.py:151`, `src/core/explainer/sandbox.py:158`).

## 4. Diseño propuesto: hexagonal y común a las redes

### Entidades del dominio

| Entidad | Campos principales | Responsabilidad |
|---|---|---|
| `ImagePost` | `content_id`, categoría, tema, `template_id` + versión, datos/copy, lista de fuentes, créditos, assets, caption por red, `alt_text`, dimensiones, estado editorial | Publicación de una sola imagen con contenido trazable y versión reproducible. |
| `Carousel` | Campos de `ImagePost` + slides ordenadas (`slide_id`, asset, alt text, número), portada, caption y copy por red | Colección indivisible de tarjetas de un mismo tema; el orden forma parte del contenido. |
| `RenderedAsset` | ID, path/clave en almacenamiento, MIME real, ancho/alto, bytes, checksum, proveedor/licencia/crédito, origen y plantilla | Binario inmutable con procedencia y validación. Puede aprovechar `image_assets` y `files("images")`, sumando los metadatos editoriales que no existen en `StockItem`. |
| `Delivery` | `delivery_id`, `content_id`, plataforma, alias, `slot_id`, fecha UTC, estado, `idempotency_key`, intentos, remote ID/URL, error, timestamps | Una entrega de contenido a una cuenta concreta; permite cross-post de la misma pieza sin duplicar el contenido/editorial. |
| `ScheduleSlot` | Añadir `content_kind` o reglas de mezcla/cuota por categoría y red, manteniendo días/horas UTC | Elegir el tipo correcto de pieza para cada ocurrencia, no solo cualquier job empaquetado. |

Para compatibilidad, `QueueEntry.job_id` puede permanecer para videos mientras se agrega `content_id` y un `media_kind`; a largo plazo se puede generalizar a `content_id`. Un post tiene una entrega por plataforma/cuenta. La entrega de Facebook no debe depender de que la entrega Instagram ya haya terminado.

### Puertos y adaptadores

1. **Dominio/editorial:** reutilizar `AIPort` para copy y revisión y `roles.json` para proveedores. Agregar un resultado estructurado para la pieza: texto de cada slide, cifras/fechas y fuente, copy de Facebook/Instagram, caption, alt text y versión del diseño. Reutilizar `research` (fuentes y fecha) y `fact_check` (segunda lectura contra fuentes); `copy_draft` ya redacta títulos/minis/comentario en DeepSeek. La estrategia por categoría debe añadir límites/voz de post sin apropiarse de las reglas de thumbnail. Referencias: `src/skills/models/roles.json:41`, `src/skills/models/roles.json:46`, `src/skills/models/roles.json:69`, `src/skills/models/roles.json:76`, `src/skills/models/roles.json:91`.
2. **Render:** `ImageRendererPort.render(template_id, data, assets, profile) → RenderedAsset[]`. Implementación inicial en Playwright/Chromium y componentes del explainer-kit; captura determinista por `seek(t)`; conversión, dimensiones y compresión se validan antes de generar una URL. El código del renderer no llama redes sociales.
3. **Almacenamiento:** reutilizar `DataStore.collection()` para posts/entregas y `FileStorage` para binarios. Introducir un `PublicMediaPort` que entregue URL temporal/firmada al proveedor; el adapter actual restringido a MP4 puede ampliarse de forma segura para MIME y extensiones permitidos o reemplazarse por una ruta de media firmada específica. No exponer paths locales arbitrarios.
4. **Publicación:** añadir un contrato discriminado por clase de media, con resultado común. Opción de migración segura: conservar `publish_video()` y sumar `publish_image()`/`publish_carousel()` detrás de `PublisherFacade.publish_post()`. Los adaptadores Meta implementan sus capacidades y devuelven errores tipados, ID y permalink. Así se evita cambiar en una sola etapa a todos los adaptadores de YouTube/TikTok.
5. **Cola y scheduler:** separar el horario de la entrega; admitir kind y fuente de contenido. Reutilizar `queue_repository` para transiciones/eventos, pero añadir registro de intentos, próxima ejecución, bloqueo por worker y clave de idempotencia persistente. La reasignación de una ocurrencia debe seguir siendo imposible tras comenzar el envío.
6. **Catálogo/insights:** sustituir el vocabulario video-céntrico del puerto por `RemotePost` o sumar un `ChannelPostCatalogPort` compatible. Implementar lecturas de posts fotográficos/carruseles e insights en adaptadores Meta, normalizar likes/comentarios/alcance/impresiones según disponibilidad y guardar snapshots, no solo el último valor.

### Secuencia editorial y de entrega

```text
slots de contenido por categoría/red (2 imágenes + 1 video al día)
  → planner (DeepSeek según roles.json) propone tema, tipo y hora
  → research guarda afirmaciones + fuentes fechadas
  → copy_draft redacta caption y slides → fact_check verifica cada afirmación
  → ImageRendererPort compone 1 imagen o N slides con plantilla versionada
  → validación de formato, dimensiones, texto legible, crédito y checksum
  → revisión humana opcional (preview + aprobar/rechazar)
  → ImagePost/Carousel aprobado + assets guardados
  → Delivery por Facebook:alias e Instagram:alias (una por target y slot)
  → Scheduler reclama delivery con idempotency_key y publica mediante facade
  → actualiza Delivery y log de posts; luego sync/insights añade snapshots
```

### Cadencia diaria y cuotas

Las categorías `node_tech` y `node_history` son activas, usan `explainer_kit` y declaran `default_cadence: daily`. Los slots actuales ya permiten múltiples horas en un día, pero no identifican el tipo de contenido. Configurar tres horas sin cambiar selección produciría contenido del mismo selector de jobs. Propuesta: tres ocurrencias por día para cada combinación categoría + red/cuenta, etiquetadas `image`, `carousel` o `video` según la política editorial; o una regla de cuota por categoría y día que cree esas tres entregas. Los dos assets fotográficos de cada categoría pueden cross-postearse a las dos redes, generando cuatro entregas de imagen por categoría y dos entregas de video, es decir, 12 entregas diarias total para dos redes y dos categorías. La planificación debe reservar margen de revisión y evitar que un fallo de render corra todas las horas del día.

### Idempotencia, reintentos, resultados y métricas

- Clave propuesta: `content_id + platform + account_alias + scheduled_occurrence`. Una restricción única en el repositorio evita que dos ticks o una reintento HTTP dupliquen el post. El uso de `entry_id` aleatorio por sí solo no resuelve reintentos duplicados del endpoint inmediato.
- Registrar estados `queued`, `publishing`, `published`, `failed`, `cancelled`, más `attempt_count`, `next_attempt_at`, error clasificado y `remote_post_id`. No reintentar automáticamente un error permanente de formato/permisos. Para fallo ambiguo tras enviar el publish, reconciliar el remoto antes de volver a publicar.
- Los reintentos actuales comparten un decorator de backoff para errores transitorios; la cola actual marca error y la recuperación de crash convierte `publishing` atascado a `failed`. Es buen punto de partida, pero no existe una política por tipo de error ni `retry_at`. Referencias: `src/adapters/publishing/base_platform.py:43`, `src/core/schedule/queue_repository.py:241`, `src/core/schedule/engine.py:187`.
- Escribir resultado de forma común con `content_id`, `delivery_id`, plataforma, alias, tipo, IDs, URLs, hora, plantilla y revisión. El log actual puede migrar de `published_videos` a `published_posts` o permanecer temporalmente con `kind` y `content_id` opcionales.
- Mantener snapshots diarios de insights por `post_id`; registrar qué versión de plantilla, copy, tema, formato y hora usó cada publicación para comparar rendimiento por categoría/red. No inferir alcance a partir de likes ni tratar un campo ausente como cero.

## 5. Plan por fases, estimaciones y riesgos

Estimaciones orientativas en días-persona para backend + frontend, asumiendo un solo renderer inicial y que la tarea paralela confirma el camino de API de Meta. No incluyen esperas externas de revisión de permisos de Meta ni producción diaria de nuevas plantillas.

| Fase | Trabajo | Estimación | Riesgos / puerta de salida |
|---|---|---:|---|
| 0. Contratos y alcance | Cerrar formatos/resoluciones, límites, permiso y secuencia de publicación con el estudio paralelo de Meta; decidir si “2 imágenes” incluye posts individuales o carruseles. | 0,5–1 d | Si se implementa antes de confirmar capacidades/permisos, puede requerir reescritura de adapters o UX. |
| 1. Dominio y persistencia | Modelos ImagePost/Carousel/RenderedAsset/Delivery, colecciones en `layout.py`, compatibilidad de `QueueEntry`, log y estrategia de migración JSON. | 2–3 d | `DataStore` JSON está diseñado para registros chicos; no guardar binarios grandes en JSON. Reutilizar FileStorage para assets. |
| 2. Plantilla y renderer | Export estático Playwright por perfiles de salida; pipeline de datos verificados; primera plantilla NodeTech `rough` y NodeHistory `binary`; preview, validación y almacenamiento. | 3–5 d | Legibilidad en móvil, texto largo en español, licencias/fuentes, dimensiones por placement y cache de browser. No confundir preview con arte publicable. |
| 3. Adaptadores Meta | Añadir publicación de imagen/carrusel en Facebook e Instagram, URL pública firmada para archivos aprobados, estados de procesamiento, captions/alt text y mapping de errores. | 3–5 d | Requiere que la API, permisos y cuenta profesional permitan las operaciones; vigencia/límites los valida la tarea paralela. La ruta externa debe ser accesible a Meta vía túnel/proxy. |
| 4. Planificador y UI | Planner con `content_kind`, reglas de cuota 2+1, entrega por cuenta/red, aprobación opcional, preview, cancelación y visibilidad del resultado. | 2–4 d | No llenar huecos con un tipo equivocado; coordinar horarios y estados de revisión. El planner actual solo produce vía explainer. |
| 5. Idempotencia, sync e insights | Unique key y locking, reintentos clasificados, reconciliación post timeout, catálogo común para media y snapshots de métricas. | 2–4 d | Un timeout después de la llamada remota puede dejar resultado incierto; no duplicar en retry. Insights pueden variar por permisos y tipo de post. |
| 6. Salida gradual | Canary manual en una cuenta de prueba; luego habilitar auto-scheduler y revisar logs/ratios durante una semana antes de ampliar cuentas. | 1–2 d | Ajustar frecuencia/límites con datos reales; pausado por cuenta o por tipo debe estar disponible. |

**Total orientativo:** 13,5–24 días-persona más validación/permisos externos. Se puede lanzar primero un MVP con imagen única y dos perfiles estáticos; carruseles e insights históricos pueden entrar en las fases 3/5 después de validar el post simple, pero el modelo debe dejar espacio al carrusel desde el inicio.

### Riesgos transversales

1. **Permisos y política de Meta:** no asumir que el permiso para Reels habilita publicación de imágenes/carruseles ni que las capacidades sean idénticas para Facebook e Instagram. La versión Graph configurada es común pero evoluciona; validar con la investigación vigente y una cuenta de prueba.
2. **Entrega pública del archivo:** la ruta IG de hoy solo acepta MP4 bajo `OUTPUT_DIR`; el feed de imagen necesita bytes estáticos servidos con MIME correcto, URL externa de HTTPS, TTL suficiente y path firmado. La regla del túnel la administra Cloudflare; conservar su configuración existente y el proxy actual.
3. **Diferencia entre contenido y entrega:** el mismo arte puede ir a varias redes, pero cada intento tiene permisos/resultado/remoto propio. Mezclar el arte en el job de video multiplica acoplamiento y problemas de reintento.
4. **Desinformación visual:** una cifra incorrecta o una imagen histórica mal rotulada perjudica más que un copy malo. Toda cifra/fecha/leyenda visible necesita una fuente fechada, revisión fact-check y marca de “representación ilustrativa” cuando corresponda.
5. **Calidad del carrusel:** un post parcialmente publicado no es equivalente a éxito completo. Registrar orden, IDs de cada medio y el ID del contenedor/post final para poder diagnosticar y reconciliar.
6. **Almacenamiento y privacidad:** las URLs firmadas son públicas durante su TTL. No incluir tokens OAuth ni exponer paths o archivos arbitrarios; impedir traversal y limitar extensiones/MIME/tamaño.

## 6. Pruebas necesarias

Estas pruebas forman parte de la propuesta; no se ejecutaron porque el brief pidió analizar el código y escribir solo este documento.

| Grupo | Casos que cubrir |
|---|---|
| Dominio y serialización | Validar `ImagePost`, `Carousel`, slides ordenadas, alt text, URL fuente/licencia, versión del template y estados; leer/escribir con DataStore JSON y conservar entradas de video existentes. |
| Renderer | Pruebas snapshot/captura por perfil y proporción; texto largo, acentos/ñ, fuente ausente, archivo ausente, componente que falla, determinismo del frame, colores/RGB y bytes por debajo del límite; una prueba visual asistida para rough/binary. |
| Validación de media | Extensión engañosa, MIME distinto, JPEG/PNG/WebP válido y corrupto, dimensión mínima, orientación inválida, archivo vacío/excesivo, checksum y alt text requerido. |
| Adaptadores Meta | Con `httpx.MockTransport`: payloads de post simple y carrusel, respuesta procesando/lista, error de permiso, rate limit, respuesta mal formada, ID/permalink faltante y timeout; asegurar que Instagram jamás use la rama de Reels/video para una imagen. |
| URL pública firmada | HMAC válido/alterado/vencido; archivo fuera de raíz; MIME/allowlist; path traversal/symlink; cache control; descarga con el hostname público configurado y Range solo si se precisa. |
| Scheduler y queue | Cuotas diarias 2+1 por categoría y red, UTC, auto-fill por kind, duplicación de ticks/concurrencia, clave idempotente, edición/cancelación de ocurrencia, restart en `publishing`, fallo transitorio/permanente y reintento tras reconciliar. |
| Copy y verificación | Datos de tema → slides, fuente presente por afirmación, cifra que no coincide con fuentes, límite de caption/hashtags, alt text descriptivo distinto del caption, voz NodeTech/NodeHistory y revisión humana que bloquea publicación hasta aprobar. |
| Canal e insights | Importar/sincronizar foto/carrusel sin duplicar, distinguir `image`, `carousel` y `reel`, guardar permalink/caption, mantener snapshots históricos y tolerar métricas no disponibles. |
| Integración | Flujo completo con renderer falso + DataStore temporal + adapters simulados: generar, revisar, encolar, publicar a Facebook e Instagram, registrar cada entrega y consultar resultados en Canales sin subir nada a una cuenta real. Canary real solo después de confirmar permiso y de forma manual. |

## Referencias operativas revisadas

- El brief restringió este trabajo a solo lectura del código y la escritura de este documento; no hice cambios de código ni commits.
- No leí `.env`, `accounts.json`, archivos de usuarios ni tokens. No inspeccioné ni modifiqué configuración del túnel.
- No reinicié API ni web. No ejecuté pruebas.
