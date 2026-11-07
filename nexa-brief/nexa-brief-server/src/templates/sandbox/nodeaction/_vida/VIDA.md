# Vida en Escena

Motor compartido Canvas 2D para episodios 16:9 y 9:16: identidad vectorial, acciones por capas,
objetos con dueño único, escenarios ilustrados, cámara, diálogo y subtítulos del guion alineados a Whisper. La misma
función `renderFrame(ctx, compiled, t, {view, framing})` sirve en navegador y en Node; no depende del orden de seek.
El estudio de personajes de la etapa 1 sigue disponible en `studio.html`.

## Ejecutar

Desde `sandbox/nodeaction/_vida/`:

```sh
npm ci --cache "$HOME/.npm"                    # solo si faltan dependencias
node tools/validate.mjs ../vida-en-escena/assets/episodes/prueba-corta.json
node --test test/*.test.mjs
node tools/mix.mjs ../vida-en-escena/assets/episodes/prueba-corta.json
node tools/render.mjs ../vida-en-escena/assets/episodes/prueba-corta.json ../vida-en-escena/review/prueba-corta.mp4
node tools/review.mjs ../vida-en-escena/assets/episodes/prueba-corta.json ../vida-en-escena/review --every 0.5
node tools/walk-review.mjs ../vida-en-escena/assets/episodes/prueba-corta.json ../vida-en-escena/review/prueba-corta-walk.jpg
node tools/browser-check.mjs
node tools/browser-episode-check.mjs
node tools/review-sets.mjs
node tools/review-catalog.mjs
node tools/catalog.mjs
```

`render.mjs` admite `--from 2 --to 5 --scale 0.5`; la entrega por defecto conserva **1080×1920,
30 fps, H.264 CRF 18, yuv420p y AAC 192 kbit/s**. Envía RGBA por stdin a ffmpeg, respeta backpressure
y no guarda cuadros. El JSON al lado del MP4 registra duración, fps de render, CPU del proceso,
RSS máximo y CPU/RSS de ffmpeg medidos con `/usr/bin/time -v`. Hay un único render de video a la vez.
Los temporales viven en `/tmp/vida-escena-*` y se borran en `finally`, también ante error.

Los comprobadores de navegador usan Chromium **ya instalado** en `PLAYWRIGHT_BROWSERS_PATH` o
`~/.cache/ms-playwright`; eligen un ejecutable local cuando la revisión de Playwright no coincide.
`TMPDIR=/tmp`. No descargan navegadores y no crean cachés dentro del repositorio. Levantan un
servidor temporal en un puerto libre y lo cierran; no reinician servicios.

## Arquitectura y flujo

| Módulo | Contrato |
|---|---|
| `engine/core/compile.js` | `compile(episode, timing, catalog)` puro; resuelve escenas, pasos, anclas y registros de propiedad. Errores con ruta JSON en español. |
| `engine/core/sample.js` | `sampleScene(compiled,t)`: reconstruye poses, voz, objetos, FX y superficies desde cero. |
| `engine/act/index.js` | Registro `ACTIONS[name] = {params,minDur,defaultDur,layers,plan(ctx),sample(state,tLocal)}`. |
| `engine/rig/`, `engine/face/` | IK y dibujo aprobados en etapa 1, con correcciones de manos/pies/coleta y el parámetro compatible `silent`. |
| `engine/props/` | Formas de tinta fina, medidas y grip. Ninguna geometría vive en el episodio. |
| `engine/sets/` | Lámina, mobiliario back/front, sombra de contacto y tinte multiplicativo. |
| `engine/camera/` | Rectángulo por vista, área segura y salidas 16:9/9:16; director y overrides por datos. |
| `engine/fx/` | Glifos anclados a cabeza o punto de contacto. |
| `engine/ui/` | Subtítulos de 1–3 palabras del guion con tiempos Whisper, título y cierre opcionales. Anton local. |
| `engine/render.js` | Dibuja un cuadro; el único argumento que se modifica es el contexto Canvas. |
| `tools/runtime.mjs` | IO Node: JSON, archivos, imágenes y registro de fuente. |
| `player.js` | IO/DOM del navegador, reloj de audio y adaptador del reproductor. Fuera de `engine/`. |

El `catalog` pasado al compilador incluye mapas `characters`, `sets` (fichas completas) y `voices`
(ids disponibles); el cargador hidrata esos mapas desde los archivos locales. `catalog.json` es
el inventario para agentes, con parámetros/rangos/defaults, demos y `used_by`.
Las imágenes precargadas viven en `compiled.resources.plates[id].{image,blurred,backdrop,feathered,blurredFeathered}`.
El cargador aporta además `resources.createCanvas(w,h)` (Node o navegador) para componer el whip
en una superficie nueva a resolución completa y desenfocarla una sola vez. No se guardan cuadros
ni se modifica estado entre seeks. El fondo desenfocado y el suelo prolongado permanecen opacos;
en fit, una copia completa estirada, desenfocada y atenuada rellena el viewport; el borde de la lámina se desvanece sobre ella. tight conserva la continuación reflejada anterior. El motor no hace
fetch, no usa DOM, tiempo de pared, aleatoriedad global ni acumulación por cuadro.

Orden de composición: lámina → props back → sombras → mochila/espalda → personajes → props front → objetos de
mano y dedos sobre el grip → tinte → glifos → UI. Las sillas/bancos se pintan detrás del cuerpo y los muslos; mesas/escritorios pueden ocluir piernas. Los demás props respetan
su `layer`. La oclusión es explícita, no una simulación 3D.

## Episodio y tiempo absoluto

```json
{
  "version": 1,
  "id": "ejemplo",
  "format": {"width":1080,"height":1920,"fps":30},
  "resources": {"timing":"../timing.json","audioBase":"../","dialogue":"../mixes/ejemplo/dialogue.mp3"},
  "cast": {"tomas":"tomas","nico":"nico"},
  "scenes": [{
    "set":"escuela-entrada",
    "actors":{"tomas":{"at":"arrive","view":"3q-right"},"nico":{"at":"meet","view":"3q-left"}},
    "objects":{"libro":{"prop":"notebook","owner":{"actor":"nico","hand":"left"}}},
    "steps":[{"say":"L01","intent":"exclaim"},{"parallel":[{"wait":1},{"do":{"who":"tomas","action":"wave","dur":1}}]}],
    "actions":[{"who":"tomas","action":"react","kind":"shy","at":"@L01.despeinado","dur":1.1}]
  }]
}
```

