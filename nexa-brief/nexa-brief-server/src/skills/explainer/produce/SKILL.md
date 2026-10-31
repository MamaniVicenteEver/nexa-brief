# SKILL · Producir un video con un diseño que YA existe (vía rápida)

> **Punto de entrada único** para cualquier agente (Claude Code, Codex, otro) al que le piden un video
> de NodeTech, NodeHistory, NodeEconomy… con un diseño del kit (`rough`, `binary`, `acuarela`, …).
> Rutas relativas a `nexa-brief-server/`. Todo lo de abajo ya existe: el trabajo es **armar datos**
> (guion, `.json`, textos y componentes propios del tema), sin estudiar el motor ni rehacer los componentes existentes del diseño.

## 0. ¿Es este el camino?

| pedido | dónde | costo |
|---|---|---|
| Video con un diseño existente | **acá** → carpeta de producción `src/templates/<categoría>/<id>/` | bajo |
| Plantilla/diseño NUEVO, réplica de un video de referencia, componente de diseño nuevo | `src/templates/sandbox/` (`sandbox/AGENTS.md`) | alto (estudio) |

**Nunca** producir un video con diseño existente dentro de `sandbox/`.

## 1. Qué leer (y NADA más)

1. Este archivo.
2. `src/templates/_tools/explainer-kit/designs/<diseño>/QUICK.md` — componentes del diseño, parámetros y un
   ejemplo por componente (~70 líneas). **No leas `CATALOG.md`, `engine/`, `designs/*/components/*.js`.**
3. Un storyboard de ejemplo del MISMO diseño: `src/templates/nodetech/vago-pero-emocionante/assets/storyboard.json`
   (rough) o `src/templates/nodehistory/muro-de-berlin/assets/storyboard.json` (binary). Mirá 30 beats, no todo.
4. La estrategia de la categoría: `src/skills/explainer/categories/<categoría>.json` (título, tono, hashtags).
5. Solo si el paso lo pide: la sección puntual de la guía (`guides/storytelling.md §4–7` para el guion,
   `guides/media.md §6` para clips). Nunca guías enteras.

### Estrategia narrativa

`assets/config.json → narrative_id` (por defecto `narrative_amarillista_v1`). Si existe y no es
`narrative_documental_v1`, sus actos (`src/skills/explainer/strategies/narrative/<id>.json`) reemplazan
`storytelling.md §3`; el prompt trae el resumen y `storytelling.md` («Narrativa elegida en el video») las reglas
del guion. Sin duraciones fijas: las decides tú. `kit.py check` valida la forma.
En amarillista, `publish.json` v2 elige por defecto la miniatura C (`common.tabloid`); completa `thumbnail.tabloid` según la estrategia y ejecuta `publishing build` y `publishing check`.
La miniatura C es obligatoria: el bullet rojo con borde amarillo lleva un dato dicho en el guion (referencia «250 PUESTOS»), el 20 % de alerta sobre la identidad del diseño. `publishing check` bloquea si falta.

