# Categorías NODE, motor explainer, voz, agentes locales y programación por categoría

Escrito para: el equipo de desarrollo de nexa-brief (tú y quien retome el trabajo).
Fecha: 2026-10-10. Estado: integrado y probado (detalle de pruebas en §8).

## 1. Qué se integró

| Pieza | Dónde | Estado |
|---|---|---|
| 5 categorías principales con subcategorías y estrategia por rama | `niches.json` → `categories` · `src/core/categories.py` | Hecho |
| Salidas de video por categoría: `output/<categoría>/<subcategoría>/…` | `categories.output_dir_for_niche`, `pipeline.py`, `main.py` | Hecho |
| API propia del motor explainer (Tech, History, Politics, Economy) | `src/presentation/api/routers/explainer.py` | Hecho |
| Textos de publicación con IA (YouTube, Facebook, TikTok) | `src/core/explainer/briefs.py` | Hecho |
| Producción del video con agente local (Claude Code / Codex) | `src/core/explainer/producer.py` · `src/adapters/agent/` | Hecho |
| `AIPort` sobre CLI local (texto/JSON sin API paga) | `src/adapters/ai/infrastructure/local_agent_ai_adapter.py` | Hecho |
| Voz: `VoicePort` + Gemini TTS con rotación de 7 claves | `src/adapters/voice/` · `src/core/ports/voice_port.py` | Hecho |
| Automatización de horarios por categoría (diario / día por medio) | `src/core/schedule/planner.py` · `POST /schedule/categories` | Hecho |
| Planificador semanal conversando con la IA (DeepSeek) | `planner.chat` · `/schedule/planner/*` | Hecho |
| Web: ventanas por categoría, modal de creación, Preparación, Programación | `nexa-brief-web/src/features/{categories,explainer,schedule}` | Hecho |

NodeMotion no cambió de comportamiento: sigue usando el pipeline de plantillas (`/templates`, Estudio, Remotion/HyperFrames/Playwright). Lo único nuevo para NodeMotion es que sus salidas ahora caen en `output/node_motion/<subcategoría>/<job_id>`.

## 2. Estructura de categorías

```
NodeTech       tecnología  explainer_kit  carpeta nodetech/     diseños: rough
NodeHistory    historia    explainer_kit  carpeta nodehistory/  diseños: binary, acuarela, carta, collage,
                                                                 cronica, enmienda, grunge, pelicula, periodico, pop
NodeMotion     música      pipeline       letras (23) · promos (6) · fondos (4) · instrumental (2)
NodePolitics   política    explainer_kit  vacía: usa los 11 diseños del kit hasta tener propios
NodeEconomy    economía    explainer_kit  planificada: idem (+ nicho inactivo economy_finance)
```

- Categorías dentro de categorías: cada nodo acepta `children` a cualquier profundidad.
- Un nicho o diseño pertenece a una sola categoría (se valida al cargar).
- `strategy` por categoría principal: público, ángulo, tono, fórmulas y ejemplos de título, temas sugeridos, hashtags, reglas (p. ej. neutralidad en Politics, sin consejos de inversión en Economy) y cadencia por defecto. La leen el generador de textos y el planificador. Para cambiar el estilo de una rama se edita el JSON, no el código.
- Archivos (2026-10-10, segunda pasada): el motor salió de `sandbox/` a `src/templates/_tools/explainer-kit/`
  y los videos viven en `src/templates/<carpeta>/<id>/` (`nodetech/`, `nodehistory/`; `nodepolitics/` y
  `nodeeconomy/` se crean con el primer video). La carpeta sale del campo `folder` de cada categoría.
  No va en `adapters/`: es un motor de plantillas (HTML/JS), no una integración Python.
- Orden final de `src/templates/` (tercera pasada, mismo día): **producción** = `nodemotion/{lyrics,commercial,image,video}/`,
  `nodetech/`, `nodehistory/`; **motores y herramientas** = `_tools/` (incluye `_tools/explainer-kit/`);
  **casa de pruebas** = `sandbox/{nodemotion,nodetech,nodehistory,nodepolitics,nodeeconomy}/`, cada una con
  `AGENTS.md` + `CLAUDE.md` y lo aprendido; `sandbox/EXPLAINER.md` es la base común de las 4 categorías
  explainer. Un video de prueba se crea con `kit.py new … --folder sandbox/<tema>` y pasa a producción
  con `kit.py promote <id>`.
  Hoy: NodeTech 4 videos, NodeHistory 12 (3 reales + 9 demos de diseño, marcados `demo: true` porque
  repiten el guion del Muro de Berlín). Los 16 tienen `publish.json` y portada `render/poster.jpg`
  (`kit.py poster`), y en /plantillas se ven como tarjetas con modal (reproductor + textos + grabar/publicar).