Todas las rutas de `resources` son relativas al JSON del episodio; los `clip` de timing son relativos
a `audioBase`. `script` es opcional y aporta identidad, texto y emoción. **El subtítulo toma `script[].text`**;
si falta, usa `timing.lines[id].text` (el guion de producción guardado al generar la voz).
`alignScript()` alinea tokens con Whisper por edición mínima, ignorando caja, puntuación, tildes y
normalizando números españoles 0–20: «diez» alinea con «10». Conserva puntuación y ortografía del
guion y cada `s/e` original. Una palabra desalineada conserva Whisper y genera un aviso con ruta;
una palabra del guion sin tiempo se omite con aviso. Las anclas y visemas siguen usando `line.words`
original; `line.subtitleWords` contiene únicamente el texto de presentación. La duración de `say` viene del WAV en `timing.lines[id].dur`; un `trim:{in,out}` opcional
se expresa en segundos del clip y no puede eliminar palabras de Whisper. No cambia los originales.
`gap` agrega pausa después de una línea. `parallel` dura el máximo de sus hijos; `do` puede contener
una acción o una lista simultánea; `wait` crea una pausa. `scenes[].actions` son eventos de fondo
anclados a números (relativos a la escena) o a líneas/palabras.

Anclas: `@L01`, `@L01:end`, `@L01.despeinado`, `@L01+0.4`, `@L01.despeinado-0.2`.
Se ignoran mayúsculas, puntuación y tildes al buscar una palabra; `@L01.palabra#2` elige la segunda
ocurrencia. Una palabra ausente es error: no se inventa ni se reemplaza desde el guion. Una línea
solo puede aparecer una vez por episodio; las repeticiones requieren un nuevo id en timing.

La compilación genera los mismos `t0/t1` para preview, mix, render y revisión. `mix.mjs` hace `atrim`,
restaura PTS y aplica `adelay` en muestras de 48 kHz. Mezcla opcionalmente `resources.ambient` con
`ambientGain` (0–1, por defecto 0,08), normaliza a −16 LUFS y verifica el archivo codificado. Un
catálogo sin líneas obtiene una pista de silencio digital (LUFS no definido) para mantener un único
reloj de audio. No se genera TTS ni se altera `assets/audio/` o `assets/timing.json` en esta etapa.

Boca: grafemas españoles de cada palabra distribuídos sobre sus tiempos Whisper, interpolación de
visemas y energía RMS a 100 Hz. Fuera de palabra/voz se cierra la apertura y se conserva la curva
expresiva; una sonrisa no se transforma en una boca neutra. El campo compatible `face.silent=true`
permite ese cierre. La risa sin voz se expresa con ojos/cuerpo/FX, sin apertura bucal. `eat` añade una apertura funcional de lamida (`L` con lengua); la voz tiene prioridad y la revisión distingue comida de habla espuria.

## Capas, continuidad y propiedad

Orden: locomoción → orientación → cuerpo → brazo izquierdo/derecho → cabeza/mirada → cara → boca.
El estado de locomoción/sentado/giro persiste al finalizar. Los gestos transitorios se mezclan con
entrada/salida `smoothstep`; `fade` (0,04–1 s, por defecto 0,18) está limitado a un tercio de la acción.
`weight` (0–1) controla su intensidad geométrica. `talk/listen` automáticos son capas base; una acción
explícita reemplaza solo sus canales. La mano que sostiene un objeto queda reservada y mantiene su
agarre aunque el otro brazo gesticule. `hold.hug` aproxima el cuaderno al pecho con ambas manos. `hold.carry` persiste tras el paso y
acepta `side` (default: brazo abajo, grip junto a cadera), `chest`, `front` y `behind`. La transición
entra en hasta 0,3 s; `behind` se dibuja detrás del cuerpo. `give` empieza desde la posición de carry
actual, sin volver primero a una pose de sostén diferente.

Dos acciones explícitas incompatibles sobre el mismo canal fallan con ambas rutas de origen. Un
`blend:true` permite una mezcla intencional y ordenada; caminar y sentarse sigue prohibido. `give` y
`highfive` reservan también la mano del receptor. El compilador rechaza dos transferencias simultáneas
del mismo objeto y dos objetos ocupando una misma mano/espalda.

Cada objeto tiene un dueño: `{actor,hand}`, `{actor,slot:"back"}`, `{actor,slot:"pocket"}` o `{anchor}` (nombre o `[x,y]`).
`pick/take` recogen desde ancla/superficie; `take` también recoge desde la espalda propia; `give/put/hold/eat/wear/stow` exigen posesión. `unwear` exige espalda propia y `unstow` bolsillo propio. Cada mano, espalda y bolsillo admite un objeto; un segundo dueño/objeto simultáneo es error. Un registro
ordenado `history` define el dueño en cualquier segundo. `give` extiende las manos, mantiene contacto
0,2 s, transfiere a mitad de acción y retira cada brazo; el objeto se dibuja desde el grip exacto de
la mano resuelta por IK. `wear` lleva ese grip a la espalda antes del cambio de slot.
Los puntos de interacción deben estar al alcance del personaje; no hay navegación automática ni
búsqueda de caminos alrededor de muebles. Colocá el personaje cerca del objeto o agregá `walk`.

## API de acciones

Todos los eventos usan `who`, `action`, `at` opcional y `dur` opcional. `hand` es `left|right`,
por defecto `right`. Las duraciones/rangos exhaustivos se generan en `catalog.json` y el schema.

