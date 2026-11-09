# Brief · identidad-opus (Opus 5.5, esfuerzo alto) · REDISEÑO LIBRE

## Qué se quiere
Rediseñar visualmente («refactorizar» el aspecto de) la plantilla «Atlas en Movimiento» (mapas tácticos 9:16 sobre mapa satelital; demo
«La guerra de los petroleros», 1980-1988). El usuario dice, con sus palabras:

> Es un proyecto espectacular pero visualmente carece de identidad. Hay muchos colores que no convienen uno con otro; hay momentos
> donde se muestran muchas cosas y no se entiende. Me gusta el mapa y cómo muestran las animaciones, pero los colores de las letras, las
> cards donde se muestran las letras, todo está muy desordenado: amarillos, blanco, azules, sin una distinción; las flechas, todo. Quiero
> una identidad visual: tipografías, tamaños, bordes. Algo limpio, visualmente atractivo; no quiero llenar la pantalla de muchas cosas
> sin que se entienda. Hablaremos de geopolítica, guerras, sucesos históricos, batallas. No quiero que parezca que lo generó una IA:
> quiero algo profesional, al nivel de documentales profesionales de miles de millones de presupuesto. Haz el estudio y crea la identidad
> visual: colores, tipografías, posiciones, para no llegar al medio de muchas cosas. Las letras que acompañan a los barcos también
> quiero cambiarlas. Todo el sistema debe mantener una identidad visual para mostrar cosas importantes. Ese rojo no me gusta, el que
> hay ahora por ejemplo. Muéstrame solo lo esencial, no todo el sistema: unos 30 segundos de video con todo lo que hay, para darme una idea.
> Primero la planificación; luego cambiaremos todo en la plantilla.

Quiere VER 3 VERSIONES de identidad visual (colores, tipografías, tamaños, bordes, posiciones). El diseño de las 3 lo decides TÚ, con
total libertad y criterio de director de arte: elige paletas, familias tipográficas, escala, lenguaje de contenedores, flechas, rótulos de
unidades, retratos, documentos, intro y cierre. Las 3 deben ser realmente distintas entre sí y cada una internamente coherente. No hay
especificación previa que seguir; no copies tokens de nadie: investiga, razona y propón. Conserva lo que le gusta: el mapa, la cámara y
las animaciones (su ritmo de entrada/salida).

## Dónde está la plantilla
Servidor `alfred-server` (por ssh): `~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/sandbox/nodehistory/atlas-en-movimiento`
(en ssh no interactivo: `export PATH=$HOME/.local/bin:$PATH`). El backend sirve esa carpeta por HTTP:
- Plantilla funcionando (el video tal como está hoy): http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/index.html
- Cualquier archivo: la misma base + ruta relativa (por ejemplo `.../assets/scene.json`, `.../work/tactico/demo.html`).
Biblioteca visual de componentes del usuario (requiere sesión, puede que no la veas): http://192.168.20.2:3000/showcase

## Qué leer para entender el estado actual y qué mejorar (lee, mira, luego diseña)
- Componentes reales: `engine/tactico/components/{labels,captions,editorial,intro,territory,naval,sites,routes,economy,icons?}.js` (los que existan),
  `engine/looks/tactico.json`, `engine/tactico/CONTRATO.md`.
- `work/texto/INVENTARIO.md`: inventario de cada texto con su fuente, tamaño, color, borde y tiempos.
- Fotogramas reales del episodio: `work/escena/cuadros/*.png` (66; por ejemplo 002.70, 030.00, 044.70, 074.50, 111.75, 129.50, 163.90,
  195.50, 238.40). Cópialos a local con scp para verlos con Read. Fíjate dónde se mezcla todo: textos de color crema, marfil, blanco, rojo,
  cian neón, verde; chips navy con borde crema; callouts; retratos en octógono; tarjeta de papel ocre; banderas completas sobre los
  territorios; caption con trazo negro grueso a y=90 % (cae bajo la interfaz de TikTok/Reels/Shorts).
- Textos reales del episodio: `assets/scene.json` (ítems), `assets/lyrics.json` (palabras con tiempos), `assets/media/` (retratos P0*, documentos A0*).
- Etiquetas que existen hoy y debes rediseñar (nombre técnico → qué es): `caption.transcript` (subtítulos de narración), `label.chip`
  (fecha/leyenda), `label.callout` (ficha con guía), `label.figure` (cifra «4 países»), `label.front` («FRENTE · aproximado»), `label.route`
  («ORMUZ»), `label.neon` (IRÁN/IRAK), `label.site` («Kharg · terminal exportador»), `label.unit` («USS Samuel B. Roberts»), `portrait.badge`
  (retrato + cargo + crédito), `editorial.press` (documento «USS Stark · daños tras el ataque»), `text.year` («1987»), `intro.title`, outro,
  iconos, flechas, rutas, retículas, tintes/bordes de territorio.