## 2. Pasos (comandos exactos)

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new <diseño> <id> --minutes <N> --title "<título>"   # crea en producción (carpeta de la categoría)
```
1. **PLAN.md**: tema, ángulo, 1 punto crítico, hechos con URL + fecha (dos fuentes para cifras clave), mapa visual.
2. **Guion** `assets/script.json` (formato del ejemplo): palabras según `kit.py status <id>`; números en palabras.
3. **Medios**: `media.py search` / `get` (fotos .jpg; clips .mp4 con `--type video --source pixabay|commons`). Si el guion nombra una marca, empresa o institución relevante, buscá su logo con `media.py logo-search` / `logo-get` y revisá `guides/media.md §7`.
4. **Voz y transcripción**: en producciones del pipeline el agente NUNCA corre `voice`, `transcribe`, `outro` ni `preview`. Al completar guion, PLAN, medios, componentes y paquete preliminar escribe `work/phase.json` con `{"phase":"script_ready"}` y termina la corrida. El host valida el guion y genera voz y transcripción con cierre. En la continuación, usa el audio y lyrics existentes. Si cambias el guion, escribe de nuevo ese marcador y termina inmediatamente para que el host regenere ambos.
   Fuera del pipeline, el uso manual conserva `kit.py voice <id>` y `kit.py transcribe <id>` tanto en primer plano como con `--background` / `--wait --timeout 20`.
5. **Storyboard** `assets/storyboard.json`: anclas = palabras EXACTAS de `assets/lyrics.json`; un plano cada
   2,5–6 s; 1.º beat `<familia>.introv1|introv2` o la miniatura elegida `common.tabloid` en `t: 0`; 2–8 `common.clip` en 13 min, nunca seguidos.
   Para muchos planos, organizá las anclas con el mapa visual y respetá los comandos autorizados en el prompt.
   Repartí fotos/clips por todos los actos: máximo 75 s sin medio real, foto visible al menos 5 s con movimiento. Cada beat con video visible dura ≥ 8 s; `common.clip` recomienda 12–18 s. En ≥ 8 min incluí al menos dos tramos de video de ≥ 12 s; si el archivo es más corto, usá `loop` o `rate < 1`, sin congelar. El plano preferido es `<diseño>.introv2` con texto grande y foto/video lado a lado (rough/binary: `text`, `src`/`video`, `highlight`, `focus` según diseño), unas 3–5 veces por 10 min. Cerrá con `common.question` hasta el inicio del outro; el audio configurado debe ser `song-with-outro.mp3`.
   El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. Poné `logo` y `logoName` en el beat visual (`rough.photo`, `binary.frame`, `common.clip`, `rough.introv2`, `binary.introv2` o `common.tabloid`); `logoPos`/`logoSize` son opcionales. `common.logo` está obsoleto. Preferí SVG; PNG solo transparente. Nunca inventes un logo.
6. **Validar**: `kit.py check <id>` → 0 errores · `kit.py sheet <id> --orient both` en primer plano → mirar las dos hojas.
7. **Cierre**: `kit.py manifest <id>` · `kit.py usage <id>`.
8. **Publicación v2** `publish.json` (copiar la forma de `nodetech/vago-pero-emocionante/publish.json`) →
   `.venv/bin/python -m src.core.explainer.publishing check <id>` en 0 errores (no `build` si hay `render/*.mp4`).

**No renderizar.** La revisión humana es en vivo: `src/templates/<categoría>/<id>/index.html` servido por
HTTP (la app lo muestra en `/plantillas?cat=<categoría>`). `kit.py render` solo si el humano lo pide.

## 3. Componentes propios del tema

- Para videos de 8 min o más, al menos 4 componentes propios del tema: objetos o mecanismos que vuelven en 2 o más planos o en el clímax. Revisalos en su hoja PNG y usalos en el storyboard.
- `rough.icon` es relleno, no protagonista: el check bloquea el exceso y las rachas; en la narrativa amarillista también bloquea los iconos en golpe/miedo. Alterná fotos, clips y componentes propios.
- Un componente propio o una foto no puede superar 6 usos ni el 15 % de los beats (desde la segunda aparición).
- `common.lyric` y `common.punch`: terminá la ventana en fin de oración o usá `params.text` de hasta 7 palabras.
- Copiá la forma de un componente real del mismo diseño, sin leer el motor:
  `src/templates/nodetech/programadores-nueva-era/assets/components/rough-review-lens.js` (rough) ·
  `src/templates/nodehistory/y2k-medianoche/assets/components/y2kfield.js` (binary).
- Nombre `<familia>.<camelCase>`, archivo en `assets/components/`, registrado en `components` del `config.json`.
- `kit.py components <id>` → mirar `work/components/<nombre>.png`. Máximo 2 rondas por componente; si no aprueba, descartalo y usá el catálogo, aunque no se alcance el mínimo.
- Se puede delegar el borrador a DeepSeek (`kit.py delegate <id> component_draft --prompt-file work/pedido-<n>.md`).
- Para una primera versión de texto o diálogo, considera Terra si ayuda: `text_draft` o `dialogue_draft`
  vía `kit.py delegate`. El resultado es Markdown para revisar; el productor decide qué conservar.

## 4. Presupuesto (obligatorio)

- Modelo/nivel: storyboard, textos y pasos mecánicos → modelo económico (Sonnet / effort low-medium);
  solo la revisión final con el modelo grande. El host se ocupa de voz y Whisper en el pipeline.
- No re-leer archivos ya leídos; no abrir imágenes salvo la hoja final y las miniaturas.
- No pares por un componente, una foto o un check: reemplazá el elemento y continuá con el catálogo. Guardá el trabajo y reportá los errores pendientes. Parar y reportar solo ante fallos de infraestructura (red, cuota, disco). Una consulta manual `--wait` con salida 2 indica que sigue en curso.
- El host limita las corridas y tokens según `production-policy.json`; con storyboard vacío puede pedir una sola corrida de rescate y, ante errores finales, una reparación corta dentro del presupuesto.

## 5. Reglas

Sin `git commit/push`; no publicar ni grabar salvo pedido explícito; no leer `.env`, `accounts.json`,
`client_secret*.json`, `users.json` ni tokens; no editar `engine/` ni `designs/` (eso es trabajo de sandbox).
Reporte final corto: pasos hechos, títulos A/B/C, primer comentario, clips usados, avisos de `check`.
