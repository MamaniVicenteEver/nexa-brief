# Fábrica de prototipos: un punto de entrada estándar para crear plantillas nuevas

Fecha: 2026-10-24 · Servidor: alfred-server · Estado: plan, sin implementar

## Objetivo

Crear una **plantilla nueva** (un prototipo del que después salen cientos de videos, no un video
con una plantilla existente) de una sola forma, siempre igual:

1. El usuario deja videos/imágenes en `sandbox/referencias/<categoría>/<idea>/` y escribe qué quiere.
2. Abre un chat (Claude Code o Codex, en VS Code o en la web) y pega **una URL**.
3. Un agente líder (Claude Opus 5.5 high o Codex Sol high) lee lo mínimo, analiza la referencia,
   decide qué reutilizar, construye los **componentes reutilizables** y delega lo mecánico a
   **Codex Luna xhigh** (gpt-6-luna).
4. El resultado aparece en https://nexa-brief.everdev.space/plantillas?cat=sandbox con su ficha
   Info y sus tokens; el usuario opina; se itera; cuando está pulido, se pasa a producción.

Métrica de éxito: cada prototipo nuevo cuesta menos tokens que el anterior de su motor, y la
primera plantilla de un motor deja componentes que las siguientes solo llaman.

## Qué ya existe y se reutiliza (no se reconstruye)

| Pieza | Dónde | Uso en la fábrica |
|---|---|---|
| Guía del sandbox | `src/templates/sandbox/SANDBOX.md` | Mapa de motores, receta, checklist |
| Referencias | `sandbox/referencias/<cat>/<idea>/` + README | Entrada del usuario |
| Ficha + tokens | `info.json`, `work/usage.jsonl`, `_tools/sandbox/{info,costs}.py` | Registro y comparación con la base |
| Reproductor + miniaturas | `MediaPlayerModal`, `_tools/player/bridge.js`, `sandbox_thumbs.py` | Revisión visual gratis |
| Roles de modelos | `src/skills/models/roles.json` + `adapters/models/hub.py` | Quién hace cada trabajo |
| Delegar por API | `explainer-kit/tools/delegate.py` (DeepSeek) | Borradores baratos |
| Agentes en el servidor | `adapters/agent/infrastructure/cli_runner.py` (Claude Code / Codex con permisos acotados y conteo de tokens) | Lanzar el líder desde la web |
| Transcripción | `explainer-kit/tools/transcribe.py` (Whisper large-v3) | Letras/narración de la referencia |
| Lanzador Codex | `~/codex/nexa-brief/run-task.sh` (fuera del repo) | Se versiona y se vuelve el delegado estándar |

## Diseño

### 1. Un solo punto de entrada: `PROTOTIPO.md`

Archivo único, versionado, en `nexa-brief-server/src/templates/sandbox/PROTOTIPO.md`, y servido
como texto por la API para que se pueda pegar como URL:

- `GET /api/v1/agent/prototipo` → el `PROTOTIPO.md` (instrucciones generales).
- `GET /api/v1/agent/prototipo/{categoria}/{idea}` → el **brief de esa idea** ya armado: el
  PROTOTIPO.md + las notas del usuario (`NOTAS.md`) + lista de archivos de referencia con sus URLs +
  la categoría + las 2–3 plantillas existentes más parecidas (por motor y categoría) con su
  `info.json` resumido. Pegar esta URL es todo lo que hace falta.

`PROTOTIPO.md` no repite lo que ya está en otros documentos: enlaza. Contenido (≤ 150 líneas):
1. Dónde trabajar (ssh alfred-server, ruta del repo) y qué NO tocar (producción, `_tools/explainer-kit`).
2. Presupuesto de lectura: qué leer y en qué orden (este archivo → SANDBOX.md → el AGENTS.md del
   motor elegido → el `info.json` de las plantillas parecidas). Nada más sin motivo.
3. El flujo por fases con entregables (abajo).
4. Reglas de delegación: qué hace el líder y qué delega, con el comando exacto.
5. Contrato de "componente reutilizable" (abajo).
6. Checklist de salida y cómo registrar tokens.

Para los clientes que no leen URLs (o para ahorrar el fetch), lo mismo queda como **skill** de
Claude Code (`.claude/skills/nuevo-prototipo/SKILL.md`) y en `AGENTS.md` de la raíz para Codex:
ambos son 5 líneas que apuntan a `PROTOTIPO.md`. Una sola fuente de verdad.

### 2. Flujo estándar por fases (lo que hace el agente, siempre igual)

| Fase | Quién | Entregable en `sandbox/<cat>/<id>/` | Puerta |
|---|---|---|---|
| 0. Arranque | líder | `info.json` (init) con `based_on` y `is_new_design` | — |
| 1. Análisis de referencia | **Luna** (delegado) | `work/ref/`: cortes de escena (ffmpeg scene detect), hoja de contactos, frames clave, paleta, tipografías estimadas, ritmo (duración por plano), transcripción (Whisper) → `ANALISIS.md` + `storyboard.json` | el líder revisa la hoja de contactos (1 imagen) |
| 2. Decisión | líder | `PLAN.md`: motor a usar (existente vs nuevo), componentes que reutiliza, componentes nuevos a crear, qué audio/JSON existentes sirven | si el motor es nuevo, el usuario confirma |
| 3. Componentes | líder | componentes reutilizables nuevos en el motor (`_engine`, `_proto`, diseño del kit…) + su entrada en `components.json` | demo de cada componente en el navegador |
| 4. Ensamblado | **Luna** | `index.html`, `assets/` (escenas JSON, medios, voz/TTS, sincronía con audio existente) | — |
| 5. Comparación visual | **Luna** | `work/compare/`: frames de la plantilla junto a los de la referencia en los mismos tiempos | el líder revisa 1 imagen comparativa |
| 6. Cierre | líder | `info.json` status `lista para revisar`, tokens registrados, notas para el próximo | aparece en el sandbox |
| 7. Opinión | usuario | `FEEDBACK.md` (o desde la web) | vuelve a fase 3/4 |

