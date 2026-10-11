# EXPLAINER.md · base común de la casa de pruebas (NodeTech · NodeHistory · NodePolitics · NodeEconomy)

> Para agentes de IA y personas que van a **probar videos explicativos narrados nuevos** o
> **diseños nuevos** (plantillas visuales) para las 4 categorías explainer. Las 4 usan el MISMO
> motor (`_tools/explainer-kit/`): todo lo de este archivo vale para cualquiera de ellas.
> Lo propio de cada tema está en `sandbox/<carpeta>/AGENTS.md`.
>
> Orden de lectura: este archivo → `sandbox/<carpeta>/AGENTS.md` → `_tools/explainer-kit/AGENTS.md`
> (el pipeline completo de 10 pasos; acá solo se resume, no se duplica).
> Escrito el 2026-10-10, verificado contra `tools/kit.py`, `tools/places.py`, `tools/check_storyboard.py`,
> `engine/kit.js` y `src/core/explainer/{catalog,designs,producer}.py`.

---

## 1. Mapa: qué vive dónde

Rutas relativas a `nexa-brief-server/src/templates/`:

| qué | dónde | se edita para un video? |
|---|---|---|
| **Motor** (explainer-kit): engine, diseños, componentes, herramientas, guías | `_tools/explainer-kit/` | No. Solo un componente faltante (paso 3c) o un diseño nuevo (§5) |
| **Videos de producción** (salen en la app, `/plantillas`, como tarjetas) | `nodetech/`, `nodehistory/`, `nodepolitics/`, `nodeeconomy/` + `<video-id>/` | No a mano: llegan por `kit.py promote` o por el backend |
| **Casa de pruebas** (no sale en la app) | `sandbox/<carpeta>/<video-id>/` | Sí: acá probás |
| Referencias visuales (videos que replican los diseños) | `sandbox/nodehistory/_referencias/{binarios,otros}`, `sandbox/nodetech/_referencias/roughJS` | No (solo mirar) |
| Categorías, carpeta y diseños de cada una, `strategy` | `nexa-brief-server/niches.json` → `categories.<id>` | Solo con OK del usuario |

Categoría → carpeta → diseños (de `niches.json`, 2026-10-10):

| categoría | carpeta | diseños propios | estado |
|---|---|---|---|
| `node_tech` (NodeTech) | `nodetech` | `rough` (PROTOTIPO) | activa, 4 videos |
| `node_history` (NodeHistory) | `nodehistory` | `binary` (NODEHISTORY), `acuarela`, `carta`, `collage`, `cronica`, `enmienda`, `grunge`, `pelicula`, `periodico`, `pop` | activa, 3 reales + 9 demos |
| `node_politics` (NodePolitics) | `nodepolitics` | ninguno: puede usar cualquiera de los 11 | `empty`, sin videos |
| `node_economy` (NodeEconomy) | `nodeeconomy` | ninguno: puede usar cualquiera de los 11 | `planned`, sin videos |

Un video es **solo datos** (el `index.html` carga el motor con `data-design`):

```text
<video-id>/
├── index.html      ← NO se edita (kit.py new / promote escriben la ruta al motor)
├── PLAN.md         ← investigación con fuentes, tesis, arco, gancho, mapa visual, medios
├── publish.json    ← títulos y textos de YouTube / TikTok (+ Facebook si viene del backend)
├── manifest.json   ← lo arma kit.py manifest (status: nuevo → en progreso → listo → renderizado)
├── assets/ config.json · script.json · song.mp3 · lyrics.json · storyboard.json · media/ (+ CREDITS.md)
├── work/           ← control de voz, hojas de revisión (no va a git)
└── render/         ← mp4 + poster.jpg (los mp4 no van a git)
```

### Ciclo de vida