- Un video producido guarda su categoría en `manifest.json` (`category`). Así NodePolitics puede usar el diseño `enmienda`, que es de NodeHistory, y el video queda en Politics.

## 3. Cómo funciona una categoría explainer (Tech / History / Politics / Economy)

```
Web: ventana de la categoría → «Crear video»
  1. Tema (obligatorio) + descripción + imágenes/videos (opcionales) + diseño
  2. «Generar textos»   → POST /explainer/briefs          (no graba ni guarda nada)
       ángulo, gancho, esquema, título YouTube (+2 alternativas), descripción, tags,
       título/descr. Facebook, caption + hashtags TikTok, texto de miniatura
     «Previsualizar»    → iframe con el demo del diseño elegido
  3. «Preparar video (sin grabar)» → POST /explainer/productions (multipart)
       a. kit.py new <diseño> <id>; se guardan BRIEF.md, brief.json, publish.json,
          categoría/tema en manifest.json y los medios del usuario en assets/media/
       b. el agente local (Claude Code o Codex) sigue explainer-kit/AGENTS.md pasos 2–9:
          investiga, escribe el guion, pide la voz a Gemini, transcribe, arma el
          storyboard, valida y revisa. NO renderiza.
       c. kit.py manifest → si queda «listo», el video aparece en Preparación
  4. Preparación: «Grabar» (preview 10/20 s o completo) y «Publicar»
       grabación completa → output/<categoría>/<diseño>/<id>/ + job empaquetado
       → los horarios de la categoría lo publican solos
```

Estados de una producción: `queued → creating → producing → finishing → ready` (o `recording → done` con grabación automática). Si el agente termina pero el video no quedó «listo»: `incomplete`; si algo falla o el servidor se reinicia: `failed`. Los dos se retoman con «Retomar» (`POST /explainer/productions/{id}/resume`), que le pide al agente seguir desde el primer paso pendiente.

### 3.1 Seguridad del agente

El agente corre solo, sin nadie que apruebe sus acciones, por eso tiene permisos acotados (`AgentScope`):

- **Claude Code**: `--allowedTools` con `Edit/Write` solo dentro de la carpeta del video (`src/templates/<carpeta>/<id>/`) y `Bash` solo para `python kit.py …` y `python media.py …` (rutas absolutas). Lectura, búsqueda web y fetch permitidos. Lectura de `.env`, `accounts.json` y `client_secret.json` bloqueada. Nunca se usa `--dangerously-skip-permissions`.
- **Codex**: sandbox `workspace-write` con directorio de trabajo en la carpeta de la categoría (`src/templates/<carpeta>/`) más el estado de claves del kit (no puede escribir fuera) y red habilitada (investigar y pedir la voz).
- Timeout total configurable (`AGENT_PRODUCTION_TIMEOUT_SECONDS`, 90 min por defecto): al vencer se mata todo el grupo de procesos.
- Una producción a la vez (CPU de Whisper y del render).

## 4. Voz (adaptador nuevo)

`src/adapters/voice/infrastructure/gemini_tts_adapter.py`, detrás de `VoicePort` (el mismo contrato que nexa-academy):

- Claves: `GEMINI_API_KEY`, `GEMINI_API_KEY1…N` del `.env` (hoy 7), sin repetir valores. Se identifican con una etiqueta `NOMBRE#hash4`; la clave nunca sale en logs ni en la API.
- Cadena de modelos: `gemini-3.8-flash-tts → 3.8-flash-lite-tts → 3.1-flash-tts-preview` (la misma del kit).
- 429 «per day» o 402 (créditos agotados): la clave queda agotada ~24 h para ese modelo. 429 por minuto o 5xx: se prueba la siguiente clave sin marcarla.
- El estado de cuota se guarda en `src/templates/_tools/explainer-kit/.state/gemini-quota.json`, **el mismo archivo que usa el kit**: backend y kit no gastan pedidos en claves que el otro ya sabe agotadas.
- API: `GET /voice/keys` (estado), `POST /voice/keys/probe` (prueba cada clave, gasta 1 pedido por clave), `POST /voice/preview` (WAV de un texto corto).

El kit sigue narrando con su propio `tools/tts.py`, que ya estaba probado. El adaptador sirve al resto del backend y comparte el mismo estado de cuota. `nexa-explainer` no se tocó.

## 5. IA para textos y agentes

