# Cola real, render en AWS y HyperFrames como motor adicional en `nexa-brief-server`

> **Actualización 2026-09-17**: los puntos 3 y 4 de este estudio ya se implementaron —
> `nexa-hyperframes-test` se renombró a `nexa-brief-hyperframes` (mismo lugar, no se
> movió de carpeta), y se agregó `HyperframesAdapter` + entrada en `factory.py` +
> settings `hyperframes_*`, siguiendo exactamente el plan de la sección 4. Como
> `_COMPOSITION_BY_TEMPLATE_ID` sigue vacío (ningún niche tiene composición HyperFrames
> portada todavía — sigue siendo el gap real, ver sección 3.3), `supports_niche()`
> devuelve `False` para todos y el router rechaza con 400 cualquier intento de usar
> `recorder_engine_override="hyperframes"`, igual que ya pasaba con Remotion para un
> niche sin portar. El sistema de colas (puntos 1-2) sigue sin construirse — sección 5.1
> sigue abierta.

Estudio de tres pedidos relacionados, tomando como plano de referencia lo que ya funciona en el proyecto hermano `nexa-render`:

1. Darle a `nexa-brief-server` un sistema de colas real (tipo Redis/BullMQ), que hoy no tiene.
2. Darle capacidad de renderizar en AWS a gran escala, que hoy solo existe de forma parcial (Remotion, shell-out a un script Node).
3. Madurar `nexa-hyperframes-test` a `nexa-hyperframes` (sin el "-test") y conectarlo a `nexa-brief-server` como un motor de render adicional — un subproceso más, igual que ya pasa con Remotion.

**Alcance: solo diagnóstico y plan, sin código.** Todas las rutas de archivo son del checkout actual en `/home/university/Documentos/Proyectos/nexa-brief/`.

---

## Resumen ejecutivo

- **La cola y el AWS que se piden ya existen y están probados — pero en `nexa-render`, no en `nexa-brief-server`.** No hay que diseñarlos desde cero: hay que decidir si `nexa-brief-server` levanta su propia infraestructura BullMQ+Redis (copiando el patrón) o se apoya en la que ya corre para `nexa-render`.
- **`nexa-brief-server` ya tiene el patrón exacto para "motor de render como subproceso externo"**: `RemotionAdapter` (`src/adapters/recorder/infrastructure/remotion_adapter.py`). Agregar HyperFrames como motor adicional es replicar esa misma clase, no inventar un mecanismo nuevo — el punto de extensión (`factory.py`) ya está pensado para esto.
- **`nexa-hyperframes-test` ya tiene su infraestructura AWS Lambda desplegada y funcionando** (stack `hyperframes-poc`, ~$0.05 de costo total en pruebas), pero el proyecto en sí es una prueba de concepto: falta que acepte contenido dinámico (hoy todo está hardcodeado en HTML) antes de que un `HyperframesAdapter` pueda generar clips reales por nicho.
- **Hay una advertencia de negocio ya escrita en este mismo repo que aplica directo a este plan**: `docs/investigaciones/diagnostico-punto-muerto-agosto-2026.md` señala que ya se planificó infraestructura de escala (AWS/Lambda/hardware) para volúmenes que nunca se alcanzaron (~28 videos en 2.5 meses vs. ~20/día planeados). No es una razón para no hacer este trabajo, pero sí para no dimensionarlo para una escala que todavía no existe.

---

## 1. Qué tiene y qué le falta a `nexa-brief-server` hoy

### 1.1 Cómo se procesan los jobs ahora (sin cola)

Cadena real, confirmada en el código:

