# PROTOTIPO — crear una plantilla nueva a partir de una referencia

Punto de entrada único. Si te pasaron este archivo (o su URL) sos el **agente líder** de un
prototipo: una plantilla NUEVA del sandbox de la que después salen cientos de videos. No es hacer
un video con una plantilla que ya existe (para eso: `_tools/explainer-kit/AGENTS.md`).

## 0. Dónde y con qué

- Servidor: `ssh alfred-server`, repo `~/Projects/Git-Projects/nexa-brief/nexa-brief`.
  Todas las rutas de este archivo son relativas a `nexa-brief-server/src/templates/`.
- Herramientas: `_tools/sandbox/` (correlas con `nexa-brief-server/.venv/bin/python`).
- Tu entrada es el **brief de la idea**: `sandbox/referencias/<cat>/<idea>/BRIEF.md` (o la URL
  `/api/v1/agent/prototipo/<cat>/<idea>`): notas del usuario, archivos de referencia, categoría y
  plantillas parecidas que ya existen.
- Si recibís el brief como URL firmada, hacé un GET HTTP directo (curl) y verificá `200 text/markdown`;
  no la uses como búsqueda web. Si no podés leer el brief o no podés ejecutar comandos, detenete
  antes de la fase 0 y avisá: no gastes tokens adivinando.