| Acción | Parámetros específicos y comportamiento |
|---|---|
| `idle` | Respiración/parpadeo deterministas de base. |
| `walk` | `to` ancla/x/punto; `speed` 0,1–3 alturas/s (default 1); `ease` smooth/smoother/linear; `view` final (cinco vistas; por defecto hereda la vista del plano), `spacing` 0–2 (1,15). Duración inferida por distancia/speed si se omite. Fase por distancia, apoyo mundial fijo, braceo opuesto a piernas, rodillas hacia avance en cualquier vista y punta/talón en balanceo. Giro a perfil en 0,23 s y regreso al frenar; cadera ajustada al alcance IK, sin cuclillas. Destinos ocupados se acortan a distancia de conversación y miran al ocupante. |
| `stop` | `breath` 0–1: asentamiento y jadeo corporal. |
| `talk` | `line`, `intent=explain|ask|exclaim|deny|whisper|list`, `face` e `intensity` opcionales. Seis siluetas por intent en `act/gestures.js`, acentos por longitud/RMS, anticipación de 0,20 s y hold de 0,3–0,8 s. Alternancia sin repetición; si una mano está ocupada, el gesto principal pasa al brazo libre. Creado automáticamente por `say`. |
| `listen` | `to` hablante, `line`, `reactions:[{word,kind}]` o `{at,kind}` relativo a la acción; `react` admite expresión, `{kind,intensity,at/word}` o `false`. Mirada, parpadeo, asentimientos de ±6° en pausas y cambio de expresión a mitad de línea. Sin override, `!` produce sorpresa y `?` curiosidad. También se admite `say.listen.react`. Automático en los demás actores de cada línea. |
| `react` | `kind=surprise|laugh|shy|worry|annoyed|relief|shock`, `intensity` 0–1 (1). Anticipación/pico/retorno, cabeza y cuerpo, risa con rebote, salto en susto, ojos hasta el doble y FX. Sentado conserva cadera/asiento, rodillas y pies: sobresalto de torso/cara. `shock` coloca las manos libres en las mejillas del mismo lado (sin cruzarlas). |
| `sit` / `stand` | `seat` ancla kind=seat para sit; borde inferior de pelvis/ropa exactamente en `seatY`, piernas proyectadas con canillas verticales y pies apoyados. `view` opcional: default 3q según facing del asiento; front conserva rodillas juntas y muslos en escorzo. Stand conserva el punto de suelo y acepta `seat` opcional. |
| `pick` / `take` | `object`, `hand`; dueño inicial en ancla/superficie o espalda propia (`take`). Alcanzar, tomar y volver a la pose de sostén. |
| `hold` | `object`, `hand`, `hug` booleano (false), `carry=side|chest|front|behind` (side); sostén persistente o abrazo suave. |
| `give` | `object`, `hand`, `to`/`recipient`, `recipientHand` (right); contacto 0,2 s y cambio de dueño continuo. |
| `put` | `object`, `hand`, `to` ancla/punto; dejar sobre superficie y retirar mano. |
| `wear` / `unwear` | `object`, `hand`; llevar mochila de mano a espalda / alcanzarla atrás y pasarla a mano. Contacto y transferencia al 65 %; retirada suave. |
| `stow` / `unstow` | `object`, `hand`; mano → cadera → bolsillo invisible / recorrido inverso. Slot `pocket` con dueño único; la mano queda libre. |
| `look` | `to` actor/objeto/ancla/punto o `camera` para mirar al espectador. |
| `point` | `to`, `hand`; mano con índice y ángulo dirigido al objetivo, mirada acompaña. |
| `turn` | `view=front|3q-left|3q-right|side-left|side-right`; giro interpolado y persistente. |
| `wave` | `hand`; saludo oscilante. |
| `highfive` | `to` actor, `hand`, `recipientHand` (left); encuentro y destello en el contacto. |
| `eat` | `item` (alias compatible `object`), `hand`, `cycles` 1–8. Cuchara exige `plate` y usa 1 ciclo por defecto; otros objetos van desde carry hasta la boca. `icecream` usa 3 ciclos por defecto y lengua/visema L sin voz. |
| `open` | `object` id de puerta/portón, `hand`, `amount` 0–1 (1); alcanzar manija, girar hoja, liberar y conservar apertura. |
| `cross-arms` / `hands-hips` | Ambos brazos, mezcla con la base. |
| `touch-head` | `hand`; contacto lateral de la cabeza con mano plana. |
| `gesture` | `kind=shrug|open-arms|facepalm|count-fingers|thumbs-up|nod|shake-head`, `intensity` 0–1 (1), `dur` (.25–120, default 1.2), `hand` cuando usa una mano. No necesita línea; contar muestra 1/2/3 dedos. Las manos ocupadas conservan el agarre. |
| `fx` | `kind=shock|?|!|sweat|blush|tears|sparkle|hearts|motion`, `dur` (.1–120, default 1), `intensity` 0–1, `size` .25–3 (1), `offset:[.19,-.14]` en alturas del actor desde cabeza. Canal independiente, compatible con hablar o reaccionar. |

## Objetos, escenarios, cámara y UI

Objetos de mano: `backpack notebook icecream phone spoon plate cup`; el `grip` es un punto local
estable en píxeles a escala 560. El objeto se traslada por el negativo de ese grip antes de dibujarse.
Mobiliario: `school-gate desk chair bench table door lamp plant`. Decoración por datos:
`wall-clock frame shelf rug poster`. `params.color`, `h`, `seatY`, `surfaceY`, `open`, `handleY` y `on`
controlan las formas que los usan. La línea es más fina que la del personaje y los colores son planos.

Las láminas aprobadas son 1536×1024; `floorY=960`, `charHeight=560` en los cuatro sets iniciales y `400` en heladería, `walk=[140,1396]`.
El suelo visual empieza en escuela y=719, aula y=710, parque y=683 y comedor y=688. Puerta/portón se
alinean al hueco arquitectónico del fondo; las anclas son apoyo de pies. Los muebles y las anclas
se recalibraron desde la antigua escala de 300 px. Ver `docs/SETS.md` y `review/sets.jpg`: un
personaje en cada una de las 20 anclas. Los SHA-256 de los PNG originales permanecen en créditos.

El modo compatible `framing:"tight"`, en `view:"portrait"`, conserva **1080×1920 (9:16)** con y sin diálogo. Los siguientes detalles ópticos describen ese modo; el default `fit` se explica en «Vista y encuadre» y protege también pies/objetos en ambas orientaciones. Las alturas
se calculan desde `rig.scale = charHeight × character.height`: medium usa 1,32 alturas del actor y
close 0,96; two ajusta las siluetas completas y su ancho. Márgenes, reserva de gestos y pies también
son relativos a esa escala. La banda de subtítulos sigue en 1360–1500 px de **pantalla**: se protege
el borde de manos y objetos antes de 1340 mediante la proyección real, no reservando 1340/1920 de
una lámina con altura fija. Los pies pueden quedar debajo de la banda.
La cámara se mantiene en la lámina cuando cabe; solo extiende si el grupo completo no cabe en
9:16 o proteger la banda lo exige. La extensión refleja la imagen y aplica blur, sin franjas de
color ni estiramiento de una fila. No se modifica el PNG ni se deforma el rig.
La cámara profesional y su contrato vigente están en [docs/CAMARA.md](docs/CAMARA.md).
Incluye `camera.style` global, perfiles limitados por velocidad/aceleración/jerk,
`push/pull/drift/track/reveal/hold/whip`, aliases heredados, encuadre estable por envolvente,
presets, `from/to`, respiración determinista y avisos por movimientos imposibles.
El director corta en beats del guion y acciones; ya no introduce cortes por reloj cada 5,5 s.
Los overrides conservan prioridad y tiempos; `locked` no desactiva la protección de `fit`.
`cameraAt` sigue siendo puro y compatible con ambas vistas y `fit:false`/`tight`.

