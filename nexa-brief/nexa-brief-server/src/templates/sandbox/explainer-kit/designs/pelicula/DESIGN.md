# pelicula · ARCHIVO 35

Slideshow histórico cinematográfico: fotos de archivo viradas a sepia, tiras de película de 35 mm
(perforaciones) en doble exposición que cruzan el cuadro en distintas capas y velocidades, años
GIGANTES en naranja-rojo con titular en mayúsculas encima o debajo, destellos de luz naranja/blanca
(light leaks) en las transiciones, barridos con motion blur, glitch de cortes y polvo/rayas de película.

Referencia: `sandbox/otros/From Klickpin.com- From beginner to obsessed … realistic.mp4`
(62,1 s · 960×540 · 29,97 fps · plantilla AE de terceros: solo se replicó el estilo, nada se copió).

---

## 1. Análisis de la referencia

### 1.1 Cortes (ffmpeg scene > 0.2) y planos

| seg. ref | plano | tipo de escena | entrada | salida |
|---|---|---|---|---|
| 0.0–3.1 | humo + barco | **título de apertura**: foto desenfocada → foco, 2 filas de perforaciones arriba y 1 abajo, arcos finos | foco (0–0.5 s), tiras entran deslizándose, bloque de texto CAE desde arriba con blur vertical (0.30→0.55 s) y glitch de franjas (0.65–0.95 s) | destello prisma (3.1–3.6) + barrido horizontal |
| 3.6–6.8 | barco / soldados | **montaje en tiras**: tira grande arriba con 2 cuadros, tira chica abajo, cada una se desplaza en sentido opuesto | barrido + prisma | barra de luz vertical que cruza (4.3–4.9); corte duro (6.8) |
| 6.8–7.4 | barco (otro encuadre) | tira arriba + foto abajo | corte | barrido horizontal con blur (7.4) |
| 7.8–12.9 | humo → multitud | **año que sube** (1932): cámara panea hacia abajo (todo sube ~0.6 H en 5 s), el bloque entra desde abajo | barrido | punch-in al texto con tinte rojo (12.2) |
| 13.0–15.1 | tira vertical + avión | **rollo vertical** (perforaciones verticales) con foto, año chico a la derecha (1935) | quemado naranja→blanco (13.1–13.6) | prisma blanco (15.2–15.5) |
| 15.5–17.0 | tanque | **punch-in**: el MISMO bloque 2,4× más grande, cortado a la izquierda, deriva lenta | prisma | quemado blanco + corte (17.1) |
| 17.1–18.5 | tira vertical + generales | rollo vertical a la izquierda, foto a la derecha | corte | barrido horizontal (18.6) |
| 18.6–24.0 | generales | **foto a sangre** con fila de perforaciones cortada arriba, Ken Burns lento | barrido horizontal con blur fuerte 0.7 s | tinte rojo (23.7) + barrido (24.0) |
| 24.0–30.0 | avión | año 1936 sobre foto + tira arriba; glitch del texto (25.0–25.5); **punch-out** a 27.1 (texto chico arriba-izquierda, foto más abierta) | quemado naranja→blanco (24.3–24.8) | prisma/flash (27.1), zoom-burst (30.0) |
| 30.0–32.4 | soldados en la playa | foto + fila de perforaciones arriba + arcos | zoom radial + prisma verde | quemado naranja→blanco (31.8–32.3) |
| 32.4–37.5 | soldados caminando | año 1940 (titular ARRIBA del año, rojo) | barrido vertical + **glitch de franjas** de todo el cuadro con el texto (32.7–33.2) | prisma (37.4–37.9) |
| 37.9–43.7 | firma | **montaje en tira** horizontal grande + tira inferior, arcos | prisma | punch a otro encuadre (42.5) con lavado blanco + tinte rojo; barrido (43.8) |
| 43.8–46.4 | multitud | tiras dobles que suben; año 1941 sube desde abajo a arriba-derecha; glitch (45.3, 45.8) | barrido | quemado (45.9–46.4) |
| 46.5–51.0 | multitud | año 1942 (titular arriba) abajo-izquierda sobre tiras grandes en doble exposición; punch-in (49.7) | quemado | barrido + prisma (51.1–51.7) |
| 51.7–53.0 | soldados en el bosque | rollo vertical a la izquierda + año 1943 que cae desde arriba | prisma | barrido (53.0) |
| 53.1–55.6 | Yalta | **rollo vertical** central con la foto, tira lateral, lavado blanco | barrido vertical | glitch (55.0–55.3), quemado (55.7–56.2) |
| 56.3–62.0 | cañón | **cierre** 1945: perforaciones arriba y abajo, deriva hacia la izquierda; fundido a negro (60.6–62) | quemado + prisma | fundido a negro |

