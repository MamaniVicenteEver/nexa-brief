Antes: [CALIDAD.md](../../../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../../../skills/PLANTILLA-INFORME.md) como `REPORT.md`.

## Específico de esta skill

# Promos NodeMotion

Lee también [el addendum de promos](QUALITY.md), subordinado al estándar común.


## Entrada compartida: plantilla y tema

Para una promo nueva, inicia el chat en la app o usa `chat.py create` como indica
[OPERATE.md](OPERATE.md). El chat, la API y el cliente usan la misma sesión y el
mismo pipeline. La aprobación de la revisión corresponde solo a la persona; la
preparación y la aprobación no graban ni publican. Los prompts centrales se
fijan por versión y hashes; no copies instrucciones editables en el video.

Los comandos `promo.py` descritos más abajo son herramientas técnicas para
inspección y proyectos existentes; no son un segundo flujo automático que
reemplace el chat. La investigación y la revisión visual y de licencias exigen
comprobación humana, incluso cuando `check` indique que pasó la parte técnica.

## Elección por tema y tono

| Plantilla | Cuándo elegirla | Límite a revisar |
|---|---|---|
| Editorial | historia, lugar, marca o equipo con contraste editorial | `VS` requiere oposición real o sustituir la escena |
| Dynamic | marca, evento o lugar con energía y collage | fragmentos `flyer` del ejemplo |
| Kinetic | cualquier tópico con texto como protagonista | sin medios propios en el video |
| Sports | acción intensa de cualquier tema | estética asociada al deporte |
| Trendy | evento, producto o lugar con montaje de imágenes | mosaico requiere seis medios |
| Urban | evento o marca con tono callejero | corredores y símbolos ® fijos |
| Breaking | actualidad, noticia, lanzamiento o anuncio con tono de noticiero | `stat` necesita cifra al inicio; metraje en B/N con tinte rojo |
| Pulse | deporte, entrenamiento, motivación o evento con energía | `counter` necesita número entero; `knockout` pide palabras cortas |

Para buscar en Wikimedia Commons, combiná nombres concretos con categorías: equipos `Category:Association football clubs` y la categoría propia del club; lugares `Category:Cities` y la del lugar; marcas/productos `Category:Companies` y la del producto; eventos `Category:Festivals` y la edición concreta. Verificá cada ficha y sus derechos adicionales. Un logo como gráfico independiente requiere autorización del dueño y `allow_trademarks: true`; usá material propio autorizado registrado en `resources/`. Esa bandera no crea derechos ni incorpora automáticamente el logo al config. Si no hay cifras deportivas, buscá datos geográficos, históricos o de producto adecuados al tema con dos fuentes independientes, una primaria, fecha del dato y de consulta. No inventes cifras ni oposiciones para llenar campos.

## Herramientas técnicas y proyectos anteriores

La CLI implementa `build` para las ocho promos, integración de drafts,
preparación y capturas de comprobación sin grabar ni publicar. La secuencia que
el servicio genera puede diferir del config local: revisá el preview real.
`check` necesita además revisión humana de las capturas; no certifica derechos
representados ni detecta todos los recortes y solapamientos.

`fetch` consulta Wikimedia Commons antes del stock por defecto; admite consultas
de texto y `Category:nombre`. Revisá a tamaño completo las imágenes y sus derechos:
el filtro automático no detecta marcas de agua ni resuelve restricciones
contradictorias o derechos de terceros. `brief.json` admite `allow_trademarks`
y `media_priority`; una marca visible en una fotografía no autoriza convertirla
en gráfico independiente.

No ejecutes dos `fetch` sobre el mismo proyecto. Si una interrupción deja
actividad en `logs/usage.jsonl` o cambia `media-plan.json`, no lo restaures ni
construyas encima: identificá y terminá únicamente el trabajo propio, o esperá
su fin y verificá estabilidad; si no podés identificarlo, informá el bloqueo.
Conservá una copia del plan comprobado fuera del archivo que usa el proceso.