`ui.subtitles` puede ser false o `{x:540,y:1430,size:78,maxWords:3}`. En tight, banda segura real **1360–1500**,
x=60–1020. El renderer ajusta el y histórico (por ejemplo 1405) al mínimo que mantiene glifos y
contorno dentro de la banda. Anton local, blanco con contorno negro. Las palabras originales y sus
avisos de alineación se pueden inspeccionar en `compiled.lines[].subtitleWords` / `compiled.warnings`.
El título inicial y cierre continúan siendo opcionales. `worldToScreen` proyecta con las dimensiones lógicas de `camera.view`.

### Emociones y espacio de conversación

`data/emotions.json` contiene reglas ordenadas de palabras clave (sin tildes), expresión e intensidad,
y opcionalmente canales como párpados. Cubre alegría, burla, pánico, timidez, alivio, escepticismo,
risa, susurro, orgullo, cariño, curiosidad y cansancio. La primera regla coincidente prevalece;
`script[].emotion` es texto libre. `say.face` y `say.intensity` sobrescriben los defaults. La tabla
se carga por Node y navegador, sin JSON import específico de una plataforma.

La distancia de conversación es radio A + radio B + **1,15 × diámetro medio**: se mide el hueco
entre bordes de cabeza, en unidades de mundo. `walk` considera posiciones ya planificadas al llegar,
acorta su destino si invadiría ese espacio y conserva una mirada al interlocutor. No reubica actores
que empiezan mal colocados: `validate` avisa si sus cabezas (incluida tolerancia de pelo) se solapan
más de 0,3 s. La exención de give/highfive aplica solo a la pareja participante. El abrazo de un
objeto no exime solapes entre personas. Una pequeña anticipación de torso hace alcanzable la entrega
entre personas separadas sin mover los pies apoyados.

## Reproductor genérico y validación

`vida-en-escena/index.html` no cambia entre episodios. Carga `config.json` → `assets/config.json` →
JSON embebido. `config.episode` elige el JSON; `?ep=assets/episodes/otro.json` lo sobreescribe.
`?t=12.3` congela; `?controls=1` carga `_tools/player/bridge.js`; `?headless` congela en cero.
Hay un único `<audio>` con `dialogue.mp3`. Play, pausa y animación leen `audio.currentTime`;
si se bloquea autoplay aparece el botón de reproducción, sin reloj sintético.

`window.__promo` expone `total`, `scenes()`, `prepare(t)`, `seek(t)` puro, `release()`,
`missingAnchors()`, `play()` y `pause()`. El puente comparte play/pause/seek/volume/ended con la app.
Los assets tienen que viajar junto al episodio; la referencia al motor compartido se conserva como
`engine:"nodeaction/_vida"`. La entrada propuesta de registro está en
`vida-en-escena/work/results/engines-entry.json`, sin modificar el registro del servidor.

`tools/validate.mjs` sin argumento conserva la validación de fichas; con episodio valida schema,
referencias, rangos, tiempos, capas, propiedad, anclas y recursos en disco; también informa desalineación
del guion y solapes prolongados de cabezas, con ruta JSON. Los tres casos inválidos
en `test/invalid/` cubren referencia ausente, solape y mano ocupada. Los tests también cubren mezcla
paralela, recortes, cámara, palabras, contacto de manos, sit/stand, eat/open/wear, continuidad en
límites y seek secuencial/aleatorio. La comparación browser/Node informa diferencia media por canal.

La revisión registra desviación máxima del pie respecto de su primer contacto (no solo diferencia
entre cuadros), apertura real de `mouthShape` durante silencio, hash de 30 cuadros secuenciales y
en orden permutado, error del grip y encuadres. Además mide rodillas hacia avance, distancia de conversación,
máximo de manos/objetos en pantalla, duración del encuadre y error al regresar de inserts. En tight close/medium se comprueba la región de la cabeza
y se informa el recorte corporal intencional; en insert se admite recortar figuras. Otros actores
fuera del seguimiento se contabilizan por separado. Las métricas no sustituyen la revisión visual.

## Añadir una acción sin romper episodios

1. Agregar una entrada a `ACTIONS` con parámetros tipados/rangos/defaults, duración mínima/default y
   capas exactas. `plan(ctx)` resuelve lo estático una vez; `sample(state,tLocal)` no modifica entradas.
2. Reutilizar objetivos de IK y el mezclador; no reemplazar el rig ni introducir un reloj, acumulador,
   estado global o random. Persistir solo mediante datos compilados y funciones puras.
3. Para una interacción nueva, declarar su reserva de manos y sus cambios de dueño en compile;
   muestrear ambas manos y el grip en el mismo marco mundial. No asignar el mismo objeto a dos actores.
4. Agregar un caso de datos al catálogo y pruebas de límites, seek hacia atrás, alcance/propiedad y
   continuidad. Si usa otra capa, ampliar el mezclador explícitamente.
5. Ejecutar `node tools/build-schema.mjs`, `node tools/catalog.mjs`, tests y revisión visual. Verificar
   la prueba corta y el estudio de etapa 1. Conservar firmas, parámetros opcionales y valores iniciales.

## Rig y cara: referencia compatible de etapa 1

### API principal

```js
import { drawCharacter, posePreset, blendPose } from './engine/index.js';

const character = await fetch('./characters/tomas.json').then(r => r.json());
const a = posePreset('hands-hips', { x: 540, y: 1660, scale: 1350, view: 'front' });
const b = posePreset('wave',       { x: 540, y: 1660, scale: 1350, view: '3q-right' });
const pose = blendPose(a, b, 0.6);
const anchors = drawCharacter(ctx, character, pose, {
  expression: 'smirk', intensity: 0.9,
  lookAt: [850, 500],
  viseme: { from: 'A', to: 'O', mix: 0.35 }, open: 0.7,
}, 2.4);
// anchors.rightHand: [x, y] en el mundo; utilizable para objetos en la etapa 2.
```