- `POST /api/v1/videos` (`src/presentation/api/routers/videos.py`) crea el `Job`, lo persiste en `job_tracker` y lanza `asyncio.create_task(orchestrator.run_batch(...))` — respuesta `202` inmediata, el cliente hace polling o WebSocket para ver progreso.
- `Orchestrator` (`src/core/orchestrator.py`) limita el paralelismo con un `asyncio.Semaphore(settings.max_parallel_jobs)` (default 2) y corre todo con `asyncio.gather`.
- `job_tracker.py` es un índice JSON en disco (`data/jobs_library/_index.json`), con `asyncio.Lock` y escritura atómica (`tmp.replace(path)`). Es persistencia de **estado para polling**, no una cola: no reencola, no reintenta, no sobrevive a un reinicio del proceso a mitad de un `gather`.
- Único control de admisión: `_check_background_capacity()` devuelve `429` si hay más de `settings.max_background_jobs` (default 6) activos — un rate-limit en memoria, no una cola con backpressure real.
- El único "scheduler" real del proyecto es `APScheduler.BackgroundScheduler` (`src/adapters/publishing/scheduler.py`), y es exclusivamente para **publicación programada en redes** (qué video sale a qué hora), no para el renderizado en sí.
- `src/core/realtime/event_bus.py` lo dice en su propio docstring: es pub/sub in-process, "si la app escala a múltiples workers, esto necesitaría moverse a un broker compartido (Redis pub/sub)".

**Confirmado por búsqueda exhaustiva**: cero referencias a `redis`, `celery`, `bullmq`, `rq`, `kafka`, `rabbitmq`, `sqs` en `pyproject.toml`, `uv.lock`, `.env.example` o `src/**/*.py`.

### 1.2 AWS hoy: existe, pero parcial y no nativo

- `settings.py` (líneas ~100-150) ya tiene el switch `remotion_render_target: "local" | "aws"` + `remotion_aws_region`, `remotion_aws_function_name`, `remotion_aws_serve_url`, `remotion_aws_frames_per_lambda` — pero **solo aplica al motor Remotion**.
- `RemotionAdapter.record()` (`src/adapters/recorder/infrastructure/remotion_adapter.py:216-234`), cuando `render_target == "aws"`, no llama a ningún SDK de AWS en Python — hace `shell-out` a `scripts/render-lambda.mjs` dentro de `nexa-brief-remotion/` (proyecto Node hermano), que internamente sí usa `@remotion/lambda`. Fail-fast explícito si faltan `REMOTION_AWS_FUNCTION_NAME`/`REMOTION_AWS_SERVE_URL` (líneas 216-222).
- **No hay `boto3`/`botocore` en ninguna dependencia** — cero cliente AWS nativo en Python. Todo lo que toca AWS pasa por un proceso Node externo.
- `output/` (videos, imágenes, manifests) sigue siendo disco local montado como volumen Docker (`nexa_output`), no S3.
- No hay Hetzner en ninguna forma, en ningún repo del monorepo — si en algún momento se quiere evaluar como alternativa a AWS, sería una pieza 100% nueva sin ningún blueprint interno que copiar (a diferencia de AWS, que sí tiene dos blueprints ya funcionando: Remotion Lambda y HyperFrames Lambda).

### 1.3 Dónde encajaría una cola nueva sin romper la arquitectura hexagonal

Estructura relevante de `src/core/`:

```
src/core/
├── ports/                # Interfaces — acá iría un JobQueuePort nuevo
│   ├── recorder_port.py, ai_port.py, image_port.py, music_port.py, publisher_port.py
├── orchestrator.py        # Punto a reemplazar/envolver: asyncio.gather → publicar en cola
├── job.py                  # Job, JobStage — hoy pydantic inmutable, sin forma de serializar a mensaje de cola
└── schedule/                # Precedente de "cola" que YA existe en el repo (solo para publicación)
    ├── queue_repository.py   # mismo patrón JSON+lock+escritura atómica que job_tracker
    └── engine.py               # process_tick(), publish_entry()
```

El patrón que ya usan `ai/`, `image/`, `music/`, `recorder/` (puerto abstracto + `factory.py` + adaptador concreto en `src/adapters/`) es el punto de extensión natural: un `JobQueuePort` (`enqueue`, `dequeue`/`ack`, `get_status`) con un adaptador Redis real, resuelto por una factory igual que el resto. `videos.py` pasaría de `asyncio.create_task(...)` a `queue_port.enqueue(job)`, y un proceso worker aparte (nuevo, separado del proceso API) correría `pipeline.run()` consumiendo de esa cola.

---

## 2. El blueprint que ya funciona: cómo lo resuelve `nexa-render`

### 2.1 Cola — BullMQ + Redis (ioredis)

