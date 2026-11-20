# imperio · NODEPOLITICS — hoja rápida

> GENERADO por `tools/components.mjs build` desde el registro vivo. No editar a mano.
Leer primero [catalog.json](catalog.json): índice corto. Después solo el contrato JSON del componente elegido en contracts/. No hace falta leer el motor ni copiar componentes de otro video.

Ejemplos de composición: [recipes.json](recipes.json). Flujo y origen de las piezas: [REUSE.md](REUSE.md).

En producción se conserva el mapa y se usan coordenadas WGS84 [longitud,latitud]. El showcase omite el mapa base para cargar rápido. Los tiempos se expresan en segundos locales o @palabra de la voz.

## Identidad y dirección obligatorias

Identidad: imperio-narrador-cinematico-v1. Un testigo cercano que reconstruye decisiones sobre el mapa: grave, curioso, preciso y con tensión contenida. Tiene criterio y sensibilidad por el coste humano; habla a una sola persona.

Conservar la voz del diseño (Charon) y su español latinoamericano. La personalidad nace de las palabras, las pausas y la intención; no cambiar locutor ni imitar personas reales.

- Abrir con una acción concreta o su consecuencia verificable y una pregunta dramática. Fecha y lugar entran cuando orientan la escena; no comenzar por rutina con año, efeméride o biografía.
- Construir cada secuencia con situación visible, decisión, obstáculo y consecuencia. El siguiente bloque cambia lo que está en juego; no encadenar una lista de hechos o fechas.
- Alternar frases breves en el peligro con frases más amplias al explicar. Usar presente escénico cuando ayude, con tiempos coherentes. Las pausas dramáticas no cortan ni ralentizan artificialmente la voz.
- La identidad se mantiene en cada video. Permitir un aparte breve cuando una decisión lo merezca: «Fíjate en esa orden» o «Aquí se les acaba el margen». Variar la formulación; no convertirlo en muletilla, chiste sobre víctimas o autopresentación.
- El narrador puede mostrar asombro, duda razonada o una observación humana sin atribuir pensamientos, diálogos, sonidos históricos ni intenciones que las fuentes no documenten.
- Evitar voz de manual escolar, biografías cronológicas, «en este video veremos», moralejas prefabricadas y cadenas repetidas de «pero». El dramatismo procede de decisiones y consecuencias documentadas.
- No reducir una guerra a un solo disparo ni una catástrofe a una sola persona. Mostrar los eslabones de la escalada. Un gancho abre una pregunta cuya respuesta llega con pruebas.
- Antes de TTS, leer el guion en voz alta y revisar cada segmento: qué veo, qué decisión avanza, qué cambia, dónde respira el narrador. Guardar voice_direction y delivery_note sin incluir instrucciones escénicas dentro del texto hablado.
- A / imperio.introv1: solo letras sobre el mapa mundial completo y legible, como el outro. Sin bandera, sol ni rayos detrás del titular.
- B / imperio.introv2: texto grande y fotografía real relevante, sujeto reconocible y palabra clave roja. Ajustar focus y lado de imagen en ambos formatos.
- C / common.tabloid (tercera apertura, no introv3): SIEMPRE texto e imagen real potente. Titular crema sobre tinta oscura, palabra clave carmesí; el rojo editorial no depende de la bandera del país.
- Elegir imágenes que se entiendan a 320 px: rostro, acción u objeto claros. Un cartel lleno de letras no es la imagen principal si hay un sujeto documental pertinente. Registrar image_review y crédito.
- Paleta nacional según el país del plano: map/sun/rays usan flag; campaign/footage/country usan flagColors. auto usa colores actuales; una época histórica exige paleta explícita verificada y SVG real de esa época.
- No usar flag:none/classic como solución genérica: conserva intencionalmente el carmesí japonés. Usar neutral cuando no corresponda una identidad nacional o falte una paleta verificada.
- Separar el rojo editorial (palabra clave, marcador, impacto) de los colores nacionales (bandera, sol y rayos). Ningún efecto convierte colores decorativos en una bandera auténtica.
- Cada giro utiliza una pieza que lo explica: city para el lugar, arrow para avance/orden, country/flag para actores, territory para control, date para plazo, campaign para la cadena de decisiones. Añadir piezas compartidas con contrato y demo solo si falta una función; nunca duplicar motor por episodio.
- Dirigir música por actos: intriga, escalada, clímax y coste humano. Usar pistas de biblioteca con licencia, a nivel bajo con ducking, entradas y salidas de 2–3 s y silencios deliberados. La música acompaña varios tramos, no queda relegada al outro.
- Reservar efectos breves para una marca, llegada, orden, giro o impacto narrado. Los ambientes de una foto/clip cubren toda su ventana; los golpes puntuales siguen el instante de la acción. No añadir whoosh a todas las piezas.
- Conservar voz limpia en audio.narrationSrc. Mezclar voz + stem SFX + stem musical una sola vez; nunca reutilizar como voz una mezcla anterior. Registrar planes, recursos, licencias, créditos y escucha de palabras inteligibles.
- En fase storyboard, el agente aislado declara work/music-plan.json: {version:1,cues:[{music_asset_id:auto,mood:cinematic,start:0,source_in:0,duration:20,gain_db:-24,fade_in:2,fade_out:3,purpose:intriga}]}. Escribir JSON con claves y cadenas entre comillas; los segundos salen de lyrics.json. auto resuelve una pista instrumental con licencia del perfil. El host ejecuta el plan al crear manifest y bloquea con un error claro si no hay recurso válido; el agente no ejecuta CLI ni descarga. Cambiar mood a tension, suspense, drama, epic o reflective según la escena.
- Revisar aperturas A/B/C a 320 px y ambos formatos; B/C requieren foto real reconocible y acento rojo.
- Muestrear planos de Alemania y otros países: los colores nacionales no deben volver al rojo/blanco japonés por un valor forzado.
- Escuchar transiciones y puntos clave con música/SFX: voz inteligible, sin clipping ni huecos añadidos; conservar pruebas y consumo conocido.