`drawCharacter(ctx, character, pose, faceState, t)` solo modifica los píxeles de `ctx`.
Restaura el estado de Canvas y no modifica ficha, pose ni cara. Devuelve anclas `hip`, `neck`,
`head`, `leftHand`, `rightHand`, `leftFoot`, `rightFoot`. `t` son segundos finitos.
El contexto puede tener una transformación de cámara aplicada por quien llama; las anclas y
`lookAt` están **antes de esa cámara**. La conversión del cursor de una futura cámara debe invertirla.

### Coordenadas, esqueleto y poses

Unidades locales: una altura nominal del personaje; x hacia la derecha de pantalla, y hacia abajo.
Origen en el suelo bajo la cadera; la cabeza tiene y negativa. `left` y `right` identifican los
lados de pantalla **en frontal** y mantienen su identidad al girar. No son etiquetas anatómicas.
La escala de dibujo efectiva es `pose.scale × character.height`.

El esqueleto contiene cadera central, dos caderas, torso, centro de hombros, cuello, cabeza y
dos cadenas de brazo/antebrazo/mano y muslo/canilla/pie. Longitudes: brazo `.146`, antebrazo `.143`,
muslo `.166`, canilla `.163`; hombros a `.262` de la cadera. No se estiran los huesos.

| Campo de pose | Tipo / referencia | Valor inicial |
|---|---|---|
| `x`, `y` | píxeles de mundo; origen en el suelo | `0`, `0` |
| `scale` | píxeles por altura nominal, positivo | `800` |
| `rootY` | altura de cadera, y negativa | `-.348` |
| `lean` | inclinación del torso en radianes | `0` |
| `headTilt` | inclinación adicional de cabeza en radianes | `0` |
| `headTurn` | giro adicional de cara en unidades de vista | `0` |
| `view` | nombre o número `[-1,1]` | `front` |
| `feet.left/right` | objetivo de la **suela**, marco del suelo | `[-.065,0]`, `[.065,0]` |
| `hands.left/right` | objetivo desde su respectivo hombro, ejes de pantalla | `[-.025,.279]`, `[.025,.279]` |
| `elbows.left/right` | signo del producto cruzado o vector de preferencia | `1`, `-1` |
| `knees.left/right` | mismo contrato que codos | `1`, `-1` |
| `handShapes.left/right` | `open fist point thumb hold wave flat` | `open` |
| `handAngles.left/right` | radianes; `0` apunta dedos hacia arriba; `null` sigue antebrazo | `null` |
| `armLayer.left/right` | `0` automático; `1` delante de ropa; `2` delante de cara | `0` |
| `secondary` | impulso de pelo/coleta `{at,amplitude,frequency,damping}` | ausente |

`createPose(partial)` completa campos, incluso objetos parciales por lado. No valida una acción
de episodio ni resuelve colisiones. Rango de uso de `lean/headTilt`: aproximadamente `[-.5,.5]`;
objetivos fuera de alcance se recortan al alcance geométrico, sin cambiar longitudes.
`resolveSkeleton(character, pose)` expone articulaciones, anclas y `reachable/error` de cada IK.

`solveIK(origin,target,upper,lower,bend)` recibe unidades arbitrarias y devuelve
`{origin,joint,end,target,reachable,error}`. Un signo positivo coloca la articulación a la izquierda
del vector origen→objetivo en coordenadas de pantalla (producto cruzado positivo).
Un vector, como `[0,-1]`, elige la solución más cercana a esa dirección.

`posePreset(name, overrides)` ofrece `idle`, `open-arms`, `point`, `hands-hips`, `cross-arms`,
`hands-face`, `wave`. Son objetivos y preferencias de IK, no dibujos ni fotogramas.
`blendPose(a,b,weight,channels)` mezcla números y puntos. Ejemplo:

```js
blendPose(a, b, .5, { feet: 0, 'hands.left': 0, 'hands.right': 1, headTilt: .2 });
```

Los canales omitidos usan `weight`; las vistas se convierten a número. Si cambia el signo de un
codo durante una mezcla normal, el objetivo de esa mano pasa suavemente por extensión completa
en el punto medio: permite cambiar de rama IK sin un salto de codo. Para congelar un brazo completo,
congelar tanto `hands.<lado>` como `elbows.<lado>`. Las formas de manos, `null` y las capas explícitas
son categóricas: cambian a mitad de mezcla. La etapa 2 puede temporizar esos cambios en una pose sostenida.

Vistas: `side-left=-1`, `3q-left=-.5`, `front=0`, `3q-right=.5`, `side-right=1`.
`blendView(a,b,u)` y valores numéricos intermedios producen giro continuo. Se estrecha el torso,
los rasgos viajan sobre la cabeza circular y el ojo lejano pierde visibilidad gradualmente.
El brazo lejano tiene un pase detrás del torso y desaparece suavemente del pase delantero.
Los pies conservan sus objetivos de suelo durante el giro. No hay vista de espalda en esta etapa. `pose.footAngles.left/right` es un ángulo opcional (0 por
defecto), usado solo en balanceo al caminar; el pie apoyado conserva ángulo cero y ancla fija.

`gaitPose(distance, options)` prepara objetivos a partir de **distancia recorrida**, nunca del tiempo.
`stride=.43`, `stance=.58`, `lift=.045`, `direction=1`; el apoyo cumple
`posición_mundo + objetivo_local = constante`. Es una base geométrica para la locomoción de la
etapa 2, no una acción `walk` con trayectoria ni planificación. Distancia en alturas; el llamador
debe convertirla a píxeles con la misma escala efectiva y aplicar `direction` al desplazamiento mundial.

### Cara, mirada y boca

Expresiones: `neutral smile smirk grin laugh sad worry surprise shock annoyed skeptical shy love think`.
La ficha decide la expresión base, y `faceState.expression` puede reemplazarla.
`intensity` en `[0,1]` mezcla desde neutral; `mix:{from,to,weight}` mezcla dos expresiones completas.
`resolveFace()` y `blendFace()` permiten inspeccionar/mezclar los canales resueltos.

| Campo de cara | Tipo / rango | Inicial |
|---|---|---|
| `eyeScale` | multiplicador, `.7–1.4` recomendado | ficha o `1` |
| `lookAt` | `[x,y]` en mundo; se invierte rotación de cabeza | mirada de la emoción |
| `lids.upper/lower` | número o `[izq,der]`, `0–1` | emoción |
| `lids.closed/happy` | `0–1`; cierre y curvatura de ojo feliz | emoción |
| `brows.left/right` | `{height,angle,curve}` | emoción |
| `brows.*.height` | desplazamiento expresivo, `-.2–.3` recomendado | emoción |
| `brows.*.angle` | radianes, `-.6–.6` recomendado | emoción |
| `brows.*.curve` | curvatura relativa al radio, `0–.3` | emoción |
| `blush/tears/sweat` | `0–1` | emoción |
| `blink` | `auto`, `false`, `off`, o cierre manual `0–1` | `auto` |
| `closeUp` | booleano; suprime parpadeo en sorpresa/shock, también mezcladas | `false` |
| `viseme` | nombre o `{from,to,mix}` | boca de emoción |
| `open` | energía `0–1`, cierra a cero | `1` |
| `speechWeight` | mezcla del visema sobre la boca de emoción, `0–1` | `1` |