- El usuario revisa el resultado en https://nexa-brief.everdev.space/plantillas?cat=sandbox
  (local: http://192.168.20.23:3000/es/plantillas?cat=sandbox).
- API :8000 y web :3000 ya corren. No las reinicies. Sin commits salvo que te lo pidan.

## 1. Leé solo esto, en este orden

1. Este archivo.
2. El BRIEF de la idea y su `NOTAS.md`.
3. `_tools/sandbox/engines.json` → elegí el motor más cercano y leé SOLO su doc y su
   `components.json` (o el `catalog.json` del explainer-kit).
4. El `info.json` (campo `notes`) de las plantillas parecidas que lista el brief.
5. `sandbox/SANDBOX.md` solo si algo no queda claro.

No recorras el repo "para entender". Si te falta un dato, buscalo con `rg` puntual.

## 2. Vos decidís, Luna ejecuta

Sos el modelo caro: pensás, diseñás y revisás. El trabajo mecánico lo hace el **trabajador**
(Codex gpt-6-luna xhigh, rol `prototype_worker` en `src/skills/models/roles.json`):

```
_tools/sandbox/delegate.sh <cat>/<id> <tarea> [--bg]
```

1. Copiá `_tools/sandbox/BRIEF.template.md` a `sandbox/<cat>/<id>/work/briefs/<tarea>.md`.
2. Completalo: objetivo, qué leer (rutas exactas), qué archivos puede tocar, entregable y cómo
   verificarlo. Una tarea por brief.
3. Lanzalo. Con `--bg` podés tener hasta 2 en paralelo, siempre que toquen archivos distintos.
4. Leé solo `work/results/<tarea>.md` y las imágenes que pidas. El log únicamente si falló.

**Delegá siempre:** extraer frames y analizar la referencia, buscar y bajar medios, escribir
JSON de escenas largos, sincronizar con audio, ajustes repetitivos, capturas y comparaciones.
**Hacé vos:** decidir el motor, diseñar la estética, crear o modificar componentes
reutilizables, revisar cada entrega y hablar con el usuario.

## 3. Fases (siempre las mismas)

| # | Fase | Comando / entregable | Puerta |
|---|---|---|---|
| 0 | Arranque | `new_prototype.py <cat> <id> --ref <cat>/<idea> --engine <motor> [--based-on <id>] [--new-design]` | — |
| 1 | Análisis | delegar `analizar`: `analyze_ref.py <ref> --out sandbox/<cat>/<id>/work/ref` | vos mirás `contact.jpg` + `ANALISIS.md` |
| 2 | Plan | vos: `PLAN.md` (motor, componentes que reutiliza, componentes nuevos, escenas, audio/JSON existentes que sirven) | si el motor es nuevo → confirmá con el usuario |
| 3 | Componentes | vos: componentes nuevos en el motor + entrada en su `components.json` (`used_by`) | demo de cada uno en el navegador |
| 4 | Ensamblado | delegar `ensamblar`: `index.html`, `assets/` (escenas JSON, medios, voz, sincronía) | — |
| 5 | Comparación | delegar `comparar`: `compare.py <cat>/<id> --ref <mp4>` | vos mirás `compare.jpg`, pedís ajustes (vuelve a 3/4) |
| 6 | Cierre | checklist de abajo | aparece en el sandbox |

Partí siempre de la plantilla más parecida (`--based-on`). Diseño desde cero (`--new-design`)
solo si ningún motor sirve, y avisá antes.

## 4. Componentes reutilizables

La primera plantilla de un motor paga los componentes; las siguientes solo los llaman. Un
componente:
- recibe todo por parámetros: textos, colores, tiempos, medios. Nada propio de un video queda
  escrito dentro.
- vive en la carpeta del motor, no en la plantilla.
- se registra en el `components.json` del motor, con el formato de `_tools/explainer-kit/catalog.json`
  (`name`, `summary`, `tags`, `layer`, `params` con tipos y defaults, `file`, `demo`, `used_by`).
- funciona con el reloj del motor: seek determinista, sin `Date.now()` ni azar sin semilla.
  Tiene que verse igual en vivo, con `?controls=1` y en la grabación.

Antes de crear uno, buscalo en el catálogo. Si existe algo parecido, extendelo con un parámetro.

## 5. Reutilizar lo que ya existe

- **Audio y letras:** las plantillas de NodeMotion traen `song.mp3` + `lyrics.json` (Whisper). La
  voz de los explainer se genera con `kit.py voice` (Gemini TTS) y se transcribe con Whisper.
- **Medios:** fotos y videos de Pexels/Pixabay (ver `media.py` del kit). Ya hay medios dentro de
  las plantillas parecidas.
- **Controles y miniatura:** los da gratis el motor (`_tools/player/bridge.js` con `?controls=1`)
  y la API (miniatura automática). No los programes en la plantilla.

## 6. Presupuesto de tokens

- `info.json` → `is_new_design` y `based_on` siempre completos.
- Meta: una plantilla que sigue a otra cuesta ¼–½ de la base de su motor
  (`_tools/sandbox/info.py show <cat>/<id>` muestra la base y el pronóstico).
- Si vas por más de la mitad del presupuesto, pará y contale al usuario por qué.

## 7. Cierre (checklist)

- [ ] `index.html` carga sin errores de consola, con y sin `?controls=1`.
- [ ] `info.json`: `title`, `summary`, `engine`, `based_on`, `is_new_design`, `libraries`,
      `inputs`, `notes` (lo que el próximo agente tiene que saber) y `status: "lista para revisar"`.
- [ ] Tokens registrados: los del trabajador ya los anotó `delegate.sh`. Los tuyos:
      `info.py add-usage <cat>/<id> --provider claude|codex --model <modelo> --role prototype_lead --in N --out N [--cached N]`
      (Claude Code: `/cost`; Codex: el total del final de la sesión).
- [ ] Componentes nuevos registrados en `components.json` con `used_by`.
- [ ] Respuesta al usuario: URL del sandbox, qué se reutilizó, qué componentes nuevos quedaron,
      tokens totales vs pronóstico y qué falta para producción.

## 8. Prohibido

Tocar plantillas en producción (`nodetech/`, `nodehistory/`, `nodemotion/` fuera de `sandbox/`)
o `_tools/explainer-kit/`. Reiniciar la API o la web. Borrar referencias. Copiar un motor
entero dentro de la plantilla. Editar un `.sh` mientras se está ejecutando.

## Modo smoke (prueba del circuito)

Si el brief dice `mode: smoke`: hacé solo la fase 0 con id `zz-smoke-<idea>` y delegá una tarea
trivial ("escribí work/results/smoke.md con OK"). Registrá tokens, reportá y **borrá la carpeta**.
