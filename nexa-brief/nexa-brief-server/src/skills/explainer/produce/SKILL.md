# SKILL · Producir un video con un diseño que YA existe (vía rápida)

> **Punto de entrada único** para cualquier agente (Claude Code, Codex, otro) al que le piden un video
> de NodeTech, NodeHistory, NodeEconomy… con un diseño del kit (`rough`, `binary`, `acuarela`, …).
> Rutas relativas a `nexa-brief-server/`. Todo lo de abajo ya existe: el trabajo es **armar datos**
> (guion, `.json`, textos), no estudiar el motor ni rehacer componentes.

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

## 2. Pasos (comandos exactos)

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new <diseño> <id> --minutes <N> --title "<título>"   # crea en producción (carpeta de la categoría)
```
1. **PLAN.md**: tema, ángulo, 1 punto crítico, hechos con URL + fecha (dos fuentes para cifras clave), mapa visual.
2. **Guion** `assets/script.json` (formato del ejemplo): palabras según `kit.py status <id>`; números en palabras.
3. **Medios**: `media.py search` / `get` (fotos .jpg; clips .mp4 con `--type video --source pixabay|commons`).
4. **Voz**: `kit.py voice <id>` · **Transcripción**: `kit.py transcribe <id>` (Whisper en CPU: 30–90 min;
   esperar UNA vez con `run_in_background` o un solo bucle `until`, no consultar cada minuto) · `kit.py outro <id>`.
5. **Storyboard** `assets/storyboard.json`: anclas = palabras EXACTAS de `assets/lyrics.json`; un plano cada
   2,5–6 s; 1.º beat `<familia>.introv1|introv2` en `t: 0`; 2–8 `common.clip` en 13 min, nunca seguidos.
   Para muchos planos, escribí un script generador (lee lyrics + mapa visual) en `work/` en vez de redactar a mano.
6. **Validar**: `kit.py check <id>` → 0 errores · `kit.py sheet <id> --orient 16x9` → mirar UNA hoja.
7. **Cierre**: `kit.py manifest <id>` · `kit.py usage <id>`.
8. **Publicación v2** `publish.json` (copiar la forma de `nodetech/vago-pero-emocionante/publish.json`) →
   `.venv/bin/python -m src.core.explainer.publishing check <id>` en 0 errores (no `build` si hay `render/*.mp4`).

**No renderizar.** La revisión humana es en vivo: `src/templates/<categoría>/<id>/index.html` servido por
HTTP (la app lo muestra en `/plantillas?cat=<categoría>`). `kit.py render` solo si el humano lo pide.

## 3. Componentes propios (solo si el catálogo no dibuja el objeto del tema)

- Máximo 2–3 por video. Antes, buscá en `QUICK.md` (`<familia>.diagram`, `chart`, `flow`… suelen alcanzar).
- Copiá la forma de un componente real del mismo diseño, sin leer el motor:
  `src/templates/nodetech/programadores-nueva-era/assets/components/rough-review-lens.js` (rough) ·
  `src/templates/nodehistory/y2k-medianoche/assets/components/y2kfield.js` (binary).
- Nombre `<familia>.<camelCase>`, archivo en `assets/components/`, registrado en `components` del `config.json`.
- `kit.py components <id>` → 0 errores y mirar `work/components/<nombre>.png`. Máximo 2 rondas.
- Se puede delegar el borrador a DeepSeek (`kit.py delegate <id> component_draft --prompt-file work/pedido-<n>.md`).

## 4. Presupuesto (obligatorio)

- Modelo/nivel: storyboard, textos y pasos mecánicos → modelo económico (Sonnet / effort low-medium);
  solo la revisión final con el modelo grande. Esperas largas (voz, Whisper) = 1 espera, no sondeo.
- No re-leer archivos ya leídos; no abrir imágenes salvo la hoja final y las miniaturas.
- Si algo falla dos veces, parar y reportar en vez de explorar el motor.

## 5. Reglas

Sin `git commit/push`; no publicar ni grabar salvo pedido explícito; no leer `.env`, `accounts.json`,
`client_secret*.json`, `users.json` ni tokens; no editar `engine/` ni `designs/` (eso es trabajo de sandbox).
Reporte final corto: pasos hechos, títulos A/B/C, primer comentario, clips usados, avisos de `check`.
