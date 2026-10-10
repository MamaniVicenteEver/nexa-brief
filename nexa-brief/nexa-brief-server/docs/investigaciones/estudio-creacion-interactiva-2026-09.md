# Estudio — Creación interactiva (Plantillas) y completa (Crear video)

Fecha: 2026-09-28 · Alcance: `nexa-brief-server` + `nexa-brief-web`

## 1. Objetivo

Dos formas de crear, sobre el mismo motor:

| | **Estudio** (`/plantillas`, modal) | **Crear video** (`/crear-video`) |
|---|---|---|
| Uso | Interactivo: probar, comparar, decidir | Completo: un clic y listo |
| Pasos | 1) **Previsualizar** → 2) **Grabar** | 1) **Generar** (preview + grabado + metadata) |
| Recursos | Elegir / subir / buscar en stock / pedírselos a la IA | Los mismos, o dejar todo a la IA |
| Resultado | Preview en vivo, comparar "Por defecto" vs "Mi versión"; al grabar: video + títulos/descr./hashtags por plataforma | Igual, sin la etapa de revisión |

## 2. Diagnóstico actual

| Pieza | Estado | Problema |
|---|---|---|
| Botón `#rec-btn` en cada plantilla | Duplicado en ~30 `index.html` (los `commercial/` lo copian en `_tools/commercial/build/build.py` desde `lyrics-caution`) | **No funciona**: hace `POST /api/v1/record`, endpoint que **no existe** (muestra "API 404 — evento emitido"). |
| Preview de plantilla | `POST /templates/{id}/preview` corre el pipeline hasta `HTML_GENERATED` (incluye transcripción y config) | Estado **en memoria** (`preview_tracker`): se pierde al reiniciar. "Grabar" crea **otro job desde cero** y repite todo. |
| Librería de recursos | Colecciones `music_assets` / `image_assets` / `video_assets` + caché `lyrics` (DataStore) | Solo lectura por API. No se puede **subir un archivo suelto**, ver/editar la letra, ni buscar. No hay pantalla "Canciones". |
| Stock | Adapters de **imagen** en Pexels, Pixabay, Unsplash | No hay **búsqueda de video** (Pexels y Pixabay sí tienen API de video). No hay endpoint de búsqueda ni de "importar a la librería". |
| Plantillas `commercial/` | 18 medios curados por plantilla (6 videos + 12 fotos) referenciados por id en `scenes` | `static_config: true`: siempre usan sus medios de ejemplo. No hay manera de declarar **qué necesita** cada plantilla ni de reemplazarlos. |
| Metadata (títulos, descripción, hashtags) | `result_summarizer` después de grabar | Bien; solo hay que dispararlo al aprobar el preview. |

## 3. Arquitectura propuesta (desacoplada)

```
                ┌──────────── API (presentation) ────────────┐
 Web  ──►  /templates/{id}/requirements   /library/*   /stock/*   /drafts/*   /media-plans
                └───────────────┬────────────────────────────┘
 core ─ services:  TemplateRequirements · AssetLibrary · Transcription · StockSearch · MediaDirector(IA) · Drafts(pipeline)
 ports:            StockMediaPort · AIPort · DataStore · FileStorage
 adapters:         pexels · pixabay · unsplash · gemini/deepseek · whisper · json-store
```

Cada servicio tiene una sola responsabilidad y se prueba solo:

### 3.1 Contrato de requisitos por plantilla — `inputs` en `templates.json`
Cada plantilla declara qué necesita. La UI arma el formulario a partir de eso
(un formulario genérico; agregar una plantilla ≠ tocar el frontend).

```jsonc
"promo-dynamic": {
  "inputs": {
    "audio":  { "required": false, "lyrics": "optional" },
    "media":  [
      { "slot": "hero",   "kind": "video", "count": 6, "orientation": "landscape", "hint": "acción deportiva" },
      { "slot": "detail", "kind": "image", "count": 12, "hint": "atletas, primer plano" }
    ],
    "texts":  [ { "key": "brand.tag", "label": "Marca", "max": 30 }, { "key": "brand.url", "label": "CTA", "max": 40 } ],
    "brief":  true
  }
}
```
Plantillas de letras: `audio.required: true, lyrics: "auto"`, `media: [{slot: "background", kind: "image|video", count: 1}]`.
Endpoint: `GET /templates/{id}/requirements`.

### 3.2 Librería de recursos ("Canciones", "Imágenes", "Videos")
Sobre las colecciones que ya existen (sin base nueva):
- `POST /library/{kind}` subir suelto (nombre original). Música → dispara **transcripción en segundo plano** y queda con `transcription_status: pending|done|failed`.
- `GET /library/{kind}?q=&category=` búsqueda; `PATCH` nombre/artista/descripción/tags; `DELETE`.
- `GET /library/music/{id}/lyrics` (JSON de Whisper) y `POST .../transcribe` para reintentar.
- Registro de cada canción: nombre, artista, descripción, duración, idioma, URL del archivo, URL del JSON de letra, estado, usos.
- Pantalla nueva **Recursos** con pestañas Canciones / Imágenes / Videos (reproducir, ver letra, editar, subir, borrar). El mismo buscador se reutiliza dentro del sidebar del Estudio.

### 3.3 Búsqueda en stock — `StockMediaPort`
- Adapters normalizados: Pexels (imagen + **video**), Pixabay (imagen + **video**), Unsplash (imagen). Resultado común: `{provider, id, kind, preview_url, download_url, width, height, duration, author, license}`.
- `GET /stock/search?q=&kind=&orientation=&providers=` (paginado, en paralelo, tolerante a que un proveedor falle o no tenga key).
- `POST /stock/import` descarga el elegido → queda en la librería (reutilizable) con crédito/licencia.

