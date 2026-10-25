# acuarela · TINTA — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de acuarela

- **`acuarela.title`** — Apertura 'THE HISTORY': título condensado en rojo ladrillo con rayas finas a ambos lados y subtítulo, sobre una gran mancha de acuarela que es una foto lavada (florece desde varios focos) y bloques manuscritos. Parámetros: title*, sub, bg, focus, titlePortrait
  `{"use": "acuarela.title", "params": {"title": "La noche que cayó el muro", "sub": "Berlín · 9 de noviembre de 1989", "bg": "assets/media/muro-gente.jpg"}}`
- **`acuarela.photo`** — Una foto de archivo con marco (estampilla o copia vieja) que entra deslizándose y se asienta, mancha-foto que florece detrás, fecha grande con raya fina y párrafo corto que aparecen por tinta. Parámetros: src*, date, text, layout(top|right|left), bg, frame(stamp|deckle), enter(auto|down|up|left|right|zoom|tilt|shrink|none), focus, bgFocus
  `{"use": "acuarela.photo", "params": {"src": "assets/media/mauerbau.jpg", "date": "Agosto de 1961", "text": "En una sola noche, soldados y obreros levantan alambre y bloques en medio de Berlín.", "layout": "top", "bg": "assets/media/leipzig.jpg"}}`
- **`acuarela.pair`** — Dos fotos superpuestas (la segunda tapa el borde de la primera y llega un instante después) + fecha y párrafo; mancha-foto y manuscrito detrás. Parámetros: a*, b*, date, text, date2, text2, layout(above|right|below|center|dual), bg, frameA(stamp|deckle), frameB(stamp|deckle), enter(auto|down|up|left|right|zoom|tilt|shrink|none), focusA, focusB, bgFocus
  `{"use": "acuarela.pair", "params": {"a": "assets/media/bornholmer.jpg", "b": "assets/media/muro-gente.jpg", "date": "9 de noviembre", "text": "Miles de personas llegan a los pasos fronterizos.", "layout": "right"}}`
- **`acuarela.quote`** — Retrato vertical (copia vieja) que entra desde la izquierda achicándose, cita en sans condensada a su derecha que aparece por manchas, firma en rojo ladrillo y una 'isla' de mancha-foto detrás. Parámetros: src*, quote*, name, bg, focus, bgFocus, frame(stamp|deckle)
  `{"use": "acuarela.quote", "params": {"src": "assets/media/schabowski.jpg", "quote": "Eso entra en vigor, según mi información, de inmediato, sin demora.", "name": "Günter Schabowski", "bg": "assets/media/bornholmer.jpg"}}`
- **`acuarela.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, wordAt, stagger, dropAt, bg(auto|blots|wash|timeline|manuscript|image|component|none), src, focus, use, useParams, dim, blot
  `{"use": "acuarela.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "dropAt": 2.3}}`
- **`acuarela.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, bg(auto|blots|wash|timeline|manuscript|image|component|none), src, focus, use, useParams, dim, blot
  `{"use": "acuarela.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}`
- **`acuarela.outro`** — Cierre del canal SIN recuadro (bg: wash | blots | timeline | manuscript | image con src | component con use/useParams): por defecto papel con una aguada sepia que barre y pinceladas que chorrean. Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|wash|blots|timeline|manuscript|image|component|none), src, focus, use, useParams, dim, blot
  `{"use": "acuarela.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más historias.", "handle": "youtube.com/@nodetech"}}`

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
- **`common.clip`** — Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Parámetros: src*, start, rate, layout(auto|full|frame), size, ar, focus, zoom, tone(design|color), dim, caption, sub
  `{"use": "common.clip", "params": {"src": "assets/media/servidores.mp4", "caption": "Un centro de datos", "sub": "PEXELS · 2026"}}`
