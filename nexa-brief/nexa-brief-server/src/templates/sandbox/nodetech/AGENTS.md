# AGENTS.md · NodeTech (tecnología) — casa de pruebas

> **Antes que esto, leé `../EXPLAINER.md`** (motor, pipeline, errores ya vistos, diseños nuevos,
> checklist) y `../../_tools/explainer-kit/AGENTS.md` (el pipeline de 10 pasos completo).
> Acá está solo lo propio de tecnología. Categoría `node_tech` · carpeta `nodetech` ·
> estrategia en `nexa-brief-server/niches.json → categories.node_tech.strategy` (la fuente manda si cambia).

## 1. Estrategia (de `niches.json`, 2026-10-10)

- **Público**: hispanohablantes de 18 a 40 años curiosos por la tecnología y la IA, que no son ingenieros.
- **Ángulo**: el lado humano y decisivo de la tecnología: cómo algo pasó de imposible a cotidiano, quién lo decidió y qué costó.
- **Tono**: intriga y revelación, ritmo de documental; **cero jerga sin explicar**.
- **Fórmulas de título**:
  - `Cómo {X} pasó de {algo pequeño} a {algo enorme}`
  - `Así se hizo tan potente {X} (y casi nadie lo vio venir)`
  - `El día que {X} cambió {Y} para siempre`
  - `La decisión que convirtió a {X} en {Y}`
  - `Por qué {X} ya puede {Y}: la historia que no te contaron`
- **Ejemplos**: "Cómo la IA pasó de no resolver nada a quitarte el trabajo" · "Así se hizo tan potente la IA (y casi nadie lo vio venir)" · "El verano de 1956 en que alguien le puso nombre a la inteligencia artificial" · "El número que no cabía: el error de 7 mil millones del Ariane 5".
- **Temas sugeridos**: cómo nació la IA ✓ (hecho), Deep Blue contra Kasparov, cómo nació internet, el error del año 2000, el primer iPhone y la caída de Nokia, de dónde salió ChatGPT, el Apolo 11 y la alarma 1202 ✓ (hecho), el bug del Ariane 5 ✓ (hecho).
- **Hashtags**: `#tecnologia #inteligenciaartificial #historiadelatecnologia #ia #documental`.
- **Reglas**: título provocador pero verdadero; lo clave en 40 caracteres; sin mayúsculas sostenidas ni emojis de relleno (máx. 1 en TikTok); toda cifra del texto está en el guion.

## 2. Diseños

| diseño | cuándo | notas |
|---|---|---|
| `rough` (PROTOTIPO, propio) | **por defecto**: inventos, software, ingeniería, internet, espacio, startups | voz Sadaltager (120–138 ppm). Lima `#c8ff2e` SOLO para una cosa por plano. Componentes de dispositivo/diagrama: `rough.flow`, `compare`, `stack`, `choice`, `gauge`, `tally`, `load`, `network`, `browser`, `counter`, `timeline`, `dsky`, `rope`, `descent`; 85+ bocetos para `rough.icon` |
| `binary` (NODEHISTORY) | historia de la computación con personajes y fechas (Dartmouth 1956) | se usó en `nacimiento-ia-dartmouth`; es diseño de NodeHistory: pasá `--folder sandbox/nodetech` y revisá el nombre del canal en el cierre |
| otro de los 9 | solo si el tema lo pide de verdad | son diseños de historia (archivo, sepia, papel); cuestan más render |

Sin diseño propio nuevo todavía. Referencia visual del laboratorio rough.js: `_referencias/roughJS/index.html`.

## 3. Buenos y malos temas

| bien (punto crítico) | mal (enciclopedia / no sirve) |
|---|---|
| La alarma 1202 a 10 km de la Luna | "La historia de la NASA" |
| El número que no cabía (Ariane 501, 1996) | "Cómo funcionan los cohetes" |
| Las 3 palabras que crearon la Web ("vago, pero emocionante") | "Qué es internet" |
| El verano en que se le puso nombre a la IA | "Todo sobre la inteligencia artificial" |
| La partida en que Deep Blue ganó (1997) | rumores de lanzamientos, reseñas de productos, comparativas de precios |

Evitá: producto actual en clave publicitaria, predicciones sin fuente, "la IA te va a reemplazar" sin datos.
El puente al presente sí va (segunda persona: "el celular que tienes en la mano").

