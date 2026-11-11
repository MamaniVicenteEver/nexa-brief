# COMPONENTES · catálogo completo para el orquestador

> Generado por `node tools/componentes-md.mjs` desde `engine/tactico/animations/*.json` (118 piezas). No lo edites a mano.
> Cada ficha: **título · descripción · estados · parámetros** (`nombre:tipo=defecto[rango]`) y un **ejemplo** listo para pegar
> en `scene.json → items` (o, en el plan de un segmento, como `componentes`/`medios` cambiando `type` por `tipo`).
> Todos admiten `id, t, dur, out, fade, sfx`. Posiciones `at`/`from`/`to`/`via` son [lon,lat] o un nombre de `places`.
> Familias: air (8) · army (7) · arrow (4) · badge (1) · callout (1) · caption (2) · debug (3) · document (2) · editorial (1) · flag (1) · front (1) · fx (9) · ground (8) · header (1) · icon (1) · image (5) · intro (1) · inventory (1) · label (10) · legend (1) · money (2) · naval (5) · oil (4) · outro (1) · portrait (5) · range (1) · route (2) · site (6) · space (1) · statement (2) · strike (4) · territory (9) · text (1) · trail (1) · unit (5) · year (1).


## Familia air

### `air.bomber`
Bombardero de ala volante o alas en flecha, rumbo y sombra con altura. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 8.35 s (en bucle) · estados: normal/active/hit/destroyed · sfx: air-jet-pass · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=wing{wing|swept}, altitude:number=2[0..20], contrail:boolean=false
- ejemplo: `{"id":"air-bomber","t":0,"type":"air.bomber","at":[58.4,24.9],"variant":"wing","scale":2.7,"heading":"auto","altitude":2,"contrail":true,"dur":8,"label":"ALA VOLANTE","path":{"via":[[58.4,24.9],[58.14,25.02],[57.95,25.06]],"t":0.3,"dur":6.5,"curve":"smooth"}}`

### `air.drop`
Agregado: caída de bombas con sombra convergente y destello, ausente de las referencias. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 4.35 s (en bucle) · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, to:place, count:number=3[1..20], interval:number=0.3, fallDur:number=1.4, height:number=150
- ejemplo: `{"id":"air-drop","t":0,"type":"air.drop","at":[58.2,25],"to":[58.2,25],"count":4,"dur":4,"note":"Caída agregada, no observada en las referencias."}`

### `air.helicopter`
Helicóptero con rotor animado por tiempo absoluto. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 8.35 s (en bucle) · estados: normal/active/hit/destroyed · sfx: helicopter-rotor · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=utility{utility}, altitude:number=2[0..20], contrail:boolean=false
- ejemplo: `{"id":"air-helicopter","t":0,"type":"air.helicopter","at":[58.4,24.9],"variant":"utility","scale":4,"heading":"auto","altitude":2,"contrail":true,"dur":8,"label":"HELICÓPTERO","path":{"via":[[58.4,24.9],[58.14,25.02],[57.95,25.06]],"t":0.3,"dur":6.5,"curve":"smooth"}}`

### `air.jet`
Avión de ataque o caza. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 8.35 s (en bucle) · estados: normal/active/hit/destroyed · sfx: air-jet-pass · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=attack{attack|fighter}, altitude:number=2[0..20], contrail:boolean=false
- ejemplo: `{"id":"air-jet","t":0,"type":"air.jet","at":[58.4,24.9],"variant":"attack","scale":4,"heading":"auto","altitude":2,"contrail":true,"dur":8,"label":"CAZA","path":{"via":[[58.4,24.9],[58.14,25.02],[57.95,25.06]],"t":0.3,"dur":6.5,"curve":"smooth"}}`

### `air.launch`
Agregado: despegues escalonados por la cubierta angulada de un portaaviones móvil. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 7.35 s (en bucle) · sfx: air-jet-pass · depende de: engine/tactico/animations/naval.carrier.json, engine/tactico/sprites/sprites.json
- parámetros: carrier:string, to:place, from:place, unit:string=air.jet:fighter, count:number=1[1..20], interval:number=0.65, deckDur:number=0.75, flightDur:number=3.8, scale:number=1
- ejemplo: `{"id":"air-launch","t":0,"type":"air.launch","carrier":"demo-carrier","at":"demo-carrier","to":[57.6,25.6],"count":2,"dur":7,"unit":"air.jet:attack","note":"Agregado: no aparece en las referencias. Requiere el item demo-carrier."}`

### `air.prop`
Transporte de hélices animadas. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 8.35 s (en bucle) · estados: normal/active/hit/destroyed · sfx: air-prop-pass · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=transport{transport}, altitude:number=2[0..20], contrail:boolean=false
- ejemplo: `{"id":"air-prop","t":0,"type":"air.prop","at":[58.4,24.9],"variant":"transport","scale":4,"heading":"auto","altitude":2,"contrail":true,"dur":8,"label":"TRANSPORTE","path":{"via":[[58.4,24.9],[58.14,25.02],[57.95,25.06]],"t":0.3,"dur":6.5,"curve":"smooth"}}`

### `air.recover`
Agregado: aproximación y recuperación sobre la cubierta de un portaaviones móvil. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 7.35 s (en bucle) · sfx: air-jet-pass · depende de: engine/tactico/animations/naval.carrier.json, engine/tactico/sprites/sprites.json
- parámetros: carrier:string, to:place, from:place, unit:string=air.jet:fighter, count:number=1[1..20], interval:number=0.65, deckDur:number=0.75, flightDur:number=3.8, scale:number=1
- ejemplo: `{"id":"air-recover","t":0,"type":"air.recover","carrier":"demo-carrier","at":"demo-carrier","to":[57.6,25.6],"from":[57.6,25.6],"count":2,"dur":7,"unit":"air.jet:attack","note":"Agregado: no aparece en las referencias. Requiere el item demo-carrier."}`

### `air.swarm`
Hasta ochenta drones en oleadas; interceptación y destellos deterministas. Úsala para mostrar vuelos, maniobras y operaciones aéreas.
- duración típica 10.35 s (en bucle) · estados: normal/intercepted · sfx: drone-buzz · depende de: engine/tactico/sprites/sprites.json
- parámetros: label:string=, flag:string=, from:place, to:place, path:object, count:number=24[1..80], spread:number=90[0..500], waves:number=1[1..12], waveGap:number=0.6[0..10], scale:number=1[0.2..4], interceptRate:number=0.5[0..1], fx:boolean=true
- ejemplo: `{"id":"demo-air-swarm","t":0,"type":"air.swarm","from":[49.8,28.5],"to":[51.5,27.5],"count":60,"waves":3,"waveGap":0.6,"spread":80,"flag":"UA","label":"ENJAMBRE","state":"intercepted","interceptRate":0.35,"dur":10}`


## Familia army

### `army.advance`
Ola de fichas con relieve, bandera, filas escalonadas, flecha progresiva y frente luminoso. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], count:number=24[8..40], n:number[1..80], columns:number=6[2..10], spacing:number=59[44..100], radius:number=25[16..42], wave:number=5[0..16], speed:number=1.6[0.1..5], dust:boolean=true, arrow:boolean=true, banner:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false
- ejemplo: `{"id":"army-advance","t":0,"type":"army.advance","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"EJÉRCITO","date":"","path":{"via":[[48.3,30.98],[48.48,31.18],[48.6,31.38]],"t":0.5,"dur":7,"curve":"smooth","ease":"inOut"}}`

### `army.banner`
Estandarte ondeante con banda biselada, nombre de ejército y fecha. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false
- ejemplo: `{"id":"army-banner","t":0,"type":"army.banner","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"EJÉRCITO","date":"SEPTIEMBRE · 1980"}`

### `army.clash`
Dos ejércitos enfrentados con destellos deterministas y fichas que caen. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], count:number=24[8..40], n:number[1..80], bandos:array=[], columns:number=6[2..10], spacing:number=59[44..100], radius:number=25[16..42], wave:number=5[0..16], speed:number=1.6[0.1..5], dust:boolean=true, arrow:boolean=true, banner:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false, opponentFlag:string=IR, fall:number=0.7[0..0.8]
- ejemplo: `{"id":"army-clash","t":0,"type":"army.clash","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"CHOQUE DE FRENTES","date":"","opponentFlag":"IR"}`

### `army.encircle`
Dos brazos de fichas que cierran el cerco gradualmente. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], count:number=24[8..40], n:number[1..80], columns:number=6[2..10], spacing:number=59[44..100], radius:number=25[16..42], wave:number=5[0..16], speed:number=1.6[0.1..5], dust:boolean=true, arrow:boolean=true, banner:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false, closeDur:number=5[0.2..30]
- ejemplo: `{"id":"army-encircle","t":0,"type":"army.encircle","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":16,"columns":4,"radius":25,"spacing":59,"wave":5,"label":"EJÉRCITO","date":"","closeDur":5}`

### `army.hold`
Línea defensiva escalonada que resiste con un pulso coordinado. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], count:number=24[8..40], n:number[1..80], columns:number=6[2..10], spacing:number=59[44..100], radius:number=25[16..42], wave:number=5[0..16], speed:number=1.6[0.1..5], dust:boolean=true, arrow:boolean=true, banner:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false
- ejemplo: `{"id":"army-hold","t":0,"type":"army.hold","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"LÍNEA DEFENSIVA","date":""}`

