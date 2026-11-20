# Atlas en Movimiento · análisis de las 5 referencias (2026-11-03)

Fuente: `sandbox/referencias/nodeaction/mapsVideo/` (las 5 son 9:16, 30 fps, 63–75 s).
Método: hoja de contacto a 1 fps de cada video completo + fotogramas de detalle a 360×640 en los momentos clave
+ tiras a 3–4 fps donde importa el movimiento. Evidencia guardada en `work/ref/` (21 JPG, 3.7 MB):
`refN-hoja-a/b.jpg` (video entero), `refN-detalle*.jpg`, `ref4-bombarderos-0-3s.jpg`, `ref5-flota-51-58s.jpg`,
`ref5-camara-26-30s.jpg`. Los avatares (muñecos que hablan) se ignoran por pedido del usuario.

**O** = observado en fotogramas. **S** = supuesto/inferido (no se puede medir en el video).

| # | Archivo | Duración | Resolución | Tema |
|---|---|---|---|---|
| 1 | ssstik.io_1793686568465.mp4 | 67.6 s | 720×1280 | Rusia vs. Europa: frentes con fichas |
| 2 | ssstik.io_1793686620253.mp4 | 75.4 s | 576×1024 | Israel–Irán: banderas, reactores, ataques |
| 3 | ssstik.io_1793686650963.mp4 | 70.2 s | 720×1280 | Yemen–Omán: rutas, dinero, barcos atacados |
| 4 | ssstik.io_1793686663539.mp4 | 64.7 s | 720×1280 | Irán–EE. UU.: bombarderos, bases, periódico |
| 5 | ssstik.io_1793687890909.mp4 | 63.1 s | 720×1280 | Armada rusa: portaaviones, submarinos, torpedos |

## Lenguaje común a las 5 (O)
- **Mapa base**: satélite con relieve sombreado y **batimetría visible** en el océano (fosas y dorsales marcadas en
  ref5 0:37–0:58). Océano azul petróleo oscuro, viñeta fuerte en los bordes. Vista cenital (sin inclinación 3D).
- **Territorios**: color plano **mezclado con el relieve** (la textura del satélite se ve a través: efecto
  multiplicar/color, no relleno opaco). Borde fino claro o amarillo con leve brillo. Rusia roja en ref1/ref5,
  Irán verde en ref4, Omán cian/Yemen naranja con brillo de borde en ref3.
- **Cámara**: cortes + movimientos rápidos; los vuelos largos van con **desenfoque de movimiento** y a veces
  ligera **rotación** (ref5 0:26.5–0:29: mundo → Rusia → Kamchatka en ~2.3 s con zoom acelerado y giro;
  ref4 0:00–0:03: seguimiento de bombarderos con barrido inclinado y estela). Entre vuelos, encuadre casi quieto.
- **Escala simbólica**: unidades y objetos fuera de escala real (un portaaviones puede cubrir media Rusia como
  «objeto héroe»), pero coherentes entre sí dentro de cada plano.
- **Tipografía**: palabra única grande en pantalla (subtítulo palabra a palabra); rótulos de país en mayúsculas
  blancas con sombra o en «neón» con brillo de color.

## Referencia 1 · ssstik.io_1793686568465 (frentes y fichas)
| t | O: qué se ve | Componente |
|---|---|---|
| 0:01–0:02.5 | Retrato del dirigente dentro de un **octógono con borde amarillo neón** anclado al país; crece desde un punto | `portrait.badge` (marco octógono) |
| 0:02–0:03, 1:06 | Rusia entera cubierta por la **bandera imperial** (negro-amarillo-blanco) recortada por la costa; las franjas siguen la pantalla, no la latitud | `territory.flag` |
| 0:04–0:09 | Bielorrusia con su bandera recortada; Rusia con su tricolor; bordes amarillos finos | `territory.flag` + `border` |
| 0:11–0:19 | Ucrania con bandera; **fichas** (octógonos con fondo de bandera y cabeza de soldado con casco, aro dorado) en fila sobre el frente; el relleno pasa de bandera a rojo a medida que avanzan (barrido) | `unit.token` + `territory.state` (conquista progresiva) |
| 0:16.5, 0:45.5 | **Choque**: destello azul-blanco entre fichas enfrentadas | `fx.clash` |
| 0:20–0:26 | Ficha UE grande (octógono azul con estrellas, soldado) que aparece y late | `unit.token` (tamaño héroe) |
| 0:27–0:33 | Kazajistán amarillo; fila de fichas rusas en la frontera norte | `unit.group` (formación en línea) |
| 0:48–1:00 | Dos frentes enfrentados (UE azul vs. Rusia roja), muchas fichas a cada lado; el azul **empuja** y luego **retrocede** («counter») | `unit.advance` / `unit.retreat` + `front.line` |
| 1:03–1:05 | La mancha roja se expande hacia el oeste sobre los bálticos | `territory.state` (expansión) |

