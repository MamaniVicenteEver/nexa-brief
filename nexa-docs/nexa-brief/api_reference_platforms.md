# Referencia Técnica de las APIs de Publicación y Optimización de Algoritmo

Este documento valida la exactitud de los flujos de publicación para las plataformas integradas en Nexa Brief y detalla el comportamiento exacto de sus APIs, endpoints, esquemas JSON y recomendaciones estratégicas para maximizar el alcance algorítmico.

---

##  Tabla Comparativa de Endpoints y Requisitos de Publicación

| Formato | Plataforma | Tipo de Subida | Endpoint Principal | OAuth Scopes | Playlist | Relación de Aspecto | Resolución Recomendada | Duración Mín/Máx |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **YouTube Shorts** | YouTube | Resumable / Multipart | `POST /upload/youtube/v3/videos` | `youtube.upload` | `POST /playlists` | `9:16` o `1:1` | `1080x1920` (o `1080x1080`) | `3s - 179s` (Límite: `< 180s`) |
| **YouTube Estándar** | YouTube | Resumable / Multipart | `POST /upload/youtube/v3/videos` | `youtube.upload` | `POST /playlists` | `16:9` | `1920x1080` (o superior) | `> 180s` (Límite: `12h`) |
| **Facebook Reels** | Meta | Resumable en 3 Fases | `POST /{page-id}/video_reels` | `pages_manage_posts`, `pages_show_list` | No disponible | `9:16` | `1080x1920` | `3s - 180s` (Límite: `180min`) |
| **Facebook Estándar** | Meta | Resumable en 3 Fases | `POST /{page-id}/videos` | `pages_manage_posts`, `pages_show_list` | No disponible | `16:9` o `1:1` | `1920x1080` o `1080x1080` | `> 180s` (Límite: `240m`) |
| **TikTok Video** | TikTok | Inicializar + PUT Chunks | `POST /v2/post/publish/video/init/` | `tiktok.developer.direct_post` | No disponible | `9:16` | `1080x1920` | `3s - 180s` (Límite: `30m in asta 1 hora`) |

---

##  Confirmación Técnica: ¿YouTube distingue Shorts de Videos Estándar en la API?

> [!NOTE]
> **Es 100% CORRECTO:** La API de YouTube **NO** tiene un endpoint específico para Shorts. Ambos utilizan exactamente el mismo recurso `youtube.v3.videos.insert` (o la URL de subida `/upload/youtube/v3/videos`).
>
> YouTube clasifica automáticamente un video como **Short** si cumple con dos condiciones físicas en el archivo de video:
>
> 1. **Relación de Aspecto:** Debe ser vertical (`9:16`, ej. $1080 \times 1920$) o estrictamente cuadrada (`1:1`).
> 2. **Duración:** Debe ser menor o igual a **60 segundos** (`<= 60s`).
>
> *Recomendación:* Se aconseja incluir `#Shorts` en el título o descripción para ayudar al motor de indexación rápido, pero la categorización se realiza a nivel del reproductor y algoritmo basándose en las dimensiones del archivo de video.

---

##  Especificación Detallada por Plataforma y Formato

### 1. YouTube Shorts

* **Método:** `POST`
* **URL Completa:** `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status`
* **Headers:**

    ```http
    Authorization: Bearer ACCESS_TOKEN
    Content-Type: multipart/related; boundary=boundary_string
    ```

* **Cuerpo (Payload JSON - Metadata):**

    ```json
    {
      "snippet": {
        "title": "Beat Gym Motivación #Shorts",
        "description": "Sesión rápida de motivación. Música generada con IA por Drova Soft.",
        "tags": ["shorts", "gym", "lofi", "motivation"],
        "categoryId": "22",
        "defaultLanguage": "es"
      },
      "status": {
        "privacyStatus": "public",
        "selfDeclaredMadeForKids": false,
        "embeddable": true,
        "license": "youtube"
      }
    }
    ```