```
idea ─► kit.py new … --folder sandbox/<carpeta>   (casa de pruebas)
     ─► pasos 2–9 del kit (PLAN, guion, medios, voz, transcripción, storyboard, check, sheet, publish+manifest)
     ─► manifest "listo" ─► revisión humana (escuchar, mirar la hoja)
     ─► kit.py promote <id>    (mueve sandbox/<carpeta>/<id> → <carpeta>/<id> y corrige la ruta al motor)
     ─► kit.py poster <id>     (render/poster.jpg = la tarjeta en /plantillas)
     ─► app: Preparación → «Grabar» (preview 10/20 s o completo) → «Publicar» / horarios de la categoría
```

Camino alternativo (sin casa de pruebas): la app crea el video directo en producción con
`POST /api/v1/explainer/briefs` (textos) + `POST /api/v1/explainer/productions` (un agente local Claude
Code/Codex corre los pasos 2–9 con permisos acotados: escribe solo en la carpeta del video y solo
puede correr `kit.py`/`media.py` con rutas absolutas). Ver
`nexa-brief-server/docs/investigaciones/categorias-node-y-motor-explainer-2026-10.md`.

---

## 2. Producir un video de prueba (resumen del pipeline)

Todo desde `nexa-brief-server/`, con el Python del proyecto. El detalle de cada paso (y cuándo está
"hecho") está en `_tools/explainer-kit/AGENTS.md` §3: leelo entero la primera vez.

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py
M=src/templates/_tools/explainer-kit/tools/media.py

# 1 · crear la carpeta en la casa de pruebas (--folder es OBLIGATORIO para no caer en producción)
.venv/bin/python $K new <diseño> <video-id> --title "Título provisional" --folder sandbox/<carpeta>
.venv/bin/python $K status <video-id>          # en cualquier momento: qué falta (busca el id solo)

# 2 · PLAN.md (≥ 10 hechos con URL en §3; status exige ≥ 8 filas "| n | … https://")
# 3 · assets/script.json  (guides/storytelling.md)
# 3b · fotos con licencia
.venv/bin/python $M search "<consulta en inglés>"            # ✓ = licencia aceptada; --source pexels para genéricas
.venv/bin/python $M get <video-id> "File:…" nombre.jpg        # baja, recodifica y anota CREDITS.md
# 4 · voz (gasta cuota: UNA vez, con el guion final)
.venv/bin/python $K voice <video-id>           # opciones: --voice X · --model Y · --parts 3 · --dry
# 5 · transcripción (Whisper large-v3 en CPU: 1,5–3 min por minuto de audio, sin timeout corto)
.venv/bin/python $K transcribe <video-id>
# 6 · assets/storyboard.json (guides/storyboard.md + CATALOG.md)
# 7 · validar → 0 errores
.venv/bin/python $K check <video-id>
# 8 · mirar la hoja (un cuadro por plano, en los dos formatos)
.venv/bin/python $K sheet <video-id> --orient both   # → work/sheet-9x16.png y sheet-16x9.png
# 9 · publish.json a mano + manifest
.venv/bin/python $K manifest <video-id>        # status "listo" = voz real + transcripción real + ≥ 15 beats
# después (con OK humano)
.venv/bin/python $K promote <video-id>         # exige status listo/renderizado (o --force)
.venv/bin/python $K poster <video-id>
# render: SOLO si te lo piden (CPU). Preview corto: --seconds 20 → render/preview/
.venv/bin/python $K render <video-id> --formats 9x16,16x9
```

Atajos: `kit.py preview <id>` = tiempos sintéticos + mp3 mudo para armar el storyboard ANTES de tener
voz (no pisa una voz real sin `--force`); `kit.py new … --force` regenera solo las plantillas faltantes.
Galería de componentes: `python3 -m http.server -d src/templates 8800` →
`http://127.0.0.1:8800/_tools/explainer-kit/showcase/`.

### Rol humano vs agente
- El agente investiga, escribe, elige fotos, dirige el storyboard, valida y se revisa con la hoja.
- El humano escucha la voz, mira la hoja, aprueba, decide `promote`, render y publicación.
- Reporte final del agente: formato de `_tools/explainer-kit/AGENTS.md` §6.

---

## 3. Qué funcionó y qué no (copiá de lo que funcionó)

