# Nexa Academy: plan integral de la fábrica educativa

Fecha: 2026-09-19

## 1. Objetivo de la primera versión

Academy debe permitir conversar sobre una materia, aprobar un nivel, generar
un plan de diez lecciones, separar el contenido pedagógico del trabajo
audiovisual, encolar las lecciones y producir un piloto de tres videos de
quince segundos antes de escalar a clases completas.

La primera materia es inglés. Matemática ya existe como segunda categoría del
catálogo para comprobar que el dominio no quedó acoplado a un solo tema.

La duración real de una lección queda configurada en 900 segundos como
referencia inicial. El piloto usa 15 segundos y no cambia el contrato de la
lección: solo reemplaza la duración de render durante la validación.

## 2. Flujo completo

```text
planificación conversada
  -> materia y nivel
  -> perfil, objetivo y restricciones
  -> plan curricular versionado
  -> aprobación humana
  -> especificaciones de lecciones
  -> verificación pedagógica
  -> dirección visual y plantilla
  -> selección de proveedor y voz
  -> audio con VoicePort
  -> escenas, subtítulos y resaltado de lectura
  -> cola persistente
  -> piloto de 3 videos de 15 segundos
  -> revisión manual y QA automático
  -> publicación del piloto
  -> métricas
  -> continuar, ajustar o pausar
```

El plan y la cola ya están expuestos por API en el servidor:

- `GET /api/v1/academy/catalog`
- `GET /api/v1/academy/agents`
- `POST /api/v1/academy/sessions`
- `POST /api/v1/academy/sessions/{id}/messages`
- `POST /api/v1/academy/plans`
- `POST /api/v1/academy/plans/{id}/queue`
- `GET /api/v1/academy/batches/{id}`

La pantalla `/academia` del frontend consume esta API y presenta la conversación,
el formulario de plan y las diez lecciones ordenadas.

## 3. Contrato JSON de categorías

La fuente runtime es:

`nexa-academy-server/data/academy/catalog.json`

El contrato se organiza así:

```json
{
  "schema_version": "1.0.0",
  "categories": [
    {
      "id": "english",
      "name": "Inglés",
      "template_family": "language",
      "levels": [
        {
          "id": "a1",
          "topics": [
            {
              "id": "greetings",
              "lesson_blueprints": [
                {
                  "title": "Saludos básicos en inglés",
                  "description": "Aprender hello y good morning en contexto.",
                  "objectives": ["Pronunciar cuatro saludos"]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Para agregar una materia no se modifica el servicio de planificación: se
agrega una categoría, sus niveles, temas, objetivos y plantillas aprobadas.

## 4. Agentes y límites

Los prompts versionados están en `src/academy/agents.py` y se exponen desde
`GET /api/v1/academy/agents` para auditoría. Cada agente recibe únicamente el
contexto necesario y produce JSON con un contrato específico.

| Agente | Responsabilidad | No puede hacer |
|---|---|---|
| planner | Conversar y recoger materia, nivel, perfil y objetivo | Crear guiones completos |
| researcher | Organizar fuentes, afirmaciones y ejemplos | Inventar fuentes o ampliar el tema |
| curriculum | Ordenar fases, prerrequisitos y lecciones | Escribir HTML o audio |
| lesson_author | Escribir una lección dentro de `scope_in` y `scope_out` | Pasar al siguiente tema |
| fact_checker | Revisar exactitud, nivel y alcance | Reescribir sin registrar el problema |
| visual_director | Seleccionar familia de plantilla y escenas | Inventar un sistema visual por lección |
| voice_director | Elegir proveedor, modelo, voz e instrucción | Cambiar el guion pedagógico |
| quality_assurance | Revisar audio, subtítulos, timing y contraste | Ocultar una falla |
| metrics_reviewer | Interpretar datos del piloto | Decidir sin evidencia o sin umbrales |

El prefijo de cada prompt indica que el agente tiene un rol, un alcance y una
salida definida. El backend debe registrar además modelo, versión del prompt,
latencia, caracteres, costo estimado y resultado de validación.

El endpoint `POST /api/v1/academy/agents/{agent_id}/run` ya conecta este
registro con el puerto de IA existente. Recibe el contexto aprobado y la
solicitud del usuario, ejecuta el prompt de rol y devuelve un JSON con el
identificador del agente y la versión del contrato. Las credenciales se leen
desde la configuración del servidor y no se guardan en el catálogo ni en los
planes.

## 5. Arquitectura hexagonal y micro-kernel

El núcleo de Academy se encuentra en `src/academy/` y no importa FastAPI:

- `models.py`: entidades y estados de dominio.
- `ports.py`: contratos para catálogo y persistencia.
- `catalog.py`: adaptador JSON del catálogo.
- `repository.py`: adaptador JSON recuperable y migrable a SQL.
- `planning.py`: servicio de conversación y construcción del plan.
- `queue.py`: servicio de encolado y estados de cada lección.
- `agents.py`: registro de roles y prompts.

La capa HTTP solo transforma requests y respuestas. Los adapters existentes de
IA y voz continúan detrás de sus factories:

- `get_analysis_ai()` para investigación y planificación asistida.
- `get_codegen_ai()` para generación acotada de código cuando sea necesario.
- `get_voice_ai(provider, engine)` para Gemini y Novita.

El siguiente adapter que debe agregarse es `LessonRendererPort`, con una
implementación HyperFrames. El dominio entregará una `LessonSpec` y una
especificación visual; nunca un prompt libre que pueda escribir cualquier HTML.

## 6. Voz, subtítulos y lectura resaltada

Se mantiene `VoicePort` como puerto único. La configuración de cada plan guarda:

- proveedor: `gemini` o `novita`;
- modelo o motor concreto;
- voz;
- instrucción de narración;
- idioma y emoción;
- caracteres y costo estimado.

La plantilla HyperFrames de Academy en `nexa-academy-hyperframes/index.html`
recibe `audioSrc`, tres segmentos de subtítulos y el color de categoría. La
narración está en una pista de audio de 15 segundos para el piloto. Cada
segmento de subtítulo se ilumina en su ventana y una línea de lectura avanza
debajo del texto.

### Fuente de verdad para el timing

El audio final es la fuente de verdad. Después de generar y normalizar
`song.mp3`, `voice_narrator` ejecuta `transcribe_voiceover` a través del puerto
`LyricsTranscriptionPort` y del adapter `FasterWhisperAdapter`. Para voz
hablada se usa `large-v3`, CPU `int8` y `vad_filter=True`; el flujo histórico
de música conserva `vad_filter=False`.

El resultado se persiste junto al job como
`logs/05e_narracion_transcripcion.json` y contiene:

- metadata del modelo, idioma, duración y configuración de VAD;
- segmentos con inicio, fin, texto y timestamps de cada palabra;
- `reading_cues` para enlazar frases pedagógicas aprobadas con la palabra
  exacta en la que comienzan.

La plantilla usa los segmentos para la banda inferior y los `reading_cues`
para el contenido central. Así, el texto que se muestra, la línea de lectura
y el audio se calculan desde la misma medición. No se usa una división basada
en cantidad de caracteres ni una velocidad de voz estimada.

## 7. Cola y escalamiento

La primera cola es persistente en JSON para que pueda inspeccionarse y migrarse.
Cada item tiene `queued`, `running`, `completed` o `failed`, número de intentos,
error y ruta de salida. La cola no es todavía Redis ni Celery porque el piloto
necesita primero validar el contrato de lección y el render.

Cuando haya múltiples workers, el puerto de cola puede tener tres adapters:

1. `JsonAcademyQueue` para local y pruebas.
2. `ArqRedisAcademyQueue` para jobs Python asíncronos, reintentos e idempotencia.
3. `CeleryRedisAcademyQueue` solo si se necesita un ecosistema distribuido con
   workers heterogéneos y monitoreo Celery.

El dominio no cambiará. Solo se sustituye el adapter y se mantiene el mismo
`GenerationBatch`.

## 8. Piloto de tres videos

La cola de diez lecciones se crea completa, pero únicamente las primeras tres
se renderizan en el piloto:

1. lección 1: saludos básicos;
2. lección 2: despedidas y cortesía;
3. lección 3: presentación personal.

Cada prueba debe conservar un manifiesto con:

- `plan_id`, `lesson_id`, `batch_id`;
- modelo de guion y prompt versionado;
- proveedor, modelo, voz y caracteres;
- ruta de audio y video;
- duración, resolución, fps y codec;
- resultado de QA;
- costo estimado;
- observaciones manuales.

Los videos de prueba se renderizan con la plantilla HyperFrames usando `check`
antes de `render`. El render final no debe dispararse automáticamente por un
simple `check`: primero se revisa el preview.

## 9. Investigación y control de contenido

La investigación no debe ser un texto libre perdido en el prompt. Para cada
lección se debe guardar:

- preguntas de investigación;
- fuentes entregadas por el usuario;
- fuentes consultadas por el agente;
- fecha y procedencia;
- afirmaciones extraídas;
- ejemplos autorizados;
- dudas o huecos de evidencia;
- resultado del agente de verificación.

El autor de la lección solo puede usar el `LessonSpec` aprobado y el paquete de
fuentes asociado. Si necesita salir del alcance, debe devolver `missing` o
`needs_revision`.

## 10. Puntos que todavía faltan para producción

La base de planificación y cola ya está implementada. Antes de producir cursos
completos todavía hay que cerrar estas etapas:

1. Conectar la investigación real con DeepSeek o Gemini mediante un adapter de
   agente que valide JSON y registre costos.
2. Crear `LessonScript`, `SourcePack`, `VisualPlan` y `QualityReport` como
   entidades persistentes.
3. Conectar `LessonRendererPort` con HyperFrames y el recorder del servidor.
4. Conectar el JSON de timing con el generador de composición para que cada
   lección nueva monte automáticamente sus ventanas de subtítulos y lectura.
5. Añadir resaltado palabra por palabra en la plantilla cuando el diseño lo
   requiera; los timestamps por palabra ya se conservan en el contrato.
6. Añadir revisión humana explícita con estados `approved` y `needs_revision`.
7. Añadir almacenamiento de assets y URLs seguras para reproducir audio y video.
8. Añadir autenticación y ownership de sesiones, planes y batches.
9. Añadir worker real y una política de idempotencia por `lesson_id` y versión.
10. Añadir métricas de piloto y umbrales configurables para `continue`, `adjust`
    o `pause`.
11. Crear familias visuales equivalentes para matemática y después para otras
    materias.
12. Eliminar progresivamente el lenguaje heredado de música de la pantalla de
    Academy sin modificar Nexa Brief ni Nexa Explainer.

## 11. Criterio de aceptación del piloto

No se debe escalar de tres a diez videos solo porque el render terminó. El
piloto queda aceptado cuando:

- las tres salidas tienen audio válido y duración esperada;
- el contenido coincide con el nivel y el objetivo;
- no hay texto fuera de las safe zones;
- los subtítulos son legibles y el resaltado sigue la narración;
- el costo por minuto queda registrado;
- la revisión manual no encuentra errores pedagógicos;
- las métricas iniciales superan los umbrales definidos o se documenta el
  ajuste requerido.
