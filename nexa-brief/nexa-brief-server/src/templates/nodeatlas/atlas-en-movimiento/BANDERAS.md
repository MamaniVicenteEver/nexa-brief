# Banderas de Atlas en Movimiento

El catálogo compartido `_mapas/flags.js` contiene los siguientes códigos (el motor táctico agrega `kw`):

`ad ae af ag al am ar at au az ba bb bd be bg bn bo br bs bw by bz ca cd ch ci cl cm cn co cr cs cu cy cz ddr de de-empire dk dm do dz ec ee eg es et eu fi fr gb gd gh gr gt gy hk hn hr ht hu id ie il in iq ir is it jm jp ke kh kn kp kr lc li lk lt lu lv ly ma mc md me mk ml mm mn mr mt mx my mz ne ng ni nl no np nz ottoman pa pe ph pk pl pr ps pt py ro rs ru rw sa sd se sg si sk sm sn sr sv sy th tn tr tt tw tz ua ug us ussr uy va vc ve vn xk yu za zm zw kw`.

Para `flag.marker` y `territory.flag`, `flag:"US"` selecciona el código sin distinguir mayúsculas. Las banderas son representaciones nacionales: sus colores no se sustituyen por los del estilo. `flag.marker` usa `flagWidth` (78 por defecto); el rótulo V4 previsto usa 30 × 16 px, y puede prepararse también a 60 × 32 px. Las unidades usan `flag:"US"`; su suministro de imágenes depende de `env.flag`, y algunos dibujos tienen una representación alternativa limitada si no reciben una imagen. Esa alternativa todavía no equivale al catálogo completo.

Irak (`IQ`), Irán (`IR`), Reino Unido (`GB`), Argentina (`AR`), Rusia (`RU`), China (`CN`), Israel (`IL`), Francia (`FR`), Alemania (`DE`), Japón (`JP`), Corea del Sur (`KR`), Corea del Norte (`KP`), Ucrania (`UA`), Bolivia (`BO`) y Chile (`CL`) ya figuran en el catálogo. La presencia de un código no verifica la precisión de todas las variantes históricas.

## Plantilla de prompt para un recurso nuevo

> Bandera de [país y período exacto], con [descripción precisa de franjas, colores, disposición y emblemas]. Vista frontal plana, proporción 15:8, bordes rectos y nítidos, fondo transparente, sin texto ni marcas de agua, con una sombra exterior muy ligera. El diseño debe seguir siendo reconocible tanto a 30 × 16 px como a 60 × 32 px; conservar fielmente los colores y símbolos oficiales del período.

El catálogo actual es vectorial y registra cada diseño como una entrada en `FLAGS` de `_mapas/flags.js`; `ids()` publica sus códigos y `draw()` los dibuja. `territory.js` admite extensiones locales como `kw`. No se ha verificado aún la incorporación de una bandera nueva de extremo a extremo, ni existe aquí un cargador de imágenes nuevas mediante `flag` por sí solo.
