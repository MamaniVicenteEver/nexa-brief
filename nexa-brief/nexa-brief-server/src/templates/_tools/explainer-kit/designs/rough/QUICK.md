# rough · PROTOTIPO — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de rough

- **`rough.title`** — Título de apertura GIGANTE (cartel: cada renglón al ancho total, ~80% del cuadro): las letras se dibujan en contorno y se rellenan; antetítulo en etiqueta lima, subtítulo debajo y subrayado a mano. Parámetros: text*, textPortrait, kicker, sub, accent, blink, fill, underline
  `{"use": "rough.title", "params": {"text": "1202", "kicker": "APOLO 11 · 20 JUL 1969", "sub": "EL ERROR QUE LLEVÓ A LA HUMANIDAD A LA LUNA", "accent": true, "blink": 3}}`
- **`rough.icon`** — Boceto de un objeto (diccionario rough/sketches.js) que se dibuja trazo a trazo; relleno rayado lima opcional, etiqueta arriba y nota manuscrita abajo. Parámetros: icon*, size, tag, caption, accent, color(ink|accent), drawSec
  `{"use": "rough.icon", "params": {"icon": "rocket", "tag": "APOLO 11", "caption": "julio de 1969", "accent": true}}`
- **`rough.photo`** — Foto real en blanco y negro (o virada a lima) que se revela con un barrido dentro de un marco dibujado a mano con cintas; nombre manuscrito y ficha mono debajo. Parámetros: src*, caption, sub, tone(mono|lime), size, ar, tilt, focus
  `{"use": "rough.photo", "params": {"src": "assets/media/hamilton.jpg", "caption": "Margaret Hamilton", "sub": "DIRECTORA DE SOFTWARE · MIT · 32 AÑOS"}}`
- **`rough.annotate`** — Marca a mano ENCIMA de lo que hay en pantalla: círculo, subrayado, flecha, caja o tachado, en lima, sobre una zona del cuadro de contenido; texto manuscrito opcional al lado. Parámetros: kind(circle|underline|arrow|box|cross), x, y, w, h, note, drawSec
  `{"use": "rough.annotate", "params": {"kind": "circle", "x": 0.2, "y": 0.3, "w": 0.6, "h": 0.3, "note": "¡aquí!"}}`
- **`rough.introv1`** — Miniatura de solo texto con el tratamiento a mano de rough: título enorme, línea lima y antetítulo opcional. Parámetros: text*, textPortrait, highlight, kicker, sub, fill
  `{"use": "rough.introv1", "params": {"text": "LA COMPUTADORA\nDEL APOLO 11\nSE RINDIÓ", "highlight": "SE RINDIÓ", "kicker": "APOLO 11 · 1969"}}`
- **`rough.introv2`** — Miniatura de texto e imagen al estilo de las miniaturas de tecnología: título enorme alineado a la izquierda y una foto grande a color que se funde con el fondo (en 9:16 la foto va arriba). Parámetros: text*, textPortrait, highlight, kicker, sub, src, saturate, focus
  `{"use": "rough.introv2", "params": {"text": "¿SE ACABÓ\nLA PC\nBARATA?", "highlight": "BARATA?", "kicker": "MEMORIA RAM · 2026", "src": "assets/media/hamilton.jpg"}}`
- **`rough.flow`** — Cadena de 2-5 pasos (boceto + rótulo) unidos por flechas a mano que aparecen en orden: causa → efecto, un proceso, un sistema. Parámetros: nodes*, active, stepSec, title
  `{"use": "rough.flow", "params": {"nodes": [{"icon": "radar", "label": "RADAR"}, {"icon": "chip", "label": "COMPUTADORA"}, {"icon": "alarm", "label": "1202"}], "active": 2}}`
- **`rough.compare`** — Comparación de escala por ÁREA: un cuadrado diminuto (lo chico, en lima) dentro de uno enorme (lo grande). Parámetros: small*, big*, ratio, bigFirst, bigAt
  `{"use": "rough.compare", "params": {"small": {"label": "APOLO 11", "value": "4 KB"}, "big": {"label": "TU TELÉFONO", "value": "MILLONES DE VECES MÁS"}, "ratio": 1000000}}`
- **`rough.stack`** — Pila de tareas en cajas a mano; en `dropAt` las que no se conservan se tachan y caen, y las importantes suben y se pintan de lima. Parámetros: items*, dropAt, title
  `{"use": "rough.stack", "params": {"title": "PRIORIDADES", "items": [{"label": "ATERRIZAR", "keep": true}, {"label": "NAVEGAR", "keep": true}, {"label": "PANTALLA"}, {"label": "RADAR"}], "dropAt": 2.4}}`
- **`rough.dsky`** — Panel de la computadora del Apolo (DSKY) dibujado a mano: luces de aviso, pantalla PROG/VERB/NOUN y teclado. Parámetros: code, alarm, verb, noun, size
  `{"use": "rough.dsky", "params": {"code": "1202", "alarm": true}}`
- **`rough.rope`** — Memoria de cuerda (core rope): anillos magnéticos en fila y un alambre que se teje: si ATRAVIESA el anillo es 1, si lo RODEA es 0. Parámetros: bits, caption, drawSec
  `{"use": "rough.rope", "params": {"bits": "101101", "caption": "tejido a mano"}}`
