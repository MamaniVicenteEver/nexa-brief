# Bandera sobre territorio · `atlas.flagFill`

Insertar en `scene.layers`:

```json
{"type":"flag-fill","region":"US","src":"media/flag-us.svg","t":12,"dur":0.8,"out":18,"fadeOut":0.5,"opacity":0.95}
```

`region` acepta ISO2, ISO3 o una región declarada/preparada con geometría Polygon o MultiPolygon. Reutiliza `data/geo/` y `assets/geo.resolved.json`; no descarga fronteras. `src` es una bandera real local, relativa a `assets/`, igual que las fotografías del motor. El archivo puede ser SVG, PNG, JPEG, WebP o AVIF. Una imagen ausente se informa mediante `missingTiles()` y no se sustituye por una bandera inventada.

`t` y `out` aceptan segundos o anclas de voz. La entrada por opacidad empieza en `t` y dura `dur` (predeterminado 0.8 s). `out` inicia el desvanecido; termina en `out + fadeOut` (predeterminado 0.4 s). `fadeOut:0` produce un corte y omitir `out` conserva el relleno. `opacity` está entre 0 y 1; por defecto 1. Estos valores dependen solamente del tiempo solicitado: se puede buscar hacia atrás o saltar directamente al final. Para retirar la bandera antes de mostrar regiones, situar el primer resaltado regional después de `out + fadeOut`.

`opacityKeys` permite conservar una bandera tenue tras su presentación inicial. Es una lista opcional de `{t,value}`: tiempos absolutos de escena o anclas, no negativos y estrictamente crecientes; valores de 0 a 1. Interpola linealmente entre claves y mantiene el primer/último valor fuera de sus extremos. Multiplica `opacity` y las envolventes de entrada y salida. Omitir la lista o usar `[]` conserva la opacidad anterior. Para mantener la bandera durante estados/regiones, colocar `out` al final del país; la curva no anula una salida explícita.

```json
{"type":"flag-fill","region":"FR","src":"media/flag-fr.svg","fit":"landmass","t":10,"dur":0.7,"opacity":1,"opacityKeys":[{"t":10,"value":1},{"t":14,"value":1},{"t":15,"value":0.1},{"t":25,"value":0.025}],"out":40,"fadeOut":0.4}
```

Las claves se resuelven una vez al preparar cada capa y se evalúan por tiempo solicitado; no añaden timers, texturas por cuadro ni estado dependiente del orden de seek.

`fit:"global"` (predeterminado) dibuja una sola bandera sobre la extensión Mercator completa del país y la recorta por todos sus anillos, incluidos los huecos. No repite la bandera por isla. Al cruzar ±180°, conserva esa misma imagen y la divide en dos fuentes raster geográficas; así Rusia y Alaska no generan un rectángulo de casi todo el mundo. Las fuentes son parte de MapLibre y siguen pitch, relieve, globo y su oclusión. Los resaltados se componen encima del relleno.

`fit:"landmass"` ajusta una bandera completa a la extensión Mercator de cada `Polygon` conectado del GeoJSON, conservando todos sus huecos y sin crear canvas, imágenes cargadas o fuentes por isla. Todos se pintan una sola vez dentro de los mismos uno o dos canvas del país. Una masa que cruza ±180° conserva su UV entre las dos partes. Esta opción permite identificar la bandera en la Francia metropolitana aunque la geometría también incluya Guayana, Antillas y Reunión:

```json
{"type":"flag-fill","region":"FR","src":"media/flag-fr.svg","fit":"landmass","t":12,"dur":0.8,"out":18,"fadeOut":0.5,"opacity":0.95}
```

`landmass` usa los polígonos tal como vienen: no agrupa islas cercanas ni une piezas contiguas que el archivo haya separado en varios polígonos. Cada isla recibe una repetición de la bandera en la misma textura; `global` mantiene el comportamiento original. Ambos modos conservan toda la geometría suministrada, incluidos los territorios de ultramar.

La máscara conserva los vértices de la geometría suministrada; su borde visual tiene la precisión de la textura raster, no una precisión vectorial ilimitada. Cada combinación de geometría, imagen y `fit` usa como máximo dos canvas, 2048 px en la dimensión mayor del conjunto, independientes de `devicePixelRatio` (aproximadamente 16 MiB RGBA como máximo, más la copia GPU). Los huecos o islas menores que un píxel pueden perder detalle en zoom cercano. La bandera se adapta a la extensión geográfica y puede deformarse; con `global`, los territorios separados amplían la extensión y parte del diseño puede quedar recortada. `landmass` mejora el encuadre de los colores, pero conserva esa misma resolución global: no aumenta el detalle de la costa ni de islas diminutas. Para detalle regional a gran zoom, retirar la bandera y usar `highlight`. Las geometrías polares/mundiales y latitudes fuera de ±85.05113° no están soportadas; `check` las rechaza.

Las texturas se crean una vez al preparar la escena y se reutilizan al repetir país/imagen/fit en esa instancia. `animate:false`, `raster-fade-duration:0` y transiciones de opacidad desactivadas evitan relojes adicionales y subidas de textura por cuadro. No se añaden timers, solicitudes de geometría ni cachés globales. La vista del motor posee los recursos y MapLibre libera sus texturas cuando se desmonta el mapa.

El Showcase usa [su bandera pública local](showcase/assets/flags/us.svg), sin medios de un episodio. La miniatura real y el control visual de globo, pitch, relieve, costuras y ambos formatos se capturan en la QA de servidor, después de preparar las teselas; no sustituirlos por una imagen de otro componente.

`atlas.persistentPortrait` expone el `portrait` de [HUD.md](HUD.md): se agrega a `scene.hud`, con `src`, `name`, `role`, `x`, `y`, `size`, `focus`, `t`, `dur`, `out` y `exit` numérico. Omitir `at` mantiene el retrato fijo en pantalla durante el zoom. El demo no contiene una foto personal: muestra la silueta existente rotulada «RETRATO DE EJEMPLO».

## Banderas compartidas del noticiero

El motor incluye flag-icons 4:3 (MIT) en `_atlas/assets/flags/`, con códigos en minúsculas. `src` de flag-fill se resuelve respecto a `assets/` **del episodio**: `"../assets/flags/py.svg"` requiere que ese episodio tenga `assets/flags/py.svg`. No apunta automáticamente al motor. Para reutilizar la bandera compartida desde el demo sin copiarla:

```json
{"type":"flag-fill","region":"PY","src":"../../../nodehistory/_atlas/assets/flags/py.svg","fit":"landmass","t":0,"out":6,"opacity":0.94}
```

Esta ruta corresponde a la topología servida `sandbox/nodepolitics/<episodio>/assets/` → `sandbox/nodehistory/_atlas/assets/flags/`. Si cambia la topología, adapta la ruta o sirve una URL estable al motor. `flag-chip` con `code:"PY"` resuelve el recurso desde su módulo y no requiere esta ruta.
