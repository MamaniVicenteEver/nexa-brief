# Prueba piloto del flujo completo de Academia

Fecha de validación: 2026-09-19

## Alcance

Se validó el primer vertical slice de nexa-academy para crear un curso de inglés A1:

1. Selección de categoría, nivel y perfil del estudiante.
2. Conversación inicial de planificación.
3. Generación de un plan de 10 lecciones.
4. Persistencia del plan en el repositorio JSON.
5. Encolado de las 10 lecciones como una tanda de generación.
6. Generación de tres pilotos de 15 segundos.
7. Síntesis de voz real con Gemini y Novita.
8. Render de video con HyperFrames.
9. Subtítulos y resaltado visual de la línea que se está narrando.
10. Validación de duración, video H.264 y audio AAC.

## Plan y cola

El catálogo se encuentra en:

`nexa-academy/nexa-academy-server/data/academy/catalog.json`

Incluye las categorías `english` y `mathematics`, con niveles, temas, objetivos y blueprints de lecciones.

El plan de inglés A1 genera 10 lecciones. La tanda persistida durante esta prueba es:

- Plan: `plan_57343dd00fe7`
- Tanda: `batch_4f554fc78d7c`
- Elementos en cola: 10
- Pilotos solicitados: 3
- Duración de producción: 900 segundos por lección
- Duración del piloto: 15 segundos por lección

La cola actual es un adaptador JSON reemplazable. La interfaz de dominio no depende de Redis ni de Celery. En una siguiente etapa se puede conectar el mismo puerto a ARQ, Redis o Celery sin modificar la planificación ni la interfaz.

## Videos piloto

Los tres videos se renderizaron con la plantilla `academy-lesson` de HyperFrames y audio real:

| Piloto | Proveedor | Modelo | Duración | Archivo |
|---|---|---|---:|---|
| 1 | Google AI Studio | `gemini-2.5-flash-preview-tts` | 15.000 s | `nexa-academy/nexa-academy-hyperframes/renders/english-01-gemini.mp4` |
| 2 | Novita | MiniMax Speech 2.8 Turbo | 15.000 s | `nexa-academy/nexa-academy-hyperframes/renders/english-02-novita-turbo.mp4` |
| 3 | Novita | Fish Audio S1 | 15.000 s | `nexa-academy/nexa-academy-hyperframes/renders/english-03-novita-fish.mp4` |

Características verificadas en los tres archivos:

- Resolución 1920x1080.
- Video H.264.
- Audio AAC integrado.
- 30 fotogramas por segundo.
- Duración exacta de 15 segundos.
- Sin emojis en textos, interfaz ni plantilla.

## Coste de la síntesis de voz

Estos costes corresponden únicamente al texto corto usado en el piloto, no al coste de una lección completa de 15 minutos:

| Proveedor | Duración del audio fuente | Coste estimado del texto de prueba |
|---|---:|---:|
| Gemini 2.5 Flash TTS | 10.25 s | USD 0.00756 |
| Novita MiniMax Turbo | 6.84 s | USD 0.00534 |
| Novita Fish S1 | 7.65 s | USD 0.00126 |

El audio fuente se encuentra en:

`nexa-academy/nexa-academy-hyperframes/assets/`

## Piloto corregido de 30 segundos

Se generó una nueva prueba con Fish Audio S1, el motor de menor coste del estudio. El audio real dura 26.12 segundos y el video completo dura 30 segundos; los últimos segundos se reservan para el cierre visual.

Archivo final:

`nexa-academy/nexa-academy-hyperframes/renders/english-04-fish-30s.mp4`

La composición separa dos elementos:

- La banda inferior muestra seis segmentos obtenidos por Whisper a partir de la narración final.
- La tarjeta central muestra el contenido que se está leyendo: `HELLO`, `GOOD MORNING` y `GOOD EVENING`, junto con traducción y explicación. Sus ventanas empiezan en las palabras detectadas por Whisper.

### Sincronización medida con Whisper

