# API de generación de videos — guía para el frontend

Para el equipo/chat que está armando la interfaz gráfica. Cubre los dos endpoints
que disparan generación de video (`POST /api/v1/videos` y `POST /api/v1/videos/upload`),
qué campos son obligatorios/opcionales, la respuesta, y el formato estándar de error.

Base URL local: `http://localhost:8000/api/v1`
Swagger interactivo: `http://localhost:8000/docs`

## Cuál usar desde la interfaz

**Ahora mismo, usar `POST /videos/upload`** (multipart/form-data), no `POST /videos`
(JSON). La razón: la interfaz necesita subir archivos reales de imagen y música desde
la compu del usuario ("Choose file"), y **`POST /videos` no acepta archivos** — solo
acepta referencias (`asset_id` de algo ya archivado, o una `url` externa). Subir un
archivo binario por JSON no es viable sin un paso intermedio (ej. subir primero a un
endpoint de storage y mandar la URL), así que por ahora `/videos/upload` es el único
camino directo para "el usuario elige un archivo de su compu".

`POST /videos` queda para más adelante, cuando haya flujos que no requieran subir un
archivo nuevo cada vez (ej. "generar de nuevo con la misma imagen/canción ya
archivada", o publicación automática — ver el campo `publishing`, que **no existe**
en `/videos/upload`, ahí la publicación siempre queda desactivada).

---

## POST /videos/upload

`multipart/form-data`. Todos los campos van como partes de form, no como JSON.

### Campos de texto/número (Form)

| Campo | Tipo | Obligatorio | Default | Notas |
|---|---|---|---|---|
| `category_name` | string | **Sí** | — | Nombre del nicho/categoría (ej. `lyrics_video_neon`, `image_bg_portrait`). Ver `GET /niches` para la lista completa de valores válidos — no hay un enum fijo en el schema, cualquier string se acepta, pero si no matchea un nicho conocido cae a una configuración por defecto genérica. |
| `quantity` | int | No | `1` | 1 a 10. Cuántos videos generar en el batch. |
| `user_context` | string | No | `null` | Máx. 500 caracteres. Dirección creativa libre (ej. "quiero un ambiente oscuro tipo midnight"). |
| `duration_mode` | string enum | No | `"auto"` | `"auto"` o `"manual"`. Ver tabla de duración abajo. |
| `repeat_count` | int | No | `1` | Solo aplica si `duration_mode="auto"`. 1 a 10. |
| `manual_seconds` | int | No | `null` | Solo aplica si `duration_mode="manual"`. 60 a 300. |
| `song_name` | string | No | `null` | Nombre de la canción, si el usuario lo sabe. |
| `artist` | string | No | `null` | Nombre del artista. |
| `topic` | string | No | `null` | De qué trata la canción. |
| `song_description` | string | No | `null` | Descripción libre adicional de la canción. |
| `language` | string | No | `null` | Código ISO (`"es"`, `"en"`, ...). Solo importa para nichos `lyrics_video_*` (transcripción con whisper). Si se omite, se auto-detecta. |
| `image_file` | file | No* | `null` | Ver abajo. |
| `music_file` | file | No* | `null` | Ver abajo. |
| `video_file` | file | No | `null` | Solo para nichos con `template.requires_video=True` (ej. `motion_backdrop_showcase`). No hay búsqueda automática de video de fondo — si el nicho lo requiere y no se manda, el job falla. |

**\*Importante para la fase actual:** `image_file` y `music_file` son opcionales
*a nivel del schema* (si se omiten, el backend busca algo automáticamente), pero
**para lo que se está construyendo ahora, la interfaz debe mandarlos siempre** —
es la funcionalidad que se quiere exponer al usuario (elegir su propia imagen y
canción), no depender de la búsqueda automática.

### `song_name` / `artist` — por qué conviene pedirlos en el form

Si el usuario no los completa, el backend intenta derivarlos del *nombre del
archivo subido* (limpiando guiones/underscores). Esto es un respaldo débil: nombres
de archivo reales varían mucho entre descargas de la misma canción (ej.
`"4:12 Reproduciendo Dalex - Hola Remix..."` vs `"remix hola"`), lo que puede hacer
que el sistema no reconozca que ya tiene esa canción archivada y la re-procese de
cero (incluye una transcripción de letras que tarda varios minutos). **Pedirle al
usuario `song_name` (y opcionalmente `artist`) en la interfaz, aunque sea opcional,
mejora bastante la detección de duplicados.** No es bloqueante — el sistema también
compara por contenido del archivo como respaldo — pero ayuda.

### Duración del video

