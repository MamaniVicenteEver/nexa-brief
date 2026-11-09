# Cómo elegir una animación sin leer código

1. Leé `index.json`: buscá por nombre, familia o descripción. `file` apunta al JSON de esa animación, relativo a este directorio.
2. Abrí solo ese JSON. `description` explica qué hace y cuándo usarla; `duration` está en segundos y `loop` describe su vista previa. `states`, `layer` y `params` documentan estados, capa y parámetros (tipo, valor predeterminado, rango y descripción). Un rango `null` indica que el componente no impone un límite; un valor predeterminado `null` requiere proporcionar el dato si es obligatorio.
3. Copiá `example` a `scene.json → items`, asigná un id único y adaptá tiempos, lugares, textos y medios. Si referencia otro id (por ejemplo un portaaviones), agregá también su ejemplo del catálogo. `dependsOn` enumera medios locales, sprites/manifiestos y geometría; `usedBy` permite consultar escenas ya preparadas. Los demos son ilustrativos, no afirmaciones históricas.
4. `sfx` contiene ids o alias declarados en `../sfx.json`; la vista previa es muda. La mezcla de audio del episodio se prepara por separado.
5. Abrí `work/tactico/demo.html?only=<name>&bg=white&autoplay=1&loop=1&bare=1`. Usá `preview.bg` para conservar contraste: blanco por defecto, oscuro para luz aditiva y texto crema. `checker` permite revisar transparencias. Ninguno de esos modos solicita teselas. `preview.poster` es relativo a la raíz de la plantilla.

Regenerar todo: `node engine/tactico/tools/catalog.mjs`. Regenerar solo especificaciones desde el catálogo y los demos: `node engine/tactico/tools/animations-spec.mjs`. Después regenerá los pósters con `nice -n 15 node work/tactico/tools/animation-posters.mjs` y revisá `work/tactico/thumbs/hoja.jpg`. Ambos generadores cubren automáticamente componentes nuevos con demo; completá las descripciones de sus parámetros en el registro.

El Showcase lee este índice y carga la ficha JSON de una animación al abrirla; no necesita leer el código del motor.
