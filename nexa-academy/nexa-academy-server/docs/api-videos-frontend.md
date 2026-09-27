# nexa-academy-server — qué hace este servidor y cómo usarlo

Backend FastAPI, arquitectura hexagonal, copiado de `nexa-brief-server` el 2026-09-17 y podado del dominio musical que no aplica acá (ver `nexa-academy/nexa-docs/`, sección de investigaciones, para el detalle de esa poda). Hoy es un motor de generación de video genérico (config-driven templates) al que todavía le falta su dominio propio: `Topic → Scheme → Level → Lesson` (currículo de lecciones, ver `nexa-academy/README.md` para el plan completo). Este doc describe el **estado real actual**, no el plan futuro.

Base URL local: `http://localhost:8000/api/v1` · Swagger: `http://localhost:8000/docs`

## Qué hay hoy

- **Motor de video genérico heredado**, sin dominio de nichos musicales: 4 niches config-driven quedaron (`image_bg_portrait`, `subject_spotlight`, `landscape_scene_ambient`, `motion_backdrop_showcase`) como base de patrón, no como catálogo final.
- **`VoicePort` + `GeminiTTSAdapter`** (`src/adapters/voice/`) — síntesis de voz real vía Gemini, probada con audio real. **Todavía no está conectado al pipeline** (ningún stage llama a `get_voice_ai()` — es la pieza que falta para narrar lecciones, ver Etapa 3 en `nexa-academy/README.md`).
- Publicación a YouTube/TikTok/Facebook heredada tal cual (reutilizable, no se tocó).

## Endpoints principales

| Endpoint | Método | Qué hace |
|---|---|---|
| `/videos` | POST (JSON) | Crea un batch de jobs. Fire-and-forget: responde `202` casi al instante, no espera a que el video termine. |
| `/videos/upload` | POST (multipart) | Igual, pero para subir `image_file`/`video_file` reales en vez de referenciarlos por URL/`asset_id`. |
| `/videos/jobs/{job_id}` | GET | Estado de un job (pollear esto, no esperar la respuesta del POST). |
| `/videos/jobs` | GET | Listado de jobs (Biblioteca). |
| `/niches` | GET | Catálogo de niches válidos para `category_name`, con `supported_engines` (qué motores de render acepta cada uno). |
| `/templates` | GET / `/templates/{id}/preview` | Plantillas config-driven + preview sin grabar. |
| `/library/images`, `/library/videos`, `/library/categories` | GET | Assets ya archivados y reutilizables. **Ya no existe `/library/music`** (se quitó con el dominio musical). |
| `/health` | GET | Healthcheck. |

## `POST /videos` — campos reales (`VideoGenerationRequest`)

| Campo | Tipo | Notas |
|---|---|---|
| `category_name` | string, requerido | Debe matchear un niche de `GET /niches`, si no cae a un default genérico. |
| `quantity` | int, 1-10, default 1 | Videos a generar en el batch. |
| `duration_seconds` | int | Ignorado si se manda `duration_config`. |
| `duration_config` | `DurationConfig \| null` | `mode="auto"`: duración = duración real de un audio resuelto × `repeat_count` — **hoy no hay ningún stage que resuelva ese audio** (el mecanismo quedó pendiente de reconectar a TTS/video real, ver `resource_fetcher.py`). `mode="manual"`: usa `manual_seconds` tal cual. |
| `user_context` | string, máx 500 | Dirección creativa libre. |
| `image_source` | `ImageSource` | `{"type": "auto"\|"library"\|"url", "asset_id", "url", "category"}`. |
| `video_source` | `VideoSource \| null` | Solo para niches con `template.requires_video=True`. Sin `type="auto"` (no hay stock de video). |
| `publishing` | `JobPublishingConfig` | Publicación a redes (opcional, ver niches heredados). |
| `render_target` | `"local"\|"aws"\|null` | Solo aplica si el motor efectivo es `remotion` o `hyperframes`. |
| `recorder_engine_override` | `"remotion"\|"hyperframes"\|"playwright"\|null` | Override del motor — `remotion`/`hyperframes` se rechazan con 400 si el niche no tiene composición portada para ese motor (ver `supported_engines` en `GET /niches`). |

**Ya no existen** (se quitaron con la poda de dominio musical): `music_source`, `song_info` (`song_name`/`artist`/`topic`/`song_description`/`language`).

`POST /videos/upload` tiene los mismos campos como Form fields + `image_file`/`video_file` — sin `music_file`/`music_asset_id`.

## Respuesta — ambos endpoints

`202 Accepted`, **inmediato** (no espera a que el pipeline termine):

```json
{
  "total": 1,
  "jobs": [{ "job_id": "84df12fa", "category": "image_bg_portrait", "stage": "pending" }],
  "status_url_template": "/api/v1/videos/jobs/{job_id}"
}
```

Consultar el progreso real con `GET /videos/jobs/{job_id}` (o WebSocket, ver `src/presentation/api/routers/realtime.py`) hasta que `stage` llegue a un estado terminal (`packaged`, `published`, `failed`).

## Formato de error

- `400`/`401`/`500`: `{"detail": "<string>"}` — mostrar tal cual.
- `422` (validación de schema): `{"detail": [{"loc": [...], "msg": "...", "type": "..."}]}` — iterar y usar `.msg`.
