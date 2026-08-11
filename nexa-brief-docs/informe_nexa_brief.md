# INFORME TÉCNICO COMPLETO — NEXA BRIEF
**Sistema de Generación Automatizada de Videos Musicales con Publicación Social**  
**Análisis por:** Claude Sonnet 4.6 | **Fecha de actualización:** 2026-06-27  
**Versión del informe:** 2.0 (actualizado con Stage 9, publishing system, OAuth debugging)

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Pipeline de 9 Etapas](#3-pipeline-de-9-etapas)
4. [Sistema de Publicación Social (Stage 9)](#4-sistema-de-publicación-social-stage-9)
5. [OAuth y Gestión de Tokens](#5-oauth-y-gestión-de-tokens)
6. [API REST](#6-api-rest)
7. [Scripts de Utilidad (Raíz)](#7-scripts-de-utilidad-raíz)
8. [Scrapers de Recursos Visuales](#8-scrapers-de-recursos-visuales)
9. [Configuración y Variables de Entorno](#9-configuración-y-variables-de-entorno)
10. [Dependencias](#10-dependencias)
11. [Estado Actual de Cada Componente](#11-estado-actual-de-cada-componente)
12. [Issues Encontrados](#12-issues-encontrados)
13. [Análisis Pros y Contras](#13-análisis-pros-y-contras)
14. [Métricas del Sistema](#14-métricas-del-sistema)
15. [Riesgos Técnicos](#15-riesgos-técnicos)
16. [Recomendaciones y Próximos Pasos](#16-recomendaciones-y-próximos-pasos)
17. [Conclusión](#17-conclusión)

---

## 1. Resumen Ejecutivo

Nexa Brief es una fábrica digital autónoma de videos musicales orientada a creadores de contenido para YouTube, TikTok y Facebook. Dado un nombre de categoría musical, el sistema orquesta un pipeline de **9 etapas** que involucra análisis con IA, diseño visual generativo, obtención de recursos multimedia, generación de código HTML, grabación headless con Playwright+FFmpeg, empaquetado, y —opcionalmente— publicación automática en redes sociales.

**Estado actual del sistema (2026-06-27):**

| Componente | Estado |
|-----------|--------|
| Pipeline etapas 1–8 | ✅ Funcional — 21+ videos generados |
| Stage 9 (YouTube upload) | ⚠️ Upload funciona, poll falla (scope) |
| YouTube token | ❌ Expirado (~24 jun 2026) |
| YouTube scope | ❌ Solo `youtube.upload`, falta `youtube.readonly` |
| TikTok | ⚠️ Adaptador implementado, sin probar end-to-end |
| Facebook | ❌ `facebook_setup.py` no existe |
| API REST | ✅ Funcional (10 endpoints) |
| Scrapers de recursos | ✅ Funcionan (standalone) |

---

## 2. Arquitectura del Sistema

### 2.1 Patrón arquitectónico

El sistema combina dos patrones:

- **Arquitectura Hexagonal (Ports & Adapters):** el núcleo define interfaces abstractas (puertos). Los servicios externos (Gemini, DeepSeek, Unsplash, Playwright, YouTube API, etc.) se conectan como adaptadores intercambiables sin modificar la lógica central.
- **Microkernel:** el `Orchestrator` actúa como núcleo mínimo que distribuye trabajos al pipeline. Las "skills" (archivos Markdown) se cargan en tiempo de ejecución como plugins de diseño.

### 2.2 Estructura de directorios completa

```
nexa-brief/
├── src/
│   ├── core/                   # Núcleo puro — sin dependencias externas
│   │   ├── ports/              # Interfaces abstractas (5 puertos)
│   │   │   ├── ai_port.py
│   │   │   ├── image_port.py
│   │   │   ├── music_port.py
│   │   │   ├── publisher_port.py   # CRUD completo (publish/get/update/delete)
│   │   │   └── recorder_port.py
│   │   ├── job.py              # Job, JobInput, JobArtifacts, JobStage (Pydantic v2)
│   │   ├── pipeline.py         # run() — encadena las 9 etapas secuencialmente
│   │   └── orchestrator.py     # run_batch() — paralelo con asyncio.Semaphore
│   ├── adapters/
│   │   ├── ai/
│   │   │   ├── factory.py      # get_analysis_ai() → Gemini | get_codegen_ai() → DeepSeek
│   │   │   └── infrastructure/
│   │   │       ├── gemini_flash_adapter.py
│   │   │       └── deepseek_adapter.py
│   │   ├── image/
│   │   │   ├── factory.py
│   │   │   ├── css_fallback_adapter.py
│   │   │   └── infrastructure/
│   │   │       ├── unsplash_adapter.py
│   │   │       ├── pexels_adapter.py
│   │   │       └── pixabay_image_adapter.py
│   │   ├── music/
│   │   │   ├── factory.py
│   │   │   └── infrastructure/
│   │   │       ├── pixabay_music_adapter.py
│   │   │       ├── jamendo_adapter.py
│   │   │       ├── fma_adapter.py
│   │   │       ├── ytdlp_fallback_adapter.py
│   │   │       └── local_cache_adapter.py
│   │   ├── publishing/
│   │   │   ├── __init__.py
│   │   │   ├── factory.py          # get_publisher_facade()
│   │   │   ├── publisher_facade.py # Punto de entrada unificado
│   │   │   ├── base_platform.py    # Clase base con lógica común
│   │   │   ├── token_storage.py    # AES-256 Fernet + atomic write
│   │   │   ├── token_manager.py    # Auto-refresh con margen de 30 min
│   │   │   ├── scheduler.py        # APScheduler background refresh
│   │   │   ├── youtube_adapter.py  # Resumable upload 3 fases
│   │   │   ├── tiktok_adapter.py   # OAuth 2.0 direct post
│   │   │   └── facebook_adapter.py # Graph API page videos
│   │   └── recorder/
│   │       ├── factory.py
│   │       └── infrastructure/
│   │           └── playwright_ffmpeg_adapter.py
│   ├── modules/                # Las 9 etapas como funciones async puras
│   │   ├── input_analyzer.py   # Stage 1
│   │   ├── visual_designer.py  # Stage 2
│   │   ├── resource_fetcher.py # Stage 3
│   │   ├── prompt_architect.py # Stage 4
│   │   ├── html_generator.py   # Stage 5
│   │   ├── video_recorder.py   # Stage 6
│   │   ├── result_summarizer.py # Stage 7
│   │   ├── packager.py         # Stage 8
│   │   └── social_publisher.py # Stage 9 (gated por ENABLE_AUTO_PUBLISHING)
│   ├── config/
│   │   ├── settings.py         # pydantic-settings — carga .env con validación
│   │   ├── exceptions.py       # Jerarquía completa de excepciones tipadas
│   │   └── logging_config.py   # structlog — logs JSON estructurados
│   ├── presentation/
│   │   ├── main.py             # FastAPI app, lifespan, APScheduler
│   │   └── api/
│   │       ├── routers/
│   │       │   ├── videos.py
│   │       │   ├── categories.py
│   │       │   ├── publisher.py    # CRUD manual de publicación
│   │       │   └── youtube_oauth.py # Flujo OAuth web (server-side)
│   │       └── schemas/
│   │           ├── video_schema.py
│   │           ├── category_schema.py
│   │           └── publisher_schema.py
│   └── skills/                 # Markdown como plugins de IA (microkernel)
│       ├── genres/             # ambient.md, classical.md, jazz.md, lofi.md, study.md
│       ├── html/
│       └── output/
├── tests/
│   ├── unit/                   # 6 tests unitarios
│   └── integration/            # 1 test de integración
├── docs/                       # Documentación + prototipos HTML
├── descargas/                  # Fondos scrapeados (por slug de query)
├── descargas_anime/            # Personajes anime sin fondo
├── descargas_gym/              # Fondos temática gym
├── output/                     # Videos generados (gitignore)
├── accounts.json               # Tokens cifrados — NUNCA commitear
├── client_secret.json          # OAuth Desktop App (Google) — NUNCA commitear
├── .env                        # Variables de entorno — NUNCA commitear
├── youtube_auth_once.py        # Setup OAuth YouTube (ejecutar 1 vez)
├── youtube_oauth_setup.py      # Versión alternativa/anterior del setup
├── test_publisher_tokens.py    # Test integración YouTube end-to-end
├── nexa_brief_ds_scraper.py    # Scraper Pinterest + DeepSeek Vision
├── scrape_anime.py             # Scraper anime/personajes + rembg
├── scrape_backgrounds.py       # Duplicado de scrape_anime.py (idéntico)
├── scrape_backgrounds_v3.py    # v3 scraper fondos HD con DeepSeek ranking
└── pyproject.toml              # Dependencias uv — Python ≥3.10.12
```

### 2.3 Modelo de datos central: `Job`

El objeto `Job` (Pydantic v2, inmutable) viaja por las 9 etapas. Cada etapa recibe un `Job` y devuelve un nuevo `Job` con su artefacto agregado via `model_copy()`. Nunca muta el estado anterior.

```python
Job {
  job_id: str              # UUID hex 8 chars
  input: JobInput          # category_name, quantity, duration_seconds, user_context
  stage: JobStage          # enum: PENDING → ... → PACKAGED → PUBLISHED | FAILED
  artifacts: JobArtifacts  # bag inmutable de outputs de cada etapa
  errors: list[str]        # registro de fallos
}

JobArtifacts {
  analyzed_input: AnalyzedInput | None    # Stage 1: genre, mood_tags, image_query
  visual_design: VisualDesign | None      # Stage 2: colors, fonts, animation
  image_path: Path | None                 # Stage 3
  music_path: Path | None                 # Stage 3
  prompt_text: str | None                 # Stage 4
  html_path: Path | None                  # Stage 5
  youtube_video_path: Path | None         # Stage 6: 1920x1080
  tiktok_video_path: Path | None          # Stage 6: 1080x1920 (vertical)
  summary: VideoSummary | None            # Stage 7: SEO metadata
  output_dir: Path | None                 # Stage 8
  publish_result: PublishResult | None    # Stage 9: primer éxito
  publish_results: dict[str, PublishResult]  # Stage 9: todos los éxitos
}
```

---

## 3. Pipeline de 9 Etapas

El pipeline se ejecuta en `src/core/pipeline.py`. El flag `ENABLE_AUTO_PUBLISHING=true` en `.env` activa la Etapa 9.

```
[POST /api/v1/videos] → Orchestrator (Semaphore) → Pipeline
  ↓
  Stage 1: input_analyzer    → Gemini Flash  → AnalyzedInput
  Stage 2: visual_designer   → Gemini Flash  → VisualDesign
  Stage 3: resource_fetcher  → Unsplash/Pexels/Pixabay + Pixabay Music/Jamendo
  Stage 4: prompt_architect  → Pure Python   → prompt_text (brief para DeepSeek)
  Stage 5: html_generator    → DeepSeek V4   → index.html (Web Audio API visualizer)
  Stage 6: video_recorder    → Playwright + FFmpeg → youtube_video.mp4 + tiktok_video.mp4
  Stage 7: result_summarizer → Gemini Flash  → VideoSummary (SEO)
  Stage 8: packager          → Pure Python   → output/{job_id}/ organizado
  Stage 9: social_publisher  → HttpX         → PublishResult (post_id, url)
```

### 3.1 Archivos de log generados por job

Cada job crea una subcarpeta `output/{job_id}/logs/` con:

| Archivo | Etapa | Contenido |
|---------|-------|-----------|
| `01_input_completado.json` | Stage 1 | genre, mood_tags, image_query, description |
| `02_diseno_visual.json` | Stage 2 | colors, fonts, animation, style |
| `04_html_generado.html` | Stage 5 | HTML completo generado por DeepSeek |
| `04_html_log.json` | Stage 5 | has_audio, has_canvas, has_web_audio, uses_threejs, uses_gsap |
| `07_grabacion_stats.json` | Stage 6 | duración, tamaños de archivo, resoluciones |
| `09_publicacion_resultado.json` | Stage 9 | post_id, url, plataforma, duración de upload |

### 3.2 Roles de IA

| IA | Modelo | Etapas | SDK |
|----|--------|--------|-----|
| Gemini Flash Lite | `gemini-3.1-flash-lite-preview` | 1, 2, 7 | `google-genai` |
| DeepSeek V4 Flash | `deepseek-v4-flash` | 5 | `openai` (compatible) |

**Gemini** trabaja en JSON mode (`response_mime_type="application/json"`) para análisis estructurado.  
**DeepSeek** trabaja en modo texto libre para generación de HTML con Web Audio API.

Ambos tienen:
- Máximo 3 reintentos con backoff exponencial (2s → 4s → 6s)
- Limpieza de markdown fences con regex
- `max_tokens: 8192`

### 3.3 Stage 9 — social_publisher detallado

El módulo `src/modules/social_publisher.py` es la Etapa 9. Solo se ejecuta si `ENABLE_AUTO_PUBLISHING=true`.

**Flujo:**
1. Lee `ACTIVE_ACCOUNT` (puede ser lista separada por comas: `"youtube:canal_1,tiktok:cuenta_1"`)
2. Para cada selector `"platform:alias"`:
   - TikTok → usa `tiktok_video_path` (vertical 9:16)
   - YouTube/Facebook → usa `youtube_video_path` (horizontal 16:9)
3. Extrae SEO de `job.artifacts.summary` (Stage 7)
4. Llama a `PublisherFacade.publish_video()`
5. Guarda resultado en `publish_results[selector]`
6. Escribe `09_publicacion_resultado.json` para auditoría
7. Si alguna plataforma falla, el job se marca como `FAILED` (fallo total)

---

## 4. Sistema de Publicación Social (Stage 9)

### 4.1 Componentes del subsistema

```
PublisherFacade
    ├── TokenManager       # Auto-refresh antes de vencer
    │   └── TokenStorage   # AES-256 Fernet, atomic write a accounts.json
    ├── YouTubeAdapter     # YouTube Data API v3
    ├── TikTokAdapter      # TikTok Content Publishing API
    └── FacebookAdapter    # Meta Graph API
```

### 4.2 TokenStorage (`src/adapters/publishing/token_storage.py`)

Almacén de tokens cifrados con Fernet (AES-256-CBC + HMAC-SHA256).

- **Cifrado:** `cryptography.fernet.Fernet`
- **Almacén:** `accounts.json` en la raíz del proyecto
- **Escritura atómica:** escribe a `.tmp` → `rename()` — previene corrupción si el proceso muere a mitad de escritura
- **Fix aplicado:** maneja archivo vacío (`str().strip()` + `if not raw: return {}`)

Estructura de `accounts.json`:
```json
{
  "youtube": {
    "canal_1": {
      "encrypted_access_token": "gAAAAA...",
      "encrypted_refresh_token": "gAAAAA...",
      "expires_at": 1782579200.493762,
      "status": "ok",
      "name": "canal_1",
      "target_id": "canal_1",
      "client_id": "785380865262-4ik8kl1g...",
      "client_secret": "GOCSPX-SIofy..."
    }
  },
  "tiktok": { ... },
  "facebook": { ... }
}
```

### 4.3 TokenManager (`src/adapters/publishing/token_manager.py`)

- **Margen de refresh:** 30 minutos antes de que expire (`publisher_token_refresh_margin_seconds=1800`)
- **YouTube refresh:** POST `https://oauth2.googleapis.com/token` con `grant_type=refresh_token`
- **Google NO rota refresh tokens:** solo se actualiza el `access_token`
- **Credenciales por cuenta:** `client_id` y `client_secret` se guardan en `accounts.json` junto al token para que el refresh funcione sin .env (multi-cuenta posible)
- **Scheduler:** `APScheduler` arranca en el lifespan de FastAPI y corre el refresh en background

### 4.4 YouTubeAdapter (`src/adapters/publishing/youtube_adapter.py`)

**Protocolo:** YouTube Resumable Upload (3 fases)

```
Fase 1: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
        Body: JSON con snippet (title, description, tags, categoryId) + status (privacyStatus)
        Respuesta: header Location = session_uri

Fase 2: PUT {session_uri}
        Chunks de CHUNK_SIZE_BYTES (default 5 MB)
        Respuesta: 206 Partial → siguiente chunk | 200/201 → upload completo
        Retorna: video_id

Fase 3: GET https://www.googleapis.com/youtube/v3/videos?part=status&id={video_id}
        Polling cada 5 segundos hasta upload_status = "processed"
        Requiere scope: youtube.readonly  ← ESTE ES EL SCOPE QUE FALTA
```

**CRUD completo:**
- `publish()` — Upload de 3 fases + espera a que esté procesado
- `get_video()` — GET `/youtube/v3/videos?part=snippet,status`
- `update_video()` — PUT `/youtube/v3/videos` (snippet part)
- `delete_video()` — DELETE `/youtube/v3/videos?id={video_id}`

**Quota guard:** 10,000 unidades/día · 1,600 unidades por upload = máximo 6 uploads/día.

**Issue conocido:** `categoryId` hardcodeado como `"10"` (Music). Debería ser dinámico según el género del video.

### 4.5 TikTokAdapter (`src/adapters/publishing/tiktok_adapter.py`)

- Auth: OAuth 2.0 client credentials (`TIKTOK_CLIENT_ID` + `TIKTOK_CLIENT_SECRET`)
- Video: `tiktok_video_path` (vertical 9:16, ~61 segundos)
- Estado: implementado pero **sin probar end-to-end**

### 4.6 FacebookAdapter (`src/adapters/publishing/facebook_adapter.py`)

- Auth: Graph API Page Access Token
- Video: `youtube_video_path` (horizontal)
- Page Access Tokens de larga duración (no expiran)
- Estado: implementado pero **sin script de autorización** (`facebook_setup.py` no existe)

### 4.7 PublisherFacade (`src/adapters/publishing/publisher_facade.py`)

Punto de entrada unificado para todas las plataformas.

```python
# El selector "platform:alias" resuelve al adaptador correcto
facade.publish_video(
    video_path=Path("output/.../youtube_video.mp4"),
    title="...",
    description="...",
    tags=["lofi", "study"],
    account_selector="youtube:canal_1",
)
```

`list_accounts()` devuelve el estado de todos los tokens sin revelar los valores.

---

## 5. OAuth y Gestión de Tokens

### 5.1 YouTube — Desktop App OAuth (la forma correcta)

**Script:** `youtube_auth_once.py`

```
Flujo:
1. InstalledAppFlow.from_client_secrets_file("client_secret.json")
2. flow.run_local_server(port=0, prompt="consent", access_type="offline")
   - port=0 = puerto libre aleatorio (no requiere pre-registrar URI en Google Cloud)
3. Obtiene access_token + refresh_token
4. Guarda tokens cifrados en accounts.json via TokenStorage
5. Guarda client_id/client_secret por cuenta para auto-refresh futuro
```

**Scopes necesarios** (post-fix):
```python
SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",    # Para subir videos
    "https://www.googleapis.com/auth/youtube.readonly",  # Para polling de estado
]
```

**Requisito:** `client_secret.json` debe ser de tipo **"Desktop App" (installed)**, NO "Web Application". El tipo Desktop permite cualquier puerto localhost sin pre-registro.

**Multi-canal:**
```bash
uv run youtube_auth_once.py --alias canal_1   # Canal principal
uv run youtube_auth_once.py --alias canal_2   # Segundo canal
```

Limitación actual: `choices=["canal_1", "canal_2"]` — hardcodeado a 2 opciones.

### 5.2 YouTube — Web App OAuth (el router del servidor)

**Ruta:** `GET /api/oauth/youtube/start?alias=canal_1`

Este router implementa el flujo server-side con `redirect_uri = http://localhost:8000/api/oauth/youtube/callback`. Funciona con el servidor FastAPI corriendo.

**Issue:** El scope en este router es solo `youtube.upload` — no incluye `youtube.readonly`. Necesita actualización.

### 5.3 Historial de errores OAuth resueltos

| Error | Causa | Fix aplicado |
|-------|-------|-------------|
| `JSONDecodeError: line 1 column 1` | `accounts.json` existía pero estaba vacío | Agregar `.strip()` + `if not raw: return {}` en `_load()` |
| `401 youtubeSignupRequired` | La cuenta Google no tenía canal YouTube creado | Usuario creó canal "@DrovaSoft" en youtube.com |
| `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT` | Token tenía solo `youtube.upload`, el polling necesita `youtube.readonly` | Agregar scope en `youtube_auth_once.py` (ya aplicado) |
| Redirect URI mismatch | `client_secret.json` era tipo "Web" con redirect fijo | Usuario cambió a "Desktop App" en Google Cloud Console |

### 5.4 Estado actual del token (2026-06-27)

```
platform:     youtube
alias:        canal_1
expires_at:   1782579200  ← ~24 jun 2026 → EXPIRADO hace 3 días
access_token: INVÁLIDO — expirado
refresh_token: PRESENTE ✓ — puede renovar el access_token
scope guardado: youtube.upload SOLO
scope requerido: youtube.upload + youtube.readonly
client_id:    785380865262-4ik8kl1g... (Desktop App)
```

**Acción requerida:** `uv run youtube_auth_once.py` — abrirá el navegador, pedirá ambos scopes, y guardará tokens frescos. Después de eso, el auto-refresh funcionará de forma completamente autónoma.

### 5.5 TikTok OAuth

- Credenciales configuradas: `TIKTOK_CLIENT_ID` + `TIKTOK_CLIENT_SECRET` en `.env`
- No hay script de autorización interactivo documentado
- El adaptador espera tokens en `accounts.json` bajo `tiktok.cuenta_1`

### 5.6 Facebook OAuth

- Credenciales configuradas: `FACEBOOK_CLIENT_ID` + `FACEBOOK_CLIENT_SECRET` en `.env`
- `facebook_setup.py` **no existe** — debe crearse
- Los Page Access Tokens de Facebook no expiran (long-lived)
- Se obtienen desde Meta for Developers → Graph API Explorer

---

## 6. API REST

**Framework:** FastAPI + Uvicorn | **Puerto:** 8000 | **Versión:** `/api/v1`  
**Docs automáticos:** `/docs` (Swagger UI) · `/redoc`

### 6.1 Endpoints del pipeline

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servidor, versión, auto_publishing |
| `POST` | `/api/v1/videos/` | Dispara el pipeline. Body: `category_name`, `quantity`, `duration_seconds`, `user_context` |
| `GET` | `/api/v1/categories/` | Lista categorías musicales disponibles |

**Problema conocido:** `POST /api/v1/videos` es **bloqueante** — espera toda la generación antes de responder. Para videos de 1+ hora, la conexión HTTP queda abierta indefinidamente.

### 6.2 Endpoints de publicación manual

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/publish/` | Publica un video existente manualmente |
| `GET` | `/api/v1/publish/accounts` | Lista cuentas configuradas (sin revelar tokens) |
| `GET` | `/api/v1/publish/{platform}/{alias}/{video_id}` | Metadata de un video publicado |
| `PUT` | `/api/v1/publish/{platform}/{alias}/{video_id}` | Actualiza título/descripción/tags |
| `DELETE` | `/api/v1/publish/{platform}/{alias}/{video_id}` | Elimina el video de la plataforma |

**Manejo de errores HTTP:**

| Excepción | HTTP |
|-----------|------|
| `TokenExpiredError` | 401 |
| `VideoNotFoundError` | 404 |
| `QuotaExceededError` | 429 |
| `UnsupportedOperationError` | 422 |
| `PlatformAPIError` | 502 |
| `PublisherError` (base) | 500 |

### 6.3 Endpoints OAuth YouTube

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/oauth/youtube/start?alias=canal_1` | Inicia el flujo → redirige a Google |
| `GET` | `/api/oauth/youtube/callback` | Callback automático de Google → guarda tokens |

### 6.4 Lifespan (arranque del servidor)

Al iniciar FastAPI con `ENABLE_AUTO_PUBLISHING=true` y `PUBLISHER_ENCRYPTION_KEY` configurados:
1. Crea `output/` y `output/logs/`
2. Instancia `PublisherFacade`
3. Arranca `APScheduler` para refresh automático de tokens en background
4. Si el scheduler falla, el servidor arranca igual (non-fatal)

---

## 7. Scripts de Utilidad (Raíz)

### 7.1 `youtube_auth_once.py`

Script de autorización OAuth para YouTube — se ejecuta **una sola vez** (o cuando se agrega un canal).

```bash
uv run youtube_auth_once.py                  # Autoriza canal_1
uv run youtube_auth_once.py --alias canal_2  # Autoriza canal_2
```

**Validaciones que hace el script:**
- Verifica que `client_secret.json` existe y es tipo "Desktop App"
- Verifica que `PUBLISHER_ENCRYPTION_KEY` está configurada
- Verifica que se obtuvo `refresh_token` (sin él, el sistema no es autónomo)
- Guarda `client_id` y `client_secret` por cuenta en `accounts.json` para auto-refresh

### 7.2 `youtube_oauth_setup.py`

Versión anterior/alternativa del script OAuth. Tiene el mismo propósito que `youtube_auth_once.py`. Puede haber inconsistencias entre ambos — solo usar `youtube_auth_once.py`.

### 7.3 `test_publisher_tokens.py`

Script de diagnóstico e integración para YouTube. Hace:
1. Verifica `PUBLISHER_ENCRYPTION_KEY` en `.env`
2. Verifica que `accounts.json` existe y tiene token para `youtube:canal_1`
3. Descifra el token y verifica que no es un placeholder
4. Busca el `youtube_video.mp4` más reciente en `output/`
5. Sube el video con título "Lofi Beats for Deep Focus — Nexa Brief Test"
6. Reporta `video_id`, URL pública y duración del upload

```bash
uv run test_publisher_tokens.py
```

---

## 8. Scrapers de Recursos Visuales

Los tres scrapers son scripts **standalone** — no están integrados al pipeline principal. Producen imágenes en `descargas*/`.

### 8.1 `nexa_brief_ds_scraper.py` — Pinterest + DeepSeek Vision

Pipeline de scraping con validación por IA:
1. Playwright → Pinterest (scroll simulado humano con delays aleatorios)
2. Descarga hasta 5 candidatos técnicamente válidos (≥1920×1080, ratio ≤2.4:1)
3. Envía las 5 imágenes en una sola llamada a **DeepSeek Vision** con criterios de evaluación
4. DeepSeek devuelve scores (0.0–10.0) y selecciona las 2 mejores
5. Guarda las 2 mejores + JSON de evaluación + manifest global

```bash
python nexa_brief_ds_scraper.py \
  --query "japanese lofi aesthetic" \
  --query "cozy study room night" \
  --per-query 2 \
  --candidates 5 \
  --api-key $DEEPSEEK_API_KEY \
  --output descargas
```

### 8.2 `scrape_anime.py` — Personajes + rembg

Scraper de personajes anime con remoción automática de fondo:
1. Playwright → Pinterest (búsqueda de personajes)
2. Filtro técnico: `min_short_side=1080`, ratio ≤1.8, análisis de contraste
3. Detección de canal alfa (transparencia nativa) — si existe, no aplica rembg
4. **rembg** (modelo `u2net`) → quita el fondo → PNG con transparencia
5. Guarda en `raw/` (original) + `nobg/` (sin fondo)

```bash
python scrape_anime.py \
  --query "anime girl lofi aesthetic" \
  --per-query 3 \
  --output descargas_anime
```

### 8.3 `scrape_backgrounds_v3.py` — Fondos HD + DeepSeek ranking

Versión v3 del scraper de fondos: Pinterest → descarga masiva → DeepSeek Vision ranker → guarda los mejores. Similar a `nexa_brief_ds_scraper.py` pero con pipeline más elaborado.

### 8.4 `scrape_backgrounds.py` — DUPLICADO

Contenido **idéntico** a `scrape_anime.py`. Posible copia accidental. Revisar y eliminar si no es intencional.

---

## 9. Configuración y Variables de Entorno

El archivo `.env` es cargado por `pydantic-settings` en `src/config/settings.py`.  
**NUNCA committear `.env` al repositorio.**

### 9.1 Variables configuradas actualmente

| Variable | Estado | Uso |
|----------|--------|-----|
| `GEMINI_API_KEY` | ✅ Configurada | Gemini Flash (análisis, diseño, SEO) |
| `DEEPSEEK_API_KEY` | ✅ Configurada | DeepSeek V4 (generación HTML + scraper Vision) |
| `UNSPLASH_API_KEY` | ✅ Configurada | Imágenes de fondo |
| `PEXELS_API_KEY` | ✅ Configurada | Imágenes de fondo (fallback) |
| `PIXABAY_API_KEY` | ✅ Configurada | Imágenes + música |
| `JAMENDO_API_KEY` | ✅ Configurada | Música Creative Commons |
| `TIKTOK_CLIENT_ID` | ✅ Configurada | OAuth TikTok |
| `TIKTOK_CLIENT_SECRET` | ✅ Configurada | OAuth TikTok |
| `YOUTUBE_CLIENT_ID` | ✅ Configurada | OAuth YouTube (Desktop App) |
| `YOUTUBE_CLIENT_SECRET` | ✅ Configurada | OAuth YouTube |
| `FACEBOOK_CLIENT_ID` | ✅ Configurada | OAuth Facebook |
| `FACEBOOK_CLIENT_SECRET` | ✅ Configurada | OAuth Facebook |
| `PUBLISHER_ENCRYPTION_KEY` | ✅ Configurada | AES-256 Fernet para tokens |
| `ENABLE_AUTO_PUBLISHING` | ✅ `true` | Activa Stage 9 en el pipeline |
| `ACTIVE_ACCOUNT` | ✅ `"tiktok:cuenta_1,youtube:canal_1,facebook:pagina_1"` | Publica en 3 plataformas |

### 9.2 Variables opcionales con defaults

| Variable | Default | Descripción |
|----------|---------|-------------|
| `VIDEO_MIN_DURATION_SECONDS` | 60 | Mínimo de duración |
| `VIDEO_MAX_DURATION_SECONDS` | 300 | Máximo de duración |
| `MAX_PARALLEL_JOBS` | 2 | Jobs simultáneos |
| `PUBLISHER_UPLOAD_TIMEOUT_SECONDS` | 300 | Timeout de uploads |
| `PUBLISHER_TOKEN_REFRESH_MARGIN_SECONDS` | 1800 | Margen de refresh (30 min) |
| `YOUTUBE_DAILY_QUOTA_LIMIT` | 10000 | Quota diaria YouTube |
| `YOUTUBE_QUOTA_COST_PER_UPLOAD` | 1600 | Costo por upload |
| `LOG_LEVEL` | INFO | Nivel de logging |

---

## 10. Dependencias

### 10.1 Producción (`pyproject.toml`)

| Paquete | Rol |
|---------|-----|
| `fastapi ≥0.115` | Framework API REST |
| `uvicorn ≥0.34` | Servidor ASGI |
| `pydantic ≥2.13` | Modelos de datos + validación |
| `pydantic-settings ≥2.14` | Configuración desde `.env` |
| `google-genai ≥2.8` | Gemini Flash adapter |
| `openai ≥2.41` | DeepSeek adapter (compatible OpenAI) |
| `httpx ≥0.28` | Cliente HTTP async (uploads, APIs) |
| `playwright ≥1.60` | Captura HTML headless |
| `cryptography ≥44.0` | Fernet AES-256 para tokens |
| `apscheduler ≥3.10` | Scheduler background (token refresh) |
| `google-auth-oauthlib ≥1.4` | InstalledAppFlow para YouTube OAuth |
| `structlog ≥26.1` | Logging estructurado JSON |
| `orjson ≥3.11` | Serialización JSON rápida (logs) |
| `aiofiles ≥25.1` | I/O de archivos async |
| `pillow ≥11.0` | Procesamiento de imágenes |
| `rembg ≥2.0` | Remoción de fondos (usada en scrapers) |
| `onnxruntime <1.20` | Requerido por rembg |
| `rich ≥15.0` | Output terminal formateado |

**Dependencia del sistema (no instalable vía pip):** `ffmpeg` — binario externo requerido para el paso de mezcla de audio y generación de TikTok clip.

### 10.2 Desarrollo

| Paquete | Rol |
|---------|-----|
| `pytest ≥9.1` | Framework de tests |
| `pytest-asyncio ≥1.4` | Soporte async en tests |
| `pytest-cov ≥7.1` | Métricas de cobertura |
| `mypy ≥2.1` | Verificación de tipos estática |
| `ruff ≥0.15` | Linter + formateador |

---

## 11. Estado Actual de Cada Componente

| Componente | Archivo | Estado | Notas |
|-----------|---------|--------|-------|
| Pipeline Stage 1–8 | `src/core/pipeline.py` | ✅ Funciona | 21+ videos generados |
| Job model | `src/core/job.py` | ✅ Funciona | Pydantic v2 inmutable |
| Orchestrator | `src/core/orchestrator.py` | ✅ Funciona | Semaphore concurrencia |
| Gemini adapter | `src/adapters/ai/infrastructure/gemini_flash_adapter.py` | ✅ Funciona | JSON mode + retry |
| DeepSeek adapter | `src/adapters/ai/infrastructure/deepseek_adapter.py` | ✅ Funciona | Text mode + retry |
| Image adapters | `src/adapters/image/infrastructure/` | ✅ Funciona | Cadena fallback |
| Music adapters | `src/adapters/music/infrastructure/` | ✅ Funciona | Cadena fallback |
| Recorder | `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` | ✅ Funciona | Warm-up 3s fix |
| TokenStorage | `src/adapters/publishing/token_storage.py` | ✅ Funciona | Fix empty-file aplicado |
| TokenManager | `src/adapters/publishing/token_manager.py` | ✅ Funciona | Auto-refresh 30min margin |
| Scheduler (APScheduler) | `src/adapters/publishing/scheduler.py` | ✅ Funciona | Background refresh |
| PublisherFacade | `src/adapters/publishing/publisher_facade.py` | ✅ Funciona | Multi-plataforma |
| YouTubeAdapter upload | `src/adapters/publishing/youtube_adapter.py` | ✅ Upload funciona | Video aparece en @DrovaSoft |
| YouTubeAdapter poll | `src/adapters/publishing/youtube_adapter.py` | ❌ Falla scope | Necesita `youtube.readonly` |
| YouTube token canal_1 | `accounts.json` | ❌ Expirado | `expires_at` ~24 jun 2026 |
| `youtube_auth_once.py` | raíz | ✅ Listo para usar | Ambos scopes ya configurados |
| TikTokAdapter | `src/adapters/publishing/tiktok_adapter.py` | ⚠️ Sin probar | Implementado, falta test |
| FacebookAdapter | `src/adapters/publishing/facebook_adapter.py` | ⚠️ Sin setup | `facebook_setup.py` no existe |
| API publisher router | `src/presentation/api/routers/publisher.py` | ✅ Funciona | 5 endpoints |
| YouTube OAuth router | `src/presentation/api/routers/youtube_oauth.py` | ⚠️ Scope incompleto | Falta `youtube.readonly` en `_SCOPES` |
| Stage 9 social_publisher | `src/modules/social_publisher.py` | ⚠️ Parcial | Bloqueado por token/scope |
| FastAPI app | `src/presentation/main.py` | ✅ Funciona | Lifespan + scheduler |
| Settings | `src/config/settings.py` | ✅ Funciona | Todas las vars configuradas |
| Exceptions | `src/config/exceptions.py` | ✅ Funciona | Jerarquía completa |
| Scraper DS | `nexa_brief_ds_scraper.py` | ✅ Funciona | Standalone |
| Scraper anime | `scrape_anime.py` | ✅ Funciona | Standalone con rembg |
| scrape_backgrounds.py | raíz | ⚠️ Duplicado | Idéntico a scrape_anime.py |

---

## 12. Issues Encontrados

### Issue #1 — CRÍTICO: Token YouTube expirado

**Componente:** `accounts.json`  
**Detalle:** `expires_at: 1782579200` corresponde al ~24 junio 2026. Hoy 27 junio 2026. El `access_token` es inválido.  
**El `refresh_token` está presente** — el TokenManager puede renovarlo automáticamente.  
**Solución:** Ejecutar `uv run youtube_auth_once.py` para obtener tokens frescos con ambos scopes.

### Issue #2 — CRÍTICO: Scope insuficiente en token guardado

**Componente:** `src/adapters/publishing/youtube_adapter.py` (Fase 3)  
**Detalle:** El token guardado tiene solo `youtube.upload`. El polling de estado del video requiere `youtube.readonly` → error `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`.  
**El video SÍ sube** (Fase 1 y 2 funcionan). Falla al verificar si está "procesado".  
**Solución:** Re-ejecutar `youtube_auth_once.py` (ya tiene ambos scopes) para revocar el token viejo y obtener uno nuevo.

### Issue #3 — CRÍTICO: facebook_setup.py no existe

**Componente:** Raíz del proyecto  
**Detalle:** El archivo está abierto en el IDE pero no hay ningún archivo en disco. El adaptador `FacebookAdapter` no tiene script de autorización.  
**Solución:** Crear `facebook_setup.py` equivalente a `youtube_auth_once.py` para obtener Page Access Token via Meta Graph API.

### Issue #4 — MEDIO: Router OAuth del servidor con scope desactualizado

**Componente:** `src/presentation/api/routers/youtube_oauth.py:28`  
**Detalle:** `_SCOPES = "https://www.googleapis.com/auth/youtube.upload"` — no incluye `youtube.readonly`.  
**Consecuencia:** Si alguien usa el flujo web (vía `/api/oauth/youtube/start`) en lugar de `youtube_auth_once.py`, obtiene un token sin el scope necesario para el polling.  
**Solución:**
```python
# Cambiar:
_SCOPES = "https://www.googleapis.com/auth/youtube.upload"
# Por:
_SCOPES = " ".join([
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
])
```

### Issue #5 — MEDIO: categoryId hardcodeado

**Componente:** `src/adapters/publishing/youtube_adapter.py` (aproximadamente línea 85)  
**Detalle:** `"categoryId": "10"` (Music) está hardcodeado. El sistema genera contenido de estudio, ambient, lofi — no todo es "Music".  
**Solución:** Pasar `category_id` como parámetro opcional a `publish()`. Crear tabla de mapeo `genre → categoryId` (Music=10, Education=27, Entertainment=24, etc.).

### Issue #6 — MEDIO: --alias limitado a 2 opciones

**Componente:** `youtube_auth_once.py:42`  
**Detalle:** `choices=["canal_1", "canal_2"]` — no escala a más canales.  
**Solución:**
```python
# Cambiar:
parser.add_argument("--alias", default="canal_1", choices=["canal_1", "canal_2"])
# Por:
parser.add_argument("--alias", default="canal_1", type=str,
                    help="Alias del canal (ej: canal_1, canal_2, canal_trabajo, etc.)")
```

### Issue #7 — BAJO: scrape_backgrounds.py es un duplicado exacto

**Componente:** `scrape_backgrounds.py`  
**Detalle:** Tiene exactamente el mismo contenido que `scrape_anime.py`.  
**Solución:** Verificar intencionalidad. Si no, eliminar el duplicado o diferenciar los propósitos.

### Issue #8 — BAJO: Scrapers no integrados al pipeline

**Componente:** `nexa_brief_ds_scraper.py`, `scrape_anime.py`, `scrape_backgrounds_v3.py`  
**Detalle:** Los scrapers son scripts standalone en la raíz, no integrados al sistema principal. Los fondos que producen en `descargas*/` no son usados automáticamente por el pipeline.  
**Solución futura:** Crear `src/adapters/image/infrastructure/scraper_adapter.py` que use el directorio `descargas/` como fuente de imágenes de alta calidad para el pipeline.

---

## 13. Análisis Pros y Contras

### ✅ Fortalezas

**1. Arquitectura ejemplar para el dominio**  
La separación Hexagonal + Microkernel es la elección correcta. Agregar una plataforma nueva (ej. Instagram Reels) significa crear solo un nuevo adaptador `instagram_adapter.py` e implementar `PublisherPort` — sin tocar el pipeline ni la lógica de negocios.

**2. Resiliencia por diseño — cadena de fallbacks doble**  
- Imagen: Unsplash → Pexels → Pixabay → CSS placeholder
- Música: Pixabay → Jamendo → yt-dlp → Local cache  
El sistema siempre produce un output aunque varios proveedores fallen simultáneamente.

**3. Inmutabilidad del modelo `Job`**  
`model_copy()` en cada etapa hace el código thread-safe y permite debuggear el estado exacto de cada etapa sin efectos secundarios.

**4. Auditabilidad completa**  
9 archivos de log por job permiten reconstruir exactamente qué hizo el sistema, qué prompts envió, qué respuesta obtuvo, qué imagen eligió.

**5. Skills como configuración externa**  
Los archivos Markdown en `src/skills/` permiten ajustar el comportamiento creativo de las IAs sin tocar código Python. El "conocimiento creativo" es editable sin programar.

**6. Seguridad de tokens bien implementada**  
AES-256-CBC + HMAC-SHA256 (Fernet), escritura atómica, claves nunca en logs, credenciales por cuenta guardadas para auto-refresh.

**7. Pipeline multi-plataforma en una pasada**  
Una sola generación produce: video YouTube (1920×1080), clip TikTok (1080×1920, 61s), título+descripción+tags para YouTube, caption+hashtags para TikTok — y publica en hasta 3 plataformas simultáneamente.

**8. Scrapers de alta calidad con validación IA**  
El flujo `nexa_brief_ds_scraper.py` no descarga imágenes a ciegas — filtra técnicamente (resolución, aspecto) y luego usa DeepSeek Vision para seleccionar las mejores según coherencia temática.

### ❌ Debilidades

**1. CRÍTICO: Endpoint HTTP bloqueante**  
`POST /api/v1/videos` espera todo el procesamiento antes de responder. Para videos de 1–5 horas esto es inaceptable en producción. Necesita jobs asíncronos + SSE/WebSocket.

**2. CRÍTICO: Sin persistencia de estado de jobs**  
Los jobs viven solo en memoria. Un reinicio del servidor borra todo el progreso de un job en curso.

**3. Sin reintentos por etapa**  
Si la Etapa 5 (HTML) falla en un job de 3 horas, el job completo falla desde cero.

**4. facebook_setup.py no existe**  
Facebook está configurado pero no se puede autorizar sin el script de setup.

**5. categoryId hardcodeado en YouTube**  
"10" (Music) para todos los videos, independientemente del género real.

**6. Token expirado sin alerta proactiva**  
El sistema no envía notificación cuando el token expira. El fallo solo se detecta cuando se intenta publicar.

**7. Cobertura de tests insuficiente**  
6 tests unitarios y 1 de integración para un sistema de esta complejidad. Los adaptadores externos no tienen mocks.

**8. Concurrencia parcialmente async**  
Algunas escrituras de archivos usan `write_bytes()` síncrono en el event loop.

**9. Doble script de OAuth YouTube**  
`youtube_auth_once.py` y `youtube_oauth_setup.py` coexisten y pueden tener diferencias. Solo uno debería existir.

---

## 14. Métricas del Sistema

| Métrica | Valor |
|---------|-------|
| Líneas de código Python (src/) | ~2,000+ LOC |
| Etapas del pipeline | 9 (8 + Stage 9) |
| Adaptadores de IA | 2 (Gemini, DeepSeek) |
| Adaptadores de imagen | 4 (Unsplash, Pexels, Pixabay, CSS) |
| Adaptadores de música | 5 (Pixabay, Jamendo, FMA, yt-dlp, Local) |
| Adaptadores de publicación | 3 (YouTube, TikTok, Facebook) |
| Puertos abstractos | 5 |
| Endpoints API | 10 |
| API keys configuradas | 12 (AI + imagen + música + publicación) |
| Dependencias producción | 17 |
| Tests existentes | 7 (6 unit + 1 integration) |
| Géneros musicales soportados | 5 (lofi, jazz, ambient, classical, study) |
| Outputs reales generados | 21+ |
| Formatos de salida | 2 (YouTube MP4 1920×1080, TikTok MP4 1080×1920) |
| Plataformas de publicación | 3 (YouTube, TikTok, Facebook) |
| Videos máximos por día (YouTube) | 6 (por quota 10,000 units / 1,600 por upload) |

---

## 15. Riesgos Técnicos

| Riesgo | Severidad | Probabilidad | Estado actual |
|--------|-----------|--------------|---------------|
| Timeout HTTP en videos largos | 🔴 Alta | Alta | Sin resolver |
| Pérdida de job por caída del servidor | 🔴 Alta | Media | Sin resolver |
| Token YouTube expirado | 🔴 Alta | Alta | **OCURRIÓ** — token vencido |
| Scope insuficiente YouTube | 🔴 Alta | Alta | **OCURRIÓ** — 403 en polling |
| Facebook sin autorizar | 🔴 Alta | Certeza | Script de setup inexistente |
| Agotamiento quota YouTube | 🟡 Media | Media | Quota guard implementado |
| HTML inválido genera video negro | 🟡 Media | Media | Validación superficial |
| Regresión en adaptadores sin tests | 🟡 Media | Alta | Cobertura baja |
| Modelo IA discontinuado | 🟡 Media | Media | Verificar versiones en settings |

---

## 16. Recomendaciones y Próximos Pasos

### P0 — Acción inmediata (resuelve los blockers actuales)

```bash
# 1. Re-autorizar YouTube (resuelve token expirado + scope incompleto)
uv run youtube_auth_once.py

# 2. Verificar que el upload completo funciona (init → chunks → poll)
uv run test_publisher_tokens.py
```

### P1 — Esta semana (resuelve issues críticos)

**a. Agregar `youtube.readonly` al router OAuth del servidor**  
Archivo: `src/presentation/api/routers/youtube_oauth.py:28`  
Cambiar `_SCOPES` para incluir ambos scopes.

**b. Crear `facebook_setup.py`**  
Script equivalente a `youtube_auth_once.py` para obtener Page Access Token de Meta Graph API y guardarlo cifrado en `accounts.json`.

**c. Hacer `categoryId` dinámico en YouTubeAdapter**  
Pasar `category_id` como parámetro opcional a `publish()`. Añadir tabla de mapeo en `channels.json` (por crear).

**d. Quitar el limit de `--alias` en `youtube_auth_once.py`**  
Cambiar `choices=["canal_1", "canal_2"]` por `type=str` para soportar cualquier alias.

### P2 — Próxima iteración (mejora la robustez)

**e. Implementar jobs asíncronos**  
`asyncio.Queue` + SSE/WebSocket para que `POST /api/v1/videos` responda inmediatamente con un `job_id` y el cliente haga polling o escuche eventos.

**f. Persistencia de estado de jobs**  
Guardar el estado del job en disco (SQLite con `aiosqlite` o JSON por job_id) para sobrevivir reinicios del servidor.

**g. Probar TikTok end-to-end**  
Crear script equivalente a `test_publisher_tokens.py` para TikTok.

**h. Crear `channels.json`**  
Configuración por canal: playlist, categoryId, privacidad por defecto, tipo de contenido. Separar la configuración del código.

### P3 — Calidad y escalabilidad

**i. Expandir tests**  
Mocks para Gemini, DeepSeek, YouTube API. Tests de contrato para cada adaptador.

**j. Limpiar repositorio**  
- Eliminar `scrape_backgrounds.py` (duplicado de `scrape_anime.py`)
- Mover `docs/descarte/` fuera del repo o a una rama de archivo
- Mover `descargas*/` a un directorio de datos separado

**k. Implementar generación de thumbnails**  
`JobArtifacts.thumbnail_path` ya existe en el modelo. Solo falta el módulo que genere el thumbnail.

---

## 17. Conclusión

Nexa Brief es un sistema **sólidamente diseñado y funcionalmente probado** para su propósito. La arquitectura hexagonal con microkernel es la elección correcta para un dominio que requiere múltiples proveedores externos intercambiables. El código es limpio, tipado con `from __future__ import annotations` en todos los módulos, y con separación de responsabilidades real.

El sistema está **actualmente bloqueado en la capa de publicación** por tres problemas resolubles en menos de 1 hora:
1. Token YouTube expirado → `uv run youtube_auth_once.py`
2. Scope insuficiente → resuelto con el mismo comando anterior
3. Facebook sin autorizar → `facebook_setup.py` por crear

Una vez resueltos estos tres puntos, el pipeline completo (generación + publicación automática en YouTube, TikTok y Facebook) debería funcionar de extremo a extremo.

Las debilidades más importantes (endpoint bloqueante, sin persistencia de jobs) son **operacionales, no arquitectónicas** — el diseño actual soporta agregar estas features sin refactorización mayor.

**Puntuación global actualizada: 7.8 / 10**

| Dimensión | Puntuación | Cambio vs v1.0 |
|-----------|-----------|----------------|
| Diseño arquitectónico | 9/10 | = |
| Calidad del código | 8/10 | = |
| Resiliencia y fallbacks | 8/10 | = |
| Sistema de publicación | 7/10 | ↑ nuevo |
| Seguridad de tokens | 8/10 | ↑ nuevo |
| Testing y cobertura | 4/10 | = |
| Operabilidad (API, jobs) | 5/10 | = |
| Documentación | 8/10 | = |
| Completitud de features | 7/10 | ↑ Stage 9 |

---

*Informe actualizado por Claude Sonnet 4.6 — Análisis completo del repositorio nexa-brief (2026-06-27)*  
*Versión anterior: 1.0 (2026-06-23) — sin Stage 9, sin sistema de publicación*
