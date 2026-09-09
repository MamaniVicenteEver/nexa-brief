# Estudio Técnico Completo — Sistema Nexa-Brief

> **Fábrica automatizada de videos musicales para YouTube, TikTok y Facebook, impulsada por múltiples modelos de IA especializados.**
>
> Documento generado a partir de una auditoría exhaustiva del código fuente (`src/`), configuración (`niches.json`, `.env.example`, `pyproject.toml`), scripts auxiliares (`scripts/`), skills de IA (`src/skills/`), pruebas (`tests/`) y artefactos reales de ejecución (`output/*/logs/*.json`).
>
> **Última verificación de código:** 2026-07-01 · **Jobs generados en disco:** 28 · **Nichos configurados:** 3 (2 activos)

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Filosofía arquitectónica](#2-filosofía-arquitectónica)
3. [Mapa de componentes del sistema](#3-mapa-de-componentes-del-sistema)
4. [Modelo de dominio: el objeto `Job`](#4-modelo-de-dominio-el-objeto-job)
5. [Máquina de estados del pipeline](#5-máquina-de-estados-del-pipeline)
6. [El pipeline de 9 etapas — flujo completo](#6-el-pipeline-de-9-etapas--flujo-completo)
7. [Secuencia de ejecución de un job](#7-secuencia-de-ejecución-de-un-job)
8. [Modelos de Inteligencia Artificial utilizados](#8-modelos-de-inteligencia-artificial-utilizados)
9. [Puertos y adaptadores (Hexagonal Architecture)](#9-puertos-y-adaptadores-hexagonal-architecture)
10. [Cadenas de fallback de recursos multimedia](#10-cadenas-de-fallback-de-recursos-multimedia)
11. [Grabación y transcodificación de video](#11-grabación-y-transcodificación-de-video)
12. [Sistema de Skills — diseño inyectado como Markdown](#12-sistema-de-skills--diseño-inyectado-como-markdown)
13. [Publicación automática en redes sociales](#13-publicación-automática-en-redes-sociales)
14. [Seguridad y gestión de tokens OAuth](#14-seguridad-y-gestión-de-tokens-oauth)
15. [Configuración del sistema](#15-configuración-del-sistema)
16. [API REST](#16-api-rest)
17. [Herramientas auxiliares de scraping](#17-herramientas-auxiliares-de-scraping)
18. [Cobertura de pruebas](#18-cobertura-de-pruebas)
19. [Stack tecnológico completo](#19-stack-tecnológico-completo)
20. [Despliegue e infraestructura](#20-despliegue-e-infraestructura)
21. [Estado real observado y hallazgos](#21-estado-real-observado-y-hallazgos)
22. [Glosario](#22-glosario)

---

## 1. Resumen ejecutivo

**Nexa-Brief** es un sistema de generación automatizada de video musical de larga duración (60 segundos a varias horas) que combina **cuatro inteligencias artificiales especializadas** en distintas etapas de un pipeline de **9 fases**, orquestado bajo **Arquitectura Hexagonal (Ports & Adapters)** con un **microkernel** que carga reglas de diseño en tiempo de ejecución desde archivos Markdown ("skills").

El sistema toma como entrada una categoría musical (ej. `ambient_music`, `animated_study`), genera automáticamente:

- Un **análisis de intención** (género, mood, contexto).
- Un **diseño visual** (paleta, tipografía, animación) coherente con el género.
- Recursos multimedia (**imagen de fondo** y **pista musical**) obtenidos de APIs gratuitas con validación por visión artificial.
- Una página **HTML autónoma** con visualizador de audio en tiempo real (Web Audio API).
- **Grabación headless** de esa página con Playwright y transcodificación con FFmpeg a múltiples formatos (16:9 para YouTube, 9:16 para TikTok/Reels).
- **Metadatos SEO** (título, descripción, hashtags) optimizados por IA para cada plataforma.
- Opcionalmente, la **publicación automática** en YouTube, TikTok y Facebook mediante adaptadores OAuth2 con cifrado de tokens.

Todo el proceso queda auditado: cada etapa escribe un log JSON estructurado en `output/{job_id}/logs/`, permitiendo trazabilidad completa de qué decidió cada IA y por qué.

### Cifras clave del sistema

| Métrica | Valor |
|---|---|
| Etapas del pipeline | 9 (8 obligatorias + 1 condicional) |
| Modelos de IA integrados | 2 proveedores, usados en 4 roles distintos |
| Adaptadores de imagen (con fallback) | 4 (Unsplash → Pexels → Pixabay → CSS) |
| Adaptadores de música (con fallback) | 5 (Local cache, Pixabay, Jamendo, FMA, yt-dlp) |
| Plataformas de publicación | 3 (YouTube, TikTok, Facebook) |
| Puertos abstractos (Core) | 5 (AI, Image, Music, Recorder, Publisher) |
| Skills de diseño (Markdown) | 9 archivos (5 géneros + 3 HTML + 1 copywriting) |
| Nichos configurados en `niches.json` | 3 (2 activos) |
| Jobs generados en disco (histórico) | 28 |
| Endpoints REST | ~10 (`/videos`, `/publish/*`, `/categories`, `/health`, OAuth) |

---

## 2. Filosofía arquitectónica

El sistema se apoya en dos patrones complementarios:

- **Arquitectura Hexagonal (Ports & Adapters):** el núcleo (`src/core/`) sólo conoce **interfaces abstractas** (puertos). No importa ninguna librería de terceros ni sabe qué proveedor de IA, imagen o música se está usando. Cada integración concreta vive en `src/adapters/` y se inyecta por dependencia.
- **Microkernel de Skills:** las reglas de diseño visual, motion design, reactividad de audio y copywriting **no están en el código**, sino en archivos Markdown bajo `src/skills/`. El motor los lee en tiempo de ejecución y los inyecta como contexto en los prompts de las IAs. Cambiar la estética de un género es editar un `.md`, no tocar Python.

Esto produce tres propiedades deseables:

1. **Extensibilidad:** agregar una cuarta red social o un quinto proveedor de música = un adaptador nuevo, cero cambios en el núcleo.
2. **Resiliencia:** cada recurso externo (imagen, música) tiene una cadena de fallback; el pipeline nunca debería fallar por la caída de un solo proveedor.
3. **Auditabilidad:** el `Job` es un modelo Pydantic **inmutable** — cada etapa retorna una nueva copia (`model_copy`) con el artefacto agregado, nunca muta el estado anterior. Esto permite inspeccionar el estado exacto en cualquier punto del pipeline.

---

## 3. Mapa de componentes del sistema

```mermaid
flowchart TB
    subgraph PRES["Capa de Presentación — FastAPI"]
        API1["POST /api/v1/videos"]
        API2["/api/v1/publish/*"]
        API3["/api/v1/categories"]
        API4["OAuth YouTube · /health"]
        SCHED["APScheduler\nRefresco de tokens cada 15 min"]
    end

    subgraph CORE["Núcleo — src/core (sin dependencias externas)"]
        JOB["Job / JobInput / JobArtifacts\n(Pydantic v2, inmutable)"]
        ORQ["Orchestrator\nasyncio.Semaphore(max_parallel_jobs)"]
        PIPE["Pipeline\n9 etapas secuenciales"]
    end

    subgraph PORTS["Puertos — interfaces abstractas"]
        P1["AIPort"]
        P2["ImagePort"]
        P3["MusicPort"]
        P4["RecorderPort"]
        P5["PublisherPort"]
    end

    subgraph MODULES["Módulos — 9 etapas del pipeline"]
        M1["input_analyzer"]
        M2["visual_designer"]
        M3["resource_fetcher\n+ image_validator"]
        M4["prompt_architect"]
        M5["html_generator"]
        M6["video_recorder"]
        M7["result_summarizer"]
        M8["packager"]
        M9["social_publisher"]
    end

    subgraph ADAPTERS["Adaptadores — implementaciones concretas"]
        AAI["Gemini 3.1 Flash-Lite\nDeepSeek v4-flash"]
        AIMG["Unsplash · Pexels · Pixabay · CSS"]
        AMUS["Pixabay Music · Jamendo · FMA · yt-dlp · Local"]
        AREC["Playwright + FFmpeg"]
        APUB["YouTube · TikTok · Facebook"]
    end

    subgraph SKILLS["Skills — src/skills (Markdown, cargado en runtime)"]
        SK1["genres/*.md\n(jazz, lofi, ambient, study, classical)"]
        SK2["html/*.md\n(html_design, animation_rules, visualizer_rules)"]
        SK3["output/youtube_tiktok_copy.md"]
    end

    subgraph CONFIG["Configuración — src/config"]
        CFGS["settings.py\n(.env → pydantic-settings)"]
        CFGN["niche_config.py\n(niches.json)"]
        CFGE["exceptions.py"]
        CFGL["logging_config.py\n(structlog JSON)"]
    end

    API1 --> ORQ
    API2 --> APUB
    API4 --> APUB
    SCHED --> APUB
    ORQ --> PIPE
    PIPE --> M1 --> M2 --> M3 --> M4 --> M5 --> M6 --> M7 --> M8
    M8 -.->|"si ENABLE_AUTO_PUBLISHING=true"| M9

    M1 & M2 & M3 & M7 -.uses.-> P1
    M3 -.uses.-> P2
    M3 -.uses.-> P3
    M6 -.uses.-> P4
    M9 -.uses.-> P5

    P1 --> AAI
    P2 --> AIMG
    P3 --> AMUS
    P4 --> AREC
    P5 --> APUB

    M2 -.lee.-> SK1
    M4 -.lee.-> SK2
    M7 -.lee.-> SK3

    JOB -.viaja por todas las.-> MODULES
    CONFIG -.inyectado en.-> MODULES

    style CORE fill:#1a1a2e,color:#e0e0e0
    style PORTS fill:#16213e,color:#e0e0e0
    style MODULES fill:#0f3460,color:#e0e0e0
    style ADAPTERS fill:#1a1a2e,color:#e0e0e0
    style SKILLS fill:#16213e,color:#e0e0e0
    style CONFIG fill:#0f3460,color:#e0e0e0
    style PRES fill:#1a1a2e,color:#e0e0e0
```

### Estructura de directorios real

```text
src/
├── core/
│   ├── job.py                 # Job, JobInput, JobArtifacts, JobStage (enum)
│   ├── orchestrator.py        # Orchestrator.run_batch() — concurrencia con Semaphore
│   ├── pipeline.py             # pipeline.run(job) — orquesta las 9 etapas
│   └── ports/
│       ├── ai_port.py          # AIPort: complete_json / complete_text / analyze_image
│       ├── image_port.py       # ImagePort: fetch / fetch_candidates
│       ├── music_port.py       # MusicPort: get
│       ├── recorder_port.py    # RecorderPort: record
│       └── publisher_port.py   # PublisherPort: publish / get_video / update_video / delete_video
├── adapters/
│   ├── ai/
│   │   ├── factory.py
│   │   └── infrastructure/
│   │       ├── gemini_flash_adapter.py
│   │       └── deepseek_adapter.py
│   ├── image/
│   │   ├── factory.py
│   │   ├── css_fallback_adapter.py
│   │   └── infrastructure/{unsplash,pexels,pixabay_image}_adapter.py
│   ├── music/
│   │   ├── factory.py
│   │   └── infrastructure/{pixabay_music,jamendo,fma,ytdlp_fallback,local_cache}_adapter.py
│   ├── recorder/
│   │   ├── factory.py
│   │   └── infrastructure/playwright_ffmpeg_adapter.py
│   └── publishing/
│       ├── factory.py · publisher_facade.py · base_platform.py
│       ├── token_storage.py · token_manager.py · scheduler.py
│       └── youtube_adapter.py · tiktok_adapter.py · facebook_adapter.py
├── modules/
│   ├── input_analyzer.py · visual_designer.py · resource_fetcher.py · image_validator.py
│   ├── prompt_architect.py · html_generator.py · video_recorder.py
│   └── result_summarizer.py · packager.py · social_publisher.py
├── config/
│   ├── settings.py · niche_config.py · exceptions.py · logging_config.py
├── presentation/
│   ├── main.py
│   └── api/{routers/{videos,publisher,categories,youtube_oauth}.py, schemas/*.py}
└── skills/
    ├── genres/{jazz,lofi,ambient,study,classical}.md
    ├── html/{html_design,animation_rules,visualizer_rules}.md
    └── output/youtube_tiktok_copy.md
```

---

## 4. Modelo de dominio: el objeto `Job`

El `Job` es un modelo Pydantic v2 **inmutable** que atraviesa las 9 etapas. Cada módulo recibe un `Job` y retorna una **nueva copia** con su artefacto agregado (`model_copy()`), nunca muta el estado anterior — esto garantiza thread-safety durante la ejecución concurrente de varios jobs y permite auditar el estado exacto en cualquier punto.

```mermaid
classDiagram
    class Job {
        +str job_id
        +JobInput input
        +JobStage stage
        +JobArtifacts artifacts
        +list~str~ errors
        +fail(reason) Job
    }

    class JobInput {
        +str category_name
        +int quantity
        +int duration_seconds
        +str user_context
        +JobPublishingConfig publishing
    }

    class JobPublishingConfig {
        +bool enabled
        +list~str~ accounts
        +PlatformOptions options
    }

    class PlatformOptions {
        +str youtube_playlist_id
        +bool youtube_publish_as_short
        +bool facebook_publish_as_reel
        +str tiktok_privacy
    }

    class JobArtifacts {
        +AnalyzedInput analyzed_input
        +VisualDesign visual_design
        +Path image_path
        +dict image_meta
        +Path music_path
        +dict music_meta
        +str prompt_text
        +Path html_path
        +Path youtube_video_path
        +Path tiktok_video_path
        +Path reels_video_path
        +VideoSummary summary
        +Path output_dir
        +dict recording_stats
        +PublishResult publish_result
        +dict~str,PublishResult~ publish_results
    }

    class AnalyzedInput {
        +str genre
        +list~str~ mood_tags
        +str image_query
        +str description
        +int duration_seconds
        +str category_name
    }

    class VisualDesign {
        +str genre
        +str style
        +list~str~ colors
        +list~str~ fonts
        +str animation
        +str background_style
    }

    class VideoSummary {
        +str youtube_title
        +str youtube_description
        +list~str~ youtube_tags
        +str tiktok_caption
        +list~str~ tiktok_hashtags
    }

    Job --> JobInput
    Job --> JobArtifacts
    JobInput --> JobPublishingConfig
    JobPublishingConfig --> PlatformOptions
    JobArtifacts --> AnalyzedInput
    JobArtifacts --> VisualDesign
    JobArtifacts --> VideoSummary
```

---

## 5. Máquina de estados del pipeline

El enum `JobStage` (`src/core/job.py`) define el ciclo de vida completo. La etapa `PUBLISHING → PUBLISHED` sólo se alcanza si la publicación automática está habilitada.

```mermaid
stateDiagram-v2
    [*] --> PENDING
    PENDING --> INPUT_ANALYZED : input_analyzer (Gemini)
    INPUT_ANALYZED --> DESIGN_COMPLETE : visual_designer (Gemini + skill de género)
    DESIGN_COMPLETE --> RESOURCES_FETCHED : resource_fetcher (imagen + música)
    RESOURCES_FETCHED --> PROMPT_BUILT : prompt_architect
    PROMPT_BUILT --> HTML_GENERATED : html_generator (DeepSeek)
    HTML_GENERATED --> VIDEO_RECORDED : video_recorder (Playwright + FFmpeg)
    VIDEO_RECORDED --> SUMMARY_GENERATED : result_summarizer (Gemini)
    SUMMARY_GENERATED --> PACKAGED : packager
    PACKAGED --> PUBLISHING : social_publisher [si ENABLE_AUTO_PUBLISHING]
    PUBLISHING --> PUBLISHED : todas las plataformas OK
    PACKAGED --> [*] : fin normal sin publicación
    PUBLISHED --> [*]

    INPUT_ANALYZED --> FAILED
    DESIGN_COMPLETE --> FAILED
    RESOURCES_FETCHED --> FAILED
    PROMPT_BUILT --> FAILED
    HTML_GENERATED --> FAILED
    VIDEO_RECORDED --> FAILED
    SUMMARY_GENERATED --> FAILED
    PACKAGED --> FAILED
    PUBLISHING --> FAILED
    FAILED --> [*]

    note right of DESIGN_COMPLETE
        Si niche_cfg.skip_visual_design = true,
        esta etapa se omite y se inyecta
        un VisualDesign estático (ej. ambient_music)
    end note
```

---

## 6. El pipeline de 9 etapas — flujo completo

Este es el diagrama central del sistema. Actualiza y expande el diagrama original del README (7 etapas) incorporando lo que existe realmente en el código: **validación de imágenes por visión artificial**, el formato adicional **Reels (9:16 completo)**, y la **etapa 9 de publicación condicional**.

```mermaid
flowchart TD
    START(["Usuario: category_name, quantity, duration_seconds, user_context"]) --> ORQ

    subgraph ORQ_G["Orchestrator — src/core/orchestrator.py"]
        ORQ["run_batch()\nasyncio.Semaphore(max_parallel_jobs=2)"]
        ORQ --> LOOP["Por cada video del lote\n(en paralelo controlado)"]
    end

    LOOP --> NICHE["get_niche_config(category_name)\nlee niches.json"]

    subgraph E1["Etapa 1 · input_analyzer"]
        NICHE --> S1["Gemini 3.1 Flash-Lite\nJSON mode"]
        S1 --> S1L[("01_input_completado.json")]
        S1L --> S1O["AnalyzedInput:\ngenre, mood_tags, image_query, description"]
    end

    subgraph E2["Etapa 2 · visual_designer"]
        S1O --> SKIP{"niche_cfg.skip_visual_design?"}
        SKIP -- "sí" --> S2X["Inyecta VisualDesign estático\n(sin llamada a IA)"]
        SKIP -- "no" --> S2G["Carga skill\nsrc/skills/genres/{genre}.md"]
        S2G --> S2["Gemini 3.1 Flash-Lite\nDiseñador visual"]
        S2 --> S2L[("02_diseno_visual.json")]
        S2L --> S2O["VisualDesign:\ncolors (≤4), fonts, animation, background_style"]
        S2X --> S2O
    end

    subgraph E3["Etapa 3 · resource_fetcher + image_validator"]
        S2O --> IMGQ["Construye query de imagen\n(fija / generada por Gemini / analyzed_input)"]
        IMGQ --> IMGF["fetch_image_candidates()\nUnsplash → Pexels → Pixabay → CSS"]
        IMGF --> IMGV{"¿validación de imagen\nhabilitada en el nicho?"}
        IMGV -- "sí" --> IMGAI["Gemini Vision\nanalyze_image() contra criterios"]
        IMGAI --> IMGL[("05b_validacion_imagenes.json")]
        IMGL --> IMGBEST["pick_best_candidate()\nmejor score ≥ min_score"]
        IMGV -- "no" --> IMGBEST
        IMGBEST --> BG[("bg.jpg")]
        S2O --> MUSQ["Construye queries de música\n(Gemini genera variantes)"]
        MUSQ --> MUSF["Pixabay Music → Jamendo → FMA → yt-dlp → Local\n(+ fallback de género si todo falla)"]
        MUSF --> SONG[("song.mp3")]
        BG --> RESL[("05_imagen_seleccionada.json\n06_musica_seleccionada.json")]
        SONG --> RESL
    end

    subgraph E4["Etapa 4 · prompt_architect"]
        RESL --> TPL{"template = image_only?"}
        TPL -- "sí" --> P4A["Prompt minimalista\nsolo imagen + audio, sin visualizador"]
        TPL -- "no" --> P4B["Carga skill html_design.md\n+ safe-zone 9:16 si aplica\n+ filtros CSS del nicho"]
        P4A --> P4L[("03_prompt_generacion.txt")]
        P4B --> P4L
    end

    subgraph E5["Etapa 5 · html_generator"]
        P4L --> S5["DeepSeek v4-flash\nGenerador de código (temperature 0.7)"]
        S5 --> S5V{"¿contiene\n&lt;!DOCTYPE&gt; / &lt;html&gt;?"}
        S5V -- "no" --> S5ERR["AIGenerationError"]
        S5V -- "sí" --> HTML[("index.html")]
        HTML --> S5L[("04_html_generado.html\n04_html_log.json")]
    end

    subgraph E6["Etapa 6 · video_recorder"]
        S5L --> REC1["Playwright Chromium headless\nautoplay-policy=no-user-gesture-required"]
        SONG -.-> REC1
        REC1 --> RAW[("_raw.webm mudo")]
        RAW --> REC2["FFmpeg: mezcla video + audio\nlibx264 · crf 18 · aac 192k"]
        REC2 --> YTV[("youtube_video.mp4\n16:9, duración completa")]
        YTV --> REC3{"¿nicho define\nformato 9:16?"}
        REC3 -- "sí" --> REELS["FFmpeg crop centrado\ncrop=ih*9/16:ih → scale 1080x1920"]
        REELS --> REELV[("reels_video.mp4\n9:16, duración completa")]
        REELV --> REC4["FFmpeg recorte 61s\nafade in 1s + afade out 2s"]
        REC4 --> TKV[("tiktok_video.mp4\n9:16, 61s")]
        REC3 -- "no" --> DONE6["Sin formato vertical"]
        TKV --> S6L[("07_grabacion_stats.json")]
        DONE6 --> S6L
    end

    subgraph E7["Etapa 7a · result_summarizer"]
        S6L --> S7G["Carga skill\noutput/youtube_tiktok_copy.md"]
        S7G --> S7["Gemini 3.1 Flash-Lite\nCopywriter SEO"]
        S7 --> S7O["VideoSummary:\ntítulo, descripción, tags YT · caption, hashtags TikTok"]
    end

    subgraph E8["Etapa 7b · packager"]
        S7O --> PKG["Verifica existencia de todos los\narchivos requeridos por el nicho"]
        PKG --> MANI[("manifest.json")]
        MANI --> S8L[("08_resumen_final.json")]
    end

    S8L --> PUBCHK{"ENABLE_AUTO_PUBLISHING\n= true?"}

    subgraph E9["Etapa 9 · social_publisher (condicional)"]
        PUBCHK -- "sí" --> ACC["Resuelve cuentas:\njob.input.publishing.accounts\no settings.active_account"]
        ACC --> SEL["Selecciona video por plataforma:\nTikTok → tiktok_video · YouTube/FB → youtube_video"]
        SEL --> PUB["PublisherFacade.publish_video()\npor cada cuenta configurada"]
        PUB --> PL{"YouTube con\nplaylist_id?"}
        PL -- "sí" --> PLA["add_video_to_playlist()"]
        PL -- "no" --> PUBOK
        PLA --> PUBOK
        PUBOK["PublishResult por cuenta"] --> S9L[("09_publicacion_resultado.json")]
    end

    PUBCHK -- "no" --> ENDOK(["Job = PACKAGED\ncarpeta lista para publicación manual"])
    S9L --> ENDPUB(["Job = PUBLISHED (o FAILED si alguna plataforma falla)"])

    ENDOK --> MORE{"¿Más videos\nen el lote?"}
    ENDPUB --> MORE
    MORE -- "sí" --> LOOP
    MORE -- "no" --> FIN(["BatchResult: succeeded, failed, elapsed_seconds"])

    style ORQ_G fill:#1a1a2e,color:#e0e0e0
    style E1 fill:#16213e,color:#e0e0e0
    style E2 fill:#0f3460,color:#e0e0e0
    style E3 fill:#1a1a2e,color:#e0e0e0
    style E4 fill:#16213e,color:#e0e0e0
    style E5 fill:#0f3460,color:#e0e0e0
    style E6 fill:#1a1a2e,color:#e0e0e0
    style E7 fill:#16213e,color:#e0e0e0
    style E8 fill:#0f3460,color:#e0e0e0
    style E9 fill:#3a1a1a,color:#e0e0e0
```

---

## 7. Secuencia de ejecución de un job

Vista temporal de las llamadas entre componentes para **un solo job**, desde la petición HTTP hasta el paquete final.

```mermaid
sequenceDiagram
    autonumber
    actor U as Cliente HTTP
    participant API as FastAPI /api/v1/videos
    participant ORQ as Orchestrator
    participant PIPE as Pipeline
    participant GEM as Gemini 3.1 Flash-Lite
    participant IMG as Adaptadores de Imagen
    participant MUS as Adaptadores de Música
    participant DS as DeepSeek v4-flash
    participant PW as Playwright + FFmpeg
    participant FS as Filesystem (output/{job_id})

    U->>API: POST /videos {category_name, quantity, duration_seconds}
    API->>ORQ: run_batch(...)
    ORQ->>ORQ: adquiere Semaphore(max_parallel_jobs)
    ORQ->>PIPE: run(job) [por cada video]

    PIPE->>GEM: input_analyzer — analizar categoría + contexto
    GEM-->>PIPE: AnalyzedInput (JSON)
    PIPE->>FS: log 01_input_completado.json

    PIPE->>GEM: visual_designer — diseño visual + skill de género
    GEM-->>PIPE: VisualDesign (JSON)
    PIPE->>FS: log 02_diseno_visual.json

    PIPE->>IMG: fetch_image_candidates(query)
    IMG-->>PIPE: candidatos de imagen
    opt validación habilitada
        PIPE->>GEM: analyze_image(candidato, criterios)
        GEM-->>PIPE: {passes, score, reason}
    end
    PIPE->>FS: bg.jpg + logs 05/05b

    PIPE->>MUS: fetch_music(genre) [Pixabay → Jamendo → FMA → yt-dlp]
    MUS-->>PIPE: song.mp3 + metadata
    PIPE->>FS: log 06_musica_seleccionada.json

    PIPE->>PIPE: prompt_architect — ensambla prompt (skill html_design.md)
    PIPE->>FS: log 03_prompt_generacion.txt

    PIPE->>DS: complete_text(system, prompt) — generar HTML
    DS-->>PIPE: index.html (autónomo, con visualizador)
    PIPE->>FS: index.html + log 04_html_log.json

    PIPE->>PW: record(html_path, audio_path, duration)
    PW->>PW: Chromium headless grabación muda → _raw.webm
    PW->>PW: FFmpeg mezcla video+audio → youtube_video.mp4
    opt nicho define formato 9:16
        PW->>PW: FFmpeg crop centrado → reels_video.mp4
        PW->>PW: FFmpeg recorte 61s + fades → tiktok_video.mp4
    end
    PW-->>PIPE: RecordingResult (paths + stats)
    PIPE->>FS: log 07_grabacion_stats.json

    PIPE->>GEM: result_summarizer — SEO (skill youtube_tiktok_copy.md)
    GEM-->>PIPE: VideoSummary (títulos, tags, hashtags)

    PIPE->>FS: packager — valida archivos → manifest.json
    PIPE->>FS: log 08_resumen_final.json

    alt ENABLE_AUTO_PUBLISHING = true
        PIPE->>PIPE: social_publisher.run(job, facade)
        Note over PIPE: ver diagrama de publicación (sección 13)
    end

    PIPE-->>ORQ: Job final (stage=PACKAGED|PUBLISHED|FAILED)
    ORQ->>ORQ: libera Semaphore
    ORQ-->>API: BatchResult
    API-->>U: 202 Accepted — BatchResponse{jobs[]}
```

---

## 8. Modelos de Inteligencia Artificial utilizados

El sistema integra **dos proveedores de IA** cubriendo **cuatro roles funcionales** distintos. Los identificadores exactos están definidos en `src/config/settings.py:27-29`.

```mermaid
flowchart LR
    subgraph GEMINI["Google AI Studio"]
        G["gemini-3.1-flash-lite-preview"]
    end
    subgraph DEEPSEEK["DeepSeek (endpoint api.deepseek.com)"]
        D["deepseek-v4-flash\n(alternativa: deepseek-v4-pro)"]
    end

    G -->|"complete_json()"| R1["Etapa 1 — Análisis de intención\n(input_analyzer)"]
    G -->|"complete_json() + skill de género"| R2["Etapa 2 — Diseño visual\n(visual_designer)"]
    G -->|"analyze_image() — multimodal"| R3["Etapa 3 — Validación de imágenes\n(image_validator)"]
    G -->|"complete_json() + skill de copywriting"| R4["Etapa 7a — Metadatos SEO\n(result_summarizer)"]
    D -->|"complete_text() — temperature 0.7"| R5["Etapa 5 — Generación de HTML\n(html_generator)"]
```

### Tabla comparativa de roles

| # | Rol funcional | Proveedor · Modelo | Método del `AIPort` | Módulo | Entrada clave | Salida |
|---|---|---|---|---|---|---|
| 1 | Análisis de intención | Gemini `gemini-3.1-flash-lite-preview` | `complete_json()` | `input_analyzer.py` | categoría, contexto de usuario, duración | `AnalyzedInput` (género, mood_tags, image_query, descripción) |
| 2 | Diseño visual | Gemini `gemini-3.1-flash-lite-preview` | `complete_json()` | `visual_designer.py` | `AnalyzedInput` + skill `genres/{genre}.md` | `VisualDesign` (≤4 colores, tipografías, animación, estilo de fondo) |
| 3 | Validación de imágenes (multimodal) | Gemini `gemini-3.1-flash-lite-preview` | `analyze_image()` | `image_validator.py` | imagen candidata + criterios del nicho | `{passes, score, reason, criteria_met, criteria_failed}` |
| 4 | Generación de queries variadas | Gemini `gemini-3.1-flash-lite-preview` | `complete_json()` | `resource_fetcher.py` | `query_theme` del nicho | queries de búsqueda de imagen/música variadas |
| 5 | Generación de código HTML | DeepSeek `deepseek-v4-flash` (vía `api.deepseek.com`, cliente `AsyncOpenAI` compatible) | `complete_text()` | `html_generator.py` | prompt ensamblado (diseño + skills HTML) | `index.html` autónomo con Web Audio API |
| 6 | Metadatos SEO | Gemini `gemini-3.1-flash-lite-preview` | `complete_json()` | `result_summarizer.py` | diseño + análisis + skill `youtube_tiktok_copy.md` | título/descr./tags YouTube, caption/hashtags TikTok |

**Justificación de la elección técnica:**

- **Gemini Flash-Lite** se usa para todas las tareas estructuradas (JSON) y para la **única tarea multimodal** del sistema (validar imágenes por visión), por ser el modelo más económico de la familia Gemini con capacidad de visión.
- **DeepSeek v4-flash** se reserva exclusivamente para la generación de código HTML/CSS/JS, tarea donde modelos especializados en código superan a modelos generalistas en coherencia de sintaxis y en seguir restricciones de diseño extensas (las skills de `src/skills/html/` superan las 250 líneas combinadas de reglas).
- Ambos adaptadores implementan **reintentos con backoff exponencial** (`ai_max_retries=3`, `ai_retry_delay_seconds=2.0`, `ai_max_output_tokens=8192`), configurables vía `.env`.

---

## 9. Puertos y adaptadores (Hexagonal Architecture)

```mermaid
classDiagram
    class AIPort {
        <<interface>>
        +complete_json(system, user) dict
        +complete_text(system, user) str
        +analyze_image(image_path, criteria) dict
    }
    class ImagePort {
        <<interface>>
        +fetch(query, dest_path, min_w, min_h) ImageFetchResult
        +fetch_candidates(query, dest_dir, count, color_filter, orientation) list
    }
    class MusicPort {
        <<interface>>
        +get(genre, dest_path) MusicFetchResult
    }
    class RecorderPort {
        <<interface>>
        +record(html_path, audio_path, output_dir, duration, niche_cfg) RecordingResult
    }
    class PublisherPort {
        <<interface>>
        +publish(video_path, title, description, tags, account_alias, privacy) PublishVideoResult
        +get_video(video_id, account_alias) VideoMetadata
        +update_video(video_id, account_alias, ...) VideoMetadata
        +delete_video(video_id, account_alias) bool
    }

    AIPort <|.. GeminiFlashAdapter
    AIPort <|.. DeepSeekAdapter
    ImagePort <|.. UnsplashAdapter
    ImagePort <|.. PexelsAdapter
    ImagePort <|.. PixabayImageAdapter
    ImagePort <|.. CSSFallbackAdapter
    MusicPort <|.. PixabayMusicAdapter
    MusicPort <|.. JamendoAdapter
    MusicPort <|.. FMAAdapter
    MusicPort <|.. YtDlpFallbackAdapter
    MusicPort <|.. LocalCacheAdapter
    RecorderPort <|.. PlaywrightFFmpegAdapter
    PublisherPort <|.. YouTubeAdapter
    PublisherPort <|.. TikTokAdapter
    PublisherPort <|.. FacebookAdapter
```

| Puerto | Archivo | Adaptadores concretos | Selección |
|---|---|---|---|
| `AIPort` | `src/core/ports/ai_port.py` | `GeminiFlashAdapter`, `DeepSeekAdapter` | Fija por rol (análisis/diseño/resumen → Gemini; codegen → DeepSeek) |
| `ImagePort` | `src/core/ports/image_port.py` | `UnsplashAdapter` → `PexelsAdapter` → `PixabayImageAdapter` → `CSSFallbackAdapter` | Cadena secuencial hasta el primer éxito |
| `MusicPort` | `src/core/ports/music_port.py` | `LocalCacheAdapter`, `PixabayMusicAdapter`, `JamendoAdapter`, `FMAAdapter`, `YtDlpFallbackAdapter` | `settings.music_adapter_order` (default: `pixabay, jamendo, ytdlp`) + fallback de género |
| `RecorderPort` | `src/core/ports/recorder_port.py` | `PlaywrightFFmpegAdapter` | Único |
| `PublisherPort` | `src/core/ports/publisher_port.py` | `YouTubeAdapter`, `TikTokAdapter`, `FacebookAdapter` | Por `account_selector` ("platform:alias") |

---

## 10. Cadenas de fallback de recursos multimedia

### Imagen

```mermaid
flowchart TD
    Q["Query de imagen\n(fija, generada por Gemini o del AnalyzedInput)"] --> U["Unsplash API\n/search/photos — Client-ID auth"]
    U -- "éxito" --> OK1(["Candidatos descargados"])
    U -- "falla / sin resultados" --> P["Pexels API\n/v1/search — Bearer auth"]
    P -- "éxito" --> OK1
    P -- "falla" --> PX["Pixabay API\n/api/ — key param"]
    PX -- "éxito" --> OK1
    PX -- "falla" --> CSS["CSSFallbackAdapter\nPNG sólido 1x1 (#1a1a2e)"]
    CSS --> OK1
    OK1 --> VAL{"¿validación con\nGemini Vision habilitada?"}
    VAL -- "sí" --> BEST["pick_best_candidate()\nscore ≥ min_score (default 0.70)"]
    VAL -- "no" --> FIRST["Usa el primer candidato"]
    BEST -- "ningún candidato pasa" --> FALLBACKQ["Reintenta con fallback_query\ndel nicho (hasta max_retries)"]
    FALLBACKQ --> BEST
    BEST --> BG[("bg.jpg")]
    FIRST --> BG
```

### Música

```mermaid
flowchart TD
    G["Género solicitado\n(ej. lofi, jazz, ambient, study, classical)"] --> LC["LocalCacheAdapter\ndata/music_library/{genre}/"]
    LC -- "encontrado" --> OK(["song.mp3"])
    LC -- "vacío" --> ADAPT["Orden configurado:\nmusic_adapter_order"]
    ADAPT --> PB["Pixabay Music\n/api/music/"]
    PB -- "éxito" --> OK
    PB -- "falla" --> JAM["Jamendo API v3.0\n/tracks/ — client_id"]
    JAM -- "éxito" --> OK
    JAM -- "falla" --> FMA["Free Music Archive\n/api/get/tracks.json"]
    FMA -- "éxito" --> OK
    FMA -- "falla" --> YTDLP["yt-dlp\nytsearch3:{query} → mp3"]
    YTDLP -- "éxito" --> OK
    YTDLP -- "falla" --> GFB{"¿género tiene\nfallback definido?"}
    GFB -- "sí" --> G2["Género alternativo\n(ej. lofi→jazz→chillout→ambient)"]
    G2 --> ADAPT
    GFB -- "no" --> ERR(["MusicFetchError"])
```

**Mapa de fallback de género** (`src/adapters/music/factory.py`):

| Género solicitado | Cadena de fallback |
|---|---|
| `lofi` | `jazz` → `chillout` → `ambient` |
| `study` | `ambient` → `chillout` → `instrumental` |
| `ambient` | `chillout` → `instrumental` → `jazz` |
| `classical` | `instrumental` → `ambient` |
| `jazz` | `blues` → `instrumental` |

---

## 11. Grabación y transcodificación de video

```mermaid
sequenceDiagram
    autonumber
    participant M as video_recorder.py
    participant PW as Playwright (Chromium headless)
    participant FF as FFmpeg
    participant FS as output/{job_id}/

    M->>PW: launch(--autoplay-policy=no-user-gesture-required, --no-sandbox)
    PW->>PW: goto(index.html) — domcontentloaded + warmup 3s
    PW->>PW: grabar video muda durante duration_seconds
    PW-->>FS: _raw.webm

    M->>FF: mezclar _raw.webm + song.mp3
    Note over FF: libx264 · crf 18 (configurable/nicho) · preset fast · aac 192k · modo shortest
    FF-->>FS: youtube_video.mp4 (16:9, 1920x1080, duración completa)

    alt nicho define formato 9:16 (Reels)
        M->>FF: crop=ih*9/16:ih:(iw-ih*9/16)/2:0, scale=1080:1920
        FF-->>FS: reels_video.mp4 (9:16, duración completa)
        M->>FF: recorte a tiktok_clip_duration_seconds=61s\n+ afade in=1.0s + afade out=2.0s
        FF-->>FS: tiktok_video.mp4 (9:16, 61s)
    end

    M->>FS: log 07_grabacion_stats.json (tiempos, tamaños de archivo)
```

Parámetros relevantes (`settings.py` / `niches.json` por formato):

| Parámetro | Default | Configurable por |
|---|---|---|
| Resolución de grabación | 1920×1080 | `settings.video_width/height` |
| CRF (calidad) | 18 (YouTube) / 20 (Reels/TikTok) | `niches.json → video.formats[].crf` |
| Preset de codificación | `fast` | `niches.json → video.formats[].preset` |
| Duración clip TikTok | 61 s | `settings.tiktok_clip_duration_seconds` |
| Fade in / fade out TikTok | 1.0 s / 2.0 s | `settings.tiktok_fade_in/out_seconds` |
| Método de generación 9:16 | `crop_safe_zone` | `niches.json → video.formats[].generation_method` |

---

## 12. Sistema de Skills — diseño inyectado como Markdown

Las "skills" son la pieza más distintiva del microkernel: **no son plantillas de código**, son documentos de dirección creativa en lenguaje natural que se leen del disco en tiempo de ejecución y se concatenan al prompt de la IA correspondiente.

```mermaid
flowchart LR
    subgraph FILES["src/skills/ (Markdown versionado en Git)"]
        G1["genres/jazz.md\nsofisticación nocturna, dorado sobre negro"]
        G2["genres/lofi.md\nminimalismo expresivo, grano analógico"]
        G3["genres/ambient.md\ninmersión meditativa, formas orgánicas"]
        G4["genres/study.md\nclaridad mental, movimiento casi nulo"]
        G5["genres/classical.md\nsala de conciertos, simetría, serifa elegante"]
        H1["html/html_design.md\ncontrato técnico: autoplay, ≤4 colores, sin UI"]
        H2["html/animation_rules.md\ndisciplina de motion: respiración, deriva, partículas"]
        H3["html/visualizer_rules.md\nreactividad de audio por AnalyserNode"]
        O1["output/youtube_tiktok_copy.md\ntono de copywriting por plataforma"]
    end

    G1 & G2 & G3 & G4 & G5 -->|"leído por"| VD["visual_designer.py\n(Etapa 2)"]
    H1 & H2 & H3 -->|"leído por"| PA["prompt_architect.py\n(Etapa 4)"]
    O1 -->|"leído por"| RS["result_summarizer.py\n(Etapa 7a)"]

    VD -->|"contexto inyectado"| PGEM["Prompt → Gemini"]
    PA -->|"contexto inyectado"| PDS["Prompt → DeepSeek"]
    RS -->|"contexto inyectado"| PGEM2["Prompt → Gemini"]
```

### Resumen de las skills de género

| Skill | Paleta / lenguaje visual | Movimiento |
|---|---|---|
| `jazz.md` | Dorado sobre negro casi puro, máx. 4 colores | "Swing" — timing irregular que imita fraseo musical |
| `lofi.md` | Oscuro con contraste orgánico, grano, viñeta | Pulsos lentos e imperceptibles, derivas graduales |
| `ambient.md` | Azul profundo, violeta oscuro, negro espacial | Gradientes que "respiran", formas orgánicas nunca geométricas |
| `study.md` | Grises fríos, blancos rotos, sin ornamento | Movimiento mínimo — cursor, halo casi imperceptible |
| `classical.md` | Tonos tierra y marfil, tipografía serifa | Animaciones simétricas y arquitectónicas, ondas discretas |

### Reglas técnicas de `html/html_design.md` (contrato no negociable para la IA generadora)

- El HTML corre en **Chromium headless sin interacción humana** — todo debe iniciar en `DOMContentLoaded`, nunca esperar un clic.
- **Máximo 4 colores** en toda la pieza (primario, secundario, acento, neutro).
- **Prohibido:** botones, controles, texto adicional al título, logos, watermarks, spinners, emojis.
- Debe correr **2+ horas sin fugas de memoria** (uso de `requestAnimationFrame`, cancelación en `beforeunload`).
- El visualizador debe reaccionar a **datos reales de frecuencia de audio** (Web Audio API `AnalyserNode`), nunca animación temporizada falsa.

---

## 13. Publicación automática en redes sociales

Etapa 9, condicional a `ENABLE_AUTO_PUBLISHING=true`. Arquitectura centrada en un **Facade** que resuelve credenciales por `"plataforma:alias"` y delega en el adaptador correspondiente.

```mermaid
flowchart TB
    subgraph STAGE9["social_publisher.py — Etapa 9"]
        S9["Resuelve cuentas destino\n(job.input.publishing.accounts o settings.active_account)"]
    end

    S9 --> FACADE["PublisherFacade\n(singleton por proceso)"]

    FACADE --> TM["TokenManager\nlock por (platform, alias) · refresco proactivo"]
    TM --> TS["TokenStorage\nFernet AES + escritura atómica"]
    TS --> ACCJSON[("accounts.json\ntokens cifrados")]

    FACADE --> YTA["YouTubeAdapter\nYouTube Data API v3"]
    FACADE --> TKA["TikTokAdapter\nContent Posting API v2"]
    FACADE --> FBA["FacebookAdapter\nGraph API v21.0"]

    YTA -->|"resumable upload\n3 fases · chunks 8MB"| YT[("YouTube")]
    TKA -->|"init → PUT chunk → poll\nchunks ~8MB"| TK[("TikTok")]
    FBA -->|"start → transfer → finish\nchunks 4MB"| FB[("Facebook Pages")]

    YTA -.opcional.-> PL["add_video_to_playlist()"]

    style STAGE9 fill:#3a1a1a,color:#e0e0e0
```

### Protocolo de subida por plataforma

| Plataforma | Protocolo | Resumible | Tamaño de chunk | Límite de privacidad / cuota |
|---|---|---|---|---|
| **YouTube** | Resumable Upload (HTTP 308) — init → PUT chunks → poll `uploadStatus` | Sí | ~8 MB | Cuota diaria 10 000 unidades · 1 600 por subida → máx. ~6 videos/día |
| **TikTok** | Content Posting API v2 — `init` → `PUT` a `upload_url` → `poll status/fetch` | No (atómico) | ~8 MB | Máx. ~20 publicaciones/usuario/día · privacidad `SELF_ONLY` mientras la app esté en modo desarrollo |
| **Facebook** | Graph API v21.0 — `start` → `transfer` (multiparte) → `finish` | Sí | 4 MB | Rutas separadas para Reels (`/video_reels`, 9:16) y feed estándar (`/videos`) |

### Secuencia de publicación (con gestión de tokens)

```mermaid
sequenceDiagram
    autonumber
    participant SP as social_publisher.py
    participant PF as PublisherFacade
    participant TM as TokenManager
    participant TS as TokenStorage
    participant AD as Adaptador de plataforma
    participant EXT as API externa (YouTube/TikTok/Facebook)

    SP->>PF: publish_video(video_path, title, tags, "youtube:canal_1")
    PF->>TM: get_valid_token("youtube", "canal_1")
    TM->>TS: load_token() — descifra con Fernet
    TS-->>TM: TokenState(access_token, expires_at)
    alt token expira en menos de 30 min (margen configurable)
        TM->>EXT: POST /token (refresh_token grant)
        EXT-->>TM: nuevo access_token
        TM->>TS: save_token() — cifra y escribe atómicamente
    end
    TM-->>PF: access_token válido
    PF->>AD: publish(video_path, title, description, tags, privacy)
    AD->>EXT: fase 1 — iniciar sesión de subida
    EXT-->>AD: session_uri / upload_url / upload_session_id
    loop por cada chunk del archivo de video
        AD->>EXT: subir chunk
    end
    AD->>EXT: fase final — confirmar / poll de estado
    EXT-->>AD: video_id / post_id
    AD-->>PF: PublishVideoResult
    PF-->>SP: PublishResult(platform, account_alias, post_id, url)
    SP->>SP: log 09_publicacion_resultado.json
```

### Detalle por adaptador

- **`YouTubeAdapter`** (`src/adapters/publishing/youtube_adapter.py`): además del CRUD estándar, expone `list_playlists()`, `create_playlist()` y `add_video_to_playlist()`. Incluye guarda de cuota (`check_quota_before_upload`) que lanza `QuotaExceededError` antes de intentar una subida que excedería el límite diario.
- **`TikTokAdapter`** (`tiktok_adapter.py`): la operación `update_video()` **no está soportada** por la API de TikTok y lanza `UnsupportedOperationError` con log de auditoría explícito, en vez de fallar silenciosamente.
- **`FacebookAdapter`** (`facebook_adapter.py`): decide entre publicar como **Reel** (`facebook_publish_as_reel`, activado por defecto según `PlatformOptions`) o como video estándar de página.
- **`base_platform.py`**: infraestructura común — cliente `httpx.AsyncClient`, decorador `with_retry(max_retries=3, backoff_base=2.0)` que reintenta en errores de red y HTTP 429/500/502/503/504, pero **no** en 400/401/403/404/409.

---

## 14. Seguridad y gestión de tokens OAuth

```mermaid
flowchart LR
    ENV[".env\nPUBLISHER_ENCRYPTION_KEY (clave Fernet)"] --> FERNET["cryptography.fernet.Fernet"]
    FERNET --> ENC["encrypt(access_token)\nencrypt(refresh_token)"]
    ENC --> WRITE["Escritura atómica:\nescribir en .tmp → rename"]
    WRITE --> FILE[("accounts.json")]
    FILE --> READ["load_token()"]
    READ --> DEC["decrypt() → TokenState"]
    DEC --> USE["Usado sólo en memoria\ndurante la llamada a la API"]

    style ENV fill:#0f3460,color:#e0e0e0
    style FILE fill:#3a1a1a,color:#e0e0e0
```

**Ciclo de vida por plataforma** (verificado contra `accounts.json` real del sistema, sin exponer valores cifrados ni credenciales):

| Plataforma | Vigencia del `access_token` | Vigencia del `refresh_token` | Estrategia de refresco |
|---|---|---|---|
| YouTube | ~1 hora | No expira (salvo revocación manual) | `TokenManager._refresh_youtube()` → `POST https://oauth2.googleapis.com/token` |
| TikTok | 24 horas | 365 días (puede rotar en cada refresh) | `TokenManager._refresh_tiktok()` → `POST https://open.tiktokapis.com/v2/oauth/token/` |
| Facebook | No expira (Page Access Token derivado de Long-Lived User Token) | N/A | No-op — `_refresh_facebook()` es intencionalmente vacío |

**Propiedades de diseño:**

- Un **`asyncio.Lock` por cada par `(plataforma, alias)`** evita que múltiples jobs concurrentes disparen refrescos duplicados sobre la misma cuenta.
- El margen de refresco proactivo es de **30 minutos** (`PUBLISHER_TOKEN_REFRESH_MARGIN_SECONDS=1800`), y un `APScheduler` ejecuta `refresh_all_tokens()` cada 15 minutos en segundo plano.
- Ante fallo persistente de refresco (3 reintentos con backoff 2s → 4s → 8s), la cuenta se marca `status="requires_reauth"` y se lanza `TokenExpiredError` — el job de publicación falla de forma explícita en vez de intentar publicar con un token inválido.
- `accounts.json` está declarado en `.gitignore` y nunca debe versionarse; el archivo `.env.example` documenta cómo generar una clave Fernet nueva (`Fernet.generate_key()`).

---

## 15. Configuración del sistema

### Jerarquía de configuración por nicho (`niches.json` → `NicheConfig`)

```mermaid
flowchart TD
    NJ[("niches.json")] --> NC["NicheConfig"]
    NC --> ID["id, display_name, active, description"]
    NC --> IMG["ImageConfig\nquery_template | query_theme, color_filter,\norientation, results_count"]
    IMG --> IVC["ImageValidationConfig\nenabled, min_score, max_retries,\ncriteria[], fallback_query"]
    NC --> AUD["AudioConfig\nmode, genre, query_theme, adapter_order"]
    NC --> VID["VideoConfig\nduration_seconds, formats[]"]
    VID --> VF["VideoFormat\nid, aspect_ratio, width, height,\noutput_filename, crf, preset, generation_method"]
    NC --> HTV["HtmlVisualizerConfig\ntemplate, animation_level, filters[]"]
    NC --> AIC["AiConfig\nanalysis_model=gemini, codegen_model=deepseek"]
    NC --> PUB["NichePublishingConfig\naccounts[], youtube_playlist_id, youtube_as_short"]
```

**Nichos activos verificados en el repositorio:**

| ID | Nombre visible | Activo | `skip_visual_design` | Formatos de video | Validación de imagen |
|---|---|---|---|---|---|
| `ambient_music` | Ambient Music B&W — @DrovaSoft | ✅ | ✅ (estilo fijo B&N) | YouTube 16:9 + Reels 9:16 | min_score 0.70, 2 reintentos, filtro B&N |
| `animated_study` | Lofi Study Beats — Cozy Animation | ✅ | ❌ | YouTube 16:9 + Reels 9:16 | min_score 0.75, 2 reintentos |
| `economy_finance` | Economy Chronicles (Futuro) | ❌ (inactivo) | ❌ | Sólo YouTube 16:9 | min_score 0.65 |

### Variables de entorno principales (`.env` / `.env.example`)

| Categoría | Variable | Default | Propósito |
|---|---|---|---|
| IA | `GEMINI_API_KEY` | — | Google AI Studio |
| IA | `DEEPSEEK_API_KEY` | — | DeepSeek / Novita AI |
| Imagen | `UNSPLASH_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY` | — | Cadena de fallback de imagen |
| Música | `JAMENDO_API_KEY` | — | Jamendo (Pixabay reutiliza su propia key) |
| Pipeline | `VIDEO_MIN/MAX_DURATION_SECONDS` | 60 / 300 | Rango válido de duración |
| Pipeline | `MAX_PARALLEL_JOBS` | 2 | Concurrencia del `Orchestrator` |
| Pipeline | `LOG_LEVEL` | INFO | Verbosidad de `structlog` |
| Pipeline | `MUSIC_ADAPTER_ORDER` | `["pixabay","jamendo","ytdlp"]` | Orden de la cadena de música |
| Publisher | `ENABLE_AUTO_PUBLISHING` | `false` | Activa la Etapa 9 |
| Publisher | `ACTIVE_ACCOUNT` | `tiktok:cuenta_1` | Cuenta por defecto si el job no especifica una |
| Publisher | `PUBLISHER_ENCRYPTION_KEY` | — | Clave Fernet para cifrar `accounts.json` |
| Publisher | `TIKTOK_CLIENT_ID/SECRET`, `YOUTUBE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` | — | Credenciales OAuth por plataforma |
| Publisher | `YOUTUBE_DAILY_QUOTA_LIMIT` / `YOUTUBE_QUOTA_COST_PER_UPLOAD` | 10000 / 1600 | Guarda de cuota de YouTube |
| Publisher | `PUBLISHER_TOKEN_REFRESH_MARGIN_SECONDS` | 1800 | Margen de refresco proactivo |

### Jerarquía de excepciones (`src/config/exceptions.py`)

```mermaid
classDiagram
    class NexaBriefError
    NexaBriefError <|-- ConfigurationError
    NexaBriefError <|-- AIGenerationError
    NexaBriefError <|-- AIValidationError
    NexaBriefError <|-- ImageFetchError
    NexaBriefError <|-- MusicFetchError
    NexaBriefError <|-- RecordingError
    NexaBriefError <|-- PipelineError
    NexaBriefError <|-- PackagingError
    NexaBriefError <|-- PublisherError
    PublisherError <|-- PublishingDisabledError
    PublisherError <|-- TokenError
    TokenError <|-- TokenExpiredError
    TokenError <|-- TokenRefreshError
    PublisherError <|-- PlatformAPIError
    PublisherError <|-- QuotaExceededError
    PublisherError <|-- VideoNotFoundError
    PublisherError <|-- UnsupportedOperationError
```

---

## 16. API REST

Framework: **FastAPI** + **Uvicorn**, capa fina sobre el `Orchestrator` y el `PublisherFacade`.

| Método | Ruta | Módulo | Descripción |
|---|---|---|---|
| `POST` | `/api/v1/videos` | `routers/videos.py` | Dispara `run_batch()`; devuelve `202 Accepted` con `BatchResponse` (bloqueante hasta completar todo el lote) |
| `GET` | `/api/v1/categories` | `routers/categories.py` | Lista los nichos configurados en `niches.json` |
| `POST` | `/api/v1/publish` | `routers/publisher.py` | Publicación manual, independiente del pipeline (`ManualPublishRequest`) |
| `GET` | `/api/v1/publish/accounts` | `routers/publisher.py` | Lista cuentas configuradas sin exponer tokens |
| `GET/PUT/DELETE` | `/api/v1/publish/{platform}/{alias}/{video_id}` | `routers/publisher.py` | CRUD de video ya publicado |
| `GET` | `/api/v1/auth/youtube/*` | `routers/youtube_oauth.py` | Flujo OAuth2 de escritorio/servidor para YouTube |
| `GET` | `/health` | `presentation/main.py` | Estado del servicio + flag `auto_publishing` |

**Ciclo de vida de la app** (`main.py`): un `lifespan` de FastAPI arranca el `APScheduler` de refresco de tokens sólo si `ENABLE_AUTO_PUBLISHING=true`, y libera los recursos del `PublisherFacade` en el shutdown.

---

## 17. Herramientas auxiliares de scraping

Fuera del pipeline principal, `scripts/` contiene herramientas independientes para poblar bibliotecas locales de imágenes (no forman parte del flujo de producción en caliente, se ejecutan manualmente u offline):

```mermaid
flowchart LR
    PIN["Pinterest\n(búsqueda headless con Playwright)"] --> DL["Descarga con httpx\nvalida ancho/alto ≥ 800px"]
    DL --> V1{"scrape_anime.py"}
    DL --> V2{"nexa_brief_ds_scraper.py"}
    V1 --> REMBG["rembg (modelo u2net)\nremoción de fondo local"]
    REMBG --> NOBG[("descargas/nobg/*.png")]
    V2 --> SCORE["Scoring técnico\n(resolución, aspect ratio)\n+ DeepSeek Vision (estético)"]
    SCORE --> TOP2[("Top 2 imágenes por query")]
```

| Script | Propósito | Filtrado |
|---|---|---|
| `nexa_brief_ds_scraper.py` | Fondos de escritorio de alta calidad | Score técnico (resolución/aspect ratio) + ranking por DeepSeek Vision, conserva el top 2 |
| `scrape_anime.py` | Arte de personajes de cuerpo completo | Detección de transparencia nativa + `rembg` (u2net) para remover fondo |
| `scrape_backgrounds.py` / `scrape_backgrounds_v3.py` | Fondos generales (versión legacy y unificada) | Validación de dimensión mínima 800×800 |

---

## 18. Cobertura de pruebas

```text
tests/
├── unit/
│   ├── test_token_storage.py            # cifrado/descifrado Fernet, escritura atómica
│   ├── test_token_manager.py            # refresco automático, mocks de HTTP
│   ├── test_publisher_router.py         # endpoints FastAPI de publicación
│   ├── test_social_publisher_module.py  # lógica de la Etapa 9
│   ├── test_adapters_reels_playlists.py # Facebook Reels + YouTube Playlists
│   ├── test_visual_designer.py          # Etapa 2
│   ├── test_input_analyzer.py           # Etapa 1
│   └── test_prompt_architect.py         # Etapa 4
└── integration/
    └── test_full_pipeline.py            # pipeline extremo a extremo (con mocks de IA/red)
```

Herramientas: `pytest`, `pytest-asyncio` (modo `auto`), `pytest-cov`. Calidad de código: `ruff` (lint + format) y `mypy` (tipado estático).

---

## 19. Stack tecnológico completo

| Capa | Tecnología | Versión mínima |
|---|---|---|
| Lenguaje | Python | ≥ 3.10.12 |
| Gestor de paquetes | `uv` | — |
| Framework API | FastAPI | ≥ 0.115.0 |
| Servidor ASGI | Uvicorn | ≥ 0.34.0 |
| Validación de datos | Pydantic v2 + pydantic-settings | ≥ 2.13.4 / ≥ 2.14.1 |
| IA — análisis/diseño/visión/resumen | `google-genai` (Gemini 3.1 Flash-Lite) | ≥ 2.8.0 |
| IA — generación de código | `openai` (cliente compatible, endpoint DeepSeek) | ≥ 2.41.1 |
| OAuth | `google-auth-oauthlib` | ≥ 1.4.0 |
| Cliente HTTP async | `httpx` | ≥ 0.28.1 |
| Grabación headless | `playwright` | ≥ 1.60.0 |
| Transcodificación | FFmpeg (binario de sistema) | — |
| Imágenes | `Pillow` | ≥ 11.0.0 |
| Remoción de fondo | `rembg` + `onnxruntime` | ≥ 2.0.69 / <1.20 |
| Cifrado | `cryptography` (Fernet AES) | ≥ 44.0.0 |
| I/O asíncrono | `aiofiles` | ≥ 25.1.0 |
| JSON rápido | `orjson` | ≥ 3.11.9 |
| Logging estructurado | `structlog` | ≥ 26.1.0 |
| Salida de consola | `rich` | ≥ 15.0.0 |
| Programación de tareas | `APScheduler` | ≥ 3.10.4 |
| Testing | `pytest`, `pytest-asyncio`, `pytest-cov` | ≥ 9.1.0 / ≥1.4.0 / ≥7.1.0 |
| Calidad de código | `ruff`, `mypy` | ≥ 0.15.17 / ≥ 2.1.0 |

---

## 20. Despliegue e infraestructura

```mermaid
flowchart TB
    subgraph VPS["Servidor (ej. Hetzner CX32 — 4 vCPU / 8GB RAM)"]
        UV["Uvicorn + FastAPI\nsrc.presentation.main:app"]
        SCHED["APScheduler\n(refresco de tokens, si ENABLE_AUTO_PUBLISHING)"]
        CH["Chromium headless\n(hasta max_parallel_jobs instancias)"]
        FFB["FFmpeg\n(transcodificación por job)"]
        DISK[("Filesystem local\noutput/{job_id}/, accounts.json, niches.json")]
    end

    subgraph EXTAI["IA"]
        GEMAPI["Google AI Studio API"]
        DSAPI["DeepSeek API"]
    end

    subgraph EXTRES["Recursos multimedia"]
        UNS["Unsplash / Pexels / Pixabay"]
        MUSAPI["Pixabay Music / Jamendo / FMA"]
    end

    subgraph EXTPUB["Publicación"]
        YTAPI["YouTube Data API v3"]
        TKAPI["TikTok Content Posting API v2"]
        FBAPI["Facebook Graph API v21.0"]
    end

    CLIENT(["Cliente HTTP / cron externo"]) --> UV
    UV --> CH
    UV --> FFB
    UV <--> GEMAPI
    UV <--> DSAPI
    UV <--> UNS
    UV <--> MUSAPI
    UV <--> DISK
    SCHED <--> YTAPI
    SCHED <--> TKAPI
    UV <--> YTAPI
    UV <--> TKAPI
    UV <--> FBAPI
```

**Consideraciones de capacidad:** cada job concurrente consume aproximadamente una instancia de Chromium (~800 MB) más el proceso de FFmpeg; con `max_parallel_jobs=2` (default) el consumo de memoria pico ronda 2–3 GB, dejando margen amplio en un servidor de 8 GB. No hay base de datos: todo el estado persiste en el filesystem (`output/`, `accounts.json`, `niches.json`), lo que simplifica el despliegue pero implica que un reinicio del proceso pierde los jobs en curso (no hay cola persistente).

---

## 21. Estado real observado y hallazgos

Verificado directamente contra el repositorio (no contra documentación histórica, que en algunos puntos describe fases planeadas aún no implementadas):

- **28 carpetas de job** existen en `output/`, todas con su carpeta `logs/` completa (8-9 archivos JSON por job), confirmando que el pipeline corre de punta a punta en producción.
- `niches.json` define **3 nichos**, de los cuales **2 están activos** (`ambient_music`, `animated_study`); `economy_finance` está desactivado (`active: false`) y representa un nicho planeado a futuro (voz IA + infografías, aún sin implementar en el código de módulos).
- Los tokens de `accounts.json` usan cifrado Fernet real; los `access_token` de YouTube y TikTok tienen vigencia corta (~1h y ~24h respectivamente) por diseño — su expiración periódica **es esperada** y queda cubierta por el refresco automático de `TokenManager`, no representa una falla salvo que el `refresh_token` también sea rechazado por la plataforma.
- El adaptador de **TikTok** publica en modo `SELF_ONLY` (privado) mientras la app no tenga aprobación de producción de la plataforma — esto es una restricción de TikTok, no un bug del sistema.
- `TikTokAdapter.update_video()` lanza `UnsupportedOperationError` de forma explícita porque la API de TikTok no ofrece esa operación — comportamiento correcto y documentado, no un defecto.
- No existe base de datos ni cola de trabajos persistente: el endpoint `POST /api/v1/videos` es **bloqueante** hasta que termina todo el lote, lo cual es aceptable para uso interno/cron pero limitaría un uso con múltiples clientes concurrentes de cara al usuario final.

---

## 22. Glosario

| Término | Significado en este sistema |
|---|---|
| **Job** | Unidad de trabajo inmutable que representa la generación de un video, desde `PENDING` hasta `PACKAGED`/`PUBLISHED`/`FAILED` |
| **Nicho** (`niche`) | Configuración de categoría de contenido (`niches.json`): define imagen, audio, formatos de video, IA y publicación por defecto |
| **Skill** | Documento Markdown con dirección creativa/técnica que se inyecta como contexto en un prompt de IA |
| **Puerto** (`Port`) | Interfaz abstracta en `src/core/ports/` que el núcleo usa sin conocer la implementación concreta |
| **Adaptador** (`Adapter`) | Implementación concreta de un puerto para un proveedor externo específico |
| **Facade** | `PublisherFacade`, punto único de entrada para todas las operaciones de publicación en redes sociales |
| **Reels** | Formato de video vertical (9:16) de duración completa, generado por recorte centrado del video 16:9 |
| **Safe zone** | Franja central horizontal (60%) que la IA generadora de HTML debe respetar cuando el formato final será 9:16 |

---

*Documento generado mediante auditoría directa del código fuente de Nexa-Brief (commit más reciente: "Add TikTok verification file"). No se ha incluido ningún token, clave API, `client_secret` ni identificador de cuenta real — todos los ejemplos usan los alias genéricos ya presentes en `.env.example` (`canal_1`, `cuenta_1`, `pagina_1`).*
