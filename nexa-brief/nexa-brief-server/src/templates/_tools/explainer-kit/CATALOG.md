# Catálogo de componentes del explainer-kit

> GENERADO por `tools/catalog.py` desde el registro (`Kit.register`). No editar a mano.
> Cada componente se usa en `storyboard.json` como `{ "at": "palabras ancla", "use": "nombre", "params": {…} }`.
> Los parámetros numéricos aceptan `"@palabra"` = segundos desde el inicio del beat hasta que la voz dice esa palabra.

| componente | capa | para qué |
|---|---|---|
| `common.punch` | main | Palabra o frase GIGANTE a pantalla (momento de alto impacto, como las plantillas de música): letras que caen con desenfoque y se asientan; '^palabra^' va en color de acento. |
| `common.tag` | overlay | Rótulo de contexto (lugar · fecha · dato) en mono mayúsculas, arriba o abajo del cuadro; entra escribiéndose. |
| `common.flash` | overlay | Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido. |
| `common.endcard` | main | Tarjeta final sobria: frase de cierre grande, línea y firma de marca (canal / suscribirse). |
| `common.lyric` | main | Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave. |
| `common.logo` | main | Obsoleto: el logo debe acompañar una foto o video con el parámetro logo del componente visual. |
| `common.clip` | main | Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Toma el tratamiento de color del diseño (design.json → defaults.clip); rótulo opcional abajo. |
| `binary.title` | main | Título de apertura GIGANTE hecho de 0 y 1 (~80% del cuadro, estilo cartel: cada renglón ocupa todo el ancho) con antetítulo y línea; las partículas convergen desde el polvo. |
| `binary.word` | main | Palabra o número grande hecho de glifos (momentos de alto impacto: '159 TRILLONES', '1952'), con rótulo arriba y nota abajo. |
| `binary.portrait` | main | Retrato (o cualquier foto) reconstruido como grilla de 0 y 1: el brillo de la imagen define la opacidad de cada dígito. Pie de foto y contador de años opcionales. |
| `binary.icon` | main | Silueta de un objeto hecha de glifos (bombilla, llave, barco, submarino, manzana, reloj…), con etiqueta tipo 'tag' y pie. |
| `binary.orbit` | main | Ciclo: forma central de glifos dentro de un anillo punteado con 2-6 etapas alrededor; un punto recorre el anillo y la etapa activa se ilumina. |
| `binary.grid` | main | Grilla de N copias de una forma que van apareciendo una a una con un contador ('VERSIONES 08'): muestra repetición, escala o cantidad. |
| `binary.chart` | main | Curva de datos hecha de glifos que se dibuja de izquierda a derecha sobre ejes finos; etiqueta en el punto final ('DÍAS → HORAS'). |
| `binary.tunnel` | main | Túnel de anillos concéntricos de glifos que gira y avanza hacia la cámara: pausa dramática, viaje en el tiempo, 'entrar' en una idea. |
| `binary.rays` | main | Haz de líneas de glifos que salen de un punto: abanico de caminos posibles, 'X' de contradicción o estallido radial; se dibujan del centro hacia afuera. |
| `binary.frame` | main | Foto real (blanco y negro) dentro de un marco de glifos punteado, con título en serif y ficha mono: documento histórico, lugar, objeto real. |
| `binary.bubble` | main | Globo de diálogo de contorno con tres puntos que 'escriben' (esperar una respuesta, una pregunta en el aire). |
| `binary.floor` | main | Piso infinito en perspectiva hecho de filas de glifos que se desplazan hacia la cámara (vacío, inmensidad, final reflexivo). |
| `binary.introv1` | main | Miniatura de solo texto en el estilo monocromo de binary: el título hecho de partículas 0/1, en blanco puro, con la fecha en letras blancas encima. |
| `binary.introv2` | main | Miniatura de texto e imagen: la frase (como en introv1, más chica) en una mitad y el retrato en glifos 0/1 en la otra; el lado de la foto se elige con imageSide. |
| `binary.counter` | main | Número que se arma dígito a dígito como una tragamonedas (slot) o que cuenta hasta su valor (count), entre dos reglas de glifos: cifras enormes, años, cantidades. |
| `binary.cipher` | main | Mensaje que se cifra letra por letra: texto claro arriba, columna de glifos que 'pasa por la máquina' y letra cifrada abajo en caja. Con mode='crib' muestra una frase conocida alineada bajo el cifrado (la llave). |
| `binary.rotors` | main | Rotores/tambores de glifos que giran a distinto ritmo: con pocos (1-5) muestran el abecedario y la letra activa en una ventana (Enigma); con muchos (6-120) forman una batería de tambores girando a la vez (la Bomba). |
| `binary.timeline` | main | Línea de tiempo de glifos (vertical en 9:16, horizontal en 16:9) con hitos que aparecen al pasar el trazo; el hito `active` queda resaltado con caja y pulso. |
| `binary.versus` | main | Dos formas enfrentadas (persona ↔ máquina, prisión ↔ tratamiento) con un símbolo en el medio ('?', 'VS', '='); lado a lado en 16:9, una sobre otra en 9:16. `pick` resalta la elegida. |
| `binary.convoy` | main | Mar de glifos visto desde arriba con un convoy de barcos que cruza y submarinos al acecho. mode: attack (un barco se hunde), reroute (el convoy cambia de rumbo a tiempo), hunt (los submarinos quedan marcados y desaparecen). |
| `binary.banknote` | main | Un billete hecho de glifos 0/1: marco doble, medallón ovalado con un retrato muestreado y el valor grande a la izquierda. Sirve para el momento en que un personaje 'termina en un billete'. |
| `binary.wall` | main | Muro de ladrillos hechos de glifos con alambre arriba. mode=build lo levanta fila por fila; stand lo muestra quieto (división, encierro); break abre una brecha en el centro en `breakAt` y los fragmentos caen. |
| `binary.chessboard` | main | Diagrama de ajedrez con piezas vectoriales y jugadas UCI animadas; muestra aperturas y momentos concretos de una partida. |
| `binary.chesspiece` | main | Pieza de ajedrez con siluetas SVG trazadas en dígitos 0/1 generados por Canvas; permite elegir entre los dos caballos de referencia. |
| `binary.searchtree` | main | Árbol esquemático de jugadas posibles con una ruta destacada; sirve para explicar búsqueda y evaluación sin afirmar que sea un registro literal del cálculo. |
| `binary.outrov1` | main | Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa. |
| `binary.outro` | main | Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa. Alias compatible para binary.outro. |
| `common.tabloid` | main | Miniatura e intro tabloide con foto o video mudo; focus protege la zona de interés del medio. |
| `common.question` | overlay | Tarjeta grande para la pregunta final del video; ocupa el acto completo y se adapta a 9:16 y 16:9. |
| `rough.title` | main | Título de apertura GIGANTE (cartel: cada renglón al ancho total, ~80% del cuadro): las letras se dibujan en contorno y se rellenan; antetítulo en etiqueta lima, subtítulo debajo y subrayado a mano. Puede parpadear como alarma. |
| `rough.icon` | main | Boceto de un objeto (diccionario rough/sketches.js) que se dibuja trazo a trazo; relleno rayado lima opcional, etiqueta arriba y nota manuscrita abajo. |
| `rough.photo` | main | Foto real en blanco y negro (o virada a lima) que se revela con un barrido dentro de un marco dibujado a mano con cintas; nombre manuscrito y ficha mono debajo. Zoom lento (Ken Burns). |
| `rough.annotate` | overlay | Marca a mano ENCIMA de lo que hay en pantalla: círculo, subrayado, flecha, caja o tachado, en lima, sobre una zona del cuadro de contenido; texto manuscrito opcional al lado. |
| `rough.introv1` | main | Miniatura de solo texto con el tratamiento a mano de rough: título enorme, línea lima y antetítulo opcional. |
| `rough.introv2` | main | Miniatura de texto e imagen al estilo de las miniaturas de tecnología: título enorme alineado a la izquierda y una foto o video grande a color que se funde con el fondo (en 9:16 va arriba). |
| `rough.flow` | main | Cadena de 2-5 pasos (boceto + rótulo) unidos por flechas a mano que aparecen en orden: causa → efecto, un proceso, un sistema. `active` resalta un paso en lima. |
| `rough.compare` | main | Comparación de escala por ÁREA: un cuadrado diminuto (lo chico, en lima) dentro de uno enorme (lo grande). Para 'millones de veces más': el chico queda casi un punto. Con valores y flecha manuscrita. |
| `rough.stack` | main | Pila de tareas en cajas a mano; en `dropAt` las que no se conservan se tachan y caen, y las importantes suben y se pintan de lima. Para prioridades, triage, 'soltar lo secundario'. |
| `rough.dsky` | main | Panel de la computadora del Apolo (DSKY) dibujado a mano: luces de aviso, pantalla PROG/VERB/NOUN y teclado. El código (p. ej. 1202) aparece en lima y parpadea con la luz PROG encendida. |
| `rough.rope` | main | Memoria de cuerda (core rope): anillos magnéticos en fila y un alambre que se teje: si ATRAVIESA el anillo es 1, si lo RODEA es 0. Los bits aparecen debajo a medida que pasa el alambre. |
| `rough.gauge` | main | Indicador semicircular a mano con aguja y número grande que baja (o sube) de `from` a `to`: combustible, tiempo que queda, presión. La zona crítica final parpadea en lima. |
| `rough.descent` | main | Vista lateral de un descenso: suelo lunar a mano con cráter y rocas, el módulo lunar bajando por su trayectoria. mode=auto va directo al cráter; mode=manual se desvía en el último tramo hasta una zona plana marcada con X. |
| `rough.tally` | main | Algo que se repite N veces: boceto que se sacude en cada repetición, palotes a mano (|||| tachados de a 5) y contador grande '×N'. |
| `rough.choice` | main | Dos (o tres) opciones en cajas a mano; en `pickAt` la elegida se pinta de lima con un ✓ y las otras se tachan. Para decisiones bajo presión (ABORTAR / SEGUIR). |
| `rough.timeline` | main | Línea de tiempo a mano (vertical en 9:16, horizontal en 16:9) con hitos que se marcan al pasar el trazo; el hito `active` va en lima con círculo a mano. |
| `rough.load` | main | Un recipiente vertical (la máquina) se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan fuera temblando y el borde se raya en lima con un rótulo grande de desborde. |
| `rough.note` | main | Hoja de papel dibujada a mano con un título mecanografiado y renglones de texto garabateado; en `noteAt` aparece una nota manuscrita en lima en el margen (un comentario, una firma, 'vago, pero emocionante'). |
| `rough.network` | main | Red que crece: un nodo central y nodos que aparecen en anillos, unidos por enlaces a mano (documentos que se enlazan, la web, una comunidad). Los primeros nodos pueden llevar rótulo; el central va en lima. |
| `rough.browser` | main | Ventana de navegador dibujada a mano: la dirección se escribe letra a letra en la barra, aparece la página (título + renglones) y un cursor hace clic en un enlace lima en `clickAt`. |
| `rough.counter` | main | Cifra GIGANTE que cuenta de `from` a `to` (con separador de miles) y queda subrayada a mano; etiqueta lima arriba y unidad manuscrita abajo. Para cifras de escala: usuarios, sitios, años, dinero. |
| `rough.outrov1` | main | Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida. |
| `rough.outro` | main | Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida. Alias compatible para rough.outro. |
| `acuarela.title` | main | Apertura 'THE HISTORY': título condensado en rojo ladrillo con rayas finas a ambos lados y subtítulo, sobre una gran mancha de acuarela que es una foto lavada (florece desde varios focos) y bloques manuscritos. |
| `acuarela.photo` | main | Una foto de archivo con marco (estampilla o copia vieja) que entra deslizándose y se asienta, mancha-foto que florece detrás, fecha grande con raya fina y párrafo corto que aparecen por tinta. layout: top (fecha centrada arriba), right (fecha abajo a la derecha), left (fecha abajo a la izquierda). |
| `acuarela.pair` | main | Dos fotos superpuestas (la segunda tapa el borde de la primera y llega un instante después) + fecha y párrafo; mancha-foto y manuscrito detrás. layout: above (texto arriba, fotos abajo), right (fotos a la izquierda, fecha arriba a la derecha; entra girada con zoom), below (fotos arriba, fecha abajo), center (fotos lado a lado, fecha centrada; entra con zoom hacia atrás), dual (dos fechas, una por foto). |
| `acuarela.quote` | main | Retrato vertical (copia vieja) que entra desde la izquierda achicándose, cita en sans condensada a su derecha que aparece por manchas, firma en rojo ladrillo y una 'isla' de mancha-foto detrás. |
| `acuarela.introv1` | main | GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: blots | wash | timeline | manuscript | image con src | component con use/useParams); por defecto manchas de tinta y acuarela que florecen sobre el papel y manuscrito que se escribe. Titular GIGANTE en Oswald ladrillo: cada palabra cae y se revela 'comida' por una máscara de tinta que sangra, con sacudida y gotitas; '^palabra^' queda calada en una mancha de tinta negra. En dropAt cae una gota: salpica, una aguada sepia florece detrás y un pincel subraya. Subtítulo manuscrito. |
| `acuarela.introv2` | main | GANCHO pregunta + revelación. Fondo adaptable al tema (bg: manuscript | blots | wash | timeline | image con src | component con use/useParams); por defecto una página manuscrita con renglones y margen ladrillo donde cae una gota que se expande. Rótulo tipo fecha que se revela comido por tinta con su raya. La pregunta GIGANTE se escribe letra a letra con tinta fresca (una gota de pluma avanza delante) y la respuesta llega como una PINCELADA de acuarela ladrillo que barre con el texto calado en papel, con sacudida y salpicadura. |
| `acuarela.outro` | main | Cierre del canal SIN recuadro (bg: wash | blots | timeline | manuscript | image con src | component con use/useParams): por defecto papel con una aguada sepia que barre y pinceladas que chorrean. GRACIAS POR VER con rayas → nombre del canal GIGANTE en Oswald ladrillo que la tinta 'come' sobre una aguada que florece, subrayado a pincel y firma manuscrita → pulgar a tinta que se llena de acuarela ladrillo al marcar LIKE + círculo a pincel → flecha a pincel → pincelada SUSCRÍBETE con el texto calado + campana a tinta que suena → mensaje de apoyo por manchas → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `carta.retrato` | main | Retrato con borde de pincel a la izquierda; a la derecha rótulo en caja crema, sello de correo, fechas, título enorme con regla y subtítulo; la foto se repite fantasma detrás de los textos (panel 'THE BEST WISHES / HISTORICAL'). |
| `carta.sello` | main | Variante del retrato: foto a la izquierda, rótulo en caja, sello, título grande al centro-derecha, fechas, regla y subtítulo grueso debajo (panel 'PHOTOGRAPHY 1945-1948 HISTORICAL'). |
| `carta.postal` | main | Postal de un lugar: rótulo y fechas arriba a la izquierda, caja de texto tipeado con doble borde, foto ancha a la derecha, título gigante abajo con segundo renglón corrido y regla (panel 'VENEZIA / ITALY'). |
| `carta.familia` | main | Foto de grupo abajo a la izquierda; arriba rótulo, firma manuscrita y caja de texto; a la derecha fechas y título de dos renglones alineado a la derecha (panel 'MY FAMILY / LOVELY'). |
| `carta.memoria` | main | Foto a la izquierda; rótulo en caja crema a la derecha, fechas, título grande que pisa la foto y subtítulo corto con firma (panel 'OUR HISTORY / DO NOT FORGET / ABOUT IT'). |
| `carta.recuerdo` | main | Dos rótulos grandes apilados a la izquierda entre reglas, fechas, foto a la derecha y título grueso abajo a la derecha (panel 'OUR HISTORY / FAST RENDERING / ABOUT IT'). |
| `carta.album` | main | Foto grande a la izquierda; arriba a la derecha fechas, caja de texto tipeado y título de dos tamaños abajo a la derecha (panel '1950-1968 / MY LIFE / MY FAMILY'). |
| `carta.nota` | main | Rótulo en caja arriba a la izquierda, caja de texto debajo, título grande con regla, fechas y foto vertical a la derecha (panel 'EASY TO EDIT / HISTORICAL / 1945-1948'). |
| `carta.ficha` | main | Ficha de persona: retrato a la izquierda; a la derecha título, subtítulo y fechas apilados a la derecha, caja de texto y regla (panel 'HISTORICAL / MAYR KETMAN / 1945-1948'). |
| `carta.ciudad` | main | Título enorme con regla, subtítulo y fechas a la izquierda; paisaje ancho a la derecha revelado con salpicaduras de tinta alrededor (panel 'OUR CITY / HAPPY DAYS'). |
| `carta.proyecto` | main | Foto vertical a la izquierda; título enorme arriba, subtítulo, caja de texto tipeado y fechas abajo (panel 'CS 5 PROJECT / HAPPY DAYS'). |
| `carta.dato` | main | Dato: título con regla, cifra destacada, texto tipeado suelto, fechas entre reglas y foto a la derecha (panel 'HIGH RESOLUTION / 1920X1080'). |
| `carta.perfil` | main | Perfil: retrato a la izquierda, nombre, ciudad y fechas escalonados, texto tipeado suelto y un segundo título abajo con regla (panel 'JESICA VRUBLER / PARIS / BIG FAMILY'). |
| `carta.frente` | main | Título con regla arriba a la izquierda, subtítulo, fechas tenues, caja de texto, segundo título abajo y foto ancha a la derecha (panel 'EASY TO EDIT / GERMANY / WORLD WAR'). |
| `carta.title` | main | Portada: título de máquina de escribir enorme + subtítulo alineado a su derecha dentro de una caja crema, bajada pequeña, y letras fantasma gigantes al fondo. Por defecto entra volando desde el lente (apertura y cierre de la referencia). |
| `carta.introv1` | main | GANCHO de apertura (lo primero que se ve). La cámara vuela desde el lente hasta la gran hoja de papel viejo (bg: hoja | sobre | bokeh | image con src | component con use/useParams). Por defecto 'hoja': la cámara viaja por la hoja, dos fotos sepia se revelan con borde de pincel quemado, una carta se escribe sola, estampilla con matasellos y firma. El titular GIGANTE de máquina de escribir llega palabra por palabra desde delante del lente (escala, desenfoque y sacudida); '^palabra^' va en un rótulo crema de doble borde con subrayado de pluma. Momento de impacto: un MATASELLOS golpea encima (sealAt) con salpicadura de tinta. Sale volando hacia el lente. |
| `carta.introv2` | main | GANCHO pregunta + revelación. Una hoja de carta entra a la máquina y la pregunta se TIPEA tecla a tecla (cada golpe sacude la hoja, cursor de tipos); después un SELLO de goma entintado golpea encima con la respuesta, con salpicadura y sacudida. Fondo adaptable (bg: sobre | hoja | bokeh | image con src | component con use/useParams); por defecto un sobre lacrado que se abre y deja salir la carta escrita. |
| `carta.outro` | main | Cierre del canal SIN recuadro sobre la gran hoja de papel viejo (bg: hoja | sobre | image con src | component con use/useParams). 'gracias por ver' manuscrito con pluma → nombre del canal que llega volando desde el lente entre dos reglas y con rúbrica → estampilla LIKE que recibe un matasellos (queda marcada y el pulgar se entinta) → flecha a pluma → sello de goma SUSCRÍBETE + campana de tinta que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `collage.intro` | main | Apertura de HEMEROTECA: masthead NODETECH, fecha de archivo, año grande y titular sobre papel claro con reglas bordó. |
| `collage.title` | main | Alias compatible de collage.intro; usa la nueva apertura de archivo. |
| `collage.board` | main | El plano tipo: mesa de papel de diario con fotos de borde blanco viradas (B/N, verde azulado, rosa, sepia), recortes, sellos y moneda; año en serif bordó con fecha chica; recorte con titular opcional. La cámara se desliza (move) con paralaje y las fotos secundarias entran escalonadas. |
| `collage.date` | main | Fecha/cifra protagonista: número grande en serif bordó (cuenta desde `from` si se da) con fecha chica arriba y una línea en versalitas debajo, sobre el collage con 2 fotos que entran por el costado. |
| `collage.banner` | main | Banda oscura translúcida que cruza el collage con un titular en serif romana mayúscula (como 'GLUBB PASHA FLIES HOME'), retrato pequeño al final de la banda y fotos debajo; cámara en diagonal. |
| `collage.headline` | main | Página de diario en primer plano: foto grande con filete, bajada en itálica, regla y titular grande en serif negra bordó; foto rosada desenfocada al costado. Pensado para salir con el plano siguiente en tin:'dive' (la cámara se zambulle en el titular). |
| `collage.map` | main | Mapa antiguo (costas, retícula, ríos, fronteras punteadas) con lugares rotulados y rutas rojas que se trazan solas; foto recortada de bordes suaves encima (paralaje) y una lupa de bronce que recorre el mapa. |
| `collage.panels` | main | Paneles de color apagado (violeta, verde azulado, mostaza, oliva) con titular, bajada y foto, que caen sobre un mapa desde cerca de cámara de a uno (entrada escalonada). Para listas, comparaciones (2) o hitos (3–4). |
| `collage.ribbon` | main | Columna central: foto arriba, cinta bordó con volutas ornamentales y texto crema, foto abajo; a los costados fotos grandes desenfocadas y estelas de fuegos artificiales/destellos. Para celebraciones y momentos solemnes. |
| `collage.tribute` | main | Homenaje sobrio: foto en óvalo que se funde con el papel, fecha chica y titular bordó sobre una regla, bruma rosada y pétalos rojos que caen (algunos grandes y desenfocados, cerca de cámara). |
| `collage.portraits` | main | Página de libro con un gran medallón: 2–4 retratos en óvalos viñeteados (virados verde azulado/sepia), adornos rojos y un título en versalitas; la cámara se aleja y gira como al levantar el libro. |
| `collage.emblem` | main | Emblema conmemorativo: sobre cielo desenfocado, un número/año dorado en 3D entra girando letra por letra, cinta bordó en arco con el título, libro abierto de línea y bajada; el fondo se aclara a blanco. |
| `collage.leak` | overlay | Cortina de luz cálida (fuga de película) que barre el cuadro para marcar un golpe o una frase clave. Se suma a la lente global (modo pantalla). |
| `collage.introv1` | main | GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: table | sky | map | press | image con src | component con use/useParams); por defecto la mesa de archivo en plano secuencia con paralaje, recortes y fotos que caen y se apilan, bokeh y fugas de luz. Una banda oscura se desliza y el titular GIGANTE en romana cae palabra por palabra como un recorte (escala + desenfoque + sacudida + chispas); '^palabra^' va en dorado 3D. En flashAt, ráfaga de luz cálida: la cámara se adelanta y el dorado destella. |
| `collage.introv2` | main | GANCHO 'primera plana'. Fondo adaptable al tema (bg: map | table | sky | press | image con src | component con use/useParams); por defecto un mapa antiguo con rutas rojas que se trazan y una lupa de bronce. Una hoja de diario cae sobre la mesa, la pregunta se IMPRIME letra a letra en titular negro con cursor, las columnas aparecen, y la respuesta llega en una CINTA bordó con volutas que golpea encima con destello y chispas doradas. |
| `collage.outro` | main | Cierre del canal SIN recuadro (bg: table | sky | map | press | image con src | component con use/useParams): por defecto la mesa de archivo en plano secuencia, oscurecida. GRACIAS POR VER en versalitas doradas → nombre del canal en DORADO 3D que entra girando letra por letra y destella → recorte LIKE que se presiona y queda marcado con un círculo de tinta roja → ruta punteada roja → cinta bordó SUSCRÍBETE que cae + campana dorada que suena → apoyo en itálica palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada. |
| `cronica.slide` | main | Diapositiva de archivo en 3D (la escena principal de la referencia): foto B/N con borde de pincel rasgado que se pinta a trazos, año o dato corto en un rótulo gris pincelado y párrafo serif blanco, rodeados de capas tenues (fotos fantasma, letra gigante, bloquecitos con barra, líneas con nodos). La cámara la mira en perspectiva oblicua con profundidad de campo; si el beat es largo, CORTA a un ángulo cercano a mitad (rack focus). |
| `cronica.quote` | main | Cita en itálica (la escena '1942' de la referencia): año en itálica en su rótulo, párrafo itálico justificado al centro, un retrato grande y tenue a la izquierda (más cerca de cámara, desenfocado) y otra foto rasgada a la derecha. Cámara oblicua con corte a plano cercano si es largo. |
| `cronica.verse` | main | Frase narrada en grande con la tipografía de los párrafos de la referencia: cada palabra se enfoca (desenfoque → nítido) en el instante en que la voz la dice, sobre el decorado en capas (fotos fantasma, letra gigante, líneas). Rótulo gris opcional arriba. Cámara oblicua con rack focus. |
| `cronica.title` | main | Tarjeta de título (como 'ENVATO PRESENTS' de la referencia): mayúsculas serif espaciadas al centro, que aparecen letra a letra desde el desenfoque mientras la cámara hace rack focus; detrás, dos fotos tenues rasgadas a distinta profundidad, líneas finas con nodos y bloquecitos de texto. También sirve como portada de capítulo. |
| `cronica.introv1` | main | GANCHO de apertura en el espacio 3D de la crónica. Fondo adaptable (bg: archivo | linea | letras | proyector | image con src | component con use/useParams | none); por defecto papeles rasgados, fotos fantasma, bloquecitos y red de líneas flotando con profundidad de campo. Titular GIGANTE en serif: cada palabra cae desde muy cerca de la cámara (enorme y desenfocada) y entra en foco con una sacudida seca; '^palabra^' va en itálica sobre el rótulo gris pincelado. En cutAt: CORTE SECO a otro ángulo con rack focus, las letras gigantes del fondo se alinean y se barre una pincelada gris bajo el titular. |
| `cronica.introv2` | main | GANCHO pregunta + revelación. Fondo adaptable (bg: linea | archivo | letras | proyector | image con src | component con use/useParams | none); por defecto una línea de tiempo con rótulos de años que se pierde en profundidad. La pregunta (mayúsculas serif espaciadas) se revela letra a letra desde el desenfoque con una rayita '_' que avanza; en stampAt CORTE SECO a otro ángulo y la respuesta llega en un gran rótulo gris pincelado que se barre, más cerca de cámara: el foco salta de la pregunta a la respuesta (rack focus). |
| `cronica.outro` | main | Cierre del canal SIN recuadro en el espacio 3D de la crónica (bg: proyector | archivo | letras | linea | image con src | component con use/useParams | none). GRACIAS POR VER desde el desenfoque → nombre del canal grande cuyas letras llegan dispersas desde la profundidad y se alinean con rack focus, con el rótulo gris barriéndose debajo → rótulo LIKE que se presiona (gris → blanco) → línea fina con nodos a modo de flecha → placa SUSCRÍBETE de papel rasgado + campana que suena → apoyo en itálica → youtube.com/@canal. Tiempos sincronizables con la despedida narrada. |
| `enmienda.word` | main | Golpe de texto del documental: palabra/frase en condensada MUY gruesa con textura de tipo móvil gastado sobre negro. Entradas: erosión (polvo por vetas), desenfoque, barrido, volteo con destello, golpe seco. Salidas: erosión, desenfoque, 'palomas' (se rompe en recortes que vuelan) o corte. Marcas a pincel (cruz, círculo, garabato, subrayado) o mira telescópica. |
| `enmienda.slats` | main | Numeral gigante (romano o cifra) armado con listones de papel que entran deslizándose en vertical sobre un documento manuscrito tenue con marcas de conteo (||||/); al final la cámara gira y se zambulle en los listones (empalma con enmienda.plaque in:'dive'). |
| `enmienda.plaque` | main | Tablero de listones blancos con letras negras de esténcil gastado (tipo 'ABOLITION OF SLAVERY'), iluminado al centro. Entra girando desde muy cerca (empalme con slats) y se aleja despacio; puede tachar renglones con cinta negra que se pega en stop-motion. |
| `enmienda.cards` | main | Cartulinas blancas con palabras en tinta negra de rodillo, pegadas con cinta negra sobre papel gris arrugado; aparecen una por una en stop-motion (como 'KEEP THESE PRISONS FILLED'). Puede tachar con cinta o, en modo 'pile', llover hojas que se apilan. |
| `enmienda.letter` | main | Aviso de diario en papel blanco con viñeta: titular en serif condensada negra; barrido rápido (latigazo con desenfoque) hasta el cuerpo del texto y una nota manuscrita que se escribe sobre la línea de firma. |
| `enmienda.document` | main | Documento oscuro: párrafo en condensada gris cuyas palabras aparecen en desorden (parpadeando) sobre una imagen fantasma; después una frase se resalta con caja blanca y texto negro (como 'EXCEPT AS A PUNISHMENT FOR CRIME'). |
| `enmienda.wordcloud` | main | Nube de palabras condensadas en profundidad: decenas de términos de distintos tamaños sobre un plano inclinado que la cámara atraviesa; las lejanas desenfocadas y tenues, las cercanas nítidas; garabatos a pincel encima. |
| `enmienda.finale` | main | Título de cierre: letras gigantes (numeral romano) que desbordan el cuadro y barren lento de derecha a izquierda bajo una franja de luz; un rótulo chico impreso en tinta oscura sobre la primera letra. Entra con una cuña oscura que barre la escena anterior y termina fundiendo a negro. |
| `enmienda.map` | main | Mapa de tinta sobre negro (siluetas de papel gastado): el mundo aparece parpadeando con un país resaltado; un barrido de vetas disuelve el resto y el país viaja al centro. Opciones: barras negras que gotean (barrotes), mitad oscura del país con frontera punteada (que se funde al unirse), puntos dispersos, ciudad con rótulo en caja negra y texto extendido encima. |
| `enmienda.title` | main | Apertura en frío del documental: planisferio de tinta que aparece parpadeando con el país resaltado, barrido de vetas que deja solo el país en el centro y barras negras que gotean sobre él (barrotes). Rótulo chico extendido arriba y título opcional encima. |
| `enmienda.flag` | main | Bandera de tela ondeando en blanco y negro (la cámara se aleja desde un primer plano girado) con texto de tamaños mezclados encima: palabras chicas condensadas a los lados y una palabra ENORME extendida al medio (como 'TO ALL AMERICANS'). |
| `enmienda.archive` | main | Foto de archivo en blanco y negro contrastado a pantalla completa (o dentro de un marco de película proyectada), empuje lento de cámara, lower-third de entrevista (NOMBRE / cargo / institución en Barlow Condensed) y, opcional, barrotes desenfocados en primer plano que entran de golpe. |
| `enmienda.cutout` | main | Figuras recortadas de fotos de archivo que aparecen una a una sobre negro: primero una silueta blanca sobreexpuesta con brillo y después se 'revela' la foto (como los presos de 1900 que se van sumando). |
| `enmienda.tapes` | main | Pared de tiras de cinta negra con textos manuscritos en blanco (nombre / fecha / lugar), bajo un foco que se enciende y deriva; opcionalmente la cámara se aleja y las tiras se vuelven los ladrillos de un muro con una placa en el centro. |
| `enmienda.wall` | main | Muro de ladrillos gris bajo un foco, con una placa negra chica en el centro; puede ABRIRSE: los ladrillos del centro caen uno a uno (stop-motion) dejando pasar una luz blanca. |
| `enmienda.inmates` | main | Fila de siluetas con uniforme a rayas sobre pared de papel gris, desenfocadas, que la cámara recorre; un latigazo lleva a un primer plano de una figura con una placa negra en el pecho: CIFRA grande + rótulo + nota (como '878,400'). |
| `enmienda.bars` | main | Barrotes: palabra gastada sobre negro con barras de luz desenfocadas que pasan en primer plano; la cámara se aleja y la palabra queda dentro de una celdita dibujada; las palabras siguientes llegan letra por letra desde lejos, sobre un fondo de rayas verticales tenues. |
| `enmienda.graph` | main | Gráfico de línea fino sobre negro con puntos y líneas verticales al eje: la cámara arranca pegada e inclinada sobre el primer punto, recorre la línea mientras se dibuja y se aleja; el título se estampa con parpadeo y al final la cámara se zambulle en el último punto. |
| `enmienda.pictogram` | main | Infografía sobre negro: título extendido chico con etiqueta en caja, fila de figuras humanas grises que suben desde el piso con UNA a rayas resaltada y la proporción debajo ('1 DE 3'); después la cámara entra en la figura rayada y aparece una grilla de figuras con la cifra grande arriba ('40,2 %'). |
| `enmienda.collage` | main | Constelación de recortes (fotos, rótulos, numerales) que nace de un punto girando y se abre; después se oscurece y aparece un bloque de dato al centro: rótulo chico, CIFRA que cuenta hacia arriba y nota, entre filetes. |
| `enmienda.flicker` | overlay | Golpe de proyector sobre la escena: destello blanco de 2 cuadros que se apaga, caída a negro, o parpadeo de exposición irregular (lámpara inestable). |
| `enmienda.introv1` | main | GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: wall | map | world | dark | image con src | component con use/useParams); por defecto el Muro de noche — losas de hormigón con tubo, torre de vigilancia, reflectores que barren y una fila de gente en silueta bloqueando adelante — y un titular GIGANTE desgastado que golpea palabra por palabra con sacudida de cámara ('^palabra^' va en cartulina blanca). El muro se raja y entra luz por la grieta. Sale borrándose con barrido. |
| `enmienda.introv2` | main | GANCHO tipo expediente. Fondo adaptable al tema (bg: map | wall | world | dark | image con src | component con use/useParams); por defecto el mapa del país con cuadrícula y vecinos, una mira que se fija sobre la ciudad con ondas de radar y barrido de vigilancia, gente en silueta al pie. La pregunta gigante se tipea letra a letra y un SELLO de tinta golpea encima con sacudida (p. ej. 'NADIE DIO LA ORDEN'). |
| `enmienda.outro` | main | Cierre del canal SIN recuadro (bg: map | wall | image con src | component con use/useParams): por defecto mapamundi de tinta que se desplaza con alfileres y rutas de hilo (o el Muro de noche). GRACIAS POR VER → nombre del canal GIGANTE desgastado que se revela por erosión → tarjeta LIKE marcada con un círculo a pincel → flecha a pincel → placa blanca SUSCRÍBETE + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `grunge.word` | main | LA escena del estilo: una palabra en tres cortes — primer plano gigante de sus primeras letras con texturas stop-motion → la palabra a todo el ancho (negativo volteado, golpe de zoom, se erosiona de izquierda a derecha) → fondo de color plano con suciedad de película, la palabra entra rasgada y se reacomoda, brochazo detrás, negativos y salpicaduras. Las fases se reparten solas según la duración del beat. |
| `grunge.title` | main | Título de apertura (o frase final): la escena completa de la referencia con sus tres fases siempre — primer plano gigante, palabra a todo el ancho con negativo y erosión, brochazo con rótulo chico. Admite 2–4 renglones cortos. |
| `grunge.closeup` | main | Solo la fase A: primer plano GIGANTE de las primeras letras, que se materializan por salpicaduras y cambian de textura en stop-motion (negativo, rayado, doble exposición hacia las letras siguientes). |
| `grunge.slam` | main | Solo la fase B: la palabra a todo el ancho sobre fondo plano, negativo volteado, golpe de zoom 1,3× y erosión de izquierda a derecha que deja la última letra. |
| `grunge.brush` | main | Solo la fase C: fondo de color con suciedad de película; la palabra entra rasgada en franjas que se reacomodan, brochazo ancho detrás, negativos cortos y salpicaduras al final. |
| `grunge.flip` | overlay | Golpe de negativo de 2–5 cuadros sobre el plano actual (fondo ↔ tinta), opcionalmente espejado/volteado o con zoom 1,3× — el 'flash' de esta familia. Usar con 'dur' 0.1–0.45. |
| `grunge.photo` | main | Foto real en duotono (negro cálido → color plano de la escena) con el mismo lenguaje de cortes de la palabra: primer plano 2,4× que se materializa por salpicaduras y cambia de textura en stop-motion → foto a pantalla completa con negativo volteado, golpe de zoom y erosión → la foto pintada dentro de un brochazo ancho con el título rasgado arriba y salpicaduras. |
| `grunge.stamp` | main | Frase narrada en cortes secos: cada palabra que dice la voz dentro del beat aparece SOLA a todo el ancho (como la palabra entera de la referencia), con texturas de tinta y fondo que alterna casi negro / color plano; las palabras de `accent` llevan brochazo detrás y golpe de negativo; la última se erosiona al salir. |
| `grunge.introv1` | main | GANCHO de apertura (lo primero que se ve). Titular GIGANTE que golpea palabra por palabra: cada palabra entra en negativo sobre una placa de color plano (2 cuadros, el color cambia en cada palabra) y se reacomoda rasgada en franjas; la '^palabra^' queda pintada a rodillo en el color de la escena. Golpe de tinta (inkAt): negativo con zoom, salpicaduras, subrayado de rodillo que chorrea, y aparece el rótulo. Fondo adaptable al tema (bg: roller | posters | film | splatter | image con src en duotono | component con use/useParams | none). Sale rasgándose en franjas. |
| `grunge.introv2` | main | GANCHO pregunta + revelación. La pregunta gigante se pulveriza letra a letra (cada letra aparece como motas de tinta que se densifican en 3 cuadros, con cursor de color) sobre una franja negra de rodillo; la respuesta (stamp) llega como un BROCHAZO del color de la escena que se pinta en 3 cuadros, con la respuesta rasgada encima, negativo espejado y salpicaduras que chorrean. Fondo adaptable (bg: film | roller | posters | splatter | image con src en duotono | component con use/useParams | none). |
| `grunge.outro` | main | Cierre del canal SIN recuadro (bg: posters | roller | film | splatter | image con src en duotono | component con use/useParams). Por defecto una cartelera de afiches de colores que se pegan en stop-motion. GRACIAS POR VER → nombre del canal GIGANTE que se pulveriza en motas, golpea en negativo, se reacomoda rasgado y un rodillo de color lo pinta detrás → placa LIKE que se marca (se vuelve menta, pulgar relleno, aro a pincel, salpicaduras) → flecha a pincel → brochazo coral SUSCRÍBETE (con negativo) + campana que suena → apoyo palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `pelicula.title` | main | Apertura (ref 0–3 s): foto de archivo que entra desenfocada y hace foco, dos filas de perforaciones arriba y una abajo que entran deslizándose, arcos finos, y el bloque año + titular + subtítulo que CAE desde arriba con estela y hace glitch de franjas. |
| `pelicula.year` | main | Plano principal de la referencia: número GIGANTE naranja/rojo + titular crema + subtítulo con barra roja sobre una foto virada con filas de perforaciones en doble exposición. Entradas del bloque (cae / sube / glitch / tras destello), cámara (in/out/rise…) y 'punch' opcional: corte a otra escala del mismo bloque escondido por un prisma de luz. |
| `pelicula.photo` | main | Foto de archivo a pantalla completa (ref 18.6–24 s y 30.6–32.4 s): fila de perforaciones cortada por el borde, Ken Burns lento, arcos finos, doble exposición opcional y un titular chico opcional. Entra con barrido horizontal con motion blur. |
| `pelicula.strip` | main | Montaje en tiras de película (ref 3.6–6.8 s y 38–43.7 s): 2–3 fotos como cuadros de tiras horizontales que corren en sentidos opuestos, perforaciones en los bordes, doble exposición y una barra de luz que cruza el cuadro. |
| `pelicula.reel` | main | Rollo vertical (ref 13–15 s y 53–55.6 s): la foto como cuadros de una tira vertical con perforaciones a ambos lados que corre hacia arriba, tira lateral a la derecha y fondo lavado en blanco; bloque de año/titular opcional al costado. |
| `pelicula.quote` | main | Frase narrada en titular grande (ref 15.5–17 s, el punch de 'NO PLUGINS REQUIRED'): las palabras dichas dentro del plano caen en mayúsculas crema erosionadas justo cuando la voz las dice; 'accent' las pinta naranja; número gigante opcional detrás y subtítulo con barra roja. |
| `pelicula.leak` | overlay | Destello de película (light leak) que tapa un corte: burn (naranja→ámbar→blanco desde un costado, ref 13.1/24.3/31.8/45.9/55.7 s), prism (banda rojo-blanco-verde que cruza, ref 3.1/15.2/37.4/49.3 s), flash (golpe blanco cálido, ref 20.6/27.1 s) o bar (barra de luz, ref 4.3 s). Dura lo que dure el beat ('dur'). |
| `pelicula.glitch` | overlay | Glitch de franjas de TODO el cuadro (foto + texto): bandas horizontales desplazadas y duplicadas que cambian cada cuadro (ref 32.7–33.2, 45.3, 50.6, 55.0 s). Duración = 'dur' del beat (0.2–0.5 s). |
| `pelicula.introv1` | main | GANCHO de apertura (lo primero que se ve). Arranca con la cuenta regresiva del líder de película (3-2-1, aguja que barre) y un destello; después un titular GIGANTE que entra palabra por palabra con barrido y estela (motion blur), golpea con sacudida y glitch de franjas ('^palabra^' en naranja con barra roja). Impacto (burnAt): la película se traba en la ventanilla y se QUEMA (agujero incandescente) → destello naranja→blanco. Fondo adaptable (bg: strips | projector | reel | leader | image con src | component con use/useParams | none). Sale con barrido. |
| `pelicula.introv2` | main | GANCHO tipo intertítulo de cine mudo. Se abre el iris; la pregunta gigante se EXPONE letra por letra (cada letra destella al aparecer) entre filetes dobles con rombo, y la respuesta llega en una TIRA DE PELÍCULA que cruza con barrido y estela, golpea con sacudida y destello, y queda atravesada (p. ej. 'NADIE DIO LA ORDEN'). Fondo adaptable (bg: projector | strips | reel | leader | image con src | component con use/useParams | none). Sale cerrando el iris. |
| `pelicula.outro` | main | Cierre del canal SIN recuadro (bg: projector | strips | reel | leader | image con src | component con use/useParams). Por defecto sala oscura con el haz del proyector, polvo flotando y rollos girando. GRACIAS POR VER → nombre del canal GIGANTE naranja que cae con estela, hace glitch y se asienta sobre la barra roja (con quemado de luz) → cuadro de película LIKE que se expone en naranja y se marca con lápiz graso rojo → flecha a lápiz graso → tira roja SUSCRÍBETE que entra con barrido + campana que suena → mensaje de apoyo expuesto letra a letra → youtube.com/@canal. Fundido a negro al final. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `periodico.title` | main | Apertura sobre el periódico: negro → papel desenfocado → rack focus y la cámara se aleja de un título ENORME cuyas letras se aleatorizan hasta asentarse (typewriter), con subtítulo chico, icono ⊠, columna de texto al costado y recuadro negro cortado. Si es el primer plano hace la intro completa; si no, llega con latigazo. |
| `periodico.headline` | main | Título typewriter sobre el papel, sin foto. style: plain = título + subtítulo centrados con ⊠; bracket = escuadra ⌐ negra arriba-izquierda, el título entra deslizándose y ⊠ grande al lado ('Newspaper / slideshow'); corner = escuadra L negra abajo-izquierda con subtítulo en itálica ('Elegant / Clean Design'). Letras con scramble. Sirve para fechas, cifras y frases cortas. |
| `periodico.article` | main | Artículo: título typewriter con scramble + regla negra gruesa que se traza + párrafo que se escribe letra a letra ('Exclusive' de la referencia). size=big: título enorme, la cámara se acerca y la profundidad de campo se achica (párrafo desenfocado). Foto chica opcional cortada a la izquierda. |
| `periodico.photo` | main | Foto B/N con marco negro fino (borde de foto impresa) y sombra, apoyada en el periódico, con título typewriter + barra negra con subtítulo blanco ('Stylish / headlines'). layout elige dónde va el rótulo (left/right/topright/topleft/bottomright/bottomleft); año opcional cuyos dígitos titilan; ⊠ en una esquina. Llega con latigazo de cámara. |
| `periodico.collage` | main | Varias fotos y recortes de periódico en capas a distinta profundidad (paralaje y desenfoque) con rótulo de barra negra. layout: history = foto grande a la derecha + foto y recortes detrás ('History / opener'); modular = tres fotos superpuestas ('Modular / structure'); plugins = foto + foto desenfocada + recuadro + caja negra con texto blanco ('No Plugins / Required'). |
| `periodico.quote` | main | La frase narrada en typewriter grande sobre el papel: cada palabra aparece cuando la voz la dice, con sus letras aleatorizándose hasta asentarse; las palabras de `accent` van en blanco sobre barra negra (como los subtítulos de la referencia). Regla negra que crece debajo y ⊠. Oculta los subtítulos. |
| `periodico.introv1` | main | GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: press | spin | desk | stand | image con src | component con use/useParams | none); por defecto la ROTATIVA: el papel del diario corre entre dos rodillos con desenfoque de movimiento y frena en seco. Un titular GIGANTE a máquina golpea palabra por palabra (letras que se aleatorizan, estela y sacudida; '^palabra^' va en blanco sobre barra negra). En extraAt golpea un sello magenta «EXTRA». Sale con latigazo hacia el primer plano del periódico. |
| `periodico.introv2` | main | GANCHO pregunta + revelación. Fondo adaptable al tema (bg: spin | press | desk | stand | image con src | component con use/useParams | none); por defecto una PORTADA DE DIARIO que viene girando hacia la cámara, se detiene y se desenfoca (rack focus). La pregunta gigante se TIPEA a máquina letra a letra (golpe de tipo, tinta irregular, carro) y la respuesta llega como RECORTE de diario con titular a toda página que golpea encima, más un sello magenta EXTRA. |
| `periodico.outro` | main | Cierre del canal SIN recuadro (bg: stand | desk | press | spin | image con src | component con use/useParams | none): por defecto la cámara llega con un latigazo a una pared de PORTADAS de diario que se desliza. [GRACIAS POR VER] entre corchetes → nombre del canal como CABECERA de diario gigante (letras que se aleatorizan y asientan, filetes dobles que se trazan) → LIKE con casilla ⊠ que se tacha y barra negra que se llena → flecha de tinta → barra negra SUSCRÍBETE que golpea + campana grabada que suena → mensaje de apoyo tipeado → [youtube.com/@canal]. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `pop.logo` | main | Apertura de marca (ref. 44,9 s): la marca del canal escala desde 0, un arco fino se dibuja antihorario, la marca parpadea en rosa, un anillo de trazos rotos gira y se cierra en un círculo fino; al final el círculo se borra. Kicker chico opcional debajo. |
| `pop.kaleido` | main | Objeto 3D orgánico (blob relleno con la foto en duotono, sombreado, con esquirlas) con rótulo '/RUTA/TIPO' (ref. 46,4 s); en `split` se parte en un CALEIDOSCOPIO hexagonal con 6 copias, rótulos rotados y bordes violeta gruesos, y aparece un marco violeta (ref. 46,95 s). |
| `pop.kanji` | main | Texto diagonal isométrico (ref. 49,85 s): renglón grande (japonés u otro) + subrenglón chico, rotado −28°, chico en el centro sobre menta; en `split` pasa a GRANDE sobre una foto cortada por un triángulo menta, con el texto que cambia de color según la región (menta sobre foto, violeta sobre menta) y deriva en diagonal (ref. 50,4 s). Esquina superior derecha: 4 renglones chicos que se escriben. |
| `pop.word` | main | Palabra GIGANTE menta sobre foto a sangre en duotono oscuro con zoom lento (ref. 47,55 'BLACK'): entra creciendo 0,75→1 y deslizando a la izquierda en 5 cuadros; repetición chica glitcheada abajo a la derecha y '=' abajo a la izquierda. |
| `pop.hatch` | main | Palabra gigante menta sobre foto violeta (ref. 49,35 'FOREVER'): entra con glitch de bloques y 6 cuadros de parpadeo de paleta con letras que faltan; algunas letras quedan RAYADAS en diagonal, '★★★' y tiras glitch de la palabra estiradas arriba. |
| `pop.stack` | main | Renglones apilados menta en grotesca extendida sobre foto (ref. 50,98 'NEW WAY TO PROMOTE'): entra con cortina líquida violeta, cada renglón aparece aplastado y se asienta (uno cada 2 cuadros, o cuando la voz dice la palabra si text está vacío), cruz violeta + flecha-pentágono menta que crecen; en `phase2` re-encuadre más grande con eco en contorno, tira glitch, círculo con cruz y chevrones rosas (ref. 51,45). |
| `pop.letters` | main | 2–3 letras/cifras GIGANTES (ref. 53,05 'OE'): la 1ª rellena con la foto en duotono, la 2ª con ondas op-art que se deforman, bordes suaves y deriva lenta; etiqueta paralelogramo violeta que entra con borde dentado (sierra) con texto menta; marca chica abajo-izq. y línea punteada arriba-izq. |
| `pop.band` | main | Texto grande que pasa de negro a foto (ref. 53,59 '2 COLOURS'): cuadro negro con el texto menta → cae una banda de rayas diagonales → la foto se abre como banda hacia abajo (doble exposición desplazada con costura negra) mientras el texto parpadea rosa/menta y las rayas se afinan. |
| `pop.arrow` | main | Flecha gruesa que entra desde la izquierda en 4 cuadros parpadeando violeta→rosa→gris→rosa→violeta, con un rótulo de 1–2 renglones que se DECODIFICA letra por letra (ref. 54,12 'NEXT GENERATION'). |
| `pop.minimal` | main | Texto mínimo y aireado sobre gris claro (ref. 63,5 'USE ANY MEDIA / PHOTOS OR VIDEO'): kicker diminuto muy espaciado + línea en Montserrat espaciada que aparece letra a letra; o variante 'small' (ref. 21 s, 'YOU CAN SET ANY COLORS') de una línea chica con las primeras palabras en rosa. |
| `pop.title` | main | Título de apertura en 3 tiempos como el comienzo de la referencia: marca del canal con círculo fino que se dibuja (+ kicker), objeto 3D con la foto que se parte en caleidoscopio (opcional, si hay `object`) y el TÍTULO en renglones apilados menta sobre la foto con cortina líquida, cruz y flecha (re-encuadre en `phase2`). |
| `pop.circles` | main | Dos círculos con la MISMA foto en duotono que crecen desde 0 (el izquierdo primero) y una palabra violeta gigante encima cuya interletra se abre, con letras que faltan al entrar y una letra que parpadea rosa; barra menta, '× × ×' uno por uno y escuadra (ref. 48,1 'STYLE'). |
| `pop.stripes` | main | Caja de marco fino con la foto lavada y RAYAS diagonales violeta que entran gruesas y se afinan hasta pelos; palabra violeta con eco rosa desplazado (letras que faltan), '|||' antes, flechas ↑↓; todo el grupo se desliza a la izquierda (ref. 48,65 'STYLE' en caja). |
| `pop.split` | main | Tríptico (ref. 51,95 'STRONG'): columna con 2 fotos chicas entre bandas rayadas, panel menta con letras GIGANTES en contorno fino que se dibujan y la palabra con letras en ola que rebotan al entrar, foto grande a la derecha que se desliza a la izquierda con rótulo menta glitcheado. |
| `pop.frame` | main | Foto muy desenfocada que se enfoca; un marco paralelogramo menta GRUESO rota (−35°→0), crece y se afina hasta ser un marco rectangular fino con esquinas en triángulo; título menta con ecos en contorno que se abren a los lados (ref. 52,52 'THE POWER'). |
| `pop.duo` | main | Dos círculos-foto enormes en los bordes que crecen, flecha gruesa al centro, '×' rosa, flechitas, rótulo de 2 renglones y línea superior con texto mínimo (ref. 54,75 'NEXT GENERATION'). Entra con esquirlas. |
| `pop.posters` | main | Columnas verticales de foto (ref. 55,26 'NICE / POSTERS'): una columna entra barriendo desde la derecha en 2 cuadros y deriva; en `p2` aparece la 2ª columna y la cámara panea; en `p3` todo se aleja al 35 % con regla y texto mínimo debajo. Arcos grises gruesos que giran y triángulo ◄. |
| `pop.triangle` | main | Un triángulo ◄ chico crece en 4 cuadros hasta un TRIÁNGULO grande con foto a la izquierda (ref. 56,85), junto a las columnas alejadas, la regla con texto mínimo y los arcos grises que giran. |
| `pop.book` | main | Libro 3D isométrico sobre menta apagada (ref. 57,4 s): tapa violeta con la foto en duotono que se desplaza y el título en renglones menta, lomo violeta, cantos rosa, sombra rosada difusa; deriva y se achica lento; en `swapAt` la tapa cambia a la marca del canal. |
| `pop.tiles` | main | Marca menta grande sobre violeta (ref. 60,16) que corta a un MOSAICO de cuadrados violeta con la marca, filas desfasadas que se deslizan y parpadean de brillo (ref. 60,6). |
| `pop.name` | main | Texto chico centrado sobre menta (ref. 61,2 'ENVATO.COM' → nombre del canal/lugar): aparece, pasa por 3 cuadros de itálica con letras que se decodifican, se achica al final y se apaga parpadeando a gris. |
| `pop.glitch` | overlay | Glitch de transición encima de cualquier plano (capa overlay): bloques desplazados sobre negro, parpadeo de paleta o esquirlas (ref. 49,25 · 54,65). Usar con 'dur' corto (0,15–0,35 s). |
| `pop.introv1` | main | GANCHO de apertura (lo primero que se ve). Titular GIGANTE apilado en tiras violeta que golpea palabra por palabra: cada palabra entra APLASTADA en rosa, se rebana en bloques glitch y se asienta en menta con sacudida; la '^palabra^' va en caja menta con op-art animado (o la foto en duotono) DENTRO de las letras. En glitchAt el cuadro se rompe en bloques + parpadeo de paleta, salta la sombra rosa de las tiras y salen anillos. Fondo adaptable (bg: columns | opart | shapes | kanji | tiles | image con src | component con use/useParams); por defecto columnas de mosaicos que se deslizan. |
| `pop.introv2` | main | GANCHO pregunta + revelación. Una cortina líquida violeta baja y la pregunta GIGANTE se DECODIFICA letra por letra (letras al azar en rosa que se resuelven en menta, con cursor); en stampAt la respuesta golpea como CINTA menta inclinada con glitch de bloques, sombra rosa, flecha gruesa que entra parpadeando y anillos; la pregunta pierde letras un instante. Fondo adaptable (bg: opart | columns | shapes | kanji | tiles | image con src | component con use/useParams); por defecto ondas op-art del duotono. |
| `pop.outro` | main | Cierre del canal SIN recuadro, en lenguaje DUOTONO (bg: tiles | columns | opart | shapes | kanji | image con src | component con use/useParams; por defecto mosaico de marcas del canal que se desliza). GRACIAS POR VER que se decodifica → nombre del canal GIGANTE en tira violeta con letras que caen aplastadas en rosa y se asientan en menta → botón LIKE menta que se PRESIONA (se hunde en su sombra, se invierte y estalla en cruces) → flecha gruesa que crece parpadeando → placa rosa SUSCRÍBETE que golpea + campana que suena → apoyo en tira violeta → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `dinero.serif` | main | Palabra GIGANTE en didona condensada verde oscuro sobre pared gris verdosa (ref. 0,0 s 'MONEY'): las letras se paran una por una con sombra proyectada mientras la cámara las sigue; la foto entra desde la izquierda con desenfoque de movimiento; al terminar, la cámara se aleja de golpe y revela todo; sale con un barrido. Para la palabra/cifra que abre un tema. |
| `dinero.title` | main | Título de apertura (t = 0) con el plano 1 de la referencia: el TÍTULO en didona condensada gigante verde oscuro, letra por letra con la cámara siguiéndolas, foto que entra desde la izquierda, alejamiento brusco y rótulo fino (kicker) que se escribe debajo. Sin subtítulos. |
| `dinero.cash` | main | Ráfaga de fotos de billetes en teal frío (ref. 1,1 s): la 1ª entra desenfocada y oscura y se enfoca, cortes rápidos a la 2ª girada y re-encuadrada, un cuadro oscuro con líneas de barrido y la última queda con empuje lento. Para el momento en que aparece el dinero (cifras, presupuesto, pago). |
| `dinero.count` | main | Foto en teal frío con empuje y paneo lentos y luz cálida en la esquina (ref. 3,2 s, mano contando billetes); encima, un rótulo FINO en mayúsculas y una línea en minúsculas que se DECODIFICAN letra por letra con una raya fina a la izquierda. Para nombrar una cifra, un trámite o una pregunta sobre la foto. |
| `dinero.neon` | main | Palabra en MAYÚSCULAS finas blancas con brillo y sombra larga sobre fieltro verde con viñeta (ref. 2,0 s 'MONEY'): las letras aparecen desenfocadas y se enfocan, un cuadro oscuro, líneas finas de cursor, barrido con destello y re-encuadre más chico con la 2ª línea en minúsculas, anillo de chispa y subrayado que se dibuja con punta brillante; ornamento de billete en los bordes. Para nombrar un concepto con elegancia. |
| `dinero.spin` | main | Palabras 3D que GIRAN con desenfoque de movimiento sobre gris claro con viñeta mientras caen monedas doradas (ref. 3,8–8,4 s 'Dirty Cash I Want YOU'): cada palabra entra volteándose (la 1ª se tipea), la cámara gira y salta de una a otra, las anteriores quedan desenfocadas; en `lensAt` un lente OJO DE PEZ encierra el cuadro en un rectángulo redondeado que rebota y la palabra verde parpadea. Para frases de impacto y momentos de tensión con el dinero. |
| `dinero.block` | main | Frase en BLOQUE gigante Open Sans 800 verde oscuro sobre salvia (ref. 8,5 s 'MONEY TALKS'): las letras aparecen mientras la cámara panea, una barra verde sube con un billete arriba y garabatos que saltan, el 2º renglón sube con desenfoque y la cámara se aleja hasta llenar el cuadro de borde a borde. Para la frase-tesis o el dato que lo cambia todo. |
| `dinero.head` | main | Ilustración plana sobre verde salvia (ref. 9,5–10,5 s): primero una palabra 3D chica con ojo de dibujo animado, sonrisa y rayitas; después una CABEZA negra de perfil con un ojo blanco que mira una TARJETA con degradé, marcador, ojo con destello, barra oscura con el lema y fila de rótulos chicos; todo se desliza lento. Para una idea, un plan, una decisión o la mente de alguien. |
| `dinero.note` | main | Texto MÍNIMO en Open Sans 800 sobre blanco, negro o salvia (ref. 10,6 s 'MONEY / TALKS!' y 16,0 s 'HUH!'): los renglones se tipean escalonados hacia la derecha y el grupo salta a la izquierda y vuelve (en blanco) o queda quieto (en negro). Para una pausa, una reacción corta o un dato aireado. |
| `dinero.pin` | main | Sobre negro verdoso, un ALFILER-PERSONA verde (cono con cabeza) sube desde abajo con un anillo blanco alrededor de la cabeza; a mitad del plano la cámara se aleja de golpe y el anillo se cierra sobre la cabeza; el rótulo se tipea al lado (ref. 11,6 s). Para señalar a una persona, un 'tú' o 'uno solo'. |
| `dinero.outline` | main | La frase NARRADA sobre negro verdoso (ref. 12,3–14,2 s 'dirty cash want i you'): cada palabra se tipea cuando la voz la dice, en blanco Open Sans 800 con tamaños escalonados (la 1ª del renglón grande, las siguientes chicas y corridas), detrás la 1ª palabra GIGANTE solo en contorno, una estrella verde, la palabra clave en verde grande con un ojito y rayos verdes tenues. Es la 'letra grande' del diseño (reemplaza a common.lyric). |
| `dinero.eye` | main | OJO gigante plano (almendra blanca con borde verde e iris verde) sobre negro verdoso (ref. 14,3 s): primero muy cerca, cortado por el borde, mientras el texto en mayúsculas blancas se tipea a la izquierda; en `split` la cámara se aleja de golpe y queda el ojo entero, inclinado, mirando, con el texto al costado. Para 'alguien mira', vigilancia, atención o deseo. |
| `dinero.eyes` | main | OJOS de dibujo animado (esferas blancas con pupila) de distintos tamaños que aparecen, flotan y miran para todos lados sobre negro verdoso, con un texto corto verde al centro (ref. 15,5 s 'NEED YOU'). Para 'todos miran', la presión del público o una sensación de ser observado. |
| `dinero.introv1` | main | GANCHO de apertura (lo primero que se ve). Titular en BLOQUE Open Sans 800 que entra palabra por palabra VOLTEÁNDOSE en 3D con desenfoque de movimiento (como 'Dirty Cash' de la referencia); la '^palabra^' va en verde billete y estalla en monedas; en glitchAt el cuadro se ABOMBA con el lente ojo de pez dentro de un rectángulo redondeado, tiembla y destella. Fondo adaptable (bg: paper | felt | sage | black | fog | image con src | component con use/useParams); por defecto gris claro con monedas que caen. |
| `dinero.introv2` | main | GANCHO pregunta + revelación. La pregunta en MAYÚSCULAS finas blancas con brillo y sombra larga se DECODIFICA letra por letra sobre fieltro verde (como 'MONEY' de la referencia); en stampAt barrido con destello, la pregunta se achica arriba con un subrayado de punta brillante y la RESPUESTA cae gigante en Open Sans 800 verde volteándose en 3D con desenfoque, con anillo de chispa. Fondo adaptable (bg: felt | paper | sage | black | fog | image con src | component con use/useParams); por defecto fieltro verde. |
| `dinero.outro` | main | Cierre del canal SIN recuadro en lenguaje NODECONOMY (bg: black | paper | felt | sage | fog | image con src | component con use/useParams; por defecto negro verdoso con rayos verdes): GRACIAS POR VER fina que se decodifica → nombre del canal GIGANTE con contorno fantasma detrás y relleno blanco que se tipea → botón LIKE verde que se presiona y suelta chispas (dos ojos lo miran) → flecha fina con punta brillante → SUSCRÍBETE en billete verde que golpea + campana que suena → apoyo → youtube.com/@canal. Tiempos sincronizables (likeAt, subscribeAt, bellAt, supportAt). |
| `atlas.world` | main | Cámara del mapamundi 2.5D que viaja (zoom + paneo suave) a una región, a varios países o a un punto; opcionalmente pinta países en gris o blanco con parpadeo. Para situar la historia: 'todo empezó en Europa del Este', 'el bloque soviético'. |
| `atlas.country` | main | LA escena de la referencia: la cámara viaja al país, el país se enciende en blanco con un parpadeo de 8 cuadros (o pasa por gris medio y después blanco), cae un alfiler negro tipo gota con rebote y la etiqueta sale de atrás del alfiler. El alfiler anterior queda chico. Para nombrar un país o una ciudad (pin=[lon,lat]). |
| `atlas.route` | main | Montaje de la referencia: la cámara salta país por país (≈1 s cada uno), cada país se enciende en blanco, cae su alfiler y su etiqueta; los anteriores quedan chicos. Con line=true une los alfileres con una ruta punteada que avanza. Para listas de países, rutas de escape, expansión de un bloque, giras, contagios. |
| `atlas.border` | main | Una línea que se dibuja sobre el mapa: MURO (negro grueso con canto cian que brilla), frontera punteada o ruta con flecha. Rótulos a cada lado (ESTE / OESTE) que entran deslizando. Para fronteras, muros, particiones, líneas de frente, rutas migratorias. |
| `atlas.title` | main | Título de apertura: el mapamundi 2.5D con la costa cian se acerca lento mientras caen alfileres chicos en los países de la historia; el titular condensado blanco GRANDE ('^x^' en cian) se asienta cerrando la interletra. Primer beat del video (t=0). |
| `atlas.stat` | main | Cierre de la referencia ('82 COUNTRIES LISTENING'): el mapa se apaga y desenfoca, y aparece una cifra con su texto en condensada blanca (la cifra cuenta hacia arriba si es número). Para el dato duro de la historia: víctimas, votos, años, países. |
| `atlas.compare` | main | Dos países encendidos a la vez en el mapa, cada uno con su alfiler y su etiqueta, y abajo su cifra GRANDE en condensada blanca con un 'VS' cian en el medio. Para comparar dos países (población, votos, gasto, muertos, años). |
| `atlas.photo` | main | Foto clavada en el mapa: un alfiler GIGANTE cae con rebote sobre el lugar con la foto dentro de su cabeza (B/N contrastado, como el sello de la referencia) o una tarjeta con borde blanco y puntero; nombre y rol al lado. Al salir se achica y queda un alfiler chico con la foto en el mapa. Para personas, lugares, documentos. |
| `atlas.introv1` | main | GANCHO de apertura tipo golpe: la cámara se lanza del mundo entero hacia la región mientras los países de la historia se encienden en BLANCO en ráfaga (parpadeo de 8 cuadros cada uno, con alfileres chicos) y el titular condensado GIGANTE golpea palabra por palabra con sacudida ('^x^' en cian). Fondo adaptable: world (mapa), dark, image (src), component. |
| `atlas.introv2` | main | GANCHO pregunta + revelación: la pregunta se tipea letra a letra en condensada blanca sobre el mundo apagado; en revealAt el mapa se enciende, la pregunta sube y se achica, la cámara cae sobre el país, que parpadea en blanco, y cae el alfiler con la RESPUESTA como etiqueta. Fondo adaptable (world, dark, image, component). |
| `atlas.outro` | main | Cierre del canal SIN recuadro: la cámara se aleja al mundo entero con todo lo encendido y el mapa se apaga (final de la referencia). GRACIAS POR VER → canal en condensada gigante → alfiler LIKE que cae con el pulgar en el sello → ruta cian → placa blanca SUSCRÍBETE que se enciende con el parpadeo de los países + campana → apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida (likeAt, subscribeAt, bellAt, supportAt). |
| `imperio.title` | main | Apertura (ref 0–11 s): atlas físico con el país foco rayado y el SOL carmesí que late; la cámara se aleja y gira apenas; nacen los RAYOS translúcidos en abanico hacia `dir` con barquitos; el título en su IDIOMA ORIGINAL (kanji, alemán, ruso…) entra carácter por carácter con su traducción tipeada debajo y se borra de derecha a izquierda; después el título condensado blanco SUBE desde abajo con degradé. Primer beat del video. |
| `imperio.map` | main | Atlas físico en movimiento lento (zoom y giro leve) sobre un país o región: territorio rayado, sol que late, rótulos de mares, rayos opcionales y PINES (punto carmesí + nombre) para lugares concretos (una base, una ciudad, un puerto). Para situar la historia y para respirar entre momentos fuertes. |
| `imperio.expansion` | main | Expansión: desde el sol del país foco salen HACES carmesí translúcidos hacia cada región destino, uno tras otro; al llegar, la región se raya (territorio ocupado) y aparece su nombre en condensada blanca. Para invasiones, zonas de influencia, rutas de ataque o alcance de una doctrina. |
| `imperio.archive` | main | Material de archivo (ref 11.5–27.7 s): el atlas se DESATURA a gris, baja humo oscuro desde arriba y la foto en blanco y negro se FUNDE en multiplicar con el mapa (lo claro deja ver el mapa, lo oscuro lo tapa); los rayos carmesí siguen encima, rosa de los vientos fina abajo a la derecha, grano y polvo; la cámara sigue alejándose. Para mostrar una foto histórica sin salir del mapa. |
| `imperio.word` | overlay | Título condensado BLANCO (Fjalla One) sobre el plano en curso: cada renglón SUBE desde abajo con degradé de opacidad (arriba aparece primero) y desenfoque, y después el título se ACHICA lento y exponencial (rápido al principio) mientras el mapa sigue moviéndose (ref 10–27 s: 'JAPANESE EMPIRE'). Usalo como overlay sobre imperio.archive / imperio.map para el nombre del imperio, la doctrina o el tema del bloque. |
| `imperio.native` | overlay | Nombre en su IDIOMA ORIGINAL (kanji, alemán, ruso, árabe latinizado…) en gris grande: cada carácter entra con escala y desenfoque escalonados, la traducción en mayúsculas negras se tipea debajo, y al final se borra de derecha a izquierda (ref 4.9–9.9 s: '南進論 · SOUTHERN EXPANSION DOCTRINE'). Overlay sobre un plano con mapa claro (imperio.map / imperio.title). |
| `imperio.introv1` | main | GANCHO de apertura: sobre el atlas el SOL carmesí CAE (de 3× a su tamaño, con sacudida) y sus rayos estallan en 360°; el titular condensado blanco entra palabra por palabra con estela ('^palabra^' sobre franja carmesí); en burstAt los rayos se abren hasta los bordes con destello y sacudida. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none). |
| `imperio.introv2` | main | GANCHO pregunta + revelación: la pregunta se escribe carácter a carácter como el título en idioma original de la referencia (cada letra entra con escala y fantasma); en stampAt la pregunta sube y se achica, el SOL carmesí sale desde abajo detrás del centro con su abanico de rayos y la RESPUESTA sube en condensada blanca con degradé. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none). |
| `imperio.outro` | main | Cierre del canal SIN recuadro (bg: atlas | archivo | papel | image con src | component con use/useParams). GRACIAS POR VER → nombre del canal en condensada blanca que sube delante del SOL carmesí que sale desde abajo con sus rayos girando → LIKE (óvalo fino que se llena de carmesí) → flecha de línea fina → SUSCRÍBETE en franja carmesí + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Fundido a negro. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |
| `memorias.title` | main | Portada 'Historical Memories': título manuscrito grande (Mr Dafoe) que se escribe de izquierda a derecha + subtítulo en Quicksand, sobre papel de yeso con humo gris; bocetos a lápiz de una o dos fotos en las esquinas (layout center) o un boceto grande a un costado con el texto arriba a la izquierda (layout side). |
| `memorias.scene` | main | El plano de la referencia: la foto aparece primero como BOCETO A LÁPIZ sobre el papel, después se colorea por manchas de tinta (reveal: full/right/left/center/bottom; lo demás queda en boceto), revienta una salpicadura de acuarela azul con gotas (negra con tone=bw) y aparece el bloque de texto: renglón manuscrito (kicker) + renglones en MAYÚSCULAS que se arman letra a letra (text, '\n' = renglón). Detrás, un recorte de periódico fantasma; zoom lento durante el plano y salida con humo. |
| `memorias.introv1` | main | Gancho 'golpe': titular MANUSCRITO gigante (Mr Dafoe) que se escribe palabra a palabra sobre el papel, con rótulo en MAYÚSCULAS que se arma letra a letra arriba y subtítulo en Quicksand abajo; en dropAt revienta una salpicadura de acuarela azul detrás del titular con gotas y una sacudida, y la palabra ^marcada^ se tiñe de azul. Fondo: sketch (foto en boceto que se colorea) | smoke | image | component | none. |
| `memorias.introv2` | main | Gancho 'pregunta + revelación': la pregunta en MAYÚSCULAS (Barlow 700) se arma letra a letra con glifos que parpadean; en stampAt la respuesta se escribe en manuscrita grande sobre una salpicadura de acuarela azul que revienta con gotas. Fondo: sketch | smoke | image | component | none. |
| `memorias.outro` | main | Cierre del canal como la tarjeta final de la referencia: una mancha de tinta NEGRA crece desde abajo a la izquierda y traga el cuadro (bg ink; paper = sobre el papel con texto oscuro; image/component/none = contrato común) → 'gracias por ver' en sans fina → nombre del canal en manuscrita grande que se escribe → pulgar LIKE a trazo que se rellena con gotas azules → flecha fina → SUSCRÍBETE armado letra a letra + campana que suena → mensaje de apoyo → dirección en mayúsculas chiquitas. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt). |

## Comunes (cualquier familia)

### `common.punch`

Palabra o frase GIGANTE a pantalla (momento de alto impacto, como las plantillas de música): letras que caen con desenfoque y se asientan; '^palabra^' va en color de acento.

Etiquetas: impacto, texto, énfasis · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto; '\n' parte renglones; '^x^' = acento. |
| `size` | number [0.2–1] | `0.86` | Fracción del ancho del cuadro que ocupa el renglón más largo. |
| `style` | enum (solid / outline / glitch) | `"solid"` | solid = relleno, outline = contorno, glitch = entra cortado. |
| `stagger` | number | `0.035` | Segundos entre letra y letra. |
| `y` | number | `0.45` | Centro vertical (fracción del alto). |
| `hideCaptions` | bool | `true` | Oculta los subtítulos mientras está en pantalla. |

```json
{"use": "common.punch", "params": {"text": "MILLONES\nDE ^VIDAS^", "size": 0.9}}
```

### `common.tag`

Rótulo de contexto (lugar · fecha · dato) en mono mayúsculas, arriba o abajo del cuadro; entra escribiéndose.

Etiquetas: contexto, lugar, fecha · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto del rótulo. |
| `pos` | enum (top / bottom / center) | `"top"` | Posición. |
| `boxed` | bool | `true` | Con caja de color (true) o solo texto. Duración: usar 'dur' del beat. |

```json
{"use": "common.tag", "params": {"text": "BLETCHLEY PARK · 1940", "pos": "top"}}
```

### `common.flash`

Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido.

Etiquetas: transición, golpe · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `color` | color | `"palette.ink"` | Color del destello. |
| `strength` | number [0–1] | `0.85` | Opacidad máxima. |

```json
{"use": "common.flash", "params": {"color": "palette.ink", "dur": 0.5}}
```

### `common.endcard`

Tarjeta final sobria: frase de cierre grande, línea y firma de marca (canal / suscribirse).

Etiquetas: cierre, marca · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `line` | string | `""` | Frase de cierre ('\n' para renglones, '^x^' acento). |
| `brand` | string | `""` | Marca / canal. |
| `cta` | string | `""` | Llamado a la acción (mono). |

```json
{"use": "common.endcard", "params": {"line": "SEGUIMOS\nPREGUNTANDO", "brand": "NEXA BRIEF", "cta": "SUSCRÍBETE"}}
```

### `common.lyric`

Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave.

Etiquetas: impacto, letra, frase, clímax · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Frase explícita breve; vacía usa la ventana de narración. |
| `accent` | array | `[]` | Palabras (sin tildes ni mayúsculas importa) que van en color de acento. |
| `size` | number [0.3–1] | `0.82` | Fracción del ancho que ocupa el renglón más largo. |
| `maxChars` | number | `0` | Caracteres por renglón (0 = automático: 11 en 9:16, 18 en 16:9). |
| `dimPast` | bool | `true` | Atenuar las palabras ya dichas (efecto karaoke). |
| `y` | number | `0.46` | Centro vertical (fracción del alto). |

```json
{"use": "common.lyric", "params": {"accent": ["vidas"], "size": 0.9}}
```

### `common.logo`

Obsoleto: el logo debe acompañar una foto o video con el parámetro logo del componente visual.

Etiquetas: logo, obsoleto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image | `""` |  |
| `name` | string | `""` |  |

### `common.clip`

Clip de video real de unos segundos (mudo) en vez de una foto: a pantalla completa con empuje lento, o dentro de un marco. Toma el tratamiento de color del diseño (design.json → defaults.clip); rótulo opcional abajo.

Etiquetas: video, clip, metraje, foto, lugar, máquina · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | video · obligatorio | `null` | Clip .mp4 de assets/media/ (preparado con tools/media.py get … nombre.mp4). |
| `start` | number [0–None] | `0` | Segundo del clip desde el que arranca. |
| `rate` | number [0.25–2] | `1` | Velocidad (0.5 = cámara lenta). El clip debe durar start + duración del beat × rate. |
| `loop` | bool | `true` | Repite el clip si es más corto que el beat; evita congelar el último cuadro. |
| `layout` | enum (auto / full / frame) | `"auto"` | auto = el del diseño (defaults.clip.layout; si no hay, full); full = pantalla completa; frame = dentro de un marco centrado. Dejarlo en auto. |
| `size` | number [0–1] | `0` | layout frame: fracción del contenido que ocupa; 0 = la del diseño (defaults.clip.size; si no hay, 0.84). |
| `ar` | number | `0` | layout frame: proporción del recorte (0 = la del clip; en 9:16 conviene 0.8). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] (0..1): hacia donde se acerca el zoom y qué se conserva al recortar. |
| `zoom` | number [0–0.3] | `0.06` | Cuánto se acerca a lo largo del beat (empuje lento). |
| `tone` | enum (design / color) | `"design"` | design = filtro del diseño (defaults.clip.filter); color = el clip tal cual. |
| `dim` | number [-1–1] | `-1` | Oscurecido (para leer los subtítulos); -1 = el del diseño. |
| `caption` | string | `""` | Rótulo (qué se ve); vacío = sin rótulo. |
| `sub` | string | `""` | Línea chica bajo el rótulo (fuente, lugar, año). |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "common.clip", "params": {"src": "assets/media/servidores.mp4", "caption": "Un centro de datos", "sub": "PEXELS · 2026"}}
```

### `common.tabloid`

Miniatura e intro tabloide con foto o video mudo; focus protege la zona de interés del medio.

Etiquetas: miniatura, intro, alerta, tabloide, gancho · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular corto; máximo 6 palabras recomendado. |
| `src` | image | `""` | Foto opcional; también sirve de respaldo del video. |
| `srcAfter` | image | `""` | Segunda foto del split. |
| `video` | video | `""` | Clip .mp4 local de assets/media; ocupa el lugar de src. |
| `poster` | image | `""` | Imagen del cuadro elegido para la miniatura y el instante inicial; si falta, usa src. |
| `start` | number [0–None] | `0` | Segundo inicial del clip. |
| `rate` | number [0.25–2] | `1` | Velocidad del clip. |
| `loop` | bool | `true` | Repite el clip si termina antes que el beat; evita congelar. |
| `muted` | bool | `true` | El clip siempre se reproduce mudo; false se ignora por el contrato del motor. |
| `accent` | string | `""` | Frase destacada con el acento del diseño (rojo en alert). |
| `bullet` | string | `""` | Cifra y leyenda. |
| `bulletScale` | number [0.5–1.5] | `1` | Escala de la cifra y su recuadro. |
| `beforeLabel` | string | `""` | Etiqueta del antes. |
| `afterLabel` | string | `""` | Etiqueta del después. |
| `imageSide` | enum (auto / left / right) | `"auto"` | Lado de foto horizontal. |
| `mode` | enum (impact / split) | `"impact"` | Foto única o split. |
| `palette` | enum (brand / alert) | `"brand"` | Identidad del diseño o estilo clásico de alerta. |
| `strap` | string | `""` | Cintillo superior. |
| `seal` | string | `""` | Sello opcional. |
| `tapeText` | string | `""` | Texto de cinta opcional. |
| `marker` | bool | `false` | Marca alrededor del foco. |
| `focus` | array | `null` | [x,y,r] normalizados respecto al recorte visible de la foto; obligatorio para marcador o sello con foto. |
| `target` | array | `[0.72, 0.52]` | Obsoleto: usar focus con radio. |
| `textIn` | enum (slam / slide / typewriter / none) | `"slam"` | Entrada de cada renglón del titular. |
| `stagger` | number [0–1] | `0.16` | Separación en segundos entre renglones. |
| `accentIn` | enum (slam / slide / typewriter / none) | `"slide"` | Entrada del acento después de su renglón. |
| `bulletIn` | enum (slam / slide / typewriter / none) | `"slam"` | Entrada de la cifra después del titular. |
| `inDuration` | number [0.05–2] | `0.42` | Duración en segundos de cada entrada. |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "common.tabloid", "params": {"text": "TÚ ERES EL SIGUIENTE", "accent": "SIGUIENTE", "strap": "AMAZON · IA"}}
```

### `common.question`

Tarjeta grande para la pregunta final del video; ocupa el acto completo y se adapta a 9:16 y 16:9.

Etiquetas: pregunta, comentarios, cierre, texto · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta exacta del guion (máximo 8 palabras). |
| `y` | number [0.2–0.8] | `0.5` | Centro vertical de la tarjeta (fracción del cuadro). |

```json
{"use": "common.question", "params": {"text": "¿La IA te quita trabajo?"}}
```

## binary · NODEHISTORY

### `binary.title`

Título de apertura GIGANTE hecho de 0 y 1 (~80% del cuadro, estilo cartel: cada renglón ocupa todo el ancho) con antetítulo y línea; las partículas convergen desde el polvo.

Etiquetas: intro, texto, gancho · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' parte renglones (2-4 renglones cortos). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16 (más renglones = letras más grandes). |
| `kicker` | string | `""` | Antetítulo chico en mono (época, protagonista). |
| `fit` | enum (lines / block) | `"lines"` | lines = cada renglón al ancho total (cartel); block = mismo tamaño. |
| `font` | string | `"900 100px 'Inter', sans-serif"` | Fuente canvas del título. |
| `fill` | number [0.4–1] | `0.9` | Fracción del ancho del cuadro que ocupa. |
| `morph` | number | `1.6` | Segundos que tardan las partículas en armar el título. |

```json
{"use": "binary.title", "params": {"text": "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", "textPortrait": "EL HOMBRE\nQUE\nROMPIÓ\nENIGMA", "kicker": "ALAN TURING · 1940"}}
```

### `binary.word`

Palabra o número grande hecho de glifos (momentos de alto impacto: '159 TRILLONES', '1952'), con rótulo arriba y nota abajo.

Etiquetas: texto, número, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto; '\n' parte renglones. |
| `kicker` | string | `""` | Etiqueta blanca arriba (mono). |
| `note` | string | `""` | Línea chica mono debajo. |
| `size` | number [0.3–1] | `0.86` | Fracción del ancho de contenido. |
| `font` | string | `"900 100px 'Inter', sans-serif"` | Fuente canvas. |
| `morph` | number | `1` | Segundos de armado. |

```json
{"use": "binary.word", "params": {"text": "159\nTRILLONES", "kicker": "COMBINACIONES POSIBLES", "note": "UN NÚMERO DE 21 CIFRAS"}}
```

### `binary.portrait`

Retrato (o cualquier foto) reconstruido como grilla de 0 y 1: el brillo de la imagen define la opacidad de cada dígito. Pie de foto y contador de años opcionales.

Etiquetas: persona, imagen, histórico · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Imagen (mejor fondo oscuro/limpio y rostro centrado). |
| `caption` | string | `""` | Nombre en serif itálica debajo. |
| `sub` | string | `""` | Línea mono debajo del nombre (rol, años). |
| `size` | number [0.3–1] | `0.86` | Fracción del contenido. |
| `contrast` | number | `1.3` | Contraste aplicado antes de muestrear. |
| `brightness` | number | `1.05` | Brillo aplicado antes de muestrear. |
| `threshold` | number | `0.08` | Brillo mínimo para poner un glifo (más alto = menos fondo). |
| `counter` | object | `null` | {from,to,label,dur} — año que rueda debajo (p.ej. 2026 → 1940). |
| `cell` | number [0.5–1.4] | `0.72` | Tamaño de celda (más chico = más detalle, más partículas). |
| `morph` | number | `1.4` | Segundos de armado. |

```json
{"use": "binary.portrait", "params": {"src": "assets/media/turing.jpg", "caption": "Alan Turing", "counter": {"from": 2026, "to": 1940, "label": ""}}}
```

### `binary.icon`

Silueta de un objeto hecha de glifos (bombilla, llave, barco, submarino, manzana, reloj…), con etiqueta tipo 'tag' y pie.

Etiquetas: objeto, símbolo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `icon` | icon · obligatorio | `null` | Nombre en binary/icons.js, 'text:X' (un carácter) o 'svg:<path 100×100>'. |
| `size` | number [0.15–1] | `0.62` | Fracción del contenido. |
| `tag` | string | `""` | Etiqueta blanca sobre la forma. |
| `caption` | string | `""` | Texto mono debajo. |
| `outline` | bool | `false` | Solo el contorno (más liviano y técnico). |
| `spin` | number | `0` | Giro lento en vueltas por segundo (0 = quieto). |
| `morph` | number | `1.1` | Segundos de armado. |

```json
{"use": "binary.icon", "params": {"icon": "key", "tag": "LA LLAVE", "caption": "palabras previsibles"}}
```

### `binary.orbit`

Ciclo: forma central de glifos dentro de un anillo punteado con 2-6 etapas alrededor; un punto recorre el anillo y la etapa activa se ilumina.

Etiquetas: proceso, ciclo, diagrama · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `icon` | icon | `"bulb"` | Forma central. |
| `labels` | array | `["HACER", "OBSERVAR", "CAMBIAR", "INTENTAR"]` | Etapas alrededor (sentido horario desde arriba). |
| `tags` | array | `[]` | Etiquetas que se alternan sobre la forma central. |
| `period` | number | `3.2` | Segundos por vuelta del punto. |
| `morph` | number | `1.1` | Segundos de armado. |

```json
{"use": "binary.orbit", "params": {"icon": "gear", "labels": ["PROBAR", "OBSERVAR", "AJUSTAR", "REPETIR"], "tags": ["INTENTO 1", "INTENTO 2"]}}
```

### `binary.grid`

Grilla de N copias de una forma que van apareciendo una a una con un contador ('VERSIONES 08'): muestra repetición, escala o cantidad.

Etiquetas: cantidad, iteración, versiones · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `icon` | icon | `"bulb"` | Forma repetida. |
| `count` | number [2–40] | `12` | Cuántas copias. |
| `label` | string | `""` | Rótulo del contador (vacío = sin contador). |
| `revealSec` | number | `2.4` | Segundos hasta mostrar todas las copias. |
| `morph` | number | `0.9` | Segundos de armado de cada copia. |

```json
{"use": "binary.grid", "params": {"icon": "bulb", "count": 16, "label": "VERSIONES"}}
```

### `binary.chart`

Curva de datos hecha de glifos que se dibuja de izquierda a derecha sobre ejes finos; etiqueta en el punto final ('DÍAS → HORAS').

Etiquetas: datos, tendencia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `curve` | enum (decay / growth / linear / s) | `"decay"` | Forma de la curva. |
| `startLabel` | string | `""` | Etiqueta del punto inicial. |
| `endLabel` | string | `""` | Etiqueta del punto final. |
| `axisX` | string | `""` | Nombre del eje X. |
| `axisY` | string | `""` | Nombre del eje Y. |
| `drawSec` | number | `2.2` | Segundos que tarda en dibujarse la curva. |
| `morph` | number | `0.6` | Segundos de armado. |

```json
{"use": "binary.chart", "params": {"curve": "decay", "startLabel": "DÍAS", "endLabel": "HORAS", "axisX": "TIEMPO"}}
```

### `binary.tunnel`

Túnel de anillos concéntricos de glifos que gira y avanza hacia la cámara: pausa dramática, viaje en el tiempo, 'entrar' en una idea.

Etiquetas: transición, profundidad, tiempo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `rings` | number [4–30] | `14` | Cantidad de anillos. |
| `speed` | number | `0.06` | Velocidad de avance (zoom por segundo). |
| `text` | string | `""` | Palabra mono en el centro (opcional). |
| `morph` | number | `1.2` | Segundos de armado. |

```json
{"use": "binary.tunnel", "params": {"rings": 14, "text": ""}}
```

### `binary.rays`

Haz de líneas de glifos que salen de un punto: abanico de caminos posibles, 'X' de contradicción o estallido radial; se dibujan del centro hacia afuera.

Etiquetas: opciones, caminos, contradicción, explosión · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mode` | enum (fan / x / burst) | `"fan"` | fan = abanico hacia abajo, x = cruz, burst = estrella. |
| `count` | number [2–36] | `10` | Cantidad de líneas (fan/burst). |
| `highlight` | number | `-1` | Índice de la línea resaltada (-1 = ninguna). |
| `label` | string | `""` | Etiqueta junto a la línea resaltada o arriba. |
| `drawSec` | number | `1.4` | Segundos en desplegarse. |
| `morph` | number | `0.6` | Segundos de armado. |

```json
{"use": "binary.rays", "params": {"mode": "fan", "count": 10, "label": "10 CAMINOS"}}
```

### `binary.frame`

Foto real (blanco y negro) dentro de un marco de glifos punteado, con título en serif y ficha mono: documento histórico, lugar, objeto real.

Etiquetas: foto, documento, evidencia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se muestra en escala de grises). |
| `title` | string | `""` | Título en serif itálica bajo la foto. |
| `sub` | string | `""` | Ficha mono bajo el título. |
| `ar` | number | `0` | Proporción del marco (0 = la de la foto). |
| `size` | number [0.3–1] | `0.82` | Fracción del contenido. |
| `tilt` | number | `0` | Inclinación del marco en grados. |
| `morph` | number | `1` | Segundos de armado del marco. |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "binary.frame", "params": {"src": "assets/media/bletchley.jpg", "title": "Bletchley Park", "sub": "INGLATERRA · 1939–1945"}}
```

### `binary.bubble`

Globo de diálogo de contorno con tres puntos que 'escriben' (esperar una respuesta, una pregunta en el aire).

Etiquetas: diálogo, pregunta, espera · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Texto dentro del globo (vacío = puntos animados). |
| `size` | number [0.3–1] | `0.6` | Fracción del contenido. |
| `morph` | number | `0.9` | Segundos de armado. |

```json
{"use": "binary.bubble", "params": {"text": ""}}
```

### `binary.floor`

Piso infinito en perspectiva hecho de filas de glifos que se desplazan hacia la cámara (vacío, inmensidad, final reflexivo).

Etiquetas: espacio, vacío, cierre · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Texto mono flotando sobre el horizonte. |
| `speed` | number | `0.35` | Velocidad de avance. |
| `morph` | number | `1.2` | Segundos de armado. |

```json
{"use": "binary.floor", "params": {"text": "¿Y AHORA?"}}
```

### `binary.introv1`

Miniatura de solo texto en el estilo monocromo de binary: el título hecho de partículas 0/1, en blanco puro, con la fecha en letras blancas encima.

Etiquetas: intro, miniatura, solo texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' parte renglones (2-4 renglones cortos). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16 (más renglones = letras más grandes). |
| `kicker` | string | `""` | Antetítulo (fecha, lugar) en letras blancas sobre el título. |
| `fit` | enum (lines / block) | `"lines"` | lines = cada renglón al ancho total (cartel); block = mismo tamaño. |
| `font` | string | `"900 100px 'Inter', sans-serif"` | Fuente canvas del título. |
| `fill` | number [0.4–1] | `0.9` | Fracción del ancho del cuadro que ocupa. |
| `morph` | number | `1.6` | Segundos que tardan las partículas en armar el título. |
| `highlight` | string | `""` | Frase opcional que se destaca en una etiqueta invertida debajo del título. |
| `sub` | string | `""` | Línea mono opcional debajo del título. |
| `glow` | number [0–0.6] | `0.3` | Opacidad extra de los glifos del texto (más = blanco más luminoso). |

```json
{"use": "binary.introv1", "params": {"text": "EL HOMBRE\nQUE ROMPIÓ\nENIGMA", "kicker": "ALAN TURING · 1940", "highlight": "ENIGMA"}}
```

### `binary.introv2`

Miniatura de texto e imagen: la frase (como en introv1, más chica) en una mitad y el retrato en glifos 0/1 en la otra; el lado de la foto se elige con imageSide.

Etiquetas: intro, miniatura, texto e imagen · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto de la miniatura; sin '\n' se corta solo en 1–3 renglones (el corte con la letra más grande). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `kicker` | string | `""` | Antetítulo (fecha, lugar) en caja blanca con letra negra sobre el texto. |
| `highlight` | string | `""` | Frase opcional que se destaca en una etiqueta invertida debajo del texto. |
| `sub` | string | `""` | Línea mono opcional debajo del texto. |
| `src` | image | `""` | Retrato o foto del tema (archivo de assets/media/ o URL). Vacío = cartel «IMAGEN PENDIENTE». |
| `video` | video | `""` | Clip .mp4 local, siempre mudo, convertido a glifos. |
| `poster` | image | `""` | Imagen inicial y respaldo; si falta, usa src. |
| `start` | number [0–None] | `0` | Segundo inicial del clip. |
| `rate` | number [0.25–2] | `1` | Velocidad del clip. |
| `loop` | bool | `true` | Repite el clip si termina antes del beat; evita congelar. |
| `imageSide` | enum (auto / left / right) | `"auto"` | Lado de la foto en 16:9 (el texto va en el otro). auto = alterna entre videos según el texto, así las intros no se ven siempre iguales; left/right lo fija (p. ej. para que el rostro mire hacia el texto). En 9:16 la foto va siempre arriba. |
| `zoom` | number [1–3] | `1.2` | Ampliación de la foto (1 = entera): un retrato más grande se reconoce mejor. |
| `focusX` | number [0–1] | `0.5` | Centro del recorte en la foto, horizontal (0 = izquierda). Moverlo hacia el rostro si queda cortado. |
| `focusY` | number [0–1] | `0.5` | Centro del recorte en la foto, vertical (0 = arriba). |
| `imageCell` | number [0.5–1.5] | `0.65` | Escala de glifos de la fotografía (menor = más detalle). |
| `contrast` | number [1–2.5] | `1.9` | Contraste de la foto antes de muestrear (más = luces y sombras más separadas). |
| `gamma` | number [1–3] | `1` | Curva de la foto: más alto = medios tonos y sombras más oscuros. |
| `threshold` | number [0–0.8] | `0.14` | Brillo mínimo para formar la imagen (lo que queda debajo es negro). |
| `glow` | number [0–0.6] | `0.3` | Opacidad extra de los glifos del texto (más = blanco más luminoso). |
| `morph` | number | `1.1` | Segundos para armar texto e imagen. |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "binary.introv2", "params": {"text": "ELLA LO\nPREVIÓ", "kicker": "APOLO 11 · 1969", "src": "assets/media/hamilton.jpg", "imageSide": "right"}}
```

### `binary.counter`

Número que se arma dígito a dígito como una tragamonedas (slot) o que cuenta hasta su valor (count), entre dos reglas de glifos: cifras enormes, años, cantidades.

Etiquetas: número, dato, escala, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `value` | string · obligatorio | `null` | Valor final tal como se lee ('159.000.000…', '2048', '1940'). |
| `mode` | enum (slot / count) | `"slot"` | slot = cada dígito gira y se fija de izquierda a derecha; count = cuenta numérica desde `from`. |
| `from` | number | `0` | Valor inicial (solo mode=count). |
| `dur` | number | `2.2` | Segundos hasta fijar el último dígito. |
| `label` | string | `""` | Etiqueta blanca arriba. |
| `note` | string | `""` | Línea mono debajo (aparece al terminar). |
| `size` | number [0.3–1] | `0.92` | Fracción del ancho del contenido. |
| `morph` | number | `0.8` | Segundos de armado de las reglas. |

```json
{"use": "binary.counter", "params": {"value": "159.000.000.000.000.000.000", "label": "COMBINACIONES", "note": "21 CIFRAS", "mode": "slot"}}
```

### `binary.cipher`

Mensaje que se cifra letra por letra: texto claro arriba, columna de glifos que 'pasa por la máquina' y letra cifrada abajo en caja. Con mode='crib' muestra una frase conocida alineada bajo el cifrado (la llave).

Etiquetas: código, cifrado, letras, criptografía · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `plain` | string · obligatorio | `null` | Texto en claro (mayúsculas, sin acentos mejor). |
| `cipher` | string | `""` | Texto cifrado; vacío = sustitución sembrada que nunca cifra una letra como sí misma (como Enigma). |
| `mode` | enum (encrypt / crib) | `"encrypt"` | encrypt = claro→cifrado; crib = cifrado arriba y la frase conocida abajo, resaltada. |
| `stepSec` | number | `0.14` | Segundos entre letra y letra. |
| `label` | string | `""` | Etiqueta arriba. |
| `morph` | number | `0.7` | Segundos de armado. |

```json
{"use": "binary.cipher", "params": {"plain": "NADA QUE INFORMAR", "label": "TEXTO CLARO → CIFRADO"}}
```

### `binary.rotors`

Rotores/tambores de glifos que giran a distinto ritmo: con pocos (1-5) muestran el abecedario y la letra activa en una ventana (Enigma); con muchos (6-120) forman una batería de tambores girando a la vez (la Bomba).

Etiquetas: máquina, engranaje, mecanismo, combinaciones · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `count` | number [1–120] | `3` | Cantidad de rotores. |
| `speed` | number | `4` | Pasos por segundo del rotor más rápido. |
| `tags` | array | `[]` | Rótulo bajo cada rotor (solo con pocos rotores). |
| `label` | string | `""` | Etiqueta arriba. |
| `morph` | number | `1` | Segundos de armado. |

```json
{"use": "binary.rotors", "params": {"count": 3, "tags": ["I", "II", "III"], "label": "ROTORES"}}
```

### `binary.timeline`

Línea de tiempo de glifos (vertical en 9:16, horizontal en 16:9) con hitos que aparecen al pasar el trazo; el hito `active` queda resaltado con caja y pulso.

Etiquetas: tiempo, fechas, historia, cronología · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | [{year, label}] de 2 a 7 hitos, en orden. |
| `active` | number | `-1` | Índice resaltado (-1 = ninguno). |
| `drawSec` | number | `1.8` | Segundos que tarda en recorrerse la línea. |
| `label` | string | `""` | Etiqueta arriba. |
| `morph` | number | `0.8` | Segundos de armado. |

```json
{"use": "binary.timeline", "params": {"items": [{"year": "1936", "label": "MÁQUINA UNIVERSAL"}, {"year": "1940", "label": "LA BOMBA"}, {"year": "1950", "label": "¿PUEDEN PENSAR?"}, {"year": "1954", "label": "MUERE"}], "active": 2}}
```

### `binary.versus`

Dos formas enfrentadas (persona ↔ máquina, prisión ↔ tratamiento) con un símbolo en el medio ('?', 'VS', '='); lado a lado en 16:9, una sobre otra en 9:16. `pick` resalta la elegida.

Etiquetas: comparación, dilema, pregunta, elección · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `left` | object · obligatorio | `null` | {icon, label} — primera opción. |
| `right` | object · obligatorio | `null` | {icon, label} — segunda opción. |
| `mid` | string | `"?"` | Símbolo central (1-3 caracteres). |
| `pick` | enum (none / left / right) | `"none"` | Resalta una opción (la otra se apaga) a los `pickAt` s. |
| `pickAt` | number | `1.8` | Segundo (local) en que se resalta la elegida. |
| `morph` | number | `1` | Segundos de armado. |

```json
{"use": "binary.versus", "params": {"left": {"icon": "person", "label": "PERSONA"}, "right": {"icon": "chip", "label": "MÁQUINA"}, "mid": "?"}}
```

### `binary.convoy`

Mar de glifos visto desde arriba con un convoy de barcos que cruza y submarinos al acecho. mode: attack (un barco se hunde), reroute (el convoy cambia de rumbo a tiempo), hunt (los submarinos quedan marcados y desaparecen).

Etiquetas: guerra, mar, barcos, rutas, amenaza · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mode` | enum (attack / reroute / hunt) | `"attack"` | Qué pasa en la escena. |
| `ships` | number [1–9] | `5` | Barcos del convoy. |
| `subs` | number [0–6] | `3` | Submarinos. |
| `label` | string | `""` | Etiqueta arriba (lugar). |
| `tag` | string | `""` | Rótulo del desenlace (aparece a los 2.4 s): 'HUNDIDO', 'RUTA NUEVA', 'CAZADOS'. |
| `morph` | number | `1` | Segundos de armado. |

```json
{"use": "binary.convoy", "params": {"mode": "reroute", "ships": 5, "subs": 3, "label": "ATLÁNTICO NORTE"}}
```

### `binary.banknote`

Un billete hecho de glifos 0/1: marco doble, medallón ovalado con un retrato muestreado y el valor grande a la izquierda. Sirve para el momento en que un personaje 'termina en un billete'.

Etiquetas: billete, dinero, retrato, historia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image | `""` | Retrato que va dentro del medallón ovalado. |
| `value` | string | `"50"` | Valor grande, hecho de glifos. |
| `currency` | string | `"£"` | Símbolo de la moneda, texto nítido junto al valor. |
| `caption` | string | `""` | Línea mono debajo del billete. |
| `morph` | number | `1` | Segundos de armado de la forma. |

```json
{"use": "binary.banknote", "params": {"src": "assets/media/turing.jpg", "value": "50", "currency": "£", "caption": "BILLETE DE 50 LIBRAS · 2021", "morph": 1}}
```

### `binary.wall`

Muro de ladrillos hechos de glifos con alambre arriba. mode=build lo levanta fila por fila; stand lo muestra quieto (división, encierro); break abre una brecha en el centro en `breakAt` y los fragmentos caen.

Etiquetas: muro, frontera, división, caída, construcción · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mode` | enum (build / stand / break) | `"stand"` | build = se levanta, stand = quieto, break = se rompe en el centro. |
| `rows` | number [4–14] | `7` | Filas de ladrillos. |
| `buildSec` | number | `2.4` | Segundos para levantarlo (mode=build). |
| `breakAt` | number | `2` | Segundo (local) en que se rompe (mode=break; admite "@palabra"). |
| `label` | string | `""` | Etiqueta blanca arriba. |
| `sub` | string | `""` | Línea mono debajo. |
| `morph` | number | `1` | Segundos de armado. |

```json
{"use": "binary.wall", "params": {"mode": "break", "label": "28 AÑOS", "breakAt": 2.2}}
```

### `binary.chessboard`

Diagrama de ajedrez con piezas vectoriales y jugadas UCI animadas; muestra aperturas y momentos concretos de una partida.

Etiquetas: ajedrez, tablero, partida, movimientos · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `fen` | string | `"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"` | FEN inicial del tablero. |
| `moves` | array | `[]` | Lista de jugadas UCI, como e2e4 o g5e6. |
| `notation` | array | `[]` | Rótulo opcional por jugada, por ejemplo 8. Nxe6. |
| `moveSec` | number [0.35–4] | `1.15` | Intervalo entre comienzos de jugadas. |
| `animSec` | number [0.3–3] | `0.78` | Duración del desplazamiento de cada pieza. |
| `delay` | number [0–5] | `0.4` | Espera antes de la primera jugada. |
| `focus` | string | `""` | Casilla para enmarcar, por ejemplo b5. |
| `label` | string | `""` | Etiqueta sobre el tablero. |
| `note` | string | `""` | Nota debajo del tablero. |
| `morph` | number | `1` | Segundos para armar la trama binaria. |

```json
{"use": "binary.chessboard", "params": {"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "moves": ["e2e4", "c7c6", "d2d4", "d7d5"], "notation": ["1. e4", "1... c6", "2. d4", "2... d5"], "moveSec": 1.1, "label": "DEFENSA CARO-KANN", "note": "DIAGRAMA DE APERTURA"}}
```

### `binary.chesspiece`

Pieza de ajedrez con siluetas SVG trazadas en dígitos 0/1 generados por Canvas; permite elegir entre los dos caballos de referencia.

Etiquetas: ajedrez, caballo, torre, pieza · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `piece` | enum (pawn / knight / bishop / rook / queen / king) | `"knight"` | Tipo de pieza. |
| `side` | enum (white / black) | `"white"` | Color de la pieza. |
| `action` | enum (idle / advance / threatened / sacrifice) | `"idle"` | Tratamiento visual. |
| `art` | enum (variable / referencia) | `"variable"` | Silueta SVG fuente del caballo: versión detallada o trazado de referencia. |
| `srcVariable` | image | `""` | SVG del caballo detallado de 360 × 360. |
| `srcReference` | image | `""` | SVG del caballo de referencia de 687 × 1024. |
| `label` | string | `""` | Etiqueta superior. |
| `note` | string | `""` | Nota inferior. |
| `morph` | number | `1` | Segundos para armar la trama binaria. |

```json
{"use": "binary.chesspiece", "params": {"piece": "knight", "side": "white", "action": "threatened", "art": "variable", "label": "CABALLO BLANCO", "note": "EL PEÓN h6 AMENAZA g5"}}
```

### `binary.searchtree`

Árbol esquemático de jugadas posibles con una ruta destacada; sirve para explicar búsqueda y evaluación sin afirmar que sea un registro literal del cálculo.

Etiquetas: búsqueda, opciones, ramas, cálculo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `depth` | number [2–4] | `4` | Cantidad de niveles de decisión. |
| `branching` | number [2–3] | `2` | Ramas por posición. |
| `focusPath` | array | `[1, 0, 1, 0]` | Índice de la rama destacada en cada nivel. |
| `label` | string | `""` | Etiqueta superior. |
| `note` | string | `""` | Nota inferior; usar ESQUEMA para aclarar el dibujo. |
| `morph` | number | `1` | Segundos para armar la trama binaria. |

```json
{"use": "binary.searchtree", "params": {"depth": 4, "branching": 2, "focusPath": [1, 0, 1, 0], "label": "HARDWARE + BÚSQUEDA", "note": "ESQUEMA DE OPCIONES"}}
```

### `binary.outrov1`

Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa.

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Línea superior. |
| `channel` | string | `"NODETECH"` | Nombre del canal, dibujado con glifos. |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón. |
| `support` | string | `"Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."` | Texto de apoyo inferior. |
| `handle` | string | `"youtube.com/@nodetech"` | Usuario del canal. |
| `morph` | number | `1.2` | Segundos de armado del nombre. |
| `likeAt` | number | `1` | Segundo de la voz en que aparece el like. |
| `subscribeAt` | number | `2.5` | Segundo de la voz en que aparece suscríbete. |
| `bellAt` | number | `3.25` | Segundo de la voz en que aparece la campana. |
| `supportAt` | number | `3.65` | Segundo de la voz en que aparece el mensaje de apoyo. |

```json
{"use": "binary.outrov1", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."}}
```

### `binary.outro`

Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa. Alias compatible para binary.outro.

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Línea superior. |
| `channel` | string | `"NODETECH"` | Nombre del canal, dibujado con glifos. |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón. |
| `support` | string | `"Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."` | Texto de apoyo inferior. |
| `handle` | string | `"youtube.com/@nodetech"` | Usuario del canal. |
| `morph` | number | `1.2` | Segundos de armado del nombre. |
| `likeAt` | number | `1` | Segundo de la voz en que aparece el like. |
| `subscribeAt` | number | `2.5` | Segundo de la voz en que aparece suscríbete. |
| `bellAt` | number | `3.25` | Segundo de la voz en que aparece la campana. |
| `supportAt` | number | `3.65` | Segundo de la voz en que aparece el mensaje de apoyo. |

```json
{"use": "binary.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado."}}
```

## rough · PROTOTIPO

### `rough.title`

Título de apertura GIGANTE (cartel: cada renglón al ancho total, ~80% del cuadro): las letras se dibujan en contorno y se rellenan; antetítulo en etiqueta lima, subtítulo debajo y subrayado a mano. Puede parpadear como alarma.

Etiquetas: intro, gancho, texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' parte renglones. |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `kicker` | string | `""` | Antetítulo (etiqueta lima arriba). |
| `sub` | string | `""` | Subtítulo debajo (Inter 800, se parte solo). |
| `accent` | bool | `false` | Título en color de acento (lima) en vez de blanco. |
| `blink` | number [0–6] | `0` | Parpadeos tipo alarma al terminar de dibujarse (0 = ninguno). |
| `fill` | number [0.4–1] | `0.9` | Fracción del ancho que ocupa. |
| `underline` | bool | `true` | Subrayado a mano bajo el último renglón. |

```json
{"use": "rough.title", "params": {"text": "1202", "kicker": "APOLO 11 · 20 JUL 1969", "sub": "EL ERROR QUE LLEVÓ A LA HUMANIDAD A LA LUNA", "accent": true, "blink": 3}}
```

### `rough.icon`

Boceto de un objeto (diccionario rough/sketches.js) que se dibuja trazo a trazo; relleno rayado lima opcional, etiqueta arriba y nota manuscrita abajo.

Etiquetas: objeto, concepto, símbolo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `icon` | icon · obligatorio | `null` | Nombre del boceto (ver catálogo de sketches). |
| `size` | number [0.15–1] | `0.55` | Fracción del contenido. |
| `tag` | string | `""` | Etiqueta lima arriba. |
| `caption` | string | `""` | Nota manuscrita (Caveat) abajo. |
| `accent` | bool | `false` | Relleno rayado lima (resalta este objeto). |
| `color` | enum (ink / accent) | `"ink"` | Color del trazo. |
| `drawSec` | number | `1.3` | Segundos que tarda en dibujarse. |

```json
{"use": "rough.icon", "params": {"icon": "rocket", "tag": "APOLO 11", "caption": "julio de 1969", "accent": true}}
```

### `rough.photo`

Foto real en blanco y negro (o virada a lima) que se revela con un barrido dentro de un marco dibujado a mano con cintas; nombre manuscrito y ficha mono debajo. Zoom lento (Ken Burns).

Etiquetas: foto, persona, lugar, documento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (jpg/png local). |
| `caption` | string | `""` | Nombre / título manuscrito (Caveat, lima). |
| `sub` | string | `""` | Ficha mono bajo el nombre. |
| `tone` | enum (mono / lime) | `"mono"` | mono = B/N contrastado; lime = sombras negras y luces lima. |
| `size` | number [0.3–1] | `0.84` | Fracción del contenido. |
| `ar` | number | `0` | Proporción del recorte (0 = la de la foto; en 9:16 conviene 0.8). |
| `tilt` | number | `-1.5` | Inclinación del marco en grados. |
| `focus` | array | `[0.5, 0.4]` | Punto [x,y] 0..1 hacia donde se acerca el zoom. |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "rough.photo", "params": {"src": "assets/media/hamilton.jpg", "caption": "Margaret Hamilton", "sub": "DIRECTORA DE SOFTWARE · MIT · 32 AÑOS"}}
```

### `rough.annotate`

Marca a mano ENCIMA de lo que hay en pantalla: círculo, subrayado, flecha, caja o tachado, en lima, sobre una zona del cuadro de contenido; texto manuscrito opcional al lado.

Etiquetas: énfasis, marca, flecha · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `kind` | enum (circle / underline / arrow / box / cross) | `"circle"` | Tipo de marca. |
| `x` | number | `0.2` | Zona: x (fracción del contenido). |
| `y` | number | `0.35` | Zona: y. |
| `w` | number | `0.6` | Zona: ancho. |
| `h` | number | `0.3` | Zona: alto. |
| `note` | string | `""` | Texto manuscrito junto a la marca. |
| `drawSec` | number | `0.6` | Segundos de trazo. |

```json
{"use": "rough.annotate", "params": {"kind": "circle", "x": 0.2, "y": 0.3, "w": 0.6, "h": 0.3, "note": "¡aquí!"}}
```

### `rough.introv1`

Miniatura de solo texto con el tratamiento a mano de rough: título enorme, línea lima y antetítulo opcional.

Etiquetas: intro, miniatura, solo texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' separa renglones. |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `highlight` | string | `""` | Renglón que se pinta en lima. |
| `kicker` | string | `""` | Antetítulo en etiqueta lima. |
| `sub` | string | `""` | Línea chica opcional bajo el título. |
| `fill` | number [0.45–1] | `0.88` | Ancho ocupado por el título. |

```json
{"use": "rough.introv1", "params": {"text": "LA COMPUTADORA\nDEL APOLO 11\nSE RINDIÓ", "highlight": "SE RINDIÓ", "kicker": "APOLO 11 · 1969"}}
```

### `rough.introv2`

Miniatura de texto e imagen al estilo de las miniaturas de tecnología: título enorme alineado a la izquierda y una foto o video grande a color que se funde con el fondo (en 9:16 va arriba).

Etiquetas: intro, miniatura, texto e imagen · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' separa renglones (2 a 4 renglones cortos). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `highlight` | string | `""` | Renglón que se pinta en lima (el remate). |
| `kicker` | string | `""` | Antetítulo en etiqueta lima. |
| `sub` | string | `""` | Línea chica opcional bajo el título. |
| `src` | image | `""` | Foto o render del objeto del tema (a color). |
| `video` | video | `""` | Clip .mp4 local, siempre mudo; reemplaza la foto. |
| `poster` | image | `""` | Imagen inicial y respaldo del video; si falta, usa src. |
| `start` | number [0–None] | `0` | Segundo inicial del clip. |
| `rate` | number [0.25–2] | `1` | Velocidad del clip. |
| `loop` | bool | `true` | Repite el clip si termina antes del beat; evita congelar. |
| `saturate` | number [0–1.4] | `1` | Color de la foto (0 = blanco y negro). |
| `focus` | string | `"xMidYMid"` | Encuadre de la foto (preserveAspectRatio: xMinYMid, xMaxYMid…). |
| `logo` | image | `""` | SVG o PNG transparente en assets/media/logos/. |
| `logoName` | string | `""` | Marca; fallback tipográfico si no carga el archivo. |
| `logoPos` | enum (auto / top-left / top-right / bottom-left / bottom-right) | `"auto"` | Esquina de la foto/video; auto evita el foco declarado. |
| `logoSize` | number [0.12–0.35] | `0.22` | Ancho relativo al medio; el logo conserva proporciones. |
| `logoInvert` | bool | `false` | Versión blanca para un logo oscuro sobre medio oscuro. |

```json
{"use": "rough.introv2", "params": {"text": "¿SE ACABÓ\nLA PC\nBARATA?", "highlight": "BARATA?", "kicker": "MEMORIA RAM · 2026", "src": "assets/media/hamilton.jpg"}}
```

### `rough.flow`

Cadena de 2-5 pasos (boceto + rótulo) unidos por flechas a mano que aparecen en orden: causa → efecto, un proceso, un sistema. `active` resalta un paso en lima.

Etiquetas: proceso, causa, pasos, sistema · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `nodes` | array · obligatorio | `null` | [{icon, label}] de 2 a 5. |
| `active` | number | `-1` | Índice resaltado (-1 = ninguno). |
| `stepSec` | number | `0.8` | Segundos entre paso y paso. |
| `title` | string | `""` | Etiqueta lima arriba. |

```json
{"use": "rough.flow", "params": {"nodes": [{"icon": "radar", "label": "RADAR"}, {"icon": "chip", "label": "COMPUTADORA"}, {"icon": "alarm", "label": "1202"}], "active": 2}}
```

### `rough.compare`

Comparación de escala por ÁREA: un cuadrado diminuto (lo chico, en lima) dentro de uno enorme (lo grande). Para 'millones de veces más': el chico queda casi un punto. Con valores y flecha manuscrita.

Etiquetas: escala, comparación, datos, tamaño · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `small` | object · obligatorio | `null` | {label, value} — lo pequeño (va en lima). |
| `big` | object · obligatorio | `null` | {label, value} — lo grande. |
| `ratio` | number | `100` | Cuántas veces más grande (área). Mínimo visible: un punto. |
| `bigFirst` | bool | `false` | true = primero el grande y después aparece el chico. |
| `bigAt` | number | `1.3` | Segundo (local) en que se dibuja el grande (admite "@palabra"). |

```json
{"use": "rough.compare", "params": {"small": {"label": "APOLO 11", "value": "4 KB"}, "big": {"label": "TU TELÉFONO", "value": "MILLONES DE VECES MÁS"}, "ratio": 1000000}}
```

### `rough.stack`

Pila de tareas en cajas a mano; en `dropAt` las que no se conservan se tachan y caen, y las importantes suben y se pintan de lima. Para prioridades, triage, 'soltar lo secundario'.

Etiquetas: prioridades, lista, sistema, descartar · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | [{label, keep}] de arriba (más importante) hacia abajo, 2-6. |
| `dropAt` | number | `-1` | Segundo (local) en que se descarta lo secundario (-1 = nunca). |
| `title` | string | `""` | Etiqueta lima arriba. |

```json
{"use": "rough.stack", "params": {"title": "PRIORIDADES", "items": [{"label": "ATERRIZAR", "keep": true}, {"label": "NAVEGAR", "keep": true}, {"label": "PANTALLA"}, {"label": "RADAR"}], "dropAt": 2.4}}
```

### `rough.dsky`

Panel de la computadora del Apolo (DSKY) dibujado a mano: luces de aviso, pantalla PROG/VERB/NOUN y teclado. El código (p. ej. 1202) aparece en lima y parpadea con la luz PROG encendida.

Etiquetas: computadora, pantalla, alarma, apolo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `code` | string | `"1202"` | Código que aparece en la pantalla (4-5 dígitos). |
| `alarm` | bool | `true` | Luz PROG encendida y código parpadeando. |
| `verb` | string | `"05"` | Valor VERB. |
| `noun` | string | `"09"` | Valor NOUN. |
| `size` | number [0.3–1] | `0.86` | Fracción del contenido. |

```json
{"use": "rough.dsky", "params": {"code": "1202", "alarm": true}}
```

### `rough.rope`

Memoria de cuerda (core rope): anillos magnéticos en fila y un alambre que se teje: si ATRAVIESA el anillo es 1, si lo RODEA es 0. Los bits aparecen debajo a medida que pasa el alambre.

Etiquetas: memoria, datos, unos y ceros, tejido · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `bits` | string | `"1011"` | Bits (3-8 caracteres '0'/'1'). |
| `caption` | string | `""` | Nota manuscrita. |
| `drawSec` | number | `2.6` | Segundos que tarda el alambre en tejerse. |

```json
{"use": "rough.rope", "params": {"bits": "101101", "caption": "tejido a mano"}}
```

### `rough.gauge`

Indicador semicircular a mano con aguja y número grande que baja (o sube) de `from` a `to`: combustible, tiempo que queda, presión. La zona crítica final parpadea en lima.

Etiquetas: combustible, cuenta regresiva, nivel, urgencia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `from` | number | `60` | Valor inicial. |
| `to` | number | `30` | Valor final. |
| `max` | number | `0` | Escala máxima del dial (0 = max(from,to)). |
| `dur` | number | `3` | Segundos que tarda en llegar a `to`. |
| `unit` | string | `""` | Unidad bajo el número. |
| `label` | string | `""` | Etiqueta lima arriba. |
| `critical` | number | `0.25` | Fracción del dial considerada crítica (zona rayada). |

```json
{"use": "rough.gauge", "params": {"from": 60, "to": 30, "unit": "SEGUNDOS", "label": "COMBUSTIBLE"}}
```

### `rough.descent`

Vista lateral de un descenso: suelo lunar a mano con cráter y rocas, el módulo lunar bajando por su trayectoria. mode=auto va directo al cráter; mode=manual se desvía en el último tramo hasta una zona plana marcada con X.

Etiquetas: trayectoria, aterrizaje, maniobra, luna · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mode` | enum (auto / manual) | `"manual"` | Trayectoria. |
| `dur` | number | `4.5` | Segundos del descenso completo. |
| `hazard` | string | `""` | Rótulo del cráter. |
| `target` | string | `""` | Nota manuscrita del punto de aterrizaje. |
| `altFrom` | number | `150` | Altitud inicial mostrada (m). |
| `divertAt` | number | `-1` | Segundo (local) en que empieza el desvío manual (admite "@palabra"; -1 = al 60%). |

```json
{"use": "rough.descent", "params": {"mode": "manual", "hazard": "CRÁTER CON ROCAS", "target": "zona plana"}}
```

### `rough.tally`

Algo que se repite N veces: boceto que se sacude en cada repetición, palotes a mano (|||| tachados de a 5) y contador grande '×N'.

Etiquetas: repetición, conteo, alarma, veces · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `icon` | icon | `"alarm"` | Boceto que se sacude. |
| `count` | number [1–15] | `5` | Cantidad de repeticiones. |
| `interval` | number | `0.6` | Segundos entre repeticiones. |
| `label` | string | `""` | Etiqueta lima arriba. |

```json
{"use": "rough.tally", "params": {"icon": "alarm", "count": 5, "interval": 0.55, "label": "ALARMA 1202"}}
```

### `rough.choice`

Dos (o tres) opciones en cajas a mano; en `pickAt` la elegida se pinta de lima con un ✓ y las otras se tachan. Para decisiones bajo presión (ABORTAR / SEGUIR).

Etiquetas: decisión, opciones, dilema, elección · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `options` | array · obligatorio | `null` | 2-3 textos cortos. |
| `pick` | number | `-1` | Índice elegido (-1 = sin decidir). |
| `pickAt` | number | `2` | Segundo (local) de la decisión. |
| `question` | string | `""` | Pregunta manuscrita arriba. |

```json
{"use": "rough.choice", "params": {"options": ["ABORTAR", "SEGUIR"], "pick": 1, "pickAt": 2.2, "question": "¿y ahora?"}}
```

### `rough.timeline`

Línea de tiempo a mano (vertical en 9:16, horizontal en 16:9) con hitos que se marcan al pasar el trazo; el hito `active` va en lima con círculo a mano.

Etiquetas: tiempo, fechas, historia, cronología · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | [{year, label}] 2-6. |
| `active` | number | `-1` | Índice resaltado. |
| `drawSec` | number | `1.8` | Segundos del trazo completo. |

```json
{"use": "rough.timeline", "params": {"items": [{"year": "1961", "label": "Kennedy: la Luna"}, {"year": "1965", "label": "Hamilton entra al MIT"}, {"year": "1969", "label": "Apolo 11"}], "active": 2}}
```

### `rough.load`

Un recipiente vertical (la máquina) se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan fuera temblando y el borde se raya en lima con un rótulo grande de desborde.

Etiquetas: capacidad, límite, desborde, computadora · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `tasks` | array | `["BOOT", "SCAN", "INDEX", "QUERY", "WRITE"]` | Tareas que entran en orden. |
| `capacity` | number [1–12] | `5` | Ranuras del recipiente. |
| `stepSec` | number | `0.55` | Segundos entre bloque y bloque. |
| `overflowAt` | number | `-1` | Segundo local en que llegan las tareas extra (-1 = nunca). |
| `extra` | array | `[]` | Rótulos de tareas que no caben. |
| `overflowLabel` | string | `"1202"` | Rótulo grande de desborde. |
| `title` | string | `""` | Etiqueta lima arriba (vacío = sin etiqueta). |

```json
{"use": "rough.load", "params": {"tasks": ["BOOT", "SCAN", "INDEX", "QUERY", "WRITE"], "capacity": 5, "stepSec": 0.55, "overflowAt": 3.6, "extra": ["RADAR", "RADAR"], "overflowLabel": "1202"}}
```

### `rough.note`

Hoja de papel dibujada a mano con un título mecanografiado y renglones de texto garabateado; en `noteAt` aparece una nota manuscrita en lima en el margen (un comentario, una firma, 'vago, pero emocionante').

Etiquetas: documento, propuesta, nota, manuscrito · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string | `""` | Título del documento (mono, se escribe letra a letra). |
| `note` | string | `""` | Nota manuscrita en lima (Caveat). |
| `noteAt` | number | `2` | Segundo (local) en que aparece la nota (admite "@palabra"). |
| `lines` | number [3–16] | `9` | Renglones de texto garabateado. |
| `caption` | string | `""` | Rótulo mono debajo del papel (fecha, autor). |

```json
{"use": "rough.note", "params": {"title": "INFORMATION MANAGEMENT: A PROPOSAL", "note": "vague but exciting…", "noteAt": 2}}
```

### `rough.network`

Red que crece: un nodo central y nodos que aparecen en anillos, unidos por enlaces a mano (documentos que se enlazan, la web, una comunidad). Los primeros nodos pueden llevar rótulo; el central va en lima.

Etiquetas: red, enlaces, web, conexiones, crecimiento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `center` | string | `""` | Rótulo del nodo central (lima). |
| `labels` | array | `[]` | Rótulos de los primeros nodos del anillo. |
| `count` | number [4–70] | `24` | Cantidad de nodos. |
| `growSec` | number | `3` | Segundos hasta mostrar todos los nodos. |

```json
{"use": "rough.network", "params": {"center": "WWW", "labels": ["DOC", "FOTO", "VIDEO", "MAPA"], "count": 28, "growSec": 3}}
```

### `rough.browser`

Ventana de navegador dibujada a mano: la dirección se escribe letra a letra en la barra, aparece la página (título + renglones) y un cursor hace clic en un enlace lima en `clickAt`.

Etiquetas: web, navegador, página, internet, sitio · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `url` | string | `"info.cern.ch"` | Dirección (mono). |
| `title` | string | `""` | Título grande de la página. |
| `link` | string | `""` | Texto del enlace (lima, subrayado). |
| `clickAt` | number | `-1` | Segundo (local) del clic en el enlace (-1 = sin clic; admite "@palabra"). |
| `caption` | string | `""` | Nota manuscrita debajo. |

```json
{"use": "rough.browser", "params": {"url": "info.cern.ch", "title": "World Wide Web", "link": "¿qué es esto?", "clickAt": 3}}
```

### `rough.counter`

Cifra GIGANTE que cuenta de `from` a `to` (con separador de miles) y queda subrayada a mano; etiqueta lima arriba y unidad manuscrita abajo. Para cifras de escala: usuarios, sitios, años, dinero.

Etiquetas: número, cifra, escala, crecimiento, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `from` | number | `0` | Valor inicial. |
| `to` | number | `100` | Valor final. |
| `dur` | number | `2.2` | Segundos de conteo (admite "@palabra"). |
| `label` | string | `""` | Etiqueta lima arriba. |
| `unit` | string | `""` | Unidad / comentario manuscrito abajo. |
| `prefix` | string | `""` | Prefijo (p. ej. '$'). |
| `suffix` | string | `""` | Sufijo (p. ej. '%'). |

```json
{"use": "rough.counter", "params": {"from": 0, "to": 6000000000, "label": "PERSONAS EN INTERNET", "unit": "y contando…", "dur": 2.5}}
```

### `rough.outrov1`

Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida.

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Línea superior. |
| `channel` | string | `"NODETECH"` | Nombre del canal. |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón pintado. |
| `support` | string | `"Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."` | Texto de apoyo inferior. |
| `handle` | string | `"youtube.com/@nodetech"` | Usuario del canal. |
| `likeAt` | number | `1` | Segundo de la voz en que aparece el like. |
| `subscribeAt` | number | `2.5` | Segundo de la voz en que empieza a dibujarse suscríbete. |
| `bellAt` | number | `3.25` | Segundo de la voz en que aparece la campana. |
| `supportAt` | number | `3.65` | Segundo de la voz en que aparece el mensaje de apoyo. |

```json
{"use": "rough.outrov1", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."}}
```

### `rough.outro`

Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida. Alias compatible para rough.outro.

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Línea superior. |
| `channel` | string | `"NODETECH"` | Nombre del canal. |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón pintado. |
| `support` | string | `"Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."` | Texto de apoyo inferior. |
| `handle` | string | `"youtube.com/@nodetech"` | Usuario del canal. |
| `likeAt` | number | `1` | Segundo de la voz en que aparece el like. |
| `subscribeAt` | number | `2.5` | Segundo de la voz en que empieza a dibujarse suscríbete. |
| `bellAt` | number | `3.25` | Segundo de la voz en que aparece la campana. |
| `supportAt` | number | `3.65` | Segundo de la voz en que aparece el mensaje de apoyo. |

```json
{"use": "rough.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades."}}
```

## acuarela · TINTA

### `acuarela.title`

Apertura 'THE HISTORY': título condensado en rojo ladrillo con rayas finas a ambos lados y subtítulo, sobre una gran mancha de acuarela que es una foto lavada (florece desde varios focos) y bloques manuscritos.

Etiquetas: apertura, título, portada · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Título (se escribe en mayúsculas). |
| `sub` | string | `""` | Subtítulo chico bajo el título. |
| `bg` | image | `""` | Foto que forma la mancha de fondo (se lava a gris). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `titlePortrait` | string | `""` | Título alternativo para 9:16 ('\n' parte renglones). |

```json
{"use": "acuarela.title", "params": {"title": "La noche que cayó el muro", "sub": "Berlín · 9 de noviembre de 1989", "bg": "assets/media/muro-gente.jpg"}}
```

### `acuarela.photo`

Una foto de archivo con marco (estampilla o copia vieja) que entra deslizándose y se asienta, mancha-foto que florece detrás, fecha grande con raya fina y párrafo corto que aparecen por tinta. layout: top (fecha centrada arriba), right (fecha abajo a la derecha), left (fecha abajo a la izquierda).

Etiquetas: foto, fecha, lugar, evento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | La foto principal. |
| `date` | string | `""` | Fecha o rótulo grande (Oswald, rojo ladrillo). |
| `text` | string | `""` | Párrafo corto (1–3 renglones). |
| `layout` | enum (top / right / left) | `"top"` | Diagramación de la referencia. |
| `bg` | image | `""` | Foto de la mancha de fondo (vacío = la misma foto). |
| `frame` | enum (stamp / deckle) | `"stamp"` | Marco: estampilla perforada o copia vieja. |
| `enter` | enum (auto / down / up / left / right / zoom / tilt / shrink / none) | `"auto"` | Entrada de la foto (auto = la del layout). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `bgFocus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |

```json
{"use": "acuarela.photo", "params": {"src": "assets/media/mauerbau.jpg", "date": "Agosto de 1961", "text": "En una sola noche, soldados y obreros levantan alambre y bloques en medio de Berlín.", "layout": "top", "bg": "assets/media/leipzig.jpg"}}
```

### `acuarela.pair`

Dos fotos superpuestas (la segunda tapa el borde de la primera y llega un instante después) + fecha y párrafo; mancha-foto y manuscrito detrás. layout: above (texto arriba, fotos abajo), right (fotos a la izquierda, fecha arriba a la derecha; entra girada con zoom), below (fotos arriba, fecha abajo), center (fotos lado a lado, fecha centrada; entra con zoom hacia atrás), dual (dos fechas, una por foto).

Etiquetas: fotos, comparación, fecha, collage · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `a` | image · obligatorio | `null` | Primera foto (abajo en la pila). |
| `b` | image · obligatorio | `null` | Segunda foto (arriba en la pila). |
| `date` | string | `""` | Fecha principal. |
| `text` | string | `""` | Párrafo principal. |
| `date2` | string | `""` | Solo layout dual: segunda fecha. |
| `text2` | string | `""` | Solo layout dual: segundo párrafo. |
| `layout` | enum (above / right / below / center / dual) | `"above"` | Diagramación de la referencia. |
| `bg` | image | `""` | Foto de la mancha de fondo (vacío = la primera). |
| `frameA` | enum (stamp / deckle) | `"stamp"` | Marco de la primera foto. |
| `frameB` | enum (stamp / deckle) | `"deckle"` | Marco de la segunda foto. |
| `enter` | enum (auto / down / up / left / right / zoom / tilt / shrink / none) | `"auto"` | Entrada del par (auto = la del layout). |
| `focusA` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `focusB` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `bgFocus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |

```json
{"use": "acuarela.pair", "params": {"a": "assets/media/bornholmer.jpg", "b": "assets/media/muro-gente.jpg", "date": "9 de noviembre", "text": "Miles de personas llegan a los pasos fronterizos.", "layout": "right"}}
```

### `acuarela.quote`

Retrato vertical (copia vieja) que entra desde la izquierda achicándose, cita en sans condensada a su derecha que aparece por manchas, firma en rojo ladrillo y una 'isla' de mancha-foto detrás.

Etiquetas: cita, retrato, frase, personaje · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Retrato (se recorta vertical). |
| `quote` | string · obligatorio | `null` | La cita (2–5 renglones). |
| `name` | string | `""` | Firma (rojo ladrillo). |
| `bg` | image | `""` | Foto de la mancha de fondo. |
| `focus` | array | `[0.5, 0.3]` | Punto de interés del retrato [x,y]. |
| `bgFocus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `frame` | enum (stamp / deckle) | `"deckle"` | Marco del retrato. |

```json
{"use": "acuarela.quote", "params": {"src": "assets/media/schabowski.jpg", "quote": "Eso entra en vigor, según mi información, de inmediato, sin demora.", "name": "Günter Schabowski", "bg": "assets/media/bornholmer.jpg"}}
```

### `acuarela.introv1`

GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: blots | wash | timeline | manuscript | image con src | component con use/useParams); por defecto manchas de tinta y acuarela que florecen sobre el papel y manuscrito que se escribe. Titular GIGANTE en Oswald ladrillo: cada palabra cae y se revela 'comida' por una máscara de tinta que sangra, con sacudida y gotitas; '^palabra^' queda calada en una mancha de tinta negra. En dropAt cae una gota: salpica, una aguada sepia florece detrás y un pincel subraya. Subtítulo manuscrito.

Etiquetas: intro, gancho, apertura, título, tinta, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra calada en una mancha de tinta negra. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha), con rayas finas. |
| `sub` | string | `""` | Línea manuscrita debajo del titular (se escribe a pluma). |
| `wordAt` | number | `0.45` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.28` | Segundos entre palabra y palabra. |
| `dropAt` | number | `2.3` | Segundo en que cae la gota de tinta: salpica, florece la aguada sepia y el pincel subraya (-1 = sin gota). Acepta '@palabra'. |
| `bg` | enum (auto / blots / wash / timeline / manuscript / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: blots, wash, timeline, manuscript; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Velo de papel sobre el fondo foto/componente (paleta clara: se lava hacia el papel; 0 = nada). |
| `blot` | bool | `true` | bg=image: la foto aparece dentro de una mancha de tinta que florece (false = a sangre). |

```json
{"use": "acuarela.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "dropAt": 2.3}}
```

### `acuarela.introv2`

GANCHO pregunta + revelación. Fondo adaptable al tema (bg: manuscript | blots | wash | timeline | image con src | component con use/useParams); por defecto una página manuscrita con renglones y margen ladrillo donde cae una gota que se expande. Rótulo tipo fecha que se revela comido por tinta con su raya. La pregunta GIGANTE se escribe letra a letra con tinta fresca (una gota de pluma avanza delante) y la respuesta llega como una PINCELADA de acuarela ladrillo que barre con el texto calado en papel, con sacudida y salpicadura.

Etiquetas: intro, gancho, apertura, pregunta, pincelada, tinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo tipo fecha arriba (Oswald ladrillo con raya). |
| `stamp` | string | `""` | Respuesta: pincelada de acuarela que barre con el texto calado (vacío = sin pincelada). |
| `stampAt` | number | `2.4` | Segundo de la pincelada (acepta '@palabra'). |
| `typeAt` | number | `0.35` | Segundo en que empieza a escribirse la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo de la escritura. |
| `bg` | enum (auto / blots / wash / timeline / manuscript / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: blots, wash, timeline, manuscript; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Velo de papel sobre el fondo foto/componente (paleta clara: se lava hacia el papel; 0 = nada). |
| `blot` | bool | `true` | bg=image: la foto aparece dentro de una mancha de tinta que florece (false = a sangre). |

```json
{"use": "acuarela.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}
```

### `acuarela.outro`

Cierre del canal SIN recuadro (bg: wash | blots | timeline | manuscript | image con src | component con use/useParams): por defecto papel con una aguada sepia que barre y pinceladas que chorrean. GRACIAS POR VER con rayas → nombre del canal GIGANTE en Oswald ladrillo que la tinta 'come' sobre una aguada que florece, subrayado a pincel y firma manuscrita → pulgar a tinta que se llena de acuarela ladrillo al marcar LIKE + círculo a pincel → flecha a pincel → pincelada SUSCRÍBETE con el texto calado + campana a tinta que suena → mensaje de apoyo por manchas → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, tinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte la historia."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / wash / blots / timeline / manuscript / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: wash, blots, timeline, manuscript; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.65` | Velo de papel sobre el fondo foto/componente (el cierre tiene mucho texto; paleta clara: se lava hacia el papel). |
| `blot` | bool | `true` | bg=image: la foto aparece dentro de una mancha de tinta que florece (false = a sangre). |

```json
{"use": "acuarela.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más historias.", "handle": "youtube.com/@nodetech"}}
```

## carta · CARTA

### `carta.retrato`

Retrato con borde de pincel a la izquierda; a la derecha rótulo en caja crema, sello de correo, fechas, título enorme con regla y subtítulo; la foto se repite fantasma detrás de los textos (panel 'THE BEST WISHES / HISTORICAL').

Etiquetas: foto, persona, retrato, presentación · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `stamp` | string | `""` | Sello circular 'ARRIBA|CENTRO|ABAJO' (vacío = sin sello). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.retrato", "params": {"src": "assets/media/mauerbau.jpg", "label": "VOCERO DEL PARTIDO", "stamp": "ARCHIVO|1989|BERLÍN", "years": "9 - 11 - 1989", "title": "SCHABOWSKI", "sub": "GÜNTER"}}
```

### `carta.sello`

Variante del retrato: foto a la izquierda, rótulo en caja, sello, título grande al centro-derecha, fechas, regla y subtítulo grueso debajo (panel 'PHOTOGRAPHY 1945-1948 HISTORICAL').

Etiquetas: foto, persona, documento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `stamp` | string | `""` | Sello circular 'ARRIBA|CENTRO|ABAJO' (vacío = sin sello). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `sub` | string | `""` | Subtítulo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.sello", "params": {"src": "assets/media/mauerbau.jpg", "label": "LA NOTA", "stamp": "ARCHIVO|1989|BERLÍN", "title": "INMEDIATO", "years": "9 - 11 - 1989", "sub": "SIN DEMORA"}}
```

### `carta.postal`

Postal de un lugar: rótulo y fechas arriba a la izquierda, caja de texto tipeado con doble borde, foto ancha a la derecha, título gigante abajo con segundo renglón corrido y regla (panel 'VENEZIA / ITALY').

Etiquetas: foto, lugar, ciudad, contexto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.postal", "params": {"src": "assets/media/mauerbau.jpg", "label": "AGOSTO DE 1961", "years": "1961 - 1989", "body": "De un día para otro el gobierno del Este levantó un muro de hormigón y alambre en medio de la ciudad.", "title": "BERLÍN", "sub": "ALEMANIA"}}
```

### `carta.familia`

Foto de grupo abajo a la izquierda; arriba rótulo, firma manuscrita y caja de texto; a la derecha fechas y título de dos renglones alineado a la derecha (panel 'MY FAMILY / LOVELY').

Etiquetas: foto, personas, grupo, familia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `sign` | string | `""` | Firma manuscrita. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.familia", "params": {"src": "assets/media/mauerbau.jpg", "label": "FAMILIAS SEPARADAS", "sign": "Elsa", "body": "Una calle bastaba para no volver a verse.", "years": "1961 - 1989", "title": "VECINOS", "sub": "SEPARADOS"}}
```

### `carta.memoria`

Foto a la izquierda; rótulo en caja crema a la derecha, fechas, título grande que pisa la foto y subtítulo corto con firma (panel 'OUR HISTORY / DO NOT FORGET / ABOUT IT').

Etiquetas: foto, personas, recuerdo, memoria · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `sign` | string | `""` | Firma manuscrita. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.memoria", "params": {"src": "assets/media/mauerbau.jpg", "label": "AL MENOS 140", "years": "1961 - 1989", "title": "NO OLVIDAR", "sub": "A LOS QUE CAYERON", "sign": "Berlín"}}
```

### `carta.recuerdo`

Dos rótulos grandes apilados a la izquierda entre reglas, fechas, foto a la derecha y título grueso abajo a la derecha (panel 'OUR HISTORY / FAST RENDERING / ABOUT IT').

Etiquetas: foto, personas, época · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `label2` | string | `""` | Segundo rótulo. |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.recuerdo", "params": {"src": "assets/media/mauerbau.jpg", "label": "OTOÑO", "label2": "DE 1989", "years": "1989", "title": "ALGO SE ROMPE"}}
```

### `carta.album`

Foto grande a la izquierda; arriba a la derecha fechas, caja de texto tipeado y título de dos tamaños abajo a la derecha (panel '1950-1968 / MY LIFE / MY FAMILY').

Etiquetas: foto, personas, grupo, multitud · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.album", "params": {"src": "assets/media/mauerbau.jpg", "years": "1989", "body": "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", "title": "LEIPZIG", "sub": "LOS LUNES"}}
```

### `carta.nota`

Rótulo en caja arriba a la izquierda, caja de texto debajo, título grande con regla, fechas y foto vertical a la derecha (panel 'EASY TO EDIT / HISTORICAL / 1945-1948').

Etiquetas: foto, documento, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `label` | string | `""` | Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS'). |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.nota", "params": {"src": "assets/media/mauerbau.jpg", "label": "NUEVA REGLA", "body": "Los ciudadanos podrían pedir permiso para viajar al Oeste.", "title": "PERMISO", "years": "10 - 11 - 1989"}}
```

### `carta.ficha`

Ficha de persona: retrato a la izquierda; a la derecha título, subtítulo y fechas apilados a la derecha, caja de texto y regla (panel 'HISTORICAL / MAYR KETMAN / 1945-1948').

Etiquetas: foto, persona, ficha, biografía · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.ficha", "params": {"src": "assets/media/mauerbau.jpg", "title": "HARALD JÄGER", "sub": "OFICIAL DE FRONTERA", "years": "9 - 11 - 1989", "body": "Tenía una multitud frente a él y ninguna orden."}}
```

### `carta.ciudad`

Título enorme con regla, subtítulo y fechas a la izquierda; paisaje ancho a la derecha revelado con salpicaduras de tinta alrededor (panel 'OUR CITY / HAPPY DAYS').

Etiquetas: foto, lugar, paisaje, ciudad · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.ciudad", "params": {"src": "assets/media/mauerbau.jpg", "title": "BERLÍN", "sub": "UNA CIUDAD PARTIDA", "years": "1961 - 1989"}}
```

### `carta.proyecto`

Foto vertical a la izquierda; título enorme arriba, subtítulo, caja de texto tipeado y fechas abajo (panel 'CS 5 PROJECT / HAPPY DAYS').

Etiquetas: foto, persona, dato, texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.proyecto", "params": {"src": "assets/media/mauerbau.jpg", "title": "LA PREGUNTA", "sub": "¿CUÁNDO ENTRA EN VIGOR?", "body": "Schabowski revolvió sus papeles. Buscó la respuesta. No la encontró.", "years": "18:53"}}
```

### `carta.dato`

Dato: título con regla, cifra destacada, texto tipeado suelto, fechas entre reglas y foto a la derecha (panel 'HIGH RESOLUTION / 1920X1080').

Etiquetas: foto, dato, número, cifra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `figure` | string | `""` | Cifra destacada (p. ej. '28 AÑOS'). |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.dato", "params": {"src": "assets/media/mauerbau.jpg", "title": "DURANTE", "figure": "28 AÑOS", "body": "Berlín estuvo partida en dos.", "years": "1961 - 1989"}}
```

### `carta.perfil`

Perfil: retrato a la izquierda, nombre, ciudad y fechas escalonados, texto tipeado suelto y un segundo título abajo con regla (panel 'JESICA VRUBLER / PARIS / BIG FAMILY').

Etiquetas: foto, persona, biografía · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `title2` | string | `""` | Segundo título, abajo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.perfil", "params": {"src": "assets/media/mauerbau.jpg", "title": "GÜNTER SCHABOWSKI", "sub": "BERLÍN ESTE", "years": "1989", "body": "El encargado de contarlo a la prensa.", "title2": "EL VOCERO"}}
```

### `carta.frente`

Título con regla arriba a la izquierda, subtítulo, fechas tenues, caja de texto, segundo título abajo y foto ancha a la derecha (panel 'EASY TO EDIT / GERMANY / WORLD WAR').

Etiquetas: foto, lugar, frontera, conflicto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (se vira a sepia y se revela con tinta). |
| `title` | string | `""` | Título grande (máquina de escribir gruesa). |
| `sub` | string | `""` | Subtítulo. |
| `years` | string | `""` | Fechas finas, p. ej. '1961 - 1989'. |
| `body` | string | `""` | Párrafo tipeado (6–9 renglones de ~29 caracteres). |
| `title2` | string | `""` | Segundo título, abajo. |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"left"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.frente", "params": {"src": "assets/media/mauerbau.jpg", "title": "LA FRONTERA", "sub": "BORNHOLMER", "years": "23:30", "body": "Abrió la barrera. Y la gente cruzó.", "title2": "LA DECISIÓN"}}
```

### `carta.title`

Portada: título de máquina de escribir enorme + subtítulo alineado a su derecha dentro de una caja crema, bajada pequeña, y letras fantasma gigantes al fondo. Por defecto entra volando desde el lente (apertura y cierre de la referencia).

Etiquetas: apertura, título, cierre · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Palabra/frase grande (corta: 1–2 palabras). |
| `sub` | string | `""` | Segundo renglón, más chico, alineado a la derecha del título. |
| `kicker` | string | `""` | Bajada pequeña bajo la caja. |
| `ghost` | string | `""` | Letras fantasma gigantes del fondo (vacío = 3 primeras letras del título). |
| `enter` | enum (left / right / up / down / upleft / upright / downleft / downright / fly / ink) | `"fly"` | Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta. |
| `mirror` | bool | `false` | Espeja el diagramado (foto del otro lado). |
| `focus` | array | `[0.5, 0.42]` | Punto [x,y] (0..1) de la foto que queda en el centro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte de la foto. |

```json
{"use": "carta.title", "params": {"title": "EL MURO", "sub": "LA NOCHE QUE CAYÓ", "kicker": "BERLÍN · 9 NOV 1989"}}
```

### `carta.introv1`

GANCHO de apertura (lo primero que se ve). La cámara vuela desde el lente hasta la gran hoja de papel viejo (bg: hoja | sobre | bokeh | image con src | component con use/useParams). Por defecto 'hoja': la cámara viaja por la hoja, dos fotos sepia se revelan con borde de pincel quemado, una carta se escribe sola, estampilla con matasellos y firma. El titular GIGANTE de máquina de escribir llega palabra por palabra desde delante del lente (escala, desenfoque y sacudida); '^palabra^' va en un rótulo crema de doble borde con subrayado de pluma. Momento de impacto: un MATASELLOS golpea encima (sealAt) con salpicadura de tinta. Sale volando hacia el lente.

Etiquetas: intro, gancho, apertura, título, carta, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra destacada (rótulo crema + subrayado de pluma). |
| `kicker` | string | `""` | Rótulo chico arriba, tipeado (lugar · fecha). |
| `sub` | string | `""` | Línea manuscrita debajo del titular (se escribe con pluma). |
| `seal` | string | `"CORREO|★|ARCHIVO"` | Matasellos 'ARRIBA|CENTRO|ABAJO' que golpea (vacío = sin matasellos). |
| `sealAt` | number | `2.3` | Segundo en que golpea el matasellos (-1 = no golpea; acepta '@palabra'). |
| `wordAt` | number | `0.5` | Segundo en que llega la primera palabra. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabra y palabra. |
| `bg` | enum (auto / hoja / sobre / bokeh / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: hoja, sobre, bokeh; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.35` | Lavado de papel sobre el fondo foto/componente (0 = nada). |

```json
{"use": "carta.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 de noviembre de 1989", "sub": "la historia que nadie esperaba", "seal": "BERLÍN|1989|ARCHIVO", "sealAt": 2.3}}
```

### `carta.introv2`

GANCHO pregunta + revelación. Una hoja de carta entra a la máquina y la pregunta se TIPEA tecla a tecla (cada golpe sacude la hoja, cursor de tipos); después un SELLO de goma entintado golpea encima con la respuesta, con salpicadura y sacudida. Fondo adaptable (bg: sobre | hoja | bokeh | image con src | component con use/useParams); por defecto un sobre lacrado que se abre y deja salir la carta escrita.

Etiquetas: intro, gancho, apertura, pregunta, sello, máquina de escribir · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba de la hoja. |
| `stamp` | string | `""` | Respuesta del sello de goma que golpea (vacío = sin sello). |
| `stampAt` | number | `2.6` | Segundo del sello (acepta '@palabra'). |
| `typeAt` | number | `0.45` | Segundo en que empieza a tipearse la pregunta. |
| `cps` | number [4–None] | `16` | Letras por segundo del tipeo. |
| `bg` | enum (auto / hoja / sobre / bokeh / image / component / none) | `"sobre"` | Fondo: auto = el del diseño; presets: hoja, sobre, bokeh; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.35` | Lavado de papel sobre el fondo foto/componente (0 = nada). |

```json
{"use": "carta.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 9 de noviembre de 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}
```

### `carta.outro`

Cierre del canal SIN recuadro sobre la gran hoja de papel viejo (bg: hoja | sobre | image con src | component con use/useParams). 'gracias por ver' manuscrito con pluma → nombre del canal que llega volando desde el lente entre dos reglas y con rúbrica → estampilla LIKE que recibe un matasellos (queda marcada y el pulgar se entinta) → flecha a pluma → sello de goma SUSCRÍBETE + campana de tinta que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, carta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"gracias por ver"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte esta historia."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / hoja / sobre / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: hoja, sobre; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Lavado de papel sobre el fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "carta.outro", "params": {"thanks": "gracias por ver", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más historias.", "handle": "youtube.com/@nodetech"}}
```

## collage · HEMEROTECA

### `collage.intro`

Apertura de HEMEROTECA: masthead NODETECH, fecha de archivo, año grande y titular sobre papel claro con reglas bordó.

Etiquetas: apertura, archivo, título · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `number` | string | `"1989"` | Año o cifra principal. |
| `before` | string | `""` | Fecha o contexto breve. |
| `after` | string | `""` | Lugar o segundo dato. |
| `line` | string | `""` | Titular de apertura. |

```json
{"use": "collage.intro", "params": {"number": "1989", "before": "9 nov", "after": "Berlín", "line": "LA NOCHE QUE CAYÓ EL MURO"}}
```

### `collage.title`

Alias compatible de collage.intro; usa la nueva apertura de archivo.

Etiquetas: apertura, archivo, título · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `number` | string | `"1989"` | Año o cifra principal. |
| `before` | string | `""` | Fecha o contexto breve. |
| `after` | string | `""` | Lugar o segundo dato. |
| `line` | string | `""` | Titular de apertura. |

```json
{"use": "collage.title", "params": {"number": "1989", "before": "9 nov", "after": "Berlín", "line": "LA NOCHE QUE CAYÓ EL MURO"}}
```

### `collage.board`

El plano tipo: mesa de papel de diario con fotos de borde blanco viradas (B/N, verde azulado, rosa, sepia), recortes, sellos y moneda; año en serif bordó con fecha chica; recorte con titular opcional. La cámara se desliza (move) con paralaje y las fotos secundarias entran escalonadas.

Etiquetas: foto, collage, archivo, año · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `photo` | image · obligatorio | `""` | Foto principal. |
| `photo2` | image | `""` | Foto 2 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo3` | image | `""` | Foto 3 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo4` | image | `""` | Foto 4 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo5` | image | `""` | Foto 5 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `layout` | enum (hero / duo / trio / quad / scatter / strip) | `"trio"` | Disposición: hero (una foto grande + 2 chicas), duo, trio (foto de fondo + 2 retratos a los lados), quad, scatter (5 fotos), strip (3 en fila). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `year` | string | `""` | Año en serif bordó (p. ej. '1961'). |
| `yearSmall` | string | `""` | Fecha chica sobre el año ('13.08'). |
| `yearFrom` | number | `null` | Si se da, el año cuenta desde este valor hasta `year`. |
| `headline` | string | `""` | Titular de un recorte de periódico (texto propio). |
| `swap` | bool | `false` | La foto principal va cambiando entre las fotos del plano (fundido). |
| `swapEvery` | number | `1.6` | Segundos entre cambios de foto. |
| `appear` | enum (slide / drop / fade / pop) | `"slide"` | Entrada de las fotos secundarias. |
| `stagger` | number | `0.5` | Segundos entre entradas de fotos. |
| `density` | number [0–40] | `14` | Recortes de relleno alrededor. |
| `coins` | bool | `true` | Moneda dorada que cae sobre la mesa. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"left"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.05` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.board", "params": {"photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/leipzig.jpg", "layout": "trio", "year": "1961", "yearSmall": "13.08", "headline": "SE LEVANTA EL MURO"}}
```

### `collage.date`

Fecha/cifra protagonista: número grande en serif bordó (cuenta desde `from` si se da) con fecha chica arriba y una línea en versalitas debajo, sobre el collage con 2 fotos que entran por el costado.

Etiquetas: fecha, año, cifra, contador · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Cifra/fecha grande ('1989', '23:30', '10 NOV'). |
| `from` | number | `null` | Si `text` es un número: cuenta desde este valor. |
| `count` | number | `1.8` | Segundos que dura la cuenta. |
| `small` | string | `""` | Fecha/etiqueta chica arriba. |
| `kicker` | string | `""` | Línea en versalitas debajo. |
| `photo` | image · obligatorio | `""` | Foto principal. |
| `photo2` | image | `""` | Foto 2 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo3` | image | `""` | Foto 3 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `density` | number [0–40] | `14` | Recortes de relleno alrededor. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"left"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.05` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.date", "params": {"text": "1989", "from": 1961, "small": "28 AÑOS", "kicker": "UNA CIUDAD PARTIDA EN DOS", "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/muro-gente.jpg"}}
```

### `collage.banner`

Banda oscura translúcida que cruza el collage con un titular en serif romana mayúscula (como 'GLUBB PASHA FLIES HOME'), retrato pequeño al final de la banda y fotos debajo; cámara en diagonal.

Etiquetas: titular, banda, cita, frase · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular (mayúsculas; '\n' parte en 9:16). |
| `year` | string | `""` | Año bordó junto a la foto inferior. |
| `photo` | image · obligatorio | `""` | Foto principal. |
| `photo2` | image | `""` | Foto 2 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo3` | image | `""` | Foto 3 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `density` | number [0–40] | `14` | Recortes de relleno alrededor. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"diag"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.05` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.banner", "params": {"text": "HORMIGÓN Y ALAMBRE", "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/bornholmer.jpg", "photo3": "assets/media/muro-gente.jpg"}}
```

### `collage.headline`

Página de diario en primer plano: foto grande con filete, bajada en itálica, regla y titular grande en serif negra bordó; foto rosada desenfocada al costado. Pensado para salir con el plano siguiente en tin:'dive' (la cámara se zambulle en el titular).

Etiquetas: titular, periódico, frase, énfasis · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular ('\n' para partir). |
| `kicker` | string | `""` | Bajada en itálica sobre el titular. |
| `photo` | image · obligatorio | `""` | Foto principal. |
| `photo2` | image | `""` | Foto 2 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"in"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.03` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.headline", "params": {"photo": "assets/media/schabowski.jpg", "kicker": "AL FINAL DE LA CONFERENCIA", "text": "LO LEYÓ TAL CUAL"}}
```

### `collage.map`

Mapa antiguo (costas, retícula, ríos, fronteras punteadas) con lugares rotulados y rutas rojas que se trazan solas; foto recortada de bordes suaves encima (paralaje) y una lupa de bronce que recorre el mapa.

Etiquetas: mapa, lugar, ruta, geografía · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `places` | array | `["Berlín", "Praga", "Viena"]` | Nombres de lugares (2–6), de izquierda a derecha. |
| `routes` | array | `[]` | Rutas [[desde,hasta],…] por índice (vacío = encadenar en orden). |
| `title` | string | `""` | Nombre de región grande y espaciado. |
| `lens` | bool | `true` | Lupa que recorre el mapa. |
| `year` | string | `""` | Año bordó. |
| `photo` | image | `""` | Foto recortada sobre el mapa (opcional). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"drift"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.05` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.map", "params": {"places": ["Leipzig", "Praga", "Budapest", "Viena"], "title": "EUROPA CENTRAL", "photo": "assets/media/leipzig.jpg"}}
```

### `collage.panels`

Paneles de color apagado (violeta, verde azulado, mostaza, oliva) con titular, bajada y foto, que caen sobre un mapa desde cerca de cámara de a uno (entrada escalonada). Para listas, comparaciones (2) o hitos (3–4).

Etiquetas: lista, comparación, paneles, datos · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | 2–4 paneles {title, text}. |
| `photo` | image · obligatorio | `""` | Foto principal. |
| `photo2` | image | `""` | Foto 2 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo3` | image | `""` | Foto 3 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `photo4` | image | `""` | Foto 4 (opcional; si falta se repiten las anteriores con otro encuadre). |
| `tones` | array | `[]` | Virado por foto: bw, teal, rose, sepia, color, red (vacío = el del layout). |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"in"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.03` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.panels", "params": {"items": [{"title": "ESTE", "text": "una ciudad cerrada"}, {"title": "OESTE", "text": "al otro lado de la calle"}], "photo": "assets/media/mauerbau.jpg", "photo2": "assets/media/leipzig.jpg"}}
```

### `collage.ribbon`

Columna central: foto arriba, cinta bordó con volutas ornamentales y texto crema, foto abajo; a los costados fotos grandes desenfocadas y estelas de fuegos artificiales/destellos. Para celebraciones y momentos solemnes.

Etiquetas: celebración, título, cinta, momento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto de la cinta ('\n' = 2 renglones). |
| `photo` | image · obligatorio | `""` | Foto superior. |
| `photo2` | image | `""` | Foto inferior. |
| `photo3` | image | `""` | Fotos laterales desenfocadas. |
| `photo4` | image | `""` | Otra foto lateral. |
| `sparks` | bool | `true` | Estelas de fuegos artificiales. |
| `tones` | array | `[]` | Virados. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"in"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.03` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.ribbon", "params": {"text": "LA NOCHE EN QUE\nCAYÓ EL MURO", "photo": "assets/media/muro-gente.jpg", "photo2": "assets/media/mauerspecht.jpg", "photo3": "assets/media/bornholmer.jpg"}}
```

### `collage.tribute`

Homenaje sobrio: foto en óvalo que se funde con el papel, fecha chica y titular bordó sobre una regla, bruma rosada y pétalos rojos que caen (algunos grandes y desenfocados, cerca de cámara).

Etiquetas: homenaje, víctimas, memoria, duelo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `photo` | image · obligatorio | `""` | Foto del homenaje. |
| `date` | string | `""` | Fecha chica. |
| `text` | string | `""` | Titular ('\n' parte). |
| `petals` | number [0–40] | `16` | Cantidad de pétalos. |
| `tone` | enum (bw / teal / rose / sepia / color / red) | `"rose"` | Virado de la foto. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"in"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.025` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.tribute", "params": {"photo": "assets/media/muro-gente.jpg", "date": "1961 · 1989", "text": "AL MENOS 140 PERSONAS MURIERON EN EL MURO"}}
```

### `collage.portraits`

Página de libro con un gran medallón: 2–4 retratos en óvalos viñeteados (virados verde azulado/sepia), adornos rojos y un título en versalitas; la cámara se aleja y gira como al levantar el libro.

Etiquetas: personas, protagonistas, retratos, líderes · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `photo` | image · obligatorio | `""` | Retrato 1. |
| `photo2` | image | `""` | Retrato 2. |
| `photo3` | image | `""` | Retrato 3. |
| `photo4` | image | `""` | Retrato superior (opcional). |
| `title` | string | `""` | Título en versalitas. |
| `tones` | array | `[]` | Virados. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |
| `move` | enum (left / right / up / down / in / out / diag / drift / none) | `"out"` | Movimiento de cámara sobre el collage (en 9:16 se gira 90°). |
| `speed` | number [0–0.3] | `0.04` | Velocidad de cámara (alto de cuadro por segundo). |
| `tilt` | number | `0` | Rotación de la mesa en grados (0 = automática ±2°). |

```json
{"use": "collage.portraits", "params": {"photo": "assets/media/schabowski.jpg", "photo2": "assets/media/mauerspecht.jpg", "photo3": "assets/media/muro-gente.jpg", "title": "GRANDES BATALLAS, GRANDES LÍDERES"}}
```

### `collage.emblem`

Emblema conmemorativo: sobre cielo desenfocado, un número/año dorado en 3D entra girando letra por letra, cinta bordó en arco con el título, libro abierto de línea y bajada; el fondo se aclara a blanco.

Etiquetas: cierre, emblema, aniversario, cifra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `number` | string · obligatorio | `null` | Número/año/palabra corta en 3D. |
| `title` | string | `""` | Texto de la cinta en arco. |
| `sub` | string | `""` | Bajada ('\n' = segundo renglón). |
| `white` | bool | `true` | El fondo se aclara a blanco. |
| `tin` | enum (cut / flip / burst / whip / leak / dive / smoke / flare) | `"flip"` | Transición de ENTRADA: flip (pasan hojas de libro), burst (ráfaga de luz hacia adelante), whip (barrido lateral con desenfoque), leak (cortina de luz rosa), dive (sale zambulléndose en el titular del plano anterior; usar después de collage.headline), smoke (disolución de humo), flare (mancha roja que cruza), cut. |

```json
{"use": "collage.emblem", "params": {"number": "1989", "title": "DE INMEDIATO", "sub": "SIN DEMORA\nBerlín · 9 de noviembre"}}
```

### `collage.leak`

Cortina de luz cálida (fuga de película) que barre el cuadro para marcar un golpe o una frase clave. Se suma a la lente global (modo pantalla).

Etiquetas: transición, golpe, luz, énfasis · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `color` | enum (warm / pink / red / white) | `"warm"` | Color de la luz. |
| `strength` | number [0–1] | `0.85` | Intensidad. |

```json
{"use": "collage.leak", "params": {"color": "warm", "strength": 0.9}}
```

### `collage.introv1`

GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: table | sky | map | press | image con src | component con use/useParams); por defecto la mesa de archivo en plano secuencia con paralaje, recortes y fotos que caen y se apilan, bokeh y fugas de luz. Una banda oscura se desliza y el titular GIGANTE en romana cae palabra por palabra como un recorte (escala + desenfoque + sacudida + chispas); '^palabra^' va en dorado 3D. En flashAt, ráfaga de luz cálida: la cámara se adelanta y el dorado destella.

Etiquetas: intro, gancho, apertura, título, archivo, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en dorado 3D. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha), en versalitas doradas. |
| `sub` | string | `""` | Línea chica debajo del titular (itálica). |
| `wordAt` | number | `0.45` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabra y palabra. |
| `flashAt` | number | `2.3` | Segundo de la ráfaga de luz cálida (cámara adelante + destello del dorado). -1 = sin ráfaga. |
| `photoTone` | enum (bw / teal / rose / sepia / color / red) | `"teal"` | Virado de la foto de fondo (bg=image): bw, teal, rose, sepia, color, red. |
| `bg` | enum (auto / table / sky / map / press / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: table, sky, map, press; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "collage.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "flashAt": 2.3}}
```

### `collage.introv2`

GANCHO 'primera plana'. Fondo adaptable al tema (bg: map | table | sky | press | image con src | component con use/useParams); por defecto un mapa antiguo con rutas rojas que se trazan y una lupa de bronce. Una hoja de diario cae sobre la mesa, la pregunta se IMPRIME letra a letra en titular negro con cursor, las columnas aparecen, y la respuesta llega en una CINTA bordó con volutas que golpea encima con destello y chispas doradas.

Etiquetas: intro, gancho, apertura, pregunta, diario, cinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Bajada en itálica sobre el titular (fecha, lugar). |
| `masthead` | string | `"EDICIÓN ESPECIAL"` | Cabecera de la hoja de diario. |
| `stamp` | string | `""` | Respuesta en la cinta bordó que golpea (vacío = sin cinta; '\n' = 2 renglones). |
| `stampAt` | number | `2.4` | Segundo de la cinta (acepta '@palabra'). |
| `typeAt` | number | `0.5` | Segundo en que empieza a imprimirse la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo. |
| `photoTone` | enum (bw / teal / rose / sepia / color / red) | `"sepia"` | Virado de la foto de fondo (bg=image): bw, teal, rose, sepia, color, red. |
| `bg` | enum (auto / map / table / sky / press / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: map, table, sky, press; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "collage.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 9 de noviembre de 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}
```

### `collage.outro`

Cierre del canal SIN recuadro (bg: table | sky | map | press | image con src | component con use/useParams): por defecto la mesa de archivo en plano secuencia, oscurecida. GRACIAS POR VER en versalitas doradas → nombre del canal en DORADO 3D que entra girando letra por letra y destella → recorte LIKE que se presiona y queda marcado con un círculo de tinta roja → ruta punteada roja → cinta bordó SUSCRÍBETE que cae + campana dorada que suena → apoyo en itálica palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada.

Etiquetas: cierre, canal, like, suscribirse, archivo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Tu apoyo permite seguir contando historias de archivo."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / table / sky / map / press / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: table, sky, map, press; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |
| `photoTone` | enum (bw / teal / rose / sepia / color / red) | `"bw"` | Virado de la foto de fondo (bg=image): bw, teal, rose, sepia, color, red. |

```json
{"use": "collage.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "HEMEROTECA", "cta": "SUSCRÍBETE", "support": "Tu apoyo permite seguir contando historias de archivo.", "handle": "youtube.com/@hemeroteca"}}
```

## cronica · CRÓNICA

### `cronica.slide`

Diapositiva de archivo en 3D (la escena principal de la referencia): foto B/N con borde de pincel rasgado que se pinta a trazos, año o dato corto en un rótulo gris pincelado y párrafo serif blanco, rodeados de capas tenues (fotos fantasma, letra gigante, bloquecitos con barra, líneas con nodos). La cámara la mira en perspectiva oblicua con profundidad de campo; si el beat es largo, CORTA a un ángulo cercano a mitad (rack focus).

Etiquetas: foto, fecha, año, dato, historia, lugar, persona · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (jpg/png local). Se muestra B/N contrastada. Se puede repetir en varios beats cambiando focus/zoom/layout. |
| `year` | string | `""` | Año, fecha o dato corto del rótulo gris ('1961', '9 NOV', '28 AÑOS'). Vacío = sin rótulo. |
| `text` | string | `""` | Párrafo serif (1-4 renglones; ~10-30 palabras). |
| `layout` | enum (right / left / top / center / split) | `"right"` | right = foto izq/texto der · left = texto izq/foto der · top = foto arriba/texto abajo · center = foto al centro con texto abajo a la izquierda encima · split = foto grande tapada a la derecha por un panel oscuro con el texto. En 9:16 siempre apila (foto arriba). |
| `italic` | bool | `false` | Año y párrafo en itálica. |
| `align` | enum (left / justify) | `"left"` | Alineación del párrafo. |
| `focus` | array | `[0.5, 0.45]` | Punto [x,y] 0..1 de la foto que queda dentro del recorte. |
| `zoom` | number [1–3] | `1` | Zoom del recorte (para reutilizar una foto con otro encuadre). |
| `mirror` | bool | `false` | Espeja los ángulos de cámara (variedad entre beats seguidos). |
| `reframe` | number | `0` | Segundo del corte a plano cercano (0 = automático si el beat dura ≥ cronica.autoReframe; -1 = nunca; '@palabra' = cuando la voz la dice). |
| `letter` | string | `""` | Letra gigante tenue del fondo (vacío = una al azar). |

```json
{"use": "cronica.slide", "params": {"src": "assets/media/leipzig.jpg", "year": "1989", "text": "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", "layout": "right"}}
```

### `cronica.quote`

Cita en itálica (la escena '1942' de la referencia): año en itálica en su rótulo, párrafo itálico justificado al centro, un retrato grande y tenue a la izquierda (más cerca de cámara, desenfocado) y otra foto rasgada a la derecha. Cámara oblicua con corte a plano cercano si es largo.

Etiquetas: cita, frase, persona, testimonio, fecha · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de la derecha (rasgada). |
| `side` | image | `""` | Retrato grande y tenue de la izquierda (vacío = la misma foto con otro encuadre). |
| `year` | string | `""` | Año / dato del rótulo (en itálica). |
| `text` | string · obligatorio | `null` | La cita (10-35 palabras). |
| `focus` | array | `[0.5, 0.45]` | Encuadre de la foto derecha. |
| `sideFocus` | array | `[0.35, 0.3]` | Encuadre del retrato izquierdo. |
| `mirror` | bool | `false` | Espeja los ángulos de cámara. |
| `reframe` | number | `0` | Segundo del corte a plano cercano (0 = auto, -1 = nunca). |

```json
{"use": "cronica.quote", "params": {"side": "assets/media/schabowski.jpg", "src": "assets/media/bornholmer.jpg", "year": "1989", "text": "Nadie le advirtió que debía esperar hasta la mañana."}}
```

### `cronica.verse`

Frase narrada en grande con la tipografía de los párrafos de la referencia: cada palabra se enfoca (desenfoque → nítido) en el instante en que la voz la dice, sobre el decorado en capas (fotos fantasma, letra gigante, líneas). Rótulo gris opcional arriba. Cámara oblicua con rack focus.

Etiquetas: frase, impacto, letra, clímax, narración · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `kicker` | string | `""` | Texto corto del rótulo gris de arriba (vacío = sin rótulo). |
| `accent` | array | `[]` | Palabras que van en itálica (énfasis). |
| `src` | image | `""` | Foto de fondo tenue opcional (si no, usa fotos del video). |
| `size` | number [0.6–1.5] | `1` | Escala del texto. |
| `mirror` | bool | `false` | Espeja los ángulos de cámara. |

```json
{"use": "cronica.verse", "params": {"kicker": "LA PREGUNTA", "accent": ["vigor"]}}
```

### `cronica.title`

Tarjeta de título (como 'ENVATO PRESENTS' de la referencia): mayúsculas serif espaciadas al centro, que aparecen letra a letra desde el desenfoque mientras la cámara hace rack focus; detrás, dos fotos tenues rasgadas a distinta profundidad, líneas finas con nodos y bloquecitos de texto. También sirve como portada de capítulo.

Etiquetas: apertura, título, portada, capítulo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título (se muestra en MAYÚSCULAS espaciadas). |
| `kicker` | string | `""` | Línea chica en itálica debajo (lugar · fecha). |
| `src` | image | `""` | Foto tenue de la izquierda (vacío = una del video). |
| `src2` | image | `""` | Foto rasgada de la derecha (vacío = otra del video). |
| `hideCaptions` | bool | `false` | Ocultar subtítulos mientras está en pantalla. |

```json
{"use": "cronica.title", "params": {"text": "La noche que cayó el muro", "kicker": "Berlín · 9 de noviembre de 1989"}}
```

### `cronica.introv1`

GANCHO de apertura en el espacio 3D de la crónica. Fondo adaptable (bg: archivo | linea | letras | proyector | image con src | component con use/useParams | none); por defecto papeles rasgados, fotos fantasma, bloquecitos y red de líneas flotando con profundidad de campo. Titular GIGANTE en serif: cada palabra cae desde muy cerca de la cámara (enorme y desenfocada) y entra en foco con una sacudida seca; '^palabra^' va en itálica sobre el rótulo gris pincelado. En cutAt: CORTE SECO a otro ángulo con rack focus, las letras gigantes del fondo se alinean y se barre una pincelada gris bajo el titular.

Etiquetas: intro, gancho, apertura, título, impacto, 3d · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en itálica sobre el rótulo gris. Un signo pegado (^MURO^?) no se separa. |
| `kicker` | string | `""` | Rótulo gris pincelado chico arriba (lugar · fecha). |
| `sub` | string | `""` | Línea en itálica debajo del titular. |
| `wordAt` | number | `0.35` | Segundo en que cae la primera palabra. |
| `stagger` | number [0.08–None] | `0.28` | Segundos entre palabra y palabra. |
| `cutAt` | number | `2.3` | Momento de impacto: corte seco a otro ángulo + rack focus + letras gigantes que se alinean (-1 = sin corte; acepta '@palabra'). |
| `letters` | string | `""` | Letras gigantes del fondo que se alinean en el corte (vacío = la palabra destacada o la más larga). |
| `era` | array | `[1900, 2020, 10]` | Años del fondo 'linea' [desde, hasta, paso]. |
| `bg` | enum (auto / archivo / linea / letras / proyector / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: archivo, linea, letras, proyector; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "cronica.introv1", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 de noviembre de 1989", "sub": "y nadie dio la orden", "cutAt": 2.3}}
```

### `cronica.introv2`

GANCHO pregunta + revelación. Fondo adaptable (bg: linea | archivo | letras | proyector | image con src | component con use/useParams | none); por defecto una línea de tiempo con rótulos de años que se pierde en profundidad. La pregunta (mayúsculas serif espaciadas) se revela letra a letra desde el desenfoque con una rayita '_' que avanza; en stampAt CORTE SECO a otro ángulo y la respuesta llega en un gran rótulo gris pincelado que se barre, más cerca de cámara: el foco salta de la pregunta a la respuesta (rack focus).

Etiquetas: intro, gancho, apertura, pregunta, revelación, 3d · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Bloquecito con barra arriba (lugar · fecha). |
| `stamp` | string | `""` | Respuesta que llega en el rótulo pincelado (vacío = sin respuesta). |
| `stampAt` | number | `2.6` | Segundo de la respuesta y del corte seco (acepta '@palabra'). |
| `typeAt` | number | `0.35` | Segundo en que empieza a revelarse la pregunta. |
| `cps` | number [4–None] | `16` | Letras por segundo del revelado. |
| `era` | array | `[1900, 2020, 10]` | Años del fondo 'linea' [desde, hasta, paso]. |
| `bg` | enum (auto / archivo / linea / letras / proyector / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: archivo, linea, letras, proyector; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "cronica.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}
```

### `cronica.outro`

Cierre del canal SIN recuadro en el espacio 3D de la crónica (bg: proyector | archivo | letras | linea | image con src | component con use/useParams | none). GRACIAS POR VER desde el desenfoque → nombre del canal grande cuyas letras llegan dispersas desde la profundidad y se alinean con rack focus, con el rótulo gris barriéndose debajo → rótulo LIKE que se presiona (gris → blanco) → línea fina con nodos a modo de flecha → placa SUSCRÍBETE de papel rasgado + campana que suena → apoyo en itálica → youtube.com/@canal. Tiempos sincronizables con la despedida narrada.

Etiquetas: cierre, canal, like, suscribirse, 3d · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / proyector / archivo / letras / linea / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: proyector, archivo, letras, linea; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |
| `era` | array | `[1900, 2020, 10]` | Años del fondo 'linea' [desde, hasta, paso]. |

```json
{"use": "cronica.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "CRÓNICA", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir contando historias.", "handle": "youtube.com/@cronica"}}
```

## enmienda · EXPEDIENTE

### `enmienda.word`

Golpe de texto del documental: palabra/frase en condensada MUY gruesa con textura de tipo móvil gastado sobre negro. Entradas: erosión (polvo por vetas), desenfoque, barrido, volteo con destello, golpe seco. Salidas: erosión, desenfoque, 'palomas' (se rompe en recortes que vuelan) o corte. Marcas a pincel (cruz, círculo, garabato, subrayado) o mira telescópica.

Etiquetas: título, golpe, texto, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto ('\n' parte renglones). Mayúsculas recomendadas. |
| `font` | enum (grot / heavy / stencil / serif / wide) | `"grot"` | grot = condensada gruesa (Oswald), heavy = Anton, stencil = esténcil con serifa, serif = titular victoriano condensado, wide = extendida (Archivo). |
| `size` | number [0.15–0.98] | `0.6` | Fracción del ancho que ocupa el renglón más largo (en 9:16 se agranda solo). |
| `in` | enum (erode / blur / swipe / tumble / slam / cut) | `"erode"` | Entrada. |
| `out` | enum (erode / blur / birds / cut) | `"erode"` | Salida (durante el solape con el beat siguiente). |
| `mark` | enum (none / x / circle / scribble / underline / crosshair) | `"none"` | Marca a pincel o mira sobre el texto. |
| `markAt` | number | `0.7` | Segundos desde el inicio del beat en que se dibuja la marca (acepta '@palabra'). |
| `ghost` | string | `""` | Texto tenue de documentos detrás ('|' separa piezas). Vacío = nada. |
| `y` | number | `0.47` | Centro vertical (fracción del alto). |
| `tilt` | number | `0` | Inclinación final en grados. |
| `captions` | bool | `true` | false = oculta los subtítulos mientras está en pantalla. |

```json
{"use": "enmienda.word", "params": {"text": "ALGO SE\nROMPE", "font": "grot", "in": "erode", "mark": "x", "markAt": 0.7}}
```

### `enmienda.slats`

Numeral gigante (romano o cifra) armado con listones de papel que entran deslizándose en vertical sobre un documento manuscrito tenue con marcas de conteo (||||/); al final la cámara gira y se zambulle en los listones (empalma con enmienda.plaque in:'dive').

Etiquetas: numeral, título, fecha, apertura · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `"XXVIII"` | Numeral o palabra corta. |
| `sub` | string | `""` | Rótulo chico debajo (condensada con tracking). |
| `tally` | bool | `true` | Marcas de conteo arriba a la derecha. |
| `doc` | string | `"Congreso · sesión del día · acta"` | Texto manuscrito tenue de fondo. |
| `out` | enum (dive / erode / cut) | `"dive"` | dive = gira y entra en los listones (últimos 0,5 s del beat). |
| `buildSec` | number | `1.4` | Segundos que tarda en armarse. |

```json
{"use": "enmienda.slats", "params": {"text": "XXVIII", "sub": "AÑOS"}}
```

### `enmienda.plaque`

Tablero de listones blancos con letras negras de esténcil gastado (tipo 'ABOLITION OF SLAVERY'), iluminado al centro. Entra girando desde muy cerca (empalme con slats) y se aleja despacio; puede tachar renglones con cinta negra que se pega en stop-motion.

Etiquetas: título, cartel, tachar, cinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `lines` | array | `["LA NOCHE", "QUE CAYÓ", "EL MURO"]` | Renglones (uno por listón). Las palabras cortas quedan en listones más bajos. |
| `in` | enum (dive / cut / fade) | `"cut"` | dive = llega girando desde muy cerca. |
| `strike` | array | `[]` | Índices de renglones a tachar con cinta. |
| `strikeAt` | number | `1.2` | Segundo (o '@palabra') en que se pega la primera cinta. |
| `out` | enum (smear / cut) | `"smear"` | smear = barrido desenfocado horizontal en el solape. |

```json
{"use": "enmienda.plaque", "params": {"lines": ["LA NOCHE", "QUE CAYÓ", "EL MURO"], "in": "dive"}}
```

### `enmienda.cards`

Cartulinas blancas con palabras en tinta negra de rodillo, pegadas con cinta negra sobre papel gris arrugado; aparecen una por una en stop-motion (como 'KEEP THESE PRISONS FILLED'). Puede tachar con cinta o, en modo 'pile', llover hojas que se apilan.

Etiquetas: cartel, palabras, stop-motion, papel, tachar · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `words` | array · obligatorio | `null` | Una palabra (o dos cortas) por cartulina. |
| `at` | array | `[]` | Segundos de aparición de cada cartulina (vacío = repartidas en el primer 60 % del beat). |
| `strike` | array | `[]` | Índices de cartulinas a tachar con cinta. |
| `strikeAt` | number | `1.5` | Segundo (o '@palabra') de la primera cinta que tacha. |
| `mode` | enum (words / pile) | `"words"` | pile = hojas que caen y se apilan (palabras como membretes). |
| `count` | number | `16` | Hojas en modo pile. |

```json
{"use": "enmienda.cards", "params": {"words": ["ABRAN", "LA", "PUERTA"]}}
```

### `enmienda.letter`

Aviso de diario en papel blanco con viñeta: titular en serif condensada negra; barrido rápido (latigazo con desenfoque) hasta el cuerpo del texto y una nota manuscrita que se escribe sobre la línea de firma.

Etiquetas: documento, diario, firma, nota · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `headline` | string · obligatorio | `null` | Titular ('\n' renglones). |
| `body` | string | `""` | Cuerpo chico (serif). |
| `hand` | string | `""` | Nota manuscrita que se escribe sobre la línea. |
| `sign` | string | `""` | Rótulo bajo la línea de firma. |
| `whipAt` | number | `0` | Segundo del latigazo al cuerpo (0 = 50 % del beat). |

```json
{"use": "enmienda.letter", "params": {"headline": "ESPERAR\nHASTA LA\nMAÑANA.", "body": "La regla se anunciaría al día siguiente,\ncon calma, con trámites y con orden.", "hand": "no antes del 10/11", "sign": "Oficina de prensa · 9 nov 1989"}}
```

### `enmienda.document`

Documento oscuro: párrafo en condensada gris cuyas palabras aparecen en desorden (parpadeando) sobre una imagen fantasma; después una frase se resalta con caja blanca y texto negro (como 'EXCEPT AS A PUNISHMENT FOR CRIME').

Etiquetas: documento, ley, cita, resaltado · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Párrafo (se pasa a mayúsculas). |
| `highlight` | string | `""` | Fragmento exacto del texto a resaltar. |
| `highlightAt` | number | `1.6` | Segundo (o '@palabra') del resaltado. |
| `label` | string | `""` | Rótulo chico arriba (p. ej. 'SECCIÓN 1'). |
| `src` | image | `""` | Imagen fantasma de fondo (muy tenue, opcional). |

```json
{"use": "enmienda.document", "params": {"text": "Un muro de hormigón y alambre en medio de la ciudad", "highlight": "hormigón y alambre", "highlightAt": 1.6}}
```

### `enmienda.wordcloud`

Nube de palabras condensadas en profundidad: decenas de términos de distintos tamaños sobre un plano inclinado que la cámara atraviesa; las lejanas desenfocadas y tenues, las cercanas nítidas; garabatos a pincel encima.

Etiquetas: lista, derechos, nube, palabras · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `words` | array · obligatorio | `null` | Términos (se repiten para llenar la nube). |
| `count` | number | `18` | Cantidad de instancias. |

```json
{"use": "enmienda.wordcloud", "params": {"words": ["HUNGRÍA", "CHECOSLOVAQUIA", "ESCAPAR", "FRONTERA", "VIAJAR", "LIBERTAD"]}}
```

### `enmienda.finale`

Título de cierre: letras gigantes (numeral romano) que desbordan el cuadro y barren lento de derecha a izquierda bajo una franja de luz; un rótulo chico impreso en tinta oscura sobre la primera letra. Entra con una cuña oscura que barre la escena anterior y termina fundiendo a negro.

Etiquetas: cierre, título, numeral · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `"MCMLXXXIX"` | Letras gigantes. |
| `label` | string | `""` | Rótulo impreso sobre una letra ('\n' renglones). |
| `labelOn` | number | `0` | Índice de la letra que lleva el rótulo. |
| `speed` | number | `1` | Velocidad del barrido (1 ≈ 6,5 % del ancho por segundo). |

```json
{"use": "enmienda.finale", "params": {"text": "MCMLXXXIX", "label": "9 NOV\n1989"}}
```

### `enmienda.map`

Mapa de tinta sobre negro (siluetas de papel gastado): el mundo aparece parpadeando con un país resaltado; un barrido de vetas disuelve el resto y el país viaja al centro. Opciones: barras negras que gotean (barrotes), mitad oscura del país con frontera punteada (que se funde al unirse), puntos dispersos, ciudad con rótulo en caja negra y texto extendido encima.

Etiquetas: mapa, país, lugar, apertura, geografía · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `from` | enum (world / country) | `"world"` | world = empieza con el planisferio. |
| `zoomAt` | number | `2.4` | Segundo en que el mundo se disuelve y el país viaja al centro. |
| `country` | enum (DE) | `"DE"` | País (geometría incluida en assets/geo.js). |
| `label` | string | `""` | Ciudad con rótulo (clave de ENM_GEO.cities, p. ej. 'BERLÍN'). |
| `labelAt` | number | `0.6` | Segundo del rótulo (después del viaje). |
| `bars` | number | `-1` | Segundo en que gotean las barras negras (-1 = no). |
| `split` | bool | `false` | Oscurece el Este con frontera punteada. |
| `mergeAt` | number | `-1` | Segundo en que el Este se aclara y la frontera se borra (-1 = no). |
| `dots` | number | `0` | Cantidad de puntos dispersos sobre el país. |
| `text` | string | `""` | Texto extendido encima ('\n' renglones). |
| `textAt` | number | `0.5` | Segundo del texto. |

```json
{"use": "enmienda.map", "params": {"from": "world", "zoomAt": 2.4, "label": "BERLÍN"}}
```

### `enmienda.title`

Apertura en frío del documental: planisferio de tinta que aparece parpadeando con el país resaltado, barrido de vetas que deja solo el país en el centro y barras negras que gotean sobre él (barrotes). Rótulo chico extendido arriba y título opcional encima.

Etiquetas: apertura, título, mapa · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Título encima (extendida; vacío = sin título, como la referencia). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `country` | enum (DE) | `"DE"` | País resaltado. |
| `zoomAt` | number | `1.9` | Segundo del barrido mundo → país. |
| `bars` | number | `3.3` | Segundo en que gotean los barrotes (-1 = no). |
| `textAt` | number | `0.4` | Segundo del título (después del viaje). |

```json
{"use": "enmienda.title", "params": {"kicker": "BERLÍN · 9 NOV 1989", "zoomAt": 1.9, "bars": 3.3}}
```

### `enmienda.flag`

Bandera de tela ondeando en blanco y negro (la cámara se aleja desde un primer plano girado) con texto de tamaños mezclados encima: palabras chicas condensadas a los lados y una palabra ENORME extendida al medio (como 'TO ALL AMERICANS').

Etiquetas: bandera, nación, título · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `bands` | enum (de / stripes) | `"de"` | de = tres franjas horizontales; stripes = rayas con cantón de estrellas. |
| `text` | string | `""` | Texto; '^PALABRA^' es la grande del medio. |
| `textAt` | number | `1.1` | Segundo del texto. |

```json
{"use": "enmienda.flag", "params": {"bands": "de", "text": "EL ^MURO^ MÁS FAMOSO"}}
```

### `enmienda.archive`

Foto de archivo en blanco y negro contrastado a pantalla completa (o dentro de un marco de película proyectada), empuje lento de cámara, lower-third de entrevista (NOMBRE / cargo / institución en Barlow Condensed) y, opcional, barrotes desenfocados en primer plano que entran de golpe.

Etiquetas: foto, archivo, persona, lugar, entrevista · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto. |
| `focus` | array | `[0.5, 0.45]` | Punto de interés [x,y] 0..1 para el encuadre. |
| `zoom` | number | `1.04` | Zoom inicial (≥1). |
| `push` | number | `0.02` | Empuje por segundo. |
| `frame` | enum (full / film) | `"full"` | film = cuadro de película con esquinas redondeadas sobre negro. |
| `in` | enum (cut / fade) | `"cut"` | fade = sube desde negro. |
| `name` | string | `""` | Lower-third: nombre. |
| `role` | string | `""` | Lower-third: cargo (gris). |
| `org` | string | `""` | Lower-third: institución / lugar. |
| `bars` | number | `-1` | Segundo en que entran barrotes desenfocados (-1 = no). |

```json
{"use": "enmienda.archive", "params": {"src": "assets/media/schabowski.jpg", "name": "Günter Schabowski", "role": "Vocero del partido", "org": "SED · RDA"}}
```

### `enmienda.cutout`

Figuras recortadas de fotos de archivo que aparecen una a una sobre negro: primero una silueta blanca sobreexpuesta con brillo y después se 'revela' la foto (como los presos de 1900 que se van sumando).

Etiquetas: personas, fotos, revelado, grupo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src1` | image · obligatorio | `null` | Foto 1. |
| `src2` | image | `""` | Foto 2. |
| `src3` | image | `""` | Foto 3. |
| `src4` | image | `""` | Foto 4. |
| `stagger` | number | `0.45` | Segundos entre figura y figura. |
| `name` | string | `""` | Lower-third opcional: nombre. |
| `role` | string | `""` | Lower-third: cargo. |

```json
{"use": "enmienda.cutout", "params": {"src1": "assets/media/muro-gente.jpg", "src2": "assets/media/mauerspecht.jpg", "src3": "assets/media/leipzig.jpg"}}
```

### `enmienda.tapes`

Pared de tiras de cinta negra con textos manuscritos en blanco (nombre / fecha / lugar), bajo un foco que se enciende y deriva; opcionalmente la cámara se aleja y las tiras se vuelven los ladrillos de un muro con una placa en el centro.

Etiquetas: lista, nombres, memoria, cinta, muro · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | Textos de cada tira ('\n' = renglón, hasta 3). |
| `toWall` | number | `-1` | Segundo en que se aleja y se vuelve muro de ladrillos (-1 = no). |
| `plaque` | string | `""` | Placa del muro ('\n' renglones). |

```json
{"use": "enmienda.tapes", "params": {"items": ["MADRE\nBERLÍN ESTE\nSEPARADA", "HERMANO\nBERLÍN OESTE\nSEPARADO"], "toWall": 3, "plaque": "UNA CALLE\nDOS MUNDOS"}}
```

### `enmienda.wall`

Muro de ladrillos gris bajo un foco, con una placa negra chica en el centro; puede ABRIRSE: los ladrillos del centro caen uno a uno (stop-motion) dejando pasar una luz blanca.

Etiquetas: muro, placa, barrera, apertura · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `plaque` | string | `""` | Texto de la placa ('\n' renglones). |
| `openAt` | number | `-1` | Segundo (o '@palabra') en que empiezan a caer ladrillos (-1 = no). |
| `openSec` | number | `2.4` | Segundos que tarda en abrirse el hueco. |

```json
{"use": "enmienda.wall", "params": {"plaque": "23:30\nLA DECISIÓN", "openAt": 2}}
```

### `enmienda.inmates`

Fila de siluetas con uniforme a rayas sobre pared de papel gris, desenfocadas, que la cámara recorre; un latigazo lleva a un primer plano de una figura con una placa negra en el pecho: CIFRA grande + rótulo + nota (como '878,400').

Etiquetas: cifra, personas, dato, presos · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `number` | string · obligatorio | `null` | Cifra de la placa. |
| `label` | string | `""` | Rótulo bajo la cifra. |
| `sub` | string | `""` | Nota chica. |
| `whipAt` | number | `1` | Segundo del latigazo al primer plano. |

```json
{"use": "enmienda.inmates", "params": {"number": "140", "label": "MURIERON EN EL MURO", "sub": "1961 — 1989"}}
```

### `enmienda.bars`

Barrotes: palabra gastada sobre negro con barras de luz desenfocadas que pasan en primer plano; la cámara se aleja y la palabra queda dentro de una celdita dibujada; las palabras siguientes llegan letra por letra desde lejos, sobre un fondo de rayas verticales tenues.

Etiquetas: encierro, palabras, barrotes, celda · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `texts` | array · obligatorio | `null` | Palabras/frases en orden (la 1ª va con barrotes). |
| `at` | array | `[]` | Segundos de cada cambio (vacío = repartidos). |

```json
{"use": "enmienda.bars", "params": {"texts": ["LARGA", "Y ABURRIDA", "UNA HORA"]}}
```

### `enmienda.graph`

Gráfico de línea fino sobre negro con puntos y líneas verticales al eje: la cámara arranca pegada e inclinada sobre el primer punto, recorre la línea mientras se dibuja y se aleja; el título se estampa con parpadeo y al final la cámara se zambulle en el último punto.

Etiquetas: gráfico, datos, evolución, tiempo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string | `""` | Título (3 renglones cortos). |
| `points` | array · obligatorio | `null` | Etiquetas del eje X. |
| `values` | array | `[]` | Valores 0..1 (vacío = crecimiento exponencial). |
| `dive` | bool | `true` | Zambullida final en el último punto. |

```json
{"use": "enmienda.graph", "params": {"title": "SALIDAS\nHACIA EL\nOESTE", "points": ["ENE", "MAR", "MAY", "JUL", "AGO", "SEP", "OCT", "NOV"], "values": [0.05, 0.07, 0.1, 0.15, 0.3, 0.45, 0.6, 1]}}
```

### `enmienda.pictogram`

Infografía sobre negro: título extendido chico con etiqueta en caja, fila de figuras humanas grises que suben desde el piso con UNA a rayas resaltada y la proporción debajo ('1 DE 3'); después la cámara entra en la figura rayada y aparece una grilla de figuras con la cifra grande arriba ('40,2 %').

Etiquetas: infografía, proporción, dato, personas, porcentaje · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string | `""` | Título (extendida chica). |
| `tag` | string | `""` | Etiqueta en caja bajo el título. |
| `ratio` | string | `""` | Proporción bajo la fila (p. ej. '1 DE 17'). |
| `row` | number | `17` | Figuras en la fila. |
| `big` | string | `""` | Cifra grande de la grilla. |
| `note` | string | `""` | Nota bajo la grilla. |
| `gridAt` | number | `0` | Segundo del pase a la grilla (0 = 45 % del beat; -1 = sin grilla). |
| `cols` | number | `22` | Columnas de la grilla. |
| `rows` | number | `5` | Filas de la grilla. |

```json
{"use": "enmienda.pictogram", "params": {"title": "PROBABILIDAD DE CRUZAR", "tag": "BERLÍN ESTE", "ratio": "1 DE 3", "big": "MILES", "note": "EN LOS PUESTOS FRONTERIZOS"}}
```

### `enmienda.collage`

Constelación de recortes (fotos, rótulos, numerales) que nace de un punto girando y se abre; después se oscurece y aparece un bloque de dato al centro: rótulo chico, CIFRA que cuenta hacia arriba y nota, entre filetes.

Etiquetas: resumen, cifra, fecha, constelación · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src1` | image | `""` | Foto 1. |
| `src2` | image | `""` | Foto 2. |
| `src3` | image | `""` | Foto 3. |
| `src4` | image | `""` | Foto 4. |
| `words` | array | `[]` | Rótulos sueltos del collage. |
| `kicker` | string | `""` | Rótulo sobre la cifra. |
| `big` | string | `""` | Cifra (si es número, cuenta hacia arriba). |
| `sub` | string | `""` | Nota bajo la cifra. |
| `from` | number | `0` | Valor inicial del conteo. |

```json
{"use": "enmienda.collage", "params": {"src1": "assets/media/mauerbau.jpg", "src2": "assets/media/leipzig.jpg", "words": ["IX·XI", "1961", "RDA"], "kicker": "3 DE OCTUBRE", "big": "1990", "sub": "ALEMANIA · UN SOLO PAÍS"}}
```

### `enmienda.flicker`

Golpe de proyector sobre la escena: destello blanco de 2 cuadros que se apaga, caída a negro, o parpadeo de exposición irregular (lámpara inestable).

Etiquetas: transición, golpe, corte · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `kind` | enum (white / black / exposure) | `"white"` | Tipo de golpe. |
| `strength` | number [0–1] | `0.85` | Intensidad máxima. |

```json
{"use": "enmienda.flicker", "params": {"kind": "white", "dur": 0.4}}
```

### `enmienda.introv1`

GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: wall | map | world | dark | image con src | component con use/useParams); por defecto el Muro de noche — losas de hormigón con tubo, torre de vigilancia, reflectores que barren y una fila de gente en silueta bloqueando adelante — y un titular GIGANTE desgastado que golpea palabra por palabra con sacudida de cámara ('^palabra^' va en cartulina blanca). El muro se raja y entra luz por la grieta. Sale borrándose con barrido.

Etiquetas: intro, gancho, apertura, título, muro, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en cartulina blanca. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha). |
| `sub` | string | `""` | Línea chica debajo del titular. |
| `bg` | enum (auto / wall / map / world / dark / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: wall, map, world, dark; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |
| `crowd` | bool | `true` | Fila de gente en silueta bloqueando en primer plano (sobre cualquier fondo). |
| `crackAt` | number | `2.3` | Segundo en que el muro se raja (-1 = no se raja). |
| `wordAt` | number | `0.45` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabra y palabra. |
| `country` | enum (DE) | `"DE"` | País (bg=map). |
| `city` | string | `"BERLÍN"` | Ciudad marcada (bg=map). |

```json
{"use": "enmienda.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "crackAt": 2.3}}
```

### `enmienda.introv2`

GANCHO tipo expediente. Fondo adaptable al tema (bg: map | wall | world | dark | image con src | component con use/useParams); por defecto el mapa del país con cuadrícula y vecinos, una mira que se fija sobre la ciudad con ondas de radar y barrido de vigilancia, gente en silueta al pie. La pregunta gigante se tipea letra a letra y un SELLO de tinta golpea encima con sacudida (p. ej. 'NADIE DIO LA ORDEN').

Etiquetas: intro, gancho, apertura, mapa, pregunta, sello · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `stamp` | string | `""` | Texto del sello que golpea (vacío = sin sello). |
| `stampAt` | number | `2.4` | Segundo del sello (acepta '@palabra'). |
| `typeAt` | number | `0.35` | Segundo en que empieza a tipearse la pregunta. |
| `cps` | number [4–None] | `20` | Letras por segundo del tipeo. |
| `country` | enum (DE) | `"DE"` | País del mapa. |
| `city` | string | `"BERLÍN"` | Ciudad donde se fija la mira (clave de ENM_GEO.cities). |
| `crowd` | bool | `true` | Gente en silueta al pie. |
| `bg` | enum (auto / map / wall / world / dark / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: map, wall, world, dark; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "enmienda.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Expediente · Berlín 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}
```

### `enmienda.outro`

Cierre del canal SIN recuadro (bg: map | wall | image con src | component con use/useParams): por defecto mapamundi de tinta que se desplaza con alfileres y rutas de hilo (o el Muro de noche). GRACIAS POR VER → nombre del canal GIGANTE desgastado que se revela por erosión → tarjeta LIKE marcada con un círculo a pincel → flecha a pincel → placa blanca SUSCRÍBETE + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, mapa · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el expediente."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / map / wall / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: map, wall; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "enmienda.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@nodetech"}}
```

## grunge · CRUDO

### `grunge.word`

LA escena del estilo: una palabra en tres cortes — primer plano gigante de sus primeras letras con texturas stop-motion → la palabra a todo el ancho (negativo volteado, golpe de zoom, se erosiona de izquierda a derecha) → fondo de color plano con suciedad de película, la palabra entra rasgada y se reacomoda, brochazo detrás, negativos y salpicaduras. Las fases se reparten solas según la duración del beat.

Etiquetas: título, palabra, impacto, concepto, fecha, número · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra o palabras cortas en mayúsculas ('\n' parte renglones; ideal 1 palabra de 3–9 letras). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `note` | string | `""` | Rótulo chico (Montserrat 800, espaciado) bajo el brochazo: lugar · fecha · dato. La referencia no lo tiene: dejar vacío para el look puro. |
| `phases` | enum (auto / full / slam+brush / closeup+slam / closeup+brush / brush / slam / closeup) | `"auto"` | Qué fases mostrar. auto: ≥4,2 s las tres; ≥2,4 s palabra+brochazo; si no, solo brochazo. |
| `size` | number [0.5–1.3] | `1` | Escala de la palabra en el brochazo. |
| `color` | string | `"auto"` | Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex. |
| `polarity` | enum (auto / dark / light) | `"auto"` | dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo (x) o volteo (y) del negativo de la palabra entera. |

```json
{"use": "grunge.word", "params": {"text": "MURO", "note": "BERLÍN · 1961"}}
```

### `grunge.title`

Título de apertura (o frase final): la escena completa de la referencia con sus tres fases siempre — primer plano gigante, palabra a todo el ancho con negativo y erosión, brochazo con rótulo chico. Admite 2–4 renglones cortos.

Etiquetas: intro, gancho, título, cierre · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título ('\n' parte renglones). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `note` | string | `""` | Rótulo chico bajo el brochazo (antetítulo / fecha). |
| `phases` | enum (full / slam+brush / closeup+brush) | `"full"` | Fases (por defecto las tres). |
| `size` | number [0.5–1.3] | `1` | Escala de la palabra en el brochazo. |
| `color` | string | `"auto"` | Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex. |
| `polarity` | enum (auto / dark / light) | `"auto"` | dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo (x) o volteo (y) del negativo de la palabra entera. |

```json
{"use": "grunge.title", "params": {"text": "9 NOV\n1989", "note": "LA NOCHE QUE CAYÓ EL MURO"}}
```

### `grunge.closeup`

Solo la fase A: primer plano GIGANTE de las primeras letras, que se materializan por salpicaduras y cambian de textura en stop-motion (negativo, rayado, doble exposición hacia las letras siguientes).

Etiquetas: intro, tensión, palabra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto ('\n' parte renglones). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `color` | string | `"auto"` | Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex. |
| `polarity` | enum (auto / dark / light) | `"auto"` | dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo (x) o volteo (y) del negativo de la palabra entera. |

```json
{"use": "grunge.closeup", "params": {"text": "HORMIGÓN"}}
```

### `grunge.slam`

Solo la fase B: la palabra a todo el ancho sobre fondo plano, negativo volteado, golpe de zoom 1,3× y erosión de izquierda a derecha que deja la última letra.

Etiquetas: impacto, palabra, golpe · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto ('\n' parte renglones). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `color` | string | `"auto"` | Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex. |
| `polarity` | enum (auto / dark / light) | `"auto"` | dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo (x) o volteo (y) del negativo de la palabra entera. |

```json
{"use": "grunge.slam", "params": {"text": "HORMIGÓN"}}
```

### `grunge.brush`

Solo la fase C: fondo de color con suciedad de película; la palabra entra rasgada en franjas que se reacomodan, brochazo ancho detrás, negativos cortos y salpicaduras al final.

Etiquetas: palabra, concepto, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto ('\n' parte renglones). |
| `textPortrait` | string | `""` | Cortes alternativos para 9:16. |
| `note` | string | `""` | Rótulo chico bajo el brochazo. |
| `size` | number [0.5–1.3] | `1` | Escala de la palabra. |
| `color` | string | `"auto"` | Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex. |
| `polarity` | enum (auto / dark / light) | `"auto"` | dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo (x) o volteo (y) del negativo de la palabra entera. |

```json
{"use": "grunge.brush", "params": {"text": "HORMIGÓN"}}
```

### `grunge.flip`

Golpe de negativo de 2–5 cuadros sobre el plano actual (fondo ↔ tinta), opcionalmente espejado/volteado o con zoom 1,3× — el 'flash' de esta familia. Usar con 'dur' 0.1–0.45.

Etiquetas: transición, golpe, negativo · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mode` | enum (neg / negx / negy / zoom) | `"neg"` | neg = negativo; negx = negativo espejado; negy = negativo volteado; zoom = solo golpe de zoom. |
| `zoom` | number [1–1.6] | `1` | Golpe de zoom durante el negativo. |

```json
{"use": "grunge.flip", "params": {"mode": "negy", "zoom": 1}}
```

### `grunge.photo`

Foto real en duotono (negro cálido → color plano de la escena) con el mismo lenguaje de cortes de la palabra: primer plano 2,4× que se materializa por salpicaduras y cambia de textura en stop-motion → foto a pantalla completa con negativo volteado, golpe de zoom y erosión → la foto pintada dentro de un brochazo ancho con el título rasgado arriba y salpicaduras.

Etiquetas: foto, lugar, persona, documento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (jpg/png local). |
| `title` | string | `""` | Título corto en mayúsculas (1–3 palabras) para la fase de brochazo. |
| `note` | string | `""` | Rótulo chico bajo el título (lugar · fecha). |
| `focus` | array | `[0.5, 0.45]` | Punto [x,y] 0..1 del primer plano y del recorte. |
| `zoom` | number [1.2–4] | `2.4` | Aumento del primer plano. |
| `phases` | enum (auto / full / slam+brush / closeup+slam / closeup+brush / brush / slam / closeup) | `"auto"` | Qué fases mostrar (como grunge.word). |
| `color` | string | `"auto"` | Color plano (auto | cream | mustard | mint | coral | petrol | pink | #hex). |
| `polarity` | enum (auto / dark / light) | `"auto"` | Fondo del brochazo: dark = color plano, light = casi negro. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo/volteo del negativo. |

```json
{"use": "grunge.photo", "params": {"src": "assets/media/mauerbau.jpg", "title": "AGOSTO 1961", "focus": [0.5, 0.45]}}
```

### `grunge.stamp`

Frase narrada en cortes secos: cada palabra que dice la voz dentro del beat aparece SOLA a todo el ancho (como la palabra entera de la referencia), con texturas de tinta y fondo que alterna casi negro / color plano; las palabras de `accent` llevan brochazo detrás y golpe de negativo; la última se erosiona al salir.

Etiquetas: frase, cita, clímax, letra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `accent` | array | `[]` | Palabras clave (sin tildes/mayúsculas importa): brochazo detrás + negativo de 3 cuadros. |
| `skip` | array | `[]` | Palabras que NO se muestran (artículos, muletillas): la anterior se queda en pantalla. |
| `color` | string | `"auto"` | Color plano (auto | cream | mustard | mint | coral | petrol | pink | #hex). |
| `polarity` | enum (auto / dark / light) | `"auto"` | Fondo de la primera palabra; después alterna. |
| `flip` | enum (auto / none / x / y) | `"auto"` | Espejo/volteo del negativo de las palabras clave. |

```json
{"use": "grunge.stamp", "params": {"accent": ["inmediato"]}}
```

### `grunge.introv1`

GANCHO de apertura (lo primero que se ve). Titular GIGANTE que golpea palabra por palabra: cada palabra entra en negativo sobre una placa de color plano (2 cuadros, el color cambia en cada palabra) y se reacomoda rasgada en franjas; la '^palabra^' queda pintada a rodillo en el color de la escena. Golpe de tinta (inkAt): negativo con zoom, salpicaduras, subrayado de rodillo que chorrea, y aparece el rótulo. Fondo adaptable al tema (bg: roller | posters | film | splatter | image con src en duotono | component con use/useParams | none). Sale rasgándose en franjas.

Etiquetas: intro, gancho, apertura, título, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón (en 9:16 se re-corta solo si así crece); '^x^' = palabra pintada a rodillo. Un signo pegado (^MURO^?) no se separa. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha), sobre una placa de color. |
| `sub` | string | `""` | Línea chica debajo del subrayado (aparece con el golpe de tinta). |
| `color` | string | `"mustard"` | Color plano de la escena: mustard | mint | coral | petrol | pink | cream | #hex. |
| `wordAt` | number | `0.3` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabra y palabra. |
| `inkAt` | number | `2.3` | Golpe de tinta: negativo + zoom, salpicaduras y subrayado que chorrea (-1 = sin golpe). Acepta '@palabra'. |
| `bg` | enum (auto / roller / posters / film / splatter / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: roller, posters, film, splatter; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "grunge.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "inkAt": 2.3}}
```

### `grunge.introv2`

GANCHO pregunta + revelación. La pregunta gigante se pulveriza letra a letra (cada letra aparece como motas de tinta que se densifican en 3 cuadros, con cursor de color) sobre una franja negra de rodillo; la respuesta (stamp) llega como un BROCHAZO del color de la escena que se pinta en 3 cuadros, con la respuesta rasgada encima, negativo espejado y salpicaduras que chorrean. Fondo adaptable (bg: film | roller | posters | splatter | image con src en duotono | component con use/useParams | none).

Etiquetas: intro, gancho, apertura, pregunta, revelación · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón; en 9:16 se re-corta solo si así crece). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `stamp` | string | `""` | Respuesta que llega en el brochazo (vacío = sin respuesta). |
| `stampAt` | number | `2.4` | Segundo del brochazo-respuesta (acepta '@palabra'). |
| `typeAt` | number | `0.3` | Segundo en que empieza a aparecer la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo. |
| `color` | string | `"coral"` | Color plano de la escena (brochazo, cursor, luz): mustard | mint | coral | petrol | pink | cream | #hex. |
| `bg` | enum (auto / roller / posters / film / splatter / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: roller, posters, film, splatter; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "grunge.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}
```

### `grunge.outro`

Cierre del canal SIN recuadro (bg: posters | roller | film | splatter | image con src en duotono | component con use/useParams). Por defecto una cartelera de afiches de colores que se pegan en stop-motion. GRACIAS POR VER → nombre del canal GIGANTE que se pulveriza en motas, golpea en negativo, se reacomoda rasgado y un rodillo de color lo pinta detrás → placa LIKE que se marca (se vuelve menta, pulgar relleno, aro a pincel, salpicaduras) → flecha a pincel → brochazo coral SUSCRÍBETE (con negativo) + campana que suena → apoyo palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `color` | string | `"mustard"` | Color del rodillo detrás del canal y del handle: mustard | mint | coral | petrol | pink | #hex. |
| `bg` | enum (auto / roller / posters / film / splatter / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: roller, posters, film, splatter; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "grunge.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el video.", "handle": "youtube.com/@nodetech"}}
```

## pelicula · ARCHIVO 35

### `pelicula.title`

Apertura (ref 0–3 s): foto de archivo que entra desenfocada y hace foco, dos filas de perforaciones arriba y una abajo que entran deslizándose, arcos finos, y el bloque año + titular + subtítulo que CAE desde arriba con estela y hace glitch de franjas.

Etiquetas: apertura, título, año · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `year` | string | `""` | Número GIGANTE naranja (año, fecha, cifra: '1989', '28', '23:30'). |
| `title` | string | `""` | Titular en mayúsculas crema ('\n' parte renglones). |
| `sub` | string | `""` | Subtítulo chico con barra roja delante. |
| `kicker` | string | `""` | Rótulo mínimo arriba del titular (opcional). |
| `layout` | enum (under / over) | `"under"` | under = titular debajo del año (1930); over = titular arriba del año (1940). |
| `color` | enum (orange / red) | `"orange"` | Color del número: naranja (#c9501f) o rojo (#c4352a). |
| `pos` | enum (center / left / right / topLeft / topRight / bottomLeft / bottomRight / bigLeft / bigRight) | `"right"` | Posición del bloque. bigLeft/bigRight = gigante y cortado por el borde. |
| `size` | number [0.12–1.2] | `0.44` | Ancho del número como fracción del ancho del cuadro (en 9:16 se agranda solo). |
| `textIn` | enum (drop / rise / glitch / flash / fade / none) | `"drop"` | Entrada del bloque: drop (cae desde arriba con estela), rise (sube), glitch, flash (aparece tras el destello), fade. |
| `textAt` | number | `0.28` | Segundos desde el inicio del plano hasta que entra el bloque. |
| `glitches` | array | `[0.68]` | Segundos (desde el inicio del plano) donde el bloque hace glitch de franjas 0.3 s. |
| `drift` | enum (left / right / up / none) | `"left"` | Deriva lenta del bloque después de entrar (se frena en ~3 s). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 del encuadre. |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"focus"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"none"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.title", "params": {"src": "assets/media/muro-gente.jpg", "year": "1989", "title": "LA NOCHE QUE\nCAYÓ EL MURO", "sub": "BERLÍN · 9 DE NOVIEMBRE"}}
```

### `pelicula.year`

Plano principal de la referencia: número GIGANTE naranja/rojo + titular crema + subtítulo con barra roja sobre una foto virada con filas de perforaciones en doble exposición. Entradas del bloque (cae / sube / glitch / tras destello), cámara (in/out/rise…) y 'punch' opcional: corte a otra escala del mismo bloque escondido por un prisma de luz.

Etiquetas: año, fecha, cifra, titular, foto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `src2` | image | `""` | Segunda foto (tira lateral o doble exposición). |
| `year` | string | `""` | Número GIGANTE naranja (año, fecha, cifra: '1989', '28', '23:30'). |
| `title` | string | `""` | Titular en mayúsculas crema ('\n' parte renglones). |
| `sub` | string | `""` | Subtítulo chico con barra roja delante. |
| `kicker` | string | `""` | Rótulo mínimo arriba del titular (opcional). |
| `layout` | enum (under / over) | `"under"` | under = titular debajo del año (1930); over = titular arriba del año (1940). |
| `color` | enum (orange / red) | `"orange"` | Color del número: naranja (#c9501f) o rojo (#c4352a). |
| `pos` | enum (center / left / right / topLeft / topRight / bottomLeft / bottomRight / bigLeft / bigRight) | `"right"` | Posición del bloque. bigLeft/bigRight = gigante y cortado por el borde. |
| `size` | number [0.12–1.2] | `0.42` | Ancho del número como fracción del ancho del cuadro (en 9:16 se agranda solo). |
| `textIn` | enum (drop / rise / glitch / flash / fade / none) | `"drop"` | Entrada del bloque: drop (cae desde arriba con estela), rise (sube), glitch, flash (aparece tras el destello), fade. |
| `textAt` | number | `0.28` | Segundos desde el inicio del plano hasta que entra el bloque. |
| `glitches` | array | `[]` | Segundos (desde el inicio del plano) donde el bloque hace glitch de franjas 0.3 s. |
| `drift` | enum (left / right / up / none) | `"left"` | Deriva lenta del bloque después de entrar (se frena en ~3 s). |
| `strips` | enum (frame / top / bottom / double / side / none) | `"frame"` | Perforaciones: frame (arriba y abajo), top, bottom, double (filas grandes cruzando), side (tira vertical con src2), none. |
| `camera` | enum (in / out / left / right / rise / fall / still) | `"in"` | Movimiento de cámara: in/out (Ken Burns), left/right (paneo), rise (todo sube, ref 1932), fall, still. |
| `ghost` | number [0–0.6] | `0` | Opacidad de src2 en doble exposición sobre toda la escena. |
| `punch` | number | `-1` | Segundos (o '@palabra') en que el plano corta a la versión punch del bloque (−1 = sin punch). |
| `punchPos` | enum (center / left / right / topLeft / topRight / bottomLeft / bottomRight / bigLeft / bigRight) | `"bigLeft"` | Posición del bloque después del punch. |
| `punchSize` | number [0.12–1.4] | `0.95` | Tamaño del número después del punch. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1. |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"whip"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"none"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.year", "params": {"src": "assets/media/mauerbau.jpg", "year": "1961", "title": "SE LEVANTA EL MURO", "sub": "AGOSTO · BERLÍN", "pos": "right", "strips": "frame", "punch": 3.2}}
```

### `pelicula.photo`

Foto de archivo a pantalla completa (ref 18.6–24 s y 30.6–32.4 s): fila de perforaciones cortada por el borde, Ken Burns lento, arcos finos, doble exposición opcional y un titular chico opcional. Entra con barrido horizontal con motion blur.

Etiquetas: foto, lugar, personas, evidencia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto. |
| `src2` | image | `""` | Foto en doble exposición (opcional). |
| `ghost` | number [0–0.6] | `0.22` | Opacidad de la doble exposición. |
| `title` | string | `""` | Titular chico (opcional). |
| `sub` | string | `""` | Subtítulo con barra roja (opcional). |
| `pos` | enum (center / left / right / topLeft / topRight / bottomLeft / bottomRight / bigLeft / bigRight) | `"bottomLeft"` | Posición del titular. |
| `perfs` | enum (top / bottom / both / none) | `"top"` | Fila de perforaciones cortada por el borde. |
| `camera` | enum (in / out / left / right / rise / fall / still) | `"in"` | Movimiento de cámara. |
| `focus` | array | `[0.5, 0.45]` | Punto de interés [x,y] 0..1. |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"whip"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"none"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.photo", "params": {"src": "assets/media/bornholmer.jpg", "title": "BORNHOLMER STRASSE", "sub": "PASO FRONTERIZO · BERLÍN"}}
```

### `pelicula.strip`

Montaje en tiras de película (ref 3.6–6.8 s y 38–43.7 s): 2–3 fotos como cuadros de tiras horizontales que corren en sentidos opuestos, perforaciones en los bordes, doble exposición y una barra de luz que cruza el cuadro.

Etiquetas: montaje, collage, varias fotos, contexto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto 1 (cuadro grande). |
| `src2` | image | `""` | Foto 2. |
| `src3` | image | `""` | Foto 3 (tira de abajo / fondo). |
| `layout` | enum (split / band) | `"split"` | split = tira grande arriba + tira chica abajo (ref 4 s); band = una tira ancha al medio sobre la foto de fondo (ref 39 s). |
| `sweep` | bool | `true` | Barra de luz que cruza el cuadro a mitad del plano. |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"whip"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"none"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.strip", "params": {"src": "assets/media/mauerbau.jpg", "src2": "assets/media/bornholmer.jpg", "src3": "assets/media/muro-gente.jpg", "layout": "split"}}
```

### `pelicula.reel`

Rollo vertical (ref 13–15 s y 53–55.6 s): la foto como cuadros de una tira vertical con perforaciones a ambos lados que corre hacia arriba, tira lateral a la derecha y fondo lavado en blanco; bloque de año/titular opcional al costado.

Etiquetas: foto, documento, retrato, rollo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto principal (cuadros del rollo). |
| `src2` | image | `""` | Foto alternada en el rollo / tira lateral. |
| `src3` | image | `""` | Foto de la tira lateral (si falta, src2). |
| `year` | string | `""` | Número GIGANTE naranja (año, fecha, cifra: '1989', '28', '23:30'). |
| `title` | string | `""` | Titular en mayúsculas crema ('\n' parte renglones). |
| `sub` | string | `""` | Subtítulo chico con barra roja delante. |
| `kicker` | string | `""` | Rótulo mínimo arriba del titular (opcional). |
| `layout` | enum (under / over) | `"under"` | under = titular debajo del año (1930); over = titular arriba del año (1940). |
| `color` | enum (orange / red) | `"orange"` | Color del número: naranja (#c9501f) o rojo (#c4352a). |
| `pos` | enum (center / left / right / topLeft / topRight / bottomLeft / bottomRight / bigLeft / bigRight) | `"right"` | Posición del bloque. bigLeft/bigRight = gigante y cortado por el borde. |
| `size` | number [0.12–1.2] | `0.3` | Ancho del número como fracción del ancho del cuadro (en 9:16 se agranda solo). |
| `textIn` | enum (drop / rise / glitch / flash / fade / none) | `"flash"` | Entrada del bloque: drop (cae desde arriba con estela), rise (sube), glitch, flash (aparece tras el destello), fade. |
| `textAt` | number | `0.45` | Segundos desde el inicio del plano hasta que entra el bloque. |
| `glitches` | array | `[]` | Segundos (desde el inicio del plano) donde el bloque hace glitch de franjas 0.3 s. |
| `drift` | enum (left / right / up / none) | `"left"` | Deriva lenta del bloque después de entrar (se frena en ~3 s). |
| `speed` | number [0–0.4] | `0.05` | Velocidad del rollo (fracción del alto por segundo). |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"whipUp"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"none"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.reel", "params": {"src": "assets/media/nota.jpg", "src2": "assets/media/schabowski.jpg", "title": "LA NOTA", "sub": "9 DE NOVIEMBRE DE 1989"}}
```

### `pelicula.quote`

Frase narrada en titular grande (ref 15.5–17 s, el punch de 'NO PLUGINS REQUIRED'): las palabras dichas dentro del plano caen en mayúsculas crema erosionadas justo cuando la voz las dice; 'accent' las pinta naranja; número gigante opcional detrás y subtítulo con barra roja.

Etiquetas: frase, cita, impacto, letra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `src2` | image | `""` | Foto en doble exposición (opcional). |
| `accent` | array | `[]` | Palabras en naranja (sin importar tildes/mayúsculas). |
| `ghost` | string | `""` | Número gigante naranja detrás de la frase (opcional). |
| `sub` | string | `""` | Subtítulo con barra roja debajo (opcional). |
| `strips` | enum (frame / top / bottom / double / side / none) | `"side"` | Perforaciones (ver pelicula.year). |
| `camera` | enum (in / out / left / right / rise / fall / still) | `"in"` | Movimiento de cámara. |
| `size` | number [0.3–1] | `0.8` | Ancho máximo del renglón más largo (fracción del ancho). |
| `maxChars` | number | `0` | Caracteres por renglón (0 = 17 en 16:9, 11 en 9:16). |
| `enter` | enum (cut / whip / whipR / whipUp / whipDown / zoom / focus / glitch / fade) | `"cut"` | Entrada del plano: barrido (whip/whipR/whipUp/whipDown) con motion blur, zoom radial, foco, glitch de franjas, fundido o corte. |
| `exit` | enum (none / whip / whipR / whipUp / whipDown / zoom) | `"none"` | Salida en los últimos 0.3 s (barrido/zoom). Combinada con la entrada del plano siguiente arma el 'whip pan' completo. |
| `leak` | enum (none / burn / prism / flash / bar) | `"prism"` | Destello al entrar: burn (naranja→blanco, tapa el corte), prism (banda rojo-blanco-verde), flash, bar (barra de luz). |
| `leakDir` | enum (ltr / rtl) | `"ltr"` | Dirección del destello. |
| `flush` | bool | `false` | Rubor rojo-marrón en el último segundo del plano (como antes de varios cortes de la referencia). |

```json
{"use": "pelicula.quote", "params": {"src": "assets/media/schabowski.jpg", "accent": ["inmediato"], "ghost": "1989"}}
```

### `pelicula.leak`

Destello de película (light leak) que tapa un corte: burn (naranja→ámbar→blanco desde un costado, ref 13.1/24.3/31.8/45.9/55.7 s), prism (banda rojo-blanco-verde que cruza, ref 3.1/15.2/37.4/49.3 s), flash (golpe blanco cálido, ref 20.6/27.1 s) o bar (barra de luz, ref 4.3 s). Dura lo que dure el beat ('dur').

Etiquetas: transición, luz, destello, corte · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `kind` | enum (burn / prism / flash / bar) | `"burn"` | Tipo de destello. |
| `dir` | enum (ltr / rtl) | `"ltr"` | Desde qué costado entra. |
| `strength` | number [0–1.3] | `1` | Intensidad. |

```json
{"use": "pelicula.leak", "params": {"kind": "burn", "dir": "ltr"}}
```

### `pelicula.glitch`

Glitch de franjas de TODO el cuadro (foto + texto): bandas horizontales desplazadas y duplicadas que cambian cada cuadro (ref 32.7–33.2, 45.3, 50.6, 55.0 s). Duración = 'dur' del beat (0.2–0.5 s).

Etiquetas: transición, glitch, golpe · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `strength` | number [0–2] | `1` | Desplazamiento de las franjas. |
| `flicker` | number [0–1] | `0.75` | Fracción de cuadros con glitch (el resto, limpio). |

```json
{"use": "pelicula.glitch", "params": {"strength": 1}}
```

### `pelicula.introv1`

GANCHO de apertura (lo primero que se ve). Arranca con la cuenta regresiva del líder de película (3-2-1, aguja que barre) y un destello; después un titular GIGANTE que entra palabra por palabra con barrido y estela (motion blur), golpea con sacudida y glitch de franjas ('^palabra^' en naranja con barra roja). Impacto (burnAt): la película se traba en la ventanilla y se QUEMA (agujero incandescente) → destello naranja→blanco. Fondo adaptable (bg: strips | projector | reel | leader | image con src | component con use/useParams | none). Sale con barrido.

Etiquetas: intro, gancho, apertura, título, impacto, cuenta regresiva · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en naranja con barra roja (un signo pegado no se separa: '^MURO^?'). |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha), con barra roja. |
| `sub` | string | `""` | Línea chica debajo del titular, con barra roja. |
| `countdown` | number [0–3] | `0.9` | Segundos de la cuenta regresiva 3-2-1 del líder al empezar (0 = sin cuenta). |
| `wordAt` | number | `1` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.28` | Segundos entre palabra y palabra. |
| `burnAt` | number | `2.9` | Impacto: segundo en que la película se traba y se quema (acepta '@palabra'; −1 = sin quemado). |
| `bg` | enum (auto / strips / projector / reel / leader / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: strips, projector, reel, leader; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "pelicula.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "burnAt": 2.9}}
```

### `pelicula.introv2`

GANCHO tipo intertítulo de cine mudo. Se abre el iris; la pregunta gigante se EXPONE letra por letra (cada letra destella al aparecer) entre filetes dobles con rombo, y la respuesta llega en una TIRA DE PELÍCULA que cruza con barrido y estela, golpea con sacudida y destello, y queda atravesada (p. ej. 'NADIE DIO LA ORDEN'). Fondo adaptable (bg: projector | strips | reel | leader | image con src | component con use/useParams | none). Sale cerrando el iris.

Etiquetas: intro, gancho, apertura, pregunta, intertítulo, cine mudo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba, con barra roja. |
| `stamp` | string | `""` | Respuesta que llega en la tira de película (vacío = sin tira). |
| `stampAt` | number | `2.5` | Segundo en que entra la tira (acepta '@palabra'). |
| `typeAt` | number | `0.45` | Segundo en que empieza a exponerse la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo. |
| `bg` | enum (auto / strips / projector / reel / leader / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: strips, projector, reel, leader; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "pelicula.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Archivo · Berlín 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.5}}
```

### `pelicula.outro`

Cierre del canal SIN recuadro (bg: projector | strips | reel | leader | image con src | component con use/useParams). Por defecto sala oscura con el haz del proyector, polvo flotando y rollos girando. GRACIAS POR VER → nombre del canal GIGANTE naranja que cae con estela, hace glitch y se asienta sobre la barra roja (con quemado de luz) → cuadro de película LIKE que se expone en naranja y se marca con lápiz graso rojo → flecha a lápiz graso → tira roja SUSCRÍBETE que entra con barrido + campana que suena → mensaje de apoyo expuesto letra a letra → youtube.com/@canal. Fundido a negro al final. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, proyector · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte la historia."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / projector / strips / reel / leader / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: projector, strips, reel, leader; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "pelicula.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "ARCHIVO 35", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir rescatando historias.", "handle": "youtube.com/@archivo35"}}
```

## periodico · TITULARES

### `periodico.title`

Apertura sobre el periódico: negro → papel desenfocado → rack focus y la cámara se aleja de un título ENORME cuyas letras se aleatorizan hasta asentarse (typewriter), con subtítulo chico, icono ⊠, columna de texto al costado y recuadro negro cortado. Si es el primer plano hace la intro completa; si no, llega con latigazo.

Etiquetas: apertura, título, portada · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Título ('\n' parte renglones). |
| `titlePortrait` | string | `""` | Título para 9:16 (si hace falta otro corte de renglones). |
| `sub` | string | `""` | Subtítulo chico debajo (typewriter). |
| `aside` | bool | `true` | Columna de texto chico a la derecha del título (solo 16:9). |
| `box` | bool | `true` | Recuadro de contorno negro cortado abajo a la izquierda. |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.title", "params": {"title": "LA NOCHE QUE CAYÓ EL MURO", "sub": "Berlín · 9 nov 1989"}}
```

### `periodico.headline`

Título typewriter sobre el papel, sin foto. style: plain = título + subtítulo centrados con ⊠; bracket = escuadra ⌐ negra arriba-izquierda, el título entra deslizándose y ⊠ grande al lado ('Newspaper / slideshow'); corner = escuadra L negra abajo-izquierda con subtítulo en itálica ('Elegant / Clean Design'). Letras con scramble. Sirve para fechas, cifras y frases cortas.

Etiquetas: título, texto, capítulo, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Título (corto). |
| `sub` | string | `""` | Subtítulo. |
| `style` | enum (plain / bracket / corner) | `"bracket"` | Variante de la referencia. |
| `year` | string | `""` | Número/año decorativo cuyos dígitos titilan antes de asentarse. |
| `icon` | bool | `true` | Mostrar ⊠. |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.headline", "params": {"title": "Un papel", "sub": "leído en voz alta", "style": "bracket"}}
```

### `periodico.article`

Artículo: título typewriter con scramble + regla negra gruesa que se traza + párrafo que se escribe letra a letra ('Exclusive' de la referencia). size=big: título enorme, la cámara se acerca y la profundidad de campo se achica (párrafo desenfocado). Foto chica opcional cortada a la izquierda.

Etiquetas: texto, explicación, cifra, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Título (corto: cifra, fecha o palabra). |
| `sub` | string | `""` | Bajada (normal: itálica chica; big: typewriter bajo el título). |
| `body` | string | `""` | Párrafo que se escribe letra a letra. |
| `size` | enum (normal / big) | `"normal"` | normal o big (más cerca, título enorme). |
| `src` | image | `""` | Foto chica opcional a la izquierda (cortada por el borde). |
| `icon` | bool | `true` | Mostrar ⊠. |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.article", "params": {"title": "28 años", "sub": "una ciudad partida en dos", "body": "Berlín estuvo partida en dos. Una frontera de hormigón cruzaba calles, plazas y familias."}}
```

### `periodico.photo`

Foto B/N con marco negro fino (borde de foto impresa) y sombra, apoyada en el periódico, con título typewriter + barra negra con subtítulo blanco ('Stylish / headlines'). layout elige dónde va el rótulo (left/right/topright/topleft/bottomright/bottomleft); año opcional cuyos dígitos titilan; ⊠ en una esquina. Llega con latigazo de cámara.

Etiquetas: foto, persona, lugar, documento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto (jpg/png local). |
| `title` | string | `""` | Título (1–2 palabras). |
| `sub` | string | `""` | Subtítulo en la barra negra. |
| `layout` | enum (left / right / topright / topleft / bottomright / bottomleft) | `"left"` | Dónde va el rótulo respecto de la foto. |
| `year` | string | `""` | Año / número decorativo (dígitos que titilan). |
| `icon` | bool | `true` | Mostrar ⊠. |
| `ar` | number | `0` | Proporción del recorte (0 = 1.5 en 16:9, 1.2 en 9:16). |
| `size` | number [0.3–0.8] | `0.55` | Ancho de la foto (fracción del ancho en 16:9). |
| `focus` | array | `[0.5, 0.45]` | Punto [x,y] 0..1 del recorte. |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.photo", "params": {"src": "assets/media/mauerbau.jpg", "title": "Agosto", "sub": "se levanta el muro", "layout": "topright", "year": "1961"}}
```

### `periodico.collage`

Varias fotos y recortes de periódico en capas a distinta profundidad (paralaje y desenfoque) con rótulo de barra negra. layout: history = foto grande a la derecha + foto y recortes detrás ('History / opener'); modular = tres fotos superpuestas ('Modular / structure'); plugins = foto + foto desenfocada + recuadro + caja negra con texto blanco ('No Plugins / Required').

Etiquetas: foto, collage, multitud, contexto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto principal. |
| `src2` | image | `""` | Segunda foto. |
| `src3` | image | `""` | Tercera foto (modular / history). |
| `title` | string | `""` | Título. |
| `sub` | string | `""` | Subtítulo (barra negra; en plugins va debajo del título). |
| `note` | string | `""` | plugins: texto blanco sobre la caja negra (2–3 renglones). |
| `layout` | enum (history / modular / plugins) | `"history"` | Composición. |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.collage", "params": {"src": "assets/media/muro-gente.jpg", "src2": "assets/media/leipzig.jpg", "title": "Miles", "sub": "salieron a la calle", "layout": "history"}}
```

### `periodico.quote`

La frase narrada en typewriter grande sobre el papel: cada palabra aparece cuando la voz la dice, con sus letras aleatorizándose hasta asentarse; las palabras de `accent` van en blanco sobre barra negra (como los subtítulos de la referencia). Regla negra que crece debajo y ⊠. Oculta los subtítulos.

Etiquetas: frase, cita, impacto, clímax · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `accent` | array | `[]` | Palabras (sin tildes/mayúsculas importa) en barra negra. |
| `maxChars` | number | `0` | Caracteres por renglón (0 = auto: 13 en 9:16, 20 en 16:9). |
| `move` | enum (auto / whip / glide / cut / intro) | `"auto"` | Cómo llega la cámara a este plano: whip = latigazo con desenfoque de movimiento; glide = paneo suave; cut = corte; intro = rack focus de apertura (auto = whip, o el propio del componente). |
| `dir` | enum (auto / up / down / left / right / upleft / upright / downleft / downright) | `"auto"` | Hacia dónde viaja la cámara para llegar (auto = patrón de la referencia). |

```json
{"use": "periodico.quote", "params": {"accent": ["inmediato"]}}
```

### `periodico.introv1`

GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: press | spin | desk | stand | image con src | component con use/useParams | none); por defecto la ROTATIVA: el papel del diario corre entre dos rodillos con desenfoque de movimiento y frena en seco. Un titular GIGANTE a máquina golpea palabra por palabra (letras que se aleatorizan, estela y sacudida; '^palabra^' va en blanco sobre barra negra). En extraAt golpea un sello magenta «EXTRA». Sale con latigazo hacia el primer plano del periódico.

Etiquetas: intro, gancho, apertura, título, portada, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en blanco sobre barra negra. |
| `kicker` | string | `""` | Rótulo chico arriba entre corchetes (lugar · fecha). |
| `sub` | string | `""` | Línea chica debajo del titular (barra negra con texto blanco). |
| `extra` | string | `"EXTRA"` | Texto del sello de impacto (vacío = sin sello). |
| `extraAt` | number | `2.3` | Momento de impacto: la rotativa frena en seco y golpea el sello (-1 = sin impacto; acepta '@palabra'). |
| `wordAt` | number | `0.45` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabra y palabra. |
| `bg` | enum (auto / press / spin / desk / stand / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: press, spin, desk, stand; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "periodico.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "extraAt": 2.3}}
```

### `periodico.introv2`

GANCHO pregunta + revelación. Fondo adaptable al tema (bg: spin | press | desk | stand | image con src | component con use/useParams | none); por defecto una PORTADA DE DIARIO que viene girando hacia la cámara, se detiene y se desenfoca (rack focus). La pregunta gigante se TIPEA a máquina letra a letra (golpe de tipo, tinta irregular, carro) y la respuesta llega como RECORTE de diario con titular a toda página que golpea encima, más un sello magenta EXTRA.

Etiquetas: intro, gancho, apertura, pregunta, portada, recorte · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba entre corchetes. |
| `stamp` | string | `""` | Respuesta: titular del recorte que golpea (vacío = sin recorte). |
| `stampAt` | number | `2.6` | Segundo del recorte (acepta '@palabra'). |
| `typeAt` | number | `0.6` | Segundo en que empieza a tipearse la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo del tipeo. |
| `extra` | string | `"EXTRA"` | Sello magenta sobre el recorte (vacío = sin sello). |
| `bg` | enum (auto / spin / press / desk / stand / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: spin, press, desk, stand; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "periodico.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.6}}
```

### `periodico.outro`

Cierre del canal SIN recuadro (bg: stand | desk | press | spin | image con src | component con use/useParams | none): por defecto la cámara llega con un latigazo a una pared de PORTADAS de diario que se desliza. [GRACIAS POR VER] entre corchetes → nombre del canal como CABECERA de diario gigante (letras que se aleatorizan y asientan, filetes dobles que se trazan) → LIKE con casilla ⊠ que se tacha y barra negra que se llena → flecha de tinta → barra negra SUSCRÍBETE que golpea + campana grabada que suena → mensaje de apoyo tipeado → [youtube.com/@canal]. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, portada · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / stand / desk / press / spin / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: stand, desk, press, spin; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "periodico.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODETECH", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@nodetech"}}
```

## pop · DUOTONO

### `pop.logo`

Apertura de marca (ref. 44,9 s): la marca del canal escala desde 0, un arco fino se dibuja antihorario, la marca parpadea en rosa, un anillo de trazos rotos gira y se cierra en un círculo fino; al final el círculo se borra. Kicker chico opcional debajo.

Etiquetas: intro, marca, transición · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mark` | string | `""` | Monograma (1–2 letras). Vacío = gota geométrica del canal. |
| `kicker` | string | `""` | Rótulo chico (Archivo extendida) debajo del círculo; vacío = nada. |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.logo", "params": {"mark": "", "kicker": "BERLÍN · 9 NOV 1989"}}
```

### `pop.kaleido`

Objeto 3D orgánico (blob relleno con la foto en duotono, sombreado, con esquirlas) con rótulo '/RUTA/TIPO' (ref. 46,4 s); en `split` se parte en un CALEIDOSCOPIO hexagonal con 6 copias, rótulos rotados y bordes violeta gruesos, y aparece un marco violeta (ref. 46,95 s).

Etiquetas: intro, objeto, foto, caleidoscopio · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image | `""` | Foto que rellena el objeto (vacío = violeta sombreado). |
| `label` | string | `"/DESIGN/BW"` | Rótulo chico arriba a la izquierda del objeto. |
| `tag` | string | `""` | Rótulo que se repite rotado en el caleidoscopio (vacío = primera parte de label). |
| `split` | number | `0.55` | Segundos hasta partir en caleidoscopio (<0 = nunca). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.kaleido", "params": {"src": "assets/media/mauerspecht.jpg", "label": "/BERLÍN/1989", "tag": "/MURO"}}
```

### `pop.kanji`

Texto diagonal isométrico (ref. 49,85 s): renglón grande (japonés u otro) + subrenglón chico, rotado −28°, chico en el centro sobre menta; en `split` pasa a GRANDE sobre una foto cortada por un triángulo menta, con el texto que cambia de color según la región (menta sobre foto, violeta sobre menta) y deriva en diagonal (ref. 50,4 s). Esquina superior derecha: 4 renglones chicos que se escriben.

Etiquetas: texto, diagonal, foto, japonés, título · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `big` | string | `"時者埼"` | Renglón grande (japonés/chino en Noto Sans JP; latín en Archivo extendida). |
| `sub` | string | `"RANDOM PHRASE"` | Subrenglón chico debajo. |
| `src` | image | `""` | Foto de la fase grande (vacío = siempre fase chica). |
| `split` | number | `0.55` | Segundos hasta la fase grande sobre la foto (0 = empieza grande). |
| `corner` | array | `["STD.", "TRA", "NSM", "AXX"]` | Renglones chicos de la esquina superior derecha (el 1º en violeta). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.kanji", "params": {"big": "ベルリンの壁", "sub": "BERLIN WALL · 1961", "src": "assets/media/bornholmer.jpg", "corner": ["9 NOV", "19", "89", "DDR"]}}
```

### `pop.word`

Palabra GIGANTE menta sobre foto a sangre en duotono oscuro con zoom lento (ref. 47,55 'BLACK'): entra creciendo 0,75→1 y deslizando a la izquierda en 5 cuadros; repetición chica glitcheada abajo a la derecha y '=' abajo a la izquierda.

Etiquetas: texto, foto, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra o frase corta (1 renglón). |
| `small` | string | `""` | Repetición chica abajo a la derecha (vacío = el mismo texto). |
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `tone` | enum (dark / normal / light / inv) | `"dark"` | Duotono: dark = domina el violeta (como la referencia). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.word", "params": {"text": "28 AÑOS", "src": "assets/media/mauerbau.jpg"}}
```

### `pop.hatch`

Palabra gigante menta sobre foto violeta (ref. 49,35 'FOREVER'): entra con glitch de bloques y 6 cuadros de parpadeo de paleta con letras que faltan; algunas letras quedan RAYADAS en diagonal, '★★★' y tiras glitch de la palabra estiradas arriba.

Etiquetas: texto, foto, glitch, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra (1 renglón, ideal 4–9 letras). |
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `hatch` | array | `[]` | Índices de letras rayadas (vacío = automático: 2ª y antepenúltima). |
| `stars` | bool | `true` | Dibuja '★★★' sobre la penúltima letra. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"flicker"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.hatch", "params": {"text": "1961", "src": "assets/media/mauerbau.jpg", "hatch": [1, 3]}}
```

### `pop.stack`

Renglones apilados menta en grotesca extendida sobre foto (ref. 50,98 'NEW WAY TO PROMOTE'): entra con cortina líquida violeta, cada renglón aparece aplastado y se asienta (uno cada 2 cuadros, o cuando la voz dice la palabra si text está vacío), cruz violeta + flecha-pentágono menta que crecen; en `phase2` re-encuadre más grande con eco en contorno, tira glitch, círculo con cruz y chevrones rosas (ref. 51,45).

Etiquetas: texto, foto, título, letra, clímax · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Renglones con '\n'. Vacío = modo LETRA: las palabras narradas en el beat aparecen al decirse (páginas de 4 renglones). |
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `tone` | enum (dark / normal / light / inv) | `"dark"` | Duotono de la foto (dark = domina el violeta: el texto menta se lee). |
| `shapes` | bool | `true` | Cruz violeta + flecha-pentágono menta a la derecha. |
| `phase2` | number | `-1` | Segundos hasta el re-encuadre grande (<0 = nunca). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"liquid"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.stack", "params": {"text": "LA NOCHE\nQUE CAYÓ\nEL MURO", "src": "assets/media/muro-gente.jpg"}}
```

### `pop.letters`

2–3 letras/cifras GIGANTES (ref. 53,05 'OE'): la 1ª rellena con la foto en duotono, la 2ª con ondas op-art que se deforman, bordes suaves y deriva lenta; etiqueta paralelogramo violeta que entra con borde dentado (sierra) con texto menta; marca chica abajo-izq. y línea punteada arriba-izq.

Etiquetas: texto, foto, op-art, cifra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | 2–3 caracteres (letras o cifras). |
| `src` | image · obligatorio | `null` | Foto que rellena la 1ª letra. |
| `tag` | string | `""` | Texto de la etiqueta violeta (\n = 2 renglones; vacío = sin etiqueta). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.letters", "params": {"text": "89", "src": "assets/media/muro-gente.jpg", "tag": "LA NOCHE QUE\nCAMBIÓ TODO"}}
```

### `pop.band`

Texto grande que pasa de negro a foto (ref. 53,59 '2 COLOURS'): cuadro negro con el texto menta → cae una banda de rayas diagonales → la foto se abre como banda hacia abajo (doble exposición desplazada con costura negra) mientras el texto parpadea rosa/menta y las rayas se afinan.

Etiquetas: texto, foto, transición, cifra · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto (1 renglón). |
| `src` | image · obligatorio | `null` | Foto de la banda. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.band", "params": {"text": "140 VIDAS", "src": "assets/media/mauerbau.jpg"}}
```

### `pop.arrow`

Flecha gruesa que entra desde la izquierda en 4 cuadros parpadeando violeta→rosa→gris→rosa→violeta, con un rótulo de 1–2 renglones que se DECODIFICA letra por letra (ref. 54,12 'NEXT GENERATION').

Etiquetas: flecha, texto, consecuencia, transición · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Rótulo (\n = 2 renglones). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.arrow", "params": {"text": "AL DÍA\nSIGUIENTE"}}
```

### `pop.minimal`

Texto mínimo y aireado sobre gris claro (ref. 63,5 'USE ANY MEDIA / PHOTOS OR VIDEO'): kicker diminuto muy espaciado + línea en Montserrat espaciada que aparece letra a letra; o variante 'small' (ref. 21 s, 'YOU CAN SET ANY COLORS') de una línea chica con las primeras palabras en rosa.

Etiquetas: texto, pausa, dato, cierre · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Línea principal. |
| `kicker` | string | `""` | Línea diminuta arriba (solo style=spaced). |
| `style` | enum (spaced / small) | `"spaced"` | spaced = Montserrat muy espaciada · small = una línea chica Archivo extendida. |
| `accent` | number | `2` | style=small: cuántas palabras iniciales van en rosa. |
| `bg` | enum (paper / mint) | `"paper"` | Fondo gris claro (paper) o menta. |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.minimal", "params": {"kicker": "9 DE NOVIEMBRE", "text": "BERLÍN · 1989"}}
```

### `pop.title`

Título de apertura en 3 tiempos como el comienzo de la referencia: marca del canal con círculo fino que se dibuja (+ kicker), objeto 3D con la foto que se parte en caleidoscopio (opcional, si hay `object`) y el TÍTULO en renglones apilados menta sobre la foto con cortina líquida, cruz y flecha (re-encuadre en `phase2`).

Etiquetas: intro, título, gancho · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título; '\n' parte renglones (2–4 renglones cortos). |
| `src` | image · obligatorio | `null` | Foto de fondo del título. |
| `kicker` | string | `""` | Rótulo chico bajo el círculo de la marca. |
| `mark` | string | `""` | Monograma de la marca (vacío = gota del canal). |
| `object` | image | `""` | Foto del objeto/caleidoscopio (vacío = se salta esa parte). |
| `label` | string | `""` | Rótulo '/RUTA/TIPO' del objeto. |
| `intro` | number | `1.7` | Segundos de la marca con círculo. |
| `objectDur` | number | `1.5` | Segundos del objeto/caleidoscopio. |
| `phase2` | number | `1.6` | Segundos (desde que aparece el título) hasta el re-encuadre grande (<0 = nunca). |
| `focus` | array | `[0.5, 0.5]` | Foco de la foto del título [x,y]. |

```json
{"use": "pop.title", "params": {"text": "LA NOCHE\nQUE CAYÓ\nEL MURO", "src": "assets/media/muro-gente.jpg", "kicker": "BERLÍN · 9 NOV 1989", "object": "assets/media/mauerspecht.jpg", "label": "/BERLÍN/1989"}}
```

### `pop.circles`

Dos círculos con la MISMA foto en duotono que crecen desde 0 (el izquierdo primero) y una palabra violeta gigante encima cuya interletra se abre, con letras que faltan al entrar y una letra que parpadea rosa; barra menta, '× × ×' uno por uno y escuadra (ref. 48,1 'STYLE').

Etiquetas: foto, texto, persona, lugar · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra (ideal 4–7 letras). |
| `src` | image · obligatorio | `null` | Foto (se ve a través de los dos círculos). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.circles", "params": {"text": "ESTE", "src": "assets/media/leipzig.jpg"}}
```

### `pop.stripes`

Caja de marco fino con la foto lavada y RAYAS diagonales violeta que entran gruesas y se afinan hasta pelos; palabra violeta con eco rosa desplazado (letras que faltan), '|||' antes, flechas ↑↓; todo el grupo se desliza a la izquierda (ref. 48,65 'STYLE' en caja).

Etiquetas: foto, texto, documento · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra corta. |
| `src` | image · obligatorio | `null` | Foto dentro de la caja. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.stripes", "params": {"text": "LA NOTA", "src": "assets/media/nota.jpg"}}
```

### `pop.split`

Tríptico (ref. 51,95 'STRONG'): columna con 2 fotos chicas entre bandas rayadas, panel menta con letras GIGANTES en contorno fino que se dibujan y la palabra con letras en ola que rebotan al entrar, foto grande a la derecha que se desliza a la izquierda con rótulo menta glitcheado.

Etiquetas: foto, persona, texto, collage · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra (ideal 5–8 letras). |
| `src` | image · obligatorio | `null` | Foto grande (derecha / abajo). |
| `src2` | image | `""` | Foto de las 2 chicas (vacío = la misma). |
| `tag` | string | `""` | Rótulo menta sobre la foto grande. |
| `outline` | string | `""` | Letras gigantes en contorno (vacío = 2 primeras de text). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.split", "params": {"text": "VOCERO", "src": "assets/media/schabowski.jpg", "tag": "GÜNTER SCHABOWSKI · SED"}}
```

### `pop.frame`

Foto muy desenfocada que se enfoca; un marco paralelogramo menta GRUESO rota (−35°→0), crece y se afina hasta ser un marco rectangular fino con esquinas en triángulo; título menta con ecos en contorno que se abren a los lados (ref. 52,52 'THE POWER').

Etiquetas: foto, texto, título, lugar · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título (1 renglón). |
| `sub` | string | `""` | Línea chica debajo. |
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.frame", "params": {"text": "BORNHOLMER STRASSE", "src": "assets/media/bornholmer.jpg", "sub": "PASO FRONTERIZO · BERLÍN"}}
```

### `pop.duo`

Dos círculos-foto enormes en los bordes que crecen, flecha gruesa al centro, '×' rosa, flechitas, rótulo de 2 renglones y línea superior con texto mínimo (ref. 54,75 'NEXT GENERATION'). Entra con esquirlas.

Etiquetas: foto, comparación, consecuencia, multitud · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto del círculo derecho (grande). |
| `src2` | image | `""` | Foto del círculo izquierdo (vacío = la misma). |
| `text` | string | `""` | Rótulo (\n = 2 renglones). |
| `kicker` | string | `""` | Texto mínimo bajo la línea superior. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"shards"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.duo", "params": {"src": "assets/media/bornholmer.jpg", "src2": "assets/media/leipzig.jpg", "text": "MILES\nDE PERSONAS", "kicker": "9 NOV 1989 · 23:30"}}
```

### `pop.posters`

Columnas verticales de foto (ref. 55,26 'NICE / POSTERS'): una columna entra barriendo desde la derecha en 2 cuadros y deriva; en `p2` aparece la 2ª columna y la cámara panea; en `p3` todo se aleja al 35 % con regla y texto mínimo debajo. Arcos grises gruesos que giran y triángulo ◄.

Etiquetas: foto, texto, collage, lugar · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de la 1ª columna. |
| `text` | string | `""` | Palabra de la 1ª columna. |
| `src2` | image | `""` | Foto de la 2ª columna (vacío = la misma con otro encuadre). |
| `text2` | string | `""` | Palabra de la 2ª columna. |
| `caption` | string | `""` | Texto mínimo bajo la regla (fase alejada). |
| `p2` | number | `0.55` | Segundos hasta la 2ª columna. |
| `p3` | number | `1.1` | Segundos hasta el alejamiento (<0 = nunca). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.posters", "params": {"src": "assets/media/muro-gente.jpg", "text": "BERLÍN", "src2": "assets/media/mauerspecht.jpg", "text2": "ESTE", "caption": "LAS DOS MITADES DE UNA CIUDAD"}}
```

### `pop.triangle`

Un triángulo ◄ chico crece en 4 cuadros hasta un TRIÁNGULO grande con foto a la izquierda (ref. 56,85), junto a las columnas alejadas, la regla con texto mínimo y los arcos grises que giran.

Etiquetas: foto, persona, transición · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto del triángulo. |
| `src2` | image | `""` | Foto de las columnas chicas (vacío = la misma). |
| `text` | string | `""` | Palabra en la columna chica. |
| `caption` | string | `""` | Texto mínimo bajo la regla. |
| `tone` | enum (dark / normal / light / inv) | `"normal"` | Duotono del triángulo (fotos muy claras: dark). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.triangle", "params": {"src": "assets/media/schabowski.jpg", "src2": "assets/media/nota.jpg", "text": "PRENSA", "caption": "CONFERENCIA · 18:00"}}
```

### `pop.book`

Libro 3D isométrico sobre menta apagada (ref. 57,4 s): tapa violeta con la foto en duotono que se desplaza y el título en renglones menta, lomo violeta, cantos rosa, sombra rosada difusa; deriva y se achica lento; en `swapAt` la tapa cambia a la marca del canal.

Etiquetas: objeto, documento, foto, libro, historia · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de la tapa. |
| `title` | string | `""` | Título de la tapa (\n = renglones, 2–5 cortos). |
| `note` | string | `""` | Texto mínimo de la tapa. |
| `swapAt` | number | `-1` | Segundos hasta que la tapa cambia a la marca (<0 = nunca). |
| `mark` | string | `""` | Monograma para la tapa final (vacío = gota del canal). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.book", "params": {"src": "assets/media/nota.jpg", "title": "LA NOTA\nDE SCHA-\nBOWSKI", "note": "9 NOV 1989 · 18:53"}}
```

### `pop.tiles`

Marca menta grande sobre violeta (ref. 60,16) que corta a un MOSAICO de cuadrados violeta con la marca, filas desfasadas que se deslizan y parpadean de brillo (ref. 60,6).

Etiquetas: marca, transición, patrón · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `mark` | string | `""` | Monograma (vacío = gota del canal). |
| `solo` | number | `0.25` | Segundos de la marca sola sobre violeta antes del mosaico. |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.tiles", "params": {"mark": ""}}
```

### `pop.name`

Texto chico centrado sobre menta (ref. 61,2 'ENVATO.COM' → nombre del canal/lugar): aparece, pasa por 3 cuadros de itálica con letras que se decodifican, se achica al final y se apaga parpadeando a gris.

Etiquetas: marca, texto, dato, cierre · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto (1 renglón corto). |
| `sub` | string | `""` | Línea mínima debajo. |
| `size` | number [0.02–0.12] | `0.045` | Alto de letra (fracción del lado corto). |
| `fx` | enum (cut / glitch / flicker / shards / liquid) | `"cut"` | Entrada del plano (la transición de la referencia): cut = corte seco · glitch = bloques sobre negro · flicker = glitch + parpadeo de paleta · shards = esquirlas violeta/menta · liquid = cortina líquida violeta. |

```json
{"use": "pop.name", "params": {"text": "BERLÍN · 9.11.1989", "sub": ""}}
```

### `pop.glitch`

Glitch de transición encima de cualquier plano (capa overlay): bloques desplazados sobre negro, parpadeo de paleta o esquirlas (ref. 49,25 · 54,65). Usar con 'dur' corto (0,15–0,35 s).

Etiquetas: transición, glitch, golpe · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `kind` | enum (glitch / flicker / shards / liquid) | `"glitch"` | Tipo (ver fx). |

```json
{"use": "pop.glitch", "params": {"kind": "glitch"}}
```

### `pop.introv1`

GANCHO de apertura (lo primero que se ve). Titular GIGANTE apilado en tiras violeta que golpea palabra por palabra: cada palabra entra APLASTADA en rosa, se rebana en bloques glitch y se asienta en menta con sacudida; la '^palabra^' va en caja menta con op-art animado (o la foto en duotono) DENTRO de las letras. En glitchAt el cuadro se rompe en bloques + parpadeo de paleta, salta la sombra rosa de las tiras y salen anillos. Fondo adaptable (bg: columns | opart | shapes | kanji | tiles | image con src | component con use/useParams); por defecto columnas de mosaicos que se deslizan.

Etiquetas: intro, gancho, apertura, título, impacto, glitch · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho, corto (2–6 palabras). '\n' = renglón; '^x^' = palabra destacada (caja menta con op-art/foto dentro de las letras). |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha), se decodifica. |
| `sub` | string | `""` | Línea chica debajo del titular (placa menta). |
| `wordAt` | number | `0.4` | Segundo del primer golpe de palabra. |
| `stagger` | number [0.08–None] | `0.28` | Segundos entre palabra y palabra. |
| `glitchAt` | number | `2.3` | Segundo del IMPACTO: glitch de bloques + parpadeo de paleta, sombra rosa y anillos (-1 = sin impacto). Acepta '@palabra'. |
| `bg` | enum (auto / columns / opart / shapes / kanji / tiles / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: columns, opart, shapes, kanji, tiles; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "pop.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "glitchAt": 2.3}}
```

### `pop.introv2`

GANCHO pregunta + revelación. Una cortina líquida violeta baja y la pregunta GIGANTE se DECODIFICA letra por letra (letras al azar en rosa que se resuelven en menta, con cursor); en stampAt la respuesta golpea como CINTA menta inclinada con glitch de bloques, sombra rosa, flecha gruesa que entra parpadeando y anillos; la pregunta pierde letras un instante. Fondo adaptable (bg: opart | columns | shapes | kanji | tiles | image con src | component con use/useParams); por defecto ondas op-art del duotono.

Etiquetas: intro, gancho, apertura, pregunta, revelación, cinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `stamp` | string | `""` | Respuesta que golpea en la cinta (vacío = sin cinta). |
| `stampAt` | number | `2.4` | Segundo de la cinta (acepta '@palabra'). |
| `typeAt` | number | `0.45` | Segundo en que empieza a decodificarse la pregunta. |
| `cps` | number [4–None] | `18` | Letras por segundo. |
| `bg` | enum (auto / columns / opart / shapes / kanji / tiles / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: columns, opart, shapes, kanji, tiles; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "pop.introv2", "params": {"text": "¿QUIÉN ABRIÓ\nEL MURO?", "kicker": "Berlín · 1989", "stamp": "NADIE DIO LA ORDEN", "stampAt": 2.4}}
```

### `pop.outro`

Cierre del canal SIN recuadro, en lenguaje DUOTONO (bg: tiles | columns | opart | shapes | kanji | image con src | component con use/useParams; por defecto mosaico de marcas del canal que se desliza). GRACIAS POR VER que se decodifica → nombre del canal GIGANTE en tira violeta con letras que caen aplastadas en rosa y se asientan en menta → botón LIKE menta que se PRESIONA (se hunde en su sombra, se invierte y estalla en cruces) → flecha gruesa que crece parpadeando → placa rosa SUSCRÍBETE que golpea + campana que suena → apoyo en tira violeta → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, mosaico · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODETECH"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodetech"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / tiles / columns / opart / shapes / kanji / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: tiles, columns, opart, shapes, kanji; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente (el cierre tiene mucho texto). |

```json
{"use": "pop.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "DUOTONO", "cta": "SUSCRÍBETE", "support": "Tu apoyo nos ayuda a seguir creando y traer más contenido.", "handle": "youtube.com/@duotono"}}
```

## dinero · NODECONOMY

### `dinero.serif`

Palabra GIGANTE en didona condensada verde oscuro sobre pared gris verdosa (ref. 0,0 s 'MONEY'): las letras se paran una por una con sombra proyectada mientras la cámara las sigue; la foto entra desde la izquierda con desenfoque de movimiento; al terminar, la cámara se aleja de golpe y revela todo; sale con un barrido. Para la palabra/cifra que abre un tema.

Etiquetas: texto, impacto, foto, cámara · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra o frase corta (MAYÚSCULAS automáticas). '\n' parte renglones; 1 palabra = el plano de la referencia. |
| `textPortrait` | string | `""` | Renglones para 9:16 (vacío = se reparten solos, ≤ 8 letras). |
| `src` | image | `""` | Objeto/escena de abajo (foto en plata verdosa que entra desde la izquierda). |
| `src2` | image | `""` | Segunda foto (figuras) que aparece a la derecha al alejarse la cámara. |
| `reveal` | number [0.02–0.3] | `0.075` | Segundos entre letra y letra. |
| `pull` | number | `-1` | Segundo del alejamiento de cámara (-1 = al terminar las letras). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.serif", "params": {"text": "DINERO", "src": "../designs/dinero/samples/billete100.jpg"}}
```

### `dinero.title`

Título de apertura (t = 0) con el plano 1 de la referencia: el TÍTULO en didona condensada gigante verde oscuro, letra por letra con la cámara siguiéndolas, foto que entra desde la izquierda, alejamiento brusco y rótulo fino (kicker) que se escribe debajo. Sin subtítulos.

Etiquetas: intro, título, apertura · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título (2–4 renglones cortos con '\n'). |
| `textPortrait` | string | `""` | Renglones para 9:16 (vacío = se reparten solos, ≤ 8 letras). |
| `src` | image | `""` | Objeto/escena de abajo (foto en plata verdosa que entra desde la izquierda). |
| `src2` | image | `""` | Segunda foto (figuras) que aparece a la derecha al alejarse la cámara. |
| `reveal` | number [0.02–0.3] | `0.075` | Segundos entre letra y letra. |
| `pull` | number | `-1` | Segundo del alejamiento de cámara (-1 = al terminar las letras). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `kicker` | string | `""` | Rótulo fino (Montserrat 200) que se escribe al alejarse la cámara. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.title", "params": {"text": "EL PRECIO\nDE UNA IDEA", "kicker": "DARTMOUTH · 1956", "src": "../designs/dinero/samples/contando.jpg"}}
```

### `dinero.cash`

Ráfaga de fotos de billetes en teal frío (ref. 1,1 s): la 1ª entra desenfocada y oscura y se enfoca, cortes rápidos a la 2ª girada y re-encuadrada, un cuadro oscuro con líneas de barrido y la última queda con empuje lento. Para el momento en que aparece el dinero (cifras, presupuesto, pago).

Etiquetas: foto, dinero, ráfaga, billetes · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src1` | image · obligatorio | `null` | Primera foto (entra desenfocada). |
| `src2` | image | `""` | Segunda foto (girada; vacío = src1). |
| `src3` | image | `""` | Foto final que queda (vacío = src2 o src1). |
| `pace` | number [0.5–3] | `1` | Multiplica la duración de los cortes (1 = ritmo de la referencia: 0,63 s de ráfaga). |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"whip"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.cash", "params": {"src1": "../designs/dinero/samples/billete100.jpg", "src2": "../designs/dinero/samples/abanico.jpg", "src3": "../designs/dinero/samples/dolar1957.jpg"}}
```

### `dinero.count`

Foto en teal frío con empuje y paneo lentos y luz cálida en la esquina (ref. 3,2 s, mano contando billetes); encima, un rótulo FINO en mayúsculas y una línea en minúsculas que se DECODIFICAN letra por letra con una raya fina a la izquierda. Para nombrar una cifra, un trámite o una pregunta sobre la foto.

Etiquetas: foto, texto, decodificar, dinero · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de fondo. |
| `text` | string · obligatorio | `null` | Rótulo principal (MAYÚSCULAS finas, ≤ 18 caracteres). |
| `sub` | string | `""` | Segunda línea en minúsculas (≤ 22 caracteres). |
| `cps` | number [3–None] | `12` | Letras por segundo que se resuelven. |
| `focus` | array | `[0.5, 0.5]` | Punto de la foto que queda al centro del recorte [x,y] (0..1). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"whip"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.count", "params": {"src": "../designs/dinero/samples/abanico.jpg", "text": "13.500 DÓLARES", "sub": "pidieron"}}
```

### `dinero.neon`

Palabra en MAYÚSCULAS finas blancas con brillo y sombra larga sobre fieltro verde con viñeta (ref. 2,0 s 'MONEY'): las letras aparecen desenfocadas y se enfocan, un cuadro oscuro, líneas finas de cursor, barrido con destello y re-encuadre más chico con la 2ª línea en minúsculas, anillo de chispa y subrayado que se dibuja con punta brillante; ornamento de billete en los bordes. Para nombrar un concepto con elegancia.

Etiquetas: texto, palabra, brillo, elegante · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Palabra o frase corta (≤ 14 caracteres en MAYÚSCULAS). |
| `sub` | string | `""` | Segunda línea en minúsculas que llega en el re-encuadre (vacío = sin 2ª fase). |
| `subAt` | number | `0.75` | Segundo del barrido y re-encuadre (acepta '@palabra'). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"blob"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.neon", "params": {"text": "PRESUPUESTO", "sub": "la apuesta"}}
```

### `dinero.spin`

Palabras 3D que GIRAN con desenfoque de movimiento sobre gris claro con viñeta mientras caen monedas doradas (ref. 3,8–8,4 s 'Dirty Cash I Want YOU'): cada palabra entra volteándose (la 1ª se tipea), la cámara gira y salta de una a otra, las anteriores quedan desenfocadas; en `lensAt` un lente OJO DE PEZ encierra el cuadro en un rectángulo redondeado que rebota y la palabra verde parpadea. Para frases de impacto y momentos de tensión con el dinero.

Etiquetas: texto, 3D, cinético, monedas, clímax · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `words` | array | `[]` | Palabras/frases cortas en orden ('^x^' = verde billete). Vacío = las palabras narradas en el beat (≥ 3 letras, máx. 6). |
| `accent` | array | `[]` | Palabras narradas que van en verde (modo automático). |
| `lensAt` | number | `-2` | Segundo del lente ojo de pez (-2 = cuando entra la última palabra; -1 = sin lente). Acepta '@palabra'. |
| `coins` | number [0–40] | `14` | Monedas que caen. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"leak"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.spin", "params": {"words": ["Dinero", "^sucio^", "lo quiero", "^YA^"]}}
```

### `dinero.block`

Frase en BLOQUE gigante Open Sans 800 verde oscuro sobre salvia (ref. 8,5 s 'MONEY TALKS'): las letras aparecen mientras la cámara panea, una barra verde sube con un billete arriba y garabatos que saltan, el 2º renglón sube con desenfoque y la cámara se aleja hasta llenar el cuadro de borde a borde. Para la frase-tesis o el dato que lo cambia todo.

Etiquetas: texto, impacto, bloque, gigante · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | 1–2 renglones cortos con '\n' (en 9:16 se reparten ≤ 7 letras). |
| `pole` | bool | `true` | Barra verde con billete arriba que sube entre las letras. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"pixel"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.block", "params": {"text": "EL DINERO\nMANDA"}}
```

### `dinero.head`

Ilustración plana sobre verde salvia (ref. 9,5–10,5 s): primero una palabra 3D chica con ojo de dibujo animado, sonrisa y rayitas; después una CABEZA negra de perfil con un ojo blanco que mira una TARJETA con degradé, marcador, ojo con destello, barra oscura con el lema y fila de rótulos chicos; todo se desliza lento. Para una idea, un plan, una decisión o la mente de alguien.

Etiquetas: idea, persona, mente, tarjeta, plano · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `word` | string | `""` | Palabra 3D del primer tiempo (vacío = sin primer tiempo). |
| `text` | string · obligatorio | `null` | Lema de la tarjeta (≤ 24 caracteres). |
| `sub` | string | `""` | Rótulo chico debajo del lema. |
| `chips` | array | `[]` | Hasta 4 rótulos mínimos en fila (cifras, palabras). |
| `split` | number | `0.55` | Segundo del corte a la cabeza (si hay word). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.head", "params": {"word": "IDEA", "text": "INTENTA HASTA LOGRARLO", "sub": "LA APUESTA DE DARTMOUTH", "chips": ["1956", "10", "2 MESES", "IA"]}}
```

### `dinero.note`

Texto MÍNIMO en Open Sans 800 sobre blanco, negro o salvia (ref. 10,6 s 'MONEY / TALKS!' y 16,0 s 'HUH!'): los renglones se tipean escalonados hacia la derecha y el grupo salta a la izquierda y vuelve (en blanco) o queda quieto (en negro). Para una pausa, una reacción corta o un dato aireado.

Etiquetas: texto, mínimo, pausa, respiro · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | 1–3 renglones muy cortos con '\n' (cada uno se corre a la derecha). |
| `bg` | enum (white / black / sage) | `"white"` | Fondo: white = tarjeta blanca (texto verde oscuro), black = negro verdoso (texto blanco), salvia. |
| `size` | number [0.5–2.5] | `1` | Escala del texto (1 = legible en celular; la referencia es más chica). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.note", "params": {"text": "¿Y AHORA?", "bg": "black"}}
```

### `dinero.pin`

Sobre negro verdoso, un ALFILER-PERSONA verde (cono con cabeza) sube desde abajo con un anillo blanco alrededor de la cabeza; a mitad del plano la cámara se aleja de golpe y el anillo se cierra sobre la cabeza; el rótulo se tipea al lado (ref. 11,6 s). Para señalar a una persona, un 'tú' o 'uno solo'.

Etiquetas: persona, uno, foco, individuo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `label` | string | `""` | Rótulo blanco que se tipea junto al alfiler (≤ 16 caracteres). |
| `zoomAt` | number | `0.5` | Segundo del alejamiento. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.pin", "params": {"label": "UNO SOLO"}}
```

### `dinero.outline`

La frase NARRADA sobre negro verdoso (ref. 12,3–14,2 s 'dirty cash want i you'): cada palabra se tipea cuando la voz la dice, en blanco Open Sans 800 con tamaños escalonados (la 1ª del renglón grande, las siguientes chicas y corridas), detrás la 1ª palabra GIGANTE solo en contorno, una estrella verde, la palabra clave en verde grande con un ojito y rayos verdes tenues. Es la 'letra grande' del diseño (reemplaza a common.lyric).

Etiquetas: letra, frase, karaoke, texto, clímax · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `words` | array | `[]` | Palabras a mostrar ('^x^' = clave en verde). Vacío = las palabras NARRADAS en el beat, a su tiempo. |
| `accent` | array | `[]` | Palabras narradas que van en verde grande (modo automático). |
| `ghost` | string | `""` | Palabra gigante en contorno detrás (vacío = la 1ª de cada página). |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.outline", "params": {"words": ["el", "dinero", "se", "^congeló^"]}}
```

### `dinero.eye`

OJO gigante plano (almendra blanca con borde verde e iris verde) sobre negro verdoso (ref. 14,3 s): primero muy cerca, cortado por el borde, mientras el texto en mayúsculas blancas se tipea a la izquierda; en `split` la cámara se aleja de golpe y queda el ojo entero, inclinado, mirando, con el texto al costado. Para 'alguien mira', vigilancia, atención o deseo.

Etiquetas: mirada, vigilancia, atención, texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | 1–2 renglones cortos ('\n'). |
| `split` | number | `0.5` | Segundo del alejamiento. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.eye", "params": {"text": "TODOS\nMIRABAN"}}
```

### `dinero.eyes`

OJOS de dibujo animado (esferas blancas con pupila) de distintos tamaños que aparecen, flotan y miran para todos lados sobre negro verdoso, con un texto corto verde al centro (ref. 15,5 s 'NEED YOU'). Para 'todos miran', la presión del público o una sensación de ser observado.

Etiquetas: mirada, miedo, todos, público, texto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string | `""` | Texto corto central (1–2 renglones). |
| `count` | number [2–7] | `6` | Cantidad de ojos. |
| `fx` | enum (cut / whip / blob / leak / pixel / scan / zoom / flash) | `"cut"` | Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello. |

```json
{"use": "dinero.eyes", "params": {"text": "TODOS\nQUIEREN"}}
```

### `dinero.introv1`

GANCHO de apertura (lo primero que se ve). Titular en BLOQUE Open Sans 800 que entra palabra por palabra VOLTEÁNDOSE en 3D con desenfoque de movimiento (como 'Dirty Cash' de la referencia); la '^palabra^' va en verde billete y estalla en monedas; en glitchAt el cuadro se ABOMBA con el lente ojo de pez dentro de un rectángulo redondeado, tiembla y destella. Fondo adaptable (bg: paper | felt | sage | black | fog | image con src | component con use/useParams); por defecto gris claro con monedas que caen.

Etiquetas: intro, gancho, apertura, título, impacto, 3D · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho corto (2–6 palabras). '\n' = renglón; '^x^' = palabra en verde con monedas. |
| `kicker` | string | `""` | Rótulo fino arriba (se decodifica). |
| `sub` | string | `""` | Línea chica debajo del titular. |
| `wordAt` | number | `0.35` | Segundo de la primera palabra. |
| `stagger` | number [0.08–None] | `0.26` | Segundos entre palabras. |
| `glitchAt` | number | `2.2` | Segundo del IMPACTO: lente ojo de pez + temblor + destello (-1 = sin impacto). Acepta '@palabra'. |
| `bg` | enum (auto / paper / felt / sage / black / fog / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: paper, felt, sage, black, fog; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "dinero.introv1", "params": {"text": "¿QUIÉN PAGA\nLA ^CUENTA^?", "kicker": "Economía · 2026", "sub": "nadie lo dice en voz alta", "glitchAt": 2.2}}
```

### `dinero.introv2`

GANCHO pregunta + revelación. La pregunta en MAYÚSCULAS finas blancas con brillo y sombra larga se DECODIFICA letra por letra sobre fieltro verde (como 'MONEY' de la referencia); en stampAt barrido con destello, la pregunta se achica arriba con un subrayado de punta brillante y la RESPUESTA cae gigante en Open Sans 800 verde volteándose en 3D con desenfoque, con anillo de chispa. Fondo adaptable (bg: felt | paper | sage | black | fog | image con src | component con use/useParams); por defecto fieltro verde.

Etiquetas: intro, gancho, apertura, pregunta, revelación, neón · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo fino arriba. |
| `stamp` | string | `""` | Respuesta que cae (vacío = sin revelación). |
| `stampAt` | number | `2.4` | Segundo de la revelación (acepta '@palabra'). |
| `typeAt` | number | `0.3` | Segundo en que empieza a decodificarse la pregunta. |
| `cps` | number [4–None] | `16` | Letras por segundo. |
| `bg` | enum (auto / paper / felt / sage / black / fog / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: paper, felt, sage, black, fog; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "dinero.introv2", "params": {"text": "¿CUÁNTO VALE\nUNA IDEA?", "kicker": "Dartmouth · 1956", "stamp": "7.500 DÓLARES", "stampAt": 2.4}}
```

### `dinero.outro`

Cierre del canal SIN recuadro en lenguaje NODECONOMY (bg: black | paper | felt | sage | fog | image con src | component con use/useParams; por defecto negro verdoso con rayos verdes): GRACIAS POR VER fina que se decodifica → nombre del canal GIGANTE con contorno fantasma detrás y relleno blanco que se tipea → botón LIKE verde que se presiona y suelta chispas (dos ojos lo miran) → flecha fina con punta brillante → SUSCRÍBETE en billete verde que golpea + campana que suena → apoyo → youtube.com/@canal. Tiempos sincronizables (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODECONOMY"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodeconomy"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / paper / felt / sage / black / fog / image / component / none) | `"black"` | Fondo: auto = el del diseño; presets: paper, felt, sage, black, fog; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.66` | Oscurecido del fondo foto/componente. |

```json
{"use": "dinero.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODECONOMY", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el video.", "handle": "youtube.com/@nodeconomy"}}
```

## atlas · NODEPOLITICS

### `atlas.world`

Cámara del mapamundi 2.5D que viaja (zoom + paneo suave) a una región, a varios países o a un punto; opcionalmente pinta países en gris o blanco con parpadeo. Para situar la historia: 'todo empezó en Europa del Este', 'el bloque soviético'.

Etiquetas: mapa, región, contexto, cámara, continente · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `region` | enum (world / europe / western-europe / eastern-europe / africa / asia / middle-east / north-america / central-america / south-america / latin-america / americas / oceania / east-asia / southeast-asia / south-asia / central-asia) | `"world"` | Región con nombre (si no hay countries ni center). |
| `countries` | array | `[]` | Países (inglés, p. ej. 'Germany') que la cámara encuadra juntos. |
| `center` | array | `[]` | [lon,lat] centro de la cámara (con span). |
| `span` | number [0–None] | `0` | Ancho visible en grados de longitud (con center). |
| `zoom` | number [0.2–6] | `1` | Multiplica el zoom calculado. |
| `paint` | array | `[]` | Países que se pintan (con parpadeo escalonado). |
| `state` | enum (white / gray) | `"gray"` | Color de los países pintados. |
| `paintAt` | number [0–None] | `0.7` | Segundo en que empieza a pintar (acepta '@palabra'). |
| `stagger` | number [0–None] | `0.12` | Segundos entre país y país al pintar. |
| `clear` | bool | `false` | Borra lo pintado y los alfileres anteriores (empezar un capítulo nuevo). |
| `move` | number [0–None] | `0` | Segundos del viaje de cámara (0 = automático según distancia). |
| `pins` | array | `[]` | Alfileres chicos sin etiqueta: [[lon,lat], …] o nombres de país (caen escalonados desde paintAt). |
| `kicker` | string | `""` | Rótulo chico de cabecera (lugar · fecha). |

```json
{"use": "atlas.world", "params": {"region": "europe", "paint": ["Germany", "Poland", "Czechia", "Hungary"], "state": "gray", "kicker": "Europa · 1989"}}
```

### `atlas.country`

LA escena de la referencia: la cámara viaja al país, el país se enciende en blanco con un parpadeo de 8 cuadros (o pasa por gris medio y después blanco), cae un alfiler negro tipo gota con rebote y la etiqueta sale de atrás del alfiler. El alfiler anterior queda chico. Para nombrar un país o una ciudad (pin=[lon,lat]).

Etiquetas: país, lugar, alfiler, mapa, ciudad · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `country` | string · obligatorio | `null` | País (properties.name en inglés: 'Germany', 'United States of America'; acepta alias 'USA' y el nombre en español). |
| `label` | string | `""` | Etiqueta (vacío = nombre en español del país; '-' = sin etiqueta). |
| `sub` | string | `""` | Línea chica debajo de la etiqueta (año, ciudad, dato corto). |
| `pin` | array | `[]` | [lon,lat] del alfiler (ciudad); vacío = centro del país. |
| `src` | image | `""` | Foto dentro del sello del alfiler (B/N contrastado). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `seal` | enum (globe / initials / none) | `"initials"` | Sello del alfiler si no hay foto: emblema B/N (globe), emblema con iniciales o liso. |
| `state` | enum (white / gray / both / none) | `"white"` | Pintado: blanco, gris medio, gris y después blanco (both, en whiteAt) o sin pintar. |
| `whiteAt` | number [0–None] | `1.6` | Con state=both: segundo en que pasa de gris a blanco (acepta '@palabra'). |
| `span` | number [0–None] | `0` | Ancho visible en grados (0 = automático, ~34° o 2,3× el país). Ciudad: 6–10. |
| `zoom` | number [0.2–6] | `1` | Multiplica el zoom. |
| `move` | number [0.2–3] | `0.75` | Segundos del viaje de cámara. |
| `pinAt` | number | `-1` | Segundo en que cae el alfiler (-1 = al llegar la cámara). |
| `side` | enum (auto / left / right) | `"auto"` | Lado de la etiqueta. |

```json
{"use": "atlas.country", "params": {"country": "Germany", "label": "Alemania", "sub": "1989", "pin": [13.4, 52.52]}}
```

### `atlas.route`

Montaje de la referencia: la cámara salta país por país (≈1 s cada uno), cada país se enciende en blanco, cae su alfiler y su etiqueta; los anteriores quedan chicos. Con line=true une los alfileres con una ruta punteada que avanza. Para listas de países, rutas de escape, expansión de un bloque, giras, contagios.

Etiquetas: recorrido, lista, países, montaje, expansión, contagio · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `items` | array · obligatorio | `null` | Países en orden: 'Hungary' o { country, label, sub, pin:[lon,lat], state:'white|gray', at } (at = segundos desde el inicio del beat). |
| `stagger` | number [0.3–None] | `1` | Segundos entre país y país (si el item no trae at). |
| `first` | number [0–None] | `0.55` | Segundo del primer país. |
| `camera` | enum (follow / fit) | `"follow"` | follow = viaja a cada país (referencia); fit = encuadra todos de una vez. |
| `line` | bool | `false` | Ruta punteada blanca que une los alfileres. |
| `span` | number [0–None] | `0` | Ancho visible en grados en follow (0 = automático). |
| `zoom` | number [0.2–6] | `1` | Multiplica el zoom. |
| `state` | enum (white / gray) | `"white"` | Color por defecto de los países. |
| `clear` | bool | `false` | Borra lo pintado antes. |
| `kicker` | string | `""` | Rótulo chico de cabecera. |

```json
{"use": "atlas.route", "params": {"items": ["Hungary", "Austria", "Czechia", "Germany"], "stagger": 1, "line": true}}
```

### `atlas.border`

Una línea que se dibuja sobre el mapa: MURO (negro grueso con canto cian que brilla), frontera punteada o ruta con flecha. Rótulos a cada lado (ESTE / OESTE) que entran deslizando. Para fronteras, muros, particiones, líneas de frente, rutas migratorias.

Etiquetas: frontera, muro, división, partición, ruta, línea · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `line` | array · obligatorio | `null` | Puntos [[lon,lat], …] de la línea, en orden. |
| `style` | enum (wall / border / route) | `"wall"` | wall = muro negro con canto cian · border = punteada negra · route = blanca punteada con flecha. |
| `drawAt` | number [0–None] | `0.5` | Segundo en que empieza a dibujarse. |
| `drawSec` | number [0.2–None] | `1.6` | Segundos que tarda en dibujarse. |
| `width` | number [0.3–4] | `1` | Grosor (×). |
| `tags` | array | `[]` | Rótulos sobre el mapa: [{ text, at:[lon,lat], dark? }] (blancos con sombra; dark = negros con halo, sobre países blancos). |
| `countries` | array | `[]` | Países que encuadra la cámara (si no, encuadra la línea). |
| `center` | array | `[]` | [lon,lat] centro de la cámara (con span). |
| `span` | number [0–None] | `0` | Ancho visible en grados (con center). |
| `zoom` | number [0.2–6] | `1` | Multiplica el zoom. |
| `paint` | array | `[]` | Países que se pintan. |
| `state` | enum (white / gray) | `"white"` | Color de los países pintados. |
| `keep` | bool | `true` | La línea queda en el mapa después del beat (false = se apaga al salir). |
| `kicker` | string | `""` | Rótulo chico de cabecera. |

```json
{"use": "atlas.border", "params": {"line": [[10.9, 54], [10.75, 53.6], [10.6, 53.37], [11.5, 53.05], [10.95, 52.55], [11, 52.2], [10.6, 51.75], [10.25, 51.45], [10, 50.95], [10.1, 50.55], [10.9, 50.33], [11.9, 50.32], [12.1, 50.3]], "style": "wall", "tags": [{"text": "OESTE", "at": [8.4, 51.6]}, {"text": "ESTE", "at": [12.9, 51.9]}], "countries": ["Germany"], "paint": ["Germany"], "state": "gray", "kicker": "Alemania · 1949–1990"}}
```

### `atlas.title`

Título de apertura: el mapamundi 2.5D con la costa cian se acerca lento mientras caen alfileres chicos en los países de la historia; el titular condensado blanco GRANDE ('^x^' en cian) se asienta cerrando la interletra. Primer beat del video (t=0).

Etiquetas: título, apertura, portada, mundo · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Título ('\n' = renglón, '^x^' = palabra en cian). |
| `textPortrait` | string | `""` | Versión 9:16 (renglones más cortos). |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha). |
| `sub` | string | `""` | Línea chica debajo. |
| `region` | enum (world / europe / western-europe / eastern-europe / africa / asia / middle-east / north-america / central-america / south-america / latin-america / americas / oceania / east-asia / southeast-asia / south-asia / central-asia) | `"world"` | Hacia dónde se acerca la cámara. |
| `pins` | array | `[]` | Países donde caen alfileres chicos (sin etiqueta). |
| `dim` | number [0–1] | `0.42` | Oscurecido del mapa detrás del título. |

```json
{"use": "atlas.title", "params": {"text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "textPortrait": "LA NOCHE\nQUE CAYÓ\nEL ^MURO^", "kicker": "Berlín · 9 nov 1989", "region": "europe", "pins": ["Germany", "Hungary", "Czechia", "Poland"]}}
```

### `atlas.stat`

Cierre de la referencia ('82 COUNTRIES LISTENING'): el mapa se apaga y desenfoca, y aparece una cifra con su texto en condensada blanca (la cifra cuenta hacia arriba si es número). Para el dato duro de la historia: víctimas, votos, años, países.

Etiquetas: cifra, dato, número, conteo, impacto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `value` | string · obligatorio | `null` | Cifra (si es número entero cuenta desde countFrom). |
| `text` | string | `""` | Texto que acompaña ('países escuchando', 'muertos en el muro'). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `layout` | enum (auto / inline / stack) | `"auto"` | inline = una línea como la referencia; stack = cifra gigante arriba y texto abajo. |
| `countFrom` | number | `0` | Desde dónde cuenta. |
| `countSec` | number [0–None] | `1.1` | Segundos del conteo (0 = sin conteo). |
| `accent` | bool | `false` | Cifra en cian (si es EL dato del video). |
| `region` | enum ( / world / europe / western-europe / eastern-europe / africa / asia / middle-east / north-america / central-america / south-america / latin-america / americas / oceania / east-asia / southeast-asia / south-asia / central-asia) | `""` | Mover la cámara detrás (vacío = se queda donde estaba). |

```json
{"use": "atlas.stat", "params": {"value": "140", "text": "muertos en el muro", "kicker": "Berlín · 1961–1989"}}
```

### `atlas.compare`

Dos países encendidos a la vez en el mapa, cada uno con su alfiler y su etiqueta, y abajo su cifra GRANDE en condensada blanca con un 'VS' cian en el medio. Para comparar dos países (población, votos, gasto, muertos, años).

Etiquetas: comparación, versus, dos países, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `left` | object · obligatorio | `null` | { country, label?, value, sub?, pin?:[lon,lat] } |
| `right` | object · obligatorio | `null` | { country, label?, value, sub?, pin?:[lon,lat] } |
| `vs` | string | `"VS"` | Texto del medio. |
| `kicker` | string | `""` | Rótulo chico de cabecera. |
| `zoom` | number [0.2–6] | `1` | Multiplica el zoom. |

```json
{"use": "atlas.compare", "params": {"left": {"country": "Germany", "value": "83 M", "sub": "habitantes"}, "right": {"country": "France", "value": "68 M", "sub": "habitantes"}, "kicker": "Población · 2024"}}
```

### `atlas.photo`

Foto clavada en el mapa: un alfiler GIGANTE cae con rebote sobre el lugar con la foto dentro de su cabeza (B/N contrastado, como el sello de la referencia) o una tarjeta con borde blanco y puntero; nombre y rol al lado. Al salir se achica y queda un alfiler chico con la foto en el mapa. Para personas, lugares, documentos.

Etiquetas: foto, persona, lugar, retrato, alfiler · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto. |
| `focus` | array | `[0.5, 0.42]` | Punto de interés [x,y] (0..1) para el recorte. |
| `country` | string | `""` | País donde se clava (se enciende en blanco). |
| `pin` | array | `[]` | [lon,lat] exacto (ciudad); vacío = centro del país. |
| `name` | string | `""` | Nombre (grande). |
| `role` | string | `""` | Rol / lugar / fecha (chico). |
| `frame` | enum (pin / card) | `"pin"` | pin = foto dentro del alfiler gigante; card = tarjeta rectangular con puntero. |
| `span` | number [1–None] | `26` | Ancho visible en grados detrás. |
| `keep` | bool | `true` | Deja un alfiler chico con la foto al salir. |

```json
{"use": "atlas.photo", "params": {"src": "turing.jpg", "country": "United Kingdom", "pin": [-0.74, 52], "name": "Alan Turing", "role": "Bletchley Park · 1940"}}
```

### `atlas.introv1`

GANCHO de apertura tipo golpe: la cámara se lanza del mundo entero hacia la región mientras los países de la historia se encienden en BLANCO en ráfaga (parpadeo de 8 cuadros cada uno, con alfileres chicos) y el titular condensado GIGANTE golpea palabra por palabra con sacudida ('^x^' en cian). Fondo adaptable: world (mapa), dark, image (src), component.

Etiquetas: intro, gancho, apertura, golpe, mapa · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho (2–6 palabras). '\n' = renglón; '^x^' = palabra en cian. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha). |
| `sub` | string | `""` | Línea chica debajo del titular. |
| `countries` | array | `[]` | Países que se encienden en ráfaga (inglés). |
| `region` | enum (world / europe / western-europe / eastern-europe / africa / asia / middle-east / north-america / central-america / south-america / latin-america / americas / oceania / east-asia / southeast-asia / south-asia / central-asia) | `"world"` | Hacia dónde se lanza la cámara (si no hay countries). |
| `wordAt` | number | `0.45` | Segundo del primer golpe. |
| `stagger` | number [0.08–None] | `0.3` | Segundos entre palabras. |
| `bg` | enum (auto / world / dark / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: world, dark; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "atlas.introv1", "params": {"text": "¿POR QUÉ CAYÓ\nEL ^MURO^?", "kicker": "Berlín · 9 nov 1989", "sub": "la noche que nadie vio venir", "countries": ["Germany", "Poland", "Czechia", "Hungary", "Austria"], "region": "europe"}}
```

### `atlas.introv2`

GANCHO pregunta + revelación: la pregunta se tipea letra a letra en condensada blanca sobre el mundo apagado; en revealAt el mapa se enciende, la pregunta sube y se achica, la cámara cae sobre el país, que parpadea en blanco, y cae el alfiler con la RESPUESTA como etiqueta. Fondo adaptable (world, dark, image, component).

Etiquetas: intro, gancho, pregunta, revelación, país · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta ('\n' = renglón, '^x^' = cian). |
| `answer` | string | `""` | Respuesta: etiqueta del alfiler (vacío = nombre del país). |
| `country` | string · obligatorio | `null` | País de la revelación (inglés). |
| `pin` | array | `[]` | [lon,lat] del alfiler (ciudad). |
| `pinSrc` | image | `""` | Foto dentro del sello del alfiler. |
| `span` | number [0–None] | `0` | Ancho visible en grados al revelar (0 = automático). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `revealAt` | number | `2.4` | Segundo de la revelación (acepta '@palabra'). |
| `typeAt` | number | `0.3` | Segundo en que empieza el tipeo. |
| `cps` | number [4–None] | `22` | Letras por segundo. |
| `bg` | enum (auto / world / dark / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: world, dark; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Oscurecido del fondo foto/componente (0 = nada). |

```json
{"use": "atlas.introv2", "params": {"text": "¿DÓNDE CAYÓ\nEL MURO?", "answer": "Berlín", "country": "Germany", "pin": [13.4, 52.52], "kicker": "9 nov 1989", "revealAt": 2.2}}
```

### `atlas.outro`

Cierre del canal SIN recuadro: la cámara se aleja al mundo entero con todo lo encendido y el mapa se apaga (final de la referencia). GRACIAS POR VER → canal en condensada gigante → alfiler LIKE que cae con el pulgar en el sello → ruta cian → placa blanca SUSCRÍBETE que se enciende con el parpadeo de los países + campana → apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, mapa · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODEPOLITICS"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el mapa."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodepolitics"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / world / dark / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: world, dark; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.6` | Oscurecido del fondo foto/componente. |

```json
{"use": "atlas.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODEPOLITICS", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el mapa.", "handle": "youtube.com/@nodepolitics"}}
```

## imperio · NODEPOLITICS

### `imperio.title`

Apertura (ref 0–11 s): atlas físico con el país foco rayado y el SOL carmesí que late; la cámara se aleja y gira apenas; nacen los RAYOS translúcidos en abanico hacia `dir` con barquitos; el título en su IDIOMA ORIGINAL (kanji, alemán, ruso…) entra carácter por carácter con su traducción tipeada debajo y se borra de derecha a izquierda; después el título condensado blanco SUBE desde abajo con degradé. Primer beat del video.

Etiquetas: apertura, título, mapa, imperio, sol, idioma original · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `country` | string | `"Japan"` | País foco (nombre de world-atlas en inglés o alias en español: 'Japón', 'Alemania', 'Reino Unido'). Pone el sol y el rayado. |
| `hatch` | array | `null` | Países rayados en diagonal (territorio del imperio). Vacío = solo `country`; [] explícito = ninguno. |
| `sun` | bool | `true` | Círculo carmesí que late sobre el país foco. |
| `sunAt` | array | `null` | [lon, lat] del sol (vacío = centro del país foco). |
| `sunSize` | number [0.2–6] | `3.6` | Radio del sol en grados de mapa (se achica al alejarse la cámara). |
| `labels` | array | `[]` | Rótulos de mares/regiones en itálica: [{"t":"Mar del\nJapón", "at":[134,40]}] ('at' también acepta un país). |
| `compass` | bool | `false` | Rosa de los vientos de línea fina abajo a la derecha. |
| `gray` | number [0–1] | `0` | Desaturación del atlas (1 = gris, como el tramo de archivo). |
| `enter` | number [0–2] | `0.5` | Segundos de fundido de entrada sobre el plano anterior (0 = corte). |
| `flag` | string | `"auto"` | Colores del sol y los rayos: auto = bandera del país foco (Japón = carmesí de la referencia), 'none' = carmesí, o colores propios '#000,#d00,#fc0'. |
| `from` | array | `null` | Cámara inicial [lon, lat, span°, giro°] o "País*k". Vacío = donde terminó el plano con mapa anterior (plano continuo). |
| `to` | array | `null` | Cámara final [lon, lat, span°, giro°] o "País*k" (k = cuántas veces el ancho del país). Vacío = se aleja `zoom`. |
| `zoom` | number [0.3–6] | `1.3` | Si no hay `to`: cuánto se aleja la cámara en el plano (1.3 = 30 % más de mapa; < 1 acerca). |
| `tilt` | number [-20–20] | `3` | Si no hay `to`: grados que gira el mapa durante el plano (la referencia rota apenas). |
| `ease` | enum (auto / out / in / inOut / linear / expo) | `"auto"` | Curva del movimiento de cámara. auto = sin frenar entre planos encadenados (lineal), out después de un corte. |
| `rays` | number [0–60] | `28` | Cantidad de rayos del sol (0 = sin rayos; la referencia usa ~28). |
| `dir` | number | `180` | Rumbo hacia donde se despliega el abanico (0 = norte, 90 = este, 180 = sur, 270 = oeste). |
| `spread` | number [0–1] | `0.72` | Qué tan cerrado es el abanico (0 = parejo en 360°, 1 = solo hacia `dir`). |
| `rayFloor` | number [0–0.4] | `0.02` | Largo residual de los rayos opuestos al rumbo principal; bajo = abanico más direccional. |
| `rayAlpha` | number [0–1] | `0.56` | Opacidad de los rayos carmesí. |
| `rayLen` | number [0.1–1] | `0.46` | Largo máximo de los rayos (fracción del lado largo del cuadro). |
| `raysAt` | number | `4` | Segundo en que nacen los rayos (acepta '@palabra'). |
| `ships` | number [0–10] | `2` | Barquitos que avanzan sobre los rayos hacia el abanico. |
| `rayColor` | string | `""` | Color de los rayos en multiplicar. Vacío = granate grisáceo del tramo de mapa (#a8606e); el tramo de archivo usa carmesí #b3122f. |
| `native` | string | `""` | Título en su idioma original (p. ej. '南進論', 'Geheime Kommandosache', 'Перестройка'). Vacío = sin este paso. |
| `nativeSub` | string | `""` | Traducción chica en mayúsculas que se tipea debajo. |
| `nativeAt` | number | `5` | Segundo en que entra el título original (acepta '@palabra'). |
| `nativeOut` | number | `9.2` | Segundo en que se borra (de derecha a izquierda). −1 = se queda. |
| `text` | string | `""` | Título condensado blanco (Fjalla One); '\n' parte renglones. Vacío = sin título grande. |
| `textPortrait` | string | `""` | Versión del título para 9:16 (más renglones). |
| `textAt` | number | `10` | Segundo en que sube el título condensado (acepta '@palabra'). |

```json
{"use": "imperio.title", "params": {"country": "Japan", "hatch": ["Japan"], "from": [150, 36, 95, 0], "to": [145, 35, 125, 3], "sunSize": 3.6, "native": "南進論", "nativeSub": "SOUTHERN EXPANSION DOCTRINE", "nativeAt": 5, "nativeOut": 9.2, "text": "JAPANESE\nEMPIRE", "textPortrait": "JAPANESE\nEMPIRE", "textAt": 10, "rays": 28, "raysAt": 4, "dir": 180, "spread": 0.72, "rayFloor": 0.02, "rayAlpha": 0.56, "rayLen": 0.46, "ships": 2, "labels": [{"t": "Mar del\nJapón", "at": [134.5, 40.2]}, {"t": "Mar\nAmarillo", "at": [123.6, 35.4]}, {"t": "Océano\nPacífico", "at": [150, 31]}]}}
```

### `imperio.map`

Atlas físico en movimiento lento (zoom y giro leve) sobre un país o región: territorio rayado, sol que late, rótulos de mares, rayos opcionales y PINES (punto carmesí + nombre) para lugares concretos (una base, una ciudad, un puerto). Para situar la historia y para respirar entre momentos fuertes.

Etiquetas: mapa, lugar, país, geografía, atlas · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `country` | string | `""` | País foco (nombre de world-atlas en inglés o alias en español: 'Japón', 'Alemania', 'Reino Unido'). Pone el sol y el rayado. |
| `hatch` | array | `null` | Países rayados en diagonal (territorio del imperio). Vacío = solo `country`; [] explícito = ninguno. |
| `sun` | bool | `true` | Círculo carmesí que late sobre el país foco. |
| `sunAt` | array | `null` | [lon, lat] del sol (vacío = centro del país foco). |
| `sunSize` | number [0.2–6] | `0.8` | Radio del sol en grados de mapa (se achica al alejarse la cámara). |
| `labels` | array | `[]` | Rótulos de mares/regiones en itálica: [{"t":"Mar del\nJapón", "at":[134,40]}] ('at' también acepta un país). |
| `compass` | bool | `false` | Rosa de los vientos de línea fina abajo a la derecha. |
| `gray` | number [0–1] | `0` | Desaturación del atlas (1 = gris, como el tramo de archivo). |
| `enter` | number [0–2] | `0.5` | Segundos de fundido de entrada sobre el plano anterior (0 = corte). |
| `flag` | string | `"auto"` | Colores del sol y los rayos: auto = bandera del país foco (Japón = carmesí de la referencia), 'none' = carmesí, o colores propios '#000,#d00,#fc0'. |
| `from` | array | `null` | Cámara inicial [lon, lat, span°, giro°] o "País*k". Vacío = donde terminó el plano con mapa anterior (plano continuo). |
| `to` | array | `null` | Cámara final [lon, lat, span°, giro°] o "País*k" (k = cuántas veces el ancho del país). Vacío = se aleja `zoom`. |
| `zoom` | number [0.3–6] | `1.3` | Si no hay `to`: cuánto se aleja la cámara en el plano (1.3 = 30 % más de mapa; < 1 acerca). |
| `tilt` | number [-20–20] | `2` | Si no hay `to`: grados que gira el mapa durante el plano (la referencia rota apenas). |
| `ease` | enum (auto / out / in / inOut / linear / expo) | `"inOut"` | Curva del movimiento de cámara. auto = sin frenar entre planos encadenados (lineal), out después de un corte. |
| `rays` | number [0–60] | `0` | Cantidad de rayos del sol (0 = sin rayos; la referencia usa ~28). |
| `dir` | number | `180` | Rumbo hacia donde se despliega el abanico (0 = norte, 90 = este, 180 = sur, 270 = oeste). |
| `spread` | number [0–1] | `0.6` | Qué tan cerrado es el abanico (0 = parejo en 360°, 1 = solo hacia `dir`). |
| `rayFloor` | number [0–0.4] | `0.16` | Largo residual de los rayos opuestos al rumbo principal; bajo = abanico más direccional. |
| `rayAlpha` | number [0–1] | `0.82` | Opacidad de los rayos carmesí. |
| `rayLen` | number [0.1–1] | `0.42` | Largo máximo de los rayos (fracción del lado largo del cuadro). |
| `raysAt` | number | `0.4` | Segundo en que nacen los rayos (acepta '@palabra'). |
| `ships` | number [0–10] | `0` | Barquitos que avanzan sobre los rayos hacia el abanico. |
| `rayColor` | string | `""` | Color de los rayos en multiplicar. Vacío = granate grisáceo del tramo de mapa (#a8606e); el tramo de archivo usa carmesí #b3122f. |
| `pins` | array | `[]` | Lugares: [{"t":"Bletchley Park", "at":[-0.74, 51.99]}] (punto carmesí + nombre). Entran escalonados. |
| `pinAt` | number | `0.5` | Segundo en que entra el primer pin (acepta '@palabra'). |

```json
{"use": "imperio.map", "params": {"country": "United Kingdom", "from": "United Kingdom*1.5", "to": "United Kingdom*3.2", "pins": [{"t": "Bletchley Park", "at": [-0.74, 51.99]}, {"t": "Londres", "at": [-0.12, 51.5]}], "labels": [{"t": "Mar del\nNorte", "at": [3.5, 56]}, {"t": "Océano\nAtlántico", "at": [-15, 52]}], "compass": true}}
```

### `imperio.expansion`

Expansión: desde el sol del país foco salen HACES carmesí translúcidos hacia cada región destino, uno tras otro; al llegar, la región se raya (territorio ocupado) y aparece su nombre en condensada blanca. Para invasiones, zonas de influencia, rutas de ataque o alcance de una doctrina.

Etiquetas: expansión, conquista, invasión, influencia, mapa, rayos · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `country` | string | `""` | País foco (nombre de world-atlas en inglés o alias en español: 'Japón', 'Alemania', 'Reino Unido'). Pone el sol y el rayado. |
| `hatch` | array | `null` | Países rayados en diagonal (territorio del imperio). Vacío = solo `country`; [] explícito = ninguno. |
| `sun` | bool | `true` | Círculo carmesí que late sobre el país foco. |
| `sunAt` | array | `null` | [lon, lat] del sol (vacío = centro del país foco). |
| `sunSize` | number [0.2–6] | `1.3` | Radio del sol en grados de mapa (se achica al alejarse la cámara). |
| `labels` | array | `[]` | Rótulos de mares/regiones en itálica: [{"t":"Mar del\nJapón", "at":[134,40]}] ('at' también acepta un país). |
| `compass` | bool | `false` | Rosa de los vientos de línea fina abajo a la derecha. |
| `gray` | number [0–1] | `0` | Desaturación del atlas (1 = gris, como el tramo de archivo). |
| `enter` | number [0–2] | `0.5` | Segundos de fundido de entrada sobre el plano anterior (0 = corte). |
| `flag` | string | `"auto"` | Colores del sol y los rayos: auto = bandera del país foco (Japón = carmesí de la referencia), 'none' = carmesí, o colores propios '#000,#d00,#fc0'. |
| `from` | array | `null` | Cámara inicial [lon, lat, span°, giro°] o "País*k". Vacío = donde terminó el plano con mapa anterior (plano continuo). |
| `to` | array | `null` | Cámara final [lon, lat, span°, giro°] o "País*k" (k = cuántas veces el ancho del país). Vacío = se aleja `zoom`. |
| `zoom` | number [0.3–6] | `1.3` | Si no hay `to`: cuánto se aleja la cámara en el plano (1.3 = 30 % más de mapa; < 1 acerca). |
| `tilt` | number [-20–20] | `2` | Si no hay `to`: grados que gira el mapa durante el plano (la referencia rota apenas). |
| `ease` | enum (auto / out / in / inOut / linear / expo) | `"inOut"` | Curva del movimiento de cámara. auto = sin frenar entre planos encadenados (lineal), out después de un corte. |
| `targets` | array · obligatorio | `[]` | Destinos: países o puntos: ["Philippines", {"at":"Indonesia", "t":"Indias Orientales"}, {"at":[151, -9], "t":"Nueva Guinea"}]. |
| `at` | number | `0.6` | Segundo del primer haz (acepta '@palabra'). |
| `stagger` | number [0.1–None] | `0.7` | Segundos entre haz y haz. |
| `conquer` | bool | `true` | Rayar cada país destino cuando llega su haz. |
| `ships` | number [0–3] | `1` | Barquitos por haz. |
| `beam` | number [0.3–3] | `1` | Ancho de los haces (multiplicador). |

```json
{"use": "imperio.expansion", "params": {"country": "Japan", "targets": [{"at": "Philippines", "t": "Filipinas"}, {"at": "Indonesia", "t": "Indias Orientales"}, {"at": "Malaysia", "t": "Malasia"}, {"at": "Myanmar", "t": "Birmania"}], "hatch": ["Japan", "South Korea", "North Korea", "Taiwan"], "labels": [{"t": "Océano\nPacífico", "at": [150, 15]}, {"t": "Mar de la\nChina Meridional", "at": [114, 13]}], "compass": true}}
```

### `imperio.archive`

Material de archivo (ref 11.5–27.7 s): el atlas se DESATURA a gris, baja humo oscuro desde arriba y la foto en blanco y negro se FUNDE en multiplicar con el mapa (lo claro deja ver el mapa, lo oscuro lo tapa); los rayos carmesí siguen encima, rosa de los vientos fina abajo a la derecha, grano y polvo; la cámara sigue alejándose. Para mostrar una foto histórica sin salir del mapa.

Etiquetas: archivo, foto, blanco y negro, mapa, guerra, barco · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | Foto de archivo (se pasa a B/N contrastado). |
| `photoFocus` | array | `[0.5, 0.42]` | Punto de interés de la foto [x,y] 0..1. |
| `country` | string | `""` | País foco (nombre de world-atlas en inglés o alias en español: 'Japón', 'Alemania', 'Reino Unido'). Pone el sol y el rayado. |
| `hatch` | array | `null` | Países rayados en diagonal (territorio del imperio). Vacío = solo `country`; [] explícito = ninguno. |
| `sun` | bool | `true` | Círculo carmesí que late sobre el país foco. |
| `sunAt` | array | `null` | [lon, lat] del sol (vacío = centro del país foco). |
| `sunSize` | number [0.2–6] | `1.3` | Radio del sol en grados de mapa (se achica al alejarse la cámara). |
| `labels` | array | `[]` | Rótulos de mares/regiones en itálica: [{"t":"Mar del\nJapón", "at":[134,40]}] ('at' también acepta un país). |
| `compass` | bool | `true` | Rosa de los vientos de línea fina abajo a la derecha. |
| `gray` | number [0–1] | `0` | Desaturación del atlas (1 = gris, como el tramo de archivo). |
| `enter` | number [0–2] | `0.7` | Segundos de fundido de entrada sobre el plano anterior (0 = corte). |
| `flag` | string | `"auto"` | Colores del sol y los rayos: auto = bandera del país foco (Japón = carmesí de la referencia), 'none' = carmesí, o colores propios '#000,#d00,#fc0'. |
| `from` | array | `null` | Cámara inicial [lon, lat, span°, giro°] o "País*k". Vacío = donde terminó el plano con mapa anterior (plano continuo). |
| `to` | array | `null` | Cámara final [lon, lat, span°, giro°] o "País*k" (k = cuántas veces el ancho del país). Vacío = se aleja `zoom`. |
| `zoom` | number [0.3–6] | `1.35` | Si no hay `to`: cuánto se aleja la cámara en el plano (1.3 = 30 % más de mapa; < 1 acerca). |
| `tilt` | number [-20–20] | `3` | Si no hay `to`: grados que gira el mapa durante el plano (la referencia rota apenas). |
| `ease` | enum (auto / out / in / inOut / linear / expo) | `"auto"` | Curva del movimiento de cámara. auto = sin frenar entre planos encadenados (lineal), out después de un corte. |
| `rays` | number [0–60] | `28` | Cantidad de rayos del sol (0 = sin rayos; la referencia usa ~28). |
| `dir` | number | `180` | Rumbo hacia donde se despliega el abanico (0 = norte, 90 = este, 180 = sur, 270 = oeste). |
| `spread` | number [0–1] | `0.72` | Qué tan cerrado es el abanico (0 = parejo en 360°, 1 = solo hacia `dir`). |
| `rayFloor` | number [0–0.4] | `0.02` | Largo residual de los rayos opuestos al rumbo principal; bajo = abanico más direccional. |
| `rayAlpha` | number [0–1] | `0.56` | Opacidad de los rayos carmesí. |
| `rayLen` | number [0.1–1] | `0.46` | Largo máximo de los rayos (fracción del lado largo del cuadro). |
| `raysAt` | number | `0` | Segundo en que nacen los rayos (acepta '@palabra'). |
| `ships` | number [0–10] | `3` | Barquitos que avanzan sobre los rayos hacia el abanico. |
| `rayColor` | string | `"#b3122f"` | Color de los rayos en multiplicar. Vacío = granate grisáceo del tramo de mapa (#a8606e); el tramo de archivo usa carmesí #b3122f. |
| `grayDur` | number [0–None] | `0.9` | Segundos en que el atlas pasa de color a gris (0 = ya gris). |
| `photoAt` | number | `0` | Segundo en que empieza a aparecer la foto. |
| `photoDur` | number [0.1–None] | `0.9` | Duración del fundido de la foto. |
| `photo` | number [0–1] | `0.95` | Intensidad de la foto (multiplicar). |
| `smoke` | number [0–1] | `0.85` | Humo oscuro desde arriba. |
| `caption` | string | `""` | Rótulo chico en itálica (lugar · año de la foto), abajo a la izquierda. |

```json
{"use": "imperio.archive", "params": {"src": "../designs/imperio/assets/uboat.jpg", "country": "Japan", "from": [145, 35, 125, 3], "to": [135, 32, 165, 6], "rays": 28, "dir": 180, "spread": 0.72, "rayFloor": 0.02, "rayAlpha": 0.56, "rayLen": 0.46, "ships": 2, "compass": true, "photoAt": 0, "photoDur": 0.9, "labels": [{"t": "MAR DE JAPÓN", "at": [135, 40]}, {"t": "OCÉANO PACÍFICO", "at": [151, 23]}]}}
```

### `imperio.word`

Título condensado BLANCO (Fjalla One) sobre el plano en curso: cada renglón SUBE desde abajo con degradé de opacidad (arriba aparece primero) y desenfoque, y después el título se ACHICA lento y exponencial (rápido al principio) mientras el mapa sigue moviéndose (ref 10–27 s: 'JAPANESE EMPIRE'). Usalo como overlay sobre imperio.archive / imperio.map para el nombre del imperio, la doctrina o el tema del bloque.

Etiquetas: título, texto, nombre, imperio, condensada · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto ('\n' parte renglones). Mayúsculas automáticas. |
| `textPortrait` | string | `""` | Versión para 9:16. |
| `at` | number | `0.2` | Segundo en que sube (acepta '@palabra'). −1 = ya está (continúa el título de imperio.title sin volver a entrar). |
| `shrinkAt` | number | `2.8` | Segundo en que empieza a achicarse (−1 = nunca). |
| `shrinkTo` | number [0.1–1] | `0.18` | Escala final a la que tiende. |
| `tau` | number [0.3–None] | `2.8` | Constante de tiempo del achique (s): más chico = más rápido. |
| `y` | number [0.1–0.9] | `0.68` | Centro vertical (fracción del alto) en 16:9. |
| `size` | number [0.2–0.95] | `0.62` | Ancho del renglón más largo (fracción del ancho) en 16:9; en 9:16 se usa 0.86. |
| `rise` | number [-0.3–0.3] | `0.06` | Mientras se achica sube hacia el centro (fracción del alto). |
| `tilt` | number [-15–15] | `0` | Giro inicial en grados. |
| `spin` | number [-3–3] | `0.25` | Grados por segundo que gira (acompaña al mapa). |

```json
{"use": "imperio.word", "params": {"text": "JAPANESE\nEMPIRE", "at": 0.2, "shrinkAt": 2.8, "shrinkTo": 0.18, "tau": 2.8}}
```

### `imperio.native`

Nombre en su IDIOMA ORIGINAL (kanji, alemán, ruso, árabe latinizado…) en gris grande: cada carácter entra con escala y desenfoque escalonados, la traducción en mayúsculas negras se tipea debajo, y al final se borra de derecha a izquierda (ref 4.9–9.9 s: '南進論 · SOUTHERN EXPANSION DOCTRINE'). Overlay sobre un plano con mapa claro (imperio.map / imperio.title).

Etiquetas: título, idioma original, kanji, doctrina, cita, traducción · capa: overlay

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Texto en el idioma original (corto: 1–3 palabras o 2–6 caracteres CJK). |
| `sub` | string | `""` | Traducción (mayúsculas automáticas). |
| `at` | number | `0.2` | Segundo en que entra el primer carácter (acepta '@palabra'). |
| `outAt` | number | `-1` | Segundo en que se borra (−1 = 1 s antes del final del beat). |
| `x` | number [0–1] | `0.64` | Borde izquierdo (fracción del ancho) en 16:9. En 9:16 va centrado. |
| `y` | number [0.1–0.9] | `0.6` | Línea base (fracción del alto). |
| `width` | number [0.1–0.9] | `0.3` | Ancho máximo (fracción del ancho) en 16:9; en 9:16 se usa 0.7. |
| `tilt` | number [-15–15] | `0` | Giro en grados. |

```json
{"use": "imperio.native", "params": {"text": "南進論", "sub": "DOCTRINA DE EXPANSIÓN AL SUR"}}
```

### `imperio.introv1`

GANCHO de apertura: sobre el atlas el SOL carmesí CAE (de 3× a su tamaño, con sacudida) y sus rayos estallan en 360°; el titular condensado blanco entra palabra por palabra con estela ('^palabra^' sobre franja carmesí); en burstAt los rayos se abren hasta los bordes con destello y sacudida. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none).

Etiquetas: intro, gancho, apertura, título, impacto, sol · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular gancho (2–7 palabras). '\n' = renglón; '^x^' = palabras sobre franja carmesí. |
| `kicker` | string | `""` | Rótulo chico arriba (lugar · fecha). |
| `sub` | string | `""` | Línea chica en itálica debajo del titular. |
| `country` | string | `""` | País foco del fondo atlas/archivo (rayado, el sol cae sobre él). Vacío = mundo y sol al centro. |
| `sunAt` | number | `0.15` | Segundo en que cae el sol. |
| `wordAt` | number | `0.7` | Segundo de la primera palabra. |
| `stagger` | number [0.06–None] | `0.2` | Segundos entre palabras. |
| `burstAt` | number | `2.6` | Impacto: los rayos llegan a los bordes (acepta '@palabra'; −1 = sin impacto). |
| `bg` | enum (auto / atlas / archivo / papel / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: atlas, archivo, papel; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.35` | Oscurecido del fondo foto/componente. |

```json
{"use": "imperio.introv1", "params": {"text": "EL IMPERIO QUE\nMIRÓ AL ^SUR^", "kicker": "Tokio · 1940", "sub": "la doctrina que llevó a la guerra del Pacífico", "country": "Japan"}}
```

### `imperio.introv2`

GANCHO pregunta + revelación: la pregunta se escribe carácter a carácter como el título en idioma original de la referencia (cada letra entra con escala y fantasma); en stampAt la pregunta sube y se achica, el SOL carmesí sale desde abajo detrás del centro con su abanico de rayos y la RESPUESTA sube en condensada blanca con degradé. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none).

Etiquetas: intro, gancho, apertura, pregunta, revelación, sol naciente · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Pregunta gancho ('\n' = renglón). |
| `kicker` | string | `""` | Rótulo chico arriba. |
| `stamp` | string | `""` | Respuesta (1–3 palabras) que sube con el sol (vacío = sin revelación). |
| `stampAt` | number | `2.6` | Segundo de la revelación (acepta '@palabra'). |
| `typeAt` | number | `0.35` | Segundo en que empieza a escribirse la pregunta. |
| `cps` | number [4–None] | `18` | Caracteres por segundo. |
| `country` | string | `""` | País foco del fondo atlas/archivo. |
| `bg` | enum (auto / atlas / archivo / papel / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: atlas, archivo, papel; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.35` | Oscurecido del fondo foto/componente. |

```json
{"use": "imperio.introv2", "params": {"text": "¿POR QUÉ UN IMPERIO\nMIRÓ HACIA EL SUR?", "kicker": "Pacífico · 1940", "stamp": "PETRÓLEO", "stampAt": 2.6, "country": "Japan", "bg": "archivo"}}
```

### `imperio.outro`

Cierre del canal SIN recuadro (bg: atlas | archivo | papel | image con src | component con use/useParams). GRACIAS POR VER → nombre del canal en condensada blanca que sube delante del SOL carmesí que sale desde abajo con sus rayos girando → LIKE (óvalo fino que se llena de carmesí) → flecha de línea fina → SUSCRÍBETE en franja carmesí + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Fundido a negro. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, sol · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"GRACIAS POR VER"` | Rótulo inicial. |
| `channel` | string | `"NODEPOLITICS"` | Nombre del canal (grande). |
| `cta` | string | `"SUSCRÍBETE"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte el video."` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodepolitics"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `country` | string | `""` | País foco del fondo atlas (vacío = mundo). |
| `bg` | enum (auto / atlas / archivo / papel / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: atlas, archivo, papel; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.5` | Oscurecido del fondo foto/componente. |

```json
{"use": "imperio.outro", "params": {"thanks": "GRACIAS POR VER", "channel": "NODEPOLITICS", "cta": "SUSCRÍBETE", "support": "Apoya el canal y comparte el video.", "handle": "youtube.com/@nodepolitics"}}
```

## memorias · MEMORIAS

### `memorias.title`

Portada 'Historical Memories': título manuscrito grande (Mr Dafoe) que se escribe de izquierda a derecha + subtítulo en Quicksand, sobre papel de yeso con humo gris; bocetos a lápiz de una o dos fotos en las esquinas (layout center) o un boceto grande a un costado con el texto arriba a la izquierda (layout side).

Etiquetas: apertura, título, portada, boceto · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `title` | string · obligatorio | `null` | Título manuscrito ('\n' parte renglones). |
| `sub` | string | `""` | Subtítulo chico (Quicksand). |
| `src` | image | `""` | Foto que se dibuja como boceto (arriba a la derecha en center; a la derecha en side). |
| `src2` | image | `""` | Segunda foto en boceto (abajo a la izquierda, solo center). |
| `layout` | enum (center / side) | `"center"` | center = título al medio y bocetos en las esquinas; side = texto arriba a la izquierda y boceto grande a la derecha. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `focus2` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `titlePortrait` | string | `""` | Título alternativo para 9:16 ('\n' parte renglones). |

```json
{"use": "memorias.title", "params": {"title": "La noche del Muro", "sub": "Berlín · 9 de noviembre de 1989", "src": "assets/media/brandenburgo.jpg", "src2": "assets/media/bernauer.jpg", "layout": "center"}}
```

### `memorias.scene`

El plano de la referencia: la foto aparece primero como BOCETO A LÁPIZ sobre el papel, después se colorea por manchas de tinta (reveal: full/right/left/center/bottom; lo demás queda en boceto), revienta una salpicadura de acuarela azul con gotas (negra con tone=bw) y aparece el bloque de texto: renglón manuscrito (kicker) + renglones en MAYÚSCULAS que se arman letra a letra (text, '\n' = renglón). Detrás, un recorte de periódico fantasma; zoom lento durante el plano y salida con humo.

Etiquetas: foto, lugar, monumento, acuarela, boceto, dato · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `src` | image · obligatorio | `null` | La foto (a color para lugares; cielo visible ayuda). |
| `kicker` | string | `""` | Renglón manuscrito arriba del bloque (Mr Dafoe). |
| `text` | string | `""` | Renglones en MAYÚSCULAS ('\n' parte renglones; 1–3 renglones cortos). |
| `kicker2` | string | `""` | Segundo renglón manuscrito, entre el 1.º y el 2.º renglón de text (como 'Modular Structure / FIRST… / Easily edit scenes / SECOND…'). |
| `pos` | enum (bl / tl / tr / br) | `"bl"` | Esquina del bloque de texto (bl abajo-izq., tl arriba-izq., tr arriba-der., br abajo-der.). |
| `tone` | enum (color / bw) | `"color"` | color = acuarela azul; bw = foto B/N con manchas de tinta negra (retratos, archivo). |
| `reveal` | enum (full / right / left / center / bottom / none) | `"full"` | Qué parte se colorea; lo demás queda en boceto (none = solo boceto). |
| `splash` | enum (auto / none / tl / tr / t / l / r / c / bl / br) | `"auto"` | Dónde revienta la salpicadura (auto = lejos del texto). |
| `splashSize` | number [0.08–0.7] | `0.26` | Radio de la salpicadura (fracción del lado corto; 0,5–0,7 = aguada grande que pinta el cielo). |
| `splashColor` | color | `""` | Color de la salpicadura (vacío = palette.splash, o tinta negra en bw). |
| `focus` | array | `[0.5, 0.5]` | Punto de interés [x,y] 0..1 para el recorte 'cover'. |
| `ghost` | bool | `true` | Recorte de periódico + titular fantasma en el papel. |
| `drift` | number [0–0.3] | `0.07` | Zoom lento durante el plano. |
| `cut` | enum (auto / wash / whip) | `"auto"` | Corte de SALIDA: wash = se borra con una mancha de papel mientras asoma el boceto siguiente; whip = barrido de cámara con estela y el siguiente entra deslizándose; auto = como la referencia (barrido cada 3 escenas). |

```json
{"use": "memorias.scene", "params": {"src": "assets/media/brandenburgo.jpg", "kicker": "Berlín, 1989", "text": "Puerta de Brandeburgo\nEl muro pasaba detrás", "pos": "bl", "reveal": "right", "splash": "auto"}}
```

### `memorias.introv1`

Gancho 'golpe': titular MANUSCRITO gigante (Mr Dafoe) que se escribe palabra a palabra sobre el papel, con rótulo en MAYÚSCULAS que se arma letra a letra arriba y subtítulo en Quicksand abajo; en dropAt revienta una salpicadura de acuarela azul detrás del titular con gotas y una sacudida, y la palabra ^marcada^ se tiñe de azul. Fondo: sketch (foto en boceto que se colorea) | smoke | image | component | none.

Etiquetas: intro, gancho, apertura, titular, acuarela · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | Titular manuscrito ('\n' = renglón; '^x^' = palabra que se tiñe de azul en el golpe). |
| `kicker` | string | `""` | Rótulo en MAYÚSCULAS arriba (se arma letra a letra). |
| `sub` | string | `""` | Línea chica abajo (Quicksand). |
| `wordAt` | number [0–None] | `0.45` | Segundo en que empieza a escribirse la primera palabra. |
| `stagger` | number [0.05–None] | `0.3` | Segundos entre palabra y palabra. |
| `dropAt` | number [-1–None] | `2.3` | Segundo del golpe (salpicadura + sacudida); −1 = sin golpe; acepta '@palabra'. |
| `bg` | enum (auto / sketch / smoke / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: sketch, smoke; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Velo de papel sobre el fondo (0 = nada; paleta clara: lava hacia el papel). |

```json
{"use": "memorias.introv1", "params": {"text": "La noche que\ncayó el ^Muro^", "kicker": "Berlín · 1989", "sub": "nadie dio la orden", "src": "assets/media/brandenburgo.jpg"}}
```

### `memorias.introv2`

Gancho 'pregunta + revelación': la pregunta en MAYÚSCULAS (Barlow 700) se arma letra a letra con glifos que parpadean; en stampAt la respuesta se escribe en manuscrita grande sobre una salpicadura de acuarela azul que revienta con gotas. Fondo: sketch | smoke | image | component | none.

Etiquetas: intro, gancho, pregunta, revelación, acuarela · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `text` | string · obligatorio | `null` | La pregunta ('\n' = renglón). |
| `kicker` | string | `""` | Renglón manuscrito chico arriba de la pregunta. |
| `stamp` | string | `""` | La respuesta (manuscrita grande sobre la salpicadura). |
| `stampAt` | number [0–None] | `2.4` | Segundo de la respuesta; acepta '@palabra'. |
| `typeAt` | number [0–None] | `0.35` | Segundo en que empieza a armarse la pregunta. |
| `cps` | number [4–None] | `22` | Letras por segundo de la pregunta. |
| `bg` | enum (auto / sketch / smoke / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: sketch, smoke; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.45` | Velo de papel sobre el fondo (0 = nada; paleta clara: lava hacia el papel). |

```json
{"use": "memorias.introv2", "params": {"text": "¿Quién abrió\nel muro?", "kicker": "Berlín, 1989", "stamp": "Nadie dio la orden", "src": "assets/media/bernauer.jpg"}}
```

### `memorias.outro`

Cierre del canal como la tarjeta final de la referencia: una mancha de tinta NEGRA crece desde abajo a la izquierda y traga el cuadro (bg ink; paper = sobre el papel con texto oscuro; image/component/none = contrato común) → 'gracias por ver' en sans fina → nombre del canal en manuscrita grande que se escribe → pulgar LIKE a trazo que se rellena con gotas azules → flecha fina → SUSCRÍBETE armado letra a letra + campana que suena → mensaje de apoyo → dirección en mayúsculas chiquitas. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).

Etiquetas: cierre, canal, like, suscribirse, tinta · capa: main

| parámetro | tipo | por defecto | qué hace |
|---|---|---|---|
| `thanks` | string | `"gracias por ver"` | Rótulo inicial. |
| `channel` | string | `"Memorias"` | Nombre del canal (grande). |
| `cta` | string | `"Suscríbete"` | Texto del botón de suscripción. |
| `support` | string | `"Apoya el canal y comparte la historia"` | Mensaje de apoyo. |
| `handle` | string | `"youtube.com/@nodehistory"` | Dirección del canal (sin '@' al principio: el motor toma '@x' como ancla). |
| `arrow` | bool | `true` | Flecha del LIKE a SUSCRÍBETE. |
| `likeAt` | number [0–None] | `1` | Segundo del LIKE. |
| `subscribeAt` | number [0–None] | `2.5` | Segundo de SUSCRÍBETE. |
| `bellAt` | number [0–None] | `3.25` | Segundo de la campana. |
| `supportAt` | number [0–None] | `3.65` | Segundo del mensaje de apoyo y la dirección. |
| `bg` | enum (auto / ink / paper / image / component / none) | `"auto"` | Fondo: auto = el del diseño; presets: ink, paper; image = foto en src; component = otro componente (use/useParams); none = liso. |
| `src` | image | `""` | Foto de fondo (bg=image o para el componente de fondo): encuadre cover con zoom lento y el tratamiento de color del diseño. |
| `focus` | array | `[0.5, 0.5]` | Punto de interés de la foto [x,y] (0..1). |
| `use` | string | `""` | Componente de fondo (bg=component), p. ej. 'enmienda.map'. |
| `useParams` | object | `{}` | Parámetros del componente de fondo (si no trae foto, recibe src). |
| `dim` | number [0–1] | `0.7` | Oscurecido del fondo foto/componente (el cierre tiene texto blanco). |

```json
{"use": "memorias.outro", "params": {"thanks": "gracias por ver", "channel": "Memorias", "cta": "Suscríbete", "support": "Apoya el canal y comparte la historia", "handle": "youtube.com/@nodehistory"}}
```

## Iconos de la familia binary (`icon`)

`bulb` · `question` · `key` · `lock` · `ship` · `submarine` · `apple` · `gear` · `envelope` · `clock` · `globe` · `phone` · `gavel` · `heart` · `bell` · `chip` · `waves` · `check` · `cross` · `hourglass` · `eye` · `person` · `house` · `book` · `moon` · `radar` · `keyboard` · `banknote` · `flask` · `crown` · `bombe` · `soldier` · `wheat` · `fuel` · `microphone` · `document` · `tv` · `barrier` · `hammer` · `water` · `radio`

## Bocetos de la familia rough (`icon`)

`understand` · `design` · `build` · `measure` · `ship` · `laptop` · `linux` · `work` · `spark` · `homelab` · `browser` · `database` · `terminal` · `waves` · `swipe` · `scribble` · `flight` · `cup` · `hook` · `star` · `bulb` · `pencil` · `question` · `up` · `ring` · `cube` · `notebook` · `tv` · `scales` · `car` · `gradcap` · `drop` · `megaphone` · `plate` · `dumbbell` · `calendar` · `bag` · `heart` · `pin` · `circle` · `underline` · `arrow` · `ai` · `camera` · `cloud` · `bot` · `mouse` · `lock` · `code` · `phone` · `server` · `eye` · `link` · `sun` · `plus` · `close` · `rocket` · `lm` · `moon` · `earth` · `alarm` · `chip` · `dsky` · `radar` · `flag` · `astronaut` · `woman` · `person` · `headset` · `papers` · `fuel` · `crater` · `rocks` · `footprint` · `switch` · `warning` · `check` · `clock` · `gear` · `target` · `keyboard` · `battery` · `loop` · `stopwatch` · `book` · `paper` · `cursor` · `coin` · `gift` · `nextcube`
