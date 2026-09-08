# Un sistema aparte, solo para HTML/CSS/JS → video

Continuación de [motor-prompt-a-video.md](./motor-prompt-a-video.md). Ahí la
pregunta era "¿puede Nexa Brief hacer esto?". Acá la pregunta es distinta:
**separarlo en un sistema propio, chico y enfocado, que Nexa Brief (u otra
cosa) consuma como servicio en vez de tenerlo mezclado adentro.**

## Por qué separarlo tiene sentido

Nexa Brief es un pipeline de *marketing de contenido* (elige nicho, busca
imagen/música, genera texto con IA, publica en redes). El motor de
renderizado HTML→video es solo una pieza de eso, y ya está desacoplada
internamente como puerto/adaptador (`RecorderPort`, ver abajo) — separarla en
su propio repo es sacar algo que ya está hecho como módulo independiente, no
un refactor grande. El sistema nuevo pasa a ser: *"le paso HTML/CSS/JS (o un
prompt), elijo dónde se ejecuta, me devuelve el video"* — nada de nichos,
publicación en redes, ni librería de assets.

## Qué extraer de Nexa Brief (y en qué estado ya está cada cosa)

Nexa Brief ya resolvió esto con un patrón de puerto + adaptadores intercambiables:

```
src/core/ports/recorder_port.py
    RecorderPort.record(html_path, audio_path, output_dir, duration_seconds, niche_cfg)
                                                                    ↑
                                                    esto es lo único atado a Nexa Brief

src/adapters/recorder/factory.py
    → elige el adaptador según config (hoy: "playwright" | "remotion")

src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py   (501 líneas)
    → motor genérico: Chromium headless + grabación + mux con FFmpeg
    → CASI COPY-PASTE directo al sistema nuevo, sacando las referencias a niche_cfg

src/adapters/recorder/infrastructure/remotion_adapter.py            (248 líneas)
    → motor de composiciones React prearmadas, con engine_target local|lambda
    → reusable como "motor B", pero solo tiene sentido si el sistema nuevo va a
      ofrecer plantillas propias además de HTML libre — si no, se puede dejar afuera
```

**Extraer casi tal cual (con edición menor: sacar dependencia de `niche_cfg`,
reemplazar por un dataclass propio de opciones):**
- `playwright_ffmpeg_adapter.py` — el corazón del sistema nuevo.
- La lógica de mux de audio con FFmpeg dentro de ese archivo.
- El patrón `RecorderPort` + factory — es exactamente la forma de resolver
  "elegí el worker" que estás pidiendo.

**Extraer la idea, no el código (está muy atado a nichos/config de Nexa Brief):**
- El modelo de `Job`/pipeline por etapas — para el sistema nuevo conviene algo
  mucho más chico: `job = {input, status, result}`, sin las 9 etapas de Nexa Brief.
- El dedup de assets por hash de contenido (visto en la sesión anterior) — la
  idea de "hash de contenido para no reprocesar lo mismo dos veces" aplica
  igual acá si el sistema nuevo cachea renders idénticos.

**No extraer — es específico de Nexa Brief y no aplica:**
- `asset_library` (imagen/música/nicho), `input_analyzer`, `html_generator`
  dirigido por IA de marketing, publisher (YouTube/TikTok/Facebook).
  Excepción: la *idea* de `html_generator` (un paso de IA que redacta HTML a
  partir de un prompt) sí es relevante — ver el "agente mejorador" abajo.

## Forma del sistema nuevo

```
Cliente (MCP / API / CLI)
        │
        │  render(html?, css?, js?, prompt?, audio, worker="local"|"aws", opciones)
        ▼
┌───────────────────────┐
│ 1. Ingesta y validación│  ¿vino HTML directo o un prompt? ¿el HTML es válido?
└───────────┬───────────┘
        ▼
┌───────────────────────┐
│ 2. Agente analizador   │  (ver sección siguiente — opcional, on/off por request)
└───────────┬───────────┘
        ▼
┌───────────────────────┐
│ 3. Cola de jobs        │  in-process si es local; SQS si es AWS
└───────────┬───────────┘
        ▼
┌───────────────────────┐
│ 4. Worker              │  LocalPlaywrightWorker | AwsFargatePlaywrightWorker | RemotionWorker
│    (RecorderPort)      │  — mismo contrato, distinta implementación
└───────────┬───────────┘
        ▼
┌───────────────────────┐
│ 5. Resultado           │  archivo .mp4 (local) o URL firmada (S3)
└───────────────────────┘
```