Los ojos tienen blanco, pupila limitada al interior, párpados y cejas independientes. Rubor, gotas,
lágrimas y corazones se dibujan como formas. Los párpados mantienen una apertura continua al cerrar.
El parpadeo reconstruye un stream mulberry32 por identidad/semilla; comienzos separados por
`2.5–5 s`, duración `.15–.22 s`. Seek hacia atrás o llamadas fuera de orden no cambian el resultado.
La protección de sorpresa en primer plano prevalece incluso sobre un parpadeo manual.

Bocas y visemas comparten topología Bézier y canales numéricos de ancho, apertura, curva,
asimetría, dientes, lengua y labio. `viseme.mix` usa smoothstep; dientes y lengua también se mezclan.
Visemas del PLAN: **nueve**, `X A E I O U MBP FV L`. Para las **diez muestras** que pide el brief,
la hoja incluye los nueve más una transición **A→O al 50 %**, rotulada como tal.
`X` cierra en reposo; `MBP` agrega presión/labio; `FV` muestra incisivos; `L` eleva la lengua.

`visemesForWord(palabra)` devuelve un array de nombres por grafema. Normaliza mayúsculas y
tildes; conserva `ü`; omite `h` y la `u` muda de `qu/gu(e,i)`; `ch→E`, `ll/rr→L`,
`m/b/p→MBP`, `f/v→FV`, `l/r/n/d/t/ñ→L`, `y→I`; las demás consonantes reconocidas usan `X`.
No combina repeticiones, para preservar unidades temporizables. Signos y dígitos se omiten.
Ejemplos: `hola → O L A`, `queso → X E X O`, `guitarra → X I L A L A`.
Es aproximación gráfica del español, no transcripción fonética ni sincronización de audio.
La alineación con Whisper y la envolvente RMS corresponde a la etapa 2; aquí no se generan voces.

### Identidad, tinta y rasgos

Las cuatro fichas son datos: Tomás (`height=1`, pelo en punta y buzo claro, voz `tomas`),
Nico (`.93`, gorra azul hacia atrás y camiseta amarilla), Valeria (`.98`, coleta coral y vestido lila)
y Rosa (`1.08`, rulos, anteojos, blusa mostaza y delantal salvia).

`ink.width=.012` representa el 1.2 % de la escala efectiva; se usa para contorno exterior y
extremidades con extremos/uniones redondos. Los detalles interiores usan fracciones de ese ancho.
La cabeza tiene diámetro cercano al 33 % de la altura nominal; el pelo puede sobrepasarla.
La sombra es una masa plana, sin desenfoque ni texturas. Las alturas del grupo comparten suelo y escala.

`hair.style`: `spiky`, `ponytail`, `curly`, `buzz`. Colores `color/shadow/highlight`, y `tie` en coleta.
`accessories.cap`: `forward|backward`, `capColor`; `glasses` y `glassesColor` para anteojos.
`outfit.style`: `tshirt`, `hoodie`, `dress`, `skirt`, `pants`, `apron`; colores `color/shadow`,
`trim`, `skirtColor`, `pantsColor`, `apronColor` según el rasgo. `shoes.style`: `oval|sneaker`;
color y suela configurables. Los pantalones siguen las cadenas de pierna con el mismo IK.

El pelo y la coleta usan `springSine(t,…)` con retraso de fase. `secondary` permite un impulso:
`{at:1,amplitude:.3,frequency:2.6,damping:.48}`. No actúa antes de `at`. `spring()` soporta
amortiguación subcrítica, crítica y sobreamortiguada y velocidad inicial. No existe estado por frame.

Para agregar una ficha:

1. Copiar `characters/tomas.json` a un id nuevo, cambiar identidad, `voice`, semilla y apariencia.
2. Respetar `schema/character.schema.json` (sin propiedades desconocidas). No incluir código.
3. Ejecutar `node tools/validate.mjs` y `node tools/catalog.mjs`; generar y mirar su hoja.
4. Agregar el id a la lista del estudio si se desea seleccionarlo en su interfaz.

Para agregar un rasgo: ampliar el enum del schema y el banco correspondiente
(`rig/hair.js`, `rig/hands.js`, `rig/draw.js`, `face/face.js` o `face/mouth.js`), conservar coordenadas,
contorno, topología mezclable y pureza temporal; agregar su entrada en `tools/catalog.mjs` y regenerar
`catalog.json`. La cámara, acciones, objetos y episodios seguirán separados del rig.


Manos: escala de dibujo ×1,6 sobre el mismo grip. Pies: largo ×1,4 y altura ligeramente mayor, conservando la suela. Coleta: raíz en la nuca, moño en la unión, caída detrás del hombro y el mismo retraso analítico. Hojas de los cuatro personajes y grupo regeneradas en `review/sheets/`.


## Estado inicial y voces fuera de campo

`cast` conserva las referencias string y añade `{character:"tomas",voice:"tomas"}` o
`{voice:"narrador",offscreen:true}`. Una voz offscreen participa en `say`, audio y subtítulos
(cursiva), pero no en `actors`, geometría, cámara ni `talk/listen` automáticos. `look/listen`
hacia esa voz es error: no se necesita un objeto proxy. El alias histórico `"narrador":"narrador"`
se admite si no existe esa ficha corporal; en episodios nuevos declarar `offscreen` explícito.

`actors` acepta el mapa histórico por id y una lista `[{id,...}]`. Cada actor admite:

```json
{"at":"seat-tomas","start":{
  "seated":"seat-tomas","view":"3q-right","expression":"think",
  "holding":{"right":{"object":"cuaderno","carry":"chest","hug":true}},
  "wearing":"mochila"
}}
```