### `army.retreat`
Retirada organizada de fichas con ondulación, polvo y frente rojo discontinuo. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], count:number=24[8..40], n:number[1..80], columns:number=6[2..10], spacing:number=59[44..100], radius:number=25[16..42], wave:number=5[0..16], speed:number=1.6[0.1..5], dust:boolean=true, arrow:boolean=true, banner:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false
- ejemplo: `{"id":"army-retreat","t":0,"type":"army.retreat","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"EJÉRCITO","date":"","path":{"via":[[48.6,31.38],[48.48,31.18],[48.3,30.98]],"t":0.5,"dur":7,"curve":"smooth","ease":"inOut"}}`

### `army.supply`
Ruta logística discontinua con pequeños camiones, polvo y entrada/salida suave. Úsala para representar formaciones de tropas.
- duración típica 8.6 s (en bucle) · estados: normal/engaged/routed/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, flag:string=IQ, scale:number=1[0.35..2.5], dust:boolean=true, label:string=EJÉRCITO, date:string=, seed:number|string=23, losses:array=[], reinforce:array=[], persist:boolean=false, supplyCount:number=5[2..12]
- ejemplo: `{"id":"army-supply","t":0,"type":"army.supply","at":[48.45,31.2],"flag":"IQ","dur":8,"fade":0.6,"count":24,"columns":6,"radius":25,"spacing":59,"wave":5,"label":"ABASTECIMIENTO","date":"","path":{"via":[[48.3,30.98],[48.48,31.18],[48.6,31.38]],"t":0.5,"dur":7,"curve":"smooth","ease":"inOut"}}`


## Familia arrow

### `arrow.bolt`
Rayo angular determinista entre dos puntos con núcleo brillante y pulso. Úsala para dirigir la atención o representar un desplazamiento.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, teeth:number=8, amplitude:number=24, seed:number=1
- ejemplo: `{"id":"demo-arrow-bolt","t":0,"via":[[48,32],[58,25]],"dur":6,"out":5.5,"type":"arrow.bolt","color":"accent"}`

### `arrow.curve`
Curva cuadrática con punta, revelado y estela luminosa en movimiento. Úsala para dirigir la atención o representar un desplazamiento.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, bend:number=0.3, trail:number=0.24
- ejemplo: `{"id":"demo-arrow-curve","t":0,"via":[[48,33],[56,27]],"dur":6,"out":5.5,"type":"arrow.curve","color":"text","width":9}`

### `arrow.flow`
Flujo ondulado con flechas que recorren la curva según tiempo absoluto. Úsala para dirigir la atención o representar un desplazamiento.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, amplitude:number=14, wavelength:number=150, heads:number=5, speed:number=0.13
- ejemplo: `{"id":"demo-arrow-flow","t":0,"via":[[50.5,28.8],[53,27],[56.4,26.4],[58.5,24.8]],"dur":6,"out":5.5,"type":"arrow.flow","color":"accent"}`

### `arrow.route`
Flecha por waypoints con contorno y punta que avanza a longitud constante. Úsala para dirigir la atención o representar un desplazamiento.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1
- ejemplo: `{"id":"demo-arrow-route","t":0,"via":[[50.5,28.8],[53,27],[56.4,26.4],[58.5,24.8]],"dur":6,"out":5.5,"type":"arrow.route","color":"accent"}`


## Familia badge

### `badge.count`
Contador circular con dígitos rodantes y valores explícitos por estados fechados. Úsala para destacar una cifra.
- duración típica 5.85 s (en bucle) · estados: count
- parámetros: value:number=0, radius:number=66, color:string=success
- ejemplo: `{"id":"demo-badge-count","t":0,"type":"badge.count","screen":[0.5,0.35],"value":2,"states":[{"at":2,"state":"count","value":3,"dur":0.8}],"dur":6,"out":5.5,"note":"Contador sintético para demostrar la animación."}`


## Familia callout

### `callout.photo`
Foto/documento con pie y crédito visibles, haz hasta un punto del mapa. Úsala para vincular una imagen documentada con una posición.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/fonts/AtlasEditorial.ttf, assets/media/A04.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, credit:string=, date:string=, scale:number=1[0.2..2], offset:array=[0,-220], appearance:object={}, caption:string=, beam:boolean=true
- ejemplo: `{"id":"demo-photo","t":0,"type":"callout.photo","at":[51,27],"src":"assets/media/A04.png","caption":"Iran Ajr · tras la captura","date":"22 sep 1987","credit":"PH3 Henry Cleveland · U.S. Navy · PD","offset":[0,-390],"dur":8,"out":7}`


## Familia caption

### `caption.transcript`
Transcripción agrupada por palabras, pausa o puntuación; posición, ancho y resaltado configurables. El estilo clásico conserva el tratamiento histórico. Úsala para acompañar la narración con texto.
- duración típica 14 s (en bucle) · depende de: assets/lyrics.json
- parámetros: posicion:enum{izq|centro|der}, ancho:number[1..100], palabras:number[1..5], resalte:boolean=false, enabled:boolean=true, reductionPercent:number=35.6[0..95], yOffsetLandscape:number=10[-200..200], lyricsUrl:string=assets/lyrics.json, color:string=#ffffff, activeColor:string=#ffffff, inactiveColor:string=#ffffff, stroke:boolean=true, strokeColor:string=#000000, strokeWidth:number[0..100], font:string=AtlasDisplay, sans-serif, weight:number=800[100..1000], size:number=45[1..200], upper:boolean=true, y:number=0.9[0..1], yLandscape:number=0.915[0..1], maxWords:number=3[1..30], gap:number=0.45[0..10], highlight:enum=none{none|word|progress}, background:string=, padding:number=12[0..100], radius:number=0[0..100], timeOffset:number=0, fade:number=0
- ejemplo: `{"id":"demo-transcript","t":0,"type":"caption.transcript","dur":14,"fade":0,"lyricsUrl":"assets/lyrics.json"}`

### `caption.words`
Transcripción agrupada por palabras, pausa o puntuación; posición, ancho y resaltado configurables. El estilo clásico conserva el tratamiento histórico. Úsala para acompañar la narración con texto.
- duración típica 14 s (en bucle) · depende de: assets/lyrics.json
- parámetros: posicion:enum{izq|centro|der}, ancho:number[1..100], palabras:number[1..5], resalte:boolean=false, enabled:boolean=true, reductionPercent:number=35.6[0..95], yOffsetLandscape:number=10[-200..200], lyricsUrl:string=assets/lyrics.json, color:string=#ffffff, activeColor:string=#ffffff, inactiveColor:string=#ffffff, stroke:boolean=true, strokeColor:string=#000000, strokeWidth:number[0..100], font:string=AtlasDisplay, sans-serif, weight:number=800[100..1000], size:number=45[1..200], upper:boolean=true, y:number=0.9[0..1], yLandscape:number=0.915[0..1], maxWords:number=3[1..30], gap:number=0.45[0..10], highlight:enum=none{none|word|progress}, background:string=, padding:number=12[0..100], radius:number=0[0..100], timeOffset:number=0, fade:number=0
- ejemplo: `{"id":"demo-words","t":0,"type":"caption.words","dur":14,"fade":0,"lyricsUrl":"assets/lyrics.json"}`


## Familia debug

### `debug.dot`
Punto geográfico; sirve como unidad de prueba para trayectorias y estados. Úsala para comprobar posiciones, trayectorias y rótulos.
- duración típica 9.35 s (en bucle) · estados: normal/hit
- parámetros: r:number=18[1..200]
- ejemplo: `{"id":"core-dot","t":0,"type":"debug.dot","at":[56.25,26.65],"dur":9,"path":{"via":[[56.25,26.65],[56.45,26.5],[56.75,26.35]],"t":1,"dur":6,"curve":"smooth","ease":"inOut"},"states":[{"at":5,"state":"hit","dur":0.8}]}`

### `debug.label`
Rótulo geográfico con contorno y tipografía declarada. Úsala para comprobar posiciones, trayectorias y rótulos.
- duración típica 9.35 s (en bucle) · estados: normal/hit · depende de: engine/tactico/animations/debug.dot.json
- parámetros: text:string, size:number=28[1..200], font:string=sans-serif, dy:number=-42
- ejemplo: `{"id":"core-label","t":0,"type":"debug.label","text":"Núcleo táctico","at":"core-dot","dur":9}`

### `debug.path`
Trayectoria Mercator con cabeza y tramo recorrido; línea, arco o Catmull-Rom. Úsala para comprobar posiciones, trayectorias y rótulos.
- duración típica 9.35 s (en bucle) · estados: normal/hit
- parámetros: width:number=4[0.1..30]
- ejemplo: `{"id":"core-path","t":0,"type":"debug.path","dur":9,"path":{"via":[[56.25,26.65],[56.45,26.5],[56.75,26.35]],"t":1,"dur":6,"curve":"smooth","ease":"inOut"}}`


## Familia document