## Referencia 2 · ssstik.io_1793686620253 (banderas, instalaciones, ataques)
| t | O | Componente |
|---|---|---|
| 0:00–0:01.5 | Recorte fotográfico del dirigente **saliendo del territorio** con borde blanco brillante; bandera tapando la boca (estilo meme, no lo copiamos) | `portrait.cutout` (anclado a país) |
| 0:02–0:06 | **Flechas curvas blancas** gruesas con punta, entrando desde fuera de cuadro | `arrow.curve` |
| 0:04–0:09 | Pegatina de icono (brazos + misil) sobre el país | `icon.sticker` (no prioritario) |
| 0:04–1:11 | **Banderas en mástil** pequeñas plantadas en cada país (Israel, Irán) sin pintar el territorio | `flag.marker` (modo 2) |
| 0:26–0:29, 1:09 | Símbolo de radiación que late | `icon.badge` |
| 0:30–0:38 | Irak rojo con **extrusión 3D** (losa con canto en sombra); **planta isométrica** sobre loseta verde; año «1981»/«2007» grande en perspectiva; explosión de fuego + humo negro sobre la planta, después hongo de humo | `territory.extrude`, `site.plant` (isométrico), `text.year`, `fx.explosion` + `fx.smoke` |
| 0:40–0:47 | «JUNE 2025» girado siguiendo la diagonal del mapa | `text.year` (rotado) |
| 0:47, 0:50, 1:02, 1:05 | **Trazo rojo fino y brillante** (misil) que cruza y termina en explosión con humo | `strike.missile` |
| 0:58 | Varias explosiones simultáneas sobre Israel | `fx.explosion` (salva) |

## Referencia 3 · ssstik.io_1793686650963 (rutas, dinero, barcos atacados)
| t | O | Componente |
|---|---|---|
| 0:01–0:07 | Rótulos **neón** de país (YEMEN naranja, OMAN cian) con brillo; Omán con borde brillante cian | `label.neon` + `territory.glow` |
| 0:08–0:09 | Iconos de pozo/barril dispersos dentro de los países (reservas) | `site.oilfield` (disperso) |
| 0:10–0:15, 0:45–0:55 | **Rutas marítimas**: haz de líneas blancas finas curvas que convergen en Ormuz y Bab el-Mandeb; chip blanco «STRAIT OF HORMUZ» | `route.lanes` + `label.chip` |
| 0:17–0:30 | Recortes de dirigentes con etiquetas neón «RICH/POOR», texto «YEARS» con brillo | `portrait.cutout` + `label.neon` |
| 0:37–0:42 | Iconos redondos rojos con rótulo manuscrito (Dictatorship, Arab Protest, Proxy War) | `icon.chip` |
| 0:45–0:50 | **Fajos de billetes** que se deslizan y apilan sobre Omán | `money.stack` |
| 0:56–1:02 | Barcos mercantes vistos desde arriba en el Mar Rojo; varios **en llamas** con humo | `ship.cargo` + estado `burning` |
| 1:03–1:09 | Varias banderas en mástil apiladas (Reino Unido, EE. UU., Arabia Saudita) | `flag.marker` (grupo) |