## 4. Dónde investigar

Fuentes primarias primero, siempre con URL en PLAN §3:
- Informes oficiales de fallas e investigaciones (p. ej. el informe de la comisión del Ariane 501 que usó Codex).
- NASA (historia, transcripciones de misión), ESA, Computer History Museum, IEEE, Smithsonian.
- Papers y propuestas originales (la propuesta de Dartmouth de 1955), archivos de universidades, entrevistas publicadas.
- Wikipedia como mapa para llegar a las fuentes; dos fuentes para las cifras clave.
- Fotos: Wikimedia Commons (NASA = dominio público), Pexels solo para lo genérico moderno (servidores, teclados).

## 5. Ejemplo trabajado (idea de prueba)

Tema de la estrategia: "Deep Blue contra Kasparov". Punto crítico: una jugada o una partida concreta
con antes y después (decidilo después de investigar; no lo elijas de memoria).

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new rough deep-blue-kasparov --title "El día que una máquina ganó" --folder sandbox/nodetech
# PLAN.md (≥ 10 hechos con URL) → assets/script.json (420–560 palabras, números en palabras)
.venv/bin/python $M search "Deep Blue IBM chess computer"
.venv/bin/python $M get deep-blue-kasparov "File:…" deep-blue.jpg
.venv/bin/python $K voice deep-blue-kasparov
.venv/bin/python $K transcribe deep-blue-kasparov
# assets/storyboard.json: rough.title en t=0, rough.choice para la jugada, rough.counter para cifras…
.venv/bin/python $K check deep-blue-kasparov
.venv/bin/python $K sheet deep-blue-kasparov --orient both
# publish.json (fórmulas de §1) →
.venv/bin/python $K manifest deep-blue-kasparov
# con OK humano: promote + poster
```

## 6. Lecciones de NodeTech

- **Referencias**: `nodetech/apolo-1202` (rough, la vara de calidad) y `nodetech/nacimiento-ia-dartmouth`
  (binary, producido por Claude Code vía backend: leé su `PLAN.md` y su `agent_report` en
  `data/explainer/productions.json`). También `vago-pero-emocionante` (rough, Claude) y
  `codex-ariane-501` (rough, Codex).
- **Dispositivos propios de la historia** hacen el video (apolo: DSKY con 1202, memoria de cuerda,
  pila que suelta tareas, ABORTAR/SEGUIR con ✓ exactamente en "Go", combustible que llega a 30 cuando
  la voz dice "treinta"). Si un concepto central no tiene componente, creá uno (paso 3c), no lo
  fuerces con un icono.
- **Ariane (Codex)**: técnicamente impecable pero con jerga (coma flotante de 64 bits, entero con signo,
  toberas), **sin protagonista humano** y sin el dato que vende (el costo) → corregido en `storytelling.md`.
  En tecnología este es el error típico: traducí cada término a una imagen cotidiana ("una caja enorme
  en un casillero pequeño").
- **Lima en casi todos los planos** (Ariane): rompe la regla de un acento por plano.
- **Dartmouth**: brief → PLAN → guion respetando el ángulo; 4 fotos bajadas, 2 usadas; fundadores con
  `binary.grid`; `check` 0/0. El título alternativo del brief decía "8 personas" y el PLAN lo descartó
  como dato dudoso: revisá `publish.json` contra PLAN §3 antes del manifest.
- **apolo-1202** se narró con `gemini-3.1-flash-tts-preview` en 3 partes porque 3.8 no tenía cuota: suena
  bien, la cadena de modelos funciona.
- **Canal en el cierre**: el default de todos los diseños es NODETECH, así que en tech no hay que tocarlo.
  Ojo: `nacimiento-ia-dartmouth` tiene `channel: NODEHISTORY` en su manifest (sale del `channel.name` de
  binary) pero el cierre en pantalla dice NODETECH.
- `rough.load` cortaba rótulos largos en 9:16 (arreglado); igual, rótulos ≤ 22 caracteres.

## 7. Promover

`kit.py promote <id>` → `nodetech/<id>/` (exige `status: listo`), después `kit.py poster <id>`. La app
lo infiere como NodeTech por la carpeta (o por `category` en el manifest, que manda). Checklist: `../EXPLAINER.md` §7.

> Al terminar una prueba, sumá acá (§6) lo que funcionó y lo que no.