### Videos de referencia (todos en producción)

| video | diseño | por qué mirarlo |
|---|---|---|
| `nodehistory/turing-enigma` | binary | el primer video de nivel referencia (Claude). Arco completo con duelo y reparación (17 seg., 517 palabras) |
| `nodehistory/muro-de-berlin` | binary | Claude siguiendo AGENTS.md; renderizado 9:16 y 16:9; clímax en 0,6 del video; voz partida en 3 sin perder calidad |
| `nodetech/apolo-1202` | rough | dispositivos propios de la historia (`rough.dsky`, `rough.rope`, `rough.load`, `rough.choice` con ✓ en "Go", `rough.descent`) y eventos internos sincronizados con `"@palabra"` |
| `nodetech/nacimiento-ia-dartmouth` | binary (para NodeTech) | producido por Claude Code **vía backend** el 2026-10-10 en ~50 min: `check` 0 errores / 0 avisos, 54 beats (4,2 s/plano), 6 letras grandes, voz Charon 124 ppm, WER ≈ 0,014. Leé su `PLAN.md` (sección "mitos que NO vamos a decir") y el `agent_report` en `nexa-brief-server/data/explainer/productions.json` |
| `nodetech/vago-pero-emocionante` | rough | Claude siguiendo AGENTS.md, renderizado 9:16 |
| `nodehistory/codex-titanic`, `nodetech/codex-ariane-501` | binary / rough | Codex solo con AGENTS.md (~75–80 % del nivel). Investigación excelente; errores editoriales documentados en `_tools/explainer-kit/lab/codex-review-2026-10-07.md` |
| `nodehistory/*-demo` (9) | los 9 diseños nuevos | **el MISMO guion del Muro de Berlín** en cada diseño (`demo: true`). Sirven para ver cada diseño, NO para copiar su storyboard: repiten 7 fotos a propósito |

### Lo que funcionó
- **Punto crítico, no biografía**: un momento con antes y después (la conferencia de Schabowski, la alarma 1202, el nombre "inteligencia artificial" en 1955–56).
- **Investigación con fuentes primarias** (Codex: informes oficiales del Titanic y de la comisión del Ariane 501) y una lista explícita de **mitos/datos dudosos que no se dicen** (Dartmouth: "no decimos 8 personas en la sala").
- **Calidad sobre cantidad de fotos**: Dartmouth usó 2 fotos y representó a los 4 fundadores con `binary.grid`; los componentes dibujan lo abstracto.
- **Voz en un solo pedido** (identidad constante); si el servidor falla, el kit la parte en 3 solo.
- **Anclas sobre el sustantivo/cifra clave** y eventos internos con `"@palabra"` (`pickAt`, `dropAt`, `breakAt`).
- **Revisión visual real de la hoja** antes de dar por listo (Dartmouth encontró un icono inexistente y un texto duplicado).

### Errores ya vistos (y su arreglo)

