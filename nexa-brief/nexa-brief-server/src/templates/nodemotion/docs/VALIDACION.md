# Validación del diseño de miniaturas · 11 de noviembre de 2026

Se aplicó en `alfred-server`, en el checkout indicado por el usuario. El proceso API usa el perfil `profesional` de esquema 3; no había borradores en proceso al instalar. Los archivos existentes se comprobaron por SHA-256 antes de reemplazarlos. Los videos, medios y proyectos del perfil no se modificaron.

## Evidencia visual y funcional

- 33 parejas A/B capturadas con `tools/preview_thumbnails.py`: 66 miniaturas, con fuentes locales reales y comprobación de límites del texto. Ningún título sale de la zona segura ni supera las filas permitidas.
- Inspección visual de Neón, Manifiesto y Romántico. La captura de Neón muestra Monoton en A, Archivo Black en B, halo naranja y el mismo fondo del video.
- Dos JPEG finales de Neón capturados mediante `_capture_svg`, el motor utilizado por Grabar: 1280 × 720; A de 102617 bytes y B de 89430 bytes. Fuentes incrustadas y lectura del fondo verificadas visualmente.
- Backend local: 21 pruebas pasaron, incluyendo flujo de selección y captura, migración, fuentes, seguridad del SVG, subida de imágenes y extracción/caché de fotogramas reales.
- Interfaz local: 8 pruebas pasaron, incluyendo guardado por opción, tiempo aplicado explícitamente, subida de imagen y espera del guardado antes de Grabar.
- Servidor: las 16 pruebas nuevas de backend pasaron. El renderer y la fuente Monoton responden HTTP 200.
- Los enlaces de documentación y las imágenes referenciadas por las fichas existen. Lint de los cuatro componentes/hooks modificados pasó.

## Recursos

La API mantiene una sola cola para extracción/captura; los JPEG de fondo se reutilizan y cada proyecto conserva hasta doce fotogramas. La web comparte las solicitudes de recursos y limita la caché a 24 entradas; la URL del fondo incluye la huella del diseño para invalidarse al cambiar el contenido. No se mantienen iframes ni videos por miniatura.

Antes del trabajo, el servidor tenía aproximadamente 1.68 GB de RAM usada y 9.63 GB disponibles. Durante la recarga/compilación de desarrollo llegó a 3.10 GB usados; al terminar se midieron 2.86 GB usados y 8.45 GB disponibles. El proceso de Next pasó de aproximadamente 0.58 GB a 1.52 GB RSS tras compilar. En las últimas dos muestras de `vmstat` no hubo entrada/salida de swap y la CPU estuvo 96–99% inactiva. No quedaron procesos FFmpeg/Chromium de las capturas. Estas muestras breves verifican liberación inmediata, no constituyen una prueba prolongada de fugas.

## Límites de la comprobación

El navegador de verificación fue redirigido a `/login`; no se revisó el modal con una sesión autenticada. Las capturas del renderer y el flujo del editor se comprobaron de forma aislada.

El chequeo global de TypeScript local reporta una incompatibilidad ajena al cambio en `ExplainerCategoryWindow.tsx:148`. En el servidor, Vitest ejecutó sus siete casos de miniaturas con éxito, pero devolvió error de entorno al resolver un `/home/alfred/package.json` inválido y anunció un problema de resolución de `jsdom`; por ello no se considera que ese comando completo haya pasado. No se modificó la configuración ajena del home.

Las pruebas históricas del servidor para el renderer anterior se conservaron; las nuevas están en `test_nodemotion_thumbnail_design.py` y `test_nodemotion_thumbnail_assets.py`. No se hizo commit, push, publicación en redes ni grabación de videos.


## Revisión solicitada: contorno, rayas y LETRA

«LETRA» pasa a ser obligatoria en ambas opciones: 30% del tamaño principal, debajo de la última fila y alineada al extremo derecho de esa fila. NODEMOTION pasa de 13 a 15.6 px (+20%) y usa peso 700. En Neón, A combina Archivo Black de contorno sin relleno con Monoton a bandas en la última fila; B usa contorno transparente en las primeras filas y relleno a rayas en la última. Ambos tipos de Neón se incrustan en el JPEG. El renderer usa versión 3 y la huella de captura versión 6 para renovar vistas y archivos anteriores.

Se regeneraron las 33 parejas (66 miniaturas), sin texto fuera de la zona segura. Las 17 pruebas de diseño/recursos pasaron. Se conserva el texto y fondo de cada opción al migrar los borradores anteriores.


## Ajuste de separación y rojo

