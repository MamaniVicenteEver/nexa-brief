# AGENTS.md · explainer-kit — cómo producir un video explicativo narrado

> Para **cualquier agente de IA** (Codex, Claude, Gemini, DeepSeek…) o persona.
> Si te dieron un **tema** (y opcionalmente título, descripción o diseño), este archivo te dice
> exactamente qué hacer, en qué orden, con qué herramienta y cuándo un paso está terminado.
> No construyas nada desde cero: el motor, los componentes, la voz y las validaciones ya existen.
> Tu trabajo es **investigar, escribir, elegir, dirigir y verificar**.
>
> **Antes**: `guides/orquestacion.md` (por dónde empezar con un pedido, qué delegar a DeepSeek,
> qué modelo hace cada rol y el registro de tokens `usage.json`).

---

## 0. Qué es esto

Un **kit** para producir en serie documentales narrados (9:16 y 16:9) donde cada frase dibuja algo
en el instante exacto en que la voz lo dice. **Duración: 5 min como mínimo, 10 lo normal, 15 serio,
30 o más si se pide** (`lengths.json`; el guion la declara en `target_minutes`). Hay **diseños** (estilos
visuales, cada uno pensado como un canal):

| diseño | nombre (canal) | para | estilo | voz |
|---|---|---|---|---|
| `binary` | **UNO CERO** | historia, personajes, momentos decisivos | todo dibujado con dígitos 0/1, blanco sobre negro | Charon |
| `rough` | **PROTOTIPO** | tecnología, innovación, inventos, software | dibujado a mano, lima / blanco hueso / negro | Sadaltager |

El kit (`explainer-kit/`) NO pertenece a ningún video: es la fábrica. Cada video vive en
`src/templates/<carpeta>/<video-id>/` (carpeta de su categoría: `nodetech/`, `nodehistory/`, `nodepolitics/`, `nodeeconomy/`) y es **solo datos** (guion, voz, transcripción, storyboard,
fotos). Referencias terminadas para imitar el nivel: `nodehistory/turing-enigma` (binary),
`nodetech/apolo-1202` (rough).

## 1. Reglas no negociables

1. **Solo escribís** en `src/templates/<carpeta>/<tu-video-id>/`. Los componentes que el tema
   necesita también van ahí (`assets/components/`, paso 3c). Nada fuera de esa carpeta
   (ni `templates.json`, ni `_tools/`, ni el backend). Sin `git commit`/`push`. Sin publicar en redes.
2. **Claves**: las herramientas las leen solas de los `.env`. Nunca las imprimas, copies ni pegues.
3. **Verdad**: toda cifra, fecha o nombre del guion tiene fuente en `PLAN.md §3`. Nada de citas
   inventadas. Temas sensibles (muertes, delitos, salud) se cuentan con respeto y sin morbo.
4. **Licencias**: solo imágenes PD / CC0 / CC BY / CC BY-SA / Pexels, con crédito en `CREDITS.md`.
5. **No edites** `index.html` del video ni el motor (`engine/`). Todo se configura con JSON.
6. **Cuota de voz**: cada pedido de TTS cuesta. Generá la voz UNA vez, cuando el guion esté final.

## 2. Roles (un solo agente puede cumplirlos todos, en este orden)

| rol | hace | entrega |
|---|---|---|
| Productor | crea la carpeta, sigue el pipeline, corre `kit.py status` | carpeta + reporte final |
| Investigador | busca y verifica hechos con fuentes | PLAN.md §1–3 |
| Guionista | punto crítico, tesis, arco, gancho, guion para voz | PLAN.md §4–6 + `script.json` |
| Editor de medios | elige y baja fotos con licencia | `assets/media/` + `CREDITS.md` |
| Locutor (automático) | genera la narración | `song.mp3` + control |
| Transcriptor (automático) | tiempos por palabra | `lyrics.json` |
| Director visual | elige componentes por frase y sincroniza | `storyboard.json` |
| Componentista | dibuja los objetos propios del tema que el catálogo no tiene y los revisa con ojos | `assets/components/` + rúbrica aprobada |
| QA | valida y mira la hoja de revisión | correcciones |
| Publicador | textos de YouTube/TikTok + manifest | `publish.json` + `manifest.json` |
| Delegados (DeepSeek, opcional) | borradores de componentes, segunda lectura del guion, opciones de títulos | `kit.py delegate` → `work/delegate/` (lo revisa el productor) |

Qué modelo cumple cada rol: `src/skills/models/roles.json`. Todo uso de modelos (tokens, vueltas) queda
en `work/usage.jsonl` solo; `kit.py usage <id>` arma `usage.json` (ver `guides/orquestacion.md §4`).