Ritmo: un plano cada 2,5–6 s; casi todos los cortes quedan escondidos detrás de un destello o un barrido.

### 1.2 Colores (muestreados con PIL)

| uso | hex |
|---|---|
| año naranja (1930/35/36/41/42/43/45) | `#c9501f` (sobre claro `#cb6c2f`, sobre humo `#a9400a`) |
| año rojo (1940) | `#c4352a` |
| titular / subtítulo | `#f3eadb` (crema) |
| perforaciones (agujeros con luz detrás) | `#efe4c6` |
| sepia: sombras / medios / luces | `#17130c` · `#8f846a` · `#f3e9cf` |
| quemado: naranja → ámbar → amarillo → blanco | `#e8642a` → `#f7a34a` → `#ffe7a8` → `#ffffff` |
| prisma: rojo-óxido → blanco → verde pálido | `#be5a32` → `#fffaf0` → `#a9c98a` |
| tinte rojo de fin de plano | multiplicar `#d8957e` |

### 1.3 Tipografía

* Año: sans geométrica de dígitos redondos y "1" con bandera → **Montserrat 500** (600 para el rojo),
  tracking +0.02 em, alto de cifra ≈ 18 % del alto del cuadro (plano normal) y ≈ 45 % en el punch-in.
  Textura erosionada (motas que dejan ver la foto) y opacidad ≈ 0.92.
* Titular: **Montserrat 800** mayúsculas crema, ≈ 0.33× el cuerpo del año (bajo el año, se monta sobre
  la línea base de las cifras) o ≈ 0.21× (encima del año, layout "over" del 1940/1942). También erosionado.
* Subtítulo: **Montserrat 600** mayúsculas, ≈ 0.105× el año, precedido por una barra roja de
  0.37 × 0.045 em que arranca bajo la 2.ª cifra.
* Rótulo mínimo opcional (kicker) arriba del titular, 0.07× el año.

### 1.4 Movimientos (medidos contando cuadros)

* **Caída del bloque** (0.30–0.55 s): entra desde ~0.5 H arriba con estela vertical, easing expo-out.
* **Subida del bloque** (7.8–8.1 / 44.4–44.8): igual desde abajo, y luego viaja con la cámara.
* **Glitch de franjas** (0.65–0.95, 25.0–25.5, 32.7–33.2, 45.3, 45.8, 50.6, 55.0): 6–10 franjas
  horizontales desplazadas ±5–8 % W, algunas duplicadas; cambia cada cuadro, dura 0.2–0.5 s.
* **Deriva** después de entrar: el bloque sigue deslizándose ~3–4 % W y se frena (≈3 s).
* **Ken Burns**: zoom 1.05→1.13 lineal a lo largo del plano, paneo leve.
* **Cámara que sube** (1932): toda la escena sube ≈0.55 H en 5 s (seno).
* **Punch-in / punch-out** (15.3, 27.1, 49.7, 12.2): corte a otra escala del mismo bloque (×2.2–2.5)
  escondido por un destello; el texto gigante queda cortado por un borde.
