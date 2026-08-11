# Grabación de video (Playwright + FFmpeg) — cómo funciona, cómo configurarla

> Referencia técnica del sistema que graba el visualizador HTML y produce los
> `.mp4` finales (desktop 16:9 y móvil 9:16). Documenta las 2 formas de grabar
> que existen hoy, dónde tocar cada configuración, y los bugs reales que se
> encontraron y arreglaron durante su construcción — para no volver a caer en
> los mismos.

---

## 1. Componentes involucrados (mapa de archivos)

| Archivo | Rol |
|---|---|
| `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py` | **El motor.** Toda la lógica de grabación (Playwright) y codificación (FFmpeg) vive acá. |
| `src/core/ports/recorder_port.py` | Contrato abstracto (`RecorderPort`, `RecordingResult`) — el pipeline solo conoce esta interfaz, no la implementación concreta. |
| `src/modules/video_recorder.py` | Stage 6 del pipeline — arma los argumentos y llama a `recorder.record(...)`. No tiene lógica de grabación propia. |
| `src/config/niche_config.py` | Modelo `VideoFormat` — acá se declara CADA formato de salida (id, tamaño, método de grabación) por nicho. |
| `src/config/settings.py` | Constantes globales: viewport de escritorio, viewport móvil de referencia, duración/fades del clip de TikTok. |
| `niches.json` | Configuración real, por nicho — acá se elige qué método (`crop_safe_zone` / `rerecord` / `loop`) y `use_device_viewport` usa cada formato. |
| `src/templates/01-image-bg/index.html` | La plantilla que se graba (config-driven). Su JS decide el layout (texto flanqueando vs. en bandas) según el `innerWidth`/`innerHeight` real del viewport — por eso el viewport de grabación importa tanto. |

---

## 2. Los 2 modos de grabación

Se eligen por `VideoFormat.generation_method` en `niches.json`, **por formato** (cada formato de un mismo nicho puede usar un método distinto).

### 2.1 `"rerecord"` — grabación seguida (completa)

Graba los `duration_seconds` completos, de una sola vez, al viewport propio de ese formato.

```
Playwright abre la página → espera domcontentloaded → warmup 3s
   → graba duration_seconds REALES (ej. 236s de canción = 236s grabando)
   → FFmpeg mezcla con el audio real → archivo final
```

- **Ventaja**: el visualizador se ve en movimiento real durante todo el video, sin repetirse.
- **Desventaja**: escala 1:1 con la duración. Si el nicho graba 16:9 **y** 9:16 con `rerecord`, son DOS pasadas completas — para una canción de ~4 minutos, esto son **~14-20 minutos reales** solo de grabación+encoding (medido en un caso real).
- **Cuándo usarlo**: cuando el contenido necesita variar de verdad en toda su duración (ej. una animación no cíclica), o mientras se prueba/depura un nicho nuevo y conviene ver el resultado real sin aproximaciones.

### 2.2 `"loop"` — grabar un pedazo corto y unir las partes (recomendado, rápido)

Graba solo `loop_seconds` (por defecto **25 segundos**, configurable por formato) UNA vez, y usa FFmpeg para repetir ("unir") ese clip corto en loop duro hasta cubrir la duración real de la canción completa.

```
Playwright graba SOLO loop_seconds (ej. 25s, sin importar si la cancion dura 236s)
   → FFmpeg: -stream_loop -1 -i clip_corto.webm -i song.mp3 -t duration_seconds
   → el clip se repite desde el principio cada loop_seconds, con el audio real completo de fondo
   → archivo final con la duración exacta de la canción
```

- **Ventaja**: tiempo de grabación **constante**, sin importar la duración de la canción (25s en vez de potencialmente 300s). Es el motivo por el que un video que antes tardaba ~20 minutos ahora tarda ~1 minuto.
- **Desventaja**: el visualizador se repite en loop duro cada `loop_seconds` (corte abrupto al reiniciar, no hay transición suave). Aceptable para fondos con movimiento sutil (breathing/drift); no ideal si el movimiento necesita ser distinto todo el tiempo.
- **Cuándo usarlo**: **default recomendado** para producción — es el que usa `image_bg_portrait` hoy.

**Cómo elegir `loop_seconds`**: cuanto más alto, menos notorio el corte del loop pero más tiempo de grabación. 20-30s es un buen punto de partida. `VideoFormat.loop_seconds` acepta de 5 a 120.

```json
// niches.json — ejemplo de un formato en modo "loop"
{
  "id": "youtube",
  "aspect_ratio": "16:9",
  "width": 1920,
  "height": 1080,
  "output_filename": "youtube_video.mp4",
  "crf": 18,
  "preset": "veryfast",
  "generation_method": "loop",
  "loop_seconds": 25
}
```

