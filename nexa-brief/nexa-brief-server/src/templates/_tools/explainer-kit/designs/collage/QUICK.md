# collage · HEMEROTECA — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de collage

- **`collage.intro`** — Apertura de HEMEROTECA: masthead NODETECH, fecha de archivo, año grande y titular sobre papel claro con reglas bordó. Parámetros: number, before, after, line
  `{"use": "collage.intro", "params": {"number": "1989", "before": "9 nov", "after": "Berlín", "line": "LA NOCHE QUE CAYÓ EL MURO"}}`
- **`collage.title`** — Alias compatible de collage.intro; usa la nueva apertura de archivo. Parámetros: number, before, after, line
  `{"use": "collage.title", "params": {"number": "1989", "before": "9 nov", "after": "Berlín", "line": "LA NOCHE QUE CAYÓ EL MURO"}}`
- **`collage.board`** — El plano tipo: mesa de papel de diario con fotos de borde blanco viradas (B/N, verde azulado, rosa, sepia), recortes, sellos y moneda; año en serif bordó con fecha chica; recorte con titular opcional. Parámetros: photo*, photo2, photo3, photo4, photo5, layout(hero|duo|trio|quad|scatter|strip), tones, year, yearSmall, yearFrom, headline, swap, swapEvery, appear(slide|drop|fade|pop), stagger, density, coins, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.board", "params": {"photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/leipzig.jpg", "layout": "trio", "year": "1961", "yearSmall": "13.08", "headline": "SE LEVANTA EL MURO"}}`
- **`collage.date`** — Fecha/cifra protagonista: número grande en serif bordó (cuenta desde `from` si se da) con fecha chica arriba y una línea en versalitas debajo, sobre el collage con 2 fotos que entran por el costado. Parámetros: text*, from, count, small, kicker, photo*, photo2, photo3, tones, density, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.date", "params": {"text": "1989", "from": 1961, "small": "28 AÑOS", "kicker": "UNA CIUDAD PARTIDA EN DOS", "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/muro-gente.jpg"}}`
- **`collage.banner`** — Banda oscura translúcida que cruza el collage con un titular en serif romana mayúscula (como 'GLUBB PASHA FLIES HOME'), retrato pequeño al final de la banda y fotos debajo; cámara en diagonal. Parámetros: text*, year, photo*, photo2, photo3, tones, density, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.banner", "params": {"text": "HORMIGÓN Y ALAMBRE", "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/bornholmer.jpg", "photo3": "assets/media/muro-gente.jpg"}}`
- **`collage.headline`** — Página de diario en primer plano: foto grande con filete, bajada en itálica, regla y titular grande en serif negra bordó; foto rosada desenfocada al costado. Parámetros: text*, kicker, photo*, photo2, tones, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.headline", "params": {"photo": "assets/media/schabowski.jpg", "kicker": "AL FINAL DE LA CONFERENCIA", "text": "LO LEYÓ TAL CUAL"}}`
- **`collage.map`** — Mapa antiguo (costas, retícula, ríos, fronteras punteadas) con lugares rotulados y rutas rojas que se trazan solas; foto recortada de bordes suaves encima (paralaje) y una lupa de bronce que recorre el mapa. Parámetros: places, routes, title, lens, year, photo, tones, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.map", "params": {"places": ["Leipzig", "Praga", "Budapest", "Viena"], "title": "EUROPA CENTRAL", "photo": "assets/media/leipzig.jpg"}}`
- **`collage.panels`** — Paneles de color apagado (violeta, verde azulado, mostaza, oliva) con titular, bajada y foto, que caen sobre un mapa desde cerca de cámara de a uno (entrada escalonada). Parámetros: items*, photo*, photo2, photo3, photo4, tones, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.panels", "params": {"items": [{"title": "ESTE", "text": "una ciudad cerrada"}, {"title": "OESTE", "text": "al otro lado de la calle"}], "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/leipzig.jpg"}}`
- **`collage.ribbon`** — Columna central: foto arriba, cinta bordó con volutas ornamentales y texto crema, foto abajo; a los costados fotos grandes desenfocadas y estelas de fuegos artificiales/destellos. Parámetros: text*, photo*, photo2, photo3, photo4, sparks, tones, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.ribbon", "params": {"text": "LA NOCHE EN QUE\nCAYÓ EL MURO", "photo": "assets/media/muro-gente.jpg", "photo2": "assets/media/mauerspecht.jpg", "photo3": "assets/media/bornholmer.jpg"}}`
- **`collage.tribute`** — Homenaje sobrio: foto en óvalo que se funde con el papel, fecha chica y titular bordó sobre una regla, bruma rosada y pétalos rojos que caen (algunos grandes y desenfocados, cerca de cámara). Parámetros: photo*, date, text, petals, tone(bw|teal|rose|sepia|color|red), tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.tribute", "params": {"photo": "assets/media/muro-gente.jpg", "date": "1961 · 1989", "text": "AL MENOS 140 PERSONAS MURIERON EN EL MURO"}}`
- **`collage.portraits`** — Página de libro con un gran medallón: 2–4 retratos en óvalos viñeteados (virados verde azulado/sepia), adornos rojos y un título en versalitas; la cámara se aleja y gira como al levantar el libro. Parámetros: photo*, photo2, photo3, photo4, title, tones, tin(cut|flip|burst|whip|leak|dive|smoke|flare), move(left|right|up|down|in|out|diag|drift|none), speed, tilt
  `{"use": "collage.portraits", "params": {"photo": "assets/media/schabowski.jpg", "photo2": "assets/media/mauerspecht.jpg", "photo3": "assets/media/muro-gente.jpg", "title": "GRANDES BATALLAS, GRANDES LÍDERES"}}`