* **Barrido (whip)** horizontal o vertical: 0.45–0.7 s, desplazamiento ~0.5 W con estela proporcional a
  la velocidad (motion blur), expo-out.
* **Zoom radial** (30.0–30.5): ráfaga de copias escaladas desde el centro.
* **Quemado** (light leak): rampa a casi blanco en 0.3 s desde naranja por un costado, meseta
  0.1–0.2 s, se retira en 0.3–0.4 s.
* **Prisma**: banda vertical rojo→blanco→verde que cruza el cuadro en ~0.5 s + lavado blanco.
* **Barra de luz**: banda vertical crema suave que cruza en ~0.6 s (4.3–4.9).
* **Tiras**: se desplazan 1.5–3 % W/s; capas en sentidos opuestos (paralaje); filas fantasma
  (doble exposición) más grandes y transparentes.
* **Arcos y líneas finas** (círculos de radio 0.4–0.8 H y rectas largas, 1 px crema 55 %) que giran
  lento (~3°/s).
* Siempre: grano, rayas verticales, polvo, parpadeo de exposición, líneas de barrido horizontales
  suaves (scanlines), manchas de papel con números grandes desvaídos de fondo.
* Final: fundido a negro de 1.4 s.

---

## 2. Identidad

* **Canal provisional:** ARCHIVO 35 (`@archivo35`) · temas: historia, siglo XX, guerras, política, efemérides.
* **Paleta** (`design.json → defaults.palette`): fondo `#6b624d`, fondo2 `#3b3322`, tinta `#f3eadb`,
  apagado `#b8ac8e`, acento naranja `#c9501f`, acento rojo `#c4352a`, perforación `#efe4c6`, sombra `#17130c`.
* **Tipografía:** Montserrat 500/600 (números), 800 (titulares), 600 (subtítulos y subtítulos karaoke).
* **Subtítulos:** la referencia no tiene; quedan activos y discretos: Montserrat 600 mayúsculas crema
  con sombra oscura, palabra actual en 800 (estilo inyectado por `_pelicula.js`).

## 3. Arquitectura

* Todo en **canvas**. Cada plano se compone en su propio lienzo (`P.surface`) y se pega en `ctx.g.main`
  con `P.composite` (entrada/salida). Así el barrido con motion blur, el zoom radial y el glitch
  afectan a foto + tiras + texto juntos, como en After Effects.
* `_pelicula.js` (runtime de familia): fondo, y en `post` grano (overlay), scanlines, rayas
  verticales (una persistente ~0.5 s + sueltas), polvo y pelos, parpadeo de exposición, viñeta y el
  fundido a negro del cierre. Todo función de `floor(t·24)` (cadencia de película) → determinista.
* Texturas generadas una vez con `Kit.rng` sembrado: grano (4 baldosas), motas de erosión, papel con
  manchas y números grandes desvaídos, luces de papel, scanlines. No se copió nada de la referencia.
* Fotos: virado sepia propio por LUT de luminancia (`P.grade`, cacheado por imagen).
* Bloque de texto (`P.card`): se arma UNA vez por beat en un lienzo (año + titular + barra +
  subtítulo + kicker, erosionado con motas) y se dibuja con escala/estela/glitch por cuadro.

### Componentes

| componente | escena de la referencia | parámetros clave |
|---|---|---|
| `pelicula.title` | apertura 0–3.1 s | src, year, title, sub, kicker, pos, size, glitches, focus |
| `pelicula.year` | planos de año 7.8–12.9, 13.6–17, 24.8–30, 32.7–37.5, 44.4–53, 56.3–62 | src, src2, year, title, sub, layout under/over, color, pos, size, textIn, strips, camera, ghost, punch(@palabra), punchPos, punchSize, glitches |
| `pelicula.photo` | foto a sangre 18.6–24, 30.6–32.4 | src, src2 (doble exposición), title/sub chicos, perfs, camera, focus |
| `pelicula.strip` | montaje en tiras 3.6–6.8, 38–43.7 | src, src2, src3, layout split/band, sweep |
| `pelicula.reel` | rollo vertical 13–15, 53–55.6 | src, src2, src3, speed, bloque opcional |
| `pelicula.quote` | punch de titular 15.5–17 (frase narrada sincronizada) | accent, ghost (número detrás), sub, strips |
| `pelicula.leak` (overlay) | quemado / prisma / flash / barra de luz | kind, dir, strength (duración = `dur`) |
| `pelicula.glitch` (overlay) | glitch de franjas de todo el cuadro | strength, flicker |
| `pelicula.outro` | cierre 56.3–62 + fundido a negro | thanks, channel, cta, support, handle (sin @), src |

