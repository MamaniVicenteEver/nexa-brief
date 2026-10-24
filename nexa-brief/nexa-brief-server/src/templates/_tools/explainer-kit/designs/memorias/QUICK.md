# memorias · MEMORIAS — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de memorias

- **`memorias.title`** — Portada 'Historical Memories': título manuscrito grande (Mr Dafoe) que se escribe de izquierda a derecha + subtítulo en Quicksand, sobre papel de yeso con humo gris; bocetos a lápiz de una o dos fotos en las esquinas (layout center) o un boceto grande a un costado con el texto arriba a la izquierda (layout side). Parámetros: title*, sub, src, src2, layout(center|side), focus, focus2, titlePortrait
  `{"use": "memorias.title", "params": {"title": "La noche del Muro", "sub": "Berlín · 9 de noviembre de 1989", "src": "assets/media/brandenburgo.jpg", "src2": "assets/media/bernauer.jpg", "layout": "center"}}`
- **`memorias.scene`** — El plano de la referencia: la foto aparece primero como BOCETO A LÁPIZ sobre el papel, después se colorea por manchas de tinta (reveal: full/right/left/center/bottom; lo demás queda en boceto), revienta una salpicadura de acuarela azul con gotas (negra con tone=bw) y aparece el bloque de texto: renglón manuscrito (kicker) + renglones en MAYÚSCULAS que se arman letra a letra (text, '\n' = renglón). Parámetros: src*, kicker, text, kicker2, pos(bl|tl|tr|br), tone(color|bw), reveal(full|right|left|center|bottom|none), splash(auto|none|tl|tr|t|l|r|c|bl|br), splashSize, splashColor, focus, ghost, drift, cut(auto|wash|whip)
  `{"use": "memorias.scene", "params": {"src": "assets/media/brandenburgo.jpg", "kicker": "Berlín, 1989", "text": "Puerta de Brandeburgo\nEl muro pasaba detrás", "pos": "bl", "reveal": "right", "splash": "auto"}}`
- **`memorias.introv1`** — Gancho 'golpe': titular MANUSCRITO gigante (Mr Dafoe) que se escribe palabra a palabra sobre el papel, con rótulo en MAYÚSCULAS que se arma letra a letra arriba y subtítulo en Quicksand abajo; en dropAt revienta una salpicadura de acuarela azul detrás del titular con gotas y una sacudida, y la palabra ^marcada^ se tiñe de azul. Parámetros: text*, kicker, sub, wordAt, stagger, dropAt, bg(auto|sketch|smoke|image|component|none), src, focus, use, useParams, dim
  `{"use": "memorias.introv1", "params": {"text": "La noche que\ncayó el ^Muro^", "kicker": "Berlín · 1989", "sub": "nadie dio la orden", "src": "assets/media/brandenburgo.jpg"}}`
- **`memorias.introv2`** — Gancho 'pregunta + revelación': la pregunta en MAYÚSCULAS (Barlow 700) se arma letra a letra con glifos que parpadean; en stampAt la respuesta se escribe en manuscrita grande sobre una salpicadura de acuarela azul que revienta con gotas. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, bg(auto|sketch|smoke|image|component|none), src, focus, use, useParams, dim
  `{"use": "memorias.introv2", "params": {"text": "¿Quién abrió\nel muro?", "kicker": "Berlín, 1989", "stamp": "Nadie dio la orden", "src": "assets/media/bernauer.jpg"}}`
- **`memorias.outro`** — Cierre del canal como la tarjeta final de la referencia: una mancha de tinta NEGRA crece desde abajo a la izquierda y traga el cuadro (bg ink; paper = sobre el papel con texto oscuro; image/component/none = contrato común) → 'gracias por ver' en sans fina → nombre del canal en manuscrita grande que se escribe → pulgar LIKE a trazo que se rellena con gotas azules → flecha fina → SUSCRÍBETE armado letra a letra + campana que suena → mensaje de apoyo → dirección en mayúsculas chiquitas. Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|ink|paper|image|component|none), src, focus, use, useParams, dim
  `{"use": "memorias.outro", "params": {"thanks": "gracias por ver", "channel": "Memorias", "cta": "Suscríbete", "support": "Apoya el canal y comparte la historia", "handle": "youtube.com/@nodehistory"}}`

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
