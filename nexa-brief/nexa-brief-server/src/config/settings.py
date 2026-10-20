from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# ── Project root (3 levels up: settings.py → config → src → root) ───────────
BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # Root .env owns shared public configuration; server .env keeps API secrets.
        env_file=(BASE_DIR.parent / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── API Keys ──────────────────────────────────────────────────────────────
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    deepseek_api_key: str = Field(default="", alias="DEEPSEEK_API_KEY")
    unsplash_api_key: str = Field(default="", alias="UNSPLASH_API_KEY")
    pexels_api_key: str = Field(default="", alias="PEXELS_API_KEY")
    pixabay_api_key: str = Field(default="", alias="PIXABAY_API_KEY")
    jamendo_api_key: str = Field(default="", alias="JAMENDO_API_KEY")

    # ── AI Models ─────────────────────────────────────────────────────────────
    gemini_model: str = "gemini-3.1-flash-lite-preview"
    deepseek_model: str = "deepseek-v4-flash" # deepseek-v4-pro
    deepseek_base_url: str = "https://api.deepseek.com"

    # ── Lyrics transcription (faster-whisper, nichos lyrics_video_*) ──────────
    # Mismos parámetros ya probados en html-templates-poc/lyric-videos/transcribe.py.
    # large-v3/float32/cpu es lento (varios minutos por canción) pero solo corre
    # UNA vez por canción real gracias al cache por asset_id — ver lyrics_transcriber.py.
    whisper_model: str = "large-v3"
    whisper_device: str = "cpu"          # "cpu" | "cuda"
    whisper_compute_type: str = "float32"  # "float32" (preciso) | "int8" (rápido)
    # Solo para detectar si se canta en español o inglés (ver content_language.py):
    # un modelo chico basta y evita cargar large-v3 en nichos que no transcriben.
    whisper_language_detection_model: str = "small"

    # ── Published metadata (título/descripción/tags) ──────────────────────────
    # Idioma del copy: el de la canción si es español o inglés; si no se puede
    # saber (instrumental, otro idioma, baja confianza) se usa este default.
    metadata_default_language: str = "en"   # "es" | "en"
    # Nichos sin letras: detectar el idioma escuchando la canción con Whisper
    # (usa el mismo modelo de arriba). False = solo usar lo que dio el usuario.
    metadata_detect_audio_language: bool = True
    metadata_language_min_confidence: float = 0.6

    # ── AI Generation ─────────────────────────────────────────────────────────
    ai_max_retries: int = 3
    ai_retry_delay_seconds: float = 2.0
    ai_max_output_tokens: int = 8192

    # ── Video ─────────────────────────────────────────────────────────────────
    video_min_duration_seconds: int = 60    # 1 minute (MVP)
    video_max_duration_seconds: int = 300   # 5 minutes (MVP; later: hours)
    video_width: int = 1920
    video_height: int = 1080
    video_fps: int = 30
    tiktok_clip_duration_seconds: int = 61
    tiktok_fade_in_seconds: float = 1.0
    tiktok_fade_out_seconds: float = 2.0

    # Viewport CSS de referencia para grabar formatos 9:16 con VideoFormat.use_device_viewport=True.
    # 390×844 = iPhone 12/13/14/15 estándar — referencia de diseño responsive más común hoy.
    # Se graba a este viewport (+ un device_scale_factor calculado para alcanzar el ancho final del
    # formato) para que el motor JS del template decida su layout con proporciones reales de celular,
    # en vez de un viewport 1080×1920 que no corresponde a ningún dispositivo real.
    mobile_reference_viewport_width: int = 390
    mobile_reference_viewport_height: int = 844

    # ── Images ────────────────────────────────────────────────────────────────
    max_image_results: int = 10
    image_min_width: int = 1920
    image_min_height: int = 1080

    # ── Music ─────────────────────────────────────────────────────────────────
    max_music_results: int = 10
    # Adapters disponibles: "pixabay", "jamendo", "ytdlp"
    # jamendo requiere una API key válida en JAMENDO_API_KEY (registrarse en jamendo.com)
    # ytdlp como último recurso (copyright variable)
    music_adapter_order: list[str] = Field(default=["pixabay", "jamendo", "ytdlp"])

    # ── API Timeouts ──────────────────────────────────────────────────────────
    api_timeout_seconds: int = 30       # timeout for API search calls
    download_timeout_seconds: int = 120 # timeout for file downloads

    # ── Concurrency ───────────────────────────────────────────────────────────
    max_parallel_jobs: int = 2
    # Límite GLOBAL (todo el servidor, independiente de max_parallel_jobs) de
    # grabaciones Playwright EN VIVO simultáneas — la captura real (Chromium
    # renderizando en tiempo real durante toda la duración del video) es lo más
    # sensible a contención de CPU de todo el pipeline: si el CPU no alcanza
    # para sostener el frame rate en cualquier instante, el trabazo queda
    # grabado permanentemente en el video, sin forma de arreglarlo después. Un
    # encode de FFmpeg u otra grabación corriendo al mismo tiempo compite
    # directo por esos mismos ciclos. Default 1 = nunca dos grabaciones vivas
    # a la vez en todo el servidor; subir solo si el hardware real sostiene más
    # (ver docs/niches-reference.md o hacer un benchmark controlado primero).
    max_concurrent_recordings: int = 1
    # Grabaciones del explainer a la vez. Benchmark 2026-10-11 (4 núcleos): 2 a la vez
    # rinden solo ~16% más que en serie y cada una tarda ~67% más → 1 por defecto.
    explainer_max_concurrent_recordings: int = Field(default=1, alias="EXPLAINER_MAX_CONCURRENT_RECORDINGS")
    # "libx264" (software, comportamiento actual) | "h264_vaapi" (hardware,
    # vía /dev/dri — libera casi toda la CPU durante el encode, dejándola
    # disponible para una grabación concurrente). Requiere que el driver VAAPI
    # esté instalado y el dispositivo exista; no se auto-detecta a propósito
    # (evita fallar silenciosamente distinto según el entorno) — confirmar que
    # funciona en la máquina destino antes de activarlo (ver docs).
    ffmpeg_video_encoder: str = "libx264"
    ffmpeg_vaapi_device: str = "/dev/dri/renderD128"

    # ── Remotion (motor de grabación alternativo, seleccionable por niche vía
    # NicheConfig.recorder_engine — ver src/adapters/recorder/factory.py) ──────
    # Ruta al proyecto Node (nexa-brief-remotion). Ajustar si se mueve/renombra.
    remotion_project_dir: Path = Field(
        default=BASE_DIR.parent / "nexa-brief-remotion", alias="REMOTION_PROJECT_DIR"
    )
    # Docker instala Chromium del sistema. Vacío conserva el navegador que
    # Playwright administra localmente para no alterar el flujo de desarrollo.
    playwright_chromium_executable_path: str = Field(
        default="", alias="PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"
    )
    # Un render de ~4min de video puede tardar 40min–2h+ (benchmarks documentados
    # en el README de nexa-brief-remotion) — muy por encima de cualquier
    # timeout de Playwright/ffmpeg del resto del pipeline. Default generoso (2h).
    remotion_render_timeout_seconds: int = 7200
    remotion_codec: str = "h264"
    remotion_crf: int = 23
    remotion_concurrency: int = 2
    # Límite de renders Remotion simultáneos en todo el servidor — separado de
    # max_concurrent_recordings (ese es para las grabaciones Playwright, mucho
    # más cortas y con otro perfil de CPU/RAM). Default 1: el render Remotion ya
    # satura varios cores por sí solo (ver README de nexa-brief-remotion).
    remotion_max_concurrent_renders: int = 1

    # Dónde corre el motor Remotion: "local" (scripts/render-node.mjs, subproceso
    # en esta misma máquina) | "aws" (scripts/render-lambda.mjs, dispara un render
    # en AWS Lambda y descarga el resultado). Un solo switch global — no por
    # niche — para poder maniobrar entre uno u otro sin tocar código.
    remotion_render_target: str = Field(default="local", alias="REMOTION_RENDER_TARGET")
    # Los siguientes solo aplican si remotion_render_target == "aws". function_name
    # y serve_url los imprime scripts/lambda-deploy.sh (setup de una sola vez,
    # ver nexa-brief-docs/guia_migracion_remotion_lambda.md) — vacíos por defecto
    # a propósito, RemotionAdapter falla explícito si están vacíos en vez de
    # intentar adivinar.
    remotion_aws_region: str = Field(default="us-east-1", alias="REMOTION_AWS_REGION")
    remotion_aws_function_name: str = Field(default="", alias="REMOTION_AWS_FUNCTION_NAME")
    remotion_aws_serve_url: str = Field(default="", alias="REMOTION_AWS_SERVE_URL")
    # Cuántos frames renderiza cada invocación Lambda — divide el total de
    # frames en ese tamaño de chunk, cada uno una invocación paralela (workaround
    # al límite de 900s por invocación de AWS Lambda). 70 reproduce los ~108
    # chunks ya validados en scripts/lambda-deploy.sh para los 7547 frames de
    # NeonLetrasVideo.
    remotion_aws_frames_per_lambda: int = Field(default=70, alias="REMOTION_AWS_FRAMES_PER_LAMBDA")
    # SOLO PARA PRUEBAS: si está seteado, RemotionAdapter trunca la duración real
    # del job a este máximo (en segundos) antes de renderizar — para poder
    # validar que el flujo completo (API → pipeline → Remotion → archivo final)
    # funciona sin esperar 40min-2h en local. None por defecto = desactivado,
    # nunca afecta un job real sin setear esta env var a propósito.
    remotion_debug_max_duration_seconds: int | None = Field(
        default=None, alias="REMOTION_DEBUG_MAX_DURATION_SECONDS"
    )

    # ── HyperFrames (motor de grabación alternativo, seleccionable por niche vía
    # NicheConfig.recorder_engine — ver src/adapters/recorder/factory.py). Hoy
    # ningún niche tiene una composición HyperFrames con contenido dinámico
    # portada (ver docs/investigaciones/cola-aws-y-hyperframes-para-nexa-brief.md,
    # sección 3.3) — el wiring existe, pero HyperframesAdapter.supports_niche()
    # devuelve False para todos hasta que se porte al menos una composición. ──
    # Ruta al proyecto Node (nexa-brief-hyperframes). Ajustar si se mueve/renombra.
    hyperframes_project_dir: Path = Field(
        default=BASE_DIR.parent / "nexa-brief-hyperframes", alias="HYPERFRAMES_PROJECT_DIR"
    )
    # El CLI `hyperframes render` local mide segundos-bajos minutos en los demos
    # del POC (ver README de nexa-brief-hyperframes) — muy por debajo del
    # timeout de Remotion, pero sin benchmark todavía con contenido de
    # producción real. Default conservador, no medido contra un caso real.
    hyperframes_render_timeout_seconds: int = 1800
    # El límite real crece con el video: max(el de arriba, segundos de video × esto). Medido
    # 2026-10-14 en el i3-8100 con 2 workers: Neón (4:16, fondo de video) captura ~3,4 cuadros/s →
    # ~9 s de render por segundo de video; 15 deja margen (antes cortaba a los 30 min a mitad).
    hyperframes_timeout_seconds_per_video_second: float = 15.0
    # Workers de renderizado en paralelo dentro de UN render local (flag -w/--workers
    # del CLI) — no confundir con hyperframes_max_concurrent_renders (cuántos
    # renders simultáneos acepta el servidor).
    hyperframes_workers: int = 2
    hyperframes_quality: str = "high"
    # Límite de renders HyperFrames simultáneos en todo el servidor — mismo
    # motivo que remotion_max_concurrent_renders (separado del semáforo de
    # Playwright).
    hyperframes_max_concurrent_renders: int = 1

    # Dónde corre el motor HyperFrames: "local" (`hyperframes render`, subproceso
    # en esta misma máquina) | "aws" (`hyperframes lambda render`, contra el
    # stack ya desplegado — ver nexa-brief-hyperframes/aws/README.md). Un solo
    # switch global, mismo patrón que remotion_render_target.
    hyperframes_render_target: str = Field(default="local", alias="HYPERFRAMES_RENDER_TARGET")
    # Los siguientes solo aplican si hyperframes_render_target == "aws". El CLI
    # resuelve bucket/state-machine-arn del archivo local
    # .hyperframes/lambda-stack-<stack_name>.json que dejó `hyperframes lambda
    # deploy` — no hace falta repetirlos acá (a diferencia de Remotion, que sí
    # necesita function_name/serve_url explícitos). Stack ya desplegado y
    # probado (ver aws/lambda-deploy.log.txt): stack_name="hyperframes-poc".
    hyperframes_aws_region: str = Field(default="us-east-1", alias="HYPERFRAMES_AWS_REGION")
    hyperframes_aws_stack_name: str = Field(default="", alias="HYPERFRAMES_AWS_STACK_NAME")
    # Nombre del bucket S3 del stack (Outputs de `hyperframes lambda deploy`) —
    # a diferencia de stack_name/region, el CLI no lo necesita (lo resuelve del
    # state file), pero HyperframesAdapter sí, para descargar el resultado con
    # `aws s3 cp` después del render (ver _download_from_s3 en hyperframes_adapter.py).
    hyperframes_aws_bucket: str = Field(default="", alias="HYPERFRAMES_AWS_BUCKET")
    # Igual que remotion_aws_frames_per_lambda, pero en unidad de HyperFrames
    # (tamaño de chunk de frames por invocación) — 240 es el default documentado
    # en el README del proyecto, no un valor medido en este repo.
    hyperframes_aws_chunk_size: int = Field(default=240, alias="HYPERFRAMES_AWS_CHUNK_SIZE")
    hyperframes_aws_max_parallel_chunks: int = Field(default=2, alias="HYPERFRAMES_AWS_MAX_PARALLEL_CHUNKS")

    # ── Paths ─────────────────────────────────────────────────────────────────
    output_dir: Path = BASE_DIR / "output"
    # Toda la persistencia pasa por el DataStore (src/core/data.py). Con
    # DATA_BACKEND=json vive en data_dir; la estructura interna la define
    # src/adapters/data/layout.py — ningún otro módulo arma rutas de data/.
    data_dir: Path = Field(default=BASE_DIR / "data", alias="DATA_DIR")
    data_backend: Literal["json"] = Field(default="json", alias="DATA_BACKEND")
    skills_dir: Path = BASE_DIR / "src" / "skills"
    templates_dir: Path = BASE_DIR / "src" / "templates"

    # ── Background jobs (fire-and-forget generation) ─────────────────────────
    # Techo de cuántos jobs con stage NO terminal (pending...packaged/failed)
    # se aceptan a la vez vía POST /videos/upload — independiente de
    # max_parallel_jobs (que limita paralelismo DENTRO de un batch ya
    # aceptado). Evita aceptar POSTs ilimitados mientras el servidor ya tiene
    # trabajo encolado detrás de los cuellos de botella globales
    # (max_concurrent_recordings, remotion_max_concurrent_renders).
    max_background_jobs: int = 6

    # ── Logging ───────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Orígenes permitidos para llamadas desde el frontend (nexa-brief-web, Next.js
    # dev server). Cubre tanto localhost como 127.0.0.1 porque el navegador trata
    # cada host como un origen distinto para CORS. Incluye 3001 porque en esta
    # máquina el 3000 puede estar ocupado por otro proyecto (nexa-render/web) y
    # Next.js cae automáticamente al siguiente puerto libre.
    cors_allow_origins: list[str] = Field(
        default=[
            "http://localhost:3000", "http://127.0.0.1:3000",
            "http://localhost:3001", "http://127.0.0.1:3001",
        ],
        alias="CORS_ALLOW_ORIGINS",
    )
    # Orígenes extra por patrón, p. ej. la web abierta desde la red de Tailscale:
    # CORS_ALLOW_ORIGIN_REGEX=^http://100\.[0-9.]+:3000$   (vacío = solo la lista de arriba)
    cors_allow_origin_regex: str = Field(default="", alias="CORS_ALLOW_ORIGIN_REGEX")

    # One canonical public origin shared by OAuth callbacks, emails and web redirects.
    public_app_url: str = Field(default="", alias="PUBLIC_APP_URL")

    # ── Social Publisher — Feature Flag ───────────────────────────────────────
    # Set ENABLE_AUTO_PUBLISHING=true to activate Stage 9 in the pipeline.
    # When false (default) the pipeline ends at PACKAGED exactly as before.
    enable_auto_publishing: bool = Field(default=False, alias="ENABLE_AUTO_PUBLISHING")

    # Active account selector: format "platform:alias" (e.g. "tiktok:cuenta_1")
    # Change this single variable to switch between all configured accounts.
    active_account: str = Field(default="tiktok:cuenta_1", alias="ACTIVE_ACCOUNT")

    # ── Social Publisher — Security ───────────────────────────────────────────
    # Fernet key for AES-256 encryption of tokens stored in accounts.json.
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    publisher_encryption_key: str = Field(default="", alias="PUBLISHER_ENCRYPTION_KEY")

    # Path to the accounts.json file that stores encrypted tokens.
    accounts_json_path: Path = Field(
        default=BASE_DIR / "accounts.json",
        alias="ACCOUNTS_JSON_PATH",
    )
    # Copia de accounts.json en base64 para levantar una máquina nueva solo con el .env:
    # si accounts.json no existe, TokenStorage lo crea desde acá. Generar con
    #   base64 -w0 accounts.json
    accounts_json_b64: str = Field(default="", alias="ACCOUNTS_JSON_B64")

    # ── Social Publisher — TikTok OAuth 2.0 ──────────────────────────────────
    tiktok_client_id: str = Field(default="", alias="TIKTOK_CLIENT_ID")
    # Mientras TikTok no audite la app (Content Posting API), solo permite
    # publicar en cuentas PRIVADAS y con privacy_level=SELF_ONLY — cualquier
    # otro valor responde 403 unaudited_client_can_only_post_to_private_accounts.
    # Poner en true recién cuando TikTok apruebe la app.
    tiktok_app_audited: bool = Field(default=False, alias="TIKTOK_APP_AUDITED")
    tiktok_client_secret: str = Field(default="", alias="TIKTOK_CLIENT_SECRET")
    # Account name labels (display only; aliases are defined in accounts.json)
    tiktok_account_1_name: str = Field(default="cuenta_1", alias="TIKTOK_ACCOUNT_1_NAME")
    tiktok_account_2_name: str = Field(default="cuenta_2", alias="TIKTOK_ACCOUNT_2_NAME")

    # ── Social Publisher — YouTube OAuth 2.0 ──────────────────────────────────
    youtube_client_id: str = Field(default="", alias="YOUTUBE_CLIENT_ID")
    youtube_client_secret: str = Field(default="", alias="YOUTUBE_CLIENT_SECRET")
    youtube_account_1_name: str = Field(default="canal_1", alias="YOUTUBE_ACCOUNT_1_NAME")
    youtube_account_2_name: str = Field(default="canal_2", alias="YOUTUBE_ACCOUNT_2_NAME")

    # ── Social Publisher — Facebook OAuth 2.0 ────────────────────────────────
    facebook_client_id: str = Field(default="", alias="FACEBOOK_CLIENT_ID")
    facebook_client_secret: str = Field(default="", alias="FACEBOOK_CLIENT_SECRET")
    facebook_account_1_name: str = Field(default="pagina_1", alias="FACEBOOK_ACCOUNT_1_NAME")
    facebook_account_2_name: str = Field(default="pagina_2", alias="FACEBOOK_ACCOUNT_2_NAME")
    # Shared Graph API version for Facebook Pages and Instagram Graph API.
    meta_graph_api_version: str = Field(default="v26.0", alias="META_GRAPH_API_VERSION")

    # ── Social Publisher — Upload behaviour ──────────────────────────────────
    # Seconds before upload requests time out (videos can be large)
    publisher_upload_timeout_seconds: int = Field(default=300, alias="PUBLISHER_UPLOAD_TIMEOUT_SECONDS")
    # Refresh a token when it expires in less than this many seconds (30 min)
    publisher_token_refresh_margin_seconds: int = Field(
        default=1800, alias="PUBLISHER_TOKEN_REFRESH_MARGIN_SECONDS"
    )
    # YouTube quota guard: daily limit and cost per upload
    youtube_daily_quota_limit: int = Field(default=10000, alias="YOUTUBE_DAILY_QUOTA_LIMIT")
    youtube_quota_cost_per_upload: int = Field(default=1600, alias="YOUTUBE_QUOTA_COST_PER_UPLOAD")
    # Un video público se sube en privado y se hace público recién cuando YouTube terminó de
    # procesar la HD: si sale público antes, los primeros espectadores lo ven en 360p.
    # Pasado el tope de espera se hace público igual (mejor publicado que retenido).
    youtube_wait_for_hd: bool = Field(default=True, alias="YOUTUBE_WAIT_FOR_HD")
    youtube_hd_max_wait_seconds: int = Field(default=2700, alias="YOUTUBE_HD_MAX_WAIT_SECONDS")
    # Sincronización de Canales (src/core/channel_sync.py): cada cuántas horas se releen los
    # videos y totales de todas las cuentas. 0 = solo al conectar y con el botón «Sincronizar».
    channel_sync_interval_hours: int = Field(default=24, alias="CHANNEL_SYNC_INTERVAL_HOURS")

    # ── Compresión antes de publicar — src/modules/video_compressor.py ──────────
    # El render sale a ~30 Mbps (HyperFrames "high" = CRF 15): se recomprime con H.264
    # CRF 18 + tope de bitrate, ~64 % menos peso sin diferencia visible (medido 2026-10-20:
    # 292 → 104 MB, SSIM 0,958, ~1,6× la duración del video). Las redes recomprimen igual.
    video_compress_enabled: bool = Field(default=True, alias="VIDEO_COMPRESS_ENABLED")
    video_compress_crf: int = Field(default=18, alias="VIDEO_COMPRESS_CRF")
    video_compress_preset: str = Field(default="fast", alias="VIDEO_COMPRESS_PRESET")
    video_compress_maxrate_mbps: int = Field(default=12, alias="VIDEO_COMPRESS_MAXRATE_MBPS")
    # Conserva la grabación original como <nombre>.master.mp4 (para volver a comprimir distinto).
    video_compress_keep_master: bool = Field(default=True, alias="VIDEO_COMPRESS_KEEP_MASTER")

    # ── Scheduling (Programación) — src/core/schedule/ ───────────────────────
    # Horarios recurrentes + cola de publicación: colecciones "schedule_slots"
    # y "queue_entries" del DataStore.
    # Cada cuántos segundos corre el tick del scheduler (process_tick): recupera
    # entries atascadas en 'publishing', rellena huecos de auto-fill y publica
    # todo lo que ya venció. 60s es suficiente granularidad para horarios en
    # minutos; el dedup por (slot_id, scheduled_at) hace que re-chequeos sean
    # idempotentes.
    schedule_tick_interval_seconds: int = Field(default=60, alias="SCHEDULE_TICK_INTERVAL_SECONDS")
    # Si está activo, un horario sin video asignado a mano elige automáticamente
    # el job "listo" (stage=packaged) más antiguo que matchee su niche_filter.
    # Si un horario SÍ tiene un video asignado a mano, siempre se respeta esa
    # asignación sin importar este flag — "el modo automático solo rellena huecos".
    schedule_auto_fill_enabled: bool = Field(default=True, alias="SCHEDULE_AUTO_FILL_ENABLED")
    # Piloto automático de las categorías explainer (src/core/automation.py):
    # pregrabar el video listo más antiguo cuando un horario vence dentro de N horas
    # y no hay video grabado para ese canal…
    schedule_prerecord_enabled: bool = Field(default=True, alias="SCHEDULE_PRERECORD_ENABLED")
    schedule_prerecord_hours: int = Field(default=12, alias="SCHEDULE_PRERECORD_HOURS")
    # …y producir con el agente local los ítems del plan semanal guardado cuya
    # fecha cae dentro de las próximas N horas (con grabación automática).
    schedule_autoproduce_enabled: bool = Field(default=True, alias="SCHEDULE_AUTOPRODUCE_ENABLED")
    schedule_autoproduce_hours: int = Field(default=48, alias="SCHEDULE_AUTOPRODUCE_HOURS")

    # ── Voz (src/adapters/voice/) ─────────────────────────────────────────────
    # Rota entre GEMINI_API_KEY, GEMINI_API_KEY1…N. Cadena de modelos = la del
    # explainer-kit (designs/*/design.json → voice.models).
    voice_provider: str = Field(default="gemini", alias="VOICE_PROVIDER")
    gemini_tts_voice: str = "Charon"
    gemini_tts_models: list[str] = Field(
        default=["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-3.1-flash-tts-preview"]
    )
    # Mismo archivo que usa explainer-kit/tools/tts.py: comparten qué clave está agotada.
    gemini_quota_state_path: Path = (
        BASE_DIR / "src" / "templates" / "_tools" / "explainer-kit" / ".state" / "gemini-quota.json"
    )

    # ── Agentes locales (src/adapters/agent/) — Claude Code / Codex ───────────
    # Corren con las suscripciones de esta máquina. Si el binario no está en
    # PATH se busca solo (nvm, ~/.local/bin, app de ChatGPT); se puede fijar acá.
    agent_claude_bin: str = Field(default="", alias="AGENT_CLAUDE_BIN")
    agent_codex_bin: str = Field(default="", alias="AGENT_CODEX_BIN")
    # Modelo y esfuerzo de razonamiento de Codex (vacío = el default de ~/.codex/config.toml).
    # Ej.: AGENT_CODEX_MODEL=gpt-6-luna, AGENT_CODEX_REASONING_EFFORT=xhigh.
    agent_codex_model: str = Field(default="", alias="AGENT_CODEX_MODEL")
    agent_codex_reasoning_effort: str = Field(default="", alias="AGENT_CODEX_REASONING_EFFORT")
    # Producir un video completo (investigar, guion, voz, storyboard) tarda.
    agent_production_timeout_seconds: int = Field(default=5400, alias="AGENT_PRODUCTION_TIMEOUT_SECONDS")
    # Una respuesta de texto/JSON (títulos, plan semanal).
    agent_text_timeout_seconds: int = Field(default=300, alias="AGENT_TEXT_TIMEOUT_SECONDS")

    # ── Explainer (NodeTech, NodeHistory, NodePolitics, NodeEconomy) ──────────
    # Quién escribe títulos/descripciones: "claude" | "codex" (CLI local) | "deepseek" (API).
    explainer_text_provider: str = Field(default="claude", alias="EXPLAINER_TEXT_PROVIDER")
    # Quién escribe los textos de publicación de NodeMotion (Preparar y al grabar): "deepseek" | "gemini".
    copy_ai_provider: str = Field(default="deepseek", alias="COPY_AI_PROVIDER")
    # Idioma de TODOS los textos de publicación de NodeMotion (canciones y promos): el del canal,
    # aunque la canción sea en otro idioma (su nombre se deja tal cual).
    copy_language: str = Field(default="es", alias="COPY_LANGUAGE")
    # Quién produce el video completo con el explainer-kit: "claude" | "codex".
    explainer_agent: str = Field(default="claude", alias="EXPLAINER_AGENT")
    # Quién conversa en el planificador semanal de Programación.
    planner_provider: str = Field(default="deepseek", alias="PLANNER_PROVIDER")


settings = Settings()