- `server/src/queue/queues.ts`: **una `Queue` de BullMQ por motor de render**, no una cola genérica — `render-playwright`, `render-remotion`, `render-hyperframes` (`ENGINE_NAMES` + `queueNameFor()`).
- `server/src/queue/connection.ts`: una única conexión `ioredis` compartida, con `maxRetriesPerRequest: null` (requerido por BullMQ) y `retryStrategy` acotado.
- `server/src/queue/workers.ts`: un `Worker` de BullMQ por motor, con **concurrencia configurable por motor** vía env vars (`PLAYWRIGHT_CONCURRENCY=2`, `REMOTION_CONCURRENCY=3`, `HYPERFRAMES_CONCURRENCY=3`).
- `job.data`/`job.returnvalue` de BullMQ es la **única fuente de verdad** del job — decisión explícita en el código para no duplicar estado en otra estructura Redis.
- `jobId` propio (UUID vía `nanoid`), no el autoincremental de BullMQ — necesario porque hay tres colas distintas y el contador de BullMQ es por cola (riesgo de colisión al consultar por id a través de las tres).
- **Sin reintentos automáticos configurados** (`queue.add(name, data, { jobId })`, sin `attempts`/`backoff`) — punto de mejora explícito si se replica en `nexa-brief`.
- `docker-compose.yml`: Redis con persistencia real a disco — `--appendonly yes --appendfsync everysec --save 60 1`, volumen dedicado, expuesto solo en `127.0.0.1:6379` (no a la red externa). No es un Redis efímero en memoria: un reinicio del contenedor no borra los jobs en cola.
- Workers arrancan en el **mismo proceso** que el servidor Fastify (`server/src/index.ts`), con shutdown gracioso en `SIGINT`/`SIGTERM`. El servidor MCP (`mcp-index.ts`) corre en un **proceso separado** que solo produce/consulta jobs — nunca procesa, para no acoplar el ciclo de vida de un cliente MCP al de los workers.

### 2.2 AWS — dos motores, dos patrones distintos, ninguno reinventado a mano

- **Decisión local/AWS explícita en el payload del job** (`worker: "local" | "aws"`), validada con fail-fast antes de encolar si faltan variables — mismo espíritu que ya usa `RemotionAdapter` en `nexa-brief-server` (punto 1.2), solo que acá aplica a dos motores en vez de uno.
- **Remotion en AWS** (`server/src/engines/remotion/remotion-aws.ts`): usa `@remotion/lambda` (bucket S3 propio de Remotion, "site" desplegado por job, `renderMediaOnLambda`, polling de progreso, descarga, limpieza de S3 al final).
- **HyperFrames en AWS** (`server/src/engines/hyperframes/hyperframes-engine.ts`): **no** usa el SDK de AWS directo — invoca el binario CLI local `hyperframes lambda render` (nunca `npx`, por overhead medido), que orquesta Step Functions + Lambda (fan-out por chunks de frames) + S3, vía `@hyperframes/aws-lambda`. Descarga el resultado con un helper propio sobre `@aws-sdk/client-s3`.
- **Patrón general a copiar**: delegar la integración cloud a la herramienta oficial del framework (CLI de HyperFrames, SDK de Remotion Lambda) en vez de reimplementarla a mano — es literalmente lo mismo que ya hace `RemotionAdapter` en `nexa-brief-server` hoy (shell-out a un script que usa el SDK oficial), así que el patrón para HyperFrames sería el mismo tipo de wrapper, no algo nuevo conceptualmente.
- **Estado real**: según el README de `nexa-render`, el worker `aws` está "bloqueado por no tener cuenta AWS todavía" para ese proyecto — el código compila pero no está verificado end-to-end ahí. Importante: esto es distinto del estado de `nexa-hyperframes-test`, que **sí** tiene su propio stack Lambda ya desplegado y probado con renders reales (ver sección 3).

---

## 3. `nexa-hyperframes-test`: qué es hoy y qué le falta para ser "como Remotion"

### 3.1 Qué es hoy

