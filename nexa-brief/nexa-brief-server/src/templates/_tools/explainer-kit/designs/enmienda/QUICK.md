# enmienda · EXPEDIENTE — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de enmienda

- **`enmienda.word`** — Golpe de texto del documental: palabra/frase en condensada MUY gruesa con textura de tipo móvil gastado sobre negro. Parámetros: text*, font(grot|heavy|stencil|serif|wide), size, in(erode|blur|swipe|tumble|slam|cut), out(erode|blur|birds|cut), mark(none|x|circle|scribble|underline|crosshair), markAt, ghost, y, tilt, captions
  `{"use": "enmienda.word", "params": {"text": "ALGO SE\nROMPE", "font": "grot", "in": "erode", "mark": "x", "markAt": 0.7}}`
- **`enmienda.slats`** — Numeral gigante (romano o cifra) armado con listones de papel que entran deslizándose en vertical sobre un documento manuscrito tenue con marcas de conteo (||||/); al final la cámara gira y se zambulle en los listones (empalma con enmienda.plaque in:'dive'). Parámetros: text, sub, tally, doc, out(dive|erode|cut), buildSec
  `{"use": "enmienda.slats", "params": {"text": "XXVIII", "sub": "AÑOS"}}`
- **`enmienda.plaque`** — Tablero de listones blancos con letras negras de esténcil gastado (tipo 'ABOLITION OF SLAVERY'), iluminado al centro. Parámetros: lines, in(dive|cut|fade), strike, strikeAt, out(smear|cut)
  `{"use": "enmienda.plaque", "params": {"lines": ["LA NOCHE", "QUE CAYÓ", "EL MURO"], "in": "dive"}}`
- **`enmienda.cards`** — Cartulinas blancas con palabras en tinta negra de rodillo, pegadas con cinta negra sobre papel gris arrugado; aparecen una por una en stop-motion (como 'KEEP THESE PRISONS FILLED'). Parámetros: words*, at, strike, strikeAt, mode(words|pile), count
  `{"use": "enmienda.cards", "params": {"words": ["ABRAN", "LA", "PUERTA"]}}`
- **`enmienda.letter`** — Aviso de diario en papel blanco con viñeta: titular en serif condensada negra; barrido rápido (latigazo con desenfoque) hasta el cuerpo del texto y una nota manuscrita que se escribe sobre la línea de firma. Parámetros: headline*, body, hand, sign, whipAt
  `{"use": "enmienda.letter", "params": {"headline": "ESPERAR\nHASTA LA\nMAÑANA.", "body": "La regla se anunciaría al día siguiente,\ncon calma, con trámites y con orden.", "hand": "no antes del 10/11", "sign": "Oficina de prensa · 9 nov 1989"}}`
- **`enmienda.document`** — Documento oscuro: párrafo en condensada gris cuyas palabras aparecen en desorden (parpadeando) sobre una imagen fantasma; después una frase se resalta con caja blanca y texto negro (como 'EXCEPT AS A PUNISHMENT FOR CRIME'). Parámetros: text*, highlight, highlightAt, label, src
  `{"use": "enmienda.document", "params": {"text": "Un muro de hormigón y alambre en medio de la ciudad", "highlight": "hormigón y alambre", "highlightAt": 1.6}}`
- **`enmienda.wordcloud`** — Nube de palabras condensadas en profundidad: decenas de términos de distintos tamaños sobre un plano inclinado que la cámara atraviesa; las lejanas desenfocadas y tenues, las cercanas nítidas; garabatos a pincel encima. Parámetros: words*, count
  `{"use": "enmienda.wordcloud", "params": {"words": ["HUNGRÍA", "CHECOSLOVAQUIA", "ESCAPAR", "FRONTERA", "VIAJAR", "LIBERTAD"]}}`
- **`enmienda.finale`** — Título de cierre: letras gigantes (numeral romano) que desbordan el cuadro y barren lento de derecha a izquierda bajo una franja de luz; un rótulo chico impreso en tinta oscura sobre la primera letra. Parámetros: text, label, labelOn, speed
  `{"use": "enmienda.finale", "params": {"text": "MCMLXXXIX", "label": "9 NOV\n1989"}}`
- **`enmienda.map`** — Mapa de tinta sobre negro (siluetas de papel gastado): el mundo aparece parpadeando con un país resaltado; un barrido de vetas disuelve el resto y el país viaja al centro. Parámetros: from(world|country), zoomAt, country(DE), label, labelAt, bars, split, mergeAt, dots, text, textAt
  `{"use": "enmienda.map", "params": {"from": "world", "zoomAt": 2.4, "label": "BERLÍN"}}`