| síntoma | causa | arreglo |
|---|---|---|
| storyboard desincronizado | Whisper cortado con `timeout 180` → tiempos sintéticos (codex-ariane-501) | nunca timeout corto; si tarda, correr en segundo plano y esperar |
| "frase repetida"/"sus sus" en el control | alucinación de Whisper (palabras de duración ~0) | `transcribe.py` ya limpia contra el guion; antes de cortar audio, transcribir el tramo aislado. Relimpiar: `tools/transcribe.py --clean assets/lyrics.json assets/script.json` |
| primera frase dicha dos veces | arranque en falso del TTS | `tools/splice.py work/narration.wav work/narration.fix.wav --cut INICIO-FIN` y re-masterizar |
| desvío leve del TTS ("debían hacer" por "debía nacer") | TTS | si no falta contenido, aceptar y no regenerar (cuota) |
| sin cuota / 503 | 3.8 agotado; pedidos largos dan 503; cada reintento gasta | el kit rota 7 claves × 3 modelos (estado compartido en `_tools/explainer-kit/.state/gemini-quota.json`). `GEMINI_API_KEY4` dio 402 (sin créditos) el 2026-10-10. Sin cuota: `kit.py preview` y "voz pendiente" en el reporte. Estado de claves: `GET /api/v1/voice/keys` |
| voz muy rápida (138–143 ppm) | primera tanda 2026-10-07 | rangos: binary 115–130, rough 120–138; si un video importante se pasa, regenerar |
| `check`: ancla no encontrada | número en palabras en el ancla | anclas con cifras como en `lyrics.json` ("1989", "1202") |
| beat que muestra la frase equivocada | ancla ambigua ("es construir") | 3–4 palabras únicas en lo que sigue |
| anclas rotas en cadena | overlay (`common.flash`) listado fuera de orden | todos los beats en orden de tiempo, overlays incluidos |
| `check`: "el primer beat tiene que ser el título en t=0" | se abrió con `<familia>.introv1/introv2` (el check exige `*.title`; pasa en `pelicula-demo`) | abrir con `<familia>.title` en `t: 0` hasta que se actualice `check_storyboard.py` |
| icono con otro significado | `waves` = ondas de radio, no agua (Titanic); `binary` no tiene `flag` (Dartmouth) | leer el `summary` y la lista de iconos al final de `CATALOG.md`; mirar en la galería |
| lima en todos los planos, > 7 textos gigantes, misma foto 3 veces | criterio editorial (Codex) | un acento por plano; 4–6 `common.lyric` + ≤ 2 `common.punch`; `check` avisa |
| tono de informe, jerga, lógica invertida | Codex | `guides/storytelling.md` §4: protagonista con nombre, jerga traducida a imagen cotidiana, releer causalidades |
| misma fórmula de gancho en dos videos ("37 segundos") | sin registro de ganchos usados | revisar `publish.json` de los videos de la carpeta antes de elegir gancho/título |
| título alternativo que contradice el PLAN ("8 personas" en Dartmouth) | el brief se escribe antes de investigar | releer `publish.json` contra PLAN §3 al final y corregir |
| `404` de `config.json` o favicon en consola | el motor prueba `config.json` y después `assets/config.json` | benigno |
| render colgado / fuentes raras | fuente de canvas no precargada | declararla en `fonts.load` del `design.json` |
| `handle` del cierre se rompe | string que empieza con `@` = ancla de palabra | escribir `youtube.com/@canal`, nunca `@canal` solo |
| producción o render "failed" de golpe | el uvicorn del usuario corre con `--reload`: editar un `.py` mata el proceso | no tocar `.py` del backend mientras corre algo; «Retomar» en la app |
| render lento | cuadro a cuadro en CPU: binary/rough ~15–20 min por formato; los diseños nuevos más (periodico 0,3–1,8 s/cuadro) | no renderizar sin pedido; para mirar, `kit.py render <id> --seconds 20` |

### Riesgo de canal
YouTube desmonetiza "contenido no auténtico" (en masa, con plantilla, poca variación) **a nivel de
canal** (`docs/investigaciones/estrategia-cro-titulos-descripciones-2026-09.md` §0). Por eso: nunca
publicar dos videos con el mismo guion (los 9 `*-demo` son el mismo), variar ganchos y diseños, y que
cada video aporte investigación propia.

---

## 4. Guion, voz, medios y storyboard (reglas cortas + dónde está el detalle)

**Guion** (`guides/storytelling.md`, entero):
- Un punto crítico, una tesis de una frase, un protagonista humano con nombre.
- 14–20 segmentos de 15–45 palabras, **420–560 palabras** (3:15–4:30 a ~120–130 ppm).
- **Números en palabras** ("mil novecientos cincuenta y seis"); Whisper los devuelve en cifras.
- Oraciones de 6–18 palabras. Español latino neutro con **tú** en la narración ("tienes", "computadora", "celular").
- Curva `intensity`: ≥ 2 bajadas reales; pico 1.0 en el **60–72 %**; caída 0.2–0.4 después; cierre que vuelve al título.
- `tone` solo de la lista de `storytelling.md` §5 (cada uno tiene dirección vocal en `tools/narrate.py`).
- Prohibido: citas inventadas, cifras sin fuente en PLAN §3, muletillas, spoiler del clímax en el gancho.

