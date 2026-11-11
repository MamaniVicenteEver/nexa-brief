# AGENTE · Producir un video con Atlas en Movimiento (cualquier tema)

> Punto de entrada único. Sirve para cualquier IA (Claude Code, Codex, Haiku, otra) y para cualquier tema:
> guerras, sucesos históricos, política, economía, geopolítica. **Esta plantilla no tiene tema.** El tema,
> los hechos y el ángulo salen del pedido y de la investigación. Lo que sí tiene es **más de 100 componentes**
> (unidades, flechas, efectos, imágenes, documentos, retratos, territorios, cifras) para contar cada hecho
> con algo que se ve y se mueve.
>
> Se usa de dos maneras, con las mismas reglas:
> 1. **Como skill**: un agente lee este archivo (o `SKILL.md`) y produce el video él mismo.
> 2. **Con un orquestador**: un agente líder (§2) reparte el trabajo en roles y revisa todo lo que vuelve.

## 0. La regla que lo resume

### Motor único y episodios de datos (obligatorio)

- La única implementación activa del diseño vive en
  `src/templates/nodeatlas/atlas-en-movimiento/engine/`. Showcase y todos los episodios la consumen.
- El orquestador entrega guion, medios y JSON (`assets/script.json`, `assets/scene.json`,
  `assets/config.json`): cada ítem declara `type`, parámetros y tiempos. El motor principal dibuja.
- **Está prohibido crear, copiar, bifurcar o modificar un motor dentro de un episodio.** No crear
  `engine/`, `components/`, renderizadores, JavaScript inline ni una copia de `build_scene.py`.
  El host genera la entrada mínima que referencia el motor central; el episodio no implementa `draw`.
- Si falta una pieza, se desarrolla una vez en `engine/tactico/components/` del diseño compartido,
  con parámetros, validación, demostración y pruebas. Se registra en el mismo catálogo de Showcase.
  Un tema, ruta o país distinto se expresa con JSON; no se crea otro tipo de componente por video.
- Los cambios en el motor se comprueban contra los episodios existentes en 9:16 y 16:9. Las diferencias
  de aspecto necesarias se expresan con parámetros explícitos y se conservan en los datos del episodio.
  No se alteran guion, voz, tiempos, medios ni publicación para actualizar la conexión al motor.
- Antes de aceptar o grabar un episodio: `python <plantilla>/tools/check_episode.py <episodio>`.
  El productor rechaza copias locales; el generador y la grabación exigen la entrada central.
  Una revisión visual no sustituye estas validaciones.
  En episodios históricos cuya limpieza fue aplazada expresamente, `--active-only` audita la entrada
  que se ejecuta; no sustituye la auditoría estricta de episodios nuevos. Ver `docs/atlas-motor-unico-2026-11-10.md`.

Entrada de ejecución, emitida por el host (las rutas de medios siguen siendo relativas al episodio):

```html
<script src="/api/v1/explainer/files/sandbox/_proto/proto.js"></script>
<script type="module" src="/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js"></script>
```

Ejemplo de datos, reutilizable para cualquier ruta sin copiar código:

```json
{"type":"money.flow","via":[[20,52],[24,50],[30.5,50.4]],"count":10,"period":5,"t":0,"dur":16}
```

Los medios indicados por `src`, `docSrc` o `lyricsUrl` se resuelven desde la carpeta del episodio.
Fuentes, sprites y recursos propios del diseño permanecen en la biblioteca compartida. No se copian
para arreglar una ruta rota.

Para conservar una decisión visual de un episodio antiguo, usa parámetros en el JSON. Por ejemplo,
`assets/config.json → configs[0] → componentDefaults` puede contener:

```json
{"money.flow":{"currencySymbol":""}}
```

La cadena vacía conserva el billete simbólico sin moneda; `"$"` muestra el dólar. Un parámetro en el
ítem tiene prioridad sobre estos valores. `componentDefaults` no puede cambiar `type`, identidad ni
los tiempos de un ítem. Nunca se usa una copia del renderizador para mantener una variante.

Un mapa con texto no es un video. **Cada hecho del guion se muestra con un componente que lo ilustra**:
una columna que avanza, una flecha, un documento, una foto con pie, un retrato, un territorio que cambia de
manos, un impacto, una cifra que sube. El texto (fecha, titular, subtítulos) acompaña; nunca es lo único.
Si una escena sale con 12 tipos de pieza y casi todos son texto, **está mal y no se entrega**.