Para una promo nueva, escribí `work/script.json` con `duration_seconds` y
el guion. El campo externo `guion` se conserva por compatibilidad; su esquema
vive en `schemas/script.json`. `music --id ID` lee esa duración, prepara el
recorte y enlaza el audio registrado. Después, `timing --id ID` alinea las
escenas con ataques musicales de 1,4 a 2,4 segundos y genera
`assets/lyrics.json` como JSON de línea de tiempo de la promo
(`metadata.kind: guion`), no como transcripción de la canción. Ese nombre
continúa por compatibilidad con las URLs de los diseños. En un proyecto JSON
NodeMotion, el dato canónico se guarda en `assets/timeline.json` y el resolver
atiende la solicitud legacy `assets/lyrics.json` con ese timeline. No uses
ninguna de esas rutas como caché de letras de música. No hace falta un archivo
Whisper separado para esta promo. Revisá auditivamente el resultado.
`still-clip --help` describe
la conversión de una fotografía registrada en video derivado con encuadre
configurable; revisá el clip y conservá la atribución de la fotografía.

Desde la raíz del repositorio, ejecutá explícitamente en bash (también por SSH) `source scripts/profile-env.sh`
y comprobá `NEXA_PROFILE_DIR` y su `profile.json`. En el servidor:

```bash
cd nexa-brief-server
CLI=src/templates/_tools/nodemotion/promo/tools/promo.py
```

Validá los archivos JSON con la CLI o, desde el servidor, con `.venv/bin/python -m jsonschema -i ARCHIVO src/templates/_tools/nodemotion/promo/production/schemas/ESQUEMA.json`; consultá solo los campos que falle la validación.

La duración vigente del brief y del guion es de 60 a 120 segundos. Comprobala
antes de investigar o buscar medios; el ejemplo original puede durar menos.

1. Consultá en `templates/<template-id>.json` los campos inputs, media_slot_order, scene_cycle, rhythm, script y thumbnail; y en la ficha `DESIGN.md` tipografía, color y composición.
   Prepará un `brief.json` válido según `schemas/brief.json`. Ejemplo:

   ```json
   {"template":"promo-kinetic","topic":"Valparaíso","duration_seconds":60,"tone":"enérgico","language":"es","audience":"viajeros","name":"Valparaíso","texts":{"brand.tag":"VALPARAÍSO"}}
   ```

   Ejecutá `.venv/bin/python "$CLI" new --id ID --brief /ruta/brief.json`.
   El destino es `sandbox/nodemotion/ID` del perfil; reanudar con el mismo brief
   no sobrescribe y uno distinto se rechaza.
2. Contrastá cada dato con al menos dos fuentes independientes, registrando URL,
   fecha del dato y de consulta. Si una fuente solo indica el año, escribí ese
   año como `data_date`, sin inventar mes ni día. Escribí JSON según `schemas/research.json`:

   ```json
   {"topic":"Equipo","findings":[{"claim":"Dato","sources":[{"title":"Fuente A","url":"https://example.org/a","accessed_at":"2026-11-11","data_date":"2020-01-01"},{"title":"Fuente B","url":"https://example.org/b","accessed_at":"2026-11-11","data_date":"2020-01-01"}]}]}
   ```

   Ejecutá `.venv/bin/python "$CLI" research --id ID --input /ruta/research.json`.
   Guarda JSON y Markdown en `work/research/`.
3. Redactá `work/script.json` según `schemas/script.json`: un segmento por
   escena, `lines` por renglón, ciclos completos y audio y guion de 60 a 120 segundos. En proyectos
   anteriores se puede leer `work/guion.json`; no lo uses para nuevas escrituras. Los tiempos
   deben crecer y coincidir con el audio real. Las miniaturas usan los campos
   indicados en la ficha JSON de la plantilla.
