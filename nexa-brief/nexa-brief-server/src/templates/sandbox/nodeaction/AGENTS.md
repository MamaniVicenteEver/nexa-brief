# AGENTS.md · NodeAction (casa de pruebas) — escenas de acción con personajes

> Para cualquier agente de IA o persona que vaya a **crear una escena nueva** (una batalla, un
> enfrentamiento, un disturbio, una persecución…) o a **extender el motor** (un estilo de personaje,
> una pose, un arma, un modo del director). Leelo entero antes de tocar nada.
> Estudio y decisiones: `nexa-brief-server/docs/investigaciones/nodeaction-escenas-de-accion-2026-10.md`.
> Escrito el 2026-10-16, verificado contra `_engine/*.js` y `tools/*.py`.

---

## 1. Qué es

Un motor propio de **personajes articulados en un mundo 2.5D** (estilo "sticker": figuras negras o de
color con borde blanco, como la referencia *Paint Wick*). Una escena es **solo datos**:

- quiénes están (`cast`) y de qué bando (`teams`);
- qué hacen y cuándo (`timeline`: correr, saltar, arrodillarse, apuntar, disparar, posar…);
- o un **plan** de alto nivel que el director convierte en coreografía (`plan`: "dos bandos, que gane el
  protagonista, que cada rival caiga cuando la voz diga su nombre");
- la cámara (`camera`) y el fondo (`background`);
- opcionalmente una **narración** (`lyrics.json` de Whisper): cualquier tiempo puede ser `"@palabra"`.

El motor calcula todo lo demás: ciclos de piernas, cinemática inversa, vuelo de cada bola, impacto,
caída, pintura, charcos, sombras, sonido. **Todo es función pura del tiempo**: `seek(t)` da el mismo
cuadro en cualquier orden → se graba cuadro a cuadro con el grabador del proyecto, sin lags.

Por qué es un nodo aparte (y no un diseño del explainer-kit): el explainer arma planos sobre una
narración; acá el contenido es **simulación de personajes** (posiciones, física, causa → efecto entre
actores). Se reutilizan sus principios y herramientas (contrato `__promo`, voz, transcripción, render),
no su modelo de planos. Ver §10 para integrarlo después como componente.

## 2. Estructura

```text
sandbox/nodeaction/
├── AGENTS.md / CLAUDE.md      ← este archivo
├── _engine/                   ← EL MOTOR (compartido por todas las escenas)
│   ├── core.js                ← tiempo, anclas, compilación, disparos, mundo, reloj (__promo)
│   ├── camera.js              ← CÁMARA (módulo): modos de encuadre, estabilizador, efectos, proyección
│   ├── rig.js                 ← esqueleto, poses, andares, IK, estilos, dibujo sticker 2D, sombras
│   ├── rig3d.js               ← personajes CON VOLUMEN (esqueleto 3D dibujado en 2D): "render": "3d" 
│   ├── fx.js                  ← proyectiles, destellos, gotas, manchas, charcos
│   ├── planner.js             ← director (plan.mode)
│   └── action.css             ← marca, rótulo de plano, subtítulos
├── _escena-base/              ← plantilla mínima (la copia tools/new.py)
├── tools/
│   ├── new.py                 ← crea una escena nueva desde _escena-base
│   ├── review.py              ← hoja de cuadros 16:9 / 9:16 + resumen (quién cayó, cuándo, avisos)
│   ├── camcheck.py            ← mide la suavidad de la cámara (tirones = picos de aceleración/jerk)
│   ├── frame.py               ← un cuadro a tamaño completo (y --crop) para mirar detalles
│   ├── sfx.py                 ← sonido sintetizado desde la escena (+ mezcla con voz/música → song.mp3)
│   └── delegate_text.py       ← delegar TEXTO a DeepSeek (guion, títulos). Nunca animación.
├── prompts/                   ← prompts de delegación (narracion-batalla.md = ejemplo)
└── <escena>/                  ← una carpeta por escena (paintwick-demo = referencia)
    ├── index.html             ← NO se edita: solo carga el motor
    ├── assets/
    │   ├── config.json        ← {activeId, configs:[{ sceneUrl, audio, lyricsUrl, background, overlay }]}
    │   ├── scene.json         ← LA ESCENA (§3)
    │   ├── script.json        ← guion de la voz (formato explainer-kit: segments[id, tone, intensity, text])
    │   ├── lyrics.json        ← tiempos por palabra (Whisper) — lo escribe transcribe.py
    │   ├── sfx.wav            ← efectos solos — lo escribe sfx.py
    │   └── song.mp3           ← mezcla final voz + efectos (+ música) — lo escribe sfx.py
    ├── work/                  ← narración cruda, hojas de revisión (no va a git)
    └── render/                ← mp4 (no van a git)
```

## 3. `scene.json` — formato completo

```jsonc
{
  "version": 1,
  "seed": 7,                                   // semilla global (variaciones deterministas)
  "duration": 30,                              // opcional: si no, dura lo que la voz o la última acción + 2 s
  "arena": { "x": [-2.2, 3.6], "z": [4.4, 10.5] },   // por dónde se mueve el director (u)
  "background": { "type": "color", "color": "#ffffff" },   // | image {src, dim} | video {src, loop, dim}
  "teams": {
    "tinta": { "name": "Tinta", "body": "#171717", "paint": "#ff2d8f", "accent": "#ff2d8f", "style": "ink" },
    "color": { "name": "Color" }
  },
  "cast": [
    { "id": "wick", "team": "tinta", "style": "hero", "hero": true, "pos": [-0.4, 4.7], "face": 1 },
    { "id": "verde", "team": "color", "color": "#86e000", "pos": [2.2, 5.9], "face": -1 }
  ],
  "plan": { "mode": "skirmish", "hero": "wick", "seed": 11 },    // opcional (§4)
  "timeline": [ /* acciones manuales (§3.2); se suman a las del plan */ ],
  "camera": { "horizon": { "landscape": 0.40, "portrait": 0.55 }, "portraitZoom": 1.45, "keys": [ /* §3.3 */ ] },
  "overlay": { "brand": "Node", "accent": "Action", "color": "#ff2d8f" },   // opcional (también en config)
  "captions": { "enabled": true, "maxWords": 5 },                           // opcional; se activan solos con voz
  "render": "3d"                                                            // opcional: personajes con volumen (rig3d.js)
}
```

### 3.1 Mundo y personajes
- **Unidades**: 1 u = altura de un personaje (~1,7 m). `x` izquierda/derecha, `z` profundidad (lejos =
  mayor), `y` altura (suelo = 0). La cámara mira hacia +z.
- **`cast[]`**: `id` (único), `team`, `pos: [x, z]`, `face` (1 derecha, -1 izquierda), `style`
  (`hero` | `trooper` | `ink` | `plain` | `soldier`, o el del equipo), `color` (cuerpo y pintura a la vez) o
  `body` / `paint` / `accent` / `helmet` por separado, `flag` (bandera en el torso, §3.5), `weapon`
  (`"paint"` por defecto, `"rifle"`, `"mg"`, `"rock"`, o `null` sin arma), `wave` / `officer` (director `advance`),
  `hidden` (empieza oculto), `fall` (`back` · `forward` · `knees` · `mixed`: cómo cae),
  `away: true` (quieto mira hacia el fondo: se dibuja DE ESPALDAS), `view: "side"` (siempre de perfil),
  `hp` (impactos para caer, 1 por defecto), `scale` (1 = normal), `hero: true` (la cámara tiembla con
  sus disparos y el director lo usa), `look: {…}` para pisar cualquier campo del estilo (§9.1).
- Profundidad útil: protagonista a ~3–3,5 u de la cámara; rivales entre 4,5 y 9 u más atrás.

### 3.2 Acciones (`timeline[]`)
Cada acción: `{ "t": <tiempo>, "actor": "<id>", "do": "<acción>", …parámetros }`.

**Tiempos** (`t`, también en cámara y en el plan):
| forma | significado |
|---|---|
| `3.2` | segundo 3,2 |
| `"+0.4"` | 0,4 s después de que terminó la acción anterior **del mismo personaje** |
| `"@palabra"` | cuando la voz dice "palabra" (siguiente aparición desde la última ancla) |
| `"@dos palabras"` · `"@palabra#2"` · `"@palabra:end"` · `"@palabra+0.3"` / `"-0.5"` | frase · 2.ª aparición · al terminar la palabra · desplazado |
| `"end-2.5"` (solo cámara) | 2,5 s antes del final |

Las anclas comparan sin tildes ni signos, y los números como los escribe Whisper (en cifras).

**Acciones**:
| `do` | parámetros | qué hace |
|---|---|---|
| `walk` · `run` · `sprint` · `strafe` · `march` | `to: [x,z]` o `by: [dx,dz]`, `dur?`, `speed?` | se desplaza con su andar (strafe = de costado/hacia atrás mirando al blanco; march = marcha cargada con el fusil cruzado) |
| `jump` | `to`/`by`, `height` (0,7), `dur` (0,9), `style`: `tuck` (rodillas al pecho) · `hop` · `flip` (mortal) | salto con impulso, vuelo y aterrizaje |
| `kneel` | `dur` (1,5) | rodilla en tierra (para disparar) |
| `aim` | `target` (id) o `at: [x,y,z]`, `dur` (1) | apunta (los brazos siguen al blanco en pantalla) |
| `shoot` · `throw` | `target`/`at`, `hit` (true), `lethal` (true), `weapon`, `impactAt?` | dispara: apunta solo 0,3 s antes; la bola vuela; si acierta y es letal, el blanco cae. `impactAt` = el instante del IMPACTO (el motor adelanta el disparo lo que dura el vuelo) |
| `pose` | `name`: `victory` · `cheer` · `surrender` · `point` · `ready` · `prone` (cuerpo a tierra) · `crouch` (agachado) · `whistle`, `dur` (2) | pose con nombre (mezclada con suavidad) |
| `whistle` | `dur` (0,9) | toca el silbato (pose + sonido) |
| `hide` · `show` | — | desaparece / aparece (p. ej. defensores en sus refugios) |
| `face` | `dir: 1/-1` o `target` | gira |
| `die` | `from?` | cae sin disparo (derrumbe, tropiezo) |

Reglas que aplica el motor solo: el que ya cayó no hace nada más (sus acciones se descartan y, si eran
manuales, avisa); disparar a alguien caído es un fallo; un movimiento nuevo interrumpe al anterior; la
mirada sigue al blanco mientras apunta y, si no, a donde camina.

### 3.3 Cámara: dron con estabilizador (`camera.keys[]`) — módulo `_engine/camera.js`
Para cambiar cómo se mueve la cámara se toca SOLO `camera.js`:
- **modo de encuadre nuevo**: `A.camera.targets.<nombre> = (S, key, t, c) => { … }` (c = [x, y, z, zoom, pitch]);
  se activa en cualquier key que tenga el campo `<nombre>` (como `follow` o `frame`);
- **efecto nuevo** sobre la cámara ya estabilizada: `A.camera.effects.<nombre> = (S, c, t) => { … }`;
- **respuesta del estabilizador**: `key.smooth` / `camera.smooth` (no hace falta tocar el código).

Cada key es un **objetivo**; la cámara real lo persigue con un filtro suave + resorte amortiguado,
simulado una vez a 120 Hz (sin escalones ni tirones aunque el objetivo cambie de golpe).

`{ "t", "x", "y" (altura), "z", "zoom", "pitch" (grados hacia abajo: 0 = horizontal, 15–40 = dron),
"yaw" (grados de giro: 0 = mira hacia el fondo +z, 180 = de frente a los que avanzan),
"orbit": "<id>" | [x, z], "radius" (u) (el dron gira ALREDEDOR de ese punto: cambiar el yaw entre keys = arco, no cruza la escena),
"portrait": { …campos } (pisa la key solo en 9:16: más alto, más abierto),
"smooth" (s que tarda en llegar; 1,5–2,5 normal, 4–7 vuelo lento de dron), "cut": true (corte seco),
"follow": "<id>", "followX": 0..1, "focus": 0..1, "followZ"?, "dz"?,
"frame": "all" | "alive" | "team:<id>" | [ids], "frameX"?, "frameZ"?, "label": "1 de julio de 1916 · …" }`

- `follow` centra en un personaje; `focus` (0,3–0,45) encuadra entre él y su próximo blanco; `frame` centra un grupo.
- **Toma de frente a los que avanzan** (receta probada en `somme-1916`): `orbit` al protagonista, `yaw` 150 → 180,
  `radius` 8–8,5, `y` 2,6–3,4; para salir, primero SUBIR en el mismo lugar (`y` 9+, `pitch` 44) y después girar en
  altura (`yaw` ~15). Nunca cruzar una línea de decorados (parapeto, alambre) a baja altura: se ven gigantes.
- Al cambiar de centro de órbita el dron vuela con la suavidad normal; girando alrededor del mismo centro, la
  posición sigue el círculo de cerca (rampa automática, sin escalón).
- **Personajes chicos y panorama completo** = cámara alta y lejos (`y` 3–6, `z` 6–10 u antes de la acción,
  `pitch` 15–25). Para una toma que "sube como dron": dos keys seguidas, la segunda más alta y con `smooth` 4–6.
- `camera.horizon` = punto principal (0,5 con inclinación; en 9:16 ~0,38 para llenar la pantalla de suelo).
- `camera.drift` (1) = flotación lenta de dron. `camera.rumble` (1) = ondulación suave SOLO en explosiones grandes (size ≥ 2).
- Siempre verificar con `tools/camcheck.py` (|a| máx < 8, jerk p99 < 40).

### 3.4 Mundo: explosiones, decorados, luz y efectos
- **Eventos del mundo** (en `timeline`, sin `actor`):
  `{ "t", "do": "blast", "at": [x,z], "size" (1; ≥ 2,5 = mina), "kill" (radio, 0) }` ·
  `{ "t", "do": "barrage", "until", "area": {x:[…], z:[…]}, "every": [0,35, 0,8], "size": [0,6, 1,2] }` (bombardeo).
  Cada explosión: fogonazo, tierra que vuela, humo que sube y se disipa, cráter, sonido.
- **Decorados** (`scene.props[]`): `trench` {from, to, w} · `crater` {at, r} · `wire` (alambre de púas) {from, to, h} ·
  `parapet` (sacos; tapa las piernas de los de atrás) {from, to, h}.
- **Luz** (`scene.tint[]`): `{ "t", "color", "a" (0 = sin tinte), "blend" (s) }` — p. ej. la noche cayendo y el amanecer.
- **Amapolas** (`scene.fx.poppies`): `{ "at", "spread", "perBody", "extra", "area" }` florecen junto a cada caído y por el campo.

### 3.5 Banderas y uniformes
`team.flag` (o `cast[].flag`) pinta la bandera en el torso de los `style: "soldier"` (`torso: "$flag"`).
Presets: `uk` · `us` · `de-empire` · `de` · `fr` · `it` · `mx` · `es` · `ru` · `ua` · `pl` · `nl` · `be` · `ie` · `ar` · `pe` ·
`bo` · `co` · `ve` · `br` · `cl` · `cn` · `kr` · `jp` · `gr` · `tr`/`ottoman`, o `{ "stripes": ["#…", …], "dir": "h"|"v", "dot": "#…" }`.
`team.body` = color del uniforme (brazos/piernas), `team.helmet` = casco; `look.head`: `brodie` (británico) · `stahl` (alemán).
La bandera va en el pecho y también en la MOCHILA (se identifica el bando de frente y de espaldas, en 2D y 3D);
`look.packFlag: false` la saca de la mochila. Las banderas se dibujan con las medidas reales de cada cara.
Las armas `rifle`/`mg` disparan trazadoras finas, levantan polvo al fallar y, al acertar, un estallido rojo,
gotas rojas y una marca roja en el cuerpo (`weapons.<id>.mark` / `blood`).

### 3.6 Vista según la cámara: perfil, espaldas o frente
La vista sale del RUMBO del personaje (hacia su blanco si apunta, hacia donde camina, o el último) comparado
con la cámara: se aleja → de espaldas; viene hacia la cámara → de frente (cara, casco con ala, fusil cruzado
sobre el pecho, tiradores de la mochila); cruza → de perfil. Así el mismo soldado se ve de espaldas desde atrás
y de frente cuando el dron lo rodea. De espaldas/frente apuntando: fusil al hombro hacia el blanco en pantalla
(se ve si apunta a la izquierda o a la derecha).

#### Vista de espaldas (profundidad)
Quien camina hacia el fondo (z crece, poco desvío en x) se dibuja **de espaldas**: mochila y bandera en la
espalda, casco visto desde atrás, piernas que suben y bajan (pasos que se alejan), fusil asomando sobre el
hombro. Si apunta o se mueve de costado, vuelve al perfil. Al cambiar de vista el muñeco "gira" (se angosta y
se abre en 0,3 s). Cae hacia el fondo doblando las rodillas y queda tendido visto desde atrás.

### 3.7 Personajes con volumen (`"render": "3d"`)
Con `"render": "3d"` en scene.json (y `<script src="../_engine/rig3d.js">` en el index.html, después de rig.js)
cada personaje es UN cuerpo en el espacio: se ve igual de bien de frente, de costado, de 3/4 o desde arriba,
sin vistas que cambien ni "papel que gira". Usa las mismas poses del rig 2D (andar, saltar, rodilla, caer,
director…) extendidas a 3D. Torso = caja (bandera al frente, mochila atrás, costados más oscuros), cabeza =
esfera (la cara se corre según hacia dónde mira), casco proyectado, fusil 3D que apunta al blanco real, piezas
ordenadas por profundidad. Sin `render`, la escena usa el dibujo 2D (nada cambia para las escenas viejas).
Prueba de referencia: `prueba-3d/` (giradiscos 360°). Comparación: `somme-1916` (2D) vs `somme-1916-3d`.

## 4. El director (`plan`)

`"plan": { "mode": "skirmish", … }` genera acciones del mismo formato que las manuales.

**`skirmish`** — dos (o más) bandos; el héroe elimina a todos los rivales; sus aliados caen; queda uno.

| campo | default | qué controla |
|---|---|---|
| `hero` | — | id del protagonista (obligatorio) |
| `seed` | scene.seed | otra semilla = otra coreografía con los mismos datos |
| `start` | 1,0 | cuándo empieza (número o `"@palabra"`); antes, todos se apuntan |
| `heroMoves` | `["run","jump","kneel","run","stand","jump","kneel"]` | ciclo de movimientos entre bajas |
| `order` | más cercano | ids de los rivales en el orden en que caen |
| `kills` | — | momento de cada baja del héroe (`"@verde"`…): el impacto cae EXACTO ahí |
| `allyKills` | repartidos | momento de la caída de cada aliado |
| `gap` | [0,5, 1,0] | pausa entre bajas (sin `kills`) |
| `range` | 2,4 | distancia de combate que busca el héroe al moverse |
| `foeFire` / `allyFire` | [1,0, 2,2] / [1,1, 2,0] | cada cuánto disparan (y fallan) los demás |
| `foeMove` | 0,35 | probabilidad de que un rival se reacomode después de disparar |
| `flips` | false | permite mortales en los saltos |
| `victoryAt` · `victoryPose` · `victory` | tras la última baja · `victory` · 3 s | la pose final |

**`advance`** — una línea ataca caminando hacia otra que espera oculta (asalto de trincheras, carga).

| campo | qué controla |
|---|---|
| `attackers` / `defenders` | ids de equipo |
| `defendersUp` · `fireAt` · `fireUntil` | cuándo aparecen los defensores, cuándo empiezan y terminan las ráfagas |
| `waves: [{wave, at, stagger}]` | oleadas (`cast[].wave`); esperan agachadas, los `officer` tocan el silbato, salen y marchan |
| `casualties: [{at, over, n, wave?}]` | n caídos repartidos en `over` s desde `at` (impacto exacto) |
| `survivors` · `cover: [{actor, at, to, pose}]` | quiénes sobreviven y a qué cráter corren a tirarse cuerpo a tierra |
| `goalZ` · `burst` (4) · `every` | hasta dónde marchan · ráfaga de la ametralladora · cadencia |
| `speed` ([0,42, 0,68]) · `wander` (0,9) | ritmo de marcha de cada uno · desvío lateral entre tramos (desorden) |
| `fireChance` (0,6) · `kneelChance` (0,3) · `shotsPerStop` ([2, 3]) · `legs` (4) | prob. de detenerse a disparar en cada tramo · rodilla en tierra · disparos por parada · tramos del avance |

Para retocar a mano una coreografía: corré `review.py` (imprime quién cae y cuándo) o copiá los eventos
del plan a `timeline` (en la consola: `__action.S`) y quitá el `plan`.

## 5. Flujo de una escena narrada (todo desde `nexa-brief-server/`)

```bash
N=src/templates/sandbox/nodeaction
K=src/templates/_tools/explainer-kit/tools
# 1 · crear
.venv/bin/python $N/tools/new.py mi-escena
# 2 · guion de voz (texto: se puede delegar) → $N/mi-escena/assets/script.json
#     con las PALABRAS ANCLA que van a disparar cada momento (ver prompts/narracion-batalla.md)
.venv/bin/python $N/tools/delegate_text.py $N/prompts/narracion-batalla.md /tmp/narr.json --json
# 3 · voz (gasta cuota de Gemini: UNA vez, con el guion final)
.venv/bin/python $K/narrate.py $N/mi-escena/assets/script.json $N/mi-escena/work/narration --voice Charon --lead 0.6 --tail 1.0
# 4 · tiempos por palabra (Whisper large-v3 en CPU, ~1 min por cada 40 s; sin timeout corto)
.venv/bin/python $K/transcribe.py $N/mi-escena/work/narration.mp3 $N/mi-escena/assets/script.json $N/mi-escena/assets/lyrics.json
# 5 · scene.json con anclas (plan.kills, timeline "@…", cámara "@…") → revisar
.venv/bin/python $N/tools/review.py $N/mi-escena --every 1.5 --orient both     # mirar work/review-*.png
# 6 · sonido: efectos sintetizados + voz → assets/song.mp3
.venv/bin/python $N/tools/sfx.py $N/mi-escena --voice work/narration.mp3       # [--music pista.mp3 --music-gain 0.25]
# 7 · grabar (cuadro a cuadro; 43 s en 1080p ≈ 1,5–2,5 min por formato)
cd src/templates && ../../.venv/bin/python _tools/commercial/render_promo.py sandbox/nodeaction/mi-escena/index.html sandbox/nodeaction/mi-escena/render/mi-escena-16x9.mp4 --size 1920x1080 --workers 4
```
Sin voz: saltear 2–4 y en el 6 correr `sfx.py` solo (song.mp3 = efectos). Si cambiás la escena,
**volvé a correr `sfx.py`** (los efectos salen de la escena compilada).

Vista en vivo: `python3 -m http.server -d src/templates 8800` → `http://127.0.0.1:8800/sandbox/nodeaction/mi-escena/`
(`?t=12.5` congela un instante, `?loop` repite).

## 6. Reglas duras (no negociables)

1. **Determinismo**: nada de `Math.random`, `Date`, timers ni animaciones CSS en el motor. Todo sale de
   `t` y de `A.rng(semilla)`. Si agregás algo, `seek(t)` tiene que dar el mismo cuadro en cualquier orden.
2. **Una escena es datos**: no se edita `index.html` ni se escribe JS en una carpeta de escena. Si falta
   algo, se agrega al motor (§9) para que sirva a todas.
3. **Animación ≠ delegación**: los textos (guiones, títulos, descripciones) se pueden delegar a DeepSeek o
   Codex; **poses, andares, coreografía y efectos los hace quien dirige el motor** (los modelos baratos no
   los hacen bien).
4. **La voz manda**: si hay narración, los momentos importantes van anclados a palabras (`@…`), no a
   segundos a ojo. Después de regenerar la voz, re-transcribir y re-revisar.
5. **Fondo blanco por defecto**; imagen/video de fondo solo cuando la escena lo pide (§8).
6. **Nada sale a la app ni se publica desde acá**; sin `git commit`/`push` salvo pedido.

## 7. Checklist antes de dar una escena por buena

- [ ] `review.py` sin avisos (`warnings: []`) y sin errores de consola (el 404 de `config.json` es normal).
- [ ] Sobrevivientes = los que la historia dice (en `skirmish`, solo el héroe).
- [ ] Con voz: cada baja cae en su palabra (comparar la lista de `review.py` con `lyrics.json`).
- [ ] Hojas 16:9 y 9:16 **miradas**: protagonista grande, cada disparo y caída en cuadro, nada cortado,
      suelo legible (sin exceso de manchas), subtítulos que no tapan al protagonista.
- [ ] Fluidez: tira de cuadros consecutivos de una carrera y de un salto (ffmpeg `select=not(mod(n\,2))`).
- [ ] `camcheck.py` en verde (sin tirones de cámara).
- [ ] Voz: el control (`narration.qc.json`) sin nombres propios mal pronunciados; si uno falla, regenerar SOLO esa
      frase y empalmarla en los silencios (ver lección del Somme), no toda la voz.
- [ ] `sfx.py` corrido DESPUÉS del último cambio de la escena; el mp4 tiene audio.

## 8. Fondo (imagen o video)

`background: { "type": "image", "src": "assets/media/fondo.jpg", "dim": 0.1 }` o
`{ "type": "video", "src": "assets/media/fondo.mp4", "loop": true }` (el video se busca cuadro a cuadro;
recodificarlo con keyframes cortos como en `_tools/hyperframes/reencode_media.py`).
Para que los personajes "pisen" el fondo hay que alinear la cámara con la foto: `camera.horizon` = altura
del horizonte de la foto (0..1) y `y` = altura de la cámara real en unidades de personaje. Las sombras y
manchas se proyectan sobre ese suelo. Con fondos claros el motor agrega un borde gris finísimo al sticker.

## 9. Extender el motor (para todas las escenas)

### 9.1 Estilo de personaje (`A.styles` en rig.js)
Campos: `head` (`bob` melena · `visor` casco + visera · `plain`), `headR`, `torsoW`, `torso`, `limb`,
`limbW`, `hand`, `hair`, `face`, `helmet`, `visor`, `outline` (grosor del borde, 1,15). Colores literales
o `"$body"` / `"$paint"` / `"$accent"` (del personaje). Para una cabeza nueva (casco romano, gorra,
pañuelo…) agregar un caso en `head()` de rig.js, dibujado en el marco de la cabeza (radio `r`).

### 9.2 Pose con nombre (`A.poses`)
Una función `τ => P({...})`. Una pose NO guarda ángulos: guarda **objetivos** —`fF`/`fB` pies en el marco
del suelo (x adelante desde la cadera, y desde el suelo), `hF`/`hB` manos desde el hombro, `rootY` altura
de cadera (0,445 de pie, 0,265 arrodillado), `lean`, `head`, `gunA`— y la IK resuelve rodillas y codos.
Límite de alcance: pierna 0,47 u, brazo 0,325 u.

### 9.3 Andar (`A.GAITS`)
`speed`, `stride` (u por ciclo), `stance` (fracción con el pie apoyado), `lift`, `rootY`, `bob`, `lean`,
`arm`, `R`, `fwd`, `up`. Condición para que no patine ni se estire: `stance·stride/2` y `rootY` deben
cumplir √((stance·stride/2)² + rootY²) ≤ 0,47.

### 9.4 Arma (`A.weapons` en core.js)
`speed` (u/s), `arc` (parábola), `size`, `flash`, `impact` (`splat`/`thud`), `droplets`, `color` (si no,
la pintura del tirador). `rock` ya existe (piedras para disturbios). Armas cuerpo a cuerpo: pendiente (§10).

### 9.5 Modo del director (`A.planModes`)
`MODES.<nombre> = (scene, P, actors, ctx) => [acciones]`. `ctx.anchor("@palabra")` resuelve anclas.
Devuelve acciones normales: el motor hace el resto. Documentalo en §4.

## 10. Hoja de ruta (lo que falta para "batallas antiguas, disturbios, …")

Ver el estudio. En corto: armas cuerpo a cuerpo (espada, lanza, escudo) con choque y bloqueo; flechas en
arco y lluvia de flechas; formaciones y multitudes (filas que avanzan, empujones, huida); modos
`melee`, `charge`, `riot`, `duel`, `chase`; humo, polvo, fuego y banderas; caballos; diálogo en globo;
fondos con escenario (calibración de suelo); y el componente `action.scene` para usar una escena dentro
de un storyboard del explainer-kit (videos de historia con batallas animadas).

## 11. Lecciones (actualizar al terminar cada sesión)

- 2026-10-17 · `somme-1916` (2:27, 48 personajes, 2 sectores, voz Charon): cámara dron resorte, banderas,
  bombardeo, minas, noche, amapolas. Tirones de la cámara vieja = foco que cambiaba a saltos (8 muestras
  promediadas = escalera) + sacudón por disparo → cámara resorte (jerk p99 1545 → 25). El temblor de 91 obuses
  también "golpeaba": solo las minas mueven la cámara, lento.
- Whisper escribe nombres compuestos juntos ("Beaumont-Hamel") y las horas en cifras: anclar con `@Beaumont-Hamel`,
  nunca con horas; usar palabras únicas del guion.
- El TTS pronunció "Terranuda": se regeneró solo esa frase (escrita "Terra Nova") y se empalmó en los silencios
  igualando volumen. Al buscar la palabra de corte, buscar DESPUÉS del inicio de la frase ("minutos" aparecía antes).
- DeepSeek no respeta "una sola vez" en anclas ni el largo: revisar y reescribir; los datos van siempre de fuentes.
- Poses largas (`hold` 600 s) estiraban la duración: con voz, la duración sale de la última palabra.
- La cámara pasó a `camera.js` (módulo); camcheck dio exactamente las mismas cifras antes y después.
- Órbita: si la posición tiene su propio resorte, queda atrasada respecto del giro y la cámara mira a un
  costado vacío → en órbita x/z siguen el círculo de cerca; con centro nuevo, rampa (si no: 24 u/s de golpe).
- Con la cámara girada, ordenar por z dibuja mal: se ordena por profundidad respecto de la cámara, y lo que
  queda detrás de ella (trazadoras, humo, gotas) no se dibuja (Dr < 0,5).
- Apuntar, caer y estar cuerpo a tierra se dibujan SIEMPRE de perfil (de frente/espaldas se veían raros); al
  apuntar giran de perfil (0,3 s) y eligen blancos hacia un costado (uno justo delante apuntaría al cielo).
  Al morir cambian de vista en el instante del impacto, sin el giro.
- Un fusil dibujado como línea parece un palo: tiene que tener la madera del Lee-Enfield casi hasta la punta,
  boca de acero, cerrojo y bayoneta, y visto de espaldas asomar al costado de la cabeza (no detrás).
- 3D: el descarte de caras ocultas depende del orden de las esquinas y de que el canvas tiene la y hacia abajo
  (torso y mochila tienen órdenes distintos): probar siempre de frente Y de espaldas con el giradiscos.
- Si la primera oleada llega al alambre antes de que empiecen las ametralladoras se queda parada esperando:
  marcha lenta (`speed` 0,3–0,48), como en el avance real.
- Caer de espaldas a cámara "achatando" toda la figura parecía un tocón: se interpola cada articulación hacia
  una pose de tendido (piernas abiertas cerca, torso y cabeza lejos, brazos adelante).

- 2026-10-16 · Primer motor + demo `paintwick-demo` (réplica del estilo Paint Wick, fondo blanco, 43 s,
  voz Charon 94 ppm, 5 bajas sincronizadas a la palabra exacta). Render 1080p: ~0,06 s/cuadro.
- Cámara lejos = personajes chicos (20 % del alto): el protagonista va a ~3–3,5 u de la cámara.
- Seguir solo al héroe deja las bajas fuera de cuadro → `focus` 0,3–0,45.
- El director mandaba al héroe lejos de los rivales y se encimaba con aliados → `spot()` avanza hacia los
  rivales a distancia `range` y evita a cualquiera a menos de 1 u.
- Demasiado fuego cruzado ensucia el suelo (43 manchas): en piezas narradas `foeFire` ≈ [3, 5].
- Cámara muy baja (y ≈ 0,55) aplasta las manchas hasta volverlas rayas: y ≥ 0,8.
- Las anclas del plan se buscan cada una desde el principio de la voz (un cursor común perdía las de aliados).
- `render_promo.py` exige `config.json` con `configs[]` y una pista `audio.src` (por eso sfx.py siempre deja `song.mp3`).