- Es explícitamente una **copia de prueba** de otro proyecto hermano (`../nexa-hyperframes/`, fuera de `nexa-brief-server`), creada para validar una sola cosa: un `package.json`/`node_modules` único compartido entre dos composiciones (`movil/`, `desktop/`) en vez de uno por composición — confirmado que funciona y usa la mitad del espacio en disco.
- Motivo original: evaluar HyperFrames (motor de terceros, `heygen-com/hyperframes`, Apache 2.0) como alternativa a Remotion porque el pipeline actual de Remotion tarda **~2 horas para 6 minutos de video** a 30fps.
- Estructura: `core/config.js` (constantes) + `components/*.js` (funciones puras `(gsap, tl, opts) => void`, reutilizadas varias veces dentro de cada composición) + `index.js` orquestador que arma un único `gsap.timeline({paused:true})` y expone `window.__timelines["main"]`.
- **Infraestructura AWS ya desplegada y probada de verdad** (a diferencia del `aws` de `nexa-render`, que está bloqueado por falta de cuenta): stack CloudFormation `hyperframes-poc` en `us-east-1`, con `RenderFunction` (Lambda, 2048MB), `RenderStateMachine` (Step Functions), `RenderBucket` (S3), usuario IAM dedicado `hyperframes-user` (no reutiliza el usuario `remotion-user` existente, por principio de mínimo privilegio). Costo total de deploy + pruebas: bien por debajo de $0.05.

### 3.2 Por qué hoy es un POC y no un framework

- **Ninguna composición acepta datos dinámicos.** Textos, colores y duración están hardcodeados directamente en cada `index.html`/`core/config.js`. El CLI soporta `--variables`/`--variables-file` en `lambda render`, pero ninguna composición del proyecto lo usa. Esto es el gap más importante: sin esto, no se puede generar un clip distinto por nicho/job — cada render produciría siempre el mismo contenido.
- **`src/shared/` está vacío a propósito** (regla de tres: esperar un tercer caso de uso real antes de extraer código común) — hoy no hay ninguna capa de componentes realmente compartida entre `movil/` y `desktop/`.
- **GSAP se carga por CDN** (`<script src="https://cdn.jsdelivr.net/npm/gsap@...">`), no como dependencia npm versionada — rompe reproducibilidad offline, justo lo que HyperFrames promete como ventaja (render determinista, seek-safe).
- **No es instalable como paquete**: `package.json` tiene `"private": true`, sin `main`/`exports`/`bin`/versión.
- El propio README lo dice explícitamente: la comparación de velocidad contra Remotion (11-22s vs. ~2h) es "hipótesis, no conclusión" — nunca se corrió con contenido de producción real (audio, letras palabra por palabra, video de fondo), solo con gradientes/texto de ejemplo.
- Convive con un proyecto hermano (`../nexa-hyperframes/`, fuera del checkout de `nexa-brief-server`) que es la fuente "real" — el propio README de `nexa-hyperframes-test` propone como próximo paso reemplazar ese proyecto original por esta estructura de dependencias única, no al revés.

### 3.3 Lo que le falta para ser "como Remotion" (framework reusable, no un proyecto de prueba)

1. Sacar GSAP del CDN → dependencia npm versionada.
2. Definir un contrato de **input props/variables reales**: separar contenido (texto, colores, duración, assets) de plantilla, consumible vía `--variables-file` o equivalente — sin esto no hay forma de generar un clip por job.
3. Poblar `src/shared/` con lo genuinamente común (paleta de marca, tipografía, utilidades `ffprobe`) y confirmar que sobrevive el empaquetado a S3 (`hyperframes lambda sites create` solo empaqueta el directorio que se le pasa — riesgo señalado y no probado todavía en el propio README del proyecto).
4. Convertir el patrón `core + components + index.js` en un paquete propio con `package.json` real (nombre, versión, `main`/`exports`), en vez de código repetido por composición.
5. Decidir cuál de los dos árboles (`../nexa-hyperframes/` original vs. esta copia `-test`) se conserva **antes** de renombrar — hoy conviven dos fuentes de verdad parcialmente redundantes.
6. Agregar al menos una composición con contenido de producción real (audio + letras palabra por palabra + video de fondo) para que la comparación de velocidad contra Remotion deje de ser una hipótesis.

---

## 4. Wiring propuesto: HyperFrames como motor adicional en `nexa-brief-server`