4. Escribí `media-plan.json` y ejecutá los comandos de adquisición:

   ```json
   {"items":[{"scene":2,"slot":"city","kind":"video","query":"Barcelona skyline","orientation":"landscape","minimum_duration_seconds":6}]}
   ```

   ```bash
   .venv/bin/python "$CLI" fetch --id ID
   .venv/bin/python "$CLI" music --id ID
   ```

   `fetch` busca recursos con orientación horizontal por defecto y duración mínima
   de la escena (o la indicada, si es mayor), filtra por resolución y licencia,
   registra los medios en la biblioteca del perfil y escribe `asset_id` en cada
   uso. El resumen indica descargas y usos resueltos; un error o uso sin resolver
   impide darlo por terminado. Los originales quedan junto a `resource.json`;
   los videos tienen una versión `hyperframes.mp4` con GOP 5. Repetir reutiliza
   recursos existentes por consulta o URL; si conocés el hash, agregá `sha256`
   al uso para buscarlo antes de descargar. Tras descargar también se comprueba
   el hash. En un registro antiguo sin fecha, `fetched_at` queda en `null`;
   no se inventa. Para fijar un resultado de búsqueda usá `"provider":"pexels"` y
   `"provider_id":"123"` en el uso. `music` prepara «Undaunted» de
   Kevin MacLeod, CC BY 4.0, recortada a la duración de `work/script.json`; en
   proyectos antiguos sin guion se usa como compatibilidad el final de
   `assets/lyrics.json`, que en promos contiene el timeline, no letras musicales. Deja
   `music.json`, archivo de licencia y atribución. Revisá visualmente todos los
   medios: descartá capturas de televisión y marcas de agua. Los escudos en fotos
   reales están permitidos; como gráficos separados, solo con autorización. La selección
   automática no comprueba su contenido visual. Verificá que la licencia y los
   derechos adicionales sean adecuados al uso. Registrá los créditos.
   Para examinar seis fotogramas originales repartidos por el video, ejecutá
   `.venv/bin/python "$CLI" inspect-video --id ID --asset ID_VIDEO` y abrí cada
   PNG a tamaño completo. Para rechazar un video sin borrarlo, usá
   `.venv/bin/python "$CLI" reject-video --asset ID_VIDEO --reason 'motivo'`.
   Para cambiar la búsqueda de un slot antes de `fetch`, ejecutá
   `.venv/bin/python "$CLI" select-media --id ID --slot SLOT --query 'consulta'`.