> Nota: `src/skills/explainer/categories/node_atlas.json` trae anclas y reglas de ejemplo de un primer
> video; no limitan el tema. Úsalo para el tono y los hashtags (`#NodeAtlas`), no para elegir de qué se habla.

## Descubrimiento económico mediante API

El creador acepta `design:"atlas-en-movimiento"` y `estilo` (`v4-atlas`, `v2-mando`, `v3-cine`, `clasico`).
Consulta `/api/v1/showcase/designs/atlas-en-movimiento/production-guide?estilo=<id>` y únicamente los
contratos `/catalog/<id>?estilo=<id>&format=9x16` de las piezas elegidas. El contexto privado contiene
QUICK, índice y entradas del estilo seleccionado. Reutiliza `tools/build_scene.py`; no leer motores.
La guía manual completa de abajo sigue disponible; no hay que releerla para cada episodio preparado
por el host. El estado de producción no cambia la definición compartida de los estilos.

## 1. Qué leer (en este orden, y no más)

| # | archivo | para qué |
|---|---|---|
| 1 | este `AGENTE.md` | el proceso, los roles y las puertas de calidad |
| 2 | `GUION.md` | **cómo se genera el diálogo**: quién lo escribe, qué estrategia narrativa usa, cómo se piensa para imagen |
| 3 | `MENU-VISUAL.md` | qué componente usar para cada tipo de hecho (ofensiva, ocupación, tratado, ataque, cifra…) |
| 4 | **`COMPONENTES.md`** (todas las piezas con título, descripción, parámetros y ejemplo; se regenera con `node tools/componentes-md.mjs`) | saber qué existe y cómo armarlo sin abrir código; no se planea sin haberlo leído |
| 5 | `engine/tactico/animations/<nombre>.json` solo si necesitas más detalle de una pieza | parámetros y rangos |
| 6 | `engine/tactico/AGENTE.md` | reglas de ranuras de texto, estilos, errores ya vistos |
| 7 | `engine/tactico/ORQUESTACION.md` | cómo se reparten las ranuras cuando hay muchas piezas |

No leas `core.js`, `components/*.js` ni `plano.js`: el motor decide cómo se ve; tú decides qué se cuenta,
con qué pieza y cuándo. Si el pedido es de otra familia (letras, promos), no es este camino.

## 2. Quién hace qué (orquestación)

Fuente única: `src/skills/models/roles.json`. Cambiar quién hace un rol se hace allí, no en el código.

| rol | quién | hace |
|---|---|---|
| **líder / productor** | el agente que recibió el pedido (Claude Code, Codex…) | entiende el pedido, decide, delega, **revisa todo** y firma la entrega |
| investigación | Codex (`research`) | ledger de hechos con fuente y fecha |
| **guion / diálogo** | Codex (`script`, `text_draft`) | `assets/script.json` con plan visual por segmento (ver `GUION.md`) |
| storyboard / plan visual | Codex (`storyboard`) | el campo `plan` de cada segmento |
| medios | líder o Codex | descarga imágenes/documentos libres con crédito en `assets/media/` |
| verificación de hechos | DeepSeek (`fact_check`) | segunda lectura del guion contra el ledger |
| textos de publicación | DeepSeek (`copy_draft`) | títulos, descripción, miniaturas |
| voz | Gemini TTS | `narrate.py` |
| tiempos | Whisper large-v3 | `transcribe.py` |
| revisión visual | el líder, con sus ojos | hoja de contactos de 24 cuadros |

### Si Codex no responde (sin cuota, límite, caída)

`roles.json` declara un **respaldo `claude-haiku-5-5`** para los roles de Codex. `kit.py delegate` lo usa
solo cuando Codex falla y deja el cambio registrado (`work/delegate/*.fallback.jsonl`). Para el trabajo
largo (investigación, guion, plan visual) que se lanza fuera de `delegate`:

1. **Detecta** el fallo: la corrida termina sin entregables, o el log dice límite/cuota/usage limit.
2. **No sigas con una versión reducida.** No reemplaces la mitad del trabajo con atajos.
3. **Relanza el mismo brief** con Haiku 5.5 (`claude -p --model claude-haiku-5-5 …`, o `agent: "claude"`
   en `POST /api/v1/explainer/productions`). Los briefs ya son autosuficientes; no los resumas.
4. **Anótalo** al inicio del reporte final: qué rol cambió de modelo y por qué.
5. Haiku escribe borradores; **el líder revisa** guion, plan visual y medios con el mismo rigor.
6. Si tampoco hay Haiku, **detente y avisa al usuario**. Nunca entregues como "listo" un video armado con
   la mitad del flujo.

## 3. El proceso (con puertas)

Rutas relativas a la carpeta del episodio (`$NEXA_PROFILE_DIR/productions/<categoría>/<id>/`; en pruebas,
`$NEXA_PROFILE_DIR/sandbox/<categoría>/<id>/`). Las herramientas se ejecutan desde `tools/` de la plantilla
compartida; no se copian al episodio. **No grabes MP4. No hagas commit.**

| paso | qué | puerta (no se avanza sin esto) |
|---|---|---|
| 0 | **Entender el pedido**: tema, duración, formato, público. Completar lo que falte con valores por defecto y dejarlo en `PLAN.md` | pedido escrito en `PLAN.md` §1 |
| 1 | **Investigación** → `work/research/HECHOS.md` + `research.json` (ledger con ID, fecha, fuente, alcance) | ≥ 25 hechos para 7–8 min; cifras con dos fuentes |
| 2 | **Ángulo y estrategia narrativa** (`GUION.md` §2): nivel, arco, golpe, pregunta final | `work/briefs/angulo.md` |
| 3 | **Guion** `assets/script.json` por segmentos (`GUION.md`) | `kit.py check` y lectura en voz alta |
| 4 | **Plan visual por segmento** (`plan` dentro de cada segmento, `MENU-VISUAL.md`) | cada segmento con ≥ 1 pieza no textual; guion revisado por el líder |
| 5 | **Medios**: bajar y curar cada imagen/documento del plan → `assets/media/` + `assets/media/credits.json` | todos los `src` del plan existen y tienen crédito |
| 6 | **Voz** → `assets/song.mp3` (Gemini TTS, `_atlas/voice.json`) | `song.qc.json` sin omisiones; se escucha un tramo |
| 7 | **Transcripción** → `assets/lyrics.json` (Whisper). **Aquí mismo arranca el paso 12 en paralelo** | tiempos reales, nunca estimados |
| 8 | **Escena**: `python3 tools/build_scene.py <episodio>` (generador universal) | sin segmentos sin plan |
| 9 | **Auditorías**: `python tools/check_episode.py <episodio>`, `node tools/cobertura-audit.mjs <episodio>` **y** la auditoría de estilo | **motor compartido, cobertura OK y 0 choques**; todas son obligatorias |
| 10 | **Mapa**: teselas para cada zona/zoom de cámara (`_atlas/PRODUCIR.md` §5) | barrido de navegador sin teselas faltantes |
| 11 | **Revisión visual**: hoja de 24 cuadros en 9:16 y en 16:9 + un tramo animado | escribir en el resultado: tipos, imágenes, unidades, tramos sin movimiento |
| 12 | **Paquete de publicación COMPLETO** (miniaturas A/B/C, 3 títulos, Facebook/TikTok, descripción con capítulos, fuentes, créditos, tags, comentario fijado; estrategia amarillista v1). **NO se deja para el final**: se lanza con Terra 6.1 alto en cuanto existe `lyrics.json` (paso 7), en paralelo a los pasos 8–11, con `PUBLICACION.md` como brief. Estado `listo` (sin MP4) solo si el paquete existe | `publishing check <id>` con 0 errores; en la web, «Títulos y metadatos» sin «Faltan los textos de publicación» |
| 13 | **Reporte final** (§7) | honesto, con lo que falta al inicio |

## 4. Cómo se ve un video bueno (referencia mínima)

- Duración de 7–8 min (≈ 1.000–1.150 palabras a 130 ppm): **≥ 14 tipos de componente** de **4 familias**
  (texto, mapa/marcas, movimiento/unidades, imagen/documento).
