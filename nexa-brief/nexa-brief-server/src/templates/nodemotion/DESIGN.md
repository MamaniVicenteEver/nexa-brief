# NodeMotion · guía de diseño reproducible

Esta guía describe el diseño del video y el contrato de sus dos miniaturas. Se lee antes de reproducir o extender un estilo. Las fichas `DESIGN.md` de cada plantilla contienen sus fuentes, colores, funciones y transiciones concretas. No es una skill instalada: es la especificación que una skill o un agente puede seguir.

## Reglas de miniaturas

- Lienzo de exportación: 1280 × 720, JPEG de menos de 2 MB. Composición normalizada a 1280 × 720 para que tarjeta, escenario y archivo mantengan proporciones.
- **A:** de una a cinco palabras. Usar el nombre limpio de la canción o una frase real y potente. Centro óptico, una o dos filas, ancho útil de 1090 px. Tamaño máximo de 190 px; medir con la fuente real y reducir hasta que el bloque quepa.
- **B:** admite más palabras, con un máximo de cuatro filas y 200 caracteres. Tamaño máximo de 138 px. Priorizar una frase literal de la canción; si no hay letra disponible, conservar el título sin inventar versos. La preparación con IA puede proponer la frase a partir del contenido que recibe.
- No mostrar artista, etiquetas promocionales ni metadatos alrededor del título. «LETRAS» aparece siempre debajo de la última fila, alineada al extremo derecho del título, con el color del rótulo definido por la plantilla a opacidad completa, al 24,3% del tamaño principal en A (Neón: 21,87%) y al 34,5% en B; el hueco de A queda al 25,2% del original y el de B al 28%.
- NODEMOTION aparece en la esquina inferior derecha, a 56 px del borde derecho y 46 px del inferior: cuerpo 15.6 px (20% mayor), peso 900 y trazo de 0.4 px, espaciado 2 px y opacidad 0.28. No tiene caja ni ocupa la cabecera.
- A y B comparten la paleta de la plantilla. No invertir los colores ni introducir paneles, rejillas, cintas o rótulos genéricos. La diferencia principal está en el texto, su escala y el fondo que el usuario elige.
- Usar las fuentes originales declaradas en `design-tokens.json`. Neón usa Monoton para A y Archivo Black para B. Las fuentes distribuidas en `assets/fonts/` incluyen licencias y su índice de procedencia. Se incrustan en el SVG para que el JPEG coincida con la vista.

## Fondos y contraste

Cada opción guarda `background.kind`, `mediaSource`, `availableSources`, `mediaVersion`, `time`, `asset`, `overlay`, `edgeDarkening`, `filter`, `overlayMode`, `x`, `y`. `frame` usa el medio del video preparado: un fotograma si es video, o la imagen original si la plantilla usa una foto. El tiempo inicial es 12 s; puede elegirse otro. Si el tiempo supera el metraje, se usa el tiempo módulo la duración del clip, como el fondo en bucle del video. La duración se obtiene bajo la misma cola y se cachea por archivo/modificación con máximo 32 entradas; FFprobe tiene un límite de 5 s. Solo si no se puede leer/extraer el instante se intenta el primer fotograma. `image` usa una imagen propia JPG/PNG/WebP de hasta 8 MB; se corrige la orientación y se normaliza a JPEG. `solid` conserva el campo de color de la plantilla.

La imagen ocupa todo el fondo con recorte `cover`, sin deformación. El encuadre permite izquierda, centro o derecha; en centro conserva la imagen completa y, para izquierda o derecha, amplía el fondo al 120% para permitir el desplazamiento incluso con fuentes 16:9. El contrato admite también posición vertical. El medio conserva sus colores originales: no se aplican filtros de matiz, sepia, gris, saturación ni brillo del video. Una única capa negra uniforme tiene opacidad 0.20 por defecto, sin viñeta extra. El control manual permite entre 0 y 0.85 y guarda `overlayMode: manual`; su porcentaje se muestra junto al deslizador. Neón conserva únicamente en la tipografía el brillo de `neon.core`, `neon.glow` y `neon.deep`. Si la plantilla no tiene medio, se conserva su campo de color; no se inventa una foto.