* **Respuesta Exitosa (JSON):**

    ```json
    {
      "kind": "youtube#video",
      "id": "VIDEO_ID_RETORNADO",
      "snippet": { ... },
      "status": { ... }
    }
    ```

* **Ejemplo Curl (Multipart):**

    ```bash
    curl --request POST \
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status" \
      --header "Authorization: Bearer ACCESS_TOKEN" \
      --header "Content-Type: multipart/related; boundary=foo_bar_baz" \
      --data-binary $'--foo_bar_baz\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{\r\n  "snippet": {\r\n    "title": "Beat Gym Motivación #Shorts"\r\n  }\r\n}\r\n--foo_bar_baz\r\nContent-Type: video/mp4\r\n\r\n<CONTENIDO_BINARIO_VIDEO>\r\n--foo_bar_baz--'
    ```

* **Límites:** Peso máximo del archivo: 256 GB o 12 horas (Shorts limitados físicamente a 60 segundos por el reproductor). Costo de cuota de subida: **1,600 unidades** por video.
* **Códigos de Error Comunes:** `400 Bad Request` (Video corrupto), `401 Unauthorized` (Token expirado), `403 Forbidden` (Límite de cuota diaria excedido).

---

### 2. YouTube Video Estándar

* **Método:** `POST`
* **URL Completa:** `https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status`
* **Headers (Fase de Inicialización):**

    ```http
    Authorization: Bearer ACCESS_TOKEN
    Content-Length: METADATA_JSON_LENGTH
    Content-Type: application/json; charset=UTF-8
    X-Upload-Content-Length: VIDEO_FILE_SIZE_BYTES
    X-Upload-Content-Type: video/mp4
    ```

* **Cuerpo de Inicialización (JSON):**

    ```json
    {
      "snippet": {
        "title": "Gym Lofi Beats for Focus & Power",
        "description": "Una hora completa de los mejores beats generativos para entrenar duro.",
        "tags": ["lofi", "gymbeats", "focus", "workout"],
        "categoryId": "10",
        "defaultLanguage": "es"
      },
      "status": {
        "privacyStatus": "public",
        "selfDeclaredMadeForKids": false,
        "license": "youtube"
      }
    }
    ```

* **Respuesta de Inicialización (Headers):**
    Retorna un código HTTP `200 OK` con el Header:

    ```http
    Location: https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=UNIQUE_UPLOAD_ID
    ```

* **Ejemplo Curl (Subida del Archivo al Location recibido):**

    ```bash
    curl --request PUT "URL_DE_LOCATION_RECIBIDA" \
      --header "Authorization: Bearer ACCESS_TOKEN" \
      --header "Content-Type: video/mp4" \
      --header "Content-Length: VIDEO_FILE_SIZE_BYTES" \
      --data-binary "@/ruta/del/video.mp4"
    ```

* **Límites:** Máximo 256 GB.
* **OAuth Scopes:** `https://www.googleapis.com/auth/youtube.upload`.

---

### 3. Facebook Reels

* **Flujo:** Resumable en 3 fases para Páginas de Facebook.

#### Fase 1: Inicialización

* **Método:** `POST`
* **URL Completa:** `https://graph.facebook.com/v21.0/{page-id}/video_reels`
* **Query Params:** `access_token=PAGE_ACCESS_TOKEN&upload_phase=start`
* **Respuesta (JSON):**

    ```json
    {
      "video_id": "724627979033843",
      "upload_url": "https://rupload.facebook.com/video-upload/v21.0/724627979033843"
    }
    ```

#### Fase 2: Subida del Binario

* **Método:** `POST`
* **URL Completa:** URL provista en el campo `upload_url` de la Fase 1.
* **Headers:**

    ```http
    Authorization: OAuth PAGE_ACCESS_TOKEN
    Content-Type: video/mp4
    offset: 0
    file_size: VIDEO_SIZE_IN_BYTES
    ```