El audio Fish S1 se transcribió con `faster-whisper large-v3`, CPU `int8` y
`vad_filter=true`. La duración medida fue `26.122 s`, con seis segmentos y
timestamps por palabra. El manifiesto se guardó en:

`nexa-academy/nexa-academy-hyperframes/assets/english-04-fish-30s.transcript.json`

| Segmento | Inicio | Fin | Texto medido |
|---|---:|---:|---|
| 1 | 0.000 | 2.920 | Hoy aprenderás tres saludos básicos en inglés. |
| 2 | 3.300 | 7.460 | Hello significa hola y sirve para saludar en cualquier momento. |
| 3 | 7.800 | 10.640 | Puedes decir, hello, my name is Anna. |
| 4 | 10.880 | 15.000 | Good morning significa buenos días y se usa por la mañana. |
| 5 | 15.440 | 20.080 | Good evening significa buenas tardes o buenas noches cuando llegas. |
| 6 | 20.360 | 25.920 | Escucha cada expresión, repítela con calma y úsala en una frase corta. |

Las tarjetas centrales quedaron enlazadas a estas marcas:

- `HELLO`: `3.300–10.880`;
- `GOOD MORNING`: `10.880–15.440`;
- `GOOD EVENING`: `15.440–26.122`.

La separación entre el final de un segmento y el inicio del siguiente es una
pausa real detectada en el audio. Ya no se adivina el ritmo por longitud del
texto.

La prueba fue revisada en los cambios de cada expresión, en el cierre y en los fotogramas intermedios. HyperFrames confirmó duración de 30 segundos, video H.264, audio AAC, resolución 1920x1080 y ausencia de errores de runtime, layout y contraste.

## Plantilla visual

La plantilla usa una composición educativa profesional con:

- Apertura con nombre de la academia, materia y título de la lección.
- Tarjeta de ruta de aprendizaje.
- Escena central de explicación guiada.
- Subtítulos segmentados.
- Resaltado de la frase activa durante la lectura.
- Cierre con el siguiente paso.
- Variable `audioSrc` para cambiar de proveedor sin modificar la composición.
- Variables para título, descripción, subtítulos, nombre y color de acento.

El archivo fuente es:

`nexa-academy/nexa-academy-hyperframes/index.html`

Se generaron capturas de revisión en:

`nexa-academy/nexa-academy-hyperframes/snapshots/contact-sheet.jpg`

## Resultado técnico

El backend pasó compilación Python y Ruff en los módulos de Academia. La conversación creó una sesión lista para planificar, el catálogo cargó dos categorías y el plan creó 10 lecciones con tres pilotos.

HyperFrames completó los renders individuales y la validación de layout, movimiento y contraste. El comando de comprobación reporta cuatro advertencias de estructura anidada en la composición principal; no impidieron el render ni alteraron la salida. Se pueden eliminar posteriormente separando cada escena en subcomposiciones independientes.

La ejecución batch del CLI dejó el manifiesto en estado parcial en este entorno, por lo que los tres pilotos se renderizaron individualmente y se verificaron con éxito. La cola de Academia sí quedó persistida con las 10 lecciones.

## Puntos que faltan para producción

El piloto demuestra el flujo y deja los límites explícitos. Para completar producción todavía se debe:

1. Conectar el registro de agentes con un adaptador real de DeepSeek o Gemini para investigación, autoría y revisión.
2. Crear el paquete de fuentes y evidencias de cada lección.
3. Sustituir el script determinista por un guion pedagógico revisado.
4. Conectar la cola persistente a un worker real y añadir idempotencia.
5. Generar el audio por lección completa y normalizar volumen.
6. Renderizar los 10 videos de 15 minutos después de aprobar los tres pilotos.
7. Añadir aprobación humana antes de publicar.
8. Migrar la persistencia JSON a una base de datos cuando se requiera concurrencia multiusuario.

Estos puntos están separados del piloto para no presentar como terminada una etapa que aún necesita validación editorial, operativa y de costes.