- **`collage.emblem`** — Emblema conmemorativo: sobre cielo desenfocado, un número/año dorado en 3D entra girando letra por letra, cinta bordó en arco con el título, libro abierto de línea y bajada; el fondo se aclara a blanco. Parámetros: number*, title, sub, white, tin(cut|flip|burst|whip|leak|dive|smoke|flare)
  `{"use": "collage.emblem", "params": {"number": "1989", "title": "DE INMEDIATO", "sub": "SIN DEMORA\nBerlín · 9 de noviembre"}}`
- **`collage.leak`** — Cortina de luz cálida (fuga de película) que barre el cuadro para marcar un golpe o una frase clave. Parámetros: color(warm|pink|red|white), strength
  `{"use": "collage.leak", "params": {"color": "warm", "strength": 0.9}}`
- **`collage.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, wordAt, stagger, flashAt, photoTone(bw|teal|rose|sepia|color|red), bg(auto|table|sky|map|press|image|component|none), src, focus, use, useParams, dim
  `{"use": "collage.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "flashAt": 2.3}}`
- **`collage.introv2`** — GANCHO 'primera plana'. Parámetros: text*, kicker, masthead, stamp, stampAt, typeAt, cps, photoTone(bw|teal|rose|sepia|color|red), bg(auto|map|table|sky|press|image|component|none), src, focus, use, useParams, dim
  `{"use": "collage.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 9 de noviembre de 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}`
- **`collage.outro`** — Cierre del canal SIN recuadro (bg: table | sky | map | press | image con src | component con use/useParams): por defecto la mesa de archivo en plano secuencia, oscurecida. Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|table|sky|map|press|image|component|none), src, focus, use, useParams, dim, photoTone(bw|teal|rose|sepia|color|red)
  `{"use": "collage.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "HEMEROTECA", "cta": "SUSCRÍBETE", "support": "Tu apoyo permite seguir contando historias de archivo.", "handle": "youtube.com/@hemeroteca"}}`

## Comunes (todos los diseños)

- **`common.punch`** — Palabra o frase GIGANTE a pantalla (momento de alto impacto, como las plantillas de música): letras que caen con desenfoque y se asientan; '^palabra^' va en color de acento. Parámetros: text*, size, style(solid|outline|glitch), stagger, y, hideCaptions
  `{"use": "common.punch", "params": {"text": "MILLONES\nDE ^VIDAS^", "size": 0.9}}`
- **`common.tag`** — Rótulo de contexto (lugar · fecha · dato) en mono mayúsculas, arriba o abajo del cuadro; entra escribiéndose. Parámetros: text*, pos(top|bottom|center), boxed
  `{"use": "common.tag", "params": {"text": "BLETCHLEY PARK · 1940", "pos": "top"}}`
- **`common.flash`** — Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido. Parámetros: color, strength
  `{"use": "common.flash", "params": {"color": "palette.ink", "dur": 0.5}}`
- **`common.endcard`** — Tarjeta final sobria: frase de cierre grande, línea y firma de marca (canal / suscribirse). Parámetros: line, brand, cta
  `{"use": "common.endcard", "params": {"line": "SEGUIMOS\nPREGUNTANDO", "brand": "NEXA BRIEF", "cta": "SUSCRÍBETE"}}`
- **`common.lyric`** — Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave. Parámetros: text, accent, size, maxChars, dimPast, y
  `{"use": "common.lyric", "params": {"accent": ["vidas"], "size": 0.9}}`
- **`common.logo`** — Obsoleto: el logo debe acompañar una foto o video con el parámetro logo del componente visual. Parámetros: src, name
- **`common.clip`** — Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Parámetros: src*, start, rate, loop, layout(auto|full|frame), size, ar, focus, zoom, tone(design|color), dim, caption, sub, logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "common.clip", "params": {"src": "assets/media/servidores.mp4", "caption": "Un centro de datos", "sub": "PEXELS · 2026"}}`
- **`common.tabloid`** — Miniatura e intro tabloide con foto o video mudo; focus protege la zona de interés del medio. Parámetros: text*, src, srcAfter, video, poster, start, rate, loop, muted, accent, bullet, bulletScale, beforeLabel, afterLabel, imageSide(auto|left|right), mode(impact|split), palette(brand|alert), strap, seal, tapeText, marker, focus, target, textIn(slam|slide|typewriter|none), stagger, accentIn(slam|slide|typewriter|none), bulletIn(slam|slide|typewriter|none), inDuration, logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "common.tabloid", "params": {"text": "TÚ ERES EL SIGUIENTE", "accent": "SIGUIENTE", "strap": "AMAZON · IA"}}`
- **`common.question`** — Tarjeta grande para la pregunta final del video; ocupa el acto completo y se adapta a 9:16 y 16:9. Parámetros: text*, y
  `{"use": "common.question", "params": {"text": "¿La IA te quita trabajo?"}}`

## Marcas e instituciones

El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. Usá `logo`, `logoName`, `logoPos` y `logoSize` en el beat visual (`rough.photo`, `binary.frame`, `common.clip`, `rough.introv2`, `binary.introv2` o `common.tabloid`). `common.logo` está obsoleto. Preferí SVG; el PNG debe ser transparente.
