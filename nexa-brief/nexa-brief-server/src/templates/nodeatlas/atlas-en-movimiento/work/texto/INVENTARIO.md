# Inventario de textos · La guerra de los petroleros

Aspecto actual, sin rediseño. Fuente de verdad: assets/scene.json y los módulos activos engine/. U=min(W,H)/1080 en el video; medidas a 1080×1920. Tipografía AtlasDisplay y AtlasIntroUI = Archivo Black (archivo Archivo-900.ttf); AtlasIntroTitle = Anton; AtlasEditorial = DejaVu Sans Bold, comprobadas con fc-scan. El peso solicitado puede resolverse con la única cara disponible.

139 items de escena, 40 tipos usados, 66 cuadros revisados, 29 muestras de texto del episodio y 5 complementos de biblioteca. Cada texto concreto y su intervalo está en [catalogo-textos.json](catalogo-textos.json), claves inventory y frameAudit. Las 54 cajas label.chip se agrupan por sus 11 tamaños distintos: comparten color, borde y motor de ajuste. Las fichas compuestas desglosan sus roles en tamaño/relleno. [textos-literales.md](textos-literales.md) enumera cada campo, incluidos los nombres anidados USS Fox, USS Kidd y USS Crommelin. Los defaults del registro se aplican antes de medir: por eso los chips y callouts sin color explícito usan text (#e9e3ba) para borde y letras. Los textos impresos dentro de las fotografías/documentos son píxeles del archivo original y se inventarían debajo como medios, no glifos dibujados.

## Diseños que aparecen

| Diseño / señal del usuario | Componente y archivo:línea de dibujo | Fuente / peso | Tamaño | Relleno | Contorno de letras | Fondo | Borde y radio | Sombra | Animación / tiempos | Ejemplo |
|---|---|---|---|---|---|---|---|---|---|---|
| Transcripción · aspecto de Proto · **DESAGRADA** | `caption.transcript` · ../../_proto/proto.js:187–212; engine/tactico/components/captions.js | AtlasDisplay (Archivo Black) / 800 | 45 U; horizontal ×1,1 | #f6edb4 (todo el grupo) | #000000 · 9,9 U (22 % del tamaño) | Transparente | Ninguno | Ninguna | Grupos ≤3 palabras; gap 0,45 s; puntuación corta grupo; retención ≤0,6 s. Escala back 0,85→1 en 0,18 s. Sin fade ni cambio cromático por palabra. | 13.4 s · [cuadro](../escena/cuadros/013.40.png) |
| Chip / fecha / leyenda · 26 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 26 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 134.1 s · [cuadro](../escena/cuadros/134.10.png) |
| Chip / fecha / leyenda · 27 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 27 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 30 s · [cuadro](../escena/cuadros/030.00.png) |
| Chip / fecha / leyenda · 28 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 28 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 74.5 s · [cuadro](../escena/cuadros/074.50.png) |
| Chip / fecha / leyenda · 30 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 30 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 7.45 s · [cuadro](../escena/cuadros/007.45.png) |
| Chip / fecha / leyenda · 31 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 31 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 104.3 s · [cuadro](../escena/cuadros/104.30.png) |
| Chip / fecha / leyenda · 32 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 32 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 74.5 s · [cuadro](../escena/cuadros/074.50.png) |
| Chip / fecha / leyenda · 33 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 33 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 171.35 s · [cuadro](../escena/cuadros/171.35.png) |
| Chip / fecha / leyenda · 34 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 34 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 166.9 s · [cuadro](../escena/cuadros/166.90.png) |
| Chip / fecha / leyenda · 36 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 36 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 2.7 s · [cuadro](../escena/cuadros/002.70.png) |
| Chip / fecha / leyenda · 40 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 40 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 129.5 s · [cuadro](../escena/cuadros/129.50.png) |
| Chip / fecha / leyenda · 45 px · **DESAGRADA** | `label.chip` · engine/tactico/components/labels.js:60 | AtlasDisplay (Archivo Black) / 800 | 45 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 233.9 s · [cuadro](../escena/cuadros/233.90.png) |
| Callout · 34 px · **DESAGRADA** | `label.callout` · engine/tactico/components/labels.js:93 | AtlasDisplay (Archivo Black) / 800 | 34 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Escritura por caracteres en 0,65 s; caja medida con texto completo. Guía #e9e3ba de 2 U y estrella #f6edb4. Fade 0,30 s. | 37.25 s · [cuadro](../escena/cuadros/037.25.png) |
| Callout · 36 px · **DESAGRADA** | `label.callout` · engine/tactico/components/labels.js:93 | AtlasDisplay (Archivo Black) / 800 | 36 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Escritura por caracteres en 0,65 s; caja medida con texto completo. Guía #e9e3ba de 2 U y estrella #f6edb4. Fade 0,30 s. | 67.05 s · [cuadro](../escena/cuadros/067.05.png) |
| País neón · IRÁN | `label.neon` · engine/tactico/components/labels.js:89 | AtlasDisplay (Archivo Black) / 800 | 74 U; ajuste ×0,87 si no cabe | #66c6e3 | #081e2c · max(2 U, tamaño ×0,11) | Transparente | Ninguno | #66c6e3 · blur 12 U | Fade 0,30 s; sigue la proyección del mapa. | 30 s · [cuadro](../escena/cuadros/030.00.png) |
| País neón · IRAK | `label.neon` · engine/tactico/components/labels.js:89 | AtlasDisplay (Archivo Black) / 800 | 66 U; ajuste ×0,87 si no cabe | #f6edb4 | #081e2c · max(2 U, tamaño ×0,11) | Transparente | Ninguno | #f6edb4 · blur 12 U | Fade 0,30 s; sigue la proyección del mapa. | 30 s · [cuadro](../escena/cuadros/030.00.png) |
| Año gigante | `text.year` · engine/tactico/components/labels.js:110 | AtlasDisplay (Archivo Black) / 800 | 140 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | Transparente | Ninguno | Ninguna | Fade lineal 0,30 s en el episodio; 0,35 s por defecto. Sin movimiento propio. | 55 s · [cuadro](../escena/cuadros/055.00.png) |
| Frente · etiqueta integrada · **DESAGRADA** | `label.front` · engine/tactico/components/routes.js:85 | AtlasDisplay (Archivo Black) / 800 | 24 U; ajuste ×0,87 si no cabe | #d1495b | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #d1495b · 1,5 U · radio 8 U | Ninguna | Hereda fade 0,30 s y posición del punto medio de front.line; desplazamiento vertical −38 U. | 245.85 s · [cuadro](../escena/cuadros/245.85.png) |
| Ormuz · etiqueta integrada · **DESAGRADA** | `label.route` · engine/tactico/components/routes.js:78 | AtlasDisplay (Archivo Black) / 800 | 24 U; ajuste ×0,87 si no cabe | #e9e3ba | #081e2c · max(2 U, tamaño ×0,11) | #081e2c | #e9e3ba · 1,5 U · radio 8 U | Ninguna | Hereda fade 0,30 s de route.lanes; punto chipAt=0,68; desplazamiento −34 U. | 84 s · [cuadro](../escena/cuadros/084.00.png) |
| Nombre naval · 22 px | `label.unit` · engine/tactico/components/units.js:87 | AtlasDisplay (Archivo Black) / 700 (cara 900) | 22 U | #e9e3ba | #081e2c · max(2, tamaño ×0,16) | Transparente | Ninguno | Ninguna | Hereda alfa y movimiento de la unidad; naval desaparece con sunk≥0,98. | 13.4 s · [cuadro](../escena/cuadros/013.40.png) |
| Nombre de avión · 21 px | `label.unit` · engine/tactico/components/units.js:87 | AtlasDisplay (Archivo Black) / 700 (cara 900) | 21 U | #e9e3ba | #081e2c · max(2, tamaño ×0,16) | Transparente | Ninguno | Ninguna | Hereda alfa y movimiento de la unidad; naval desaparece con sunk≥0,98. | 99 s · [cuadro](../escena/cuadros/099.00.png) |
| Nombre de instalación | `label.site` · engine/tactico/components/sites.js:99 | AtlasDisplay (Archivo Black) / 800 | 24 U | #e9e3ba | #081e2c · 6 U | Transparente | Ninguno | Ninguna | Hereda transformación, escala y fade 0,30 s de site.port/refinery/platform. Línea base alfabética. | 74.5 s · [cuadro](../escena/cuadros/074.50.png) |
| Retrato · nombre / cargo / fecha / crédito | `portrait.badge` · engine/tactico/components/editorial.js:34 | AtlasEditorial (DejaVu Sans Bold) / 700 | Nombre 29; cargo 22; fecha 19; crédito 21. Bitmap 420×568, tarjeta 470 U × scale; aquí scale=0,76. | Nombre/fecha/crédito #e9e3ba; cargo #f6edb4 | Ninguno en letras | #081e2c; retrato #47595c | Marco octogonal #f6edb4 4 px; halo 12 px al 15 % | Silueta #081e2c desplazada 7,12 px | Fade 0,30 s; bitmap estable. Interlínea ×1,2; ajuste ×0,92. | 30 s · [cuadro](../escena/cuadros/030.00.png) |
| Documento · titular / fuentes / cargo | `editorial.press` · engine/tactico/components/editorial.js:62 | AtlasEditorial (DejaVu Sans Bold) / 700 | Titular 33; fuente documento 21; nombre/cargo 25; fecha/crédito 22. Bitmap 690×805, tarjeta 750 U × scale. | Documento #081e2c; nombre/crédito #e9e3ba; fecha #f6edb4 | Ninguno en letras | Papel #e9e3ba; banda #081e2c; octógono #084c68 | Foto #e9e3ba · 3 px · radio 25 px; papel sin borde | Rectángulo #081e2c desplazado respecto del papel; sin blur | Fade 0,30 s; inclinación fija −7° (Stark) / −4° (598); escala 1,05 / 1,2. Ajuste ×0,92 e interlínea ×1,2. | 129.5 s · [cuadro](../escena/cuadros/129.50.png) |
| Resolución 598 · tarjeta crema y octógono · **DESAGRADA** | `editorial.press` · engine/tactico/components/editorial.js:62 | AtlasEditorial (DejaVu Sans Bold) / 700 | Titular 33; fuente documento 21; nombre/cargo 25; fecha/crédito 22. Bitmap 690×805, tarjeta 750 U × scale. | Documento #081e2c; nombre/crédito #e9e3ba; fecha #f6edb4 | Ninguno en letras | Papel #e9e3ba; banda #081e2c; octógono #084c68 | Foto #e9e3ba · 3 px · radio 25 px; papel sin borde | Rectángulo #081e2c desplazado respecto del papel; sin blur | Fade 0,30 s; inclinación fija −7° (Stark) / −4° (598); escala 1,05 / 1,2. Ajuste ×0,92 e interlínea ×1,2. | 223.5 s · [cuadro](../escena/cuadros/223.50.png) |
| Foto · pie / fecha / crédito | `callout.photo` · engine/tactico/components/editorial.js:74 | AtlasEditorial (DejaVu Sans Bold) / 700 | Pie 28; fecha 21; crédito 22. Bitmap 600×520, tarjeta 640 U × scale (aquí 1,15). | Pie/crédito #081e2c; fecha #47595c | Ninguno en letras | Papel #e9e3ba; foto #081e2c | Ninguno; marco de papel 10 px | Rectángulo #081e2c desplazado 9,12 px | Fade 0,30 s; haz opcional metal #bac9ca→agua #084c68 al 30 %; interlínea ×1,2. | 166.9 s · [cuadro](../escena/cuadros/166.90.png) |
| Título · kicker / año / título / subtítulo | `intro.title` · engine/tactico/components/intro.js:141 | Título/año: AtlasIntroTitle (Anton) / 400; UI: AtlasIntroUI (Archivo Black) / 900 | 132 / 56 / 25 / 30 U (9:16). Ajuste ×0,92, interlínea ×1,19. | Título/subtítulo #e9e3ba; kicker/año #f6edb4 | #081e2c · 6 U; título halo #f6edb4 · 10 U al 15 % | Mapa oscurecido #081e2c al 28 % | Ninguno; regla #f6edb4 · 3 U | Ninguna | Envelope 0,28 s entrada / 0,42 s salida. A tiempo normalizado q=t/(dur/6): kicker .08+.4; año .2+.4; título .35+.7 y desplazamiento 24 U; regla .6+.75; subtítulo .95+.5. Escena corta en out=5,2, fade=0. | 2.7 s · [cuadro](../escena/cuadros/002.70.png) |
| Cierre · canal / acciones / apoyo / handle | `outro.channel` · engine/tactico/components/intro.js:172 | Canal: AtlasIntroTitle (Anton) / 400; resto: AtlasIntroUI (Archivo Black) / 900 | Canal 120; gracias 27; me gusta 23; suscribite 32; apoyo/handle 28 U. | Canal/acciones/apoyo #e9e3ba; gracias/suscribite/handle #f6edb4 | #081e2c · 6 U; canal halo #f6edb4 · 10 U al 15 % | #081e2c al 74 % (episodio); 78 % por defecto | Ninguno; regla #f6edb4 · 2 U | Ninguna | Entrada .28 s / salida .42 s. Gracias 0; canal .08 dur; me gusta .23 dur; suscribite .41 dur; apoyo .61 dur; handle .76 dur. Cada reveal .3 dur/8 con desplazamiento 12 U. | 261.3 s · [cuadro](../escena/cuadros/261.30.png) |
| Atribución del mapa | `text.attribution` · engine/plano/plano.js:28 | sans-serif del sistema / 400 | max(9,11 U) px | #d6dbe0 | Ninguno | Transparente | Ninguno | #000000 · blur 3 U | Siempre visible; alineada derecha/abajo en W−8,H−5; ancho máximo W−16. | 13.4 s · [cuadro](../escena/cuadros/013.40.png) |

## Complementos localizados en el motor (no aparecen en el episodio)

No se les asigna un segundo ficticio. Se incluyen vivos en el index para completar el panorama que pide el brief.

| Diseño | Componente y archivo | Fuente / peso | Tamaño | Relleno | Contorno | Fondo | Borde | Sombra | Animación | Ejemplo |
|---|---|---|---|---|---|---|---|---|---|---|
| Biblioteca · portrait.cutout | `portrait.cutout` · engine/tactico/components/editorial.js | AtlasEditorial / 700 | 29 / 20 / 21 px en bitmap | #e9e3ba / #f6edb4 | Sin contorno de letras | #081e2c | Ver componente original | Silueta #081e2c y borde papel #e9e3ba de 3 px | Fade .35 s; bitmap estable | No aparece en el episodio |
| Biblioteca · label.figure | `label.figure` · engine/tactico/components/labels.js | AtlasDisplay / 800 | 96 U | #e9e3ba / #f6edb4 | #081e2c · max(2 U,tamaño×0,11) | Transparente | Ver componente original | Ninguna | Rotación −8°; fade .35 s | No aparece en el episodio |
| Biblioteca · badge.count | `badge.count` · engine/tactico/components/labels.js | AtlasDisplay / 800 | min(r×1,08; r×1,55/dígitos) | #e9e3ba / #f6edb4 | #081e2c · max(2 U,tamaño×0,11) | #081e2c | #399e58 · 5 U | Ninguna | Dígitos rodantes 0,8 s (demo); fade .35 s | No aparece en el episodio |
| Biblioteca · icon.badge | `icon.badge` · engine/tactico/components/labels.js | AtlasDisplay / 800 | Sin glifos (vector) | #e9e3ba / #f6edb4 | Sin contorno de letras | #081e2c | #f6edb4 · 3 U | Ninguna | Fade .35 s; bitmap estable | No aparece en el episodio |
| Biblioteca · inventory.units | `inventory.units` · engine/tactico/components/editorial.js | AtlasEditorial / 700 | 28 / 39 px en bitmap | #e9e3ba / #f6edb4 | Sin contorno de letras | #081e2c | Ver componente original | Ninguna | Fade .35 s; bitmap estable | No aparece en el episodio |

## Colores hex distintos de texto/rótulos

`#000000`, `#081e2c`, `#084c68`, `#47595c`, `#66c6e3`, `#bac9ca`, `#d1495b`, `#d6dbe0`, `#e9e3ba`, `#f6edb4`. Se normaliza #000 a #000000. #bac9ca pertenece al haz de callout.photo; #084c68 y #47595c también a fondos/formas de las tarjetas. No se cuentan los millones de colores de las imágenes ni colores de geometría sin texto (fuego, banderas, terreno). El verde #399e58 solo es borde del contador de biblioteca, que no aparece en el episodio.

La paleta de escena declara además #399e58 (success). Los valores de reserva de labels.js incluyen #084c68 para cyan; el episodio lo sustituye por #66c6e3. Proto tiene reservas #ffd21a/Montserrat que NO se usan aquí.

## Textos integrados en medios (no tipografía editable)

- assets/media/A09.png: contenido de la resolución ONU, incluido dos veces en resolucion-598; fuente/tamaño/contorno no recuperables como texto del canvas.
- assets/media/A01.png: fotografía del USS Stark en editorial.press, con su contenido documental original.
- assets/media/A05.png y A02.png: fotografías de Iran Ajr y Bridgeton en callout.photo. Los pies y créditos sí son glifos de AtlasEditorial inventariados arriba.
- assets/media/P01.png, P02.png y P03-soft.png: retratos; cualquier marca del archivo se conserva como imagen original.

## Cobertura de Showcase

Catálogo antes: 86. Después: 92, todos con demo. Nuevos: caption.transcript, label.front, label.route, label.unit, label.site, text.attribution. Los envoltorios exponen piezas antes integradas en sus padres; los padres originales siguen dibujando el episodio. Las leyendas «Rutas esquemáticas…» y «Frente aproximado…» ya son label.chip; no necesitan duplicarse. Fecha y año ya eran label.chip y text.year. Retratos, fotos, título y cierre ya tenían registro y demo.

## Todas las instancias textuales y sus intervalos

| ID | Tipo | Inicio–salida (s) | Texto | Demo |
|---|---|---|---|---|
| intro | intro.title | 0.00–5.20 | LA GUERRA DE / LOS PETROLEROS / ATLAS EN MOVIMIENTO / 1987 / Golfo Pérsico · 1980–1988 | Sí |
| bridgeton | naval.cargo | 0.00–24.93 | Bridgeton | Sí |
| fecha-bridgeton | label.chip | 1.17–24.93 | 24 JUL 1987 · AL OESTE DE FARSI | Sí |
| capitan | label.chip | 6.13–9.99 | Frank C. Seitz, Jr. · capitán del Bridgeton | Sí |
| sobrevive-bridgeton | label.chip | 14.91–18.90 | El mercante sobrevive | Sí |
| siguen-estela | label.chip | 19.45–23.20 | Las escoltas siguen su estela | Sí |
| retroceso | label.chip | 23.45–27.00 | Siete años antes | Sí |
| invasion | label.chip | 26.41–40.50 | SEPTIEMBRE DE 1980 | Sí |
| iran-nombre | label.neon | 25.80–35.20 | IRÁN | Sí |
| iraq-nombre | label.neon | 25.80–35.20 | IRAK | Sí |
| sadam | portrait.badge | 26.41–34.50 | Sadam Husein / Presidente de Irak · 1980 / Foto: antes de 1987 / Min. Información de Irak · PD | Sí |
| jomeini | portrait.badge | 26.41–34.50 | Ruhollah Jomeini / Líder supremo de Irán / Foto: 6 may 1981 / Ali Kaveh · PD-Iran | Sí |
| frente | front.line | 30.85–67.45 | FRENTE · aproximado | Sí |
| frente-aprox | label.chip | 30.85–67.45 | Frente aproximado · flechas: direcciones | Sí |
| jorramchar-mapa | label.callout | 36.61–58.73 | Jorramchar / (Khorramshahr) | Sí |
| abadan | site.refinery | 36.61–58.73 | Abadán · refinería | Sí |
| abadan-resiste | label.chip | 41.99–45.43 | Abadán resiste el asedio | Sí |
| rompe-cerco | label.chip | 48.73–50.30 | SEP 1981 · Irán rompe el cerco | Sí |
| ano-1982 | text.year | 51.71–58.73 | 1982 | Sí |
| recupera-jorramchar | label.chip | 53.95–58.73 | 24 MAY 1982 · Irán recupera Jorramchar | Sí |
| guerra-continua | label.chip | 60.33–64.20 | La guerra continúa | Sí |
| basora-label | label.callout | 66.05–67.45 | Basora · Irak | Sí |
| kharg-terminal | site.port | 67.75–89.89 | Kharg · terminal exportador | Sí |
| kharg-no-refineria | label.chip | 67.75–74.99 | Terminal de exportación de crudo | Sí |
| instalaciones-distintas | label.chip | 74.97–79.05 | Abadán: refinería · Kharg: terminal | Sí |
| rutas-esquema | label.chip | 76.33–89.89 | Rutas esquemáticas · flujos sin escala | Sí |
| carriles-ormuz | route.lanes | 76.33–89.89 | ORMUZ | Sí |
| mercante-crudo | naval.cargo | 82.11–89.89 | Crudo hacia Sirri | Sí |
| sirri-terminal | site.port | 82.11–89.89 | Sirri | Sí |
| traslado-1985 | label.chip | 82.11–88.40 | 1985 · Kharg → Sirri | Sí |
| compradores | label.chip | 88.73–89.89 | Menor exposición de compradores | Sí |
| ano-1984 | text.year | 90.19–97.70 | 1984 | Sí |
| intensifica | label.chip | 94.63–102.10 | La campaña se intensifica | Sí |
| reactor-iraqui | air.jet | 97.17–110.70 | Avión iraquí | Sí |
| antecedentes | label.chip | 102.65–105.70 | Hubo ataques antes de 1984 | Sí |
| kharg-danado | site.port | 104.87–115.07 | Kharg · terminal | Sí |
| kharg-danos | label.chip | 107.91–113.90 | Terminales bajo ataque | Sí |
| kharg-reparaciones | label.chip | 114.29–116.20 | Daños y reparaciones | Sí |
| stark | naval.warship | 115.37–133.51 | USS Stark | Sí |
| stark-fecha | label.chip | 115.37–133.51 | 17 MAY 1987 · USS STARK | Sí |
| stark-nombre | label.chip | 120.31–123.10 | Fragata estadounidense | Sí |
| stark-documento | editorial.press | 126.00–133.51 | USS Stark · daños tras el ataque / U.S. Navy · DN-ST-89-01562 · PD / Ronald Reagan / Presidente de EE. UU. / Foto: 7 feb 1981 · ataque: 17 may 1987 / Michael Evans · Casa Blanca · PD | Sí |
| stark-victimas | label.chip | 128.43–131.77 | 37 tripulantes murieron | Sí |
| stark-sobrevive | label.chip | 132.07–133.51 | El buque sobrevive | Sí |
| reabanderamiento | label.chip | 137.83–144.20 | 21 JUL 1987 · BANDERA ESTADOUNIDENSE | Sí |
| dos-mercantes | label.chip | 141.59–152.00 | Bridgeton y Gas Prince · rumbo a Kuwait | Sí |
| salida-convoy | label.chip | 145.13–148.39 | 22 JUL 1987 · PRIMER CONVOY | Sí |
| ormuz-esquema | label.chip | 133.81–152.00 | Ormuz · formación y ruta esquemáticas | Sí |
| riesgo-mina | label.chip | 149.05–152.00 | 24 JUL · la mina revela el riesgo | Sí |
| iran-ajr | naval.cargo | 152.30–169.67 | Iran Ajr · posaminas | Sí |
| jarrett | naval.warship | 152.30–164.20 | USS Jarrett | Sí |
| iran-ajr-fecha | label.chip | 152.30–164.20 | 21 SEP 1987 · IRAN AJR | Sí |
| siembra-minas | label.chip | 158.21–161.40 | Siembra de minas · posición aproximada | Sí |
| ajr-foto | callout.photo | 164.50–169.67 | Minas en la cubierta del Iran Ajr / 22 sep 1987 · después del abordaje / PH3 H. Cleveland · U.S. Navy · PD | Sí |
| nueve-minas | label.chip | 167.17–169.67 | Nueve minas halladas a bordo | Sí |
| roberts | naval.warship | 169.97–179.31 | USS Samuel B. Roberts | Sí |
| roberts-fecha | label.chip | 169.97–179.31 | 14 ABR 1988 · SAMUEL B. ROBERTS | Sí |
| roberts-danos | label.chip | 176.43–179.31 | Daños graves por una mina | Sí |
| mantis | label.chip | 180.15–188.45 | 18 ABR 1988 · MANTIS RELIGIOSA | Sí |
| sassan | site.platform | 179.61–188.45 | Sassan | Sí |
| sirri | site.platform | 179.61–188.45 | Sirri | Sí |
| plataformas-aprox | label.chip | 185.67–188.45 | Sassan y Sirri · ubicaciones aproximadas | Sí |
| enterprise | naval.carrier | 188.75–197.95 | USS Enterprise · CVN-65 | Sí |
| enterprise-este | label.chip | 189.09–197.95 | AL ESTE DE ORMUZ · MAR ARÁBIGO | Sí |
| intruder | label.chip | 194.05–197.95 | A-6E Intruder · aviones de ataque | Sí |
| sahand | naval.warship | 198.10–202.60 | Sahand · fragata | Sí |
| joshan | naval.warship | 198.10–202.60 | Joshan · lancha misilera | Sí |
| hundimientos | label.chip | 200.79–202.70 | Sahand y Joshan se hunden | Sí |
| sabalan | naval.warship | 202.20–207.60 | Sabalan | Sí |
| sabalan-estado | label.chip | 204.15–207.60 | Sabalan · inmovilizada y remolcada | Sí |
| tierra-1988 | label.chip | 210.01–215.37 | ABR 1988 · OFENSIVA EN TIERRA | Sí |
| al-faw | label.chip | 212.73–215.37 | Al-Faw · campaña distinta de Mantis | Sí |
| al-faw-aprox | label.chip | 207.90–215.37 | Frente y movimientos aproximados | Sí |
| resolucion-598 | editorial.press | 216.89–225.57 | Resolución 598 (1987) / ONU · S/RES/598(1987) / Consejo de Seguridad de la ONU / Resolución 598 (1987) / 20 jul 1987 · retrospectiva / Naciones Unidas · documento oficial · PD | Sí |
| resolucion-anterior | label.chip | 215.67–222.31 | Una resolución del año anterior | Sí |
| resolucion-fecha | label.chip | 222.61–225.57 | 20 JUL 1987 · ADOPCIÓN | Sí |
| vuelo-civil | label.chip | 225.87–236.33 | 3 JUL 1988 · IRAN AIR 655 | Sí |
| derribo-civil | label.chip | 228.67–233.20 | Vincennes derriba el vuelo civil | Sí |
| victimas-civiles | label.chip | 233.63–236.33 | 290 personas murieron | Sí |
| aceptacion | label.chip | 237.39–241.30 | JUL 1988 · IRÁN ACEPTA LA RESOLUCIÓN | Sí |
| alto-fuego | label.chip | 241.97–254.54 | 20 AGO 1988 · ALTO EL FUEGO | Sí |
| frente-final | front.line | 236.63–254.54 | FRENTE · aproximado | Sí |
| frente-final-aprox | label.chip | 236.63–247.50 | Frente aproximado · frontera de referencia | Sí |
| retirada-posterior | label.chip | 247.95–254.54 | La retirada completa todavía llevará tiempo | Sí |
| bridgeton-final | callout.photo | 251.69–254.54 | Bridgeton · el mercante sobrevivió / Foto: 22 ago 1987 · Earnest Will / PH3 H. Cleveland · U.S. Navy · PD | Sí |
| cierre | outro.channel | 254.84–262.84 | GRACIAS POR VER / NODEHISTORY / Apoya el canal. Comparte esta historia. / youtube.com/@nodehistory | Sí |
| helicopteros-observa | label.chip | 159.25–164.20 | 1 MH-6 · observación | Sí |
| helicopteros-atacan | label.chip | 161.77–164.20 | 2 AH-6 · ataque | Sí |
