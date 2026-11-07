# Brief · identidad-index (Luna xhigh)

Antes: `work/briefs/_comun.md` (solo puntos 8–9 de ritmo; lo demás es de componentes del motor y NO aplica a esta tarea).
Lee `identidad/IDENTIDAD.md` COMPLETO: es la especificación (colores, tipografías, escalas, bordes, reglas de ranuras). Los valores
de ahí son contrato: no los cambies ni inventes otros. Si algo no se puede cumplir, anótalo en el RESULT.

## Objetivo
Crear `identidad/index.html` (autocontenido salvo `identidad/assets/`): una página para que el usuario ELIJA identidad visual.
Muestra, para las 3 versiones (V1 Carta naval, V2 Sala de situación, V3 Cine documental), (A) una simulación de 30 s del episodio
en 9:16 y (B) la hoja de componentes. NO toca el motor (`engine/`, `assets/scene.json`, `index.html` raíz). NO graba MP4.
Es una réplica HTML/CSS/SVG de los componentes con las nuevas identidades (no se reescribe el motor canvas todavía).

## Insumos que debes generar primero (carpeta `identidad/assets/`)
1. **Placas de mapa limpias 1080×1920 JPG q88, SIN ningún texto, caption, chip ni sprite**, con el look `tactico` actual (es el mapa que
   al usuario le gusta). Saca las poses de `work/escena/camara.json` / `assets/scene.json`:
   - `placa-golfo.jpg`: Golfo Pérsico al oeste de Farsi, pose de t≈2,7 s (tal como en `work/escena/cuadros/002.70.png`).
   - `placa-golfo-b.jpg`: misma zona, pose de t≈20 s (tras el seguimiento).
   - `placa-irak-iran.jpg`: Irak–Irán, pose de t≈28 s (como `work/escena/cuadros/030.00.png`), SIN banderas ni tintes de territorio.
   Cómo: copia `assets/scene.json` a `identidad/work/scene-placas.json` quitando `items`, captions, intro/outro; lanza el motor
   (`engine/plano/plano.js`, mira `index.engine-local.html` y `engine/plano/README.md` para la carga y el seek) con UNA página de
   Chromium (flags swiftshader) y captura. Si el motor no permite vaciar la escena, arma las placas componiendo las teselas de
   `../_atlas/cache/gibs-bluemarble` con la misma proyección y el mismo look (saturación 0,72 / contraste 1,12 / brillo 0,93 / viñeta).
   Verifica a ojo que no queda texto ni sprite.
2. **Geometría de bandos** (para tintes de territorio sin banderas): exporta `identidad/assets/territorios-irak-iran.svg` (viewBox
   1080 1920, mismas coordenadas que `placa-irak-iran.jpg`) con dos paths: `#irak` e `#iran` (contornos de `engine/plano/territories.js`
   / datos Natural Earth del motor, proyectados con la cámara de t≈28 s). Mejor esfuerzo; si falla, di exactamente qué faltó.
3. **Sprites y posiciones**: de `assets/scene.json` toma, para t entre 0 y 30 s, los ítems visibles (Bridgeton, USS Fox, USS Kidd,
   USS Crommelin, retratos Sadam Husein y Jomeini, etc.), sus posiciones en pantalla por instante (la cámara se mueve: usa 4–6
   puntos clave y interpola con CSS/JS) y copia a `identidad/assets/sprites/` solo los PNG usados desde `engine/tactico/sprites*`
   y `assets/media/P0*.png`. Los retratos reales son `P01`/`P02`: mira cuál es cuál.
4. **Tipografías locales** (sin depender de internet al abrir): descarga los TTF/woff2 OFL de Fraunces, IBM Plex Mono, Barlow Condensed,
   Instrument Serif e Inter Tight (Google Fonts en github.com/google/fonts o @fontsource en jsDelivr) a `identidad/assets/fonts/` y
   decláralos con `@font-face`. Pesos: Fraunces 500/600; Plex Mono 500; Barlow Condensed 600/700; Instrument Serif 400/400 italic;
   Inter Tight 500/600/700. Guarda las licencias.
