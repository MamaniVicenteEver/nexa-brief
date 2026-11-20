# titanes · TITANES — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

Al cerrar el video es obligatorio ejecutar `kit.py licencias <video-id>`, revisar `LICENCIAS.md` y copiar sus créditos en la descripción. Regenerar tras cambios de montaje. Ver `guides/publish-package.md`.

## Componentes de titanes

- **`titanes.escenario`** — Siete escenarios con profundidad, luz, grano y paralaje determinista. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, escenario(foco|horizonte|ciudad|sala|rayos|mercado|archivo)
  `{"use": "titanes.escenario", "params": {"escenario": "foco"}}`
- **`titanes.introv1`** — Título monumental de 2–4 palabras, kicker y protagonista ilustrado a contraluz. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, figura, escalaFigura, text, kicker, contexto, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna)
  `{"use": "titanes.introv1", "params": {"text": "EL PRECIO\nDEL PODER", "kicker": "IBM", "figura": "http://127.0.0.1:40961/_tools/explainer-kit/designs/titanes/samples/de-pie.png", "bg": "foco"}}`
- **`titanes.introv2`** — Pregunta que abre el conflicto y revelación por barrido de luz. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, figura, escalaFigura, text, kicker, contexto, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), pregunta, revelarEn
  `{"use": "titanes.introv2", "params": {"pregunta": "¿QUIÉN\nMANDA?", "text": "EL PODER\nCAMBIA", "kicker": "IBM", "figura": "http://127.0.0.1:40961/_tools/explainer-kit/designs/titanes/samples/encoge.png", "bg": "horizonte", "revelarEn": 1.8}}`
- **`titanes.outro`** — Cierre común: gracias, canal, LIKE, flecha, suscripción, campana, apoyo y dirección. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, like, salida(tinta|luz|golpe|ninguna)
  `{"use": "titanes.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "TITANES", "cta": "SUSCRÍBETE", "support": "Comparte estas historias.", "handle": "", "bg": "rayos"}}`
- **`titanes.capitulo`** — Número monumental en segundo plano, título y protagonista en escenario. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, figura, escalaFigura, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), numero, titulo, kicker, contexto
  `{"use": "titanes.capitulo", "params": {"numero": "03", "titulo": "EL TRONO", "kicker": "IBM", "contexto": "", "figura": "http://127.0.0.1:40961/_tools/explainer-kit/designs/titanes/samples/brazos-arriba.png", "bg": "ciudad"}}`
- **`titanes.cifra`** — Cifra monumental con tic mecánico, signo semántico, comparación y hasta tres cifras secuenciales. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, valor, prefijo, sufijo, contexto, fecha, decimales, modo(simple|comparacion|secuencia), antes, cambioEn, tachado, cifras, contarEn
  `{"use": "titanes.cifra", "params": {"valor": -8100, "sufijo": "M", "prefijo": "US$", "contexto": "PÉRDIDAS", "fecha": "1993", "bg": "mercado"}}`
- **`titanes.bolsa`** — Serie de neón con años, valores y eventos. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, serie, modo(linea|caida|electrocardiograma|barras), eventos, unidad, decimales, dibujarEn, caidaIndice, caidaEn, pulso, plano
  `{"use": "titanes.bolsa", "params": {"titulo": "LA CAÍDA", "modo": "caida", "serie": [{"ano": "1987", "valor": 175.88}, {"ano": "1993", "valor": 40.63}], "caidaIndice": 0, "decimales": 2, "unidad": "US$", "eventos": [{"indice": 0, "texto": "CUMBRE"}], "bg": "mercado"}}`
- **`titanes.escala`** — Compara entidades mediante edificios, monedas, tarjetas o ilustraciones por imagen. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, entidades, forma(edificio|moneda|tarjeta|figura), proporcion(area|altura), figura, unidad, decimales
  `{"use": "titanes.escala", "params": {"titulo": "CAPITAL", "entidades": [{"nombre": "MATRIZ", "valor": 100}, {"nombre": "FILIAL", "valor": 10}], "unidad": "M", "forma": "edificio", "bg": "ciudad"}}`
- **`titanes.plantilla`** — Cuadrícula de ilustraciones que crece y se vacía en sangre. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, total, desde, hasta, porFigura, crecerEn, vaciarEn, vaciadoDur, abreviar, fecha, equivalencia, figura
  `{"use": "titanes.plantilla", "params": {"titulo": "PERSONAS", "total": 405000, "hasta": 220000, "porFigura": 15000, "figura": "http://127.0.0.1:40961/_tools/explainer-kit/designs/titanes/samples/de-pie.png", "bg": "ciudad"}}`
- **`titanes.duelo`** — Dos o tres nombres monumentales en planos enfrentados, métricas opcionales y resolución con ganador. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, lados, ganador, ganadorEn, veredicto
  `{"use": "titanes.duelo", "params": {"lados": [{"nombre": "OS/2"}, {"nombre": "WINDOWS"}], "ganador": "WINDOWS", "ganadorEn": 3.2, "bg": "sala"}}`
