# pop · DUOTONO — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de pop

- **`pop.logo`** — Apertura de marca (ref. Parámetros: mark, kicker, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.logo", "params": {"mark": "", "kicker": "BERLÍN · 9 NOV 1989"}}`
- **`pop.kaleido`** — Objeto 3D orgánico (blob relleno con la foto en duotono, sombreado, con esquirlas) con rótulo '/RUTA/TIPO' (ref. Parámetros: src, label, tag, split, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.kaleido", "params": {"src": "assets/media/mauerspecht.jpg", "label": "/BERLÍN/1989", "tag": "/MURO"}}`
- **`pop.kanji`** — Texto diagonal isométrico (ref. Parámetros: big, sub, src, split, corner, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.kanji", "params": {"big": "ベルリンの壁", "sub": "BERLIN WALL · 1961", "src": "assets/media/bornholmer.jpg", "corner": ["9 NOV", "19", "89", "DDR"]}}`
- **`pop.word`** — Palabra GIGANTE menta sobre foto a sangre en duotono oscuro con zoom lento (ref. Parámetros: text*, small, src*, tone(dark|normal|light|inv), focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.word", "params": {"text": "28 AÑOS", "src": "assets/media/mauerbau.jpg"}}`
- **`pop.hatch`** — Palabra gigante menta sobre foto violeta (ref. Parámetros: text*, src*, hatch, stars, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.hatch", "params": {"text": "1961", "src": "assets/media/mauerbau.jpg", "hatch": [1, 3]}}`
- **`pop.stack`** — Renglones apilados menta en grotesca extendida sobre foto (ref. Parámetros: text, src*, tone(dark|normal|light|inv), shapes, phase2, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.stack", "params": {"text": "LA NOCHE\nQUE CAYÓ\nEL MURO", "src": "assets/media/muro-gente.jpg"}}`
- **`pop.letters`** — 2–3 letras/cifras GIGANTES (ref. Parámetros: text*, src*, tag, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.letters", "params": {"text": "89", "src": "assets/media/muro-gente.jpg", "tag": "LA NOCHE QUE\nCAMBIÓ TODO"}}`
- **`pop.band`** — Texto grande que pasa de negro a foto (ref. Parámetros: text*, src*, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.band", "params": {"text": "140 VIDAS", "src": "assets/media/mauerbau.jpg"}}`
- **`pop.arrow`** — Flecha gruesa que entra desde la izquierda en 4 cuadros parpadeando violeta→rosa→gris→rosa→violeta, con un rótulo de 1–2 renglones que se DECODIFICA letra por letra (ref. Parámetros: text*, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.arrow", "params": {"text": "AL DÍA\nSIGUIENTE"}}`
- **`pop.minimal`** — Texto mínimo y aireado sobre gris claro (ref. Parámetros: text*, kicker, style(spaced|small), accent, bg(paper|mint), fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.minimal", "params": {"kicker": "9 DE NOVIEMBRE", "text": "BERLÍN · 1989"}}`
- **`pop.title`** — Título de apertura en 3 tiempos como el comienzo de la referencia: marca del canal con círculo fino que se dibuja (+ kicker), objeto 3D con la foto que se parte en caleidoscopio (opcional, si hay `object`) y el TÍTULO en renglones apilados menta sobre la foto con cortina líquida, cruz y flecha (re-encuadre en `phase2`). Parámetros: text*, src*, kicker, mark, object, label, intro, objectDur, phase2, focus
  `{"use": "pop.title", "params": {"text": "LA NOCHE\nQUE CAYÓ\nEL MURO", "src": "assets/media/muro-gente.jpg", "kicker": "BERLÍN · 9 NOV 1989", "object": "assets/media/mauerspecht.jpg", "label": "/BERLÍN/1989"}}`
- **`pop.circles`** — Dos círculos con la MISMA foto en duotono que crecen desde 0 (el izquierdo primero) y una palabra violeta gigante encima cuya interletra se abre, con letras que faltan al entrar y una letra que parpadea rosa; barra menta, '× × ×' uno por uno y escuadra (ref. Parámetros: text*, src*, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.circles", "params": {"text": "ESTE", "src": "assets/media/leipzig.jpg"}}`
- **`pop.stripes`** — Caja de marco fino con la foto lavada y RAYAS diagonales violeta que entran gruesas y se afinan hasta pelos; palabra violeta con eco rosa desplazado (letras que faltan), '|||' antes, flechas ↑↓; todo el grupo se desliza a la izquierda (ref. Parámetros: text*, src*, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.stripes", "params": {"text": "LA NOTA", "src": "assets/media/nota.jpg"}}`
- **`pop.split`** — Tríptico (ref. Parámetros: text*, src*, src2, tag, outline, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.split", "params": {"text": "VOCERO", "src": "assets/media/schabowski.jpg", "tag": "GÜNTER SCHABOWSKI · SED"}}`
- **`pop.frame`** — Foto muy desenfocada que se enfoca; un marco paralelogramo menta GRUESO rota (−35°→0), crece y se afina hasta ser un marco rectangular fino con esquinas en triángulo; título menta con ecos en contorno que se abren a los lados (ref. Parámetros: text*, sub, src*, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.frame", "params": {"text": "BORNHOLMER STRASSE", "src": "assets/media/bornholmer.jpg", "sub": "PASO FRONTERIZO · BERLÍN"}}`
- **`pop.duo`** — Dos círculos-foto enormes en los bordes que crecen, flecha gruesa al centro, '×' rosa, flechitas, rótulo de 2 renglones y línea superior con texto mínimo (ref. Parámetros: src*, src2, text, kicker, focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.duo", "params": {"src": "assets/media/bornholmer.jpg", "src2": "assets/media/leipzig.jpg", "text": "MILES\nDE PERSONAS", "kicker": "9 NOV 1989 · 23:30"}}`
- **`pop.posters`** — Columnas verticales de foto (ref. Parámetros: src*, text, src2, text2, caption, p2, p3, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.posters", "params": {"src": "assets/media/muro-gente.jpg", "text": "BERLÍN", "src2": "assets/media/mauerspecht.jpg", "text2": "ESTE", "caption": "LAS DOS MITADES DE UNA CIUDAD"}}`
- **`pop.triangle`** — Un triángulo ◄ chico crece en 4 cuadros hasta un TRIÁNGULO grande con foto a la izquierda (ref. Parámetros: src*, src2, text, caption, tone(dark|normal|light|inv), focus, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.triangle", "params": {"src": "assets/media/schabowski.jpg", "src2": "assets/media/nota.jpg", "text": "PRENSA", "caption": "CONFERENCIA · 18:00"}}`
- **`pop.book`** — Libro 3D isométrico sobre menta apagada (ref. Parámetros: src*, title, note, swapAt, mark, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.book", "params": {"src": "assets/media/nota.jpg", "title": "LA NOTA\nDE SCHA-\nBOWSKI", "note": "9 NOV 1989 · 18:53"}}`
- **`pop.tiles`** — Marca menta grande sobre violeta (ref. Parámetros: mark, solo, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.tiles", "params": {"mark": ""}}`
- **`pop.name`** — Texto chico centrado sobre menta (ref. Parámetros: text*, sub, size, fx(cut|glitch|flicker|shards|liquid)
  `{"use": "pop.name", "params": {"text": "BERLÍN · 9.11.1989", "sub": ""}}`
- **`pop.glitch`** — Glitch de transición encima de cualquier plano (capa overlay): bloques desplazados sobre negro, parpadeo de paleta o esquirlas (ref. Parámetros: kind(glitch|flicker|shards|liquid)
  `{"use": "pop.glitch", "params": {"kind": "glitch"}}`
- **`pop.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, wordAt, stagger, glitchAt, bg(auto|columns|opart|shapes|kanji|tiles|image|component|none), src, focus, use, useParams, dim
  `{"use": "pop.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "glitchAt": 2.3}}`
- **`pop.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, bg(auto|columns|opart|shapes|kanji|tiles|image|component|none), src, focus, use, useParams, dim
  `{"use": "pop.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}`
- **`pop.outro`** — Cierre del canal SIN recuadro, en lenguaje DUOTONO (bg: tiles | columns | opart | shapes | kanji | image con src | component con use/useParams; por defecto mosaico de marcas del canal que se desliza). Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|tiles|columns|opart|shapes|kanji|image|component|none), src, focus, use, useParams, dim
  `{"use": "pop.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "DUOTONO", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@duotono"}}`

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