`seated` puede sustituir `at`; exige ancla `seat` y mueble. `holding.left/right` admite un id
string o `{object,carry,hug}`. `wearing` es el id de una mochila. Los objetos deben declararse en
`objects`; el dueño se puede omitir si lo asigna `start`. Si se declara, debe coincidir. No se
sintetizan acciones ni se mueve el reloj: la pose y el agarre existen en el primer cuadro.
`view/expression` de start prevalecen sobre los campos históricos `view/face`. El abrazo inicial
se mezcla con holds posteriores y libera el brazo de apoyo antes de entregar/dejar el objeto.

## Transiciones entre escenas

En la escena **entrante**: `transition:"cut"|"fade"|"wipe"|"dip-white"`, `dur` en segundos
(default .6, o duración de la escena si menor; >0, ≤5 y dentro de la escena).
`cut` es el default compatible. `fade` mezcla el último cuadro completo anterior con el entrante; `wipe`
revela de izquierda a derecha; `dip-white` pasa por blanco opaco. La UI forma parte de cada cuadro, antes de mezclar o recortar. No se agrega ni se descuenta tiempo, no se funden voces y no hay estado de frame.
Node y navegador crean dos superficies a resolución completa por `resources.createCanvas`; su ausencia en una transición es un error explícito, nunca un corte silencioso. El centro del fade se verifica píxel a píxel contra la media de ambos cuadros (error < 2/255).

## Encuadre a dos y revisión de objetos

La reserva editorial siguiente se compila igual para ambas vistas. En el default fit, la óptica final
protege a todos los participantes; los umbrales 55%/28% y las excepciones de recorte siguientes
describen tight. Ver «Vista y encuadre» para los criterios vigentes de fit.

`two` busca una ocupación de **76 % del cuadro completo**. Reserva siluetas y objetos durante
el plano con muestreo cada .08 s y margen proporcional a charHeight. El ancho puede exigir abrir.
Si una cobertura automática o un override two sin locked dejaría a algún sujeto por debajo del
55 %, el director usa medium del hablante (o primer actor de primer plano), anotando
`requestedType: "two"`. Vuelve a limitar las tomas consecutivas a 5,5 s tras esta sustitución.
Los planos `locked:true` permanecen intactos y las métricas señalan una composición imposible.
En wide se incluyen objetos parcialmente visibles; los completamente fuera del plano no obligan
a abrir. El zoom de wide se limita cuando recortaría su contenido protegido. Un dolly reserva ese
contenido para todo su rango de zoom, conserva el movimiento continuo y el hold fixed siguiente
con los mismos objetivos/zoom/offset mantiene el rectángulo final (`holdAt`).

`review.mjs` agrega `composition` y tres criterios en `failed`, muestreados a 30 fps:

- `sujeto_suficiente`: alto visible de cada objetivo / 1920 ≥ .55 en two/medium y ≥ .28 en wide;
  en close, diámetro vertical visible de la cara (sin pelo) / 1920 ≥ .25. Insert no tiene mínimo corporal.
- `sin_suelo_vacio`: banda inferior sin ninguna intersección de sujeto, objeto visible o mueble
  ≤ .22 del cuadro. Solo se exceptúa wide que empieza exactamente al inicio de una escena.
- `objeto_no_tapa_cuerpo`: cada prop front puede cubrir como máximo .35 del área visible de torso
  o cara, comprobados separadamente. Se usa unión de regiones pintadas (mesas con superficie y
  patas, no el hueco entre ellas). Es una aproximación geométrica conservadora, no segmentación raster.

`behind: "mostrador"` se declara en el actor o en `set.anchors.<ancla>.behind`; el actor prevalece.
Exige un id existente de prop front y exceptúa solo ese prop del control de oclusión. Estar sentado
exceptúa solo el asiento propio, nunca todos los muebles. Whip se contabiliza por separado mientras
cruza entre objetivos; no se permite que esos cuadros oculten fallos de los planos estables.
Los mínimos/máximos, totales de fallos y hasta 20 ejemplos con tiempo, actor, prop y región se
conservan en métricas. Las tres condiciones determinan `passed` y el código de salida.

`counter` es un mostrador opaco con tapa frontal `params.color`, borde superior `topColor`, ancho
`w`, altura `h` y `surfaceY` absoluto. Se coloca el tope a la cintura. En heladería: x=600,
y=760, w=300, surfaceY=600, h=160, color coral `#f0bd8d`, heladero en ancla con behind.
Demo: `review/props.jpg`; esquema de set y catálogo incluyen el prop.

`objects[].hidden:true` y el slot `pocket` no se dibujan ni generan recortes. Los objetos
completamente fuera de lámina se excluyen. La revisión distingue objetos de escenario
completamente fuera del plano (`offscreen_set_objects`) de objetos parcialmente cortados:
**estos últimos siguen fallando**. Objetos de actores fuera del plano se contabilizan según
los objetivos de cámara. No se desactivaron los controles de grip, encuadre, subtítulos ni poses.

## Cuando falta una acción: cómo incorporarla sin romper lo existente

1. Reproducir el pedido con un episodio mínimo y consultar `catalog.json`, el schema y el registro
   `ACTIONS`. Definir nombre, parámetros, defaults, duración mínima, capas y dueño antes/después.
   Preservar nombres/parámetros usados por episodios existentes; agregar aliases si hace falta.
2. Añadir `plan` puro y `sample` en `engine/act`. Para interacción, resolver manos/grips en
   `core/sample.js`; para un slot, ampliar validación e historial ordenado en `core/compile.js`.
   Reconstruir desde datos para cada `t`; no añadir estado acumulado ni código por episodio.
3. Separar pose transitoria de estado persistente. Respetar `start`, asiento, manos ocupadas,
   locomoción y prioridad de voz. Mezclar entradas/salidas y asegurar contacto en `transferAt`.
4. Extender `tools/build-schema.mjs`, no solo el JSON generado. Añadir enums al diagnóstico
   `core/capabilities.js` cuando corresponda: una capacidad inexistente debe informar ruta y
   alternativas. Regenerar con `node tools/build-schema.mjs`.
5. Probar comportamiento: dueño único, manos antes/después del contacto, límites ±1 µs,
   retorno a pose, seek aleatorio, raster determinista, rangos y errores. En esta ampliación
   se añadieron casos para las 12 capacidades y controles negativos de la revisión.
6. Mantener ejemplos: `assets/episodes/capacidades.json` demuestra las nuevas acciones sin
   inventar audio. Registrar parámetros, demo y `used_by` en `tools/catalog-stage2.mjs` y
   ejecutar `node tools/catalog.mjs`. Describir cambios en este contrato y en la guía breve.