* **Cuerpo:** Datos binarios del archivo de video.

#### Fase 3: Publicación (Finish)

* **Método:** `POST`
* **URL Completa:** `https://graph.facebook.com/v21.0/{page-id}/video_reels`
* **Query Params:**
  * `access_token=PAGE_ACCESS_TOKEN`
  * `upload_phase=finish`
  * `video_id=724627979033843`
  * `video_state=PUBLISHED`
  * `description=Descripción del Reel con #hashtags`
* **Respuesta Exitosa:**

    ```json
    {
      "success": true
    }
    ```

* **Límites:** Formato vertical 9:16, duración máxima de 90 segundos.

---

### 4. Facebook Video Tradicional

* **Flujo:** Resumable en 3 fases para videos grandes (`/{page-id}/videos`).

#### Fase 1: Inicialización

* **Método:** `POST`
* **URL Completa:** `https://graph.facebook.com/v21.0/{page-id}/videos`
* **Query Params:**
  * `access_token=PAGE_ACCESS_TOKEN`
  * `upload_phase=start`
  * `file_size=VIDEO_SIZE_IN_BYTES`
* **Respuesta (JSON):**

    ```json
    {
      "upload_session_id": "SESSION_ID",
      "start_offset": "0",
      "end_offset": "1048576"
    }
    ```

#### Fase 2: Transferencia de Chunks

* **Método:** `POST`
* **URL Completa:** `https://graph.facebook.com/v21.0/{page-id}/videos`
* **Query Params / Multipart:**
  * `access_token=PAGE_ACCESS_TOKEN`
  * `upload_phase=transfer`
  * `start_offset=START_OFFSET`
  * `upload_session_id=SESSION_ID`
  * `video_file_chunk=@chunk_binary`
* **Respuesta (JSON):** Retorna el nuevo rango de offsets hasta que todo el archivo es cargado.

#### Fase 3: Finalización

* **Método:** `POST`
* **URL Completa:** `https://graph.facebook.com/v21.0/{page-id}/videos`
* **Query Params:**
  * `access_token=PAGE_ACCESS_TOKEN`
  * `upload_phase=finish`
  * `upload_session_id=SESSION_ID`
  * `title=Beats de Programación`
  * `description=Descripción larga...`
* **Respuesta (JSON):**

    ```json
    {
      "id": "VIDEO_ID_PUBLICADO"
    }
    ```

    *(Nota: Si Meta procesa el video asíncronamente, puede retornar simplemente `{"success": true}`).*

---

### 5. TikTok Direct Post (V2 API)

* **Flujo:** Inicialización mediante POST, carga binaria mediante PUT y verificación de estado.

#### Fase 1: Inicialización

* **Método:** `POST`
* **URL Completa:** `https://open.tiktokapis.com/v2/post/publish/video/init/`
* **Headers:**

    ```http
    Authorization: Bearer USER_ACCESS_TOKEN
    Content-Type: application/json; charset=UTF-8
    ```

* **Cuerpo (JSON):**

    ```json
    {
      "post_info": {
        "title": "Programando a las 3 AM con Lofi Beats  #programmer #coding #lofi",
        "privacy_level": "PUBLIC_TO_EVERYONE",
        "disable_duet": false,
        "disable_comment": false,
        "disable_stitch": false,
        "video_cover_timestamp_ms": 1000
      },
      "source_info": {
        "source": "FILE_UPLOAD",
        "video_size": 120345678,
        "chunk_size": 10485760,
        "total_chunk_count": 12
      }
    }
    ```

* **Respuesta (JSON):**

    ```json
    {
      "data": {
        "publish_id": "v_pub_id.12345...",
        "upload_url": "https://open-upload.tiktokapis.com/video/upload/..."
      },
      "error": {
        "code": "ok",
        "message": ""
      }
    }
    ```

#### Fase 2: Subida del Video (PUT)