5. Completá `texts` según `schemas/build-<nombre>.json` y la ficha de la plantilla. Se exigen todos los campos de texto para no heredar rótulos deportivos ajenos al tema (los dos polos de Editorial pueden quedar vacíos si se sustituye `versus`); Sports y Trendy usan `{}`. Ejemplos:

   - Equipo, Editorial: `{"brand.name":"FC Barcelona","brand.round":"IDENTIDAD","brand.left":"TRADICIÓN","brand.right":"CAMBIO","brand.tagline":"UN CLUB Y SU HISTORIA"}` solo si el guion demuestra esa oposición.
   - Lugar, Kinetic: `{"brand.tag":"VALPARAÍSO"}`.
   - Marca, Dynamic: `{"brand.tag":"MARCA EJEMPLO","brand.url":"@MARCA","brand.vertical":"MARCA EJEMPLO"}`.
   - Evento, Urban: `{"brand.tagTop":"FESTIVAL EJEMPLO","brand.tagRight":"EDICIÓN 2026","brand.year":"2026","brand.blurb":"MÚSICA EN LA CIUDAD"}` si los hechos están verificados.

   Editorial dibuja `VS` y usa `A`/`B` si los polos faltan; `nameCut` muestra «BEST» como decoración fija. Si no corresponde, sustituí esas escenas o elegí otra plantilla. Si no hay oposición real, dejá `brand.left` y `brand.right` vacíos, sustituí `versus` por otra escena con `scene-overrides.json` y adaptá el plan; `assemble` omite polos vacíos. Otra opción es elegir otra plantilla. Dynamic incluye fragmentos `flyer` heredados del ejemplo: revisalos y, si no corresponden, copiá la escena en `scene-overrides.json` y cambiá `flyer` por texto pertinente o una cadena vacía. Urban dibuja corredores y símbolos ® fijos: elegila solo si son apropiados. `^` al inicio de línea pinta naranja, `~` contorno; `*` aparece literalmente en el video.

   El plan contiene exactamente un uso por cada pareja escena/slot del ciclo (no uno por cada repetición); un slot repetido conserva el mismo ID. Kinetic usa `{"items":[]}`. Las fichas deben existir en el perfil y contener atribución y licencia. Prepará `music.json` con `asset_id`, `duration_seconds` y `ready_file`; el audio y su ficha deben existir en `resources/music/ID/`. Ejecutá `.venv/bin/python "$CLI" build --id ID`. Valida duración, continuidad y archivo real con `ffprobe`; escribe config, letra y enlaces sin crear un draft. Extrae con `ffmpeg` un fotograma por video para escenas que usan imágenes fijas; conserva los pósteres ya existentes y exige que el video sea decodificable. El orden de medios es el de `media_slot_order`, filtrado a los usados.

   Antes de build revisá la entrada de cada línea del timeline generado. En la
   CLI de compatibilidad, `assets/lyrics.json` sigue siendo el payload temporal
   que solicita `lyricsUrl`; en un proyecto JSON se resuelve desde
   `assets/timeline.json`. No es una transcripción de la música. En promos sin
   voz, las palabras representan renglones: si una frase completa
   aparece demasiado tarde, adelantá sus `words[].start` dentro del mismo
   segmento, conservando orden y límites. No cambies los cortes musicales.
   Verificá lectura a mitad de escena y antes de la transición; no ejecutes
   timing otra vez después del ajuste porque regeneraría esos tiempos.

   Cada hueco se reutiliza en cada vuelta del ciclo: revisá en `media-plan.json` y en `slot_lines` de `check` todas las líneas asociadas. Un hecho concreto, año o persona exige un medio que lo muestre; de otro modo, usá texto genérico del tema. Por ejemplo, una foto de Messi ante Arsenal admite «SIEMPRE BARÇA», pero no el resultado de un Clásico de 2026.
6. Opcionalmente, `scene-overrides.json` modifica escenas de `build`, sin
   modificar la plantilla; `media-plan.json` debe incluir exactamente los slots
   resultantes. En `mediaWord`, `dark: true` usa texto negro sobre un medio
   claro y `dark: false` texto claro; comprobá el contraste del encuadre real. Ejemplo `{"11":{"type":"mediaWord","media":["team-win-2"],"cover":false},"15":{"type":"assemble"}}`.
   Para relatos en pantalla, `mediaWord`, `stack` y `bigNumber` admiten
   `textWidth` entre 0.3 y 0.9 (fracción del ancho del cuadro). Es optativo:
   sin él se conserva la composición original. En `bigNumber` activa centrado
   y un límite vertical para varias líneas. Revisá siempre móvil y horizontal.
   Después de crear un draft con overrides, la CLI sincroniza las escenas validadas
   del build con el config generado de ese draft, conservando los medios y el audio
   que resolvió el servicio. También conserva `brand.tagline`. La huella incluye
   el config adaptado: no reutiliza un draft si cambiaron esas escenas. Comprobá
   el preview efectivo; si reaparece `versus` con polos vacíos o cambia la
   correspondencia de medios, no está listo. No edites el HTML ni el motor. Para exigir mínimos en el preview, escribí por
   ejemplo `quality.json`: `{"min_unique_visual_assets":8,"max_visual_repetitions":2,"rejected_assets":{"ID":"motivo"}}`.