| Uso | Proveedor por defecto | Variable | Alternativas |
|---|---|---|---|
| Textos de publicación (brief) | `claude` (CLI local) | `EXPLAINER_TEXT_PROVIDER` | `codex`, `deepseek` |
| Producir el video | `claude` (Claude Code) | `EXPLAINER_AGENT` | `codex` |
| Planificador semanal | `deepseek` (API) | `PLANNER_PROVIDER` | `claude`, `codex` |

- Los CLIs se encuentran solos aunque no estén en el PATH del servidor (nvm, `~/.local/bin`, app de ChatGPT). Para fijarlos: `AGENT_CLAUDE_BIN`, `AGENT_CODEX_BIN`.
- Agregar un proveedor nuevo (otra API) es un adaptador más: `AIPort` para textos y `AgentRunnerPort` para producir. Quien llama no cambia (`get_text_ai(nombre)`, `get_agent(nombre)`).
- Títulos «provocadores pero verdaderos»: el prompt (`briefs.SYSTEM_PROMPT`) + la `strategy` de la categoría. Ejemplo real generado para «Cómo nació la inteligencia artificial»: «El verano de 1956 en que nació la inteligencia artificial» / alternativa «Cómo la IA pasó de una promesa imposible a decidir tu vida».

## 6. Programación por categoría

1. **Automatización** (`POST /schedule/categories`): categoría + canales (`youtube:alias`, `tiktok:alias`, `facebook:alias`) + cadencia (`daily`, `alternate` = lun/mié/vie/dom, o `custom`) + horas UTC. Crea un horario por canal con `niche_filter = categoría`. Guardar de nuevo reemplaza los horarios de esa categoría en esos canales (no duplica). El tick del scheduler publica el video listo más antiguo de **esa** categoría.
2. **Planificador con IA** (`POST /schedule/planner/chat`): conversación con DeepSeek. Recibe categorías, estrategias, diseños válidos, horarios y temas ya producidos, y propone por día: categoría, diseño, tema, ángulo y hora. Se validan los ítems (categoría existe, diseño válido para la categoría, fecha dentro de la semana); los inválidos se corrigen o se descartan con aviso.
3. **Plan guardado** (`/schedule/planner/items`): borrador que tú apruebas. «Producir» lanza la producción con agente (con grabación automática por defecto), así el video entra solo a la cola de su categoría. NodeMotion queda como recordatorio: necesita una canción.

4. **Piloto automático** (`src/core/automation.py`, corre en cada tick del scheduler antes de publicar):
   - **Producción automática** (`SCHEDULE_AUTOPRODUCE_ENABLED`, 48 h): cada ítem del plan guardado cuya fecha cae en las próximas 48 h se manda al agente con grabación automática. Uno a la vez.
   - **Pregrabación** (`SCHEDULE_PRERECORD_ENABLED`, 12 h): si un horario de una categoría explainer vence pronto y no hay video grabado para ese canal, se graba completo el video listo más antiguo de la categoría.
   - Después, `engine.process_tick` asigna el video grabado más antiguo de la categoría al horario y lo publica.
   - Cadena completa: plan aprobado → producido → grabado → publicado, sin tocar nada.

**Requisito para que todo esto corra:** `ENABLE_AUTO_PUBLISHING=true` en el `.env` (hoy está en `false`: el scheduler no arranca y nada se publica solo). Se dejó así a propósito, porque activarlo publica en tus canales reales.

Nota «día por medio»: se basa en días de la semana (lun, mié, vie, dom), así que domingo y lunes quedan seguidos. Si necesitas alternancia estricta entre semanas, hace falta un horario por fecha (no existe todavía).

### 6.1 Dashboard

El dashboard tiene el panel **Red de canales NODE**: una tarjeta por categoría con su embudo (produciendo → listos → grabados → publicados), canales, días, horas y próxima publicación, el estado del piloto automático y qué le falta para publicar sola (publicación automática apagada, sin horarios, sin contenido, categoría vacía). Datos de `GET /categories/overview`, que se refresca cada 30 s.

## 7. API nueva (resumen)

