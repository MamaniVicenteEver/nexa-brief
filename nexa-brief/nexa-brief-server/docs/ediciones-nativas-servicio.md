# Servicio de ediciones nativas

El servicio habilita las identidades de rough para EN y PT sin reescribir los archivos del original. La web usa el contrato de localizaciones; no necesita conocer las rutas físicas de las revisiones.

## Uso

Con la API existente y el perfil correcto ya seleccionados:

~~~sh
curl -X POST "$API_URL/api/v1/explainer/videos/$VIDEO_ID/localizations" \
  -H 'Content-Type: application/json' -d '{"locale":"en-US"}'
~~~

Devuelve 202 con job_id. También admite pt-BR y los aliases en/pt. El original es es-419 y no se regenera desde este endpoint. Conserva los encabezados de autenticación habituales de tu instalación.

- GET /api/v1/explainer/localization-jobs/{job_id}: status, stage, percent, error y revision.
- GET /api/v1/explainer/videos/{video_id}/localizations: original y mercados soportados; preview_url, revisión, progreso y publicación por plataforma.
- 409: ya existe un trabajo activo para ese video e idioma, incluso si otra instancia del servicio lo inició.
- 422: idioma/diseño no soportado, perfil no autorizado o configuración inválida.
- 404: video o trabajo inexistente.

La API programa trabajo en segundo plano; POST no espera a la generación. El apagado cancela tareas y espera la salida de sus subprocesos. Al admitir otro trabajo, un registro activo cuyo ejecutor ya no posee su lease se marca interrumpido.

## Etapas y responsabilidades

El trabajo pasa por prepare (0), extract (8), agent (18), voice (38), transcribe (54), outro (66), scenes (78), publish (88), activate (96) y done (100). El presupuesto global de productores limita la concurrencia; la voz y los comandos pesados también usan el presupuesto del kit. La transcripción y la generación del cierre comparten la cola de trabajo pesado de la API; el lease del kit serializa sus procesos entre workers.

El host extrae la tabla mediante localizable.json, conserva IDs y metadatos de segmento y calcula los cues con la letra original. Las fichas de PLAN y BRIEF se seleccionan por código y suman como máximo 5000 palabras. La tabla lleva un hash estable.

edition_lead usa la factoría existente: Codex, gpt-6.1-terra, xhigh. No se amplían ni se cambian las políticas verificadas del ejecutor. El staging del host vive en .system/runtime/localization/{job}/; el workspace temporal del agente está en work/localization/{job}/ dentro de esa producción, porque el ejecutor verificado admite producción/sandbox. Este workspace contiene únicamente el prompt, la tabla, la historia, identidad, estrategias y esquema; se elimina al terminar la ejecución.

El agente escribe el guion por segmento, notas de interpretación, textos visibles, frases disparadoras y publicación. El host valida el esquema, claves, límites, destacados, cifras, nombres protegidos, IDs, frases y capítulos. Ante JSON/textos inválidos hay como máximo una reparación: una ejecución nueva que recibe únicamente las claves con error y su contexto acotado. Una reparación no puede modificar otras claves.

Las herramientas leen la edición maestra congelada. edition_job.py invoca narrate.py, transcribe.py y outro.py con --edition; mantiene el presupuesto de preparación existente. NEXA_PRODUCTION_DIR identifica la producción y NEXA_EDITION_STAGING_DIR redirige los archivos de esa revisión al staging. Las rutas públicas congeladas permanecen relativas a la producción y no se reescriben al activar.

Whisper usa el código del idioma. transcript-raw.json se conserva antes de las correcciones del guion; alignment.json contiene índices de palabras (fin exclusivo) y segundos por segmento. review.json registra las discrepancias crudas, correcciones, respaldo proporcional de cues, identidad draft y observaciones. Una discrepancia cruda deja la edición activa con status needs_review.

Los tiempos semánticos se buscan únicamente en el rango del segmento. Una frase ausente o repetida usa la proporción de origen y deja un aviso. Los tiempos absolutos distintos de cero usan también esa proporción. t=0 se conserva. Se comprueban orden por capa, cobertura, mínimos, duración real del audio con ffprobe y duración/stream de los clips compartidos. No se copian los medios.

Los capítulos y sus líneas en la descripción se recalculan con la alineación nueva. publish del GET mantiene las claves youtube, instagram, facebook y tiktok; el título de cada edición es youtube.title. El original se adapta desde su publish.json existente.

## Activación y vista previa

Una revisión válida pasa a languages/{locale}/revisions/rev-NNN/. El servicio registra su identidad y revisión mediante DataPort y cambia active.json al final. Un error conserva el puntero anterior; los archivos de diagnóstico quedan en staging o en una revisión inactiva si el fallo ocurre durante la activación.

preview_url es la URL original del episodio más edition={locale}. loader.js pide assets/config.json?edition=... y la API resuelve el config de la revisión activa dentro del perfil autorizado. Audio, letra y storyboard usan las rutas de esa revisión; los componentes y medios se comparten con el original. Si falta la edición, el reproductor falla explícitamente en lugar de mostrar el original como si fuera esa edición. Sin parámetro se conserva la carga original.

Solo los archivos públicos de reproducción y publicación de una revisión son servibles. Prompt, uso, edición maestra, guion, transcripción cruda y logs no se exponen mediante /explainer/files.

## Alcance de la verificación

Las pruebas del servicio usan una copia temporal del demo autorizado, un agente falso, MP3 de silencio y transcripción falsa. Comprueban contratos y recorrido técnico; no certifican la calidad editorial ni las voces candidatas. La prueba de navegador intercepta las solicitudes mediante TestClient, sin abrir un servidor ni consultar fuentes externas.

La selección del perfil y los ejecutores verificados, suscripción de Codex, claves Gemini, ffmpeg/ffprobe y Whisper instalado son requisitos para una ejecución real. No se cambia el estado draft de una identidad por aprobar estas pruebas.

Miniaturas por idioma: pendientes. El capturador actual usa especificaciones de componentes derivadas del paquete original y sus cachés, no la vista previa de una edición; requiere una integración separada para no alterar el original.

Grabación por idioma: pendiente. El grabador actual toma catálogo/audio/publicación del original y comparte sus destinos de salida. El endpoint de grabación no implementa selección por locale; no debe usarse para grabar una edición. Esta tarea no graba ni publica videos.