Parámetros comunes de las escenas: `enter` (cut, whip, whipR, whipUp, whipDown, zoom, focus, glitch,
fade), `exit` (none, whip…, zoom), `leak` (destello automático al entrar), `leakDir`, `flush`.

### Catálogo de movimientos replicados → dónde están

| movimiento (seg. ref) | implementación |
|---|---|
| foco desde desenfoque (0–0.5) | `enter:"focus"` (blur 14 px → 0, 0.6–0.7 s) |
| filas de perforaciones que entran deslizándose (0.1–0.6) | `pelicula.title`, `strips` con `slide` en year/strip |
| bloque que cae con estela (0.30–0.55, 51.9) | `textIn:"drop"` (0.42 s expo-out desde −0.55 H, estela 45 %) |
| bloque que sube (7.8, 44.4) | `textIn:"rise"` + `camera:"rise"` (la escena sube 0.52 H en el plano) |
| glitch de franjas del texto (0.65, 25.0, 45.3, 50.6) | `glitches:[s]`, `textIn:"glitch"` |
| glitch de todo el cuadro (32.7, 55.0) | `pelicula.glitch` |
| deriva lenta del bloque (todas) | `drift` (3.5 % W que se frena en 3.2 s) |
| aparición tras el destello (13.6, 24.8, 46.5, 56.3) | `textIn:"flash"` + `leak:"burn"` |
| punch-in / punch-out del bloque (15.3, 27.1, 49.7) | `punch:"@palabra"`, `punchPos`, `punchSize` + prisma automático |
| barrido horizontal/vertical con motion blur (3.2, 18.6, 24.0, 32.5, 43.8, 53.0) | `enter:"whip*"` (0.6 s, 12 copias promediadas, estela ∝ velocidad) + `exit` |
| zoom radial (30.0) | `enter:"zoom"` |
| quemado naranja→blanco (13.1, 24.3, 31.8, 45.9, 55.7) | `leak:"burn"` / `pelicula.leak kind:burn` |
| prisma rojo-blanco-verde (3.1, 15.2, 37.4, 49.3) | `leak:"prism"` |
| barra de luz (4.3) | `pelicula.strip sweep` / `kind:"bar"` |
| tinte rojo de fin de plano (12.2, 23.7, 54.7) | `flush:true` |
| Ken Burns / paneos | `camera` in/out/left/right/rise/fall/still |
| tiras en sentidos opuestos, filas fantasma | `strips` frame/top/bottom/double/side, `pelicula.strip`, `pelicula.reel` |
| arcos y rectas finas que giran | `P.lines` en todas las escenas |
| grano, rayas, polvo, parpadeo, scanlines | runtime de familia |
| fundido a negro final (60.6–62) | `pelicula.outro` (`P.fade`) |

## 4. Qué quedó igual y qué difiere

**Igual (o muy cercano):** paleta sepia + naranja/rojo, tipografía y jerarquía del bloque (año,
titular superpuesto, barra roja bajo la 2.ª cifra, subtítulo), perforaciones de 35 mm con banda
oscura translúcida y doble exposición, arcos finos, tipos de transición y sus duraciones, punch del
bloque, rollo vertical, montaje en tiras, cierre con fundido a negro.

