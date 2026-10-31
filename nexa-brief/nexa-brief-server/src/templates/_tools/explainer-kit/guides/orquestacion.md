# Orquestación · quién hace qué al producir un video explicativo

> Para **cualquier IA** (Claude Code, Codex, otra) que reciba un pedido como
> *"quiero un video de este tipo en tech, hacé todo el estudio, delegá en DeepSeek, que dure 9 a 14 min,
> solo preparación"*. Leé esto primero: dice por dónde empezar, qué delegar, qué queda anotado y qué
> NO hacer. El pipeline paso a paso está en `../AGENTS.md`; esto es la capa de arriba (equipo y costos).

## 1. Por dónde empezar (siempre igual)

1. **Entender el pedido** y completarlo con estos valores por defecto (el humano manda si dice otra cosa):

   | campo | por defecto |
   |---|---|
   | categoría / diseño | tecnología → `node_tech` / `rough` (PROTOTIPO) · historia → `node_history` / `binary` u otro de NodeHistory |
   | duración | `--minutes 12` si pide "9 a 14 min" (`lengths.json`: el guion declara `target_minutes`) |
   | grabar | **NO**. "Solo preparación" = pasos 1–9, sin `kit.py render` ni grabación desde la app |
   | publicar | **nunca** desde un agente |
   | commits | **nunca** (el humano decide cuándo) |

2. **Elegir el tema con datos de hoy** si el humano no lo dio: buscá en la web lo que pasó en los
   últimos 30 días en el área (noticias de medios reconocidos + datos de fuentes primarias). Anotá 2–3
   candidatos con por qué cada uno, elegí uno y dejalo escrito en `PLAN.md §1` (y en el reporte).
3. **Lanzar la producción** por el backend (así queda en la app, con log, estado y registro de uso):
   - Web: NodeTech → Crear video → agente **Codex** → duración → (sin grabar).
   - API (desde el servidor): `POST /api/v1/explainer/productions` con `category_path`, `design`, `topic`,
     `description`, `agent: "codex"`, `minutes`, `auto_record: false` y, si lo escribiste vos, el `brief`.
   - Terminal (sin backend): ver `../FLUJO.md §3` (`codex exec …` con el pedido estándar).
4. **Supervisar**: el log de la producción (`data/explainer/logs/<id>.log`), `kit.py status <id>`, las
   hojas `work/sheet-*.png` y `work/components/*.png`. Lo que no está bien se corrige (o se retoma).
5. **Cerrar**: `kit.py usage <id>` → `usage.json` y el reporte de `AGENTS.md §6` + lo de §5 de esta guía.

## 2. El equipo (fuente: `src/skills/models/roles.json`)

| rol | quién | cómo se le pide | se paga |
|---|---|---|---|
| producer · research · script · storyboard · visual_review | **Codex** (configuración habitual del productor, hoy `gpt-6-luna`, xhigh) | lo lanza el backend (`codex exec --json`) | suscripción ChatGPT (local) |
| component_draft · copy_draft · fact_check | **DeepSeek** (`deepseek-v4-flash`) | `kit.py delegate <id> <rol> --prompt-file …` | API (tokens) |
| text_draft · dialogue_draft | **Codex** (`gpt-6.1-terra`, medium) | `kit.py delegate <id> <rol> --prompt-file …` | suscripción ChatGPT (local) |
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

## 6. Reporte final (además de AGENTS.md §6)

1. Tema elegido y por qué (y los candidatos descartados).
2. Qué se delegó, a qué modelo, cuántas vueltas y qué se aceptó o se rehízo.
3. `usage.json`: tokens por proveedor y las iteraciones de cada paso.
4. Estado: listo para grabar (sin grabar) + lo que el humano tiene que mirar o decidir.
