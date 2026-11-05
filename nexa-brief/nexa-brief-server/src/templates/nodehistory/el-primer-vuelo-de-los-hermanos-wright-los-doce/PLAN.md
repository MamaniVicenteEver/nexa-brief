# PLAN · Doce segundos

## 1. Pedido
NodeHistory, binary, narrativa documental. Primer vuelo del 17 de diciembre de 1903. Prueba autorizada `short_preparation`, objetivo dos minutos, rango de status 220–260 palabras. Esta fase entrega guion, medios y paquete preliminar. El host genera voz real, transcripción y cierre; después se monta. Sin render ni publicación.

## 2. Tesis y emoción
Punto crítico: Orville deja el riel en el Flyer. Tesis: doce segundos reunieron motor, sustentación y control tras años de ensayos. Tensión y asombro. Puente: cada despegue cotidiano recuerda un proceso de pruebas.

## 3. Investigación
Fuentes consultadas el 2026-11-02; hechos históricos, sin cifras de actualidad. Fecha editorial no visible: no se inventa.

Fuentes:
- S: https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000
- N: https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm
- F: https://www.nps.gov/places/3-four-powered-flights.htm
- W: https://www.nps.gov/articles/wrightflyer.htm
- L: https://www.loc.gov/collections/wilbur-and-orville-wright-papers/articles-and-essays/the-wilbur-and-orville-wright-timeline-1846-to-1948/1901-to-1910/

| # | Hecho | Fuente | Uso |
|---|---|---|---|
| 1 | Primer vuelo el 17 diciembre 1903, Orville a los mandos | https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000 | s02/s06 |
| 2 | Lugar: Kill Devil Hills, cerca de Kitty Hawk, Carolina del Norte | https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm | s01/s02 |
| 3 | Primer despegue a las 10:35 | https://www.nps.gov/articles/wrightflyer.htm | s06 |
| 4 | Primer vuelo: 12 segundos, 120 pies ≈36 metros | https://www.nps.gov/places/3-four-powered-flights.htm | s07 |
| 5 | Ensayaron planeadores antes del avión con motor | https://airandspace.si.edu/collection-objects/1903-wright-flyer/nasm_A19610048000 | s03 |
| 6 | El control de balanceo, ascenso/descenso y dirección fue crucial | https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm | s03 |
| 7 | Intento fallido de Wilbur el 14 diciembre, dañó el elevador | https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm | s04 |
| 8 | El 17 despegaron desde riel sobre terreno llano | https://www.nps.gov/articles/wrightflyer.htm | s05 |
| 9 | John Daniels tomó la fotografía al dejar el riel | https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm | s06 |
| 10 | Cuatro vuelos; cuarto con Wilbur: 59 segundos, 852 pies ≈260 metros | https://www.nps.gov/places/3-four-powered-flights.htm | s08 |
| 11 | Una ráfaga dañó el Flyer después; no volvió a volar | https://www.nps.gov/articles/wright-brothers-national-memorial-site-of-the-first-controlled-powered-flight-teaching-with-historic-places.htm | s09 |

Cifras clave con dos instituciones: doce segundos/120 pies (S, F); cuarto vuelo 59 segundos/852 pies (F, L). Conversiones redondeadas. No decir «primer humano en volar»: existían globos y planeadores. Precisar vuelo con motor, tripulado, sostenido y controlado. No presentar este aparato aún inestable como avión comercial práctico. No usar los 57 segundos erróneos del telegrama.

## 4. Título y gancho
A: Los doce segundos que cambiaron el vuelo.
B: El primer vuelo de los Wright duró doce segundos.
C: La foto del despegue que abrió una era.
Pantalla: DOCE SEGUNDOS. Kicker: KILL DEVIL HILLS · 1903.
Gancho: «En Kill Devil Hills, una fotografía está a punto de cambiarlo todo».
Bucle: ¿por qué un vuelo tan breve resultó decisivo? Respuesta: motor, piloto y pruebas repetidas.

## 5. Arco
| Acto | Segmentos | Intensidad | Acción |
|---|---|---|---|
| Gancho | s01 | .75 | Foto y pregunta |
| Contexto | s02–s03 | .5–.65 | Fecha, lugar y ensayos |
| Bajada | s04 | .4 | Intento fallido |
| Giro | s05 | .75 | Volver a intentarlo |
| Clímax | s06–s07 | .9–1 | Despegue y doce segundos |
| Consecuencia | s08 | .6 | Cuatro vuelos |
| Caída | s09 | .3 | Daño definitivo |
| Cierre | s10 | .65 | Callback y pregunta |

## 6. Letra grande
«Doce segundos»; «treinta y seis metros»; «no volvió a volar». Rótulos breves, sin repetir toda la frase. Clímax después de la mitad.

## 7. Inventario visual
### 7a. Biblioteca y decisión
Consultado `kit.py library`: los binary aprobados crisisdesk, midnightrelay y y2kfield representan informática/calendarios, no aviación. Sin componentes propios: status exige cero para esta prueba; el avión real se ve mejor en fotografía histórica. No crear mecanismos inventados.
| Objeto | Segmentos | Clímax | Solución |
|---|---|---|---|
| Flyer, Orville, Wilbur y riel | s01/s05/s06 | sí | binary.introv2/frame con foto |
| Planeador Wright | s03 | no | binary.frame con foto de 1902 |
| Duración y distancia | s07 | sí | binary.counter/word |
| Secuencia de vuelos | s08 | no | binary.timeline |
### 7b. Mapa previo, sin storyboard
s01 introv2 primer vuelo; s02 title fecha; s03 frame planeador; s04 word; s05 frame riel; s06 introv2 primer vuelo; s07 counter; s08 introv2 cuarto vuelo; s09 word; s10 question.
Continuación: ≥16 momentos narrados; un apoyo introv2 por tercio; fotos 5–10 s, cada archivo máximo dos usos. Sin anclas ni tiempos sintéticos antes del audio. Sin logos: las instituciones son fuentes, no protagonistas.