**Difiere, y por qué:**
* La referencia es AE con desenfoque de movimiento real y destellos filmados; acá el motion blur es
  un promedio de 12 copias y los destellos son degradés procedurales (no se pueden copiar los de la
  plantilla). El quemado es más "limpio" que un leak real.
* El titular de la referencia tiene una textura grunge más gruesa; la erosión procedural es más fina.
* El ritmo de cortes de la referencia (2.5–6 s) es parecido al de la narración (3–7 s): no hizo falta
  partir beats, salvo el plano final ("pero este muro" se partió en rollo + foto).
* Las fotos son 7 (se repiten con otro encuadre/zoom/componente); la referencia tiene ~18.
* 9:16: las filas de perforaciones cruzan el ancho igual, el bloque se centra y crece (size×1.9),
  el montaje en tiras pasa a 3 tiras apiladas y el rollo vertical ocupa el 88 % del ancho.
* Limitación del motor: los strings que empiezan con "@" se toman como ancla de palabra, por eso
  `pelicula.outro.handle` va sin arroba y el componente la agrega.

## 5. Verificación (demo `explainer-videos/pelicula-demo`)

* `kit.py check pelicula-demo`: anclas todas resueltas, 0 huecos. Errores = solo "componente
  desconocido" (el diseño aún no está en `catalog.json`, lo registra el coordinador). Avisos
  justificados: "A las once" dura 9.1 s pero el `punch` en "@barrera" lo parte en dos planos
  (como el punch de la referencia); 0 `common.lyric` porque su papel lo cumple `pelicula.quote`;
  fotos repetidas a pedido del usuario (7 fotos en distinto componente/encuadre).
* Consola: sin warnings del kit; solo el 404 esperado de `config.json` (el motor prueba
  `config.json` y después `assets/config.json`).
* Determinismo: `seek(37.45)` → `seek(120)` → `seek(37.45)` da píxeles idénticos (cuadro con glitch).
* Hojas: `explainer-videos/pelicula-demo/work/sheet-16x9.png` y `sheet-9x16.png`.

---

## 6. Intros y cierre

Archivos: `components/intros.js` (introv1, introv2 y los fondos propios, expuestos en
`Kit.pelicula.hook`) y `components/outro.js`. Usan el contrato común `designs/common/hook.js`
(parámetros `bg`, `src`, `focus`, `use`, `useParams`, `dim` y los tiempos del cierre).
Las dos intros: capa `main`, `post: 0.6`, ocultan los subtítulos y se componen en un lienzo
propio (así el cuadro entero se sacude, vibra con el vaivén de la ventanilla a 24 cuadros/s y se traba).

### `pelicula.introv1`: gancho "golpe"

Cuenta regresiva del líder de película (3-2-1 con la aguja que barre y un destello) →
titular GIGANTE (≈80 % del ancho, limitado por alto) que entra palabra por palabra con
**barrido y estela** (motion blur) desde costados alternos, aterriza con sacudida y
**glitch de franjas**. `^palabra^` va en naranja con la **barra roja** debajo. Momento de impacto
(`burnAt`): la película **se sale de la ventanilla** (salto de cuadro con la línea de cuadro y
las perforaciones a la vista) y **se quema** (agujeros con borde incandescente) → quemado
naranja→blanco → queda un rubor rojizo. Sale con barrido y estela.

| param | default | qué hace |
|---|---|---|
| `text` (requerido) | | `\n` = renglón; `^x^` = destacada; un signo pegado (`^MURO^?`) no se separa |
| `kicker`, `sub` | "" | rótulo arriba / línea abajo, ambos con barra roja |
| `countdown` | 0.9 | segundos de la cuenta 3-2-1 (0 = sin cuenta) |
| `wordAt`, `stagger` | 1.0, 0.28 | primer golpe y separación entre palabras |
| `burnAt` | 2.9 | impacto (acepta `@palabra`; −1 = sin quemado) |
| `bg`… | auto = `strips` | ver fondos |

### `pelicula.introv2`: gancho "pregunta + revelación"