Los pasos 3-5 son exactamente lo que Nexa Brief ya resolvió con
`RecorderPort` + `factory.get_recorder()`. Lo nuevo de este sistema es 1, 2 y
la capa de configuración de worker.

## El "agente que analiza y mejora" que pediste

Dos versiones posibles, de menor a mayor alcance:

1. **Analizador pasivo (lint):** antes de grabar, un paso de IA revisa el
   HTML/CSS/JS entregado y detecta problemas conocidos que arruinan una
   grabación — duración de animación que no coincide con la duración del
   audio, elementos con `position: fixed` que cortan mal en 9:16, fuentes
   externas que el navegador headless no puede cargar (bloqueo de red),
   JS que tira error en consola. Devuelve advertencias, no cambia nada solo
   con permiso explícito.
2. **Analizador activo (mejora):** el mismo paso, pero con permiso para
   reescribir/parchear el HTML antes de grabar (ej. ajustar duración de
   keyframes, inyectar `viewport` meta faltante, sugerir paleta si detecta
   contraste bajo). Esto es conceptualmente el mismo trabajo que hace
   `html_generator.py` de Nexa Brief cuando genera HTML desde un prompt — se
   puede portar esa lógica de prompting, pero apuntada a "corregir" en vez de
   "generar desde cero".

Para la versión "le paso solo un prompt, sin HTML" (no HTML/CSS/JS), el
agente deja de ser un revisor y pasa a ser un generador — ahí sí es
prácticamente el mismo rol que `input_analyzer` + `html_generator` de Nexa
Brief, portado sin el resto del pipeline de marketing.

## Configuración de worker — la interfaz que pediste

Una sola superficie de configuración, expuesta como tool de MCP (o endpoint
REST si preferís no depender de MCP para esto):

```
configure_worker(engine: "playwright" | "remotion", target: "local" | "aws")
render(html, css, js, audio, duration_seconds, worker_config?)
get_status(job_id)
```

`configure_worker` fija un default; `render` puede pisarlo por request si
alguna vez hace falta mezclar (ej. un cliente que siempre quiere local, otro
que siempre quiere AWS). Igual al patrón que ya existe en Nexa Brief con
`engine_target` para Remotion — solo que ahí queda fijo por nicho, y en el
sistema nuevo conviene que sea un parámetro de primera clase.

## Camino sugerido para armarlo

1. **Extraer el núcleo.** Copiar `RecorderPort` + `PlaywrightFFmpegAdapter` a
   un paquete nuevo, sin ninguna dependencia de `niche_cfg`/Nexa Brief.
   Verificar que graba un HTML de prueba sin tocar nada más — esto por sí
   solo ya es un sistema standalone funcional, aunque sin interfaz.
2. **Servidor MCP fino** sobre ese núcleo, local-only, sin AWS todavía.
   Tools: `render`, `get_status`.
3. **Agente analizador (versión lint)** — el primero de los dos niveles de la
   sección anterior, antes de meterse con "mejora automática".
4. **Worker AWS** (Fargate, no Lambda — mismo motivo que en el informe
   anterior: Playwright grava en tiempo real, no se beneficia de paralelizar
   por frame como Remotion) + `configure_worker` con ambos targets.
5. Recién ahí, si tiene sentido, el agente "mejorador" activo y el modo
   "solo prompt, sin HTML".

## ¿Ya existe algo que haga exactamente esto?

Sí. Investigando (agosto 2026), el mecanismo de "HTML → video con navegador
headless" ya es un patrón conocido, con al menos estos jugadores:

- **[HyperFrames](https://github.com/heygen-com/hyperframes)** (HeyGen,
  open source, Apache 2.0, paquete npm). Justo el que mencionaste antes.
  Funciona así: escribís HTML con animaciones (CSS transitions/keyframes o
  `requestAnimationFrame`/GSAP), lo carga en un navegador headless
  (Puppeteer/Playwright), **captura frame por frame a una tasa fija** (24/30
  fps), y ensambla con FFmpeg. Se usa por CLI (`npx hyperframes render`) o
  desde agentes de código (Claude Code, Cursor, Gemini CLI, Codex) vía
  **Skills** — confirmé que **no expone MCP**, ni el repo principal ni los
  forks que aparecen listados bajo "mcp" en GitHub (son solo forks del
  código, no wrappers MCP reales).
- **[ATALOQ](https://ataloq.com/html-to-video/)** — motor comercial
  dedicado a esto. Compila el HTML dinámicamente y espera el evento
  `networkidle0` antes de capturar el primer frame (para que fuentes/imágenes
  externas ya hayan cargado) — un detalle de robustez que vale la pena copiar
  sea cual sea el motor que se use.
- **[Cloudflare Browser Rendering](https://www.cloudflare.com/products/browser-rendering/)**
  — no es un producto de "video", es Playwright-como-servicio genérico
  pensado para agentes; se podría usar como *backend* de cómputo (el "AWS"
  de tu sistema) en vez de armar tu propia flota de contenedores con
  Chromium.
- **Remotion** — ya lo tenés integrado en Nexa Brief. Mismo principio que
  HyperFrames (captura determinística frame por frame), pero en React en vez
  de HTML plano.

### El detalle técnico que más importa: captura en tiempo real vs. frame por frame

Acá está la diferencia real entre lo que ya tenés (`PlaywrightFFmpegAdapter`)
y lo que hacen HyperFrames/Remotion:

- **Nexa Brief hoy:** deja correr la animación en tiempo real y grava el
  viewport con `record_video_dir` de Playwright durante N segundos de reloj.
  Simple, pero depende de que el navegador renderice a tiempo real sin
  saltarse frames — bajo carga (ej. varios jobs en paralelo, o un contenedor
  con CPU compartida en AWS) puede haber *frame drops* que se notan como
  micro-cortes.
- **HyperFrames/Remotion:** pausan el reloj de la animación, avanzan
  manualmente frame por frame (ej. `page.evaluate` seteando el tiempo de la
  animación a `frame / fps`), sacan un screenshot por frame, y ensamblan
  después con FFmpeg a una tasa fija. Es más lento de generar pero
  **determinístico** — el video sale igual sin importar qué tan rápido o
  lento fue el hardware. La contra: la animación tiene que estar escrita de
  forma "seekable" (controlable por código, típicamente con GSAP o un timeline
  explícito), no vale cualquier `setInterval` suelto.

Si el sistema nuevo va a correr en contenedores compartidos/AWS con carga
variable, migrar a captura frame-por-frame (el enfoque de HyperFrames) es
más robusto que heredar el enfoque en tiempo real de Nexa Brief.

## MCP — ¿ya existe uno para esto, y qué tan difícil es armarlo?

**No existe un MCP para "HTML/recursos → video".** Los MCP de video que sí
existen (Invideo, Vivideo, PixVerse) son wrappers de modelos de IA
*generativa* de video (texto → clip con modelos tipo Sora/Runway) — un
problema completamente distinto al de "grabar un HTML que yo ya diseñé". Este
hueco específico (HTML/CSS/JS de agente → MP4, vía MCP) no lo cubre nadie
todavía — es una oportunidad real, no un "ya existe, solo hay que copiarlo".

**La parte MCP es la más fácil de todo el proyecto.** Un servidor MCP es una
capa delgada: declarás tools con su schema, y cada tool internamente llama a
algo que ya funciona (tu adaptador extraído, o el CLI de HyperFrames, o tu
API REST). No hay nada de "difícil" ahí en sí mismo — el esfuerzo real está en
lo que la tool termina llamando:

```
render(html, css?, js?, audio_url, fps=30, worker="local"|"aws") -> job_id
get_status(job_id) -> {status, video_url?}
```

La tool `render` podría, en su versión más simple, literalmente shell-out a
`npx hyperframes render` sobre el HTML recibido — eso sería un MCP funcional
en días, no semanas, con el motor de render resuelto de entrada.

### La decisión real: construir tu motor vs. adoptar HyperFrames

- **Construir sobre lo que ya extrajiste de Nexa Brief** (`PlaywrightFFmpegAdapter`):
  control total, Python de punta a punta (encaja con el resto de tu stack),
  pero heredás la captura en tiempo real (menos robusta bajo carga) salvo que
  la migres a frame-por-frame vos mismo.
- **Adoptar HyperFrames como motor** y construir la capa MCP + worker/AWS
  alrededor: te ahorrás resolver la captura determinística (ya viene hecha,
  mantenida activamente por HeyGen), pero es Node/npm — tu MCP server en
  Python tendría que invocarlo como subproceso en vez de llamarlo in-process,
  y las animaciones que reciba tu sistema tendrían que seguir sus convenciones
  (GSAP/data-attributes) para aprovechar la captura frame-por-frame.

No hace falta decidir esto ahora — ambos caminos llegan al mismo lugar
(MCP + worker configurable + video de vuelta), difieren en cuánto motor
propio mantenés vs. cuánto delegás a una pieza open source ya validada por
otro equipo.

## Riesgo que se hereda igual

Todo lo de seguridad del informe anterior aplica exactamente igual acá — de
hecho más, porque este sistema *nace* pensado para recibir JS de terceros.
Sandboxing del navegador headless (sin red saliente durante la captura,
límites de tiempo/CPU, contenedor efímero) es parte del núcleo desde el
Paso 1, no un extra de fases posteriores.

---

## Dos detalles técnicos, explicados a fondo

### ATALOQ y el `networkidle0`

Cuando el navegador headless carga tu HTML, "cargado" no significa
"terminado de dibujar". El HTML puede depender de: una fuente de Google
Fonts que tarda en bajar, una imagen de fondo referenciada por URL, una
librería externa (GSAP, Three.js) cargada por `<script src>`. Si el sistema
saca el primer frame apenas el DOM existe, corre el riesgo de capturar texto
con la fuente de respaldo del sistema (fallback feo) o una imagen a medio
cargar en el primer segundo del video.

`networkidle0` es un evento estándar de Chromium (lo expone tanto Puppeteer
como Playwright) que se dispara cuando **no hubo ninguna conexión de red
activa durante los últimos 500ms**. ATALOQ espera explícitamente ese evento
antes de arrancar la captura — es una forma barata de asegurarse de que todo
lo externo (fuentes, imágenes, scripts) ya llegó, sin tener que adivinar un
tiempo de espera fijo tipo "esperar 2 segundos y rezar".

**Por qué te importa a vos:** tu `PlaywrightFFmpegAdapter` actual, según lo
que vimos en la sesión pasada, arranca a grabar apenas navega a la página —
no hay evidencia de un chequeo de `networkidle0` antes del primer frame. Es
una mejora barata (una línea: `page.wait_for_load_state("networkidle")`
antes de empezar a grabar) que vale la pena portar al sistema nuevo sea cual
sea el motor que termines usando, y que también podrías retro-aplicar a Nexa
Brief.

### Cloudflare Browser Rendering como posible "worker AWS"

Importante corregir algo de mi resumen anterior: **Cloudflare Browser
Rendering no genera video** — no es un competidor de HyperFrames/ATALOQ. Es
infraestructura de más bajo nivel: un servicio que te da, bajo demanda, un
navegador Chromium corriendo en la nube de Cloudflare, controlable por
Playwright/Puppeteer o por su REST API (`/screenshot`, `/pdf`, extracción de
texto). Pensalo como "EC2, pero solo para navegadores headless, con
autoscaling y sin que vos manejes servidores".

Lo que te ofrecería, si lo usás como backend de tu worker AWS, es **no tener
que armar vos la flota de contenedores con Chromium instalado** (la parte
molesta de correr Playwright en Fargate: imagen Docker pesada, gestión de
memoria, cold starts). En cambio, tu worker "AWS" se conectaría a un
navegador remoto de Cloudflare, correría tu misma lógica de grabación
(`record_video_dir` de Playwright) contra ese navegador remoto, y bajaría el
resultado. Es una opción real para la Fase 4 (paridad AWS), como alternativa
a mantener tu propia infraestructura de contenedores — con el trade-off
típico de cualquier servicio administrado: menos control, dependés del
pricing y límites de Cloudflare, y no confirmé si su modelo de grabación de
video (sesión larga, no solo screenshot puntual) está soportado o si hay
límites de duración de sesión que lo hagan inviable para clips largos — eso
habría que probarlo antes de apostar la arquitectura entera a esto.

---

## ¿Esto sería un buen proyecto? — tres escenarios

Lo que describís (3 motores intercambiables, 2 niveles de worker
costo/velocidad, decisión automática del mejor camino, GUI con presets o
"traé tu componente", salida MCP) es una arquitectura coherente — cada pieza
individual tiene sentido y ninguna es imposible. La pregunta real no es "¿se
puede?", es "¿cuánto de esto conviene construir de entrada?".

### Escenario optimista

Lo armás en fases (como ya quedó en este documento), el "auto-decisor" es al
principio una regla simple (no IA: "¿viene un componente React? → Remotion.
¿el HTML declara animación GSAP/seekable? → HyperFrames. ¿cualquier otra
cosa? → Playwright real-time como fallback universal"), y el MCP + worker
local salen primero, AWS después. Resultado: en unas semanas tenés un
sistema que **nadie más ofrece tal cual** — investigamos y confirmamos que no
existe un MCP para "HTML/React de agente → video" con selección automática
de motor. Ahí sí es una pieza de portafolio fuerte, porque no es "otro clon
de HyperFrames", es la capa de orquestación que falta arriba de motores que
ya existen.

### Escenario realista

Los tres motores no son intercambiables gratis: Remotion y HyperFrames son
Node/npm, tu Playwright adapter es Python — el "sistema" termina siendo un
orquestador Python que hace shell-out a dos subprocesos Node distintos, cada
uno con su propia gestión de errores, versiones, y tiempos de arranque. El
auto-decisor "bueno" (el que realmente elige bien sin que el usuario tenga
que saber nada) es más trabajo del que parece — la versión regla-simple de
arriba cubre el 80% de los casos, pero "tomar la mejor decisión" en el
sentido fuerte (analizar el HTML/React entregado y decidir) es básicamente
otro proyecto de IA aparte, no una función de 20 líneas. La GUI es un
frontend completo, separado del backend — no es un checkbox, es semanas de
trabajo por sí sola. Nada de esto es inviable, pero el "sistema con 3
motores + auto-decisión + 2 workers + GUI + MCP" completo es varios meses de
trabajo de un solo desarrollador, no un fin de semana.

### Escenario pesimista

Si se arranca por el medio — los 3 motores a la vez, el auto-decisor
"inteligente" antes que la regla simple, la GUI antes que el MCP funcionando
a mano — el riesgo es terminar con tres integraciones a medio hacer y nada
que se pueda mostrar. Es el patrón clásico de proyecto de portafolio que no
se termina: mucha superficie, poco profundizado. El otro riesgo real es de
producto, no técnico: si el resultado final es funcionalmente "HyperFrames
con más pasos", el valor diferencial se lo lleva la capa de orquestación/MCP,
no el motor de render — si esa capa no queda genuinamente buena, terminás
compitiendo con herramientas gratuitas más simples y sin ganar nada.

### Veredicto

Es un buen proyecto **si el orden de construcción respeta la dificultad
real**: MCP + un solo motor (Playwright, que ya tenés) + un worker (local)
primero — eso ya es un producto demostrable. Recién con eso funcionando,
sumar el segundo motor, después el segundo worker, después la GUI, y dejar
el "auto-decisor inteligente" (vs. la regla simple) como la última pieza,
no la primera. El diferencial real de este proyecto no son los 3 motores —
es que hoy nadie ofrece esto como servicio MCP con selección de
costo/velocidad. Esa es la parte que vale la pena proteger yendo despacio.