## Referencia 4 · ssstik.io_1793686663539 (bombarderos, bases, periódico)
| t | O | Componente |
|---|---|---|
| 0:00–0:03 (tira 4 fps) | **Bombarderos** (siluetas oscuras tipo ala volante, con sombra) salen de EE. UU.; **estelas blancas dobles** con cabeza amarilla brillante; la cámara los **sigue** cruzando el Atlántico con desenfoque | `air.bomber` + `trail.contrail` + `camera.follow` |
| 0:03–0:06 | Irán verde con borde naranja; **círculo de alcance** rojo discontinuo; manchas naranjas de impacto dentro del círculo | `range.ring` + `fx.impact` |
| 0:07–0:09, 0:53–0:56 | **Rayo** amarillo zigzag de un continente a otro | `arrow.bolt` |
| 0:10–0:15 | **Periódico** inclinado con titular encima del **recorte del presidente de Irán** (que señala); el periódico tiene cabecera de medio real → **no se replica el titular**, solo la composición | `editorial.press` (retrato + documento) |
| 0:16–0:27 | **Bases militares 3D** isométricas sobre Qatar, Bahréin, EAU, Arabia; países rosa/verde con rótulo amarillo manuscrito | `site.base` (isométrico) |
| 0:24–0:28 | Banda roja con texto en diagonal | `label.banner` |
| 0:28–0:29 | Flecha/trazo rojo hacia EE. UU. | `strike.missile` |
| 0:31–0:34 | Retratos pequeños dentro de EE. UU. (dos dirigentes) con rótulo | `portrait.badge` |
| 0:38–0:44 | Emblema grande + triángulos de advertencia + iconos rojos redondos | `icon.badge` + `icon.warning` |
| 0:38–0:39 (S) | Siluetas pequeñas oscuras sobre Canadá: probablemente aeronaves/drones | `air.*` |
| 0:45–0:54 | Línea ondulada naranja brillante que une EE. UU. con Oriente Medio pasando por iconos | `arrow.flow` (ondulada) |
| 0:59–1:03 | Puntos amarillos que aparecen escalonados dentro de EE. UU. (objetivos) | `marker.dots` |
| Nota | **No hay caída de bombas visible** a 1 fps ni en la tira 0–3 s; las «bombas» se resuelven como impactos naranjas dentro del círculo (O). Implementaremos la caída como acción propia, documentada como agregado | `air.drop` (agregado) |

## Referencia 5 · ssstik.io_1793687890909 (portaaviones y animación naval) — NUEVA
| t | O | Componente |
|---|---|---|
| 0:02–0:03 | **Portaaviones** recorte fotorrealista cenital-3/4 (gris, isla a estribor, aviones aparcados en cubierta, contorno oscuro) delante del dirigente; **contador** verde circular con número que **rueda** (2→3) | `naval.carrier` (modo héroe) + `badge.count` |
| 0:04–0:09 | EE. UU. naranja **rayado** + **inventario**: una fila de portaaviones dentro del territorio (cantidad = 11); contador «11»; avión oscuro con sombra sobre Canadá | `inventory.units` + `badge.count` + `air.jet` |
| 0:06–0:07 | China verde con 3 portaaviones dentro, contador 2→3 | `inventory.units` |
| 0:12–0:13 | Un portaaviones enorme **sobre** Rusia (objeto héroe, escala simbólica) | `naval.carrier` (`scale` grande) |
| 0:14–0:15 | **Cuatro portaaviones** en el mar de Ojotsk, orientados en diagonal (rumbo común), sombra suave | `naval.group` (formación) |
| 0:17 | Explosiones de fuego con **anillos de onda** concéntricos sobre los barcos | `fx.explosion` + `fx.shockwave` |
| 0:19–0:20.5 | **Anillos de detección** alrededor de cada barco; **salva de misiles**: estelas blancas curvas con cabeza amarilla que llegan desde el océano | `state:targeted` + `strike.salvo` |
| 0:21–0:26 | Portaaviones héroe sobre Rusia + rótulo RUSSIA + **pila de billetes** + cifra «$13 TO $14 BILLION» inclinada | `money.stack` + `label.figure` |
| 0:26.5–0:29 | **Transición de cámara**: zoom acelerado con giro y desenfoque (mundo → Kamchatka) | `camera.zoomThrough` |
| 0:29–0:34 | **Submarinos** cenitales (silueta azul translúcida) con **rótulo azul + línea guía + estrella amarilla** (KAZAN, BELGOROD, KNYAZ VLADIMIR); rótulo se escribe letra a letra | `naval.submarine` + `label.callout` |
| 0:36–0:41 | Submarino KAZAN **dispara**: destello en popa, 2–3 **torpedos** como trazos azules brillantes hacia 3 buques con **anillos de sonar** | `naval.fire` + `strike.torpedo` + `state:detected` |
| 0:42–0:44 | Los 3 buques **en llamas** (0:42) y después **calcinados/oscurecidos** con humo (0:44) | estados `burning` → `wrecked` |
| 0:45–0:48 | Título neón amarillo «POSEIDON» + rejilla de iconos de torpedo azules (inventario de armas); submarino de perfil grande | `label.neon` + `inventory.icons` |
| 0:50–0:51 | **Abanico** de torpedos azules desde el submarino | `strike.salvo` (abanico) |
| 0:52–0:56 (tira 3 fps) | **Grupo de combate**: portaaviones + 3–4 escoltas en formación; torpedos llegan → destellos rojo-naranja → barcos quemados; barrido de cámara rápido con desenfoque | `naval.group` + estados |
| 0:57–0:58 | Torpedo llega a la costa oeste de EE. UU. → **onda azul** circular («tsunami»); jet oscuro con sombra sobre Canadá | `fx.shockwave` (agua) + `air.jet` |
| 0:59–1:00 | **Ficha foto** (foto real del submarino + bandera + título) con **haz triangular** que baja hasta la unidad en el mapa | `callout.photo` (haz) |
| 1:01–1:02 | Plano aparte: submarino 3D sobre negro con tubos abiertos (fuera del mapa) | no se replica (plano de producto) |

