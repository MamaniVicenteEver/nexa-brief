# Cara a Cara

Prototipo vertical 9:16 de comparaciones narradas. Muestra: NASA / Unión Soviética, 60 segundos. Preparado para adaptar guiones de 1–4 minutos. No se grabó ni exportó el video final.

## Perfil aprobado de la línea Leo

La versión visual aprobada y la identidad vocal están centralizadas en
`../_pizarra/profiles/leo.json` (`leo-comparaciones-v1`). El motor lo carga al abrir cualquier
video de esta línea: posiciones, tamaños, tipografías, colores, Leo y sus poses. La voz usa
**Puck**, modelo **gemini-3.8-flash-tts**, el mismo texto de dirección vocal y **atempo=0.9**,
conservando el tono. No hay sustitución automática por otra voz o modelo.

`assets/voice-profile.json` es un enlace al perfil compartido, no otra copia. El audio aprobado
`assets/song.mp3` se conserva sin regenerarlo. La hoja maestra de personajes se reutiliza desde
esta plantilla; no duplicarla en cada video. La duración de 60 s pertenece a esta muestra,
no al perfil de todos los videos.

Para otra narración usar `scripts/narrate_leo.py` desde `nexa-brief-server` (ver el README
junto al perfil). El comando lee el JSON y aplica el ritmo; pasar solo `--design` al narrador
original no aplica ese ajuste de ritmo. Transcribir siempre el audio final después de generarlo.

## Ver
Abrir en Sandbox, categoría NodeAction, «Cara a Cara · ¿Quién ganó la carrera espacial?». Vista directa (requiere iniciar sesión en la aplicación):
https://dev-nexa-brief.everdev.space/api/v1/explainer/files/sandbox/nodeaction/cara-a-cara/index.html?controls=1

Para reproducir suelto fuera del visor de la aplicación, omitir controls=1 y pulsar el botón de reproducción. Para revisar un instante: ?t=12. Para otro personaje: ?character=lia (o añadir &character=lia a una URL que ya tenga parámetros).

## Qué se reutilizó
- sandbox/_proto/proto.js: reloj, audio, subtítulos, controles, anclas a palabras y seek de video.
- Motor de pizarra: componente opt-in _pizarra/comparacion.js; no se carga el pizarra.js horizontal ni se copia motor dentro de esta plantilla.
- Adaptador src.adapters.image_gen para hoja de personajes y recorte; fotos de archivo ya existentes en apolo-1202.
- narrate.py y transcribe.py del kit para nueva voz y sincronía, sin cambiar herramientas ni otras voces.

## Cuatro zonas
1. subjects y shots: una o dos tarjetas, foco por narración, logo o foto de cada sujeto.
2. overlays.json: fotos y clips asignados por subject a cada tarjeta; al destacar un hito, la tarjeta se amplía conservando el tiempo del clip.
3. lyrics.json: subtítulos agrupados de tres palabras, vinculados a la narración.
4. avatar: Leo por defecto; Lía intercambiable, ocho poses por personaje.

## Preparar otro short con esta plantilla
1. Escribir el tema y hechos verificados en un BRIEF; guardar fuentes de cada afirmación.
2. Reemplazar assets/script.json, mantener profile_id=leo-comparaciones-v1 y generar voz con scripts/narrate_leo.py; luego transcribir el MP3 final.
3. Cambiar subjects y shots de scene.json; usar anclas de frases únicas, no palabras ambiguas como «pero».
4. Elegir fotos o clips pertinentes, copiar solo los necesarios a assets/media y añadir sus créditos; configurar overlays.json. Las búsquedas y descargas se hacen durante preparación, nunca durante reproducción.
5. El perfil compartido proporciona Leo y sus poses; cambiar solo avatar.timeline por video. Lía queda como alternativa de previsualización, fuera de la identidad vocal aprobada de Leo.
6. Ajustar scene.end, audio y subtítulos a la duración elegida (60–240 s). Verificar en navegador. Grabar únicamente cuando se solicite.

La voz de esta muestra se generó con Puck, no reutiliza audio Node/Charon. Se redujo el ritmo un 10% sin cambiar el tono y se escalaron todos los tiempos de subtítulos; se completó la pista a 60 s con una cola breve.

## Archivos fuente y temporales
assets/avatar/sheet-original.png es la hoja maestra de 16 poses. poses-index.json permite recortar directamente al dibujar, sin guardar 16 PNG duplicados. La hoja blanca conserva bordes más limpios que la salida rembg-u2netp en este diseño blanco. Capturas de revisión limitadas a una hoja resumen y una vista móvil; no hay secuencias de frames.

## Alcance
Es una plantilla de Sandbox lista para revisión, no una nueva integración de búsqueda automática por tema ni un diseño promovido a producción. Los componentes, el guion, la voz y los recursos quedan separados para reutilizarlos.

## Uso medido
El trabajador remoto de voz registró 51.939 tokens combinados, sin desglose. La generación de personajes registró 86.305 de entrada (47.616 en caché), 2.418 de salida y 1.489 de razonamiento informado. Estos registros son parciales y excluyen la coordinación y revisión del líder y el trabajo del componente. La base pizarra-demo no incluye la nueva hoja de personajes y no ofrece un pronóstico comparable para esta tarea. No confundir los campos TTS sin desglose con consumo cero.

## Prueba de medios en ambas columnas