## 3. Pipeline (pasos 1–10)

Todos los comandos se corren desde `nexa-brief-server/`:

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py      # y: M=…/tools/media.py
```

### Paso 1 · Elegir diseño e id, crear la carpeta
- Tecnología/innovación → `rough` (NodeTech). Historia/personajes → `binary` u otro diseño de NodeHistory. (Si el humano lo dice, manda él.)
- `kit.py new` crea la carpeta en la categoría del diseño (`niches.json` → categories); `--folder` la fuerza.
- `video-id`: minúsculas con guiones, corto y único (`muro-de-berlin`).
- `.venv/bin/python $K new <diseño> <video-id> --title "Título provisional" --minutes 10`
  (duración objetivo; sin `--minutes` queda el formato corto anterior de 3–4,5 min).
- Crea: `index.html`, `PLAN.md`, `assets/{config,script,storyboard}.json`, `assets/media/`,
  `publish.json`, `manifest.json`, `work/`, `render/`.

### Paso 2 · Investigar y planificar → `PLAN.md`
- Leé `guides/storytelling.md` COMPLETO.
- Investigá con fuentes confiables (enciclopedias, archivos, museos, prensa reconocida, papers).
  Anotá cada hecho con URL en §3 (≥ 2 por minuto de video).
- Decidí el **punto crítico** (un momento, no una biografía), la tesis, la emoción, el gancho, el
  arco con subidas/bajadas, los 4–6 momentos de letra grande (§6), el **mapa visual** con
  componentes de `CATALOG.md` (§7b), el **inventario visual** del tema (§7a: qué objetos hay que
  ver y cuáles hay que crear, `guides/components.md §6.1`) y la lista de medios (§8).
- **Hecho cuando**: ninguna sección vacía; hechos con fuente suficientes (`kit.py status`); el
  inventario visual decidido; el mapa visual cubre todos los segmentos.

### Paso 3 · Guion → `assets/script.json`
- Formato, tonos válidos y reglas de escritura para voz: `guides/storytelling.md §4–6`.
- Segmentos, palabras y capítulos según la duración (`storytelling.md §7`), números en palabras,
  curva de intensidad con el pico en el 60–75 %; en videos ≥ 10 min, capítulos con mini-arco y re-gancho.
- **Hecho cuando**: pasa el checklist de `storytelling.md §6`.

### Paso 3b · Medios → `assets/media/` + `CREDITS.md`
- `guides/media.md`. Buscar: `.venv/bin/python $M search "<consulta en inglés>"`; bajar:
  `.venv/bin/python $M get <video-id> "File:…" nombre.jpg` (anota el crédito solo).
- Fotos según la duración (`kit.py status`): protagonista, lugar/objeto del punto crítico, contraparte, legado.
- **Hecho cuando**: cada foto del mapa visual existe, tiene crédito y (si podés ver imágenes) la miraste.

### Paso 3c · Componentes propios del tema (PLAN §7a)
- `guides/components.md §6` + `prompts/component-author.md`. Se escriben en `assets/components/`.
- `.venv/bin/python $K components <video-id>` → 0 errores; **mirar** `work/components/<nombre>.png`
  y completar la rúbrica de `work/components/review.md`. Máximo 3 rondas por componente.
- **Hecho cuando**: cada componente decidido en 7a está aprobado (o descartado con motivo en PLAN §10)
  y registrado (`kit.py status` paso 3c en ✓).

### Paso 4 · Voz → `assets/song.mp3`
- `.venv/bin/python $K voice <video-id>` (todo automático: voz del diseño, estilos por tono,
  rotación de claves y modelos). Ver `guides/voice.md`.
- **Hecho cuando**: `work/narration.qc.json` sin `faltan`/`sobran` reales (ver cómo distinguir
  alucinaciones de Whisper en `voice.md §2`).

### Paso 5 · Transcripción → `assets/lyrics.json` (+ cierre con voz)
- `.venv/bin/python $K transcribe <video-id>`. Al terminar pega solo el **cierre con voz del canal**
  (gracias · like · suscríbete · campana · apoyo) desde `explainer-kit/outro/`: el audio final es
  `assets/song-with-outro.mp3`. El cierre NO se escribe en el guion ni se genera con TTS, y el
  storyboard no lleva el beat de cierre (lo pone el motor). Si se cambia la voz: `kit.py outro <id>`.

### Paso 6 · Storyboard → `assets/storyboard.json`
- `guides/storyboard.md` (reglas de dirección, transiciones, tabla idea → componente) y
  `CATALOG.md` (nombres y parámetros exactos). Anclas copiadas de `lyrics.json` (cifras en números).
- El cierre del canal NO se agrega: lo pone el motor.

### Paso 7 · Validar
- `.venv/bin/python $K check <video-id>` → **0 errores**. Avisos: corregir o justificar en PLAN §10.

### Paso 8 · Revisar con ojos
- `.venv/bin/python $K sheet <video-id> --orient both` → mirar `work/sheet-9x16.png` y `sheet-16x9.png`
  con el checklist de `guides/qa.md`. Corregir y repetir 6–8 hasta que esté limpio.
- Si no podés ver imágenes: dejalo dicho en el reporte (`revisión visual pendiente`).

### Paso 9 · Publicación y manifest

**NodeTech (categorías con perfil en `src/skills/explainer/categories/`)**: el paquete v2 de
`guides/publish-package.md` (intro, 3 títulos, miniaturas A/B, descripción por bloques, fuentes,
créditos, tags, comentario fijado) → `python -m src.core.explainer.publishing build <id>` y `check <id>`
con 0 errores. Las demás categorías:
- Escribir `publish.json` (`guides/manifest.md`): título YouTube, descripción con créditos (y los
  capítulos de `manifest.chapters` si el video tiene), tags, texto TikTok, texto de miniatura y
  `thumbnail_image` (la foto de la miniatura B, `guides/manifest.md`).
  **Sin emojis** en ningún texto (el backend igual los borra al publicar).
- `.venv/bin/python $K manifest <video-id>` → `status: "listo"`.
- `.venv/bin/python $K usage <video-id>` → `usage.json` (modelos, tokens e iteraciones del video).

### Paso 10 · Render (solo si te lo piden)
- `.venv/bin/python $K render <video-id> --formats 9x16,16x9` (cuadro a cuadro, ~15–20 min por formato).

## 4. Atajos útiles

- `kit.py status <id>`: qué pasos están hechos.
- `kit.py preview <id>`: tiempos sintéticos para armar y mirar el storyboard ANTES de tener voz.
- Galería de componentes: servir `src/templates/` (`python3 -m http.server -d src/templates 8800`)
  y abrir `http://127.0.0.1:8800/_tools/explainer-kit/showcase/`.