5. **Textos reales**: toma de `assets/lyrics.json` las palabras y tiempos de 0 a 30 s para el caption (grupos de ≤3 palabras como el
   episodio); de `work/texto/INVENTARIO.md` y `assets/scene.json` los textos de los ítems (kicker «24 JUL 1987 · AL OESTE DE FARSI»,
   capitán «Frank C. Seitz, Jr. · capitán del Bridgeton», «El mercante sobrevive», «Las escoltas siguen su estela», «Siete años antes»,
   «SEPTIEMBRE DE 1980», IRÁN, IRAK, retratos y sus cargos). NO inventes datos ni textos nuevos.

## La página `identidad/index.html`
Idioma español, SIN emojis, fondo de página neutro `#0b0d0f`, tipografía de la página Inter Tight. Debe verse en pantalla de 1440 px y
también en móvil. Secciones:
1. **Cabecera**: título «Identidad visual · Atlas en Movimiento», una línea de contexto, y un selector con 4 botones (Los tres, V1, V2,
   V3). «Los tres» muestra las 3 simulaciones lado a lado (3 teléfonos 9:16); cada botón de versión muestra solo esa a mayor tamaño.
2. **Simulación de 30 s** (una sola línea de tiempo compartida): botón Reproducir/Pausa, barra de progreso con scrub, tiempo `0:00 / 0:30`,
   bucle. Un reloj JS (`requestAnimationFrame`) manda el tiempo `t`; TODO es función pura de `t` (seek exacto al arrastrar). Cada teléfono
   es un contenedor 1080×1920 escalado con `transform: scale` (todas las medidas del documento en U = px de ese lienzo). Debajo de cada
   teléfono: nombre de la versión + 3 muestras de color + los 2 nombres de tipografía.
   Línea de tiempo (el contenido es el MISMO en las tres versiones; cambia solo el diseño):
   - 0,0–5,2: intro sobre placa-golfo: título «LA GUERRA DE / LOS PETROLEROS», subtítulo «ATLAS EN MOVIMIENTO», cifra «1987»,
     «Golfo Pérsico · 1980–1988» (máx. 2 niveles: título + subtítulo; la cifra y la línea de golfo según la regla de 2 niveles de
     IDENTIDAD.md §4: decide con criterio, anótalo), KICKER «24 JUL 1987 · AL OESTE DE FARSI» desde 1,17 s. Buques en el mapa
     (Bridgeton + USS Fox/Kidd/Crommelin) con retícula sobre el Bridgeton; sus etiquetas (DATO) atenuadas mientras haya título.
   - 5,2–10,0: placa-golfo con zoom/pan suave (Ken Burns de 4–6 puntos clave); ancla «Bridgeton»; ancla de capitán 6,1–10,0.
   - 10,0–19,0: seguimiento; ancla «El mercante sobrevive» 14,9–18,9.
   - 19,45–23,2: placa-golfo-b; ancla «Las escoltas siguen su estela»; ruta del sujeto en acento discontinuo.
   - 23,45–27,0: ancla grande tipo cifra/kicker «Siete años antes» (transición con zoom-through a la placa irak-irán).
   - 26,4–30,0: placa-irak-iran, KICKER «SEPTIEMBRE DE 1980», nombres de territorio IRÁN/IRAK (tintes de bando del SVG según la versión),
     dos retratos con nombre/cargo/crédito de una línea, línea de frente «FRENTE · aproximado» como ANCLA de línea.
   - Narración (caption) durante los 30 s con las palabras reales, en su ranura `y = 0,77`.
   Entradas 0,40 s `cubic-bezier(.2,.8,.2,1)`, salidas 0,25 s lineal (reglas comunes §2.4). Máximo 3 textos de primer plano.
   Respeta ranuras y «un solo foco».
