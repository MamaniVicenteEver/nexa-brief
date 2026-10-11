# enmienda · «EXPEDIENTE»

Diseño del explainer-kit que replica el **lenguaje visual de una secuencia de títulos documental en
blanco y negro** (referencia: `sandbox/nodehistory/_referencias/otros/ava_duvernay’s_13th (1080p).mp4`, 172 s, 1920×1080,
23,976 fps). Contenido reemplazable: el demo usa el guion, la voz y las 7 fotos de `muro-de-berlin`
(`nodehistory/enmienda-demo/`).

Pensado para temas de **historia política, justicia, leyes, derechos civiles, momentos decisivos**:
todo lo que se cuenta mejor como un expediente de archivo (tinta, cinta, papel, mapas, cifras).

---

## 1. Análisis de la referencia

### Identidad general
- Fondo **negro puro** (#000) con **grano de película** fino, **polvo/pelusas blancas** que aparecen
  un cuadro, **viñeta** fuerte y **parpadeo de exposición** leve (lámpara de proyector).
- Todo en **escala de grises levemente cálida** (los blancos tiran a hueso #d6d0c5, nunca #fff).
- Ritmo: primeros 31 s sin cortes duros (todo son **transformaciones continuas**: mapa → país →
  barrotes → numeral → cartel); después cortes cada 0,8–2 s alternando archivo y tipografía.
- La tipografía es la protagonista: **condensada MUY gruesa** con textura de **tipo móvil gastado**
  (manchas, vetas del rodillo, poros) — no es una fuente "grunge" sino tinta real impresa.

### Paleta (muestreada con PIL sobre cuadros a 1080p)
| uso | hex |
|---|---|
| fondo | `#000000` (zonas de luz `#070606`–`#272523`) |
| letra clara (alto / medio) | `#d1cbc1` / `#b8b2a8` → elegido `#d6d0c5` |
| papel de fondo (cartulinas, tablero) | `#c2c2c2` con viñeta a negro |
| tinta / cinta negra | `#141414` |
| lower-third nombre / cargo | `#eeeeeb` / `#8b8685` |

### Tipografías (equivalentes en Google Fonts)
| referencia | uso | elegida |
|---|---|---|
| grotesca condensada bold de madera (CRIMINAL, MANDATORY MINIMUMS, SUPER PREDATOR, POLITICAL PRISONER) | golpes de texto | **Oswald 700** (y **Anton** para lo más pesado) |
| esténcil con serifa (PUBLIC ENEMY, ON THE NEWS) | amenazas, preguntas | **Stardos Stencil 700** |
| victoriana condensada (EMANCIPATION, BRING BACK THE DEATH PENALTY) | titulares de diario | **Playfair Display 900** comprimida al 80 % |
| grotesca **extendida** (SOUTHERN STRATEGY, infografías, rótulos de mapa) | datos, mapa | **Archivo 800 wdth 125** |
| Trade Gothic Bold Cond. (lower-third ANGELA DAVIS, 878,400) | nombres, cifras | **Barlow Condensed 600/700** |
| texto de documento (13th Amendment) | párrafos | **Barlow Condensed 600** mayúsculas |
| manuscrita en cinta (nombres) | listas | **Architects Daughter** |
| firma | notas | **Herr Von Muellerhoff** |
| cuerpo de diario | letras chicas | **Old Standard TT** |

### Catálogo de escenas y movimientos (segundo de la referencia → componente)
| s | qué pasa | cómo lo replica `enmienda` |
|---|---|---|
| 0,0–3,5 | planisferio que **aparece parpadeando** (sube en escalones irregulares), EE.UU. más claro | `title` / `map` from:"world" (fade con parpadeo por cuadro) |
| 6,8–8,7 | el resto del mundo se **disuelve en vetas diagonales** (brochazos) y el país **viaja y crece** al centro | `map` zoomAt: máscara de disolución anisótropa + interpolación entre proyección Natural Earth y equirectangular |
| 10,5–13,5 | **barras negras gotean** desde arriba sobre el país → país a rayas (barrotes) | `map` / `title` bars |
| 13,5–16,0 | **XIII armado con listones** que entran deslizándose en vertical sobre un documento manuscrito tenue + **marcas de conteo** | `slats` |
| 16,0–17,5 | la cámara **gira (-30°) y se zambulle** en los listones | `slats` out:"dive" |
| 17,5–19,5 | empalme: tablero **ABOLITION OF SLAVERY** llega girando desde muy cerca y se aleja | `plaque` in:"dive" |
| 19,8–20,4 | **barrido desenfocado horizontal** del cartel mientras EMANCIPATION entra desenfocada | `plaque` out:"smear" + `word` in:"blur" |
| 21,4–21,7 | FREEDOM entra **barriendo desde la izquierda** con desenfoque de movimiento | `word` in:"swipe" |
| 22,0–23,0 | la palabra **se rompe en recortes de papel (palomas)** que vuelan | `word` out:"birds" |
| 23,0–24,0 | una estrella → **la cámara se aleja girando** y revela la bandera ondeando | `flag` (zoom 3,2→1, -24°→-1,5°) |
| 24,3–27,0 | **TO ALL AMERICANS**: chica condensada + ENORME extendida + chica | `flag` text "EL ^MURO^ MÁS FAMOSO" |
| 28,0–31,6 | documento oscuro: **palabras que aparecen en desorden** parpadeando sobre una imagen fantasma; **EXCEPT AS A PUNISHMENT FOR CRIME** se resalta con **caja blanca y texto negro** | `document` |
| 32,8 | CRIMINAL: **golpe seco** | `word` in:"slam" / "cut" |
| 31,9–35,7 | mapa con **puntos que caen** y **rótulos en caja negra que se tipean** (LOS ANGELES) | `map` dots / label |
| 36,0–39,0 | figuras de archivo que aparecen como **silueta blanca brillante y se revelan** | `cutout` |
| 40–46 | fotos de archivo, algunas **dentro de un cuadro de película** con esquinas redondeadas y vaivén | `archive` frame:"film" |
| 51,6–55,6 | **nube de palabras en profundidad** (plano inclinado que se endereza, lejanas desenfocadas, garabatos) | `wordcloud` |
| 55,8–57,3 | SOUTHERN STRATEGY: extendida blanca **renglón a renglón** sobre mapa con el **Sur oscuro** | `map` split + text |
| 60,6–62,0 | entrevista con **lower-third** (NOMBRE / cargo gris / institución) | `archive` name/role/org |
| 62,1–64,5 | PUBLIC entra **volteada y desde cerca**; destello subliminal enorme; **mira telescópica** que se dibuja girando | `word` in:"tumble"/"slam" + mark:"crosshair" |
| 66,9–68,5 | aviso de diario (titular serif) → **latigazo horizontal** al cuerpo + **firma** | `letter` |
| 77,5–80,7 | METAL BARS: **barras de luz desenfocadas** pasan en primer plano; la cámara se aleja y la palabra queda en una **celdita dibujada**; THE CAN llega **letra por letra desde lejos** | `bars` |
| 80,7–86,0 | **fila de siluetas a rayas** sobre papel gris, paneo + **latigazo** a primer plano con **placa negra 878,400** | `inmates` |
| 86,0–88,0 | **cartulinas con cinta negra** en stop-motion (97 % / NEVER SEE TRIAL) | `cards` |
| 91–98 | **gráfico de línea**: cámara pegada e inclinada sobre 1970 que recorre la línea, se aleja; título que se **estampa parpadeando**; **zambullida en el último punto** | `graph` |
| 98–102 | **constelación** de recortes que nace del punto girando; se oscurece y aparece la **cifra que cuenta** | `collage` |
| 102–117 | serie de golpes gastados: **erosión por vetas** (entran y salen como polvo), **marcas a pincel** (cruz, círculo, garabato), **fantasmas** de documentos detrás | `word` in/out:"erode", mark, ghost |
| 117–125 | infografía: figuras grises con **una a rayas**, “1 IN 3”; zoom a la rayada; **grilla** de figuras que suben del piso + “40,2 %” | `pictogram` |
| 130–132 | POLITICIANS AND CORPORATIONS: **cinta negra tacha** cada renglón (pegado en stop-motion, con esquina doblada) | `plaque` strike |
| 132–134 | **hojas con membretes que llueven y se apilan** | `cards` mode:"pile" |
| 140–141 | KEEP THESE PRISONS FILLED (cartulinas) | `cards` |
| 146–151 | **nombres manuscritos en cinta negra** bajo un **foco** que se enciende y deriva | `tapes` |
| 151,3–155 | la cámara se aleja: las cintas se vuelven **ladrillos de un muro** con una **placa** | `tapes` toWall / `wall` |
| 155,5–161 | retrato que sube desde negro; **barrotes desenfocados** entran de golpe | `archive` in:"fade", bars |
| 161,5–169,8 | **XIII gigante** (desborda el cuadro) que **barre lento** bajo una **franja de luz**, "13TH" impreso en la X; entra con una **cuña oscura** y **funde a negro** | `finale` |

## 2. Componentes

| componente | escena de la referencia | params clave |
|---|---|---|
| `enmienda.title` | apertura mundo → país → barrotes | kicker, text, zoomAt, bars |
| `enmienda.map` | mapas de tinta | from, zoomAt, bars, split, mergeAt, dots, label, text |
| `enmienda.slats` | XIII de listones + zambullida | text, sub, tally, doc, out |
| `enmienda.plaque` | tablero de listones, tachado con cinta | lines, in, strike, strikeAt, out |
| `enmienda.word` | golpes de texto gastado (el 50 % de la referencia) | text, font, in, out, mark, markAt, ghost, tilt |
| `enmienda.flag` | bandera + texto mixto | bands, text (^GRANDE^), textAt |
| `enmienda.document` | documento con palabras en desorden + resaltado | text, highlight, highlightAt, label, src |
| `enmienda.letter` | aviso de diario → nota manuscrita | headline, body, hand, sign, whipAt |
| `enmienda.wordcloud` | nube de palabras en profundidad | words, count |
| `enmienda.archive` | foto de archivo + lower-third / película / barrotes | src, focus, zoom, push, frame, in, name, role, org, bars |
| `enmienda.cutout` | figuras que se revelan desde silueta blanca | src1..src4, stagger, name, role |
| `enmienda.bars` | barrotes + celda + letras desde lejos | texts, at |
| `enmienda.inmates` | fila de siluetas → placa con cifra | number, label, sub, whipAt |
| `enmienda.cards` | cartulinas con cinta (stop-motion), pila de hojas | words, at, strike, strikeAt, mode, count |
| `enmienda.graph` | gráfico de línea con cámara | title, points, values, dive |
| `enmienda.collage` | constelación + cifra que cuenta | src1..src4, words, kicker, big, sub, from |
| `enmienda.pictogram` | infografía de figuras | title, tag, ratio, row, big, note, gridAt |
| `enmienda.tapes` | nombres en cinta → muro de ladrillos | items, toWall, plaque |
| `enmienda.wall` | muro con placa que se abre (cae ladrillo a ladrillo) | plaque, openAt, openSec |
| `enmienda.finale` | numeral gigante que barre + fundido | text, label, labelOn, speed |
| `enmienda.flicker` (overlay) | golpes de proyector | kind (white/black/exposure), strength |
| `enmienda.outro` | cierre de canal (automático) | thanks, channel, cta, support, handle |

Runtime de familia (`components/_enmienda.js`): fondo negro, **grano** (6 tiles sembrados que rotan
por cuadro a 24 fps), **polvo y pelos** deterministas por cuadro, **viñeta**, **parpadeo de
exposición**; subtítulos en Barlow Condensed discreta. Utilidades `Kit.enm`: `inkText` (texto con
textura de impresión clara u oscura, cacheado), `dissolver`/`masked` (erosión grunge por vetas a baja
resolución), `paper`, `fibers`, `grunge`, `tape`, `card`, `brush`/`scribble` (pincel seco),
`crosshair`, `camera` (empuje + deriva), `smear` (desenfoque de movimiento), `stop`/`boil`
(stop-motion), `person`/`bust` (siluetas), `lowerThird`.

Assets propios: `assets/geo.js` — siluetas simplificadas del mundo (110m) y de Alemania (50m) de
**Natural Earth** (dominio público, vía world-atlas · ISC), frontera interalemana aproximada y
ciudades. Todas las texturas son procedurales (rng sembrado, cacheadas). Nada copiado de la referencia.

## 3. Qué quedó igual y qué difiere

**Igual (o muy cerca):** paleta y grano; tipografía condensada gastada con erosión por vetas;
cadena continua de apertura mundo → país → barrotes → numeral de listones → zambullida → tablero;
barrido desenfocado de salida; entrada barrida y rotura en "palomas"; bandera con texto mixto;
documento con palabras en desorden y resaltado en caja; mira telescópica; latigazos; barras de
celda con letras que llegan desde lejos; placa con cifra; cartulinas con cinta en stop-motion;
gráfico con cámara que recorre la línea y se zambulle; collage con cifra que cuenta; infografía de
figuras; nombres en cinta → muro de ladrillos; numeral final gigante con franja de luz y fundido.

**Difiere y por qué:**
- Las "palomas" son recortes poligonales de la propia palabra (no siluetas de pájaro animadas) y no
  se transforman en estrella: la referencia usa animación cuadro a cuadro dibujada a mano.
- Las figuras de `cutout` son óvalos con borde fundido recortados de las fotos: no hay máscaras de
  personas (rotoscopía) para fotos arbitrarias.
- El mapa usa siluetas vectoriales con textura de papel; la referencia tiene bordes de tinta con
  sangrado real. El "mundo" interpola de Natural Earth a equirectangular (no hay paneo 3D).
- Entrevistas en video (Angela Davis) → fotos fijas con empuje lento + lower-third (no hay video).
- Las fotos de la referencia son muchas y distintas; acá se **repiten las 7** con otro encuadre,
  zoom, marco o tratamiento (pedido del usuario).
- `check` avisa "tres enmienda.word seguidos": es intencional, la referencia encadena 10–15 golpes
  de texto seguidos (102–117 s). También avisa 0 `common.lyric`: este diseño no carga `common`
  (el golpe de texto propio es `enmienda.word`). `wall` dura 9,1 s porque hereda el ancla del demo
  base y la apertura del muro ocurre recién a los 6,3 s.

## 4. Limitaciones del motor
- Las transiciones de salida corren en el solape posterior (`post`), pero una escena opaca que
  entra encima las tapa; por eso las salidas importantes con escena opaca siguiente se hacen al
  final del propio beat (`slats` out:"dive") o como entrada de la siguiente (`plaque` in:"dive").
- Los params de tipo `image` sólo se precargan si son strings sueltos: `cutout` y `collage` usan
  `src1..src4` en vez de un array.
- Un `handle` que empiece con `@` se interpreta como ancla de palabra (`@palabra`): no se pone
  en `defaults.outro` (sí se puede pasar sin `@`).

## Intros y cierre (contrato común `designs/common/hook.js`)

Todos los diseños registran `<familia>.introv1`, `<familia>.introv2` y `<familia>.outro` con los mismos
parámetros de fondo: `bg` (`auto` | presets | `image` | `component` | `none`), `src`, `focus`, `use`,
`useParams`, `dim`. Así la intro cambia con el tema sin tocar código.

| componente | qué es | presets de `bg` (auto = el primero) |
|---|---|---|
| `enmienda.introv1` | gancho "golpe": titular gigante desgastado que golpea palabra por palabra con sacudida; `^x^` = palabra en cartulina blanca; `crackAt` = el muro se raja | `wall` (Muro de noche, reflectores, torre, gente), `map`, `world`, `dark` |
| `enmienda.introv2` | gancho "expediente": pregunta tipeada + sello de tinta (`stamp`, `stampAt` acepta `@palabra`) | `map` (país con mira y radar), `wall`, `world`, `dark` |
| `enmienda.outro` | cierre sin recuadro: GRACIAS POR VER → canal gigante (erosión) → LIKE marcado a pincel → flecha → SUSCRÍBETE + campana → apoyo → youtube.com/@… | `map` (mapamundi con alfileres y rutas), `wall` |

`crowd: true` agrega la fila de gente en silueta sobre cualquier fondo (también foto o componente).

```json
{ "t": 0, "use": "enmienda.introv1", "params": { "text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir" } }
{ "t": 0, "use": "enmienda.introv1", "params": { "text": "EL PRECIO\nDE LA ^LIBERTAD^", "bg": "image", "src": "assets/media/muro-gente.jpg", "focus": [0.5, 0.4] } }
{ "t": 0, "use": "enmienda.introv2", "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "bg": "component", "use": "enmienda.flag", "useParams": {}, "dim": 0.35 } }
```
El cierre lo agrega el motor con `config.outro` (`use: "enmienda.outro"`); `likeAt`/`subscribeAt`/`bellAt`/
`supportAt` se sincronizan con la despedida narrada. Escribir `handle` sin `@` inicial.