## Entregable
`identidad-opus/index.html` (autocontenido salvo `identidad-opus/assets/`), idioma español, SIN emojis, que muestre:
1. **Simulación de 30 s** del episodio (0 a 30 s) para cada una de tus 3 versiones, en teléfono 9:16 (lienzo de 1080×1920 escalado con
   `transform: scale`; todas las medidas en px de ese lienzo), con reproducir/pausa, scrub y bucle, un único reloj JS (todo es función pura
   del tiempo `t`). El contenido (textos, tiempos, palabras del caption) sale de los datos reales del episodio y es el MISMO en las tres;
   cambia solo el diseño. Usa estos hitos reales: 0–5,2 intro sobre el Golfo (título «LA GUERRA DE LOS PETROLEROS», «ATLAS EN MOVIMIENTO»,
   «1987», «Golfo Pérsico · 1980–1988», fecha «24 JUL 1987 · AL OESTE DE FARSI» desde 1,17 s; buques Bridgeton + USS Fox/Kidd/Crommelin);
   6,1–10: «Frank C. Seitz, Jr. · capitán del Bridgeton»; 14,9–18,9: «El mercante sobrevive»; 19,45–23,2: «Las escoltas siguen su estela»;
   23,45–27: «Siete años antes»; 26,4–30: «SEPTIEMBRE DE 1980», IRÁN / IRAK, retratos de Sadam Husein y Ruhollah Jomeini con cargo y crédito,
   «FRENTE · aproximado»; y la narración (caption) durante los 30 s. No inventes textos ni datos.
2. **Hoja de componentes** por versión: cada pieza del listado anterior con su nombre, más paleta (hex), escala tipográfica (tamaños) y bordes.
3. **Antes / después** en dos instantes (t≈2,7 y t≈28): fotogramas actuales (`work/escena/cuadros/002.70.png` y `030.00.png`) frente a tus 3 versiones.
4. **Reglas** de tu sistema en pocas líneas (por ejemplo cuántos elementos de primer plano a la vez, ranuras de posición, zona segura de TikTok)
   y un botón para mostrar las guías de zona segura sobre los teléfonos.
5. Selector «Los tres / V1 / V2 / V3», responsive (1440 px y 390 px), fondo de página neutro, pie visible y discreto:
   «Propuesta generada por Claude Opus 5.5 (esfuerzo alto)».
6. Un documento corto `identidad-opus/PLAN.md`: diagnóstico, principios y las 3 identidades con sus decisiones (para después migrar el motor).

## Insumos ya preparados en `identidad-opus/assets/` (revísalos; complétalos si faltan o están mal)
Placas de mapa limpias 1080×1920 sin texto (`placa-golfo.jpg`, `placa-golfo-b.jpg`, `placa-irak-iran.jpg`), `territorios-irak-iran.svg`
(contornos de Irak/Irán en coordenadas de la placa), `sprites/`, `fonts/`, `antes/`, `captions.json`. Si algo falta, genéralo: placas con el
motor (`engine/plano/plano.js`, mira `index.engine-local.html`) o con las teselas de `../_atlas/cache/gibs-bluemarble`. Las tipografías deben
ser libres (OFL) y estar descargadas en `assets/fonts/` con `@font-face`: puedes bajarlas de Google Fonts (github.com/google/fonts) o
@fontsource (jsDelivr) si usas familias distintas a las que haya. La página no debe depender de internet para abrir.

## Calidad (lo que el usuario va a juzgar, comparándote con otras propuestas)
Nivel de documental profesional: limpio, con aire, jerarquía clara, alineaciones exactas, márgenes constantes, una idea por versión,
máximo 3 textos de primer plano a la vez, un solo acento por versión (el rojo actual no), legible a 390 px de ancho. Que NO parezca
generado por IA: nada de degradados morados, brillos neón, sombras exageradas, iconografía de relleno ni cajas por todas partes.
Fidelidad al contenido real. Rendimiento fluido sin librerías pesadas.

## Verificación obligatoria
Chromium/Playwright con UNA página y `nice -n 15` si es en el servidor (servidor compartido de 4 núcleos y 11 GB con otro proceso pesado
corriendo); también puedes copiar la carpeta a tu máquina local y capturar allí. Captura 6 instantes (t=2,7; 6,5; 16; 21; 24,5; 28,5) de las
3 versiones a 540×960 (`identidad-opus/work/shots/`) y arma hojas de contacto (`identidad-opus/work/sheets/`). MIRA las imágenes tú mismo y
corrige solapes, recortes, texto fuera de zona segura, tipografías que no cargaron y contraste bajo. Repite hasta que se vea bien. Captura
además la hoja de componentes de cada versión y la página completa a 1440 px y 390 px.

## Límites
Escribe solo en `identidad-opus/`, `work/` de esa carpeta, `work/briefs`/`work/results` de tu tarea, y /tmp o tu scratchpad. No toques `identidad/`
(carpeta ajena), `engine/`, `assets/scene.json` ni el `index.html` raíz. No grabes MP4. Entrega el informe final en
`work/results/identidad-opus.md` (archivos, decisiones, aproximaciones frente al motor real, lo que no se pudo cumplir).
URL final para el usuario: http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/identidad-opus/index.html