* **Método:** `PUT`
* **URL Completa:** URL obtenida en el campo `upload_url`.
* **Headers:**

    ```http
    Content-Type: video/mp4
    Content-Length: CHUNK_SIZE
    Content-Range: bytes START-END/TOTAL_SIZE
    ```

* **Cuerpo:** Datos binarios correspondientes al rango de bytes.

#### Fase 3: Verificación de Estado (Polling)

* **Método:** `POST`
* **URL Completa:** `https://open.tiktokapis.com/v2/post/publish/video/status/`
* **Headers:**

    ```http
    Authorization: Bearer USER_ACCESS_TOKEN
    Content-Type: application/json
    ```

* **Cuerpo (JSON):**

    ```json
    {
      "publish_id": "v_pub_id.12345..."
    }
    ```

* **Límites:** Duración de 3 segundos a 10 minutos. Relación de aspecto 9:16 vertical. Tamaño máximo: 1 GB.

---

##  Organización y Categorización por Plataforma

Las redes sociales poseen capacidades asimétricas para clasificar y organizar contenido mediante listas o colecciones. Esta sección documenta cómo orquestar estas discrepancias a nivel de API.

### Tabla Comparativa de Capacidades de Categorización

| Función | YouTube | Facebook | TikTok |
| :--- | :--- | :--- | :--- |
| **Crear colecciones por API** | Si (Playlists) | No disponible | No disponible |
| **Agregar videos a colección por API** | Si (`playlistItems`) | No disponible | No disponible |
| **Reordenar colecciones por API** | Si | No disponible | No disponible |
| **Organizar Shorts en Colecciones** | Si (Playlists estándar) | No disponible | No disponible |

---

###  Flujo de Organización en YouTube (Completo por API)

En YouTube, puedes automatizar completamente la inserción de tus videos (tanto estándar como Shorts) en listas temáticas desde la API.

#### Paso 1: Crear la Playlist

* **Método:** `POST`
* **URL Completa:** `https://www.googleapis.com/youtube/v3/playlists?part=snippet,status`
* **Headers:**

    ```http
    Authorization: Bearer ACCESS_TOKEN
    Content-Type: application/json
    ```

* **Cuerpo (JSON):**

    ```json
    {
      "snippet": {
        "title": "Música para estudiar",
        "description": "Colección oficial generada por el pipeline de Nexa Brief."
      },
      "status": {
        "privacyStatus": "public"
      }
    }
    ```

* **Respuesta (JSON):**

    ```json
    {
      "kind": "youtube#playlist",
      "id": "PLAbCdEf123_PLAYLIST_ID",
      "snippet": {
        "title": "Música para estudiar"
      }
    }
    ```

#### Paso 2: Agregar el Video a la Playlist

Una vez obtenido el `videoId` del video publicado, se realiza otra petición para vincularlo a la lista.

* **Método:** `POST`
* **URL Completa:** `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet`
* **Headers:**

    ```http
    Authorization: Bearer ACCESS_TOKEN
    Content-Type: application/json
    ```

* **Cuerpo (JSON):**

    ```json
    {
      "snippet": {
        "playlistId": "PLAbCdEf123_PLAYLIST_ID",
        "resourceId": {
          "kind": "youtube#video",
          "videoId": "VIDEO_ID_RECIBIDO"
        }
      }
    }
    ```

* **Respuesta (JSON):**

    ```json
    {
      "kind": "youtube#playlistItem",
      "id": "PLI_ITEM_ID_GENERIC",
      "snippet": {
        "playlistId": "PLAbCdEf123_PLAYLIST_ID"
      }
    }
    ```

---

###  Organización en Facebook

> [!WARNING]
> **Límite de API en Facebook:**
> La Graph API de Facebook **no** cuenta con endpoints públicos que permitan crear listas de reproducción o añadir videos a colecciones de una página. Los videos subidos aparecerán secuencialmente en el muro ("Feed"), en la sección "Videos" o en la pestaña "Reels".