**Voz** (`guides/voice.md`): automática por diseño. `rough` = Sadaltager; `binary` y los otros 9 = Charon.
Modelos `gemini-3.8-flash-tts` → `3.8-flash-lite-tts` → `3.1-flash-tts-preview`. Deja 1,2 s al inicio
(se arma el título) y 6 s al final (cierre del canal). Control en `work/narration.qc.json`. Voz
descartada: Schedar (repite frases).

**Medios** (`guides/media.md`):
- 5–9 fotos (como máximo una cada ~25 s): protagonista, lugar/objeto del punto crítico, contraparte, legado.
- Licencias: PD, CC0, CC BY, CC BY-SA, Pexels. Rechazar NC, ND, fair use. Créditos CC BY/BY-SA en la descripción.
- Wikimedia Commons primero (consultas en inglés: nombre + año, lugar + evento). Pexels solo para lo genérico moderno, nunca para personas históricas.
- Retratos para `binary.portrait`: frontales, fondo liso. Nada de marcas de agua ni imágenes generadas con IA presentadas como reales.
- Video (clips): **pendiente** (no hay componente con seek determinista). No bajes videos.

**Storyboard** (`guides/storyboard.md` + `CATALOG.md` + `prompts/director.md`):
- Beat 0 = `<familia>.title` en `t: 0` (con `textPortrait` para 9:16) hasta que aparece el conflicto (4–7 s).
- Un plano cada 2,5–6 s (clímax 2–3 s, duelo 5–8 s); nunca < 1,5 s ni > 8–9 s.
- Intensidad ≥ 0.85 → `common.lyric` (+ `common.flash`) y componentes de acción; 0.5–0.85 → diagramas/objetos; < 0.4 → planos lentos y vacíos.
- Nunca el mismo componente dos veces seguidas; ninguna foto dos veces (salvo el callback final); ningún icono > 2 veces.
- Rótulos ≤ 22 caracteres, nada que la voz no diga. Un solo acento por plano.
- El cierre del canal NO se agrega: lo pone el motor (`config.outro`).

**Nombre del canal en el cierre (ojo):** en TODOS los `design.json` el cierre trae
`defaults.outro.channel = "NODETECH"` (y `handle youtube.com/@nodetech`). El motor mezcla
(`deepMerge`) los defaults del diseño con el `assets/config.json` del video, así que para otra
categoría podés sobreescribirlo en el config del video, sin tocar el diseño:
`"outro": { "channel": "NODEHISTORY", "handle": "youtube.com/@…" }` dentro de `configs[0]`.
El handle real del canal lo confirma el usuario: no lo inventes.

---

## 5. Crear un DISEÑO nuevo (plantilla para una categoría)

Un diseño = un "canal" visual reutilizable para cualquier tema. Así se hicieron los 9 diseños del
2026-10-08 (`acuarela`, `carta`, `collage`, `cronica`, `enmienda`, `grunge`, `pelicula`, `periodico`, `pop`):
réplica fiel de estilo, tipografía, color, movimiento y transiciones de un video de referencia.

> Crear un diseño toca el motor compartido (`_tools/explainer-kit/designs/`) y los registros:
> **pedile OK al usuario antes de registrar** (en 2026-10-08 el clasificador de permisos bloqueó la
> edición de `designs/index.json`/`kit.py catalog` por ser recurso compartido).

### 5.1 Analizar la referencia (va a `DESIGN.md`)
- Poné el video en `sandbox/<carpeta>/_referencias/`. Medí: cortes (`ffmpeg` con `scene > 0.2`),
  colores (muestreo con PIL), tiempos de cada movimiento contando cuadros, tipografías (equivalente en Google Fonts).
- **Las texturas se generan en código** (ruido con semilla), nunca se recortan de la referencia (licencias Envato/Netflix…).

