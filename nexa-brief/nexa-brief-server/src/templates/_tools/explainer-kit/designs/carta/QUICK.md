# carta · CARTA — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de carta

- **`carta.retrato`** — Retrato con borde de pincel a la izquierda; a la derecha rótulo en caja crema, sello de correo, fechas, título enorme con regla y subtítulo; la foto se repite fantasma detrás de los textos (panel 'THE BEST WISHES / HISTORICAL'). Parámetros: src*, label, stamp, years, title, sub, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.retrato", "params": {"src": "assets/media/mauerbau.jpg", "label": "VOCERO DEL PARTIDO", "stamp": "ARCHIVO|1989|BERLÍN", "years": "9 - 11 - 1989", "title": "SCHABOWSKI", "sub": "GÜNTER"}}`
- **`carta.sello`** — Variante del retrato: foto a la izquierda, rótulo en caja, sello, título grande al centro-derecha, fechas, regla y subtítulo grueso debajo (panel 'PHOTOGRAPHY 1945-1948 HISTORICAL'). Parámetros: src*, label, stamp, title, years, sub, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.sello", "params": {"src": "assets/media/mauerbau.jpg", "label": "LA NOTA", "stamp": "ARCHIVO|1989|BERLÍN", "title": "INMEDIATO", "years": "9 - 11 - 1989", "sub": "SIN DEMORA"}}`
- **`carta.postal`** — Postal de un lugar: rótulo y fechas arriba a la izquierda, caja de texto tipeado con doble borde, foto ancha a la derecha, título gigante abajo con segundo renglón corrido y regla (panel 'VENEZIA / ITALY'). Parámetros: src*, label, years, body, title, sub, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.postal", "params": {"src": "assets/media/mauerbau.jpg", "label": "AGOSTO DE 1961", "years": "1961 - 1989", "body": "De un día para otro el gobierno del Este levantó un muro de hormigón y alambre en medio de la ciudad.", "title": "BERLÍN", "sub": "ALEMANIA"}}`
- **`carta.familia`** — Foto de grupo abajo a la izquierda; arriba rótulo, firma manuscrita y caja de texto; a la derecha fechas y título de dos renglones alineado a la derecha (panel 'MY FAMILY / LOVELY'). Parámetros: src*, label, sign, body, years, title, sub, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.familia", "params": {"src": "assets/media/mauerbau.jpg", "label": "FAMILIAS SEPARADAS", "sign": "Elsa", "body": "Una calle bastaba para no volver a verse.", "years": "1961 - 1989", "title": "VECINOS", "sub": "SEPARADOS"}}`
- **`carta.memoria`** — Foto a la izquierda; rótulo en caja crema a la derecha, fechas, título grande que pisa la foto y subtítulo corto con firma (panel 'OUR HISTORY / DO NOT FORGET / ABOUT IT'). Parámetros: src*, label, years, title, sub, sign, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.memoria", "params": {"src": "assets/media/mauerbau.jpg", "label": "AL MENOS 140", "years": "1961 - 1989", "title": "NO OLVIDAR", "sub": "A LOS QUE CAYERON", "sign": "Berlín"}}`
- **`carta.recuerdo`** — Dos rótulos grandes apilados a la izquierda entre reglas, fechas, foto a la derecha y título grueso abajo a la derecha (panel 'OUR HISTORY / FAST RENDERING / ABOUT IT'). Parámetros: src*, label, label2, years, title, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.recuerdo", "params": {"src": "assets/media/mauerbau.jpg", "label": "OTOÑO", "label2": "DE 1989", "years": "1989", "title": "ALGO SE ROMPE"}}`
- **`carta.album`** — Foto grande a la izquierda; arriba a la derecha fechas, caja de texto tipeado y título de dos tamaños abajo a la derecha (panel '1950-1968 / MY LIFE / MY FAMILY'). Parámetros: src*, years, body, title, sub, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.album", "params": {"src": "assets/media/mauerbau.jpg", "years": "1989", "body": "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", "title": "LEIPZIG", "sub": "LOS LUNES"}}`
- **`carta.nota`** — Rótulo en caja arriba a la izquierda, caja de texto debajo, título grande con regla, fechas y foto vertical a la derecha (panel 'EASY TO EDIT / HISTORICAL / 1945-1948'). Parámetros: src*, label, body, title, years, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.nota", "params": {"src": "assets/media/mauerbau.jpg", "label": "NUEVA REGLA", "body": "Los ciudadanos podrían pedir permiso para viajar al Oeste.", "title": "PERMISO", "years": "10 - 11 - 1989"}}`
- **`carta.ficha`** — Ficha de persona: retrato a la izquierda; a la derecha título, subtítulo y fechas apilados a la derecha, caja de texto y regla (panel 'HISTORICAL / MAYR KETMAN / 1945-1948'). Parámetros: src*, title, sub, years, body, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.ficha", "params": {"src": "assets/media/mauerbau.jpg", "title": "HARALD JÄGER", "sub": "OFICIAL DE FRONTERA", "years": "9 - 11 - 1989", "body": "Tenía una multitud frente a él y ninguna orden."}}`
- **`carta.ciudad`** — Título enorme con regla, subtítulo y fechas a la izquierda; paisaje ancho a la derecha revelado con salpicaduras de tinta alrededor (panel 'OUR CITY / HAPPY DAYS'). Parámetros: src*, title, sub, years, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.ciudad", "params": {"src": "assets/media/mauerbau.jpg", "title": "BERLÍN", "sub": "UNA CIUDAD PARTIDA", "years": "1961 - 1989"}}`
- **`carta.proyecto`** — Foto vertical a la izquierda; título enorme arriba, subtítulo, caja de texto tipeado y fechas abajo (panel 'CS 5 PROJECT / HAPPY DAYS'). Parámetros: src*, title, sub, body, years, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.proyecto", "params": {"src": "assets/media/mauerbau.jpg", "title": "LA PREGUNTA", "sub": "¿CUÁNDO ENTRA EN VIGOR?", "body": "Schabowski revolvió sus papeles. Buscó la respuesta. No la encontró.", "years": "18:53"}}`
- **`carta.dato`** — Dato: título con regla, cifra destacada, texto tipeado suelto, fechas entre reglas y foto a la derecha (panel 'HIGH RESOLUTION / 1920X1080'). Parámetros: src*, title, figure, body, years, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.dato", "params": {"src": "assets/media/mauerbau.jpg", "title": "DURANTE", "figure": "28 AÑOS", "body": "Berlín estuvo partida en dos.", "years": "1961 - 1989"}}`
- **`carta.perfil`** — Perfil: retrato a la izquierda, nombre, ciudad y fechas escalonados, texto tipeado suelto y un segundo título abajo con regla (panel 'JESICA VRUBLER / PARIS / BIG FAMILY'). Parámetros: src*, title, sub, years, body, title2, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.perfil", "params": {"src": "assets/media/mauerbau.jpg", "title": "GÜNTER SCHABOWSKI", "sub": "BERLÍN ESTE", "years": "1989", "body": "El encargado de contarlo a la prensa.", "title2": "EL VOCERO"}}`
- **`carta.frente`** — Título con regla arriba a la izquierda, subtítulo, fechas tenues, caja de texto, segundo título abajo y foto ancha a la derecha (panel 'EASY TO EDIT / GERMANY / WORLD WAR'). Parámetros: src*, title, sub, years, body, title2, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.frente", "params": {"src": "assets/media/mauerbau.jpg", "title": "LA FRONTERA", "sub": "BORNHOLMER", "years": "23:30", "body": "Abrió la barrera. Y la gente cruzó.", "title2": "LA DECISIÓN"}}`
- **`carta.title`** — Portada: título de máquina de escribir enorme + subtítulo alineado a su derecha dentro de una caja crema, bajada pequeña, y letras fantasma gigantes al fondo. Parámetros: title*, sub, kicker, ghost, enter(left|right|up|down|upleft|upright|downleft|downright|fly|ink), mirror, focus, zoom
  `{"use": "carta.title", "params": {"title": "EL MURO", "sub": "LA NOCHE QUE CAYÓ", "kicker": "BERLÍN · 9 NOV 1989"}}`
- **`carta.introv1`** — GANCHO de apertura (lo primero que se ve). Parámetros: text*, kicker, sub, seal, sealAt, wordAt, stagger, bg(auto|hoja|sobre|bokeh|image|component|none), src, focus, use, useParams, dim
  `{"use": "carta.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 de noviembre de 1989", "sub": "la historia que nadie esperaba", "seal": "BERLÍN|1989|ARCHIVO", "sealAt": 2.3}}`
- **`carta.introv2`** — GANCHO pregunta + revelación. Parámetros: text*, kicker, stamp, stampAt, typeAt, cps, bg(auto|hoja|sobre|bokeh|image|component|none), src, focus, use, useParams, dim
  `{"use": "carta.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 9 de noviembre de 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}`
- **`carta.outro`** — Cierre del canal SIN recuadro sobre la gran hoja de papel viejo (bg: hoja | sobre | image con src | component con use/useParams). Parámetros: thanks, channel, cta, support, handle, arrow, likeAt, subscribeAt, bellAt, supportAt, bg(auto|hoja|sobre|image|component|none), src, focus, use, useParams, dim
  `{"use": "carta.outro", "params": {"thanks": "gracias por ver", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más historias.", "handle": "youtube.com/@nodetech"}}`

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