Las miniaturas se muestran como imágenes estáticas: ningún iframe o video por tarjeta. El primer acceso a un fondo de video extrae un JPEG con FFmpeg y lo cachea por ruta, modificación y segundo; las dos opciones comparten el resultado si eligen el mismo instante. La caché guarda hasta doce fotogramas por proyecto. La API serializa el trabajo pesado y cierra el proceso al cancelar o agotar el tiempo. Abrir o elegir una opción no captura de nuevo el diseño completo; solo Grabar solicita el JPEG final elegido.

El formulario recibe `background.sourceKind` (`image`, `video` o `none`) según el archivo real resuelto. Para una imagen muestra «Imagen de la plantilla» y «Cambiar imagen de la miniatura»; solo para un video aparecen los segundos. El campo se aplica después de 700 ms sin escribir o con el botón, evitando una extracción por dígito. El panel «Fondo de esta opción» es un `details` cerrado inicialmente. El selector de archivo usa un botón de alto contraste y conserva teclado y foco.

Ver A/B cambia la **opción editada**, independiente de la **elegida para grabar**. Los controles y el texto siempre corresponden a la opción vista. Guardar no debe cambiar la elección; ver B mientras A está elegida permite editar B sin elegirla.

## Contrato de implementación

```json
{"text":"HOLA REMIX","design":{"styleVersion":5,"templateId":"lyrics-neon","subtitle":"LETRAS","background":{"kind":"frame","time":12,"asset":"","overlay":0.2,"edgeDarkening":0,"overlayMode":"template","x":0.5,"y":0.5}}}
```

Los colores y la tipografía se hidratan desde el config activo y `design-tokens.json`; no se aceptan fuentes o URLs arbitrarias desde el editor. Cada opción se guarda por separado mediante `PUT /api/v1/drafts/{id}/thumbnails/{A|B}`. Las imágenes se suben con `POST /api/v1/drafts/{id}/thumbnail-background`; la respuesta es un identificador de recurso. `GET` de esa ruta devuelve el fondo estático; `source=auto|image|video` elige el medio existente. Si el usuario usa una imagen en Impacto, se conserva también como alternativa el video original de la plantilla. Cambiar entre medios no elimina la imagen subida. `GET /api/v1/drafts/thumbnail-fonts/{id}` sirve una fuente local.

`src/core/draft_thumbnails.py` normaliza textos, migra diseños anteriores y calcula la huella. `draft_thumbnail_assets.py` resuelve recursos locales y extrae fotogramas. `draft_thumbnail_renderer.js` comparte `renderSvgAsync` entre la web y Playwright. El editor espera las subidas y sincroniza los cambios locales y la elección antes de grabar. Editar texto, oscurecimiento, encuadre y selección no hace escrituras a la API. Los textos de canción y publicación siguen siendo metadatos independientes.

Los archivos `thumbnail-style.json` de Impacto, Carta de Amor y Caladas especifican `A.rowTreatments`, `B.rowTreatments` y, cuando procede, `outlineWidth`. Impacto usa Anton roja sólida; Carta de Amor, Great Vibes en A y Playfair Display 500 itálica en B, ambas con el rosa de `colors.script`; Caladas combina Anton sólida y contorno transparente de grosor 0.022 del cuerpo. Neón conserva sus bandas y contornos propios. El renderer limita los tratamientos a `solid`, `outline` y `striped`.

Las portadas del catálogo son archivos independientes: `assets/card-poster.webp`. Para renovarlas junto con las capturas A/B: `PYTHONPATH=. .venv/bin/python src/templates/nodemotion/tools/preview_thumbnails.py lyrics-neon lyrics-impact lyrics-romantic lyrics-calado --posters`. El comando sin `--posters` actualiza solo la evidencia documental.

