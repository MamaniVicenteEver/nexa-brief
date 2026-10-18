# adapters/data — persistencia intercambiable

Todo lo que el backend guarda (jobs, historial, notificaciones, cola de
publicación, librería de imágenes/música/videos, cachés, canales) pasa por el
**DataStore**. Hoy el backend es JSON dentro de `data/`; cambiar a Supabase,
Postgres, etc. es escribir **un adapter** acá, sin tocar el resto del código.

```
core/ports/data_port.py    contrato: RecordCollection, DocumentStore, FileStorage, DataStore
core/data.py               get_data_store() / collection() / documents() / files()
adapters/data/
  layout.py                nombres lógicos → rutas dentro de data/ (único lugar que las conoce)
  json_store.py            backend JSON (lock por archivo + escritura atómica)
  local_file_storage.py    archivos binarios con su nombre original
  factory.py               elige el backend según DATA_BACKEND
```

## Qué se guarda y dónde (backend JSON)

| Nombre lógico | Tipo | Archivo en `data/` |
|---|---|---|
| `jobs` | colección | `jobs/jobs.json` |
| `history_events` | colección | `jobs/history_events.json` |
| `notifications` | colección | `notifications/notifications.json` |
| `schedule_slots`, `queue_entries` | colección | `schedule/slots.json`, `schedule/queue.json` |
| `image_assets`, `music_assets`, `video_assets` | colección | `library/images.json`, `library/music.json`, `library/videos.json` |
| `template_configs` | colección | `library/template_configs.json` |
| `channels`, `published_videos` | colección | `canales/channels.json`, `canales/published_videos.json` |
| `image_vision`, `video_vision`, `lyrics` | documentos | `library/cache/<nombre>/<asset_id>.json` |
| `template_config_files` | documentos | `library/template_config_files/<job_id>.json` |
| `progress` | documentos | `progress/step_durations.json` |
| `images`, `music`, `videos` | archivos | `library/files/<tipo>/<categoría>/<nombre original>` |

Las carpetas se crean solas la primera vez que se escribe algo.

Fuera del DataStore quedan, a propósito:
- `accounts.json` (tokens OAuth cifrados, en la raíz del server): son
  credenciales, las maneja `adapters/publishing/token_storage.py`.
- `output/<job_id>/`: artefactos de trabajo del pipeline (HTML, mp4,
  logs), no datos de la aplicación.

## Nombres de archivo

`FileStorage.save()` conserva el nombre con el que se subió el archivo
(`Mi Canción - Artista.mp3`). Solo quita caracteres inválidos (`<>:"/\|?*` y
de control) y, si ya existe uno igual en esa categoría, agrega ` (2)`, ` (3)`…
El `asset_id` sigue siendo el identificador estable; el nombre real queda en
`relative_path` y `original_filename` del registro.

## Agregar otro backend (ej. Supabase)

1. Crear `adapters/data/supabase_store.py` con una clase que implemente
   `DataStore` (ver `core/ports/data_port.py`):
   - `collection(name)` → una tabla por nombre lógico (`jobs`, `queue_entries`…),
     PK = el `key_field` que figura en `layout.COLLECTIONS`.
   - `documents(name)` → tabla `key text primary key, body jsonb` (o Storage).
   - `files(name)` → un bucket de Storage; `local_path()` descarga a un caché local
     (ffmpeg, Whisper y los recorders necesitan el archivo en disco).
2. Sumarlo en `factory.py` y en el `Literal` de `settings.data_backend`.
3. Correr `tests/unit/test_data_store.py` contra el backend nuevo: es el
   contrato que cualquier implementación tiene que cumplir.
4. Migrar datos: leer cada colección con el store JSON e insertarla en el nuevo.

Los filtros del contrato son por igualdad; orden y paginación los resuelven los
repositorios. Si una consulta se vuelve lenta, se optimiza dentro del adapter
sin cambiar el contrato.