La muestra conserva la voz y el diseño aprobados. Entre 26,57 y 31,72 s muestra el video de
Apolo en la tarjeta de la NASA y una foto de Gagarin en la soviética. Al decir «Apolo», amplía
la tarjeta de la NASA y continúa el mismo clip. Desde «Entonces» vuelve a las dos tarjetas,
ahora con fotos. Consultar el README de `_pizarra/profiles` para preparar otros recursos o
poner dos clips simultáneos. Se reutilizan los medios existentes; no se exportó otro video.

## Biblioteca de componentes

Sandbox muestra la biblioteca de Cara a Cara mediante `info.json → catalog`. `showcase/components.json` documenta las tarjetas, los medios, los textos y las poses de Leo y Lía, con sus parámetros y ubicaciones. `showcase.html` y `showcase-preview.html` dibujan ejemplos usando Proto y `comparacion.js` reales; la escena se ajusta solo en memoria para mostrar cada pose. Las miniaturas están en `showcase/thumbs/`. No se cambia el perfil ni la escena aprobados.

## Crear un personaje

`assets/avatar/crear-personaje.json` es la guía maestra para una IA: estilo, poses, rutas reales, recortes, selección y comprobaciones. La última tarjeta de Personajes muestra una copia de ese JSON y permite copiarla. Después de editar la guía, ejecutar `node showcase/sync-character-guide.mjs` desde esta carpeta para actualizar la tarjeta sin alterar el resto del catálogo. La guía no crea personajes ni modifica el perfil por sí sola.

La pestaña **New componentes** del Showcase presenta la tarjeta con el JSON maestro de instrucciones para crear personajes.

La tarjeta documental reutilizable se declara en `showcase/components.json` con `kind: "json"` y su contenido en `demo`. El Showcase muestra el JSON desplazable y copiable, sin reproductor. Para esta guía el archivo maestro sigue siendo `assets/avatar/crear-personaje.json`; después de editarlo ejecutar `node showcase/sync-character-guide.mjs`.

Las guías JSON de la pestaña **New componentes** cubren crear personaje (`assets/avatar/crear-personaje.json`), cambiar vestuario, crear escena y preparar escenario o fondo (`assets/guides/`). Para actualizar cualquier tarjeta después de editar su JSON maestro, ejecutar `node showcase/sync-character-guide.mjs`. La guía de fondo global documenta una capacidad pendiente; no activa un fondo nuevo.

Las vistas fijas del catálogo declaran `preview.static: true` y usan la miniatura existente: el Showcase las muestra como imágenes sin controles, también al ampliarlas. Los componentes con animación o video conservan el reproductor; no marcar una animación como estática solo porque tenga una miniatura.

La vista de `comparacion.dos-tarjetas` reproduce el JSON de ejemplo de `showcase/components.json`: conserva ambas tarjetas y cambia sus imágenes mediante `shots[].subjects` por id. La galería usa el ejemplo y desactiva los overlays solo en memoria; para escenas reales, un overlay activo puede cubrir la imagen base. Preferir rutas locales de medios y comprobar cualquier URL externa y sus permisos antes de usarla.

La demostración de dos tarjetas en Showcase usa el JSON `demo` del catálogo y un reloj propio. No solicita la configuración, el audio, la letra, los overlays ni la escena del episodio; comparte el motor y el perfil visual para mostrar los mismos marcos. Para un video se colocan los datos deseados en su propio `assets/scene.json`.


## Identidad y ampliación de personajes

Para encargar un personaje nuevo, la entrada para agentes es `assets/avatar/crear-personaje.json`. Contiene la identidad editorial y vocal, el contrato del manifiesto, las rutas y las comprobaciones; `assets/avatar/crear-expresiones.json` explica cómo añadir poses sin reemplazar las existentes. Ambas guías están disponibles como tarjetas JSON en **New componentes**. Las identidades aparecen como tarjetas JSON en Personajes, con muestra de voz y transcripción cuando existen; las muestras pendientes requieren revisión humana.

Por defecto se genera una lámina de 2×2 con cuatro poses, no una imagen por pose. Se admite 4×4 cuando la resolución original y la revisión visual lo permiten: mínimo 512×512 píxeles por celda (1024×1024 para 2×2, 2048×2048 para 4×4), sin ampliar artificialmente. Se miden los recortes sobre cada lámina y se comprueba que conserven calidad y coherencia visual.

Desde esta carpeta, `node showcase/register-character.mjs <id> --check` valida identidad, láminas y manifiesto; `--apply` registra las ocho poses base y sincroniza las tarjetas. Para añadir poses, usar un manifiesto separado y `node showcase/register-character.mjs <id> --check --extend --manifest <archivo.json>`, seguido de `--apply` con las mismas opciones. La validación estructural no reemplaza la revisión visual. `node showcase/sync-character-assets.mjs` reconstruye el catálogo desde el perfil y las identidades; `--refresh` regenera miniaturas existentes. Si se modifica una guía JSON, `node showcase/sync-character-guide.mjs` actualiza sus tarjetas.

El motor conserva el formato anterior de recortes `[x,y,w,h]` sobre la imagen principal y admite también `{src, crop}` por pose para usar nuevas láminas. La ruta `src` es relativa al perfil compartido. No es necesario editar el motor para cada personaje ni expresión.

La pestaña **Personaje** reutiliza el modal de sprites y muestra identidad, voz y una galería desplazable de las poses. `showcase/characters.json` se genera con `node showcase/sync-character-assets.mjs`; al registrar o ampliar un personaje, sus poses se incorporan automáticamente. La galería es opcional para que otros catálogos conserven su modal original.