## Cómo reproducir un video

1. Leer la ficha de la plantilla elegida y su config activo (`activeId` → `configs[]`, cuando exista). Mantener su paleta, fuentes, medios, `seed`, tamaños relativos y modos de escena.
2. Tomar `audio.currentTime` como reloj. Cargar `config.json`, luego `assets/config.json`, y finalmente los valores de respaldo. Leer `lyricsUrl`; no escribir la letra dentro del HTML.
3. Agrupar la letra con las funciones que declara la ficha. Conservar duraciones, curvas y alternancia de escenas. Las animaciones y la cámara deben derivarse del tiempo del audio y de la semilla.
4. Editar el generador cuando exista; las promos y las familias Grunge/Mixtas/Sad se regeneran con las herramientas compartidas. No modificar el reloj `data-nb-hf-clock` ni portar cambios a Remotion por suposición.
5. Verificar pausa, reproducción y búsqueda en 16:9 y 9:16. Respetar `src/templates/AGENTS.md` si cambia el video. Las miniaturas no modifican la intro, el outro ni el movimiento del video.
6. Preparar A y B con texto y fondo independientes. Comprobar lectura a 320 × 180, ausencia del artista, máximo de filas, marca discreta y tamaño de «LETRAS» (A: 24,3%, Neón: 21,87%; B: 34,5%). Exportar y comparar el JPEG con la vista.

## Catálogo visual y fichas

Cada captura muestra **A a la izquierda y B a la derecha**, generadas con el renderer real. Las frases vienen del contenido de ejemplo cuando hay letra disponible. Son capturas de miniaturas, no renders completos de los videos.

