# Estado de las promos comerciales: demo y prototipos

Fecha: 2026-11-17. Fuente: borradores del servidor (drafts por plantilla), `publish.json` y la ficha `DESIGN.md` de cada diseño.

Escrito para: quien revisa la calidad de las miniaturas y los títulos de cada promo.

Cada plantilla tiene un «Video original» (la demo, orig=True) y varios prototipos (borradores hechos desde la misma plantilla con otra canción o tema). Los textos A/B son los de la miniatura tal como están guardados hoy.

## Resumen

- **Miniatura A igual a B:** Editorial (Gran Final), Kinetic (DESDE EL CENTRO), Trendy (SIN LÍMITES), Dynamic (FUERZA PURA), Urban (PURA CALLE), Sports (DEPORTE), Uyuni y otros prototipos. Causa: cuando no hay segundo titular, B copia A.
- **Prototipos repetidos:** muchos borradores son copias idénticas del mismo tema. PULSO aparece en las 6 plantillas con los mismos textos A/B. Eso indica que se generaron varias veces sin revisar.
- **Temas sin relación con la plantilla:** Auroras, Números primos, Arrecifes de coral, Valparaíso, Uyuni y FC Barcelona aparecen como prototipos de promos deportivas o de marca. Son pruebas de otros temas.
- **Datos a revisar:** Editorial B «29 LIGAS» afirma una cifra de un club real; Mono prototipo «Carefree» / «Hola,» no son lemas.
- **Sin llamados a la acción:** ninguna miniatura guardada tiene formato de lema («No te rindas»). Eso llegará al regenerar con el prompt v6.

## Promo Breaking (noticiero «Última hora»)

Contexto del diseño: noticiero en blanco y negro con tinte rojo, titular Poppins en negrita con subrayado rojo.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | ÚLTIMA HORA | EN DIRECTO | Nexa Brief: promo de noticias con titulares animados | Sin problema de texto |
| EL PRECIO DE VIVIR (815e938b) | VIVIR CUESTA | EL PRECIO | El precio de vivir: promo sobre gastos cotidianos | Bien |
| EL PRECIO DE VIVIR (42e560ec) | VIVIR CUESTA | VIVIR CUESTA | El precio de vivir: promo sobre economía cotidiana | **B repite A** |
| EL PRECIO DE VIVIR (fc08239a) | ¿CUÁNTO CUESTA TU DÍA? | INGRESOS MENOS GASTOS | El precio de vivir: teaser documental ficticio | El título dice «ficticio»: no debe publicarse así |

## Promo Dynamic (deporte, letras gigantes, HUD)

Contexto del diseño: archivo variable y lima eléctrica, palabras gigantes, recortes y HUD. La A nueva es la palabra gigante en contorno con el lema encima; la B conserva la foto.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | FUERZA PURA | FUERZA PURA | Barrio Mayo: promo de fuerza y juego limpio para 2026 | **B repite A**. Miniatura del borrador sin recargar |
| PULSO · Despierta el asfalto (x5) | EN LA CALLE | CORRE EN COMPAÑÍA | PULSO · Despierta el asfalto | 5 copias idénticas |
| PULSO · Despierta el asfalto (19a9796f) | PULSO EN LA CALLE | CORRER JUNTOS | PULSO: promo conceptual para correr en compañía | Distinto |
| Auroras (x4) | EL SOL ENCIENDE LA NOCHE | ENCIENDE LA NOCHE | Auroras: cómo el Sol enciende la noche terrestre | 4 copias idénticas; B es parte de A |
| Auroras (18f65818) | El Sol enciende la noche | Boreales y australes | Auroras: cómo el Sol enciende la noche terrestre | Distinto |

## Promo Editorial (portada de revista)

Contexto del diseño: composición editorial en papel, blanco y negro, filetes y placas, con barridos por secciones.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | Gran Final | Gran Final | Promo de la final Leones vs Halcones: Liga Nexa | **B repite A** |
| PULSO · Antes del amanecer (x5) | PULSO EN LA CALLE | CORRE CON PULSO | PULSO: promo de un club de running antes del amanecer | 5 copias idénticas |
| FC Barcelona · Vive el Barça · V3 | VIVE EL BARÇA | VIVE EL BARÇA | FC Barcelona: una historia que se vive en la grada | **B repite A**. Club real: revisar derechos y marca |
| FC Barcelona: más que un club | MÁS QUE UN CLUB | 29 LIGAS | FC Barcelona: más que un club | **Cifra a verificar** antes de publicar |
| Salar de Uyuni V2 | EL ESPEJO DEL MUNDO | EL ESPEJO DEL MUNDO | Salar de Uyuni: donde el cielo toca la tierra | **B repite A** |
| Salar de Uyuni | EL ESPEJO DEL MUNDO | UYUNI: SAL Y CIELO | Uyuni: donde el cielo toca la tierra | Bien |

## Promo Kinetic (frases en filas, Montserrat)

