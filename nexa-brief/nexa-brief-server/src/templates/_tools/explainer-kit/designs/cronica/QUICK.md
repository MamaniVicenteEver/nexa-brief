# cronica · CRÓNICA — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de cronica

- **`cronica.slide`** — Diapositiva de archivo en 3D (la escena principal de la referencia): foto B/N con borde de pincel rasgado que se pinta a trazos, año o dato corto en un rótulo gris pincelado y párrafo serif blanco, rodeados de capas tenues (fotos fantasma, letra gigante, bloquecitos con barra, líneas con nodos). Parámetros: src*, year, text, layout(right|left|top|center|split), italic, align(left|justify), focus, zoom, mirror, reframe, letter
  `{"use": "cronica.slide", "params": {"src": "assets/media/leipzig.jpg", "year": "1989", "text": "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", "layout": "right"}}`
- **`cronica.quote`** — Cita en itálica (la escena '1942' de la referencia): año en itálica en su rótulo, párrafo itálico justificado al centro, un retrato grande y tenue a la izquierda (más cerca de cámara, desenfocado) y otra foto rasgada a la derecha. Parámetros: src*, side, year, text*, focus, sideFocus, mirror, reframe
  `{"use": "cronica.quote", "params": {"side": "assets/media/schabowski.jpg", "src": "assets/media/bornholmer.jpg", "year": "1989", "text": "Nadie le advirtió que debía esperar hasta la mañana."}}`
- **`cronica.verse`** — Frase narrada en grande con la tipografía de los párrafos de la referencia: cada palabra se enfoca (desenfoque → nítido) en el instante en que la voz la dice, sobre el decorado en capas (fotos fantasma, letra gigante, líneas). Parámetros: kicker, accent, src, size, mirror
  `{"use": "cronica.verse", "params": {"kicker": "LA PREGUNTA", "accent": ["vigor"]}}`
- **`cronica.title`** — Tarjeta de título (como 'ENVATO PRESENTS' de la referencia): mayúsculas serif espaciadas al centro, que aparecen letra a letra desde el desenfoque mientras la cámara hace rack focus; detrás, dos fotos tenues rasgadas a distinta profundidad, líneas finas con nodos y bloquecitos de texto. Parámetros: text*, kicker, src, src2, hideCaptions
  `{"use": "cronica.title", "params": {"text": "La noche que cayó el muro", "kicker": "Berlín · 9 de noviembre de 1989"}}`
- **`cronica.introv1`** — GANCHO de apertura en el espacio 3D de la crónica. Parámetros: text*, kicker, sub, wordAt, stagger, cutAt, letters, era, bg(auto|archivo|linea|letras|proyector|image|component|none), src, focus, use, useParams, dim
  `{"use": "cronica.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 de noviembre de 1989", "sub": "y nadie dio la orden", "cutAt": 2.3}}`
- **`cronica.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, era, bg(auto|archivo|linea|letras|proyector|image|component|none), src, focus, use, useParams, dim
  `{"use": "cronica.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}`
- **`cronica.outro`** — Cierre del canal SIN recuadro en el espacio 3D de la crónica (bg: proyector | archivo | letras | linea | image con src | component con use/useParams | none). Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|proyector|archivo|letras|linea|image|component|none), src, focus, use, useParams, dim, era
  `{"use": "cronica.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "CRÓNICA", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir contando historias.", "handle": "youtube.com/@cronica"}}`

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