- **`titanes.cronologia`** — Una era ocupa el cuadro. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, eras
  `{"use": "titanes.cronologia", "params": {"eras": [{"ano": "1964", "titulo": "SYSTEM/360"}, {"ano": "1981", "titulo": "EL PC"}, {"ano": "1993", "titulo": "LA CRISIS"}], "bg": "archivo"}}`
- **`titanes.titular`** — Documento propio con sello y referencia, cita atribuida, cartel de una palabra o titular editorial compuesto. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, variante(documento|cita|cartel|titular), text, autor, fecha, sello, referencia, antetitulo
  `{"use": "titanes.titular", "params": {"variante": "documento", "text": "CORTE SUPREMA", "fecha": "1936", "sello": "ARCHIVO", "referencia": "EE. UU.", "bg": "archivo"}}`
- **`titanes.foto`** — Foto o clip mudo en duotono con grano, marco iluminado, foco configurable y movimiento lento. Parámetros: acento, borde, intensidad, semilla, bg(auto|foco|horizonte|ciudad|sala|rayos|mercado|archivo|image|component|none), src, focus, use, useParams, dim, entrada(tinta|luz|golpe|ninguna), salida(tinta|luz|golpe|ninguna), titulo, fuente, tipo(auto|imagen|video), poster, desplazar, zoom, start, rate, loop, credito, sinMedio
  `{"use": "titanes.foto", "params": {"src": "http://127.0.0.1:40961/_tools/explainer-kit/designs/titanes/samples/nasa-ames.jpg", "titulo": "NASA AMES", "credito": "NASA · 1963 · dominio público", "focus": [0.65, 0.48], "bg": "foco"}}`

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
- **`common.clip`** — Video mudo a pantalla completa con texto grande y acento del diseño, o dentro de un marco. Parámetros: src*, start, rate, loop, layout(auto|full|frame), size, ar, focus, zoom, tone(design|color), dim, caption, sub, textColor(ink|accent|mix), accentWords, textSide(left|right|bottom), textIn(slide|fade|none), logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "common.clip", "params": {"src": "assets/media/servidores.mp4", "layout": "full", "caption": "Una ^conversación^ digital", "textColor": "mix", "textSide": "left", "sub": "Una historia real"}}`
- **`common.tabloid`** — Miniatura e intro tabloide con foto o video mudo; focus protege la zona de interés del medio. Parámetros: text*, src, srcAfter, video, poster, start, rate, loop, muted, accent, bullet, bulletScale, beforeLabel, afterLabel, imageSide(auto|left|right), mode(impact|split), palette(brand|alert), strap, seal, tapeText, marker, focus, target, textIn(slam|slide|typewriter|none), stagger, accentIn(slam|slide|typewriter|none), bulletIn(slam|slide|typewriter|none), inDuration, logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "common.tabloid", "params": {"text": "TÚ ERES EL SIGUIENTE", "accent": "SIGUIENTE", "strap": "AMAZON · IA"}}`
- **`common.question`** — Tarjeta grande para la pregunta final del video; ocupa el acto completo y se adapta a 9:16 y 16:9. Parámetros: text*, y
  `{"use": "common.question", "params": {"text": "¿La IA te quita trabajo?"}}`
- **`common.capas`** — Escena de la biblioteca compartida: personajes, poses, zonas teñidas, conexiones y cámara. Parámetros: fondo, camara, elenco*, conexiones, eventos, textos, formato
  `{"use": "common.capas", "params": {"fondo": {"preset": "foco", "color": "#0B1220", "acento": "#1F6BFF", "grano": 0.15}, "camara": {"mov": "acercar", "intensidad": 0.04}, "elenco": [], "textos": [{"texto": "BIBLIOTECA DE CAPAS", "pos": "arriba", "estilo": "titulo"}]}}`

## Marcas e instituciones

El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. Usá `logo`, `logoName`, `logoPos` y `logoSize` en el beat visual (`rough.photo`, `binary.frame`, `common.clip`, `rough.introv2`, `binary.introv2` o `common.tabloid`). `common.logo` está obsoleto. Preferí SVG; el PNG debe ser transparente.

## Apoyos visuales preferidos (política v5)

Repartí por todo el video y sin orden fijo: (1) miniatura `rough.introv2` o `binary.introv2` con foto/video y texto grande, (2) `common.clip` con `layout: full` y `caption` grande (`textColor: ink|accent|mix`, `accentWords`, `textSide: left|right|bottom`, `textIn`, `sub` y `logo` opcionales), (3) foto en cuadro como tercera opción. Cada apoyo muestra la frase narrada. Imagen visible 5–10 s; video 8–16 s; cada archivo como máximo dos usos. Cada tercio necesita una miniatura o un video completo. Consultá `kit.py library` antes de crear componentes propios.

`{"use":"common.clip","dur":12,"params":{"src":"assets/media/archivo.mp4","layout":"full","caption":"Una ^conversación^ digital","textColor":"mix","textSide":"left","textIn":"slide"}}`