«LETRA» usa rojo puro #FF0000 con opacidad completa. En A pasa del 30% al 27% del tamaño principal (reducción relativa del 10%); en B conserva el 30%. La separación visible se calcula desde los límites reales de los glifos SVG y se deja al 40% del hueco anterior: reducción del 60% sin solapamiento. Se mantienen título, fondo, encuadre, contornos, rayas y marca. Renderer versión 4 y huella de captura versión 7.


## Pulido de color, etiqueta y marca

El rótulo ahora dice «LETRAS». Conserva los tamaños A=27% y B=30%, y utiliza el color principal de la plantilla con opacidad completa: en Neón, crema cálida #FFE9CF. Se retira el rojo externo a esa elección visual. El hueco visible se reduce otro 30% respecto a la revisión anterior: queda al 28% del hueco original. NODEMOTION mantiene su tamaño y opacidad y pasa a peso 900 con refuerzo de trazo de 0.4 px. Renderer versión 5 y huella de captura versión 8.


## Revisión de cuatro plantillas · renderer 6 / huella 9

Tres agentes GPT-6.1 Terra con razonamiento alto revisaron Impacto, Carta de Amor y Caladas por separado. Se incorporaron sus estilos propios mediante `thumbnail-style.json`. Neón conserva su combinación de contorno y bandas. LETRAS en A se reduce otro 10%: cuerpo 24,3% del principal, hueco 25,2% del original. B mantiene cuerpo 30% y hueco 28%.

La oscuridad central y periférica del video se calcula y se reduce a la mitad en la miniatura; se mantiene el grado de color nativo, sin duplicar brillo ni blur. Caladas ahora resuelve también `video.src`. Una imagen propia sigue siendo independiente por opción y, sin medios, se conserva la paleta.

Las cuatro parejas y sus cuatro `assets/card-poster.webp` se regeneraron con el renderer real. Las portadas del catálogo son archivos distintos del diseño editable del borrador; actualizar solo el renderer no las renovaba. Se reforzó el contorno de Caladas y se tomó un tono neutro de la plantilla para la marca de Impacto. La captura del navegador aportada por el usuario mostraba la vista anterior; se incrementa la versión del renderer para renovar su carga al recargar la pestaña.

Verificación local de esta revisión: 26 pruebas de backend correctas y 8 de interfaz; 33 parejas A/B regeneradas sin desbordamientos. JPEG finales de Neón mediante `_capture_svg`: A 91191 bytes, B 115382 bytes, ambos 1280 × 720.


## Corrección de colores y editor · renderer 7 / huella 10

Revisión realizada sin agentes. Regla vigente: imagen/fotograma sin filtros de color del video; solo una capa negra uniforme al 20% por defecto. El control manual se conserva y el porcentaje es visible. Una prueba de píxeles comprueba RGB (200,100,50) → (160,80,40) al 20% y → (70,35,18) al 65%, igual en el centro libre y los bordes; no hay segunda viñeta.

Carta de Amor recupera Great Vibes rosa (`colors.script`) para A y Playfair Display 500 itálica marfil (`colors.serif`) para B, con fuentes locales y los colores del config activo. Neón conserva `neon.core`, `glow` y `deep` en su tipografía; la imagen no recibe esos filtros. Las paletas de las otras plantillas siguen resolviéndose desde sus roles del config activo.

El panel de fondo empieza cerrado. El tipo del archivo real decide si aparecen segundos o «Imagen de la plantilla» y «Cambiar imagen de la miniatura». El selector de archivo tiene contraste activo. Los segundos se aplican al dejar de escribir durante 700 ms o al pulsar el botón. Ver B dirige los controles a B y no cambia la opción elegida para grabar.

28 pruebas de backend y 10 de interfaz correctas. La prueba de interfaz comprueba expresamente el cambio de oscurecimiento de B mientras A sigue elegida, la actualización del escenario y guardado, los segundos automáticos y la ausencia de controles de video para una imagen. No se modificó el video ni se inició una grabación.

La revisión de segundos detectó que el clip de Neón dura 9,267 s. Antes, 12 s y 24 s devolvían el primer cuadro por estar fuera del clip. Ahora se calcula el instante del bucle con la duración real y se renueva la clave de caché de fotogramas; FFprobe y FFmpeg se cierran también al cancelar o agotar el tiempo.

Verificación adicional: el video real de Neón produce contenido diferente al pedir 12 s y 24 s. Se regeneraron las 33 parejas documentales sin desbordamientos y las cuatro portadas afectadas. Una captura secuencial de cuatro parejas terminó en 8,58 s; GNU time informó un pico de 198808 KB para la ejecución. El chequeo global de TypeScript sigue limitado por el error previo en `ExplainerCategoryWindow.tsx:148`; no informa errores en los archivos cambiados.