### `document.clip`
Recorte documental recto con fuente y crédito. Úsala como recurso visual en una escena.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/A01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, caption:string=, source:string=, credit:string=, side:enum=izq{izq|der}, width:number, height:number
- ejemplo: `{"id":"demo-document-clip","t":0,"type":"document.clip","src":"assets/media/A01.png","caption":"USS Stark · daños tras el ataque","source":"U.S. Navy","credit":"DN-ST-89-01562 · dominio público","dur":8,"out":7}`

### `document.stamp`
Documento con sombra suave, fuente y crédito. Úsala como recurso visual en una escena.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/A01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, caption:string=, source:string=, credit:string=, side:enum=izq{izq|der}, width:number, height:number
- ejemplo: `{"id":"demo-document-stamp","t":0,"type":"document.stamp","src":"assets/media/A01.png","caption":"USS Stark · daños tras el ataque","source":"U.S. Navy","credit":"DN-ST-89-01562 · dominio público","dur":8,"out":7}`


## Familia editorial

### `editorial.press`
Retrato y documento inclinado; solo docText del episodio y atribución explícita. Úsala para introducir un documento con atribución.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/fonts/AtlasEditorial.ttf, assets/media/A01.png, assets/media/P03-soft.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, credit:string=, date:string=, scale:number=1[0.2..2], offset:array=[0,-220], appearance:object={}, name:string=, role:string=, focus:array=[0.5,0.38], docText:string=, docSrc:string=, docCredit:string=, tilt:number=-7
- ejemplo: `{"id":"demo-press","t":0,"type":"editorial.press","at":[51,28],"src":"assets/media/P03-soft.png","name":"Ronald Reagan","role":"Presidente de EE. UU.","date":"1987 · foto: 7 feb 1981","credit":"Michael Evans · Casa Blanca · PD","docSrc":"assets/media/A01.png","docText":"USS Stark · daños tras el ataque","docCredit":"U.S. Navy · DN-ST-89-01562 · PD","offset":[0,-100],"dur":8,"out":7}`


## Familia flag

### `flag.marker`
Bandera independiente en mástil, sombra y onda calculada desde el tiempo; admite ancla móvil. Úsala para identificar una nacionalidad en una posición.
- duración típica 5.85 s (en bucle)
- parámetros: flag:string=US, flagWidth:number=78, poleHeight:number=98, wave:boolean=true
- ejemplo: `{"id":"demo-flag-marker","t":0,"type":"flag.marker","at":[53,27],"flag":"US","dur":6,"out":5.5}`


## Familia front

### `front.line`
Frente discontinuo rotulado «aproximado»; interpola posiciones fechadas de avance o retirada. Úsala para mostrar un frente y sus cambios en el tiempo.
- duración típica 5.85 s (en bucle) · estados: advance/retreat/hold
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, approximate:boolean=true, dientes:boolean, text:string=FRENTE · APROXIMADO
- ejemplo: `{"id":"demo-front-line","t":0,"type":"front.line","via":[[47,33],[48.5,31.5],[49,30]],"states":[{"at":1,"state":"advance","via":[[48,33],[49.5,31.5],[50,30]],"dur":1.5},{"at":3.5,"state":"retreat","via":[[47.3,33],[48.8,31.5],[49.3,30]],"dur":1}],"color":"danger","dur":6,"out":5.5,"note":"Frente esquemático sin valor histórico."}`


## Familia fx

### `fx.clash`
Choque entre dos grupos: destello y ondas en el punto medio móvil. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 2.35 s (en bucle)
- parámetros: at:place, groups:array=[], scale:number=1
- ejemplo: `{"id":"clash","t":0,"type":"fx.clash","at":[48.5,30.6],"dur":2,"scale":1.6}`

### `fx.dust`
Polvo determinista detrás de una ruta terrestre, con emisión proporcional al movimiento. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 8.35 s (en bucle)
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1
- ejemplo: `{"id":"ground-dust","t":0,"type":"fx.dust","at":[48.4,31.1],"dur":8,"length":210,"particles":36,"seed":4,"path":{"via":[[48.2,31],[48.4,31.1],[48.6,31.3]],"t":0,"dur":7,"curve":"smooth"}}`

