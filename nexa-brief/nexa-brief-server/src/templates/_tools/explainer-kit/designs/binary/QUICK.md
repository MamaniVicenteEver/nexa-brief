# binary · NODEHISTORY — hoja rápida

> GENERADO por `tools/catalog.py`. No editar a mano. Detalle completo de cada parámetro: `CATALOG.md`.
> Beat: `{ "at": "palabras ancla exactas de la voz", "use": "componente", "params": {…} }`; el 1.º en `"t": 0`.

## Componentes de binary

- **`binary.title`** — Título de apertura GIGANTE hecho de 0 y 1 (~80% del cuadro, estilo cartel: cada renglón ocupa todo el ancho) con antetítulo y línea; las partículas convergen desde el polvo. Parámetros: text*, textPortrait, kicker, fit(lines|block), font, fill, morph
  `{"use": "binary.title", "params": {"text": "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", "textPortrait": "EL HOMBRE\nQUE\nROMPIÓ\nENIGMA", "kicker": "ALAN TURING · 1940"}}`
- **`binary.word`** — Palabra o número grande hecho de glifos (momentos de alto impacto: '159 TRILLONES', '1952'), con rótulo arriba y nota abajo. Parámetros: text*, kicker, note, size, font, morph
  `{"use": "binary.word", "params": {"text": "159\nTRILLONES", "kicker": "COMBINACIONES POSIBLES", "note": "UN NÚMERO DE 21 CIFRAS"}}`
- **`binary.portrait`** — Retrato (o cualquier foto) reconstruido como grilla de 0 y 1: el brillo de la imagen define la opacidad de cada dígito. Parámetros: src*, caption, sub, size, contrast, brightness, threshold, counter, cell, morph
  `{"use": "binary.portrait", "params": {"src": "assets/media/turing.jpg", "caption": "Alan Turing", "counter": {"from": 2026, "to": 1940, "label": ""}}}`
- **`binary.icon`** — Silueta de un objeto hecha de glifos (bombilla, llave, barco, submarino, manzana, reloj…), con etiqueta tipo 'tag' y pie. Parámetros: icon*, size, tag, caption, outline, spin, morph
  `{"use": "binary.icon", "params": {"icon": "key", "tag": "LA LLAVE", "caption": "palabras previsibles"}}`
- **`binary.orbit`** — Ciclo: forma central de glifos dentro de un anillo punteado con 2-6 etapas alrededor; un punto recorre el anillo y la etapa activa se ilumina. Parámetros: icon, labels, tags, period, morph
  `{"use": "binary.orbit", "params": {"icon": "gear", "labels": ["PROBAR", "OBSERVAR", "AJUSTAR", "REPETIR"], "tags": ["INTENTO 1", "INTENTO 2"]}}`
- **`binary.grid`** — Grilla de N copias de una forma que van apareciendo una a una con un contador ('VERSIONES 08'): muestra repetición, escala o cantidad. Parámetros: icon, count, label, revealSec, morph
  `{"use": "binary.grid", "params": {"icon": "bulb", "count": 16, "label": "VERSIONES"}}`
- **`binary.chart`** — Curva de datos hecha de glifos que se dibuja de izquierda a derecha sobre ejes finos; etiqueta en el punto final ('DÍAS → HORAS'). Parámetros: curve(decay|growth|linear|s), startLabel, endLabel, axisX, axisY, drawSec, morph
  `{"use": "binary.chart", "params": {"curve": "decay", "startLabel": "DÍAS", "endLabel": "HORAS", "axisX": "TIEMPO"}}`
- **`binary.tunnel`** — Túnel de anillos concéntricos de glifos que gira y avanza hacia la cámara: pausa dramática, viaje en el tiempo, 'entrar' en una idea. Parámetros: rings, speed, text, morph
  `{"use": "binary.tunnel", "params": {"rings": 14, "text": ""}}`
- **`binary.rays`** — Haz de líneas de glifos que salen de un punto: abanico de caminos posibles, 'X' de contradicción o estallido radial; se dibujan del centro hacia afuera. Parámetros: mode(fan|x|burst), count, highlight, label, drawSec, morph
  `{"use": "binary.rays", "params": {"mode": "fan", "count": 10, "label": "10 CAMINOS"}}`