### 5.2 Estructura

```text
_tools/explainer-kit/designs/<id>/
├── design.json        ← copiá el del diseño más parecido y cambiá todo
├── DESIGN.md          ← análisis de la referencia, identidad, catálogo de movimientos replicados,
│                        qué quedó igual / qué difiere, límites del motor, verificación, intros y cierre, ejemplos
└── components/
    ├── _<id>.js       ← runtime de familia (Kit.family): fondo, post-proceso, cámara si hace falta
    ├── <líneas>.js    ← un archivo por línea temática (título, escenas, tipo, fx…); partir si pasa ~600 líneas
    ├── intros.js      ← <id>.introv1 (golpe) y <id>.introv2 (pregunta + revelación), contrato designs/common/hook.js
    └── outro.js       ← <id>.outro: SIN recuadro, orden fijo gracias → canal → LIKE → flecha → SUSCRÍBETE+campana → apoyo → handle
```

`design.json` (claves reales): `id`, `family`, `name`, `tagline`, `topics`, `channel {name, handle, language, note}`,
`fontsCss` (Google Fonts), `scripts` (orden de carga; sumá `designs/common/text.js` si querés `common.lyric`,
y `designs/common/hook.js` para intros/cierre), `defaults {family, palette, fonts {main, load}, captions,
transition {overlap}, outro {enabled, use, dur, thanks, channel, cta, support, handle}}`,
`voice {voice, alternatives, models, lead, tail, base, target_wpm}`, `media {photos, portrait_tip, per_video}`.

### 5.3 Reglas duras de componentes (`guides/components.md` + `prompts/component-author.md`)
- **Determinismo**: todo función de `lt`/`t`. Nada de `Math.random`, `Date`, timers ni animaciones CSS (`seek(t)` tiene que dar el mismo cuadro en cualquier orden).
- Colores solo de `ctx.C.palette`; medidas en `u` / `stage.content`; `size` de texto en `u`.
- **Tiene que existir `<id>.title`** (el check exige `*.title` como primer beat).
- Fuentes de canvas declaradas en `fonts.load` (si no, render colgado).
- Params `image` solo se precargan si son strings sueltos: `src1..src4`, no un array. Foto de fondo de un componente en `src`, no dentro de `useParams`.
- `handle` sin `@` inicial. 9:16 usa toda la altura (no una versión achicada del 16:9).
- Transiciones que necesitan el plano saliente vivo: `post` (p. ej. 1,0 s) y `transition.overlap` coherente.
- Subtítulos karaoke activos y legibles (la referencia casi nunca los tiene; la narración sí los necesita).
- Al usuario no le gustó el cierre viejo en recuadro: el cierre va sin caja.

### 5.4 Probar
- Aislado: `showcase/stage.html?d=<id>&c=<id>.<componente>&loop` (servir `src/templates/`).
- Capturas: `.venv/bin/python src/templates/_tools/explainer-kit/tools/shoot.py hoja.png <id>.<comp> --orient both` (sin params usa su `example`; `--prev` para ver la transición).
- Tamaño ≥ 60 % del ancho en 9:16, textos legibles, nada cortado. Consola sin avisos `[kit]`.
- Componentes borrador de otro modelo: `tools/ai_loop.py` (genera → valida → repara); nunca pasan directo a producción (`lab/deepseek/NOTAS.md`).

### 5.5 Registrar (con OK del usuario)
1. `_tools/explainer-kit/showcase/designs.json` → `designs` (lo leen `catalog.py`, la galería y el backend: `available_design_ids`).
2. `_tools/explainer-kit/designs/index.json` (hoy desactualizado: solo `binary`, `rough`; mantenelo coherente).
3. `nexa-brief-server/niches.json` → `categories.<categoría>.designs` (define la carpeta por defecto de `kit.py new` y los diseños que ofrece la app; un diseño pertenece a UNA categoría).
4. `.venv/bin/python $K catalog` → regenera `CATALOG.md` + `catalog.json` (sin esto, `check` da "componente desconocido").