| `duration_mode` | Campo relevante | Cómo se calcula |
|---|---|---|
| `"auto"` (default) | `repeat_count` | Duración final = duración REAL de la música subida/encontrada × `repeat_count`. Con `repeat_count=1` (default), la duración es exactamente la de la canción. |
| `"manual"` | `manual_seconds` | Duración final = `manual_seconds` exacto (60-300s), sin importar la duración real de la música. |

### Archivos (File)

- `image_file`: imagen de fondo. Formatos típicos: jpg/png. Si se omite, se busca
  automáticamente (stock/IA según el nicho).
- `music_file`: canción/audio (mp3). Si se omite, se busca automáticamente.
- `video_file`: video de fondo, solo si el nicho lo requiere.

Los tres, si se mandan, quedan archivados permanentemente en la librería del
servidor (`data/image_library/`, `data/music_library/`, `data/video_library/`) para
poder reusarse en videos futuros sin volver a subirlos — la interfaz no necesita
hacer nada especial para esto, es automático.

### Ejemplo de request (curl, para referencia)

```bash
curl -X POST 'http://localhost:8000/api/v1/videos/upload' \
  -F 'category_name=lyrics_video_neon' \
  -F 'duration_mode=auto' \
  -F 'song_name=Hola Remix' \
  -F 'artist=Dalex' \
  -F 'image_file=@bg.jpg;type=image/jpeg' \
  -F 'music_file=@song.mp3;type=audio/mpeg'
```

---

## POST /videos (JSON) — referencia, no es el que se usa ahora

Body `application/json`, schema `VideoGenerationRequest`:

| Campo | Tipo | Obligatorio | Default |
|---|---|---|---|
| `category_name` | string | **Sí** | — |
| `quantity` | int | No | `1` (1-10) |
| `duration_seconds` | int | No | valor de config del servidor | Ignorado si se manda `duration_config`. |
| `duration_config` | objeto `DurationConfig` o `null` | No | `null` | Mismo concepto que `duration_mode`/`repeat_count`/`manual_seconds` del form. |
| `user_context` | string o `null` | No | `null` | Máx. 500 caracteres. |
| `image_source` | objeto `ImageSource` | No | `{"type": "auto"}` | Ver abajo. |
| `music_source` | objeto `MusicSource` | No | `{"type": "auto"}` | Ver abajo. |
| `video_source` | objeto `VideoSource` o `null` | No | `null` | Ver abajo. |
| `song_info` | objeto `SongInfo` o `null` | No | `null` | Equivalente a `song_name`/`artist`/`topic`/`song_description`/`language` del form. |
| `publishing` | objeto `JobPublishingConfig` | No | `{"enabled": false, ...}` | **Solo existe en este endpoint**, no en `/videos/upload`. |

### `DurationConfig`

```json
{ "mode": "auto" | "manual", "repeat_count": 1, "manual_seconds": null }
```
- `mode` default: `"manual"` (¡ojo, distinto default que el form, que es `"auto"`!).
- `repeat_count`: 1-10, solo para `mode="auto"`.
- `manual_seconds`: 60-300, solo para `mode="manual"`.

### `ImageSource` / `MusicSource`

```json
{ "type": "auto" | "library" | "url", "asset_id": null, "url": null, "category": null }
```
- `type="auto"` (default): el sistema busca automáticamente. No requiere nada más.
- `type="library"`: reusa un asset ya archivado — **requiere `asset_id`** (ej. el
  que devuelve `GET /library/images` o `GET /library/music`).
- `type="url"`: descarga directo de una URL — **requiere `url`**.
- Si falta el campo requerido para el `type` elegido, el request falla con 422
  (ver sección de errores).

### `VideoSource`

Igual a los anteriores, pero **no existe `type="auto"`** (no hay proveedor de
stock de video integrado) — mandarlo da 422. Usar `"library"` o `"url"`.

### `SongInfo`

```json
{
  "song_name": null, "artist": null, "topic": null,
  "description": null, "extra_notes": null, "language": null
}
```
Todos opcionales, todos string o `null`.

### `JobPublishingConfig`

```json
{
  "enabled": false,
  "accounts": [],
  "options": {
    "youtube_playlist_id": null,
    "youtube_publish_as_short": false,
    "facebook_publish_as_reel": true,
    "tiktok_privacy": "private"
  }
}
```
Si `enabled=true`, `accounts` es una lista de strings `"plataforma:alias"` (ej.
`"youtube:mi_canal"`) que deben existir ya configurados en `accounts.json` del
servidor — la interfaz no crea cuentas nuevas, solo referencia cuentas ya
autorizadas. No relevante para la fase actual (no se usa desde `/videos/upload`).

---

## Respuesta — ambos endpoints