### `fx.explosion`
Explosión con bola de fuego, chispas, escombros y humo expansivo. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 3.15 s (en bucle) · sfx: explosion-near
- parámetros: dur:number=2.8[0.05..], size:number=100[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=84[1..300], variant:enum=ground{ground|air|naval}, distance:enum=near{near|far}
- ejemplo: `{"id":"fx-explosion","t":0,"type":"fx.explosion","at":[54,27],"dur":2.8,"size":100,"particles":84,"variant":"ground","seed":73}`

### `fx.fire`
Llamas cíclicas sobre un punto o casco, con cierre suave de cada partícula. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 8.35 s (en bucle)
- parámetros: dur:number=8[0.05..], size:number=70[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=32[1..300], period:number=1.3[0.2..8]
- ejemplo: `{"id":"fx-fire","t":0,"type":"fx.fire","at":[54,27],"dur":8,"size":70,"particles":32,"seed":73}`

### `fx.flash`
Destello radial breve con núcleo luminoso. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 0.8 s (en bucle)
- parámetros: dur:number=0.45[0.05..], size:number=80[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=1[1..300]
- ejemplo: `{"id":"fx-flash","t":0,"type":"fx.flash","at":[54,27],"dur":0.45,"size":80,"particles":1,"seed":73}`

### `fx.impact`
Impacto con anillo; agua con columna, gotas y espuma. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 1.9500000000000002 s (en bucle) · sfx: explosion-far
- parámetros: dur:number=1.6[0.05..], size:number=75[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=52[1..300], width:number[1..30], color:string, variant:enum=ground{ground|water}
- ejemplo: `{"id":"fx-impact","t":0,"type":"fx.impact","at":[54,27],"dur":1.6,"size":75,"particles":52,"variant":"ground","seed":73}`

### `fx.ring`
Anillos concéntricos pulsantes de sonar, objetivo o detección. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 6.35 s (en bucle)
- parámetros: dur:number=6[0.05..], size:number=100[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=1[1..300], variant:enum=sonar{sonar|target|detection}, period:number=2[0.2..12], rings:number=3[1..6]
- ejemplo: `{"id":"fx-ring","t":0,"type":"fx.ring","at":[54,27],"dur":6,"size":100,"particles":1,"variant":"sonar","seed":73}`

### `fx.shockwave`
Onda circular con tres bordes de refracción simulada. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 2.75 s (en bucle)
- parámetros: dur:number=2.4[0.05..], size:number=110[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=1[1..300], variant:enum=ground{ground|water}
- ejemplo: `{"id":"fx-shockwave","t":0,"type":"fx.shockwave","at":[54,27],"dur":2.4,"size":110,"particles":1,"variant":"ground","seed":73}`

### `fx.smoke`
Columna de humo sembrada, con deriva y emisión acotada. Úsala para enfatizar un impacto, una alerta o un cambio durante una escena.
- duración típica 8.35 s (en bucle)
- parámetros: dur:number=8[0.05..], size:number=85[4..260], scale:number=1[0.1..4], scaleMode:enum=screen{screen|geo}, seed:number|string=1, particles:number=36[1..300], variant:enum=column{column|trail}, drift:array=[20,-9], life:number=3[0.2..20], emitFor:number=8
- ejemplo: `{"id":"fx-smoke","t":0,"type":"fx.smoke","at":[54,27],"dur":8,"size":85,"particles":36,"variant":"column","seed":73}`


## Familia ground

### `ground.ambulance`
Ambulancia con cruz o media luna, balizas alternas y rumbo de ruta. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, variant:enum=cross{cross|crescent}
- ejemplo: `{"id":"ground-ambulance","t":0,"type":"ground.ambulance","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"cross","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"label":"","seed":17}`

### `ground.apc`
Blindado de ruedas con escotilla, sombra, polvo y huellas. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, losses:array=[], reinforce:array=[], persist:boolean=false, count:number=1[1..40]
- ejemplo: `{"id":"ground-apc","t":0,"type":"ground.apc","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"normal","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"label":"","seed":17}`

### `ground.artillery`
Obús remolcado o autopropulsado con fogonazo y retroceso programados. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed/fire · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, losses:array=[], reinforce:array=[], persist:boolean=false, count:number=1[1..40], variant:enum=towed{towed|self}, fire:array=[], turretHeading:number=0[-180..180]
- ejemplo: `{"id":"ground-artillery","t":0,"type":"ground.artillery","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"towed","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"fire":[2.2,4.4],"label":"","seed":17}`

### `ground.convoy`
Columna mixta que recorre una curva por distancia con separación y bandera líder. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed · sfx: tank-rumble · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=110[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, losses:array=[], reinforce:array=[], persist:boolean=false, count:number=6[1..40], spacing:number=110[30..300], vehicles:array=["tank:main","apc","truck:cargo","truck:
- ejemplo: `{"id":"ground-convoy","t":0,"type":"ground.convoy","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"count":6,"length":92,"spacing":98,"label":"","seed":17}`

### `ground.jeep`
Vehículo ligero abierto con rueda de repuesto y sombra. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1
- ejemplo: `{"id":"ground-jeep","t":0,"type":"ground.jeep","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"normal","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"label":"","seed":17}`

### `ground.launcher`
Lanzador sobre camión; cada fire prepara un strike.missile hacia to. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed/fire · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, fire:array=[], turretHeading:number=0[-180..180], to:place, flightDur:number=1.8[0.1..30]
- ejemplo: `{"id":"ground-launcher","t":0,"type":"ground.launcher","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"normal","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"fire":[2.2,4.4],"to":[49.02,31.55],"label":"","seed":17}`

### `ground.tank`
Tanque con casco, orugas, torreta orientable y retroceso; principal o ligero. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed/fire · sfx: tank-rumble · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, losses:array=[], reinforce:array=[], persist:boolean=false, count:number=1[1..40], variant:enum=main{main|light}, fire:array=[], turretHeading:number=0[-180..180]
- ejemplo: `{"id":"ground-tank","t":0,"type":"ground.tank","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"main","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"fire":[2.2,4.4],"label":"","seed":17}`

### `ground.truck`
Camión militar de lona o cisterna, con rodadura animada. Úsala para movimientos y estados de fuerzas terrestres.
- duración típica 8.6 s (en bucle) · estados: normal/hit/burning/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, path:object, heading:number|auto=auto, scale:number=1[0.2..4], length:number=154[40..360], flag:string=IQ, label:string=, dust:boolean=true, tracks:boolean=true, particles:number=14[0..48], seed:number|string=1, variant:enum=cargo{cargo|fuel}
- ejemplo: `{"id":"ground-truck","t":0,"type":"ground.truck","at":[48.4,31.1],"dur":8,"fade":0.6,"flag":"IQ","variant":"cargo","path":{"via":[[48.3,31],[48.42,31.13],[48.65,31.22]],"t":0.6,"dur":6.5,"curve":"smooth","ease":"inOut"},"label":"","seed":17}`


## Familia header

### `header.date`
Encabezado de estilo: marca cuadrada de acento, fecha y lugar en pila, en la ranura «encabezado». Úsala como recurso visual en una escena.
- duración típica 5.85 s (en bucle)
- parámetros: fecha:string=24 JUL 1987, lugar:string=AL OESTE DE FARSI, screen:array
- ejemplo: `{"id":"demo-header-date","t":0,"type":"header.date","fecha":"24 JUL 1987","lugar":"AL OESTE DE FARSI","dur":6,"out":5.5}`


## Familia icon

### `icon.badge`
Medallón vectorial propio: avión, barco, petróleo, edificio, escudo o estrella. Úsala para acompañar un rótulo con un símbolo.
- duración típica 5.85 s (en bucle) · depende de: ship
- parámetros: icon:enum=ship{plane|ship|oil|building|shield|star}, radius:number=60, color:string=accent
- ejemplo: `{"id":"demo-icon-badge","t":0,"type":"icon.badge","screen":[0.5,0.4],"icon":"ship","dur":6,"out":5.5}`


## Familia image

### `image.frame`
Imagen libre con pie y crédito. Úsala como recurso visual en una escena.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/A01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, caption:string=, source:string=, credit:string=, side:enum=izq{izq|der}, width:number, height:number
- ejemplo: `{"id":"demo-image-frame","t":0,"type":"image.frame","src":"assets/media/A01.png","caption":"USS Stark · daños tras el ataque","source":"U.S. Navy","credit":"DN-ST-89-01562 · dominio público","dur":8,"out":7}`

### `image.hex`
Fotografía hexagonal con título, descripción y guía al mapa. Úsala como recurso visual en una escena.
- duración típica 12.35 s (en bucle) · sfx: ui-tick · depende de: assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, at:place, credit:string=, side:enum=auto{izq|der|auto}, reveal:number=0.8[0.05..30], title:string=, description:string=, size:number=260[80..800], focus:array=[0.5,0.38]
- ejemplo: `{"id":"demo-image-hex","t":0,"type":"image.hex","src":"assets/media/P01.png","at":[51,28],"title":"Ruhollah Jomeini","description":"Líder supremo de Irán","label":"ARCHIVO","credit":"Ali Kaveh · PD-Iran · Commons","dur":12,"reveal":0.8}`

### `image.panel`
Panel documental rectangular con fotografía y guía. Úsala como recurso visual en una escena.
- duración típica 12.35 s (en bucle) · sfx: ui-tick · depende de: assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, at:place, credit:string=, side:enum=auto{izq|der|auto}, reveal:number=0.8[0.05..30], title:string=, description:string=, width:number[160..1200], height:number[100..900]
- ejemplo: `{"id":"demo-image-panel","t":0,"type":"image.panel","src":"assets/media/P01.png","at":[51,28],"title":"Ruhollah Jomeini","description":"Líder supremo de Irán","label":"ARCHIVO","credit":"Ali Kaveh · PD-Iran · Commons","dur":12,"reveal":0.8}`

### `image.pole`
Fotografía circular sobre poste con rótulo. Úsala como recurso visual en una escena.
- duración típica 12.35 s (en bucle) · sfx: ui-tick · depende de: assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, at:place, credit:string=, label:string=, size:number[80..800]
- ejemplo: `{"id":"demo-image-pole","t":0,"type":"image.pole","src":"assets/media/P01.png","at":[51,28],"title":"Ruhollah Jomeini","description":"Líder supremo de Irán","label":"ARCHIVO","credit":"Ali Kaveh · PD-Iran · Commons","dur":12}`

### `image.strip`
Tira de dos o tres imágenes con pie y créditos. Úsala como recurso visual en una escena.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/A01.png, assets/media/A04.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, caption:string=, source:string=, credit:string=, side:enum=izq{izq|der}, width:number, height:number, images:array=[]
- ejemplo: `{"id":"demo-image-strip","t":0,"type":"image.strip","src":"assets/media/A01.png","caption":"USS Stark · daños tras el ataque","source":"U.S. Navy","credit":"DN-ST-89-01562 · dominio público","images":[{"src":"assets/media/A01.png","credit":"U.S. Navy · PD"},{"src":"assets/media/A04.png","credit":"U.S. Navy · PD"}],"dur":8,"out":7}`


## Familia intro

### `intro.title`
Título Atlas: anillo geográfico que enfoca el mapa, año, rótulo neón y tres entradas propias. Úsala al comenzar un episodio.
- duración típica 6 s (en bucle) · depende de: assets/fonts/AtlasIntroTitle.ttf, assets/fonts/AtlasIntroUI.ttf
- parámetros: title:string=EL GOLFO
BAJO PRESIÓN, subtitle:string=, kicker:string=ATLAS EN MOVIMIENTO, year:string=, focus:place=[52,26.8], style:enum=focus{focus|trace|meridian}, dur:number=6[2..6], fade:number=0
- ejemplo: `{"id":"intro-atlas","t":0,"type":"intro.title","title":"EL GOLFO\nBAJO PRESIÓN","subtitle":"Una ruta. Un punto de tensión.","kicker":"ATLAS EN MOVIMIENTO","year":"1987","focus":[52,26.8],"style":"focus","dur":6,"fade":0}`


## Familia inventory

### `inventory.units`
Rejilla de siluetas de unidades con contador explícito; máximo 60 iconos y total independiente. Úsala para comparar cantidades mediante iconos.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/fonts/AtlasEditorial.ttf, identidad-opus/assets/fonts/Archivo.ttf, naval.carrier
- parámetros: appearance:object={}, icon:string=naval.carrier, useSprites:boolean=false, count:number=11[0..60], total:number[0..1000000], columns:number=4[1..10], label:string=Inventario, scale:number=1[0.2..2], offset:array=[0,-200]
- ejemplo: `{"id":"demo-inventory","t":0,"type":"inventory.units","at":[51,28],"icon":"naval.carrier","count":11,"total":11,"columns":4,"label":"Inventario · muestra de biblioteca","offset":[0,-100],"dur":8,"out":7,"note":"Ejemplo de capacidad; no es una cifra de la guerra del Golfo."}`


## Familia label

### `label.callout`
Ficha ajustada a zona segura con guía, estrella vectorial y escritura progresiva. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=, size:number=32, width:number=650, height:number=220, color:string=text, fit:boolean=true, screen:array, offset:array=[110,-100], reveal:number=0.65
- ejemplo: `{"id":"demo-label-callout","t":0,"type":"label.callout","at":[53,27],"text":"Unidad de demostración","offset":[100,-120],"dur":6,"out":5.5}`

### `label.chip`
Fecha o rótulo sin recuadro, con contorno oscuro. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=, size:number=30, width:number=650, height:number=220, color:string=text, fit:boolean=true, screen:array
- ejemplo: `{"id":"demo-label-chip","t":0,"type":"label.chip","at":[56.4,26.5],"text":"ESTRECHO DE ORMUZ","dur":6,"out":5.5}`

### `label.country`
Nombre de país en versales espaciadas, sin neón ni brillo; sobre un lugar o en screen. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=IRAK, color:string=text, at:place, screen:array
- ejemplo: `{"id":"demo-label-country","t":0,"type":"label.country","text":"IRAK","screen":[0.5,0.45],"dur":6,"out":5.5}`

### `label.figure`
Cifra grande con unidad y procedencia obligatoria; no genera valores. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=, size:number=96, width:number=650, height:number=220, color:string=text, fit:boolean=true, screen:array, value:number, unit:string=, source:string=, rotation:number=-8
- ejemplo: `{"id":"demo-label-figure","t":0,"type":"label.figure","screen":[0.5,0.48],"value":4,"unit":"países","source":"Los cuatro países de scene-territorios.json; dato de la demostración","dur":6,"out":5.5}`

### `label.front`
Rótulo independiente idéntico al integrado en front.line. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: screen:array=[0.5,0.45], text:string=FRENTE · aproximado, color:string=danger, size:number=24, width:number=460
- ejemplo: `{"id":"demo-label-front","t":0,"dur":6,"out":5.5,"screen":[0.5,0.45],"type":"label.front","text":"FRENTE · aproximado","color":"danger","size":24,"width":460}`

### `label.landunit`
Rótulo de unidades terrestres: cuadrado del bando (relleno si ataca, hueco si no), país y acción («IRAK avanza», «IRÁN avanza», «IRAK se retira»). Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: a:string=IRAK, b:string=avanza, actor:boolean=true, alinear:string=izq, at:place, screen:array
- ejemplo: `{"id":"demo-label-landunit","t":0,"type":"label.landunit","a":"IRÁN","b":"avanza","actor":true,"screen":[0.35,0.5],"dur":6,"out":5.5}`

### `label.neon`
Rótulo neón con contorno oscuro, rotación y ajuste de líneas. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=, size:number=64, width:number=650, height:number=220, color:string=accent, fit:boolean=true, screen:array, rotation:number=0
- ejemplo: `{"id":"demo-label-neon","t":0,"type":"label.neon","at":[54,32],"text":"IRÁN","color":"cyan","size":78,"dur":6,"out":5.5}`

### `label.route`
Rótulo independiente idéntico al integrado en route.lanes. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: screen:array=[0.5,0.45], text:string=ORMUZ, color:string=text, size:number=24, width:number=430
- ejemplo: `{"id":"demo-label-route","t":0,"dur":6,"out":5.5,"screen":[0.5,0.45],"type":"label.route","text":"ORMUZ","color":"text","size":24,"width":430}`

### `label.site`
Nombre de instalación: mismo trazo 6 U, peso 800 y línea base alfabética de sites.js. Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: screen:array=[0.5,0.45], text:string=Kharg · terminal exportador, size:number=24, color:string=#e6e6e6, outlineColor:string=#000000, outlineWidth:number=6, font:string=AtlasDisplay, sans-serif, weight:number=800
- ejemplo: `{"id":"demo-label-site","t":0,"dur":6,"out":5.5,"screen":[0.5,0.45],"type":"label.site","text":"Kharg · terminal exportador"}`

### `label.unit`
Nombre con el mismo helper que naval (22 px), air (21 px) y unidades (24 px). Úsala para identificar lugares y objetos.
- duración típica 5.85 s (en bucle)
- parámetros: screen:array=[0.5,0.45], text:string=USS Samuel B. Roberts, size:number=22, color:string=#e6e6e6, outlineColor:string=#000000, font:string=AtlasDisplay, sans-serif
- ejemplo: `{"id":"demo-label-unit","t":0,"dur":6,"out":5.5,"screen":[0.5,0.45],"type":"label.unit","text":"USS Samuel B. Roberts"}`


## Familia legend

### `legend.front`
Leyenda de método: muestra del trazo discontinuo del frente y texto, siempre secundaria. Úsala como recurso visual en una escena.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=Frente aproximado · flechas: direcciones, muestra:boolean=true, screen:array
- ejemplo: `{"id":"demo-legend-front","t":0,"type":"legend.front","text":"Frente aproximado · flechas: direcciones","dur":6,"out":5.5}`


## Familia money

### `money.flow`
Ejemplo general de money.flow: 7 billetes con $ por una ruta configurable, sin línea de ruta visible. Úsalo para transferencias o ayuda económica entre lugares; adapta la ruta y la cantidad. Los billetes son simbólicos y no representan un importe. Úsala para e
- duración típica 7.35 s (en bucle) · estados: normal
- parámetros: via:array=[[50.33,29.25],[52,27.5],[56.4,26.5],[58, count:number=7[1..40], period:number=5[0.2..60], scale:number=1[0.2..4], currencySymbol:string=$, routeVisible:boolean=false, width:number[1..40], color:string, dash:array
- ejemplo: `{"id":"demo-money-flow","t":0,"type":"money.flow","at":[50.33,29.25],"via":[[50.33,29.25],[51.8,27.4],[54.5,26.1],[56.4,26.5],[58,24]],"count":7,"period":5,"currencySymbol":"$","dur":8,"out":7,"note":"Flujo simbólico · rutas esquemáticas"}`

### `money.stack`
Fajos de billetes con $ que se deslizan y apilan. Úsalo para mostrar reservas o acumulación de dinero en un lugar; para transferencias entre lugares usa money.flow. La cantidad de fajos es simbólica y no representa un importe. Úsala para explicar recursos, pag
- duración típica 7.35 s (en bucle) · estados: normal
- parámetros: count:number=8[1..36], scale:number=1[0.2..4], currencySymbol:string=$, buildDur:number=1.8[0..10]
- ejemplo: `{"id":"demo-money-stack","t":0,"type":"money.stack","at":[51,28],"count":12,"currencySymbol":"$","dur":8,"out":7}`


## Familia naval

### `naval.cargo`
Mercante: petrolero, contenedores o granelero, con estados de casco y estela. Úsala para representar flotas, navegación y cambios de estado de embarcaciones.
- duración típica 8.35 s (en bucle) · estados: normal/detected/targeted/hit/burning/wrecked/sunk/flightops · sfx: naval-engine-low · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=tanker{tanker|container|bulk}, wake:boolean=true
- ejemplo: `{"id":"naval-cargo","t":0,"type":"naval.cargo","variant":"tanker","at":[58.4,24.9],"heading":"auto","label":"PETROLERO","dur":8,"path":{"via":[[58.4,24.9],[58.18,25.04],[57.95,25.06]],"t":0.5,"dur":6,"curve":"smooth"},"states":[{"at":3,"state":"detected"},{"at":5.5,"state":"normal"}]}`

### `naval.carrier`
Portaaviones con cubierta angulada, aviones, escoltas coordinadas y operaciones aéreas. Úsala para representar flotas, navegación y cambios de estado de embarcaciones.
- duración típica 8.35 s (en bucle) · estados: normal/detected/targeted/hit/burning/wrecked/sunk/flightops · sfx: naval-engine-low · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=supercarrier{supercarrier|stovl|hero|inventory}, wake:boolean=true, deck:object={"aircraft":12}, escorts:object, actions:array=[], region:string, count:number=8, inventoryScale:number=0.42
- ejemplo: `{"id":"naval-carrier","t":0,"type":"naval.carrier","variant":"supercarrier","at":[58.4,24.9],"heading":"auto","label":"PORTAAVIONES","dur":8,"path":{"via":[[58.4,24.9],[58.18,25.04],[57.95,25.06]],"t":0.5,"dur":6,"curve":"smooth"},"deck":{"aircraft":12},"escorts":{"formation":"diamond","units":["naval.warship:cg","naval.warship:ddg","naval.warship:ff"]},"states":[{"at":3,"state":"flightops"},{"at":5.5,"state":"normal"}]}`

### `naval.group`
Líder y escoltas en formación rígida que gira con la ruta, por ids o tipos. Úsala para representar flotas, navegación y cambios de estado de embarcaciones.
- duración típica 8.35 s (en bucle) · estados: normal/detected/targeted/hit/burning/wrecked/sunk/flightops · sfx: naval-engine-low · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, wake:boolean=true, leader:string=naval.carrier:supercarrier, formation:enum=diamond{line|diamond|box|escort-ring}, units:array=["naval.warship:ddg","naval.warship:ff",, spacing:number=0.82
- ejemplo: `{"id":"naval-group","t":0,"type":"naval.group","at":[58.4,24.9],"heading":"auto","label":"GRUPO NAVAL","dur":8,"path":{"via":[[58.4,24.9],[58.18,25.04],[57.95,25.06]],"t":0.5,"dur":6,"curve":"smooth"},"states":[{"at":3,"state":"detected"},{"at":5.5,"state":"normal"}]}`

### `naval.submarine`
Submarino opaco o azul translúcido, rótulo y línea guía. Úsala para representar flotas, navegación y cambios de estado de embarcaciones.
- duración típica 8.35 s (en bucle) · estados: normal/detected/targeted/hit/burning/wrecked/sunk/flightops · sfx: naval-engine-low · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=normal{normal|translucent}, wake:boolean=true, translucent:boolean=false
- ejemplo: `{"id":"naval-submarine","t":0,"type":"naval.submarine","variant":"normal","at":[58.4,24.9],"heading":"auto","label":"SUBMARINO","dur":8,"path":{"via":[[58.4,24.9],[58.18,25.04],[57.95,25.06]],"t":0.5,"dur":6,"curve":"smooth"},"states":[{"at":3,"state":"detected"},{"at":5.5,"state":"normal"}]}`

### `naval.warship`
Destructor, fragata o crucero gris con torres. Úsala para representar flotas, navegación y cambios de estado de embarcaciones.
- duración típica 8.35 s (en bucle) · estados: normal/detected/targeted/hit/burning/wrecked/sunk/flightops · sfx: naval-engine-low · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, variant:enum=destroyer{destroyer|frigate|cruiser}, wake:boolean=true
- ejemplo: `{"id":"naval-warship","t":0,"type":"naval.warship","variant":"destroyer","at":[58.4,24.9],"heading":"auto","label":"DESTRUCTOR","dur":8,"path":{"via":[[58.4,24.9],[58.18,25.04],[57.95,25.06]],"t":0.5,"dur":6,"curve":"smooth"},"states":[{"at":3,"state":"detected"},{"at":5.5,"state":"normal"}]}`


## Familia oil

### `oil.barrel`
Barril de petróleo con gota naranja, vertical; úsalo para representar reservas, carga o cantidad simbólica de crudo.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: engine/tactico/sprites3/oil-barrel.png
- parámetros: scale:number=1[0.15..4], entrance:number=0.6[0..5], animate:boolean=true, period:number=2[0.5..20]
- ejemplo: `{"id":"demo-oil-barrel","type":"oil.barrel","at":[51,28],"scale":1,"animate":true,"period":2,"t":0,"dur":8,"out":7}`

### `oil.derrick`
Torre terrestre con perforación animada; úsala para ubicar un pozo o una operación de perforación en tierra.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: engine/tactico/sprites3/oil-derrick-00.png, engine/tactico/sprites3/oil-derrick-01.png, engine/tactico/sprites3/oil-derrick-02.png, engine/tactico/sprites3/oil-derrick-03.png, engine/tactico/sprites3/oil-derrick-04.png, engine/tactico/sprites3/oil-derrick-05.png, engine/tactico/sprites3/oil-derrick-06.png, engine/tactico/sprites3/oil-derrick-07.png
- parámetros: scale:number=1[0.15..4], entrance:number=0.6[0..5], animate:boolean=true, period:number=2[0.5..20]
- ejemplo: `{"id":"demo-oil-derrick","type":"oil.derrick","at":[51,28],"scale":1,"animate":true,"period":2,"t":0,"dur":8,"out":7}`

### `oil.platform`
Plataforma petrolera marina con grúa animada; úsala para representar extracción o perforación en el mar.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: engine/tactico/sprites3/oil-platform-00.png, engine/tactico/sprites3/oil-platform-01.png, engine/tactico/sprites3/oil-platform-02.png, engine/tactico/sprites3/oil-platform-03.png, engine/tactico/sprites3/oil-platform-04.png, engine/tactico/sprites3/oil-platform-05.png, engine/tactico/sprites3/oil-platform-06.png, engine/tactico/sprites3/oil-platform-07.png
- parámetros: scale:number=1[0.15..4], entrance:number=0.6[0..5], animate:boolean=true, period:number=2[0.5..20]
- ejemplo: `{"id":"demo-oil-platform","type":"oil.platform","at":[51,28],"scale":1,"animate":true,"period":2,"t":0,"dur":8,"out":7}`

### `oil.pumpjack`
Bomba extractora terrestre con balancín animado; úsala para mostrar extracción de petróleo en un pozo.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: engine/tactico/sprites3/oil-pump-00.png, engine/tactico/sprites3/oil-pump-01.png, engine/tactico/sprites3/oil-pump-02.png, engine/tactico/sprites3/oil-pump-03.png, engine/tactico/sprites3/oil-pump-04.png, engine/tactico/sprites3/oil-pump-05.png, engine/tactico/sprites3/oil-pump-06.png, engine/tactico/sprites3/oil-pump-07.png
- parámetros: scale:number=1[0.15..4], entrance:number=0.6[0..5], animate:boolean=true, period:number=2[0.5..20]
- ejemplo: `{"id":"demo-oil-pumpjack","type":"oil.pumpjack","at":[51,28],"scale":1,"animate":true,"period":2,"t":0,"dur":8,"out":7}`


## Familia outro

### `outro.channel`
Cierre Atlas ≤8 s: gracias, canal, me gusta, suscribirse y campana, apoyo y handle sin recuadro. Úsala para cerrar un episodio y presentar el canal.
- duración típica 8 s (en bucle) · depende de: assets/fonts/AtlasIntroTitle.ttf, assets/fonts/AtlasIntroUI.ttf
- parámetros: channel:string=NODEHISTORY, thanks:string=GRACIAS POR VER, support:string=Apoya el canal. Comparte esta historia., handle:string=youtube.com/@nodehistory, dim:number=0.2[0..1], bg:enum=world{world|none}, titleColor:string=#e8e8e8, textColor:string=#f1f1f1, secondaryColor:string=#d6d6d6, cta:string=SUSCRÍBETE, arrow:boolean=true, dur:number=8[4..8], fade:number=0
- ejemplo: `{"id":"outro-atlas","t":6,"type":"outro.channel","dur":8,"fade":0,"channel":"NODEHISTORY","handle":"youtube.com/@nodehistory"}`


## Familia portrait

### `portrait.badge`
Retrato circular u octogonal con cargo y fecha documentada. Úsala para presentar una persona con cargo, fecha y crédito.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/fonts/AtlasEditorial.ttf, assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, credit:string=, date:string=, scale:number=1[0.2..2], offset:array=[0,-220], appearance:object={}, name:string=, role:string=, focus:array=[0.5,0.38], shape:enum=octagon{circle|octagon}
- ejemplo: `{"id":"demo-portrait-badge","t":0,"type":"portrait.badge","at":[51,28],"src":"assets/media/P01.png","name":"Ruhollah Jomeini","role":"Líder supremo de Irán","date":"Foto: 6 may 1981","credit":"Ali Kaveh · PD-Iran · Commons","shape":"octagon","offset":[0,-100],"dur":8,"out":7}`

### `portrait.card`
Ficha horizontal de persona con foto y datos. Úsala para presentar una persona con cargo, fecha y crédito.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, name:string=, role:string=, date:string=, credit:string=, side:enum=izq{izq|der}, focus:array
- ejemplo: `{"id":"demo-portrait-card","t":0,"type":"portrait.card","src":"assets/media/P01.png","name":"Ruhollah Jomeini","role":"Líder supremo de Irán","date":"6 may 1981","credit":"Ali Kaveh · PD-Iran · Commons","dur":8,"out":7}`

### `portrait.column`
Ficha de persona con foto sobre los datos. Úsala para presentar una persona con cargo, fecha y crédito.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/P01.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, name:string=, role:string=, date:string=, credit:string=, side:enum=izq{izq|der}, focus:array
- ejemplo: `{"id":"demo-portrait-column","t":0,"type":"portrait.column","src":"assets/media/P01.png","name":"Ruhollah Jomeini","role":"Líder supremo de Irán","date":"6 may 1981","credit":"Ali Kaveh · PD-Iran · Commons","dur":8,"out":7}`

### `portrait.cutout`
Retrato con máscara suave sobre una forma, borde y sombra. Úsala para presentar una persona con cargo, fecha y crédito.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/fonts/AtlasEditorial.ttf, assets/media/P01-soft.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, credit:string=, date:string=, scale:number=1[0.2..2], offset:array=[0,-220], appearance:object={}, name:string=, role:string=, focus:array=[0.5,0.38], mask:array=[]
- ejemplo: `{"id":"demo-portrait-cutout","t":0,"type":"portrait.cutout","at":[51,28],"src":"assets/media/P01-soft.png","name":"Ruhollah Jomeini","role":"Líder supremo de Irán","date":"Foto: 6 may 1981","credit":"Ali Kaveh · PD-Iran · Commons","shape":"octagon","mask":[[0.28,0],[0.73,0],[0.85,0.04],[0.93,0.15],[0.94,0.3],[0.9,0.43],[0.81,0.49],[0.78,0.68],[0.97,0.76],[1,0.99],[0,0.99],[0.03,0.77],[0.22,0.7],[0.19,0.48],[0.12,0.44],[0.08,0.33],[0.09,0.22],[0.14,0.12],[0.21,0.04]],"offset":[0,-100],"dur":8,"out":7}`

### `portrait.pair`
Dos fichas enfrentadas, cada una en su ranura. Úsala para presentar una persona con cargo, fecha y crédito.
- duración típica 7.35 s (en bucle) · estados: normal · depende de: assets/media/P01.png, assets/media/P03-soft.png, identidad-opus/assets/fonts/Archivo.ttf
- parámetros: src:string=, name:string=, role:string=, date:string=, credit:string=, side:enum=izq{izq|der}, focus:array, left:object={"src":"assets/media/P01.png","name":"Ru, right:object={"src":"assets/media/P03-soft.png","name
- ejemplo: `{"id":"demo-portrait-pair","t":0,"type":"portrait.pair","left":{"src":"assets/media/P01.png","name":"Ruhollah Jomeini","role":"Líder supremo de Irán","date":"6 may 1981","credit":"Ali Kaveh · PD-Iran · Commons"},"right":{"src":"assets/media/P03-soft.png","name":"Ronald Reagan","role":"Presidente de EE. UU.","date":"6 may 1981","credit":"Michael Evans · Casa Blanca · PD"},"dur":8,"out":7}`


## Familia range

### `range.ring`
Anillo de alcance geodésico o simbólico en pantalla, pulso y guiones móviles. Úsala para señalar un radio de alcance.
- duración típica 5.85 s (en bucle)
- parámetros: radiusMode:enum=geo{geo|screen}, radiusKm:number=180, radius:number=160, color:string=danger, pulse:boolean=true
- ejemplo: `{"id":"demo-range-ring","t":0,"type":"range.ring","at":[53,29],"radiusKm":180,"color":"danger","dur":6,"out":5.5}`


## Familia route

### `route.lanes`
Haz de carriles convergentes de pantalla con chip ajustado al punto de paso. Úsala para explicar recorridos y pasos estratégicos.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, lanes:number=5, spacing:number=14, text:string=ORMUZ
- ejemplo: `{"id":"demo-route-lanes","t":0,"via":[[50.5,28.8],[53,27],[56.4,26.4],[58.5,24.8]],"dur":6,"out":5.5,"type":"route.lanes","text":"ESTRECHO DE ORMUZ","width":1.5}`

### `route.sea`
Ruta marítima por waypoints, puntos y guiones animados; rechaza cada cruce con tierra. Úsala para explicar recorridos y pasos estratégicos.
- duración típica 5.85 s (en bucle)
- parámetros: via:array=[[49,28],[56.3,26.5],[59,24]], width:number[1..40], color:string, dash:array, punta:enum{rellena|abierta}, largoPunta:number[2..100], anchoPunta:number[2..100], camisa:boolean=true, camisaWidth:number[0..60], bando:enum=atacante{atacante|otro}, reveal:number=1, speed:number=20, points:boolean=true
- ejemplo: `{"id":"demo-route-sea","t":0,"via":[[50,28],[52,27],[54.5,26],[56.4,26.5],[57.4,25.3],[59,24.5]],"dur":6,"out":5.5,"type":"route.sea","color":"text"}`


## Familia site

### `site.base`
Base con pista y hangares; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-base","t":0,"type":"site.base","at":[50.33,29.25],"label":"base","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`

### `site.oilfield`
Campo petrolero con balancines; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-oilfield","t":0,"type":"site.oilfield","at":[50.33,29.25],"label":"oilfield","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`

### `site.plant`
Planta industrial; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-plant","t":0,"type":"site.plant","at":[50.33,29.25],"label":"plant","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`

### `site.platform`
Plataforma petrolera elevada; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-platform","t":0,"type":"site.platform","at":[50.33,29.25],"label":"platform","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`

### `site.port`
Terminal de tanques y muelle; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-port","t":0,"type":"site.port","at":[50.33,29.25],"label":"Kharg · terminal","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`

### `site.refinery`
Refinería con torres y tuberías; extrusión, sombra y daño persistente. Úsala para localizar infraestructura y mostrar su estado.
- duración típica 7.35 s (en bucle) · estados: normal/hit/burning/ruined
- parámetros: scale:number=1[0.15..4], zoomScale:boolean=true, label:string=, labelSize:number=24
- ejemplo: `{"id":"demo-site-refinery","t":0,"type":"site.refinery","at":[50.33,29.25],"label":"Abadán · refinería","dur":8,"out":7,"states":[{"at":3,"state":"hit"},{"at":3.4,"state":"burning"},{"at":6,"state":"ruined"}]}`


## Familia space

### `space.satellite`
Satélite vectorial en órbita con haz, pulsos y constelación. Úsala como recurso visual en una escena.
- duración típica 12.35 s (en bucle) · sfx: sat-link
- parámetros: label:string=, flag:string=, via:array, target:place, altitude:number=2[0..20], beam:enum=scan{scan|link|none}, pulses:boolean=true, count:number=1[1..8], spread:number=40[0..300]
- ejemplo: `{"id":"demo-space-satellite","t":0,"type":"space.satellite","via":[[49.8,28.5],[51,28.2],[52.2,27.8]],"target":[51,27.2],"beam":"scan","count":2,"spread":60,"label":"ENLACE SATELITAL","flag":"UA","dur":12}`


## Familia statement

### `statement.jump`
Salto temporal («Siete años antes») en versales espaciadas, en la ranura «salto». Úsala como recurso visual en una escena.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=Siete años antes, screen:array
- ejemplo: `{"id":"demo-statement-jump","t":0,"type":"statement.jump","text":"Siete años antes","dur":6,"out":5.5}`

### `statement.title`
Titular con barra de acento; el « · » separa el dato principal del secundario. Ranura «titular». Úsala como recurso visual en una escena.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=Abadán resiste el asedio, slot:string=titular, screen:array
- ejemplo: `{"id":"demo-statement-title","t":0,"type":"statement.title","text":"Frank C. Seitz, Jr. · capitán del Bridgeton","dur":6,"out":5.5}`


## Familia strike

### `strike.missile`
Misil de rumbo tangente con estela roja, cabeza luminosa y onHit programable. Úsala para representar un ataque desde su lanzamiento hasta el impacto.
- duración típica 4.35 s (en bucle) · sfx: missile-pass,explosion-far
- parámetros: from:place, to:place, dur:number=4, flightDur:number=2.4[0.05..], width:number=3.4[0.5..16], bend:number=0.25[-1..1], particles:number=96[8..300], seed:number|string=1, trailLife:number=0.65, onHit:object={"fx":"fx.impact"}
- ejemplo: `{"id":"strike-missile","t":0,"type":"strike.missile","from":[51.5,27],"to":[55,28.5],"dur":4,"flightDur":2.4,"seed":51,"onHit":{"fx":"fx.impact"}}`

### `strike.salvo`
Salva escalonada de hasta diez misiles con curvas en abanico e impactos programables. Úsala para representar un ataque desde su lanzamiento hasta el impacto.
- duración típica 5.35 s (en bucle) · sfx: missile-pass,explosion-far
- parámetros: from:place, to:place, dur:number=5, flightDur:number=2.4[0.05..], width:number=3[0.5..16], bend:number=0.3[-1..1], particles:number=240[8..300], seed:number|string=1, trailLife:number=0.65, onHit:object={"fx":"fx.impact"}, count:number=6[1..10], stagger:number=0.2[0..], spread:number=0.24[0..2]
- ejemplo: `{"id":"strike-salvo","t":0,"type":"strike.salvo","from":[51.5,27],"to":[55,28.5],"dur":5,"flightDur":2.4,"seed":51,"count":6,"stagger":0.2,"spread":0.24,"onHit":{"fx":"fx.impact"}}`

### `strike.shell`
Proyectil rápido con trazadora corta e impacto programable. Úsala para representar un ataque desde su lanzamiento hasta el impacto.
- duración típica 2.5 s (en bucle) · sfx: bomb-whistle,explosion-far
- parámetros: from:place, to:place, dur:number=2.15, flightDur:number=0.55[0.05..], width:number=2.8[0.5..16], bend:number=0.08[-1..1], particles:number=32[8..300], seed:number|string=1, trailLife:number=0.12, onHit:object={"fx":"fx.impact"}
- ejemplo: `{"id":"strike-shell","t":0,"type":"strike.shell","from":[51.5,27],"to":[55,28.5],"dur":2.15,"flightDur":0.55,"seed":51,"onHit":{"fx":"fx.impact"}}`

### `strike.torpedo`
Torpedo bajo el agua, estela blanca, zigzag y burbujas; impacto acuático. Úsala para representar un ataque desde su lanzamiento hasta el impacto.
- duración típica 5.949999999999999 s (en bucle) · sfx: torpedo,water-impact
- parámetros: from:place, to:place, dur:number=5.6, flightDur:number=4[0.05..], width:number=3.5[0.5..16], bend:number=0[-1..1], particles:number=96[8..300], seed:number|string=1, trailLife:number=0.85, onHit:object={"fx":"fx.impact","variant":"water"}, zigzag:number=7[0..30]
- ejemplo: `{"id":"strike-torpedo","t":0,"type":"strike.torpedo","from":[51.5,27],"to":[55,28.5],"dur":5.6,"flightDur":4,"seed":51,"onHit":{"fx":"fx.impact","variant":"water"}}`


## Familia territory

### `territory.control`
Control territorial: el lado del frente donde está el atacante se tiñe de su color y el otro lado del suyo (verde por defecto); la zona cambia de color a medida que el frente avanza o retrocede. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · estados: advance/retreat · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: via:array=[], region:string=IR, ancho:number=3[0.5..20], atacante:string, otro:string, opacity:number=1
- ejemplo: `{"id":"demo-territory-control","t":0,"type":"territory.control","region":"IR","via":[[45.58,34.52],[46.17,33.12],[48.12,32.35],[48.45,31.43],[48.18,30.44]],"states":[{"at":3,"state":"retreat","via":[[45.4,34.5],[45.85,33.3],[47.1,32.5],[47.45,31.35],[47.95,30.55]],"dur":1.5}],"dur":6,"out":5.5}`

### `territory.extrude`
Losa geográfica con canto y sombra desplazados en píxeles de pantalla. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true, depth:number=16, offset:array=[10,16]
- ejemplo: `{"id":"demo-territory-extrude","t":0,"region":"IQ","dur":6,"out":5.5,"type":"territory.extrude"}`

### `territory.fill`
Envuelve el relleno original de Atlas plano con multiply, screen y overlay. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true
- ejemplo: `{"id":"demo-territory-fill","t":0,"region":"IR","dur":6,"out":5.5,"type":"territory.fill"}`

### `territory.flag`
Bandera recortada al país, en poste, ambas o ninguna; catálogo original de 148 banderas. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true, flag:string=IR, flagMode:enum=none{fill|marker|both|none}, flagAlign:enum=screen{screen|country}, flagWidth:number=78
- ejemplo: `{"id":"demo-territory-flag","t":0,"region":"IR","dur":6,"out":5.5,"type":"territory.flag","flag":"IR","flagMode":"both"}`

### `territory.glow`
Borde neón de tres trazos sin desenfoque costoso por cuadro. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true, width:number=2, pulse:boolean=true
- ejemplo: `{"id":"demo-territory-glow","t":0,"region":"IR","dur":6,"out":5.5,"type":"territory.glow","color":"cyan"}`

### `territory.hatch`
Rayado diagonal de pantalla recortado por costa y huecos del país. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true, spacing:number=18, width:number=2
- ejemplo: `{"id":"demo-territory-hatch","t":0,"region":"IR","dur":6,"out":5.5,"type":"territory.hatch","color":"accent"}`

### `territory.state`
Cambio territorial fechado, con color interpolado y barrido direccional o radial. Úsala para explicar control territorial y cambios de frontera.
- duración típica 5.85 s (en bucle) · estados: normal/ocupado/disputado/liberado · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string=IR, color:string, opacity:number, bando:enum=atacante{atacante|otro}, border:boolean=true, state:enum=normal{normal|ocupado|disputado|liberado}, transition:enum=wipe{color|wipe|radial}, direction:enum=east{east|west|north|south}, stateColors:object={}
- ejemplo: `{"id":"demo-territory-state","t":0,"region":"IQ","dur":6,"out":5.5,"type":"territory.state","states":[{"at":1,"state":"disputado","dur":1},{"at":3,"state":"ocupado","dur":1},{"at":4.5,"state":"liberado","dur":0.8}],"transition":"wipe","note":"Estados sintéticos: no describen hechos históricos."}`

### `territory.wash`
Bandera de país completo con barrido y asentamiento translúcido; conserva islas y huecos. Úsala para explicar control territorial y cambios de frontera.
- duración típica 12.35 s (en bucle) · sfx: whoosh · depende de: ../_atlas/data/geo/admin0.geojson
- parámetros: region:string, flag:string, reveal:number=1[0.05..30], settle:number=0.28[0..1], from:enum=izq{izq|der|arriba|abajo|centro}, border:boolean=true
- ejemplo: `{"id":"demo-territory-wash","t":0,"type":"territory.wash","region":"IQ","flag":"IQ","dur":12,"reveal":1.5,"settle":0.28}`

### `territory.zone`
Zona de control con polígonos propios [lon,lat] y estados fechados: la parte que se pierde se desvanece y la ganada se enciende. Rojo translúcido al 50 % que se mantiene todo el video. Úsala para mostrar qué controla un bando (ocupación, avance, retirada). Úsa
- duración típica 7.85 s (en bucle) · estados: ocupado/recuperado
- parámetros: polygons:array, clip:array=[{"region":"UA"},{"region":"RU","box":[3, color:string, border:boolean=true, label:string, tinta:enum=rusia{rusia|ucrania}, slot:number=0[0..6], icon:enum=cuadro{cuadro|check}, legendAncho:number=340[120..600], colorBorde:string
- ejemplo: `{"id":"demo-territory-zone","t":0,"type":"territory.zone","dur":8,"out":7.5,"polygons":[[[32,44],[37.2,44],[37.2,46],[32,46]]],"states":[{"at":3,"state":"recuperado","dur":1.5,"polygons":[[[34,44],[37.2,44],[37.2,46],[34,46]]]}],"label":"CONTROL · APROXIMADO","note":"Zona esquemática sin valor histórico."}`


## Familia text

### `text.year`
Año gigante con contorno, giro y ajuste dentro del encuadre. Úsala para fechas y atribuciones.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=, size:number=180, width:number=650, height:number=220, color:string=text, fit:boolean=true, screen:array, rotation:number=0
- ejemplo: `{"id":"demo-text-year","t":0,"type":"text.year","screen":[0.5,0.24],"text":"1987","size":180,"dur":6,"out":5.5,"note":"Año ilustrativo; no representa un cambio territorial."}`


## Familia trail

### `trail.contrail`
Doble estela de condensación enganchada al path de follow; historial geográfico calculado desde t. Úsala para hacer visible la trayectoria reciente de una unidad.
- duración típica 8.35 s (en bucle)
- parámetros: follow:string=, dur:number=8, width:number=4[0.5..16], life:number=2.6[0.1..20], fadePower:number=1.4[0.1..5], separation:number=10[0..50], particles:number=24[4..150]
- ejemplo: `{"id":"trail-contrail","t":0,"type":"trail.contrail","follow":"trail-contrail","path":{"via":[[51.5,27],[53,28.6],[55,28.5]],"t":0,"dur":6,"curve":"smooth"},"dur":8,"width":4,"life":2.6}`


## Familia unit

### `unit.advance`
Avance con frente dorado y estela. Úsala para señalar posiciones y avances de fuerzas.
- duración típica 7.35 s (en bucle) · estados: idle/active/retreat/hit/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, count:number=5, formation:enum=wedge{line|wedge|column}, trail:boolean=true
- ejemplo: `{"id":"unit-advance","t":0,"type":"unit.advance","at":[48.4,30.6],"flag":"IQ","label":"FRENTE","count":5,"dur":7,"path":{"via":[[48.2,30.5],[48.6,30.7],[48.9,30.6]],"t":0.5,"dur":5,"curve":"smooth"},"states":[{"at":1,"state":"active"},{"at":5.8,"state":"idle"}]}`

### `unit.group`
Fichas en línea, cuña o columna. Úsala para señalar posiciones y avances de fuerzas.
- duración típica 7.35 s (en bucle) · estados: idle/active/retreat/hit/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, count:number=5, formation:enum=wedge{line|wedge|column}, trail:boolean=true
- ejemplo: `{"id":"unit-group","t":0,"type":"unit.group","at":[48.4,30.6],"flag":"IQ","label":"FRENTE","count":5,"dur":7,"states":[{"at":1,"state":"active"},{"at":5.8,"state":"idle"}]}`

### `unit.move`
Formación terrestre que recorre una ruta. Úsala para señalar posiciones y avances de fuerzas.
- duración típica 7.35 s (en bucle) · estados: idle/active/retreat/hit/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, count:number=5, formation:enum=wedge{line|wedge|column}, trail:boolean=true
- ejemplo: `{"id":"unit-move","t":0,"type":"unit.move","at":[48.4,30.6],"flag":"IQ","label":"FRENTE","count":5,"dur":7,"path":{"via":[[48.2,30.5],[48.6,30.7],[48.9,30.6]],"t":0.5,"dur":5,"curve":"smooth"},"states":[{"at":1,"state":"active"},{"at":5.8,"state":"idle"}]}`

### `unit.retreat`
Retirada con frente rojo discontinuo. Úsala para señalar posiciones y avances de fuerzas.
- duración típica 7.35 s (en bucle) · estados: idle/active/retreat/hit/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, count:number=5, formation:enum=wedge{line|wedge|column}, trail:boolean=true
- ejemplo: `{"id":"unit-retreat","t":0,"type":"unit.retreat","at":[48.4,30.6],"flag":"IQ","label":"RETIRADA","count":5,"dur":7,"path":{"via":[[48.2,30.5],[48.6,30.7],[48.9,30.6]],"t":0.5,"dur":5,"curve":"smooth"},"states":[{"at":1,"state":"active"},{"at":5.8,"state":"retreat"}]}`

### `unit.token`
Ficha octogonal con bandera, soldado y aro dorado. Úsala para señalar posiciones y avances de fuerzas.
- duración típica 7.35 s (en bucle) · estados: idle/active/retreat/hit/destroyed · depende de: engine/tactico/sprites/sprites.json
- parámetros: at:place, heading:number|auto=auto, scale:number=1, scaleMode:enum=screen{screen|geo}, kmLength:number, path:object, label:string=, flag:string=US, count:number=1, formation:enum=wedge{line|wedge|column}, trail:boolean=true
- ejemplo: `{"id":"unit-token","t":0,"type":"unit.token","at":[48.4,30.6],"flag":"IQ","label":"FRENTE","count":1,"dur":7,"states":[{"at":1,"state":"active"},{"at":5.8,"state":"idle"}]}`


## Familia year

### `year.big`
Año grande con subrayado de acento, en la ranura «anio» (o centrado si se da screen). Úsala como recurso visual en una escena.
- duración típica 5.85 s (en bucle)
- parámetros: text:string=1982, screen:array
- ejemplo: `{"id":"demo-year-big","t":0,"type":"year.big","text":"1982","dur":6,"out":5.5}`