7. Ejecutá `.venv/bin/python "$CLI" draft --id ID`. Registra la pista recortada
   como recurso derivado que referencia el mismo archivo, guarda y compara la
   letra mediante la biblioteca y solicita `POST /drafts` sin `auto_render`.
   Guarda en `draft.json` el ID, ID musical, huella y request. Las claves de
   `template_inputs` son, por ejemplo:

   ```json
   {"media":{"clips":["ID_VIDEO"],"photos":["ID_IMAGEN"]},"texts":{"brand.name":"Equipo","brand.round":"Historia","brand.left":"TRADICIÓN","brand.right":"CAMBIO"},"brief":"Historia de un equipo en español"}
   ```

   Los IDs van en el orden completo de las entradas del config por tipo, no en el orden
   de escenas. Para conservar las posiciones, la CLI rellena los slots no usados
   con el primer recurso disponible del mismo tipo; si no hay ninguno, deja la lista vacía. Si ya existe el mismo draft se reusa; si cambian los inputs o
   letra, la CLI se detiene porque la API actual no actualiza esos campos. No
   sobrescribe la letra de una pista ya asociada a otro guion: si coincide el audio
   pero cambia la letra, registra otro derivado con caché independiente. Comprobá en el
   preview que los archivos recibidos y las escenas sean los esperados.
   Si deben cambiar los inputs de un draft existente, ajustá el brief y el plan,
   ejecutá `build` y después `.venv/bin/python "$CLI" draft --id ID --recreate
   --thumbnail-a 'TEXTO A' --thumbnail-b 'TEXTO B' --frame-time 3.78`.
   `--recreate` sustituye el borrador: no crea una fila adicional llamada V2.
   Si el pedido exige conservar versiones en el sidebar, crea otro proyecto con
   ID y nombre nuevos; no uses `--recreate` sobre el prototipo que se conserva.
   Crea y prepara un draft nuevo, conserva los textos revisados del anterior,
   reconstruye fuentes y créditos, actualiza A/B y borra el anterior solo una vez
   que el nuevo está preparado y sus miniaturas responden. El tiempo indica un
   fotograma del video elegido por la API, que debe revisarse visualmente. Para
   cambiar los textos laterales antes de `build`: `.venv/bin/python "$CLI" set-brand
   --id ID --left 'IZQUIERDA' --right 'DERECHA'`.
8. Ejecutá `.venv/bin/python "$CLI" prepare --id ID`. Espera los textos con
   estrategias activas, incorpora créditos en los detalles y captura A/B con
   `draft_thumbnails.capture_selected` cuando faltan. El endpoint histórico de
   miniaturas solo construye un manifiesto. No se ejecuta `render`. Revisá el
   copy generado y las imágenes: la IA puede inventar contexto o truncar texto.
   En Editorial, si la acción queda tapada en B, se puede cambiar el lado con
   `.venv/bin/python "$CLI" thumbnail-side --id ID --option B --side left`;
   vuelve a capturar las miniaturas y hay que revisarlas nuevamente.
9. Ejecutá `.venv/bin/python "$CLI" check --id ID`. Obtiene preview y miniaturas,
   comprueba estado, letra, licencias, duración, medios de escenas, errores del
   navegador y toma capturas en ambos formatos bajo `work/results/test/`.
   Revisá personalmente las hojas y ambas miniaturas; `ready: true` solo refleja
   las comprobaciones automáticas. Finalmente ejecutá
   `.venv/bin/python "$CLI" usage --id ID` para resumir el ledger local. La
   ausencia de entradas significa consumo desconocido, no consumo cero.
   Para incorporar logs de Codex ya cerrados, repetí `--codex-log /ruta/log`
   en `usage`; el comando evita volver a sumar los que ya están registrados.

El rol de investigación, guion, copy y revisión usa Codex `gpt-6.1-terra` high
según la política vigente; otras asignaciones se leen de `roles.json`. Como
referencia de presupuesto: investigación 8.000, guion 4.000, medios 4.000,
preparación 4.000 y revisión 6.000 tokens; no inventes métricas si el proveedor
no las entrega. Registrá cada llamada y búsqueda externa en `logs/usage.jsonl`
con `schemas/usage-entry.json`; el resumen usa `schemas/usage.json`. El resumen automático no sustituye el informe ni las comprobaciones manuales.

Si un log de Codex informa solo `tokens used`, guardá ese total en
`reported_total_tokens` de la entrada, dejando el desglose desconocido en `null`.
Ese campo se resume por separado y no se suma al desglose. Leé el cierre real del
log: un bloque `tokens used` citado dentro de la salida de una herramienta no es
el total de la sesión que sigue ejecutándose.