## 8. Medios (frases/shows/query registrados antes de buscar)
| Frase | Archivo | shows | query |
|---|---|---|---|
| una fotografía | primer-vuelo.jpg | Flyer saliendo del riel, Orville tumbado y Wilbur al lado | Wright brothers first flight December 17 1903 John Daniels; First flight Wright Flyer 1903 |
| probaron planeadores | planeador.jpg | planeador Wright de 1902 en ensayo | Wright 1902 glider in flight; Wright brothers glider 1902 Kitty Hawk |
| cuarto | cuarto-vuelo.jpg | Búsqueda de Flyer durante el cuarto vuelo; no se seleccionó un resultado aéreo inequívoco | Wright Flyer fourth flight December 17 1903; Wilbur fourth flight 1903 |
| lo daña gravemente | flyer-danado.jpg | Flyer dañado en tierra tras la jornada del 17 diciembre 1903 | 1903 Wright Flyer damaged on ground after final flight; Wright fourth flight 1903 |
Buscar video con search-concept en bancos configurados. Si no hay película pertinente, usar estas fotos con movimiento lento. Nunca aviones actuales como relleno. Revisión de originales en work/media-review.md; copiar shows/query al storyboard y completar media_review tras hojas con audio.

Reemplazo del planeador antes de descarga: frase «Antes probaron planeadores»; shows: planeador Wright de 1902 en vuelo con piloto; query: «1902 Wright glider flight», «Wright 1902 glider in flight». Archivo planeador-vuelo.jpg, seleccionado tras descartar el negativo dañado.

Alternativa seleccionada antes de descargar: fotografía del aparato dañado. No presentarla como imagen del cuarto vuelo en el aire. El tercer tercio llevará introv2 con esta foto durante s09; s08 usará timeline/cifras. La foto de 1902 muestra preparación del planeador, no vuelo: rótulo explícito «ENSAYOS · 1902».

Selección final revisada: primer-vuelo.jpg, planeador-vuelo.jpg y flyer-danado.jpg. El reemplazo del planeador sí muestra vuelo. planeador.jpg queda descartada del montaje por daños del negativo. La imagen del aparato dañado documenta el estado tras el cuarto vuelo; no se atribuye visualmente ese daño a la ráfaga posterior. Revisión escrita en work/media-review.md. `kit.py components`: sin componentes propios, nada que revisar.

## 9. Publicación
Paquete v2 preliminar local; tres títulos anteriores, A/B/C y comentario en publish.json. Capítulos pendientes de manifest con voz real: no inventar segundos. Outro del canal reservado al host.

## 10. Riesgos y verificación
No confundir primer y cuarto vuelo ni planeador de 1902 y Flyer de 1903. Preservar avión y Wilbur en encuadre. Cero componentes nuevos o descartados. Sin checks dependientes de audio en fase guion. Duración efectiva, ppm y hojas en ambas orientaciones pendientes de voz real.

### Continuación con audio · 2026-11-02
Guion y voz conservados: 231 palabras, short_preparation, target_minutes=2. QC vigente del host: 118 ppm, WER aproximado 0,009; «kill»/«keel» corresponde a la transcripción del nombre propio Kill Devil Hills, sin omisión de contenido indicada. Outro desde 119,26 s; cierre del canal hasta 133,69 s.
Storyboard: 25 entradas, incluidas la pregunta final y su fondo simultáneo. Tres fotografías históricas utilizadas en cuatro apoyos; primer vuelo dos usos, planeador y aparato dañado uno cada uno. Ningún clip genérico ni componente propio. Cada tercio tiene miniatura; foto de 1902 identificada como ensayo y foto del aparato dañado identificada como posterior al cuarto vuelo, sin atribuir visualmente sus daños a la ráfaga.
La primera revisión de hojas detectó cifras intermedias de la animación slot: sustituidas por valores fijos desde el comienzo del contador; hora 10:35 en binary.word. Se conserva el diseño binary del catálogo. Publicación v2 validada sin errores ni avisos.
Capítulos editoriales: se conservan los dos capítulos del manifest, y se añade al paquete 1:48, «Años de pruebas para un primer paso», coincidente con la reflexión final a 108,91 s. No se alteran las etiquetas del guion ni se solicita nueva voz. El generador de manifest deriva únicamente los dos capítulos del guion; el tercero pertenece al paquete de publicación.
Avisos de estilo aceptados: predominan las miniaturas sobre cuatro apoyos; hay rachas de rótulos y contadores, apoyos de 8,6–9,7 s y pregunta final de 12 s. Son fotografías pertinentes y pausas documentales dentro de la prueba corta; no se añaden clips de relleno. Sin render, publicación, commit ni push.

### Reparación final de storyboard
Adaptados los tiempos al audio vigente: foto final de 7,15 s, fondo y pregunta de 12,76 s hasta el outro (119,26 s), sin hueco. Revisadas nuevamente ambas hojas: textos completos y tres fotografías visibles. `kit.py check`: cero errores, avisos de estilo conservados; `publishing build` y `publishing check`: cero errores y cero avisos. No se cambió el guion ni se generó voz. El generador de hojas sigue notificando un 404 sin ruta; no falta ninguna imagen prevista en las hojas. Duración total con cierre: 133,69 s. Sin delegación adicional.