**Despegues/aterrizajes:** no aparecen (O: revisado a 1 fps todo el video y a 3 fps 0:51–0:58). Los aviones solo
cruzan el mapa con sombra. Como la demo necesita contar un ataque aéreo desde el portaaviones, se implementa una
acción `launch`/`recover` sobria (avión que sale por la proa con estela corta) y se documenta como **agregado**
no presente en las referencias.

**Silueta y escala del portaaviones (O):** cubierta en ángulo con isla a estribor, aviones aparcados en filas,
contorno oscuro de 1–2 px, sombra difusa hacia abajo-derecha, sin estela visible en las tomas quietas; en
formación las escoltas son ~1/3 de la eslora del portaaviones. **Orientación**: proa en el sentido del movimiento.
**Profundidad**: sombra separada del casco (S: sombra con desplazamiento fijo, no proyección real).

## Matriz referencia → componente → demo → comprobación

Verificación del episodio de 262,84 s. Tiempos en segundos desde el inicio; las imágenes de `work/escena/cuadros/` son capturas reales a 1080×1920. Hoja general: `work/escena/hojas/episodio-36.jpg`; tiras completas de bloques 1 y 6 a 10 fps. Las exclusiones siguen `work/research/ESTRUCTURA.md`: la referencia visual no obliga a inventar hechos para llenar el catálogo.

