# imperio · NODEPOLITICS — hoja rápida

> GENERADO por `tools/components.mjs build` desde el registro vivo. No editar a mano.
Leer primero [catalog.json](catalog.json): índice corto. Después solo el contrato JSON del componente elegido en contracts/. No hace falta leer el motor ni copiar componentes de otro video.

Ejemplos de composición: [recipes.json](recipes.json). Flujo y origen de las piezas: [REUSE.md](REUSE.md).

En producción se conserva el mapa y se usan coordenadas WGS84 [longitud,latitud]. El showcase omite el mapa base para cargar rápido. Los tiempos se expresan en segundos locales o @palabra de la voz.

- **imperio.title**: Apertura (ref 0–11 s): atlas físico con el país foco rayado y el SOL carmesí que late; la cámara se aleja y gira apenas; nacen los RAYOS translúcidos en abanico hacia `dir` con barquitos; el título en su IDIOMA ORIGINAL (kanji, alemán, ruso…) entra carácter por carácter con su traducción tipeada debajo y se borra de derecha a izquierda; después el título condensado blanco SUBE desde abajo con degradé. [Entradas JSON](contracts/imperio.title.json).
- **imperio.map**: Atlas físico en movimiento lento (zoom y giro leve) sobre un país o región: territorio rayado, sol que late, rótulos de mares, rayos opcionales y PINES (punto carmesí + nombre) para lugares concretos (una base, una ciudad, un puerto). [Entradas JSON](contracts/imperio.map.json).
- **imperio.expansion**: Expansión: desde el sol del país foco salen HACES carmesí translúcidos hacia cada región destino, uno tras otro; al llegar, la región se raya (territorio ocupado) y aparece su nombre en condensada blanca. [Entradas JSON](contracts/imperio.expansion.json).
- **imperio.archive**: Material de archivo (ref 11.5–27.7 s): el atlas se DESATURA a gris, baja humo oscuro desde arriba y la foto en blanco y negro se FUNDE en multiplicar con el mapa (lo claro deja ver el mapa, lo oscuro lo tapa); los rayos carmesí siguen encima, rosa de los vientos fina abajo a la derecha, grano y polvo; la cámara sigue alejándose. [Entradas JSON](contracts/imperio.archive.json).
- **imperio.word**: Título condensado BLANCO (Fjalla One) sobre el plano en curso: cada renglón SUBE desde abajo con degradé de opacidad (arriba aparece primero) y desenfoque, y después el título se ACHICA lento y exponencial (rápido al principio) mientras el mapa sigue moviéndose (ref 10–27 s: 'JAPANESE EMPIRE'). [Entradas JSON](contracts/imperio.word.json).
- **imperio.native**: Nombre en su IDIOMA ORIGINAL (kanji, alemán, ruso, árabe latinizado…) en gris grande: cada carácter entra con escala y desenfoque escalonados, la traducción en mayúsculas negras se tipea debajo, y al final se borra de derecha a izquierda (ref 4.9–9.9 s: '南進論 · SOUTHERN EXPANSION DOCTRINE'). [Entradas JSON](contracts/imperio.native.json).
- **imperio.introv1**: GANCHO de apertura: sobre el atlas el SOL carmesí CAE (de 3× a su tamaño, con sacudida) y sus rayos estallan en 360°; el titular condensado blanco entra palabra por palabra con estela ('^palabra^' sobre franja carmesí); en burstAt los rayos se abren hasta los bordes con destello y sacudida. [Entradas JSON](contracts/imperio.introv1.json).
- **imperio.introv2**: GANCHO pregunta + revelación: la pregunta se escribe carácter a carácter como el título en idioma original de la referencia (cada letra entra con escala y fantasma); en stampAt la pregunta sube y se achica, el SOL carmesí sale desde abajo detrás del centro con su abanico de rayos y la RESPUESTA sube en condensada blanca con degradé. [Entradas JSON](contracts/imperio.introv2.json).
- **imperio.outro**: Cierre v1 con mapa del mundo completo que se aleja y oscurece, en los colores de Imperio. [Entradas JSON](contracts/imperio.outro.json).
- **imperio.outrov2**: Outro v2: GRACIAS POR VER un 45 % más grande, letras en negrita y fondos rojo sangre oscuro en LIKE y SUSCRÍBETE. [Entradas JSON](contracts/imperio.outrov2.json).
- **imperio.campaign**: Campaña en UN plano continuo: la cámara vuela entre destinos (`cameras`); desde el país foco salen flechas gruesas hacia cada destino y llegan justo cuando la voz lo nombra (`time: "@palabra"`). [Entradas JSON](contracts/imperio.campaign.json).
- **imperio.footage**: Material de archivo en VIDEO (en vez de foto): el atlas se desatura a gris, baja humo oscuro y el clip mudo se funde en blanco y negro, en multiplicar, con el mapa; el sol y los rayos carmesí siguen encima. [Entradas JSON](contracts/imperio.footage.json).
- **imperio.date**: Fecha o rango de años blanco con subrayado carmesí; es el sello de la esquina del video, ahora reutilizable por JSON.. [Entradas JSON](contracts/imperio.date.json).
- **imperio.country**: País del video: territorio marcado, bandera circular, nombre y fecha. [Entradas JSON](contracts/imperio.country.json).
- **imperio.flag**: Bandera circular con aro, rebote y chapa con el nombre del país; se retira después de hold segundos. [Entradas JSON](contracts/imperio.flag.json).
- **imperio.city**: Punto de ciudad con pulso y nombre en chapa carmesí, como Pekín, Shanghái o Singapur en el video. [Entradas JSON](contracts/imperio.city.json).
- **imperio.arrow**: Flecha gruesa de avance con degradado y borde blanco. [Entradas JSON](contracts/imperio.arrow.json).
- **imperio.territory**: Territorio que aparece en carmesí con borde y pulso. [Entradas JSON](contracts/imperio.territory.json).
- **imperio.caption**: Pie de archivo en Montserrat itálica con fundido; mismo rótulo de lugar y año de las fotografías y clips del video.. [Entradas JSON](contracts/imperio.caption.json).
- **imperio.sun**: Sol carmesí que late sobre el país o las coordenadas elegidas; comparte el sol y los colores de bandera de imperio.map.. [Entradas JSON](contracts/imperio.sun.json).
- **imperio.rays**: Abanico de rayos sobre el mar: rumbo, apertura, cantidad, longitud y entrada por voz. [Entradas JSON](contracts/imperio.rays.json).
- **imperio.ships**: Barcos pequeños que avanzan sobre las rutas del abanico. [Entradas JSON](contracts/imperio.ships.json).
- **imperio.compass**: Rosa de los vientos de línea fina que acompaña el giro del mapa; es la del archivo original.. [Entradas JSON](contracts/imperio.compass.json).
- **common.flash**: Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido.. [Entradas JSON](contracts/common.flash.json).
- **common.lyric**: Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave.. [Entradas JSON](contracts/common.lyric.json).

Antes de crear otro componente, consultar este índice. Cambiar datos, medios, destinos y tiempos; reutilizar imperio.campaign para varias capas con la misma cámara. date y caption son overlays; las piezas geográficas son planos con mapa.

Validación de un episodio: kit.py check <id> y revisión de ambas orientaciones. Consultar guides/imperio-production.md para medios y sonido. El cierre se elige con config.outro.use; no duplicarlo en el storyboard.