Contexto del diseño: frases en filas con cambios de escala, gris carbón, rojo y amarillo.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | DESDE EL CENTRO | DESDE EL CENTRO | Anuncio con frases que entran al ritmo del corte | **B repite A** |
| PULSO · Correr se escribe (x2) | CORRE POR LA CALLE | CORREN JUNTOS | PULSO · Correr se escribe | Copias casi iguales |
| PULSO · Correr se escribe (fb997e9a) | EN LA CALLE | CORREN JUNTOS | PULSO: promo de running con textos animados | Distinto |
| Auroras: luz que viene del Sol | AURORAS: ¿QUÉ SON? | MIRA ARRIBA | Promo sobre auroras: qué son y cómo se producen | Bien |
| Auroras: la luz que baja del cielo | AURORAS: LUZ VIVA | BOREAL Y AUSTRAL | Auroras: cómo nacen y en qué se distinguen los polos | Bien |
| Números primos (x3) | PRIMOS INFINITOS | PRIMOS | Números primos: definición, factorización e infinitud | 3 copias idénticas; B demasiado corto |
| Números primos (966b2f88) | Los primos son ladrillos | Factoriza tu número | Promo sobre números primos y su factorización única | Bien |

## Promo Trendy (Montserrat, azul noche y lima)

Contexto del diseño: anillos, puntos, glitch y zoom, en azul noche y lima.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | SIN LÍMITES | SIN LÍMITES | Promo de entrenamiento: sin límites, cada día | **B repite A** |
| PULSO · Nos vemos corriendo (x4) | PULSO EN LA CALLE | CORRE CON PULSO | PULSO Club Running: campaña conceptual de comunidad | 4 copias idénticas |
| Arrecifes de coral (x3) | CORALES SON ANIMALES | CORALES | Arrecifes de coral: ciudades vivas bajo el agua | 3 copias; B demasiado corto |
| Salar de Uyuni | UYUNI / ESPEJO DEL CIELO | UYUNI / ESPEJO DEL CIELO | Salar de Uyuni: el espejo del cielo | **B repite A**; la barra es parte del texto |

## Promo Urban (escalones, Inter Tight)

Contexto del diseño: flechas, escalones y bloques en negro, naranja y rojo.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | PURA CALLE | PURA CALLE | Pura Calle: promo de actitud, fuerza y movimiento | **B repite A** |
| PULSO · La calle tiene ritmo (x2) | EN LA CALLE | CORRE EN GRUPO | PULSO · La calle tiene ritmo | Copias casi iguales |
| Valparaíso, ciudad puerto (x3) | VALPARAÍSO CIUDAD PUERTO | CIUDAD PUERTO | Valparaíso, ciudad puerto: cerros, escaleras y ascensores | 3 copias; B demasiado corto |
| Valparaíso (2cc764d0) | VALPARAÍSO SE RECORRE | CIUDAD PUERTO | Valparaíso, ciudad puerto: cerros, escaleras y ascensores | Distinto |

## Promo Sports (Roboto negra, amarillo sobre negro)

Contexto del diseño: metraje deportivo, contornos gigantes y energía en diagonal.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | DEPORTE | DEPORTE | Promo deportiva: para todo atleta, sin miedo | **B repite A** |
| PULSO · La salida es tuya (x4) | PULSO EN LA CALLE | CORRE CON PULSO | PULSO, club corredor: promo para salir a correr en grupo | 4 copias casi iguales |
| 3x3 · Doce segundos para decidir | BALONCESTO 3X3 | VIVE 3X3 | Baloncesto 3x3: doce segundos para decidir | Bien |

## Promo Pulse (deporte, Anton, metraje desaturado)

Contexto del diseño: palabra condensada en cursiva crema, palabra gigante en contorno verde neón.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | Siempre adelante | No pares | Promo deportiva de Nexa Brief con textos al ritmo | Bien; sin lema de la IA nueva |
| ALTURA (x2) | HACIA LA CUMBRE | RESISTE | ALTURA: promo ficticia de un desafío de montaña | 2 copias idénticas. El título dice «ficticia» |
| NOCHE ELÉCTRICA | NOCHE ELÉCTRICA | SIENTE EL | Noche Eléctrica: promo de un festival ficticio | A repite el título; B cortado; «ficticio» en el título |

## Promo Mono (blanco y negro, interfaz mínima)

Contexto del diseño: logotipo, botón de reproducir, tarjetas y palabras que se parten por ventanas de video.

| Prototipo | A | B | Título YouTube | Observación |
|---|---|---|---|---|
| Demo (Video original) | Dale play | Planéalo | Promo de Rutalia con mensajes en movimiento | Bien |
| PATAS LIBRES · adopción | Carefree | Hola, | (sin título) | **B no es un lema**; estado «preview_ready», no preparado |

## Acciones propuestas

1. **Código:** que B nunca copie A. Si no hay segundo titular, B toma un rótulo distinto del guion o un lema del banco.
2. **Limpieza:** borrar los prototipos duplicados de PULSO y los de temas ajenos (Auroras, Primos, Coral, Valparaíso) solo cuando el usuario lo confirme.
3. **Títulos y textos:** quitar «ficticio» de los títulos publicables; verificar «29 LIGAS»; decidir si Barcelona y Uyuni son temas válidos para estas plantillas.
4. **Regenerar:** pulsar Generar datos en las demos para que usen el prompt v6 de llamados a la acción. Eso rehace también títulos y descripciones.
