# dinero · NODECONOMY — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de dinero

- **`dinero.serif`** — Palabra GIGANTE en didona condensada verde oscuro sobre pared gris verdosa (ref. Parámetros: text*, textPortrait, src, src2, reveal, pull, focus, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.serif", "params": {"text": "DINERO", "src": "../designs/dinero/samples/billete100.jpg"}}`
- **`dinero.title`** — Título de apertura (t = 0) con el plano 1 de la referencia: el TÍTULO en didona condensada gigante verde oscuro, letra por letra con la cámara siguiéndolas, foto que entra desde la izquierda, alejamiento brusco y rótulo fino (kicker) que se escribe debajo. Parámetros: text*, textPortrait, src, src2, reveal, pull, focus, kicker, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.title", "params": {"text": "EL PRECIO\nDE UNA IDEA", "kicker": "DARTMOUTH · 1956", "src": "../designs/dinero/samples/contando.jpg"}}`
- **`dinero.cash`** — Ráfaga de fotos de billetes en teal frío (ref. Parámetros: src1*, src2, src3, pace, focus, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.cash", "params": {"src1": "../designs/dinero/samples/billete100.jpg", "src2": "../designs/dinero/samples/abanico.jpg", "src3": "../designs/dinero/samples/dolar1957.jpg"}}`
- **`dinero.count`** — Foto en teal frío con empuje y paneo lentos y luz cálida en la esquina (ref. Parámetros: src*, text*, sub, cps, focus, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.count", "params": {"src": "../designs/dinero/samples/abanico.jpg", "text": "13.500 DÓLARES", "sub": "pidieron"}}`
- **`dinero.neon`** — Palabra en MAYÚSCULAS finas blancas con brillo y sombra larga sobre fieltro verde con viñeta (ref. Parámetros: text*, sub, subAt, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.neon", "params": {"text": "PRESUPUESTO", "sub": "la apuesta"}}`
- **`dinero.spin`** — Palabras 3D que GIRAN con desenfoque de movimiento sobre gris claro con viñeta mientras caen monedas doradas (ref. Parámetros: words, accent, lensAt, coins, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.spin", "params": {"words": ["Dinero", "^sucio^", "lo quiero", "^YA^"]}}`
- **`dinero.block`** — Frase en BLOQUE gigante Open Sans 800 verde oscuro sobre salvia (ref. Parámetros: text*, pole, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.block", "params": {"text": "EL DINERO\nMANDA"}}`
- **`dinero.head`** — Ilustración plana sobre verde salvia (ref. Parámetros: word, text*, sub, chips, split, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.head", "params": {"word": "IDEA", "text": "INTENTA HASTA LOGRARLO", "sub": "LA APUESTA DE DARTMOUTH", "chips": ["1956", "10", "2 MESES", "IA"]}}`
- **`dinero.note`** — Texto MÍNIMO en Open Sans 800 sobre blanco, negro o salvia (ref. Parámetros: text*, bg(white|black|sage), size, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.note", "params": {"text": "¿Y AHORA?", "bg": "black"}}`
- **`dinero.pin`** — Sobre negro verdoso, un ALFILER-PERSONA verde (cono con cabeza) sube desde abajo con un anillo blanco alrededor de la cabeza; a mitad del plano la cámara se aleja de golpe y el anillo se cierra sobre la cabeza; el rótulo se tipea al lado (ref. Parámetros: label, zoomAt, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.pin", "params": {"label": "UNO SOLO"}}`
- **`dinero.outline`** — La frase NARRADA sobre negro verdoso (ref. Parámetros: words, accent, ghost, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.outline", "params": {"words": ["el", "dinero", "se", "^congeló^"]}}`
- **`dinero.eye`** — OJO gigante plano (almendra blanca con borde verde e iris verde) sobre negro verdoso (ref. Parámetros: text*, split, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.eye", "params": {"text": "TODOS\nMIRABAN"}}`
- **`dinero.eyes`** — OJOS de dibujo animado (esferas blancas con pupila) de distintos tamaños que aparecen, flotan y miran para todos lados sobre negro verdoso, con un texto corto verde al centro (ref. Parámetros: text, count, fx(cut|whip|blob|leak|pixel|scan|zoom|flash)
  `{"use": "dinero.eyes", "params": {"text": "TODOS\nQUIEREN"}}`
- **`dinero.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, wordAt, stagger, glitchAt, bg(auto|paper|felt|sage|black|fog|image|component|none), src, focus, use, useParams, dim
  `{"use": "dinero.introv1", "params": {"text": "¿QUIÉN PAGA\nLA ^CUENTA^?", "kicker": "Economía · 2026", "sub": "nadie lo dice en voz alta", "glitchAt": 2.2}}`
- **`dinero.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, bg(auto|paper|felt|sage|black|fog|image|component|none), src, focus, use, useParams, dim
  `{"use": "dinero.introv2", "params": {"text": "¿CUÁNTO VALE\nUNA IDEA?", "kicker": "Dartmouth · 1956", "stamp": "7.500 DÓLARES", "stampAt": 2.4}}`
- **`dinero.outro`** — Cierre del canal SIN recuadro en lenguaje NODECONOMY (bg: black | paper | felt | sage | fog | image con src | component con use/useParams; por defecto negro verdoso con rayos verdes): GRACIAS POR VER fina que se decodifica → nombre del canal GIGANTE con contorno fantasma detrás y relleno blanco que se tipea → botón LIKE verde que se presiona y suelta chispas (dos ojos lo miran) → flecha fina con punta brillante → SUSCRÍBETE en billete verde que golpea + campana que suena → apoyo → youtube.com/@canal. Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|paper|felt|sage|black|fog|image|component|none), src, focus, use, useParams, dim
  `{"use": "dinero.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODECONOMY", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el video.", "handle": "youtube.com/@nodeconomy"}}`

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