Regla de costo: el líder **no** extrae frames, no busca medios, no escribe JSON de escenas largos,
no corre pruebas repetitivas. Eso es de Luna. El líder lee resúmenes e imágenes de una sola hoja.

### 3. Componentes reutilizables (para que la segunda plantilla cueste ¼)

Cada motor tiene un `components.json` (formato común):
`{ "id", "file", "kind": "escena|transicion|texto|mapa|personaje|fx", "params": {…schema…},
"demo": "ruta a demo html", "used_by": ["plantilla-a"], "since": "fecha" }`.
El explainer-kit ya tiene componentes por diseño: se mapea a este mismo formato en vez de crear
otro. Fase 2 siempre empieza consultando estos catálogos; un componente nuevo solo si no existe.

### 4. Delegación estándar (versionada, no en el home del servidor)

`scripts/agents/delegate.sh <tarea> <cat>/<id>` en el repo (sucesor de `run-task.sh`):
brief en `sandbox/<cat>/<id>/work/briefs/<tarea>.md`, log en `work/logs/`, resultado en
`work/results/<tarea>.md`, tokens a `work/usage.jsonl` automáticamente. El líder escribe el brief
con una **plantilla de brief** fija (`_tools/sandbox/BRIEF.template.md`: objetivo, archivos que
puede tocar, entregable, cómo verificar). Para borradores de texto/JSON baratos sigue existiendo
`kit.py delegate` (DeepSeek). Los roles nuevos (`prototype_lead`, `prototype_worker`) se agregan a
`roles.json`, así cambiar de modelo es una línea.

### 5. Desde la web (después de lo anterior)

En la pestaña Referencias del sandbox:
- **"Nueva idea"**: subir videos/imágenes + texto + categoría → crea
  `referencias/<cat>/<idea>/` con `NOTAS.md`.
- En cada idea: **"Copiar URL para el chat"** (la del brief) y **"Copiar prompt"** (una línea:
  "Leé <URL> y creá el prototipo"). Esto cubre VS Code / Claude Code / Codex manual.
- **"Crear prototipo en el servidor"** (opcional): lanza el líder con `cli_runner` (Claude Code o
  Codex, permisos acotados a `sandbox/<cat>/<id>` + los comandos de la fábrica), muestra el log en
  vivo y los tokens. Reutiliza el patrón de `producer.py` de los videos explainer.

## Requisito previo de seguridad (bloqueante para la parte web)

Hoy `https://nexa-brief.everdev.space/api/...` responde **sin sesión**: probé `GET
/api/v1/explainer/sandbox` → 200 y `POST …/promote` llega al endpoint. Cualquiera con la URL puede
leer el sandbox y pasar plantillas a producción. Antes de exponer endpoints que lancen agentes o
creen archivos, la API debe exigir la sesión (el proxy de Next ya tiene la de NextAuth) o al menos
bloquear desde fuera las rutas de escritura. Las URLs de lectura de `PROTOTIPO.md` pueden quedar
públicas si no contienen secretos, o protegidas con un token en la URL.

## Plan de implementación

| Fase | Qué | Quién | Costo |
|---|---|---|---|
| A | Seguridad: sesión obligatoria en la API (o bloqueo de escrituras públicas) | Codex | ~½ día |
| B | `PROTOTIPO.md`, plantilla de brief, `components.json` (formato + catálogo inicial de los motores existentes), skill/AGENTS apuntando | líder escribe PROTOTIPO.md; Luna arma catálogos | ~1 día |
| C | Herramientas de la fábrica: `analyze_ref.py` (escenas, contactos, paleta, transcripción), `compare.py`, `delegate.sh` versionado con registro de tokens | Codex | ~1 día |
| D | Endpoints `/agent/prototipo[/cat/idea]` + "Nueva idea" + "Copiar URL/prompt" en la web | Codex | ~1 día |
| E | Piloto real: una referencia → prototipo, midiendo tokens por fase; ajustar PROTOTIPO.md con lo aprendido | líder + Luna | 1 prototipo |
| F | "Crear prototipo en el servidor" desde la web (cli_runner, log en vivo) | Codex | ~1 día, después del piloto |

Orden recomendado: A → B → C → E (piloto desde VS Code pegando la URL) → D → F. El piloto antes
de la web, porque es lo que valida que el estándar realmente ahorra tokens; la web solo lo hace
más cómodo.

## Riesgos

- **Un estándar demasiado largo cuesta tokens en cada lectura.** PROTOTIPO.md se limita a ~150
  líneas y enlaza; los catálogos se leen filtrados (por motor), no completos.
- **Primera plantilla de un motor nuevo**: siempre será cara (es la base). El ahorro se mide en
  la segunda en adelante.
- **Delegación mal especificada** rehace trabajo: por eso la plantilla de brief y las puertas
  con una sola imagen de revisión.
- **Tokens de chats manuales (VS Code)**: Claude Code no reporta sus tokens al repo
  automáticamente; el cierre pide registrarlos con `info.py add-usage` (con el total que muestra
  `/cost`). Los lanzados desde el servidor sí quedan registrados solos.