- **`rough.gauge`** — Indicador semicircular a mano con aguja y número grande que baja (o sube) de `from` a `to`: combustible, tiempo que queda, presión. Parámetros: from, to, max, dur, unit, label, critical
  `{"use": "rough.gauge", "params": {"from": 60, "to": 30, "unit": "SEGUNDOS", "label": "COMBUSTIBLE"}}`
- **`rough.descent`** — Vista lateral de un descenso: suelo lunar a mano con cráter y rocas, el módulo lunar bajando por su trayectoria. Parámetros: mode(auto|manual), dur, hazard, target, altFrom, divertAt
  `{"use": "rough.descent", "params": {"mode": "manual", "hazard": "CRÁTER CON ROCAS", "target": "zona plana"}}`
- **`rough.tally`** — Algo que se repite N veces: boceto que se sacude en cada repetición, palotes a mano (|||| tachados de a 5) y contador grande '×N'. Parámetros: icon, count, interval, label
  `{"use": "rough.tally", "params": {"icon": "alarm", "count": 5, "interval": 0.55, "label": "ALARMA 1202"}}`
- **`rough.choice`** — Dos (o tres) opciones en cajas a mano; en `pickAt` la elegida se pinta de lima con un ✓ y las otras se tachan. Parámetros: options*, pick, pickAt, question
  `{"use": "rough.choice", "params": {"options": ["ABORTAR", "SEGUIR"], "pick": 1, "pickAt": 2.2, "question": "¿y ahora?"}}`
- **`rough.timeline`** — Línea de tiempo a mano (vertical en 9:16, horizontal en 16:9) con hitos que se marcan al pasar el trazo; el hito `active` va en lima con círculo a mano. Parámetros: items*, active, drawSec
  `{"use": "rough.timeline", "params": {"items": [{"year": "1961", "label": "Kennedy: la Luna"}, {"year": "1965", "label": "Hamilton entra al MIT"}, {"year": "1969", "label": "Apolo 11"}], "active": 2}}`
- **`rough.load`** — Un recipiente vertical (la máquina) se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan fuera temblando y el borde se raya en lima con un rótulo grande de desborde. Parámetros: tasks, capacity, stepSec, overflowAt, extra, overflowLabel, title
  `{"use": "rough.load", "params": {"tasks": ["BOOT", "SCAN", "INDEX", "QUERY", "WRITE"], "capacity": 5, "stepSec": 0.55, "overflowAt": 3.6, "extra": ["RADAR", "RADAR"], "overflowLabel": "1202"}}`
- **`rough.note`** — Hoja de papel dibujada a mano con un título mecanografiado y renglones de texto garabateado; en `noteAt` aparece una nota manuscrita en lima en el margen (un comentario, una firma, 'vago, pero emocionante'). Parámetros: title, note, noteAt, lines, caption
  `{"use": "rough.note", "params": {"title": "INFORMATION MANAGEMENT: A PROPOSAL", "note": "vague but exciting…", "noteAt": 2}}`
- **`rough.network`** — Red que crece: un nodo central y nodos que aparecen en anillos, unidos por enlaces a mano (documentos que se enlazan, la web, una comunidad). Parámetros: center, labels, count, growSec
  `{"use": "rough.network", "params": {"center": "WWW", "labels": ["DOC", "FOTO", "VIDEO", "MAPA"], "count": 28, "growSec": 3}}`
- **`rough.browser`** — Ventana de navegador dibujada a mano: la dirección se escribe letra a letra en la barra, aparece la página (título + renglones) y un cursor hace clic en un enlace lima en `clickAt`. Parámetros: url, title, link, clickAt, caption
  `{"use": "rough.browser", "params": {"url": "info.cern.ch", "title": "World Wide Web", "link": "¿qué es esto?", "clickAt": 3}}`
- **`rough.counter`** — Cifra GIGANTE que cuenta de `from` a `to` (con separador de miles) y queda subrayada a mano; etiqueta lima arriba y unidad manuscrita abajo. Parámetros: from, to, dur, label, unit, prefix, suffix
  `{"use": "rough.counter", "params": {"from": 0, "to": 6000000000, "label": "PERSONAS EN INTERNET", "unit": "y contando…", "dur": 2.5}}`
- **`rough.outrov1`** — Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida. Parámetros: thanks, channel, cta, support, handle, likeAt, subscribeAt, bellAt, supportAt
  `{"use": "rough.outrov1", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."}}`
- **`rough.outro`** — Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida. Parámetros: thanks, channel, cta, support, handle, likeAt, subscribeAt, bellAt, supportAt
  `{"use": "rough.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."}}`

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

Bocetos (`icon`): understand · design · build · measure · ship · laptop · linux · work · spark · homelab · browser · database · terminal · waves · swipe · scribble · flight · cup · hook · star · bulb · pencil · question · up · ring · cube · notebook · tv · scales · car · gradcap · drop · megaphone · plate · dumbbell · calendar · bag · heart · pin · circle · underline · arrow · ai · camera · cloud · bot · mouse · lock · code · phone · server · eye · link · sun · plus · close · rocket · lm · moon · earth · alarm · chip · dsky · radar · flag · astronaut · woman · person · headset · papers · fuel · crater · rocks · footprint · switch · warning · check · clock · gear · target · keyboard · battery · loop · stopwatch · book · paper · cursor · coin · gift · nextcube
