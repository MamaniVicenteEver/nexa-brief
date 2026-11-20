# Addendum de orquestación para explicativos

Aplica primero [ORQUESTACION.md](../../../../skills/ORQUESTACION.md) y [CALIDAD.md](../../../../skills/CALIDAD.md). Este addendum conserva la operación específica del kit.

## Selección de actualidad y ejecución

Si el humano no dio tema, busca novedades de los últimos 30 días en el área,
con fuentes primarias y medios reconocidos; registra dos o tres candidatos,
el motivo de la elección y los descartados en `PLAN.md` y en el informe.
El backend permite iniciar una producción en la aplicación o mediante
`POST /api/v1/explainer/productions`; para solo preparación usa `auto_record: false`.
Supervisa el log, `kit.py status <id>` y las hojas de revisión del episodio.

## 2. El equipo (fuente: `src/skills/models/roles.json`)

| rol | quién | cómo se le pide | se paga |
|---|---|---|---|
| producer · research · script · storyboard · visual_review | **Codex** (`gpt-6.1-terra`, high; alternativa `gpt-6-luna`, max) | lo lanza el backend (`codex exec --json`) | suscripción ChatGPT (local) |
| component_draft · copy_draft · fact_check | **DeepSeek** (`deepseek-v4-flash`) | `kit.py delegate <id> <rol> --prompt-file …` | API (tokens) |
| text_draft · dialogue_draft | **Codex** (`gpt-6.1-terra`, high) | `kit.py delegate <id> <rol> --prompt-file …` | suscripción ChatGPT (local) |
| voice | **Gemini TTS** (cadena del diseño, 7 claves) | `kit.py voice <id>` | API (tokens) |
| transcribe | **Whisper large-v3** | `kit.py transcribe <id>` | local |

En producciones del pipeline, el host ejecuta voz y transcripción entre las corridas del agente;
los comandos de la tabla son para uso manual fuera del pipeline. El agente deja `work/phase.json`
con `{"phase":"script_ready"}` y termina para que el host los ejecute.
| planner · copy (NodeMotion) | DeepSeek | backend | API |

- **Codex corre SOLO con la sesión local** (`codex login` con ChatGPT). El runner borra `OPENAI_API_KEY`
  y fuerza `forced_login_method=chatgpt`: si no hay sesión, falla en vez de cobrar por API.
- **Claude Code** sirve igual de productor (`agent: "claude"`), también por suscripción.
- Cambiar quién hace un rol = editar `roles.json` (sin tocar código). El backend lo lee con
  `src/adapters/models/hub.py` (`provider_for`, `agent_for`, `text_for`, `describe`).
- `hub.describe()` informa el modelo registrado para cada rol. En la ejecución real, `kit.py delegate`
  pasa el modelo y `reasoning_effort` del rol a `codex exec`; productor, voz y DeepSeek conservan su
  configuración actual.

## 3. Qué delegar (y qué no)

El productor **piensa y decide**; delega borradores o segundas lecturas y revisa lo que vuelve. Para
borradores de texto y diálogo, usa Terra cuando aporte una primera versión útil basada en el pedido y
el contexto del video. El productor conserva la decisión y la edición final.

| delegá | cuándo | cómo |
|---|---|---|
| `component_draft` | un componente propio con forma clara (gráfico, dispositivo, diagrama) | pedido en `work/pedido-<nombre>.md` con nombre, parámetros, qué se dibuja y en qué plano; `--out assets/components/<nombre>.js`; después `kit.py components <id>` y **mirar** la hoja |
| `fact_check` | con el guion terminado, ANTES de la voz | `--prompt-file work/pedido-fact.md --context assets/script.json --context PLAN.md --out work/fact-check.md`; corregí lo grave |
| `copy_draft` | paso 9, para tener opciones de títulos/miniaturas/comentario | `--context assets/script.json --context PLAN.md --out work/copy-draft.json`; elegí y ajustá con las estrategias activas |
| `text_draft` | cuando convenga una primera versión de texto narrativo, descripción o material editorial | `--prompt-file work/pedido-texto.md --context PLAN.md --context assets/script.json --out work/borrador-texto.md` |
| `dialogue_draft` | escenas con intercambio de voces o diálogos de personajes | `--prompt-file work/pedido-dialogo.md --context PLAN.md --context assets/script.json --out work/borrador-dialogo.md` |