### 3.4 Director de medios con IA — `MediaDirector`
Para `commercial/` (y fondos en general): el usuario da un **brief** (texto, referencia, URL de ejemplo o nada). La IA:
1. Lee requisitos de la plantilla + brief (+ descripción de la plantilla si no hay brief).
2. Genera consultas por slot (ej. "basketball dunk slow motion, dark gym").
3. Busca en los 3 proveedores, filtra por orientación/duración, y opcionalmente puntúa con visión.
4. Devuelve un **plan de medios** (slot → candidatos) que el usuario puede aceptar o cambiar uno por uno.
5. Al aceptar, importa todo a la librería y arma el `config.json` del job reemplazando los ids de `scenes`.

`POST /media-plans {template_id, brief, locks}` → job asíncrono con progreso (misma infraestructura que los jobs de video).

### 3.5 Borradores (drafts) — preview que se puede grabar
- El preview pasa a ser un **Draft persistido** (colección `drafts`, sobrevive reinicios): template, inputs (asset ids, textos, brief), estado, Job serializado.
- `POST /drafts` → corre hasta `HTML_GENERATED` (igual que hoy).
- `POST /drafts/{id}/render {engine, publish_targets?}` → **retoma el mismo job** desde donde quedó (sin re-transcribir ni re-diseñar): graba → genera títulos/descr./hashtags por plataforma → empaqueta → aparece en Biblioteca (y publica si se eligió).
- Requiere en `pipeline.run` un `resume_from` que saltee etapas ya hechas (las etapas son secuenciales y el Job lleva sus artefactos: es viable).

## 4. UI propuesta

### 4.1 Modal de plantilla (Estudio)
- Header: `Móvil | Desktop | Por defecto ⇄ Mi versión | … | 🔊 | ⛶ | ☰ | ✕`. El **☰** (junto a la X) abre/cierra el sidebar.
- **Sidebar derecho ~22% (min 300 px)**, pestañas según `requirements`:
  1. **Canción** — buscar en Canciones / subir (muestra "Transcribiendo…" → letra lista) / sin canción.
  2. **Medios** — por slot: elegir de la librería, subir, buscar en stock, o **"Que lo elija la IA"** con un brief.
  3. **Textos** — campos declarados (marca, CTA, título…).
  4. **Grabar** — motor (Remotion / HyperFrames / Playwright según `supported_engines`), destino de publicación opcional.
- Botón principal con estados: **Previsualizar** → (listo) → **Grabar** → progreso → "Ver en Biblioteca".
- Toggle **Por defecto / Mi versión** para comparar el showcase original con el draft.
- El `#rec-btn` desaparece de todas las plantillas (se centraliza acá).

### 4.2 Crear video
Misma sección de recursos, generada desde `requirements` (canción, medios por slot, textos, brief), pero con un solo botón **Generar**: crea el draft y lo graba en cadena.

## 5. Quitar el `#rec-btn` de las plantillas
1. Inmediato: el endpoint de showcase inyecta el estilo que lo oculta **siempre** (hoy solo con `?norec=1`).
2. Limpieza: script que elimina el bloque "Recording UI" (CSS/HTML/JS) de cada `index.html` de `lyrics/`, y quitarlo del generador `_tools/commercial/build/build.py` (regenerar `commercial/`).

## 6. Plan por fases (cada una entregable y útil por sí sola)

| Fase | Contenido | Valor |
|---|---|---|
| **F1 — Recursos** | Librería completa (subir suelto, búsqueda, editar, letra, transcripción en segundo plano) + pantalla **Recursos** (Canciones/Imágenes/Videos) | Reutilizar canciones y fondos sin volver a subir |
| **F2 — Estudio** | Drafts persistidos + `resume_from` + sidebar del modal (Canción / Medios / Grabar) + botón Previsualizar→Grabar + Por defecto⇄Mi versión + quitar `#rec-btn` | Probar una plantilla con tu canción y grabar solo si gusta |
| **F3 — Stock** | `StockMediaPort` (Pexels/Pixabay video+imagen, Unsplash imagen) + búsqueda e importación desde el sidebar | Fondos y medios sin salir de la app |
| **F4 — IA de medios** | `inputs` en `templates.json` para `commercial/` + `MediaDirector` (brief → plan de medios → config) | Comerciales completos a partir de una descripción |
| **F5 — Crear video** | Sección de contenido dinámica desde `requirements` + flujo de un paso sobre drafts | La forma "completa" usa lo mismo que el Estudio |

Recomendación de orden: **F1 → F2** primero (cubren el 80 % del pedido: canción propia, preview, grabar, títulos); luego F3 → F4 → F5.

## 7. Riesgos y decisiones

- **Transcripción**: Whisper local tarda minutos por canción → siempre en segundo plano, con estado visible y caché (ya existe por `asset_id`).
- **Licencias de stock**: guardar autor/licencia/URL original de cada medio importado (Pexels/Pixabay/Unsplash exigen o recomiendan atribución).
- **Cuotas de API**: Pexels 200 req/h, Pixabay 100 req/min, Unsplash 50 req/h (demo). La búsqueda IA debe limitar consultas por slot y cachear resultados.
- **Tamaño de videos de stock**: descargar la variante HD (no 4K) para no inflar `data/`.
- **HyperFrames en plantillas de letras**: sigue sin sincronizar (ver hyperframes-en-nichos…); el selector de motor del sidebar respeta `supported_engines`.