## Edición en navegador · renderer 8 / huella 11

30 pruebas de backend verificadas (29 en la suite completa y la prueba adicional de recuperación del video de Impacto), y 12 de interfaz correctas. La suite de interfaz verifica caducidad/CRUD/límites, restauración tras reabrir, ausencia de escrituras durante la edición, sincronización explícita y reintento tras error, selección de imagen/video, conservación de la imagen anterior durante el nuevo render y ausencia de redibujado de A al cambiar B.

Prueba en Chromium del renderer real: 3 peticiones iniciales para la imagen y las fuentes; después de 20 cambios de texto y oscurecimiento siguieron siendo 3 (cero adicionales). La generación de los 20 SVG tomó 170 ms en esta máquina; esta cifra no incluye la rasterización ni promete ese tiempo en otros equipos. Las imágenes conservan la capa negra uniforme del 20% y los colores del medio.

Carta de Amor usa rosa en A y B; LETRAS B pasa a 34,5% (+15%) y A adopta la serif del rótulo B. Neón replica los tres colores, el grosor y los factores de brillo de la intro, en vez de una aproximación de halo. Se añaden medio alternativo y revisión estable de medios al contrato. Los videos de las plantillas no cambian.


## Encuadre y rótulos · renderer 9 / huella 12

En el fondo 16:9, `preserveAspectRatio` llenaba exactamente el lienzo y no dejaba margen horizontal. Ahora izquierda y derecha amplían el fondo al 120% y lo desplazan al borde correspondiente; centro conserva el encuadre completo. Una prueba real en Chromium midió píxeles diferentes para las tres posiciones. El cambio se genera localmente y conserva la caché del medio.

Carta de Amor usa `colors.serif` #F2E7DA para LETRAS en A y B. Neón reduce LETRAS de A un 10% relativo: 24,3% × 0,9 = 21,87% del título. La captura del usuario en el segundo 2 y `components/intro.js` confirman núcleo crema #FFE9CF y halo #FF5A1F / #E01400; las dos opciones mantienen esos valores originales. Se revisaron visualmente ambas parejas.

Verificación local: 30 pruebas de backend y 11 de interfaz correctas; las dos capturas y portadas se regeneraron.

## Neón B y preparación automática · renderer 10 / huella 13

«LETRAS» de Neón B baja un 10% de su propio tamaño; no cambia su cuerpo ni su color. Las pruebas simuladas cubren la selección A/B, valores predeterminados, preparación previa, formatos y errores. El flujo no se ha probado mediante una transcripción, grabación o publicación real.

## Cinco plantillas de letras · huella 14

Hilo Rojo, Manifiesto, Collage Callejero, Escenas Mixtas y Grunge Rojo: parejas A/B y portadas regeneradas con el renderer compartido, colores y fuentes de cada plantilla. Mixtas y Grunge recuperan un fotograma de su lista de medios; sin imagen o video se conserva el color de fondo propio. Las cinco parejas se comprobaron dentro de la zona segura.

## Resto de plantillas de letras · huella 15

Se revisaron las 14 parejas A/B restantes (incluidas las de Fase de pruebas) contra tipografías, pesos, paletas y medios originales. Oswald 700 se toma de la fuente con licencia incluida en el repositorio. Se actualizaron las parejas y portadas sin modificar los videos. Las pruebas comprueban las 14 fuentes y colores, paletas anidadas y medios originales.

## Piloto de Promo Editorial · renderer 11 / huella 16

Solo la primera promoción se rediseña para aprobación. A: título corto sobre el medio completo. B: papel con pliegues deterministas, imagen a sangre, filetes y masa de tinta; un solo título cambia de negro a blanco al atravesar el corte. Archivo 900 extendida al 112%, paleta original, dos filas como máximo. B no supera la cantidad de palabras de A y no aparece «LETRAS».

Ocho composiciones con títulos de una a cinco palabras y una palabra larga dentro del área segura. JPEG finales mediante `_capture_svg`: A 196862 bytes, B 104163 bytes, ambos 1280 × 720. Validación local de capturas: 5,51 s, pico de 157176 KB; Chromium cerrado al finalizar. Cuarenta y cinco pruebas de backend y nueve de interfaz aprobadas; Biome correcto. Las 64 salidas de otras plantillas comparadas con el renderer previo son idénticas. Sin grabar ni publicar videos.