`202 Accepted`. **La respuesta llega solo cuando el batch entero termina** — no es
un job asíncrono con polling, el HTTP request queda abierto todo el tiempo que tarde
el pipeline (puede ser varios minutos, sobre todo si hay que transcribir letras con
whisper). La interfaz debe manejar esto con un timeout largo y mostrar un estado de
"procesando" mientras espera.

```json
{
  "total": 1,
  "succeeded": 1,
  "failed": 0,
  "elapsed_seconds": 144.37,
  "jobs": [
    {
      "job_id": "84df12fa",
      "stage": "packaged",
      "category": "lyrics_video_neon",
      "output_dir": "/ruta/absoluta/en/el/servidor/output/84df12fa",
      "errors": []
    }
  ]
}
```

- `total` / `succeeded` / `failed`: conteos del batch (si `quantity > 1`, puede
  haber jobs individuales fallidos dentro de un batch que igual devuelve 202).
- `stage`: si el job llegó a `"packaged"`, terminó bien. Si quedó en cualquier otro
  valor (ej. `"resources_fetched"`, `"failed"`), no se completó — revisar `errors`.
- `output_dir`: carpeta en el servidor con los archivos generados (`youtube_video.mp4`,
  `reels_video.mp4`, `bg.jpg`, `song.mp3`, etc.). La interfaz necesita un endpoint de
  descarga/estático para servir estos archivos al navegador — **hoy no existe uno
  dedicado**, hay que resolverlo aparte (fuera del alcance de este doc).
- `errors`: lista de strings con errores del job puntual (vacía si `failed=0` para ese job).

Un batch puede devolver `succeeded=0` a nivel de jobs individuales y aun así el HTTP
status ser 202 — **revisar siempre `failed` y `errors` en el body, el código HTTP
202 por sí solo no garantiza éxito del contenido.**

---

## Formato de error — estándar a seguir en el frontend

No hay un formato de error personalizado global: es el default de FastAPI/Pydantic.
Hay **dos formas posibles**, según el tipo de falla:

### 1. Error de negocio (validaciones explícitas del código) — `detail` es un string

Status codes usados: `400` (input inválido / asset no encontrado / cuenta de
publicación mal configurada), `401` (token de publicación inválido/expirado), `500`
(error interno no controlado, incluye cualquier excepción del pipeline).

```json
{ "detail": "image_source.asset_id not found: Image asset_id 'xxxx' not found in the local library." }
```

**Regla para el frontend:** si `typeof body.detail === "string"`, mostrar ese
string directamente (o parsearlo si se quiere extraer más contexto — no tiene un
formato interno más estructurado, es texto libre pensado para humanos).

### 2. Error de validación de schema (Pydantic/FastAPI) — `detail` es un array

Status code: `422 Unprocessable Entity`. Pasa cuando falta un campo obligatorio, un
tipo no matchea, o un `model_validator` del schema rechaza la combinación de campos
(ej. mandar `image_source.type="library"` sin `asset_id`).

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["body", "category_name"],
      "msg": "Field required",
      "input": { "quantity": 1 }
    },
    {
      "type": "value_error",
      "loc": ["body", "image_source"],
      "msg": "Value error, image_source.asset_id is required when type='library'",
      "input": { "type": "library", "asset_id": null, "url": null, "category": null }
    }
  ]
}
```

**Regla para el frontend:** si `Array.isArray(body.detail)`, iterar cada elemento:
- `loc`: ruta del campo con el problema (`["body", "nombre_del_campo"]`, a veces
  anidado más profundo para objetos como `image_source`).
- `msg`: mensaje humano-legible del problema — usar este para mostrarle al usuario
  qué corregir.
- `type`: código corto de la categoría de error (`"missing"`, `"value_error"`,
  `"int_parsing"`, etc.) — útil para lógica programática, no para mostrar al usuario.

### Resumen para el frontend

```
status 202           -> éxito HTTP, pero revisar body.failed / body.jobs[].errors
status 400 / 401 / 500 -> body.detail es STRING -> mostrar tal cual
status 422            -> body.detail es ARRAY   -> iterar y usar cada .msg
```

Un cliente HTTP robusto en la interfaz debería chequear el status code primero y
ramificar según si es 422 (array) o cualquier otro código de error (string) antes de
intentar leer `detail` como texto.

---

## Endpoints auxiliares útiles para la interfaz

- `GET /niches` — lista de categorías/nichos válidos para `category_name` (con su
  configuración: si requiere letras, si requiere video de fondo, etc.).
- `GET /library/images`, `GET /library/music`, `GET /library/videos` — listar
  assets ya archivados (útil para un selector "usar algo que ya subiste antes" a
  futuro, vía `image_source.type="library"` / `music_source.type="library"`).
- `GET /library/categories` — categorías de librería disponibles.
- `GET /health` — healthcheck simple del backend.