| Plantilla | Fuente A / B | Lenguaje visual y movimiento | Ficha |
|---|---|---|---|
| promo-dynamic | Archivo / Archivo | Archivo variable y lima eléctrica sobre tinta. Grandes palabras, recortes, volantes gráficos y HUD. Cortes y cambios de tamaño marcados por el audio. | [DESIGN](commercial/promo-dynamic/DESIGN.md) |
| promo-editorial | Archivo / Archivo | Composición editorial de papel, blanco y negro con Archivo variable. Filetes, contornos, cortes de texto, placas y medios a sangre. Barridos y entradas por secciones. | [DESIGN](commercial/promo-editorial/DESIGN.md) |
| promo-kinetic | Montserrat / Montserrat | Tipografía Montserrat pesada sobre gris carbón, rojo y amarillo. Filas de texto y cambios de escala con salidas sincronizadas a la escena. Usa JetBrains Mono para información auxiliar del video. | [DESIGN](commercial/promo-kinetic/DESIGN.md) |
| promo-sports | Roboto / Roboto | Roboto negra e inclinada, amarillo sobre negro. Metraje deportivo, polvo, contornos gigantes y marcos. Aparición de palabras, scramble y diagonales de energía. | [DESIGN](commercial/promo-sports/DESIGN.md) |
| promo-trendy | Montserrat / Montserrat | Montserrat pesada e inclinada, azul noche y lima. Anillos, puntos, fugas de luz, estelas de zoom y glitch. Golpes de escala y desplazamientos coordinados por escena. | [DESIGN](commercial/promo-trendy/DESIGN.md) |
| promo-urban | Inter Tight / Inter Tight | Inter Tight, negro, naranja y rojo. Flechas, escalones, bloques, paneles y rótulos cromados. Cortes gráficos y entradas de tipografía compacta. | [DESIGN](commercial/promo-urban/DESIGN.md) |
| 01-image-bg | Arial Black / Arial Black | Título tipográfico ajustado a las zonas libres de una imagen. Paleta blanco/negro del config, tipografía de sistema pesada y composición calculada por medida real de texto. | [DESIGN](image/01-image-bg/DESIGN.md) |
| living-landscape | Shippori Mincho / Shippori Mincho | Paisaje vivo con Shippori Mincho y Montserrat. Pétalos, aves, niebla, luciérnagas y estrellas en canvas; poema adaptable y cambios lentos de color. | [DESIGN](image/living-landscape/DESIGN.md) |
| subject-spotlight | Montserrat / Montserrat | Montserrat sobre degradado azul oscuro. Figura central y palabra gigante de fondo; piedras, aura, chispas, levitación y pulsos de energía vinculados al audio. | [DESIGN](image/subject-spotlight/DESIGN.md) |
| lyrics-amor-impredecible | Bodoni Moda / Bodoni Moda | Composición romántica y lectura pausada. Serif de contraste y caligrafía según la plantilla; fondos oscuros, cámara suave, desenfoque, bokeh y latidos contenidos. | [DESIGN](lyrics/lyrics-amor-impredecible/DESIGN.md) |
| lyrics-calado | Anton / Anton | Palabras caladas como láminas que dejan ver el video. Anton, paleta cálida y fría alternada, agrupación de frases, selección determinista de modos y grano escalonado. | [DESIGN](lyrics/lyrics-calado/DESIGN.md) |
| lyrics-caution | Anton / Anton | Señalética roja, negra y blanca. Anton condensada con Archivo extendida y Oswald. Barras, cruces, etiquetas y mosaicos; entradas por carácter y barridos horizontales. | [DESIGN](lyrics/lyrics-caution/DESIGN.md) |
| lyrics-ceniza | Playfair Display / Playfair Display | Carbón, hueso y brasa con Playfair Display e IBM Plex Mono. Texto que se revela, cae, se deshace o se evapora; ceniza, motas y viñeta. Movimiento pausado. | [DESIGN](lyrics/lyrics-ceniza/DESIGN.md) |
| lyrics-collage | Anton / Anton | Papel rasgado, tinta y rojo con Anton, Bebas Neue, Stardos Stencil, Permanent Marker y Courier Prime. Recortes que entran por ambos lados, figuras alternadas y rayos lentos. | [DESIGN](lyrics/lyrics-collage/DESIGN.md) |
| lyrics-cristal | Big Shoulders Display / Big Shoulders Display | Cristal nocturno con rosa y cian, Big Shoulders Display, Unbounded y Caveat Brush. Mundos de bokeh/aurora/hielo; grietas, fragmentos y brillos que siguen eventos de la letra. | [DESIGN](lyrics/lyrics-cristal/DESIGN.md) |
| lyrics-expediente | Special Elite / Special Elite | Expediente con Special Elite, Oswald y Caveat. Grupos de palabras, papeles rasgados, hilos y lámpara. Golpe corto de entrada, polvo y parpadeo discontinuo. | [DESIGN](lyrics/lyrics-expediente/DESIGN.md) |
| lyrics-grunge | Anton / Anton | Anton, Archivo y Oswald sobre rojo, negro y papel. Bordes rasgados, manchas, ecos y trazos. Golpes de entrada y montaje por frases; no confundir con la paleta lima de Mixtas. | [DESIGN](lyrics/lyrics-grunge/DESIGN.md) |
| lyrics-impact | Anton / Anton | Anton roja sobre metraje oscurecido. Una palabra dominante por grupo, revelado breve, punch de cámara y sacudidas. Respiración lenta del fondo y grano discontinuo. | [DESIGN](lyrics/lyrics-impact/DESIGN.md) |
| lyrics-latido | Cormorant Garamond / Cormorant Garamond | Composición romántica y lectura pausada. Serif de contraste y caligrafía según la plantilla; fondos oscuros, cámara suave, desenfoque, bokeh y latidos contenidos. | [DESIGN](lyrics/lyrics-latido/DESIGN.md) |
| lyrics-lluvia-gris | Cormorant Garamond / Cormorant Garamond | Cormorant Garamond inclinada e Inter en pizarra, noche y acero. Lluvia, niebla y carta cinematográfica; revelado, goteo y desaparición suave del texto. | [DESIGN](lyrics/lyrics-lluvia-gris/DESIGN.md) |
| lyrics-manifiesto | Archivo / Archivo | Manifiesto editorial en papel y tinta. Láminas tipográficas de pleno, columna, contrapunto, microtexto y borde. Cambios de escala y composición al ritmo de frases, con grano sutil. | [DESIGN](lyrics/lyrics-manifiesto/DESIGN.md) |
| lyrics-memoria | Special Elite / Special Elite | Special Elite, Caveat y VT323 en crema, sepia y rosa. Película antigua, weave, HUD VHS y polaroids; escritura, borrado y cambios de lámina. | [DESIGN](lyrics/lyrics-memoria/DESIGN.md) |
| lyrics-mirada | Fredoka / Fredoka | Fredoka, League Gothic y Alfa Slab One en tostado, crema, verde y carmesí. Ojos, manos, plumas y palomas; paneles, columnas, recortes y transiciones por frase. | [DESIGN](lyrics/lyrics-mirada/DESIGN.md) |
| lyrics-mixtas | Archivo / Archivo | Tipografía editorial de contraste alto con lima, rojo, naranja y papel. Archivo extendida, Anton e Inter. Ecos, líneas rodantes, rótulos y ticker organizados por frases. | [DESIGN](lyrics/lyrics-mixtas/DESIGN.md) |
| lyrics-neon | Monoton / Archivo Black | Noche urbana, tubos cálidos y halo naranja. Alterna Monoton y Archivo Black; columnas escalonadas, encendido por carácter, cámara que retrocede entre columnas y textura CRT/grano. | [DESIGN](lyrics/lyrics-neon/DESIGN.md) |
| lyrics-night-journey | Noto Serif Display / Noto Serif Display | Viaje nocturno con Figtree, Noto Serif Display, Alegreya Sans y Newsreader. Luna, túnel, papel y rutas; asignación de escenas, entradas y salidas calculadas sobre el audio. | [DESIGN](lyrics/lyrics-night-journey/DESIGN.md) |
| lyrics-resaltado | Lora / Lora | Lectura editorial con Lora y Playfair Display. Páginas, párrafos y marcador irregular que progresa sobre puntos de control de la letra. Cambio de página y cámara de mano sutil. | [DESIGN](lyrics/lyrics-resaltado/DESIGN.md) |
| lyrics-romantic | Great Vibes / Playfair Display | Composición romántica y lectura pausada. Serif de contraste y caligrafía según la plantilla; fondos oscuros, cámara suave, desenfoque, bokeh y latidos contenidos. | [DESIGN](lyrics/lyrics-romantic/DESIGN.md) |
| lyrics-stylish-kinetic | Lilita One / Lilita One | Lilita One y Sniglet sobre rojo, amarillo, menta y verde azulado. Caracteres redondos, arco, flip, slide, pop y pincel; cambios de escena con un ritmo juguetón. | [DESIGN](lyrics/lyrics-stylish-kinetic/DESIGN.md) |
| lyrics-suave | Anton / Anton | Anton y Permanent Marker, fondo fotográfico oscuro y cálido. Filas de lectura, polvo y cámara suave; opacidad, desplazamiento y desenfoque progresivos. | [DESIGN](lyrics/lyrics-suave/DESIGN.md) |
| lyrics-triste | Oswald / Oswald | Oswald y Special Elite con lluvia y fotografía fría. Filas que se retiran, palabras que se apagan y cámara flotante. Entradas largas con leve sobrepaso. | [DESIGN](lyrics/lyrics-triste/DESIGN.md) |
| lyrics-vacio | Big Shoulders Display / Big Shoulders Display | Big Shoulders Display e Inter, negro, blanco y niebla. Mucho espacio vacío, revelado y borrado; atmósfera fría y salida por humo/descomposición según la escena. | [DESIGN](lyrics/lyrics-vacio/DESIGN.md) |
| motion-backdrop | Arial Black / Arial Black | Título pesado sobre video de fondo. El mismo sistema de medidas y colocación que Image BG, con actualización del medio y audio como reloj. | [DESIGN](video/motion-backdrop/DESIGN.md) |