## Componentes

- **imperio.title**: Apertura (ref 0–11 s): atlas físico con el país foco rayado y el SOL carmesí que late; la cámara se aleja y gira apenas; nacen los RAYOS translúcidos en abanico hacia `dir` con barquitos; el título en su IDIOMA ORIGINAL (kanji, alemán, ruso…) entra carácter por carácter con su traducción tipeada debajo y se borra de derecha a izquierda; después el título condensado blanco SUBE desde abajo con degradé. [Entradas JSON](contracts/imperio.title.json).
- **imperio.map**: Atlas físico en movimiento lento (zoom y giro leve) sobre un país o región: territorio rayado, sol que late, rótulos de mares, rayos opcionales y PINES (punto carmesí + nombre) para lugares concretos (una base, una ciudad, un puerto). [Entradas JSON](contracts/imperio.map.json).
- **imperio.expansion**: Expansión: desde el sol del país foco salen HACES carmesí translúcidos hacia cada región destino, uno tras otro; al llegar, la región se raya (territorio ocupado) y aparece su nombre en condensada blanca. [Entradas JSON](contracts/imperio.expansion.json).
- **imperio.archive**: Material de archivo (ref 11.5–27.7 s): el atlas se DESATURA a gris, baja humo oscuro desde arriba y la foto en blanco y negro se FUNDE en multiplicar con el mapa (lo claro deja ver el mapa, lo oscuro lo tapa); los rayos carmesí siguen encima, rosa de los vientos fina abajo a la derecha, grano y polvo; la cámara sigue alejándose. [Entradas JSON](contracts/imperio.archive.json).
- **imperio.word**: Título condensado BLANCO (Fjalla One) sobre el plano en curso: cada renglón SUBE desde abajo con degradé de opacidad (arriba aparece primero) y desenfoque, y después el título se ACHICA lento y exponencial (rápido al principio) mientras el mapa sigue moviéndose (ref 10–27 s: 'JAPANESE EMPIRE'). [Entradas JSON](contracts/imperio.word.json).
- **imperio.native**: Nombre en su IDIOMA ORIGINAL (kanji, alemán, ruso, árabe latinizado…) en gris grande: cada carácter entra con escala y desenfoque escalonados, la traducción en mayúsculas negras se tipea debajo, y al final se borra de derecha a izquierda (ref 4.9–9.9 s: '南進論 · SOUTHERN EXPANSION DOCTRINE'). [Entradas JSON](contracts/imperio.native.json).
- **imperio.introv1**: Apertura A de solo texto sobre el mapa del mundo completo, como el cierre v1, sin sol, rayos ni bandera. [Entradas JSON](contracts/imperio.introv1.json).
- **imperio.introv2**: Apertura B de texto e imagen: fotografía grande, titular blanco en campo oscuro y palabra clave sobre carmesí. [Entradas JSON](contracts/imperio.introv2.json).
- **imperio.outro**: Cierre v1 con mapa del mundo completo que se aleja y oscurece, en los colores de Imperio. [Entradas JSON](contracts/imperio.outro.json).
- **imperio.outrov2**: Outro v2: GRACIAS POR VER un 45 % más grande, letras en negrita y fondos rojo sangre oscuro en LIKE y SUSCRÍBETE. [Entradas JSON](contracts/imperio.outrov2.json).
- **imperio.campaign**: Campaña en UN plano continuo: la cámara vuela entre destinos (`cameras`); desde el país foco salen flechas gruesas hacia cada destino y llegan justo cuando la voz lo nombra (`time: "@palabra"`). [Entradas JSON](contracts/imperio.campaign.json).
- **imperio.footage**: Material de archivo en VIDEO (en vez de foto): el atlas se desatura a gris, baja humo oscuro y el clip mudo se funde en blanco y negro, en multiplicar, con el mapa; el sol y los rayos carmesí siguen encima. [Entradas JSON](contracts/imperio.footage.json).
- **imperio.date**: Fecha o rango de años blanco con subrayado carmesí; es el sello de la esquina del video, ahora reutilizable por JSON.. [Entradas JSON](contracts/imperio.date.json).
- **imperio.country**: País del video: territorio marcado, bandera circular, nombre y fecha. [Entradas JSON](contracts/imperio.country.json).
- **imperio.flag**: Bandera circular con aro, rebote y chapa con el nombre del país; se retira después de hold segundos. [Entradas JSON](contracts/imperio.flag.json).
- **imperio.city**: Punto de ciudad con pulso y nombre en chapa carmesí, como Pekín, Shanghái o Singapur en el video. [Entradas JSON](contracts/imperio.city.json).
- **imperio.arrow**: Flecha gruesa de avance con degradado y borde blanco. [Entradas JSON](contracts/imperio.arrow.json).
- **imperio.territory**: Territorio que aparece en carmesí con borde y pulso. [Entradas JSON](contracts/imperio.territory.json).
- **imperio.caption**: Pie de archivo en Montserrat itálica con fundido; mismo rótulo de lugar y año de las fotografías y clips del video.. [Entradas JSON](contracts/imperio.caption.json).
- **imperio.sun**: Marca circular que late sobre el país o coordenadas elegidas, con su paleta nacional o histórica explícita; comparte el dibujo de imperio.map.. [Entradas JSON](contracts/imperio.sun.json).
- **imperio.rays**: Abanico geográfico con los colores del país foco: rumbo, apertura, cantidad, longitud y entrada por voz. [Entradas JSON](contracts/imperio.rays.json).
- **imperio.ships**: Barcos pequeños que avanzan sobre las rutas del abanico. [Entradas JSON](contracts/imperio.ships.json).
- **imperio.compass**: Rosa de los vientos de línea fina que acompaña el giro del mapa; es la del archivo original.. [Entradas JSON](contracts/imperio.compass.json).
- **common.flash**: Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido.. [Entradas JSON](contracts/common.flash.json).
- **common.lyric**: Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave.. [Entradas JSON](contracts/common.lyric.json).

Antes de crear otro componente, consultar este índice. Cambiar datos, medios, destinos y tiempos; reutilizar imperio.campaign para varias capas con la misma cámara. date y caption son overlays; las piezas geográficas son planos con mapa.

Validación de un episodio: kit.py check <id> y revisión de ambas orientaciones. Consultar guides/imperio-production.md para medios y sonido. El cierre se elige con config.outro.use; no duplicarlo en el storyboard.
