# periodico · TITULARES — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de periodico

- **`periodico.title`** — Apertura sobre el periódico: negro → papel desenfocado → rack focus y la cámara se aleja de un título ENORME cuyas letras se aleatorizan hasta asentarse (typewriter), con subtítulo chico, icono ⊠, columna de texto al costado y recuadro negro cortado. Parámetros: title*, titlePortrait, sub, aside, box, move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.title", "params": {"title": "LA NOCHE QUE CAYÓ EL MURO", "sub": "Berlín · 9 nov 1989"}}`
- **`periodico.headline`** — Título typewriter sobre el papel, sin foto. Parámetros: title*, sub, style(plain|bracket|corner), year, icon, move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.headline", "params": {"title": "Un papel", "sub": "leído en voz alta", "style": "bracket"}}`
- **`periodico.article`** — Artículo: título typewriter con scramble + regla negra gruesa que se traza + párrafo que se escribe letra a letra ('Exclusive' de la referencia). Parámetros: title*, sub, body, size(normal|big), src, icon, move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.article", "params": {"title": "28 años", "sub": "una ciudad partida en dos", "body": "Berlín estuvo partida en dos. Una frontera de hormigón cruzaba calles, plazas y familias."}}`
- **`periodico.photo`** — Foto B/N con marco negro fino (borde de foto impresa) y sombra, apoyada en el periódico, con título typewriter + barra negra con subtítulo blanco ('Stylish / headlines'). Parámetros: src*, title, sub, layout(left|right|topright|topleft|bottomright|bottomleft), year, icon, ar, size, focus, move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.photo", "params": {"src": "assets/media/mauerbau.jpg", "title": "Agosto", "sub": "se levanta el muro", "layout": "topright", "year": "1961"}}`
- **`periodico.collage`** — Varias fotos y recortes de periódico en capas a distinta profundidad (paralaje y desenfoque) con rótulo de barra negra. Parámetros: src*, src2, src3, title, sub, note, layout(history|modular|plugins), move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.collage", "params": {"src": "assets/media/muro-gente.jpg", "src2": "assets/media/leipzig.jpg", "title": "Miles", "sub": "salieron a la calle", "layout": "history"}}`
- **`periodico.quote`** — La frase narrada en typewriter grande sobre el papel: cada palabra aparece cuando la voz la dice, con sus letras aleatorizándose hasta asentarse; las palabras de `accent` van en blanco sobre barra negra (como los subtítulos de la referencia). Parámetros: accent, maxChars, move(auto|whip|glide|cut|intro), dir(auto|up|down|left|right|upleft|upright|downleft|downright)
  `{"use": "periodico.quote", "params": {"accent": ["inmediato"]}}`
- **`periodico.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, extra, extraAt, wordAt, stagger, bg(auto|press|spin|desk|stand|image|component|none), src, focus, use, useParams, dim
  `{"use": "periodico.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "extraAt": 2.3}}`
- **`periodico.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, extra, bg(auto|spin|press|desk|stand|image|component|none), src, focus, use, useParams, dim
  `{"use": "periodico.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}`
- **`periodico.outro`** — Cierre del canal SIN recuadro (bg: stand | desk | press | spin | image con src | component con use/useParams | none): por defecto la cámara llega con un latigazo a una pared de PORTADAS de diario que se desliza. Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|stand|desk|press|spin|image|component|none), src, focus, use, useParams, dim
  `{"use": "periodico.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@nodetech"}}`

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