### Revisión de Neón · contorno y rayas

A: primera fila en Archivo Black con contorno y relleno transparente; última fila en Monoton, con sus bandas de tubo. B: todas las filas anteriores a la última en Archivo Black con contorno y sin relleno; última fila con relleno a rayas y huecos transparentes. «LETRAS» usa Archivo Black, mide el 21,87% del título en A y el 34,5% en B, con el color del rótulo definido por la plantilla a opacidad completa con el hueco al 25,2% del original en A y al 28% en B y termina debajo del extremo derecho de REMIX o DE TI. NODEMOTION aumenta de 13 a 15.6 px y usa negrita 900 y refuerzo de trazo de 0.4 px.


## Edición local rápida y caché temporal

`nexa-brief-web/src/shared/storage/expiring-json-store.ts` ofrece CRUD de JSON (`create`, `get`, `list`, `set`, `update`, `remove`, `clear`, `clean`). Caducidad desde la última escritura: 24 horas; máximo 32 borradores y 256 KiB estimados. La limpieza ocurre al acceder o invocar `clean`, sin temporizadores de fondo. Solo elimina claves de su propio espacio; tolera datos corruptos, falta de cuota y almacenamiento bloqueado.

`features/studio/services/thumbnail-local-edits.ts` conserva únicamente texto, parámetros editables de fondo y elección, por ID de borrador y origen del navegador. No almacena imágenes, fuentes, credenciales ni copias antiguas de la paleta. Al restaurar, fusiona esos ajustes con los estilos actuales enviados por la API. Los cambios no sincronizados sobreviven a cerrar/reabrir; una sincronización correcta retira la copia temporal. Si falla, conserva los cambios para reintentar y Grabar sigue esperando el guardado. Cuando localStorage no está disponible, la interfaz indica que los ajustes solo están en memoria.