| Referencia e instante | Componente aplicado | Momento del demo (s) | Comprobación |
|---|---|---|---|
| ref1 0:02, 0:04 | `territory.flag`: Irán `fill`, Irak `marker`; `territory.glow` | 25,23–35,50 | `cuadros/030.00.png`; ambos modos; auditoría de parámetros en `auditoria.json` |
| ref2 0:04–1:11 | `flag.marker`, cambio KW → US sobre **dos** mercantes | 137,83; tránsito 145,13–151,63 | `cuadros/138.50.png`, `147.00.png`; ambas banderas, rutas verificadas sobre agua |
| ref1 0:11–0:19, 0:48–1:00 | `unit.advance`, `unit.retreat`, `front.line` | 30,85–40,80; 53,95–59,03 | `cuadros/037.25.png`, `055.00.png`; leyenda «aproximado»; sin `territory.state` de conquista sin cartografía respaldada |
| ref1 0:16,5 | `fx.clash` excluido de esta narración | No aplica | Se muestran movimientos y frentes; el guion no identifica un choque puntual para ese destello |
| ref3 0:10–0:15 | `route.sea`, `route.lanes`, `label.chip` | 76,33–90,19 | `cuadros/084.00.png`; Kharg, Sirri y Ormuz separados; «rutas esquemáticas» |
| ref4 0:45–0:54 / ref2 0:02 | `arrow.flow` y `arrow.route` | 76,33–90,19; 30,85–40,80 | `cuadros/084.00.png`, `037.25.png`; flujo marítimo y direcciones terrestres |
| ref4 0:07 | `arrow.bolt` excluido | No aplica | Sin ataque intercontinental que el episodio no relata |
| ref3 0:45–0:50, ref5 0:23 | `money.flow`, adaptación sin cifras | 76,33–90,19 | `cuadros/084.00.png`; sin montos, porcentajes ni destino ficticio. `money.stack` queda en galería `work/tactico/sheets/economy.jpg` |
| ref3 0:56–1:02 | `naval.cargo` + `hit`; daño acorde al relato | Bridgeton 13,11; Iran Ajr 162,37 | `cuadros/013.40.png`, `161.95.png`; tira B1; Bridgeton nunca `sunk` ni `burning` |
| ref5 0:36–0:44 | `naval.warship`, `strike.missile`, `hit→burning→sunk` | 199,05–202,90 | `cuadros/199.60.png`, `199.85.png`, `201.60.png`, tira B6-03/04; Sahand y Joshan. Sin torpedos; Sabalan solo `hit` a 204,15 |
| ref5 0:02, 0:12, 0:14, 0:52 | `naval.carrier` supercarrier con cubierta y 3 escoltas | 188,75–198,25; plano asentado desde 190,70 | `cuadros/195.50.png`, tira `bloque-6-10fps-03.jpg`; Enterprise al este de Ormuz, mar Arábigo |
| ref5 0:04–0:07 | `inventory.units` / `badge.count` excluidos | No aplica | Sin inventarios nacionales ni cifras de misiones. Los 12 dibujos de cubierta son simbólicos; ejemplo de biblioteca en `work/tactico/sheets/editorial.jpg` |
| ref5 0:29–0:34 | `naval.submarine` excluido; `label.callout` sí aplicado | Jorramchar 36,61–59,03 | `cuadros/044.70.png`, `055.00.png`; ningún submarino inventado |
| ref5 0:59 | `callout.photo` con haz | 164,50–169,97 | `cuadros/166.90.png`; A05, minas del Iran Ajr, **22 sep 1987** y crédito. A02 a 251,69–254,84, fechada 22 ago 1987 |
| ref4 0:00–0:03 | `air.jet`, `trail.contrail`; `camera.follow` naval | Reactor 97,17–111; follow 4,85–21,85 y 191,59–197,89 | `cuadros/099.00.png`, tiras B1/B6, `camara.json`; sin bombardero de tipo no documentado |
| agregado (ref4 sin caída visible) | `air.drop` sobre Sabalan | 203,15–205,40 | `cuadros/205.00.png`, tira B6-04; bomba guiada respaldada en G35, caída esquemática |
| agregado (ref5 sin despegues) | `air.launch`, dos A-6 de biblioteca | 194,05 y 194,75 | `cuadros/194.80.png`, `195.50.png`, `196.50.png`, tira B6-03; recorrido de cubierta y salida por proa. Sin recuperación no narrada |
| ref4 0:38 (S); helicóptero agregado | `air.helicopter`, tres unidades; `strike.salvo` de cohetes | 154–164,50; ataque 161,77 | `cuadros/161.95.png`; 1 observador + 2 atacantes desde Jarrett, roles rotulados |
| ref2 0:30–0:38 | `site.refinery`, `site.platform`, `fx.smoke`, daño | Abadán hit 44,81; plataformas hit 185,67 | Hoja general 52,15 y `cuadros/186.40.png`, tira B6-02; refinería y plataformas diferenciadas |
| ref4 0:16–0:27 | `site.port`, terminal exportador | Kharg 67,75–90,19; daño 107,91 | `cuadros/074.50.png`, `084.00.png`, `111.75.png`; Kharg no es refinería ni base inventada |
| ref2 0:47, 1:02 | `strike.missile`, dos Exocet | 123,47 y 123,85 | `cuadros/124.50.png`; auditoría de dos proyectiles; lanzador fuera de campo, modelo aéreo discutido |
| ref5 0:17, 0:57 | `fx.impact` y `fx.shockwave` de agua contenida | Bridgeton 13,11; Roberts 173,53 (impacto) | `cuadros/013.40.png`, `174.00.png`, tiras B1-02/B6-01; sin tsunami ni celebración |
| ref4 0:03 | `range.ring` excluido | No aplica | Sin alcance cuantificado respaldado para dibujar un círculo operacional |
| ref1 0:01, ref2 0:00, ref3 0:17 | `portrait.badge`; retrato en `editorial.press` | Sadam/Jomeini 26,41–34,80; Reagan 126–133,81 | `cuadros/030.00.png`, `129.50.png`; cargos y fechas de fotos, sin montaje meme |
| ref4 0:10–0:15 | `editorial.press`, documento real y créditos | Stark 126–133,81; resolución 216,89–225,87 | `cuadros/129.50.png`, `219.50.png`; A01/A09, sin cabecera ni cita inventada; adopción 20 jul 1987 explícita |
| ref2 0:30–0:47 | `text.year` | 1982 desde su palabra en voz; 1984 a 90,19–98 | `cuadros/055.00.png`, `096.85.png`; números de Whisper en `anclas-resueltas.json` |
| ref3 0:01, ref5 0:45 | `label.neon` | 25,80–35,50 | `cuadros/030.00.png`; nombres IRÁN/IRAK y retratos |
| ref5 0:26,5–0:29, ref4 0:00 | `camera.zoomThrough`, `follow`, `reframe`, motion blur 4 muestras | Ej.: 23,20–25,70; 179,61–182,41; 188,40–190,70 | `camara.json`: duración y máximo px/s de **cada** vuelo; tiras B1/B6 con transiciones y pausas |

Las rutas `cuadros/`, `hojas/`, `camara.json`, `auditoria.json` y `anclas-resueltas.json` de esta matriz son relativas a `work/escena/`. La galería es evidencia de capacidad separada, nunca un supuesto fotograma del episodio. Límites visuales e históricos: `work/results/escena-completa.md`.
