# grunge · CRUDO — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de grunge

- **`grunge.word`** — LA escena del estilo: una palabra en tres cortes — primer plano gigante de sus primeras letras con texturas stop-motion → la palabra a todo el ancho (negativo volteado, golpe de zoom, se erosiona de izquierda a derecha) → fondo de color plano con suciedad de película, la palabra entra rasgada y se reacomoda, brochazo detrás, negativos y salpicaduras. Parámetros: text*, textPortrait, note, phases(auto|full|slam+brush|closeup+slam|closeup+brush|brush|slam|closeup), size, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.word", "params": {"text": "MURO", "note": "BERLÍN · 1961"}}`
- **`grunge.title`** — Título de apertura (o frase final): la escena completa de la referencia con sus tres fases siempre — primer plano gigante, palabra a todo el ancho con negativo y erosión, brochazo con rótulo chico. Parámetros: text*, textPortrait, note, phases(full|slam+brush|closeup+brush), size, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.title", "params": {"text": "9 NOV\n1989", "note": "LA NOCHE QUE CAYÓ EL MURO"}}`
- **`grunge.closeup`** — Solo la fase A: primer plano GIGANTE de las primeras letras, que se materializan por salpicaduras y cambian de textura en stop-motion (negativo, rayado, doble exposición hacia las letras siguientes). Parámetros: text*, textPortrait, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.closeup", "params": {"text": "HORMIGÓN"}}`
- **`grunge.slam`** — Solo la fase B: la palabra a todo el ancho sobre fondo plano, negativo volteado, golpe de zoom 1,3× y erosión de izquierda a derecha que deja la última letra. Parámetros: text*, textPortrait, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.slam", "params": {"text": "HORMIGÓN"}}`
- **`grunge.brush`** — Solo la fase C: fondo de color con suciedad de película; la palabra entra rasgada en franjas que se reacomodan, brochazo ancho detrás, negativos cortos y salpicaduras al final. Parámetros: text*, textPortrait, note, size, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.brush", "params": {"text": "HORMIGÓN"}}`
- **`grunge.flip`** — Golpe de negativo de 2–5 cuadros sobre el plano actual (fondo ↔ tinta), opcionalmente espejado/volteado o con zoom 1,3× — el 'flash' de esta familia. Parámetros: mode(neg|negx|negy|zoom), zoom
  `{"use": "grunge.flip", "params": {"mode": "negy", "zoom": 1}}`
- **`grunge.photo`** — Foto real en duotono (negro cálido → color plano de la escena) con el mismo lenguaje de cortes de la palabra: primer plano 2,4× que se materializa por salpicaduras y cambia de textura en stop-motion → foto a pantalla completa con negativo volteado, golpe de zoom y erosión → la foto pintada dentro de un brochazo ancho con el título rasgado arriba y salpicaduras. Parámetros: src*, title, note, focus, zoom, phases(auto|full|slam+brush|closeup+slam|closeup+brush|brush|slam|closeup), color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.photo", "params": {"src": "assets/media/mauerbau.jpg", "title": "AGOSTO 1961", "focus": [0.5, 0.45]}}`
- **`grunge.stamp`** — Frase narrada en cortes secos: cada palabra que dice la voz dentro del beat aparece SOLA a todo el ancho (como la palabra entera de la referencia), con texturas de tinta y fondo que alterna casi negro / color plano; las palabras de `accent` llevan brochazo detrás y golpe de negativo; la última se erosiona al salir. Parámetros: accent, skip, color, polarity(auto|dark|light), flip(auto|none|x|y)
  `{"use": "grunge.stamp", "params": {"accent": ["inmediato"]}}`
- **`grunge.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, color, wordAt, stagger, inkAt, bg(auto|roller|posters|film|splatter|image|component|none), src, focus, use, useParams, dim
  `{"use": "grunge.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "inkAt": 2.3}}`
- **`grunge.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, color, bg(auto|roller|posters|film|splatter|image|component|none), src, focus, use, useParams, dim
  `{"use": "grunge.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}`
- **`grunge.outro`** — Cierre del canal SIN recuadro (bg: posters | roller | film | splatter | image con src en duotono | component con use/useParams). Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, color, bg(auto|roller|posters|film|splatter|image|component|none), src, focus, use, useParams, dim
  `{"use": "grunge.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el video.", "handle": "youtube.com/@nodetech"}}`

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