- Una imagen o documento cada ≤ 45 s; **ningún tramo de 20 s sin imagen ni movimiento**.
- Cada giro del relato tiene su pieza: la ofensiva avanza, la ocupación cambia el mapa, el tratado se ve
  firmado, la cifra sube, la persona aparece con su nombre y cargo.
- Cámara que se mueve con intención (acercar al hecho, alejar para el contexto), no 22 vistas quietas.
- Los datos dudosos se rotulan ("posición aproximada", "cifra discutida"); nada visible sin ledger.
- Texto en ranuras: encabezado, titular o año, nota, transcripción. Una pieza por ranura a la vez.
- **Lo importante se queda marcado y NO desaparece** (regla fija, pedida por el usuario el 2026-11-10): si el video trata
  de control territorial (guerras, conquistas, ocupaciones, fronteras que cambian), el mapa lleva **durante TODO el video**
  la zona que controla cada bando como `territory.zone`: **rojo translúcido al 50 %** (token `ucr2.territorio.zona`),
  dibujado debajo de banderas, tropas y rótulos. Al inicio muestra todo lo que controlaba y, con avances y contraofensivas,
  crece o se desvanece hasta lo que controla al final. Aunque el mapa se marque de otra forma (bandera, hachurado, frente),
  la zona roja sigue visible. Se define en `script.json → escena.zonas` (ver abajo); es la forma de que el espectador
  entienda la **gravedad y la escala**. Lo mismo vale para cualquier cosa clave del relato (el retrato del protagonista,
  el territorio perdido, el total acumulado): una vez presentada, queda en pantalla con duración larga (`hasta:"fin"`).

### `escena.zonas` (zona de control fechada, todo el video)

```json
"escena": { "zonas": [ {
  "desde": "s01", "hasta": "fin", "inicial": "S0",
  "conjuntos": "assets/zonas.json",              // {"conjuntos": {"S0": [anillo, ...], "S1": [...]}}  anillos [[lon,lat],...]
  "label": "CONTROL RUSO · APROXIMADO",          // leyenda abajo a la derecha (opcional)
  "estados": [
    {"en": "s03", "conjunto": "S1", "dur": 3, "estado": "ocupado"},
    {"en": "s19", "ancla": "noviembre", "conjunto": "S3", "dur": 4, "estado": "recuperado"}
  ] } ] }
```
- Cada estado cambia en el segmento `en` (o en la palabra `ancla` de ese segmento, más `offset`): la parte que se pierde
  se desvanece y la ganada se enciende (`dur` s). Un conjunto vacío = un triángulo diminuto en el mar (`VACIO`).
- Los anillos **pueden pasar por el mar o por el país vecino a propósito**: el motor los recorta con las fronteras de
  Ucrania y Crimea (`clip`, por defecto; en otro tema pon `clip:[{"region":"IQ"}]`). **Los anillos de un mismo
  conjunto no deben solaparse.** Son esquemáticos: rotula "aproximado" y no inventes frentes con precisión falsa.
- Antes de usar los polígonos, pruébalos con ciudades clave dentro/fuera por fase (ver `work/zonas/` del episodio de
  Ucrania: `make_zonas.py` con ray-casting) y mira capturas de cada fase.
- El generador `tools/build_scene.py` los convierte en un solo ítem `territory.zone` con `states`.

### Componentes nuevos o piezas nuevas de mapa: DEBEN quedar en el Showcase (paso final obligatorio)

Si un video necesita un componente (satélite, enjambre, zona de control, foto hexagonal…) o una marca que falta,
**se implementa en el motor principal, nunca en la carpeta del episodio**. El video no está terminado hasta que la pieza
esté disponible y validada en Showcase. No se acepta copiarla entre motores. Al cerrar el trabajo del componente:
1. Desde la raíz de la plantilla compartida: `node engine/tactico/tools/catalog.mjs` (regenera `components.json` y `animations/*.json`) y `node tools/componentes-md.mjs`.
2. La pieza lleva `demo` en su `Tactico.component(...)` (un ejemplo que se vea solo en la galería, fondo liso, sin mapa extra) y
   un título/descripción claros en `summary`.