### 5.6 Demo y portada
- La app previsualiza un diseño con el video **`<id>-demo` de producción** (`routers/explainer.py → _design_preview_url`).
- Creá la demo en la casa de pruebas: `kit.py new <id> <id>-demo --folder sandbox/<carpeta>`. Mejor con un guion real nuevo que copiando el del Muro (otra demo duplicada = más riesgo de contenido repetido).
- `check` (0 errores; avisos de "0 common.lyric" son esperables si el diseño tiene su propia letra grande, p. ej. `periodico.quote`, `pelicula.quote`, `grunge.stamp`), `sheet --orient both`, `render --seconds 20` para ver movimiento real.
- En `manifest.json` agregá `"demo": true` y `"category": "<node_…>"` (`kit.py manifest` conserva las claves extra), `promote`, `poster`.
- Dejá en `DESIGN.md` una sección "Verificación" (check, consola, determinismo, hojas) como las de `grunge`, `pelicula`, `pop`.

---

## 6. Títulos y descripciones

Fuente: `niches.json → categories.<id>.strategy` (audiencia, ángulo, tono, `title_formulas`,
`title_examples`, `topic_ideas`, `hashtags`, `rules`) + `src/core/explainer/briefs.py → SYSTEM_PROMPT`
+ `docs/investigaciones/estrategia-cro-titulos-descripciones-2026-09.md`.

- **Provocador pero verdadero**: contraste, tensión o una pregunta abierta; promete solo lo que el video cuenta (CTR alto + retención baja = el algoritmo deja de mostrarlo).
- Lo importante en los **primeros 40 caracteres**; máximo 70 en YouTube. Sin MAYÚSCULAS sostenidas ni emojis de relleno (máx. 1 emoji en TikTok).
- Toda cifra o fecha del título/descripción **está en el guion** y en PLAN §3.
- `thumbnail_text`: 3–4 palabras que **complementan** el título, no lo repiten.
- Descripción: 2 primeras líneas con gancho + palabras clave; contexto; qué vas a entender; pregunta para comentarios; bloque `IMÁGENES` con los créditos CC BY/BY-SA.
- TikTok: 1–2 frases (≤ 150 caracteres), 3–4 hashtags (1 amplio, 2 de nicho, 1 de tema); sin `#fyp`/`#viral`.
- No repitas la fórmula de título/gancho de otro video de la misma carpeta.
- Formato de `publish.json`: `guides/manifest.md` (+ `youtube_title_alternatives`, `facebook_title`, `facebook_description` si vienen del brief).

---

## 7. Checklist antes de promover

- [ ] `kit.py status <id>`: pasos 2–9 en ✓ (PLAN con ≥ 8 hechos con URL).
- [ ] `kit.py check <id>`: **0 errores**; cada aviso corregido o justificado en PLAN §10.
- [ ] Voz real (no `preview`): `narration.qc.json` sin `faltan`/`sobran` reales; ppm en rango del diseño.
- [ ] `lyrics.json` de Whisper real (no sintético) y storyboard re-validado después.
- [ ] Hojas 9:16 y 16:9 **miradas**: título ~80 % del primer cuadro, nada cortado, fotos correctas, un acento por plano, sin planos negros ni repetidos.
- [ ] 420–560 palabras, pico de intensidad en 60–72 %, 4–6 letras grandes, cierre que vuelve al título.
- [ ] Toda cifra con fuente; ninguna cita inventada; temas sensibles con respeto.
- [ ] `CREDITS.md` completo y créditos en `youtube_description`.
- [ ] `publish.json` revisado contra PLAN (título verdadero, ≤ 70 caracteres, lo clave en 40).
- [ ] Nombre del canal del cierre correcto para la categoría (§4, `config.outro`).
- [ ] No duplica el guion ni el gancho de otro video de la carpeta.
- [ ] `kit.py manifest <id>` → `listo`. Recién ahí `promote` + `poster` (con OK humano). Render solo a pedido.