### 2.3 `"crop_safe_zone"` — legado, sin cambios

El método original (pre-plantillas config-driven): UNA grabación maestra al viewport fijo de escritorio (`settings.video_width`/`video_height`, 1920×1080), y el 9:16 se deriva recortando el centro de esa grabación con FFmpeg — nunca vuelve a abrir el navegador. Es el default si no se especifica `generation_method`, y lo siguen usando los nichos con HTML libre (`ambient_music`, `animated_study`). **No tocar esto para plantillas config-driven** — el crop corta contenido que el layout responsive del template había posicionado pensando en un viewport angosto real (ver sección 4).

---

## 3. Desktop (16:9) vs. Móvil (9:16) — por qué se configuran distinto

### 3.1 Desktop — sin sorpresas

El formato 16:9 casi siempre graba directo a `1920×1080` (o el `width`/`height` que declare el `VideoFormat`) — no necesita nada especial. El motor JS del template, con un viewport ancho, naturalmente usa el layout "flanqueado" (texto a los costados del sujeto).

### 3.2 Móvil — viewport realista (`use_device_viewport`)

**El problema que resolvió esto**: grabar el formato 9:16 directamente a `1080×1920` (la resolución FINAL del video) como si fuera el viewport CSS del navegador es **engañoso** — ningún celular real reporta un `innerWidth` de 1080px. Un iPhone reporta ~390px. Si se graba con 1080 de "viewport", el motor JS del template nunca ve un viewport genuinamente angosto y puede no disparar correctamente el layout "en bandas" (texto arriba/abajo) pensado para pantallas de teléfono.

**La solución — `VideoFormat.use_device_viewport: true`**:

1. Se graba con el viewport CSS **real** de un celular de referencia: `settings.mobile_reference_viewport_width/height` (**390×844** por defecto — iPhone 12/13/14/15 estándar).
2. El motor JS del template decide su layout con esas proporciones REALES, no con una resolución de video disfrazada de viewport.
3. FFmpeg escala (`-vf scale=W:H`) ese clip al ancho final deseado (`VideoFormat.width`, ej. 1080).
4. **No se recorta** a un 9:16 estricto después. El alto final sale de la proporción natural del viewport de referencia escalado (≈ **1080×2338**, ratio ~9:19.5), no de `VideoFormat.height`. Esto es intencional — recortar a 1080×1920 después de escalar cortaba el texto que el layout había posicionado usando el viewport angosto real (bug real, encontrado y confirmado con capturas). TikTok/Reels/YouTube Shorts aceptan bien ese rango de proporciones altas, así que no hace falta forzar el crop.

```json
// niches.json — formato 9:16 con viewport móvil realista
{
  "id": "reels",
  "aspect_ratio": "9:16",
  "width": 1080,
  "height": 2338,
  "output_filename": "reels_video.mp4",
  "crf": 20,
  "preset": "veryfast",
  "generation_method": "loop",
  "loop_seconds": 25,
  "use_device_viewport": true
}
```

> Nota: `height: 2338` en el ejemplo de arriba es meramente informativo/documental para quien lea `niches.json` — con `use_device_viewport: true`, el `height` real del archivo generado sale del cálculo interno (`_device_viewport_plan`), **no** se lee `VideoFormat.height` para este cálculo.

**Para cambiar el celular de referencia** (ej. a un Android más chico, 360×800): editar en `src/config/settings.py`:

```python
mobile_reference_viewport_width: int = 390
mobile_reference_viewport_height: int = 844
```

---

## 4. Por qué hace falta un servidor HTTP local (y no `file://`)

**Bug real encontrado y arreglado**: Chromium **rechaza incondicionalmente** cualquier `fetch()` hacia una URL `file://` — es una restricción dura del propio Fetch API, **no** es CORS. El flag `--disable-web-security` (que sí desactiva CORS) **no evita esto**.

Las plantillas config-driven (ej. `src/templates/01-image-bg/index.html`) cargan su configuración así:

```js
const CONFIG = await fetch("config.json").then(r => r.json());
```

Si Playwright navega directo a `file:///.../index.html`, ese `fetch()` siempre falla (`"URL scheme 'file' is not supported"`), `CONFIG` nunca se resuelve, y la página queda en su estado sin estilos por defecto (fondo blanco de `:root{--bg:#FFFFFF}`, imagen sin escalar a su tamaño intrínseco, sin texto, sin nada de lo que dice `config.json`). Esto pasó desapercibido un tiempo porque, para el formato 9:16, la imagen sin escalar coincidía casi por casualidad con el tamaño del viewport — pero en 16:9 quedó expuesto como un bloque de imagen a la izquierda y todo lo demás en blanco.