3. Showcase y el orquestador derivan los contratos del mismo `engine/tactico/components.json`: al registrar la pieza
   en el motor principal queda disponible en ambos. No dupliques su esquema en un catálogo independiente.
   La definición compartida solo conserva organización y ejemplos de datos; estos reutilizan el `type` original
   y sus parámetros. Comprueba en `/showcase` que la tarjeta existe y se anima usando ese mismo componente.
4. **Encárgalo a Luna (`gpt-6-luna`, esfuerzo máximo = `xhigh` en `run-model.sh`)**: el orquestador NO registra a mano, solo
   orquesta. Brief `~/codex/nexa-brief/BRIEF-showcase-<video>.md` con la lista de piezas nuevas; Luna regenera el catálogo,
   comprueba que cada pieza aparece en `/showcase` (Atlas en Movimiento) con su vista previa, completa `demo`/`summary`/tokens
   de estilo en los 4 estilos (`estilo-validate` con 0 errores), genera el poster si falta y escribe `work/results/showcase-<video>.md`.
   Lanza: `~/codex/nexa-brief/run-model.sh gpt-6-luna xhigh showcase-<video>` (añade la tarea a `budgets.txt`).
5. **Es obligatorio y no se puede omitir**: toda pieza o marca de mapa NUEVA se registra en el catálogo en el mismo video en que
   se crea, para que cualquier agente futuro la encuentre en `COMPONENTES.md`/Showcase y la reutilice. Un video con piezas nuevas
   no registradas NO está listo. El informe final nombra las piezas nuevas y pega la confirmación de Luna.

### Leyendas que permanecen: se APILAN hacia arriba (regla fija, pedida el 2026-11-10)

Todo lo que deba quedar marcado en pantalla lleva su **leyenda en la esquina inferior derecha** (en escritorio hay espacio de
sobra) y **cada leyenda nueva se pone ENCIMA de la anterior**, nunca en otro rincón ni tapando: `slot:0` es la de abajo
(p. ej. «CONTROL RUSO · APROXIMADO», cuadro plano rojo), `slot:1` va justo encima (p. ej. «CONTROL UCRANIANO · APROXIMADO», cuadro
plano amarillo), `slot:2` encima de esa, etc. (máx. 6). **Todas arrancan en el mismo punto** (misma columna, mismo x; `legendAncho`)
y todas llevan el mismo cuadro plano, que solo cambia de color (`color`/`tinta`); el `icon:"check"` es opcional y no es el defecto. Una zona = una leyenda; si una zona desaparece, su leyenda se va con ella.
Segunda zona de otro bando (ejemplo real, incursión ucraniana en Kursk, ago 2024):
```json
{"desde":"s25","ancla":"cruzaron","hasta":"fin","inicial":"KURSK","conjuntos":"assets/zonas.json",
 "tinta":"ucrania","label":"CONTROL UCRANIANO · APROXIMADO","slot":1,"fade":1.2,
 "clip":[{"region":"RU","box":[34.4,50.8,36.2,51.8]}]}
```
- `tinta:"ucrania"` = amarillo 50 % (token `ucr2.territorio.zonaUcrania`); `rusia` (por defecto) = rojo 50 %. Para otros temas cambia
  `color`/`colorBorde` (tinta con alfa, p. ej. `"#3B82F6@.5"`) y el `label`.
- `clip` puede apuntar a otro país (aquí Rusia, solo una caja alrededor de Kursk): el anillo se recorta con sus fronteras.
- **No pongas tropas encima de una zona recién marcada**: las unidades persistentes (`army.* persist`) van junto a ella
  (en Kursk, el grupo ucraniano queda en el lado de Sumy), para que la zona se vea.
- Lo mismo para otros elementos que permanecen (retratos `image.hex`, cifras acumuladas): ocupan su sitio fijo y lo nuevo se
  apila al lado/encima; en escritorio aprovecha ese espacio en vez de tapar el mapa.

## 5. Estilo, formato y estilos de texto

`estilo: "v4-atlas"` por defecto; `v2-mando`, `v3-cine`, `clasico` son alternativas (`engine/tactico/AGENTE.md §4`).
El formato (móvil 9:16 / escritorio 16:9) lo deduce el motor; la escena sirve para ambos. Verifica los dos.

## 6. Contrato de entrada del generador (`build_scene.py`)

`assets/script.json`:

```jsonc
{ "title": "...", "voice": "Charon", "language": "es",
  "escena": {                       // configuración global (opcional salvo `places`)
    "estilo": "v4-atlas",
    "center": [31.5, 49.0], "camara_inicial": {"center": [31.5,49.0], "zoom": 5.4},
    "intro": {"title": "...", "subtitle": "...", "kicker": "ATLAS EN MOVIMIENTO"},
    "outro": {"channel": "NODEHISTORY", "handle": "youtube.com/@..."},
    "places": {"Kyiv": [30.52, 50.45]},
    "territorios": [{"region":"UA","bando":"otro","opacity":0.8}, {"region":"RU","bando":"atacante","desde":"s07"}],
    "sonidos": []                   // cues de sound; la mezcla es otro paso
  },
  "segments": [ {
      "id": "s05", "tone": "...", "intensity": 0.8, "text": "...", "claim_ids": ["U05"],
      "plan": {
        "texto": {"fecha": "1 DIC 1991", "lugar": "UCRANIA", "titular": "Referéndum · 90 %", "nota": "...", "year": "1991", "salto": "..."},
        "camara": {"center": [31,49], "zoom": 6.5, "offset": 0},
        "componentes": [ {"tipo": "army.advance", "offset": 1.0, "dur": 8, "at": [...], "path": {...}, "flag": "RU"} ],
        "medios": [ {"tipo": "document.clip", "offset": 0.5, "dur": 9, "src": "assets/media/x.jpg", "caption": "...", "source": "...", "credit": "...", "side": "izq"} ]
      } } ] }
```

Los parámetros de `componentes` y `medios` son los del JSON de esa pieza (`animations/<tipo>.json`, campo
`example`). El generador copia cada pieza con su tipo real y marca `segment` para que la auditoría compruebe
el plan. Tiempos relativos al inicio de la frase (`offset`) → si la voz cambia, la escena se reacomoda.

## 7. Reporte final (siempre, y empieza por lo que falta)

1. **Lo que falta o salió reducido**, primero. Si Codex falló y entró Haiku, o faltan imágenes, se dice aquí.
2. Tema, duración, formato, estado `"listo"` (así aparece en la pestaña Preparación; "en preparación" NO lo reconoce la web), sin MP4.
3. Cobertura: tipos usados, familias, nº de imágenes/documentos, unidades, tramos sin movimiento (de
   `cobertura-audit`), choques de ranuras (de `estilo-audit`).
4. Qué se delegó, a qué modelo y qué se rehízo.
5. Rutas: guion, escena, hoja de contactos, créditos.
6. Qué debe mirar el usuario.

## 8. Lo que ya salió mal (no se repite)

- **Escena solo de texto.** Un video de 7,5 min con 12 tipos de pieza (59 de 63 eran texto), 0 imágenes y 1
  unidad pasó "0 choques" y se declaró listo. Ahora lo frena `cobertura-audit.mjs`.
- **`visual_cue` ignorado.** El guion pedía 21 documentos y 3 cambios de control; el generador no los
  implementaba. Ahora el `plan` es dato obligatorio y el audit compara plan contra escena.
- **Sin etapa de medios.** Nadie descargó imágenes; los documentos se omitieron en silencio. El paso 5 es obligatorio.
- **Codex sin cuota y el flujo siguió con la mitad.** Ver §2: respaldo Haiku 5.5, nunca versión reducida.
- **"Detalles menores" para fallas centrales.** El reporte dice primero lo que falta.
- **Guion como lista de hechos.** Ver `GUION.md`: un video se cuenta con escenas, personas y tensión.
- Países con rótulo en el mismo punto, rutas `work/…` en la escena, `bando` solo admite `atacante|otro`
  (`engine/tactico/AGENTE.md §7`).

## 9. Cómo se hizo bien el video «Así comenzó la invasión de Rusia a Ucrania» (receta para el siguiente)

Resultado: ~11,8 min, 195 piezas de 32 tipos, 22 imágenes con crédito, 48 sonidos, 0 tramos sin acción. Receta:

1. **Guion** por Terra 6.1 (rol `script`, respaldo Haiku 5.5): ledger ampliado + `script.json` con `plan` por segmento. Una **segunda pasada** de Terra con el informe de `cobertura-audit` llenó los huecos (el primer plan dejó tramos de 20–26 s sin acción).
2. **Medios**: `python3 tools/media-fetch.py <episodio>` con `work/medios-necesarios.json`; si la búsqueda automática elige mal, ponga `commons: "File:..."` exacto (búsqueda auxiliar: `python3 tools/media-search.py "consulta"` → lista títulos y licencias de Commons). **Mira siempre la hoja de contactos de las imágenes**: la búsqueda trajo un carrusel por «ONU». Sin imagen libre del hecho (tratados, documentos) se quita la pieza, no se inventa.
3. **Voz** (`narrate.py`, Charon) → **transcripción** (`transcribe.py`) → `build_scene.py`. Whisper escribe las cifras con dígitos: `build_scene.py` resuelve anclas «veinticuatro», «mil» al primer número del segmento.
4. **Auditorías**: `cobertura-audit.mjs` (las piezas de más de 60 s —retratos— no cuentan como actividad) y revisión visual real con capturas 9:16 y 16:9 (`seek` con `window.__promo.seek(t)`).
5. **Sonido**: `node tools/mixdown.mjs` junta voz + efectos de cada pieza (`sfx`). El generador deja el sonido de cada pieza ACTIVO; `"sfx": false` solo para silenciar. Un solo grupo `army.advance` por segmento con sonido; el resto sin él.

### Reglas aprendidas (cada una costó una iteración)
- `territory.wash`: `settle` ≈ 0,3 (con 1 queda opaco y tapa el mapa); `from` ∈ izq|der|arriba|abajo|centro. `territory.control`/`fill` trabajan por PAÍS: no sirven para pintar Crimea o Donbás (salen rectángulos); use `front.line` + flechas + `badge.count`.
- Parámetros con enum/rango exacto (ver `COMPONENTES.md`): `space.satellite.pulses` es booleano, `image.hex.focus` es [x,y] entre 0 y 1. Una escena con un parámetro inválido NO carga: valide antes de entregar.
- Tropas: `count` ≤ 16 por grupo y `scale` ≈ 0,6 para que se lean como formaciones; 4–6 grupos por frente. Un grupo sin rótulo lleva `"banner": false` y `"label": " "` (con label vacío el motor pone «EJÉRCITO»). Un solo rótulo por frente; la nota «posición esquemática» una vez por segmento (los `label.callout` idénticos se montan).
- Colores de `air.swarm` y `space.satellite` salen del estilo (`ucr2.aire`): en mapa satelital oscuro deben ser claros (cuerpo `tinta`, borde `panel`).
- Cámara: panorama a zoom ≈ 4,8 (móvil −0,6 por estilo); para geopolítica (China, India, petróleo) mueva la cámara a `center [75,47]` zoom ≈ 3,1, o las piezas quedan fuera de cuadro.
- Un segmento «sin nada que ver» (diplomacia, votación) no se rellena con una foto falsa: se usa `badge.count`, flechas de ruta o cámara.

### Estructura de carpetas y fuente única (2026-11-10)
Los videos viven en `$NEXA_PROFILE_DIR/productions/<categoría>/<id>/` y contienen datos y medios. Su entrada
carga `/api/v1/explainer/files/bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js`; esa URL sirve el motor
principal del repositorio. Las fuentes, sprites y geografía compartidos se resuelven desde el motor; las fotos,
audio, transcripción y escena siguen en el episodio. Ejecuta `build_scene.py`, validadores y mezclador desde la
plantilla central, pasando la carpeta del episodio. No uses `rsync engine/`, enlaces a motores por episodio ni
generadores propios. Las copias históricas se retiran solo tras comparar resultados y conservar cualquier diferencia
válida en parámetros o en el motor principal; nunca se activan para eludir la validación.

## Blender (MCP): abrir, usar y CERRAR

La regla única de cierre está en `nodeatlas/AGENTS.md`, sección «Blender (MCP)».
Cada agente debe guardar su trabajo, cerrar los procesos que abrió y verificar que
finalizaron. La instancia y las conexiones compartidas se conservan mientras otro
trabajo pueda utilizarlas; la antigüedad no demuestra que estén inactivas.
El inventario y el cierre de PID identificados se hacen con
`atlas-en-movimiento/tools/cerrar-blender-mcp.sh`; sin argumentos solo lista procesos.