Esto es lo que responde directamente a "que use nexa-hyperframes-test como subproceso" — el mecanismo ya existe en el código, solo hay que replicarlo:

### 4.1 El patrón a copiar ya está escrito: `RemotionAdapter`

`src/adapters/recorder/infrastructure/remotion_adapter.py` es, línea por línea, el ejemplo de "motor externo invocado como subproceso, seleccionable por nicho, con soporte local/aws":

- Implementa `RecorderPort` (`src/core/ports/recorder_port.py`) — mismo contrato que `PlaywrightFFmpegAdapter`.
- Arma un `props`/`config.json` a partir de lo que ya dejaron stages previos del pipeline (`html_generator`, `lyrics_transcriber`) en `output_dir` — no requiere plomería de datos nueva.
- `effective_render_target = render_target or settings.remotion_render_target` decide entre dos `cmd` distintos: `scripts/render-node.mjs` (local) o `scripts/render-lambda.mjs` (AWS), ambos en el proyecto Node hermano (`nexa-brief-remotion/`).
- Corre el subproceso con `asyncio.create_subprocess_exec`, bajo un `asyncio.Semaphore` propio (`remotion_max_concurrent_renders`) separado del semáforo de Playwright, con timeout (`asyncio.wait_for`) y manejo de exit code / stderr.
- Un mapeo explícito `template_id → composition_id` (`_SINGLE_COMPOSITION_BY_TEMPLATE_ID`) rechaza con error claro cualquier nicho sin composición portada, en vez de fallar silenciosamente.

### 4.2 Qué necesitaría un `HyperframesAdapter` análogo

- Mismo contrato `RecorderPort`, mismo patrón de subproceso — pero invocando el CLI `hyperframes` (`hyperframes render` local, `hyperframes lambda render` para AWS) en vez de `node scripts/render-*.mjs`, contra el proyecto `nexa-hyperframes` (una vez maduro — ver sección 3.3, punto 2: sin input props dinámicos no hay nada que pasarle por job).
- Necesitaría su propio bloque de settings (`hyperframes_project_dir`, `hyperframes_render_timeout_seconds`, `hyperframes_aws_stack_name`, `hyperframes_aws_bucket`, `hyperframes_aws_state_machine_arn`, etc.), calcado de los `remotion_aws_*` que ya existen en `settings.py:103-148` — la infraestructura AWS para esto **ya está desplegada** (stack `hyperframes-poc`, sección 3.1), a diferencia de Remotion Lambda que si no está configurado falla fast.
- `factory.py` (`src/adapters/recorder/factory.py:13-28`) es el único punto que cambia para exponerlo: hoy es un `if engine == "remotion": ... else: playwright`; agregar `elif engine == "hyperframes":` es la extensión completa — no hay que tocar `Orchestrator`, `pipeline.py` ni `videos.py` más que replicar la validación que ya existe para `recorder_engine_override == "remotion"` (`videos.py:196-199`, vía un `hyperframes_adapter.supports_niche()` análogo a `remotion_adapter.supports_niche()`).
- `niche_config.py:217` (`recorder_engine: str = "remotion"`) ya es un string libre, no un enum cerrado — un nicho podría declarar `recorder_engine: "hyperframes"` en `niches.json` sin cambios de esquema.
- Necesita un mapeo `template_id → composición HyperFrames`, equivalente a `_SINGLE_COMPOSITION_BY_TEMPLATE_ID`, pero **antes** hace falta que existan composiciones HyperFrames data-driven (punto 3.3) — hoy `movil`/`desktop` son demos fijas, no plantillas por nicho.

### 4.3 Orden de dependencias entre los tres pedidos

No son independientes entre sí — hay un orden natural:

1. **Madurar `nexa-hyperframes-test` → `nexa-hyperframes`** (sección 3.3) es prerrequisito de todo lo demás: sin input props dinámicos, un `HyperframesAdapter` no tendría nada que renderizar por job (solo repetiría siempre el mismo demo).
2. **`HyperframesAdapter` + wiring en `factory.py`** puede construirse en paralelo al renombre, una vez que al menos una composición acepte variables — no depende de que exista una cola nueva; `RemotionAdapter` hoy corre perfectamente sobre el mecanismo actual de `asyncio.create_task` sin cola.
3. **Cola real (BullMQ+Redis) para `nexa-brief-server`** es la pieza más independiente de las tres — mejora la resiliencia y el control de concurrencia del pipeline completo (con o sin HyperFrames de por medio), pero no bloquea a las otras dos. Se puede hacer en cualquier momento, incluso antes.