El renderer conserva la última imagen hasta decodificar la siguiente; no muestra un fondo vacío entre ajustes. Las actualizaciones de B no redibujan A. Los medios se cachean por revisión del archivo, tipo, recurso y segundo, independientes del texto o del oscurecimiento; las fuentes se reutilizan por familia, estilo y peso. La API sigue resolviendo fotogramas nuevos y subidas de imágenes.

Carta de Amor: título A/B rosa `colors.script`, LETRAS en A con la serif de B (Playfair Display 700 itálica) y su marfil previo; B usa el mismo blanco marfil de su rótulo A y aumenta de 30% a 34,5% del título (+15%). Un trazo del mismo color refuerza su intensidad. Neón toma `neon.core`, `glow` y `deep`; el contorno usa 0.045 del cuerpo y el brillo los factores 0.05, 0.16 y 0.4 de `components/intro.js`, conservando los tratamientos de contorno y bandas.

En Neón B, «LETRAS» se coloca 10% de su propio tamaño más abajo; su tamaño, color y tipografía no cambian. Véase [AUTOMATIZACION.md](AUTOMATIZACION.md) para los valores y el flujo de agentes.

Hilo Rojo, Manifiesto, Collage Callejero, Escenas Mixtas y Grunge Rojo tienen tratamientos y paletas documentados en sus fichas. Mixtas y Grunge detectan el primer medio original de la lista `media`; si se aporta una imagen se conserva como alternativa al video.

Las catorce plantillas restantes de letras se revisaron contra sus fuentes, pesos y paletas del video. Las escenas y listas de medios de Viaje Nocturno, Cristal Roto y la familia Lluvia Gris/Memoria/Ceniza/Vacío aportan videos originales; Lluvia Gris prioriza `street-rain` para mantener legible su serif fina. Cada ficha enumera sus colores y fondo elegido. Las opciones siguen compartiendo paleta y conservan la imagen original con un 20% de oscurecimiento por defecto.