3. **Hoja de componentes** (una por versión, en tarjetas; con el selector se ven las 3 en columnas): cada pieza sobre un recorte de
   placa o fondo liso de la versión, con su nombre técnico actual y el nombre nuevo: KICKER, ANCLA con guía, ANCLA de línea («FRENTE ·
   aproximado»), ANCLA de ruta («ORMUZ»), CIFRA («4 países», «1987»), NOMBRE DE TERRITORIO (IRÁN), DATO de sitio («Kharg · terminal
   exportador») y de unidad («USS Samuel B. Roberts»), RETRATO, DOCUMENTO («USS Stark · daños tras el ataque», foto `A01.png`, pie),
   NARRACIÓN, TÍTULO de intro, CIERRE (outro, mismo lenguaje que el título; texto «Gracias por ver» NO: usa solo el texto que ya exista
   en el outro del repositorio; si no existe, «ATLAS EN MOVIMIENTO»), ICONO + flecha + ruta + retícula, y una franja de tokens:
   paleta con hex, escala tipográfica con tamaños en U, radio, grosor de borde.
4. **Antes / después**: dos fotogramas actuales (`work/escena/cuadros/002.70.png` y `030.00.png`, copiados a `identidad/assets/antes/`)
   junto a las tres versiones en el mismo instante (t=2,7 y t=28), para comparar de un vistazo.
5. **Reglas comunes**: lista breve de las 9 reglas de IDENTIDAD.md §2 (una línea cada una) y botón «Mostrar guías de zona segura» que
   dibuja encima de los teléfonos las ranuras KICKER/ANCLA/NARRACIÓN y la zona de interfaz de TikTok (último 22 %).

## Calidad (esto es lo que el usuario va a juzgar)
- Nivel de documental profesional: limpio, con aire, jerarquía clara, alineaciones exactas, mismos márgenes, una sola idea por versión.
  Que NO parezca generado por IA: nada de degradados morados, sombras exageradas, brillos neón, emojis, iconografía decorativa de relleno.
- Cada versión usa SOLO su paleta (verifica con un script que los colores de texto/borde/fondo del DOM de la simulación pertenecen a la
  paleta de esa versión o a la placa de mapa).
- Texto legible a 390 px de ancho (tamaño real del teléfono): mínimo 24 U (dato) como indica la escala.
- Rendimiento: la página debe correr a 60 fps en un portátil; sin librerías pesadas (JS/CSS/SVG a mano; GSAP no hace falta).

## Verificación obligatoria
Chromium con UNA página, `nice -n 15`. Captura `identidad/work/shots/{v1,v2,v3}-t{02.7,06.5,16,21,24.5,28.5}.png` (18 capturas del teléfono a
540×960) y una hoja de contacto `identidad/work/sheets/identidad.jpg` (3 filas × 6 columnas). MIRA la hoja y corrige: recortes,
solapes de texto, texto fuera de la zona segura, mapa tapado, tipografía que no cargó, contraste bajo. Repite hasta que se vea bien.
Captura también la hoja de componentes de cada versión (`identidad/work/sheets/componentes-v{1,2,3}.png`) y la página completa a
1440 px y a 390 px.

## Entrega
`work/results/identidad-index.md`: archivos creados, cómo abrir (servir con `python3 -m http.server` desde `atlas-en-movimiento/` y abrir
`/identidad/index.html`), capturas (rutas), qué es aproximación frente al motor real (placas, territorios, interpolación de cámara),
qué no se pudo cumplir de IDENTIDAD.md y por qué. Escribe solo en `identidad/`, `work/` y `/tmp`. No edites nada fuera de `atlas-en-movimiento/`.

## REANUDACIÓN Y RITMO
- Servidor compartido de 4 núcleos y 11 GB: `nice -n 15` en todo lo pesado; un solo Chromium a la vez; cierra hijos al terminar cada prueba.
- Si una prueba tarda minutos, espera. Si te cortan un proceso por carga, relánzalo más tarde.
- Revisa primero lo que ya exista en `identidad/` si se reanuda; no rehagas lo que funciona.