---

## 5. Dos decisiones abiertas antes de planificar implementación

### 5.1 ¿Cola propia para `nexa-brief-server`, o apoyarse en la de `nexa-render`?

El documento `docs/investigaciones/dos-sistemas-nuevos-desde-nexa-brief-y-nexa-render.md` (ya en este repo, sección "Sistema de colas y resiliencia") analizó esta misma pregunta para dos sistemas *nuevos* y concluyó que no hace falta construir una cola nueva — conviene apoyarse en la instancia BullMQ+Redis que ya corre para `nexa-render`. Ese razonamiento no traslada 1:1 acá, porque ahí la cola era para proyectos nuevos sin pipeline propio; acá se trata de reemplazar el `asyncio.create_task` que ya vive **dentro** del pipeline hexagonal de `nexa-brief-server`, con su propio `Job`/`JobStage`/`job_tracker`. Dos caminos posibles:

- **(A) Adaptador `JobQueuePort` en Python** (ej. `arq`, `saq`, o un cliente Redis fino) que encole `Job` completos y un proceso worker Python separado corra `pipeline.run()` — mantiene todo dentro de la arquitectura hexagonal existente, mismo lenguaje que el resto del backend.
- **(B) Delegar el encolado a un servicio Node al lado** (más parecido a `nexa-render`), con `nexa-brief-server` como productor de mensajes vía HTTP o cliente Redis cross-lenguaje — más trabajo de integración, pero reutiliza literalmente la infraestructura BullMQ ya probada.

Este estudio no resuelve cuál conviene — depende de si se prioriza consistencia con la arquitectura Python existente (A) o reutilización máxima de infraestructura ya corriendo (B).

### 5.2 ¿Qué tan urgente es esto, dado el volumen real?

`docs/investigaciones/diagnostico-punto-muerto-agosto-2026.md` (agosto 2026) advierte que ya se planificó infraestructura cloud/Lambda/hardware pensada para ~20 videos/día cuando el volumen real fue ~28 videos en 2.5 meses, y recomienda pausar (no descartar) ese tipo de inversión hasta validar demanda con contenido real. Vale la pena releer ese diagnóstico antes de dimensionar la cola (cuántos workers, qué concurrencia) y la infraestructura AWS (qué memoria de Lambda, cuántos chunks paralelos) — los números de `nexa-render`/`nexa-hyperframes-test` (concurrencia 2-3, 2048MB) son buen punto de partida justamente porque están pensados para volumen bajo/medio, no para escala.

---

## 6. Resumen de lo nuevo a construir (si se decide avanzar)

- `JobQueuePort` + adaptador Redis real + proceso worker separado para `nexa-brief-server` (reemplaza `asyncio.create_task` en `videos.py` y el `asyncio.gather` de `orchestrator.py`).
- Decisión de arquitectura 5.1 (cola propia en Python vs. apoyarse en la BullMQ de `nexa-render`).
- Consolidación `../nexa-hyperframes/` vs. `nexa-hyperframes-test/` → una sola fuente de verdad, después renombrada a `nexa-hyperframes`.
- Input props/variables dinámicas reales en al menos una composición HyperFrames, antes de conectarla a ningún nicho.
- GSAP como dependencia npm versionada (no CDN) en `nexa-hyperframes`.
- `HyperframesAdapter` (`src/adapters/recorder/infrastructure/`), calcado de `RemotionAdapter`, + entrada en `factory.py` + settings `hyperframes_*` + mapeo `template_id → composición` + validación en `videos.py` análoga a la de Remotion.
- Al menos una composición HyperFrames por nicho existente, antes de poder medir de verdad si HyperFrames es más rápido que Remotion con contenido real (hoy es una hipótesis no probada, según el propio README del POC).