Ejemplos completos, desde `nexa-brief-server/`:

```bash
.venv/bin/python src/templates/_tools/explainer-kit/tools/kit.py delegate <id> text_draft \
  --prompt-file work/pedido-texto.md --context PLAN.md --context assets/script.json --out work/borrador-texto.md
.venv/bin/python src/templates/_tools/explainer-kit/tools/kit.py delegate <id> dialogue_draft \
  --prompt-file work/pedido-dialogo.md --context PLAN.md --context assets/script.json --out work/borrador-dialogo.md
```

Las salidas Terra son Markdown y se guardan dentro del video junto con el registro de la vuelta. No
delegues la investigación con fuentes, el punto crítico, el storyboard ni la revisión con ojos. Si un
borrador no sirve tras 2 vueltas, hacelo vos.

## 4. Registro de uso (automático)

Todo queda en `<video>/work/usage.jsonl`, una línea por llamada:

| quién escribe | qué |
|---|---|
| backend (al terminar cada corrida del agente) | Codex/Claude: tokens de entrada, caché, salida y razonamiento (suma de sus vueltas), segundos |
| `kit.py delegate` | DeepSeek/Codex: proveedor, modelo, tokens, segundos, vuelta N por rol+archivo (y `work/delegate/*.md` con pedido y respuesta) |
| `kit.py voice` (narrate.py) | Gemini TTS: modelo y tokens de cada parte, fallos de cuota |
| cada comando del kit | `check`, `components`, `sheet`, `transcribe` (Whisper)…: cuántas vueltas y cuánto tardó |

`kit.py usage <id>` arma **`<video>/usage.json`**: totales, por proveedor, por modelo, por rol, tokens
pagos por API y las **iteraciones** de cada paso (cuántas veces corrió `check`, cuántas vueltas tuvo
cada componente…). El orquestador interactivo (una persona o Claude Code en chat) no queda medido:
anotalo a mano en el reporte si hace falta.

## 5. Temas de actualidad (tech)

- **Título alarmista permitido si es verdadero y el video lo contesta con datos** ("¿Se acabó la PC
  barata?", "¿Murió el software?"). Nada de pánico sin cifra ni fuente.
- **Datos de hoy**: cada cifra en PLAN §3 con URL **y fecha**; preferí los últimos 12 meses; el guion
  dice de cuándo es cada dato ("en el último año", "en octubre de 2026"). Dos fuentes para las cifras clave.
- **Imágenes actuales y libres**: Wikimedia Commons (fotos de producto/fábricas con CC), Pexels (genérico
  moderno: servidores, placas, oficinas). Nada de capturas de prensa ni logos como foto principal.
- **Componentes propios del tema**: los gráficos que cuentan la historia (precio que sube, reparto de
  la producción, cuello de botella) se crean y se revisan (paso 3c). Reutilizá el catálogo para lo demás.
- **Apertura NodeTech**: `rough.introv2` = título enorme a la izquierda + foto grande a color a la
  derecha (9:16: foto arriba). La miniatura B es la captura de esa apertura: elegí una foto potente del
  objeto del tema, con fondo oscuro o limpio.
- **Duración 9–14 min**: capítulos con mini-arco y re-gancho cada 2–3 min (`storytelling.md §7`).

## Preferencia editorial del usuario · 2026-11-09

Para títulos, descripciones, guion y diálogos, usar Codex con Terra 6.1/high. Luna/max es la
alternativa Codex. Claude queda como último recurso por indisponibilidad o cuota; un error de
contenido o JSON no autoriza cambiar de proveedor. Consultar `src/skills/models/roles.json`.
Los prompts de texto y diálogo deben sostener interés con frases naturales, preguntas pertinentes,
respuestas conectadas y hechos verificables; respetar formato, personalidad y límites del episodio.
No inventar citas de personas reales. La revisión del productor sigue siendo necesaria.