```
GET  /api/v1/categories                         árbol + strategy
GET  /api/v1/categories/overview                resumen por categoría para el dashboard
GET  /api/v1/explainer/options                  agentes y proveedores instalados
GET  /api/v1/explainer/designs?category=        diseños de la categoría (+ preview)
POST /api/v1/explainer/briefs                   textos para un tema (no guarda)
POST /api/v1/explainer/productions              producir con agente (multipart: payload + files)
GET  /api/v1/explainer/productions[?category=]  ·  GET /…/{id} (con log)  ·  POST /…/{id}/resume
GET  /api/v1/explainer/videos[?category=]       Preparación
POST /api/v1/explainer/videos/{id}/record       grabar (10 s, 20 s o completo) y publicar
POST /api/v1/explainer/videos/{id}/publish-texts  publish.json para un video ya hecho
GET  /api/v1/explainer/files/{ruta}             kit y carpetas de categoría para el iframe y las portadas
GET  /api/v1/voice/keys · POST /voice/keys/probe · POST /voice/preview
GET|POST /api/v1/schedule/categories
POST /api/v1/schedule/planner/chat · GET|POST /schedule/planner/items
DELETE /schedule/planner/items/{id} · POST /schedule/planner/items/{id}/produce
```

## 8. Pruebas

**Unitarias** (`.venv/bin/python -m pytest tests/unit -q`): 340 pasan, 1 falla. La falla (`test_drafts.py::test_create_draft_rejects_unsupported_engine_400`) ya existía: la prueba busca una plantilla de letras que todavía no esté validada para HyperFrames, y hoy ya están todas validadas. Nuevas:

- `test_voice_gemini.py` (10): rotación por cuota diaria y por 402, error transitorio, cambio de modelo, todo agotado, prueba de claves y que las claves nunca se expongan.
- `test_agent_runners.py` (11): CLIs falsos. Prompt por stdin, permisos acotados (nunca `Bash` libre), sandbox de Codex, timeout que mata el proceso y reintento de JSON inválido.
- `test_automation.py` (7): próxima ocurrencia, pregrabación (una por categoría, solo si el horario está cerca y no hay video grabado), producción automática del plan, resumen del dashboard, log legible.
- `test_explainer_production.py` (22): brief con estrategia, `publish.json`, producción completa con kit, agente y render falsos (listo, incompleto → retomar, grabación automática a `output/node_politics/…`), validaciones, planificador, automatización y rutas HTTP (incluido que el sandbox no sirva `.env` ni `.state/`).

**Reales** (2026-10-10):

| Prueba | Resultado |
|---|---|
| Las 7 claves de Gemini con un pedido mínimo de voz | 6 OK; `GEMINI_API_KEY4` da **402: créditos prepagados agotados** |
| `claude -p` y `codex exec` devolviendo JSON | OK (7 s y 13 s) |
| Planificador con DeepSeek, semana del 12-oct | OK (42 s): 7 ítems de Tech a las 15:00, 4 de History día por medio a las 18:00, diseños válidos, sin repetir temas producidos |
| Brief de «Cómo nació la inteligencia artificial» por HTTP | OK (30 s) |
| Textos de publicación para apolo-1202 y turing-enigma (no tenían) | OK: ahora los 6 videos listos son publicables |
| Grabación real de 10 s de turing-enigma | OK: 1920×1080 y 1080×1920 con audio en `output/node_tech/binary/turing-enigma/preview-10s/` (grabado cuando binary todavía era de NodeTech; hoy turing-enigma es NodeHistory) |
| Producción real con Claude Code de «Cómo nació la inteligencia artificial» (NodeTech, binary) | OK, unos 50 min: investigó con fuentes, 4 fotos con licencia, guion de 17 segmentos, voz Charon (124 ppm, WER≈0,014), 54 planos, `check` con 0 errores, revisión visual hecha. Quedó «listo» en Preparación y publicable |
| Web en el navegador: ventanas de categoría, modal (textos con DeepSeek, preview del diseño, voz), planificador, dashboard | OK |

## 9. Riesgos y pendientes

- **`--reload` corta producciones.** El servidor de desarrollo reinicia el proceso al cambiar cualquier `.py`, y la producción o el render en curso se pierden (quedan `failed`; se retoman). En la máquina de producción, arrancar sin `--reload`.
- **Resuelto:** rough → NodeTech, binary y los otros 9 → NodeHistory. Excepción: `nodetech/nacimiento-ia-dartmouth` es binary pero se produjo para NodeTech (su cierre dice NODETECH); su `manifest.json` fija la categoría.
- **Clave 4 de Gemini sin créditos.** Recárgala o quítala del `.env`. Mientras tanto queda marcada como agotada y no gasta pedidos.
- **Duración de una producción.** Investigación, voz, Whisper large-v3 en CPU y revisión: calcula de 30 a 90 min por video. Se producen de a uno.
- **Render completo:** unos 15–20 min por formato en binary/rough; más en los diseños nuevos.
- **Cola en memoria:** las grabaciones (`/explainer/jobs`) viven en memoria del proceso; las producciones sí se guardan en `data/explainer/productions.json`.