## 5. Si algo falla

| problema | qué hacer |
|---|---|
| cuota de voz agotada en todas las claves/modelos | `kit.py preview` para avanzar el storyboard; dejar `voz pendiente` en el reporte |
| no hay foto libre de algo | usar un componente (icono/boceto) en vez de foto; anotarlo en PLAN §8 |
| un concepto no tiene componente | crear uno (paso 3c) o reformular el plano con los existentes |
| `check` da anclas no encontradas | copiar las palabras EXACTAS de lyrics.json (números en cifras) |
| la red falla | reintentar más tarde; no inventar datos para "completar" |

## 6. Reporte final (al humano)

1. Ruta del video y `kit.py status`.
2. Punto crítico, tesis y gancho elegidos (2–3 líneas).
3. Arco (actos → segmentos) y los momentos de letra grande.
4. Medios usados (y lo que no se encontró).
5. Inventario visual: componentes propios creados (rondas y notas de la rúbrica), descartados y por qué.
6. Resultado de `check`, control de voz y revisión visual (o por qué quedó pendiente).
7. Dudas, riesgos o datos a verificar.

## 7. Mapa del kit

```text
explainer-kit/
├── AGENTS.md            ← este archivo (entrada)
├── README.md            ← resumen para personas
├── FLUJO.md             ← el flujo en una página: quién (qué IA/modelo) hace qué
├── CATALOG.md           ← todos los componentes con parámetros (GENERADO: kit.py catalog)
├── guides/              ← orquestacion · storytelling · media · voice · storyboard · components · qa · manifest
├── prompts/             ← prompts para modelos: director.md, component-author.md, delegate-copy.md, delegate-fact-check.md
├── designs/             ← diseños: index.json, common/, binary/, rough/ (design.json + DESIGN.md + components/)
├── engine/              ← motor (kit.js, loader.js, kit.css) — no se edita para hacer un video
├── templates/           ← plantillas de un video nuevo (index.html, PLAN.md)
├── tools/               ← kit.py (entrada única), media.py, narrate/tts, transcribe, check, shoot, catalog, delegate, usage…
├── showcase/            ← galería de componentes (index.html) + escenario (stage.html)
├── vendor/              ← rough.js local
└── lab/                 ← estudios e historial (voz, DeepSeek): no se usa para producir
```