- **`enmienda.title`** — Apertura en frío del documental: planisferio de tinta que aparece parpadeando con el país resaltado, barrido de vetas que deja solo el país en el centro y barras negras que gotean sobre él (barrotes). Parámetros: text, kicker, country(DE), zoomAt, bars, textAt
  `{"use": "enmienda.title", "params": {"kicker": "BERLÍN · 9 NOV 1989", "zoomAt": 1.9, "bars": 3.3}}`
- **`enmienda.flag`** — Bandera de tela ondeando en blanco y negro (la cámara se aleja desde un primer plano girado) con texto de tamaños mezclados encima: palabras chicas condensadas a los lados y una palabra ENORME extendida al medio (como 'TO ALL AMERICANS'). Parámetros: bands(de|stripes), text, textAt
  `{"use": "enmienda.flag", "params": {"bands": "de", "text": "EL ^MURO^ MÁS FAMOSO"}}`
- **`enmienda.archive`** — Foto de archivo en blanco y negro contrastado a pantalla completa (o dentro de un marco de película proyectada), empuje lento de cámara, lower-third de entrevista (NOMBRE / cargo / institución en Barlow Condensed) y, opcional, barrotes desenfocados en primer plano que entran de golpe. Parámetros: src*, focus, zoom, push, frame(full|film), in(cut|fade), name, role, org, bars
  `{"use": "enmienda.archive", "params": {"src": "assets/media/schabowski.jpg", "name": "Günter Schabowski", "role": "Vocero del partido", "org": "SED · RDA"}}`
- **`enmienda.cutout`** — Figuras recortadas de fotos de archivo que aparecen una a una sobre negro: primero una silueta blanca sobreexpuesta con brillo y después se 'revela' la foto (como los presos de 1900 que se van sumando). Parámetros: src1*, src2, src3, src4, stagger, name, role
  `{"use": "enmienda.cutout", "params": {"src1": "assets/media/muro-gente.jpg", "src2": "assets/media/mauerspecht.jpg", "src3": "assets/media/leipzig.jpg"}}`
- **`enmienda.tapes`** — Pared de tiras de cinta negra con textos manuscritos en blanco (nombre / fecha / lugar), bajo un foco que se enciende y deriva; opcionalmente la cámara se aleja y las tiras se vuelven los ladrillos de un muro con una placa en el centro. Parámetros: items*, toWall, plaque
  `{"use": "enmienda.tapes", "params": {"items": ["MADRE\nBERLÍN ESTE\nSEPARADA", "HERMANO\nBERLÍN OESTE\nSEPARADO"], "toWall": 3, "plaque": "UNA CALLE\nDOS MUNDOS"}}`
- **`enmienda.wall`** — Muro de ladrillos gris bajo un foco, con una placa negra chica en el centro; puede ABRIRSE: los ladrillos del centro caen uno a uno (stop-motion) dejando pasar una luz blanca. Parámetros: plaque, openAt, openSec
  `{"use": "enmienda.wall", "params": {"plaque": "23:30\nLA DECISIÓN", "openAt": 2}}`
- **`enmienda.inmates`** — Fila de siluetas con uniforme a rayas sobre pared de papel gris, desenfocadas, que la cámara recorre; un latigazo lleva a un primer plano de una figura con una placa negra en el pecho: CIFRA grande + rótulo + nota (como '878,400'). Parámetros: number*, label, sub, whipAt
  `{"use": "enmienda.inmates", "params": {"number": "140", "label": "MURIERON EN EL MURO", "sub": "1961 — 1989"}}`
- **`enmienda.bars`** — Barrotes: palabra gastada sobre negro con barras de luz desenfocadas que pasan en primer plano; la cámara se aleja y la palabra queda dentro de una celdita dibujada; las palabras siguientes llegan letra por letra desde lejos, sobre un fondo de rayas verticales tenues. Parámetros: texts*, at
  `{"use": "enmienda.bars", "params": {"texts": ["LARGA", "Y ABURRIDA", "UNA HORA"]}}`
- **`enmienda.graph`** — Gráfico de línea fino sobre negro con puntos y líneas verticales al eje: la cámara arranca pegada e inclinada sobre el primer punto, recorre la línea mientras se dibuja y se aleja; el título se estampa con parpadeo y al final la cámara se zambulle en el último punto. Parámetros: title, points*, values, dive
  `{"use": "enmienda.graph", "params": {"title": "SALIDAS\nHACIA EL\nOESTE", "points": ["ENE", "MAR", "MAY", "JUL", "AGO", "SEP", "OCT", "NOV"], "values": [0.05, 0.07, 0.1, 0.15, 0.3, 0.45, 0.6, 1]}}`