**La solución**: `record()` levanta un servidor HTTP local efímero (`_serve_directory`, con `http.server.ThreadingHTTPServer` en un hilo daemon, puerto libre elegido por el SO) sobre `output_dir`, y Playwright navega a `http://127.0.0.1:{puerto}/index.html` en vez de `file://`. Se apaga solo al terminar `record()`.

Esto significa que **cualquier plantilla nueva** que use `fetch()` para cargar su configuración (las próximas `02-...`, `03-...`, etc.) va a funcionar automáticamente sin tener que volver a pelear con esto — el servidor HTTP se levanta para TODAS las grabaciones, no solo para plantillas config-driven.

**Cómo detectarlo si vuelve a pasar**: `_record_at_viewport` engancha `page.on("pageerror", ...)` y `page.on("console", ...)` — cualquier error de JS o de consola durante la grabación queda logueado como `recording_page_error` / `recording_console_error`. Si un video sale "en blanco" o sin estilos, lo primero es revisar esos eventos en el log de esa corrida.

---

## 5. El clip de TikTok (61s) — opcional por nicho

Además de los formatos declarados, el recorder puede generar `tiktok_video.mp4`: un recorte de `settings.tiktok_clip_duration_seconds` (61s) con fade in/out, derivado del video 9:16 ya generado (rápido — es solo un recorte de FFmpeg, no una grabación nueva).

Esto es **opcional por nicho** — `VideoConfig.generate_tiktok_clip` (default `true`, para no romper nichos existentes). Se pone en `false` cuando no tiene sentido tener dos archivos 9:16 casi iguales (el completo y el recorte de 61s) — por ejemplo si el nicho no publica en TikTok.

```json
// niches.json — dentro de "video"
"video": {
  "duration_seconds": 60,
  "formats": [ /* ... */ ],
  "generate_tiktok_clip": false
}
```

---

## 6. Configuración — referencia rápida

| Qué quiero cambiar | Dónde |
|---|---|
| Método de grabación de un formato (`rerecord` / `loop` / `crop_safe_zone`) | `niches.json` → `video.formats[].generation_method` |
| Cuántos segundos graba el modo `loop` antes de repetir | `niches.json` → `video.formats[].loop_seconds` (5-120) |
| Si un formato 9:16 usa viewport de celular realista | `niches.json` → `video.formats[].use_device_viewport` |
| Tamaño del celular de referencia (390×844 por defecto) | `src/config/settings.py` → `mobile_reference_viewport_width/height` |
| Resolución del viewport de escritorio (`crop_safe_zone` / master 16:9) | `src/config/settings.py` → `video_width` / `video_height` |
| Si se genera el clip de TikTok (61s) | `niches.json` → `video.generate_tiktok_clip` |
| Duración/fades del clip de TikTok | `src/config/settings.py` → `tiktok_clip_duration_seconds`, `tiktok_fade_in_seconds`, `tiktok_fade_out_seconds` |
| Calidad/velocidad de codificación (CRF, preset) | `niches.json` → `video.formats[].crf` / `.preset` (preset más rápido = `veryfast`/`superfast`, mismo CRF = misma calidad visual, archivo un poco más grande) |

---

## 7. Historial de bugs reales encontrados (para no repetirlos)

1. **`fetch("config.json")` bajo `file://` siempre falla** (sección 4) — arreglado sirviendo `output_dir` por HTTP local. Si en el futuro alguien "simplifica" volviendo a `html_path.as_uri()`, este bug vuelve.
2. **Grabar 9:16 a 1080×1920 directo como viewport no es realista** — el layout responsive del template nunca ve un viewport angosto de verdad. Arreglado con `use_device_viewport` (sección 3.2).
3. **Recortar el video después de escalar el viewport móvil corta el texto** — el layout posiciona el texto según el viewport real ANTES de saber que se va a recortar. Por eso el modo `use_device_viewport` no recorta, solo escala (sección 3.2).
4. **`generation_method: "rerecord"` en ambos formatos escala mal con canciones largas** — dos grabaciones completas en tiempo real pueden sumar 15-20+ minutos. `"loop"` es la respuesta (sección 2.2).
5. **Playwright no escala la captura de video con `device_scale_factor`** — pedirle un `record_video_size` mayor al viewport solo agrega relleno gris, no escala el contenido. El escalado real se hace con FFmpeg (`-vf scale=...`) después de grabar, nunca confiar en que Playwright lo haga solo.