* **Mitigación / Solución en Nexa Brief:**
    Debes apoyarte en la inserción dinámica de hashtags temáticos en la descripción (ej: `#LofiEstudiar`, `#LofiGimnasio`) para permitir a los usuarios agrupar o buscar los videos bajo etiquetas clave dentro de la plataforma.

---

###  Organización en TikTok

> [!WARNING]
> **Límite de API en TikTok:**
> Aunque TikTok soporta la creación de "Listas de reproducción / Colecciones" en los perfiles móviles de algunos creadores, **su API de Desarrolladores no expone esta capacidad**. Todos los videos se publican en orden cronológico inverso en el feed del perfil principal.

* **Mitigación / Solución en Nexa Brief:**
    Al igual que en Facebook, la categorización debe ser externa mediante hashtags específicos incluidos en el campo `title` al inicializar la subida.

---

###  Patrón Arquitectónico para Nexa Brief: Base de Datos Unificada

Para mantener una arquitectura limpia y coherente, la lógica de categorización debe estar centralizada en la **base de datos interna de Nexa Brief** en lugar de depender de la API de cada plataforma:

```text
Categoría Interna (ej: "study_music")
│
├── YouTube     Inserta en Playlist ID: PLAbCdEf123_...
│
├── Facebook    Publica en Muro/Reels y añade hashtags: #StudyMusic #Lofi #Chill
│
└── TikTok      Publica en Feed y añade hashtags: #StudyMusic #Lofi #Chill
```

---

##  Recomendaciones Estratégicas para SEO y Algoritmo

Para asegurar que los videos generados automáticamente por Nexa Brief tengan la mayor tracción posible en los feeds orgánicos, sigue estas directrices de optimización en tus variables de metadatos:

### 1. Títulos de Impacto (Hooks Visuales)

* **YouTube Largo:** Ubica las palabras clave al principio (ej: *"Lofi Beats for Coding [Focus Music]"* en lugar de *"Música relajante lofi para programar de noche"*). Limita los títulos a menos de **70 caracteres** para evitar que se corten en dispositivos móviles.
* **Shorts / Reels / TikTok:** Los primeros 3 segundos deciden la retención. Usa títulos cortos basados en curiosidad o retos (ej: *"Mi rutina de código a las 3 AM "*).

### 2. Estructura de Descripciones de Alto Rendimiento

* **YouTube:** Las **primeras 3 líneas** de la descripción son indexadas fuertemente para SEO y aparecen en los resultados de búsqueda.
  * **Esquema Ideal:**
        1. Resumen directo de 2 líneas rico en palabras clave.
        2. Enlace a la suscripción del canal o a una playlist del mismo canal (retención interna).
        3. Marcas de tiempo / Timestamps (ej. `00:00 - Introducción`, `05:30 - Deep Work Beat`). Esto añade fragmentos enriquecidos a la búsqueda de Google.
* **Reels / TikTok:** El algoritmo valora la concisión. Utiliza textos cortos (máximo 150 caracteres) y dedica el resto del espacio a palabras clave y hashtags.

### 3. Estrategia de Hashtags y Etiquetas (Tags)

* **YouTube:** Las etiquetas clásicas (`tags` en el JSON) ya no tienen un impacto crítico para posicionar videos estándar, pero ayudan a clarificar errores de ortografía de búsqueda. En Shorts, incluye obligatoriamente `#Shorts` en el título.
* **TikTok / Reels:** Los hashtags determinan el nicho exacto de la audiencia (sistema de categorización por intereses).
  * **Fórmula Recomendada:** Use un máximo de 4 a 6 hashtags estructurados así:
    * *2 Broad/Genéricos:* Relacionados con el nicho gigante (ej. `#lofi`, `#coding`).
    * *2 Niche/Específicos:* Ajustados a tu canal (ej. `#loficoding`, `#desksetup`).
    * *1 Trending:* Si aplica a un sonido o tendencia actual de la comunidad.