7. Ejecutar `node --test test/*.test.mjs`, `validate`, `review --every 2` y la paridad de navegador.
   Mirar la hoja y detalles de los contactos: un test geométrico no sustituye la revisión visual.
   Solo después migrar el episodio real, conservar audio/anclas y comprobar sus tiempos exactos.

La guía de producción económica es [SKILL.md](SKILL.md), con contrato breve en
[docs/EPISODIO.md](docs/EPISODIO.md). No hace falta leer ni modificar el motor para producir datos.


## Pulido de asiento, superficies y cuchara

`pose.sitting` mezcla continuamente la pose de pie con la proyección sentada. `seatLevel` es la
altura local del asiento. `rig.anchors.pelvisBottom` marca el borde inferior pintado, incluido el
contorno de ropa; permanece en `seatY` aunque se incline el torso o se gire. `anchors.hip` sigue
siendo el centro de la cadera, por encima del asiento. Los huesos de pie conservan su IK; al sentarse
se proyecta el muslo hacia cámara según yaw y se conserva la canilla vertical. Los pies se recolocan
durante sit/stand y adquieren un contacto nuevo al terminar. Las veinte vistas están en
`review/sitting.jpg`, regenerable con `node tools/pulido-review.mjs`.

Mesas/pupitres utilizados desde un asiento deben cumplir `(seatY - surfaceY) / charHeight` entre
0.16 y 0.20. El inspector y validate emiten `seat-surface-height` con actor, mueble y ruta de datos
si no se cumple, tanto para start.seated como para sit; muebles sin usuarios sentados no avisan.
Comedor y aula: asiento 816, superficie 715, diferencia 101 px (0.18036 × 560).

La cuchara tiene cazoleta ovalada inclinada, relleno metálico y mango fino ensanchado hacia el extremo.
`SPOON_BOWL` es el centro de su cazoleta en coordenadas del grip. `eat` rota ese punto y lo lleva a
`rig.anchors.mouth`, el mismo centro que dibuja la cara, conservando el agarre. Entre bocados, una
cuchara de un personaje sentado descansa sobre la mesa y deja la boca libre. El mobiliario delantero
se dibuja antes de los objetos de mano/platos para que la superficie no los corte.

## Vista y encuadre (vida-vista)

`compile(episode,timing,catalog)` conserva un único plan editorial puro e independiente de la vista.
`renderFrame(ctx,c,t,{view,framing})` y `cameraAt(c,t,state,{view,framing})` aceptan `view` como
`"landscape"`, `"portrait"` o `{orientation,w,h}` canónico. Landscape = 1920×1080; portrait =
1080×1920. El raster puede ser menor para hojas de contacto; la vista lógica no cambia.
`renderFrame` infiere la orientación del canvas si se omite; `cameraAt` usa portrait por defecto.

`framing:"fit"` es el default. En wide/two/medium protege a **todos** los actores presentes y sus
objetos visibles, aunque el plano tenga un solo target. En close protege cara y pelo; en insert,
el objeto y la cara del comensal si corresponde. La zona segura es x=3–97%, y=3–84% si la escena
tiene subtítulos (3–97% sin ellos). Subtítulos: centro (50%,91,5%), dentro de la banda 86–97%.
Landscape comienza cubriendo todo el ancho de la lámina; portrait se aleja cuanto haga falta.
Zoom, offsets, dolly y whip quedan limitados por esa protección. `locked:true` conserva la decisión
editorial, pero sólo `fit:false` en el override conserva explícitamente el recorte.
`framing:"tight"` conserva el recorte editorial y la banda de subtítulos anterior; usa los perfiles de movimiento actuales.

Los límites salen de ejecutar las mismas rutas de dibujo del rig y de los objetos en un registrador
geométrico: transformaciones, elipses, pelo, manos rotadas, zapatos, contornos y agarraderas de mochila.
Las curvas usan su hull de control, una cota conservadora que puede añadir espacio y nunca omitir tinta;
no se usa el rectángulo aproximado del esqueleto para aprobar `actores_completos`.

El relleno se calcula una vez por lámina (`preparePlate`): blur 24px con overscan de 80px, atenuación
13%, copia estirada a todo el viewport y lámina delantera con 40px de desvanecimiento en sus bordes.
`sin_zona_vacia` mide opacidad mínima 255, alfa del borde delantero ≤7/255, >64 colores y varianza
de luminancia >1 en el relleno. Así se comprueba textura continua y ausencia de franjas pintadas con
un color fijo. La antigua métrica de suelo vacío exceptúa la banda ilustrada de fit.

`sujeto_suficiente`: fit exige altura mínima del cuerpo 18% en portrait y 28% en landscape; cara
close ≥25%. El umbral portrait permite composición completa de varias personas y objetos. Los mínimos
observados y los planos correspondientes quedan en `review/vista/*-metrics.json` y el informe de la
sesión. En tight siguen vigentes 55% two/medium, 28% wide y cara 25%. Las oclusiones intencionales
por mobiliario siguen la regla explícita de `behind`/asiento propio.

El player usa `innerWidth/innerHeight ≥ 1` para landscape. `?view=auto|landscape|portrait` tiene
prioridad sobre `episode.view`; `?framing=fit|tight` sobre `episode.framing`. Resize conserva el mismo
audio, el tiempo congelado o de audio y play/pausa. `?t=` y `?controls=1` siguen disponibles.

```sh
node tools/render.mjs ../vida-en-escena/assets/episode.json --view landscape --framing fit
# → ../vida-en-escena/render/un-dia-cualquiera-16x9.mp4
node tools/render.mjs ../vida-en-escena/assets/episode.json /tmp/muestra.mp4 --from 25 --to 35 --view portrait
node tools/review.mjs ../vida-en-escena/assets/episode.json ../vida-en-escena/review/vista --view both --cuts 1 --name vida
node tools/validate.mjs ../vida-en-escena/assets/episode.json --view both
node tools/browser-check.mjs ../vida-en-escena/review/vista --view both
```

Render default: portrait/fit, 1080×1920. Review y validate default: both/fit. Review mide geometría
a 30 fps y añade `actores_completos`/`sin_zona_vacia` a `failed`; `--cuts 1` dibuja cada corte en la hoja.
El retorno de insert intenta la óptica anterior; fit puede expandirla para proteger actores que se
movieron (`camera.insert_returns[].fit_adjusted` informa la excepción y conserva el error medido).
Browser-check usa Chromium instalado, 12 instantes por episodio/vista, compara píxeles a resolución
nativa (<0,2/255), comprueba resize congelado/reproduciendo/pausado, bridge, ▶ y mensaje de error.