- **`enmienda.pictogram`** — Infografía sobre negro: título extendido chico con etiqueta en caja, fila de figuras humanas grises que suben desde el piso con UNA a rayas resaltada y la proporción debajo ('1 DE 3'); después la cámara entra en la figura rayada y aparece una grilla de figuras con la cifra grande arriba ('40,2 %'). Parámetros: title, tag, ratio, row, big, note, gridAt, cols, rows
  `{"use": "enmienda.pictogram", "params": {"title": "PROBABILIDAD DE CRUZAR", "tag": "BERLÍN ESTE", "ratio": "1 DE 3", "big": "MILES", "note": "EN LOS PUESTOS FRONTERIZOS"}}`
- **`enmienda.collage`** — Constelación de recortes (fotos, rótulos, numerales) que nace de un punto girando y se abre; después se oscurece y aparece un bloque de dato al centro: rótulo chico, CIFRA que cuenta hacia arriba y nota, entre filetes. Parámetros: src1, src2, src3, src4, words, kicker, big, sub, from
  `{"use": "enmienda.collage", "params": {"src1": "assets/media/mauerbau.jpg", "src2": "assets/media/leipzig.jpg", "words": ["IX·XI", "1961", "RDA"], "kicker": "3 DE OCTUBRE", "big": "1990", "sub": "ALEMANIA · UN SOLO PAÍS"}}`
- **`enmienda.flicker`** — Golpe de proyector sobre la escena: destello blanco de 2 cuadros que se apaga, caída a negro, o parpadeo de exposición irregular (lámpara inestable). Parámetros: kind(white|black|exposure), strength
  `{"use": "enmienda.flicker", "params": {"kind": "white", "dur": 0.4}}`
- **`enmienda.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, bg(auto|wall|map|world|dark|image|component|none), src, focus, use, useParams, dim, crowd, crackAt, wordAt, stagger, country(DE), city
  `{"use": "enmienda.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "crackAt": 2.3}}`
- **`enmienda.introv2`** — GANCHO tipo expediente. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, country(DE), city, crowd, bg(auto|map|wall|world|dark|image|component|none), src, focus, use, useParams, dim
  `{"use": "enmienda.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Expediente · Berlín 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}`
- **`enmienda.outro`** — Cierre del canal SIN recuadro (bg: map | wall | image con src | component con use/useParams): por defecto mapamundi de tinta que se desplaza con alfileres y rutas de hilo (o el Muro de noche). Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|map|wall|image|component|none), src, focus, use, useParams, dim
  `{"use": "enmienda.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@nodetech"}}`

## Comunes (todos los diseños)

- **`common.punch`** — Palabra o frase GIGANTE a pantalla (momento de alto impacto, como las plantillas de música): letras que caen con desenfoque y se asientan; '^palabra^' va en color de acento. Parámetros: text*, size, style(solid|outline|glitch), stagger, y, hideCaptions
  `{"use": "common.punch", "params": {"text": "MILLONES\nDE ^VIDAS^", "size": 0.9}}`
- **`common.tag`** — Rótulo de contexto (lugar · fecha · dato) en mono mayúsculas, arriba o abajo del cuadro; entra escribiéndose. Parámetros: text*, pos(top|bottom|center), boxed
  `{"use": "common.tag", "params": {"text": "BLETCHLEY PARK · 1940", "pos": "top"}}`
- **`common.flash`** — Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido. Parámetros: color, strength
  `{"use": "common.flash", "params": {"color": "palette.ink", "dur": 0.5}}`
- **`common.endcard`** — Tarjeta final sobria: frase de cierre grande, línea y firma de marca (canal / suscribirse). Parámetros: line, brand, cta
  `{"use": "common.endcard", "params": {"line": "SEGUIMOS\nPREGUNTANDO", "brand": "NEXA BRIEF", "cta": "SUSCRÍBETE"}}`
- **`common.lyric`** — Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave. Parámetros: accent, size, maxChars, dimPast, y
  `{"use": "common.lyric", "params": {"accent": ["vidas"], "size": 0.9}}`
- **`common.clip`** — Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Parámetros: src*, start, rate, layout(full|frame), size, ar, focus, zoom, tone(design|color), dim, caption, sub
  `{"use": "common.clip", "params": {"src": "assets/media/servidores.mp4", "layout": "full", "caption": "Un centro de datos", "sub": "PEXELS · 2026"}}`