Intertítulo de cine mudo: se **abre el iris**, la pregunta se **expone letra por letra**
(a 24 cuadros/s; cada letra nueva destella en ámbar) entre **filetes dobles con rombo rojo**, y la
respuesta (`stamp`) llega en una **tira de película** que cruza con barrido y estela, golpea
(sacudida, glitch, destello) y queda atravesada derivando. Sale **cerrando el iris**.
Params: `text`, `kicker`, `stamp`, `stampAt` (acepta `@palabra`), `typeAt` (0.45), `cps` (18),
`bg`… (auto = `projector`).

### Fondos propios (presets, neutros para cualquier tema)

| preset | qué es |
|---|---|
| `strips` | tres tiras horizontales en capas (una fantasma grande) inclinadas, con cuadros "expuestos" genéricos (ciudad, retrato, multitud, horizonte, documento, engranajes, ruta, líder) que entran deslizándose y siguen en sentidos opuestos; si hay `src`, la foto virada se suma a los cuadros |
| `projector` | sala oscura: haz del proyector con polvo flotando, destello de lente, el proyector en silueta con dos rollos girando, perforaciones al pie |
| `reel` | rollos verticales en paralaje (columna fantasma central), cuadros que pasan |
| `leader` | líder de película en bucle (8→3, aguja que barre), atenuado |
| `image` | foto en `src` virada a sepia (`P.grade`), zoom lento, `dim`, con filas de perforaciones encima |
| `component` | otro componente (`use`/`useParams`; si usa foto y no se le pasa, recibe `src`), `dim`, perforaciones encima |
| `none` | liso |

Legibilidad: banda oscura detrás del titular (v1), degradé oscuro del lado del texto (v2),
sombras en el texto; con foto o componente, además `dim`.

### `pelicula.outro`: cierre del canal

Sin recuadro. Orden fijo: GRACIAS POR VER (parpadeo de exposición) → nombre del canal
GIGANTE naranja que **cae con estela**, hace glitch y se asienta sobre la barra roja (quemado
de luz al entrar) → **cuadro de película LIKE** que se "expone" (se llena de naranja, el pulgar
se rellena, pulso) y se **marca con lápiz graso rojo** de montajista → flecha a lápiz graso →
**tira roja SUSCRÍBETE** que entra con barrido → campana que suena → apoyo expuesto letra a
letra → `handle` con barra roja. Fundido a negro en los últimos 0.4 s (también tapa grano y
rayas vía `Kit.pelicula.fade`). En 9:16 la fila LIKE→SUSCRÍBETE va en diagonal y el bloque
ocupa del 20 % al 85 % del alto.
Params: `...Kit.hook.outroParams` (thanks, channel, cta, support, handle, arrow, likeAt,
subscribeAt, bellAt, supportAt; tiempos con `Kit.hook.outroTimes`), `bg` (auto = `projector`;
también `strips`, `reel`, `leader`, `image`, `component`, `none`), `dim` 0.66.

### Ejemplos

```json
{ "t": 0, "use": "pelicula.introv1", "until": "Casi las 7",
  "params": { "text": "EL PRECIO\nDE LA ^LIBERTAD^", "kicker": "Archivo · 1961",
              "bg": "image", "src": "assets/media/muro-gente.jpg", "focus": [0.5, 0.35], "dim": 0.4 } }

{ "t": 0, "use": "pelicula.introv2",
  "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "stampAt": "@nadie",
              "bg": "component", "use": "pelicula.photo",
              "useParams": { "src": "assets/media/leipzig.jpg", "enter": "cut" }, "dim": 0.5 } }

{ "use": "pelicula.outro", "params": { "bg": "strips", "src": "assets/media/nota.jpg" } }
```

Demo: el primer beat de `pelicula-demo` es `pelicula.introv1` (con `introv2` en `_alt`) hasta
"Casi las 7"; el título del año (1989) pasó a entrar en "Casi las 7".