- **`binary.frame`** — Foto real (blanco y negro) dentro de un marco de glifos punteado, con título en serif y ficha mono: documento histórico, lugar, objeto real. Parámetros: src*, title, sub, ar, size, tilt, morph, logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "binary.frame", "params": {"src": "assets/media/bletchley.jpg", "title": "Bletchley Park", "sub": "INGLATERRA · 1939–1945"}}`
- **`binary.bubble`** — Globo de diálogo de contorno con tres puntos que 'escriben' (esperar una respuesta, una pregunta en el aire). Parámetros: text, size, morph
  `{"use": "binary.bubble", "params": {"text": ""}}`
- **`binary.floor`** — Piso infinito en perspectiva hecho de filas de glifos que se desplazan hacia la cámara (vacío, inmensidad, final reflexivo). Parámetros: text, speed, morph
  `{"use": "binary.floor", "params": {"text": "¿Y AHORA?"}}`
- **`binary.introv1`** — Miniatura de solo texto en el estilo monocromo de binary: el título hecho de partículas 0/1, en blanco puro, con la fecha en letras blancas encima. Parámetros: text*, textPortrait, kicker, fit(lines|block), font, fill, morph, highlight, sub, glow
  `{"use": "binary.introv1", "params": {"text": "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", "kicker": "ALAN TURING · 1940", "highlight": "ENIGMA"}}`
- **`binary.introv2`** — Miniatura de texto e imagen: la frase (como en introv1, más chica) en una mitad y el retrato en glifos 0/1 en la otra; el lado de la foto se elige con imageSide. Parámetros: text*, textPortrait, kicker, highlight, sub, src, video, poster, start, rate, loop, imageSide(auto|left|right), zoom, focusX, focusY, imageCell, contrast, gamma, threshold, glow, morph, logo, logoName, logoPos(auto|top-left|top-right|bottom-left|bottom-right), logoSize, logoInvert
  `{"use": "binary.introv2", "params": {"text": "ELLA LO\nPREVIÓ", "kicker": "APOLO 11 · 1969", "src": "assets/media/hamilton.jpg", "imageSide": "right"}}`
- **`binary.counter`** — Número que se arma dígito a dígito como una tragamonedas (slot) o que cuenta hasta su valor (count), entre dos reglas de glifos: cifras enormes, años, cantidades. Parámetros: value*, mode(slot|count), from, dur, label, note, size, morph
  `{"use": "binary.counter", "params": {"value": "159.000.000.000.000.000.000", "label": "COMBINACIONES", "note": "21 CIFRAS", "mode": "slot"}}`
- **`binary.cipher`** — Mensaje que se cifra letra por letra: texto claro arriba, columna de glifos que 'pasa por la máquina' y letra cifrada abajo en caja. Parámetros: plain*, cipher, mode(encrypt|crib), stepSec, label, morph
  `{"use": "binary.cipher", "params": {"plain": "NADA QUE INFORMAR", "label": "TEXTO CLARO → CIFRADO"}}`
- **`binary.rotors`** — Rotores/tambores de glifos que giran a distinto ritmo: con pocos (1-5) muestran el abecedario y la letra activa en una ventana (Enigma); con muchos (6-120) forman una batería de tambores girando a la vez (la Bomba). Parámetros: count, speed, tags, label, morph
  `{"use": "binary.rotors", "params": {"count": 3, "tags": ["I", "II", "III"], "label": "ROTORES"}}`
- **`binary.timeline`** — Línea de tiempo de glifos (vertical en 9:16, horizontal en 16:9) con hitos que aparecen al pasar el trazo; el hito `active` queda resaltado con caja y pulso. Parámetros: items*, active, drawSec, label, morph
  `{"use": "binary.timeline", "params": {"items": [{"year": "1936", "label": "MÁQUINA UNIVERSAL"}, {"year": "1940", "label": "LA BOMBA"}, {"year": "1950", "label": "¿PUEDEN PENSAR?"}, {"year": "1954", "label": "MUERE"}], "active": 2}}`
- **`binary.versus`** — Dos formas enfrentadas (persona ↔ máquina, prisión ↔ tratamiento) con un símbolo en el medio ('?', 'VS', '='); lado a lado en 16:9, una sobre otra en 9:16. Parámetros: left*, right*, mid, pick(none|left|right), pickAt, morph
  `{"use": "binary.versus", "params": {"left": {"icon": "person", "label": "PERSONA"}, "right": {"icon": "chip", "label": "MÁQUINA"}, "mid": "?"}}`
- **`binary.convoy`** — Mar de glifos visto desde arriba con un convoy de barcos que cruza y submarinos al acecho. Parámetros: mode(attack|reroute|hunt), ships, subs, label, tag, morph
  `{"use": "binary.convoy", "params": {"mode": "reroute", "ships": 5, "subs": 3, "label": "ATLÁNTICO NORTE"}}`
- **`binary.banknote`** — Un billete hecho de glifos 0/1: marco doble, medallón ovalado con un retrato muestreado y el valor grande a la izquierda. Parámetros: src, value, currency, caption, morph
  `{"use": "binary.banknote", "params": {"src": "assets/media/turing.jpg", "value": "50", "currency": "£", "caption": "BILLETE DE 50 LIBRAS · 2021", "morph": 1}}`
- **`binary.wall`** — Muro de ladrillos hechos de glifos con alambre arriba. Parámetros: mode(build|stand|break), rows, buildSec, breakAt, label, sub, morph
  `{"use": "binary.wall", "params": {"mode": "break", "label": "28 AÑOS", "breakAt": 2.2}}`
- **`binary.chessboard`** — Diagrama de ajedrez con piezas vectoriales y jugadas UCI animadas; muestra aperturas y momentos concretos de una partida. Parámetros: fen, moves, notation, moveSec, animSec, delay, focus, label, note, morph
  `{"use": "binary.chessboard", "params": {"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "moves": ["e2e4", "c7c6", "d2d4", "d7d5"], "notation": ["1. e4", "1... c6", "2. d4", "2... d5"], "moveSec": 1.1, "label": "DEFENSA CARO-KANN", "note": "DIAGRAMA DE APERTURA"}}`
- **`binary.chesspiece`** — Pieza de ajedrez con siluetas SVG trazadas en dígitos 0/1 generados por Canvas; permite elegir entre los dos caballos de referencia. Parámetros: piece(pawn|knight|bishop|rook|queen|king), side(white|black), action(idle|advance|threatened|sacrifice), art(variable|referencia), srcVariable, srcReference, label, note, morph
  `{"use": "binary.chesspiece", "params": {"piece": "knight", "side": "white", "action": "threatened", "art": "variable", "label": "CABALLO BLANCO", "note": "EL PEÓN h6 AMENAZA g5"}}`
- **`binary.searchtree`** — Árbol esquemático de jugadas posibles con una ruta destacada; sirve para explicar búsqueda y evaluación sin afirmar que sea un registro literal del cálculo. Parámetros: depth, branching, focusPath, label, note, morph
  `{"use": "binary.searchtree", "params": {"depth": 4, "branching": 2, "focusPath": [1, 0, 1, 0], "label": "HARDWARE + BÚSQUEDA", "note": "ESQUEMA DE OPCIONES"}}`
- **`binary.outrov1`** — Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa. Parámetros: thanks, channel, cta, support, handle, morph, likeAt, subscribeAt, bellAt, supportAt
  `{"use": "binary.outrov1", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."}}`
- **`binary.outro`** — Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa. Parámetros: thanks, channel, cta, support, handle, morph, likeAt, subscribeAt, bellAt, supportAt
  `{"use": "binary.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."}}`

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

Iconos (`icon`): bulb · question · key · lock · ship · submarine · apple · gear · envelope · clock · globe · phone · gavel · heart · bell · chip · waves · check · cross · hourglass · eye · person · house · book · moon · radar · keyboard · banknote · flask · crown · bombe · soldier · wheat · fuel · microphone · document · tv · barrier · hammer · water · radio

## Plano preferido · texto grande + foto o video

`binary.introv2` combina `text` grande a un lado y `src` o `video` grande al otro. Ajustá `highlight`, `kicker` y `focusX`, `focusY`. El MP4 es siempre mudo; `poster` (o `src`) es el respaldo. Todo video visible dura al menos 8 s. En videos de ≥ 8 min, incluí al menos dos tramos de video de ≥ 12 s.

`{"t": 42, "dur": 12, "use": "binary.introv2", "params": {"text": "LA VERDAD", "video": "assets/media/archivo.mp4", "poster": "assets/media/archivo.jpg", "start": 2, "rate": 1, "loop": true, "focusX": 0.7, "focusY": 0.5, "logo": "assets/media/logos/marca.svg", "logoName": "Marca"}}`

## Marcas e instituciones

El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. Usá `logo`, `logoName`, `logoPos` y `logoSize` en el beat visual (`rough.photo`, `binary.frame`, `common.clip`, `rough.introv2`, `binary.introv2` o `common.tabloid`). `common.logo` está obsoleto. Preferí SVG; el PNG debe ser transparente.
