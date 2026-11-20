# Informe: Grunge Montaje

lyrics-grunge-montage (propuesto) · nodemotion/lyrics, base lyrics-grunge · 68 s · estado: lista para revisar (prototipo en Sandbox, sin render) · 2026-11-16

## Segunda corrección del 2026-11-16 (tras «parece una versión con modificaciones»)

Diagnóstico, con la referencia a 25 fps (todos los cuadros) y la réplica a 12,5 y 25 fps en hojas pareadas: el problema no era el orden de escenas sino el **lenguaje de movimiento**. Lo que la referencia hace en todas las tomas y la réplica no hacía:

1. **Temblor a cuadros** (boil de stop-motion): cada 2 cuadros la letra, la tiza y los bordes de papel saltan de posición, giro y escala. La réplica deslizaba suave o quedaba quieta.
2. **Ecos**: cada palabra lleva 1-2 copias desplazadas y desenfocadas que saltan por su cuenta (en rojo detrás del rojo).
3. **Erosión de fotocopia**: la letra está comida por vetas verticales y motas, y la erosión cambia en cada cuadro. La réplica tenía letra limpia.
4. **Cortes de toma dentro de la frase**: el metraje cambia de toma (111 cortes medidos) mientras la letra sigue, a veces revelado por un agujero de papel rasgado.
5. **Barrido scan en casi cada cambio**, grano fuerte y fino, polvo y parpadeo de exposición.
6. **Cierres que se vacían**: al final la marca se queda sola, la corona se borra trazo a trazo, la marca desaparece y queda el fondo vacío. La réplica dejaba «GRACIAS» fijo hasta el fundido.

### Qué cambió
- **Motor** (`player.js`, bloque «MOVIMIENTO ERRÁTICO»):
  - `boil`: pasos discretos de `translate`, `rotate` y `scale` por cuadros (propiedades CSS individuales, no pisan las entradas);
  - `echoes`;
  - `erode`: máscara de erosión que salta de posición cada paso y escala con la letra;
  - tiza con 3 variantes alternadas;
  - bordes de papel con 3 recortes alternados;
  - `bgCuts`: tomas nuevas en los cortes medidos (`config.bgCuts`), con agujero rasgado que se abre en dos cuadros;
  - `shake`: temblor de cámara y golpe al entrar;
  - `textures`: polvo, grano y exposición por cuadros;
  - `endScan`: barrido al cerrar la escena;
  - palabras rojas gigantes con el metraje visible dentro (`screen`).

  Todo es determinista (tablas con semilla) y se regula con `config.fx` = {step, boil, echo, shake, tex, cuts, endScan}.
- **Cierres**: tiza con `erase` (se borra en el sentido en que se dibujó) y tiempos negativos contados desde el final de la escena, para cualquier duración.
  - **v1 «Marca gigante»**: corona y subrayado se borran, subtítulo y línea final se corren, el título sale con barrido y queda el metraje.
  - **v2 «Tarjeta de papel»**: como el final del video; corona y subrayado se borran, la marca se va y queda el papel vacío.
  - Ecos y fantasma se van con su pieza.
- **Línea de tiempo**: pila «THE PLACE I HAD» a la escala de la referencia (54 s). El resto de escenas recibe el lenguaje nuevo sin cambiar su guion.
- **Demo**: pieza `grunge-montage.movimiento` en `info.json` y `showcase/components.json`; resúmenes de los cierres actualizados.

### Verificación
- 16:9 completo a 12,5 fps (850 instantes) contra la referencia, tramos a 25 fps (4-14 s y 8-12 s) y cuadros a tamaño completo (9,2 s, 24,6 s, 43 s, 54,5 s y el cierre 65,5-67,5 s).
- Cierres v1 y v2 a 8 fps.
- 9:16 en 9 instantes.
- `?only=grunge-montage.movimiento`.
- Sin errores de página; solo los 404 de sondeo de config que el motor ya hacía.

### Sigue distinto
- Metraje de stock propio: 6 clips que se rotan con otros puntos y encuadres, no las tomas del original.
- Letra real, no el texto del video.
- Algunas escenas tienen la letra algo más pequeña que la referencia.
- La letra del original tiene relleno con textura de foto en algunas palabras blancas; aquí es erosión.
- 9:16 adapta la composición horizontal.
- Sin render HyperFrames.

## Corrección del 2026-11-16 (tras la revisión del usuario: «el resultado no es el esperado»)

Comparación nueva: referencia y réplica a 5 fps (341 instantes por lado, 0 a 68 s) en hojas lado a lado, no solo fotogramas sueltos. Cambios:

- **Corte scan**: antes eran barras rojas y blancas sólidas; ahora es un filtro que desplaza a los lados franjas horizontales del propio cuadro (metraje y letra juntos), con estela roja tenue, como en la referencia.
- **Metraje y fondos**: imagen más clara con niebla blanca y viñeta suave (`look` en config); fondo nuevo de niebla clara (`bg.light`) para las tomas «blancas» del video (5,4 s, 31 s, 34,8 s, 49 s, 51,4 s).
- **Pincel**: trazos blancos gruesos y opacos con borde seco (elipses, subrayados, flechas, marcos), antes finos y grises.
- **Movimiento**: apertura con palabras repartidas en diagonal que se juntan y engordan (`gather` + `grow`); «SNAPPED» que baja y engorda; pila vertical que corre (LIKE, FOOT, IS ON THE, GAS); letras verticales L-I-K-E y rejilla de letras; «ROLL» espaciado antes del eco del estribillo; «LOST» sustituye a «IN MY CELL».
- **Escala**: textos agrandados a la medida de la referencia en unas 30 escenas (WANT IT ALL, NEVER GAVE, MY WHOLE CREW, THE / PLACE, rejillas, DO NOT / PUT US ON / THE MAP, etc.); rejilla F×K 2x6 en Archivo.
- **Intro** (también define la apertura de la miniatura): es la primera toma real del video (0 a 1,44 s) con `config.intro.artist` en la línea roja y `config.intro.title` en la palabra blanca con corona y flecha. Con la intro apagada se ve la letra.
- **Outro v1 «Marca gigante»** (toma 59,4 a 61,4 s del video) y **outro v2 «Tarjeta de papel»** (tarjeta final 64 a 66,6 s): `config.outroDesigns`, textos de `config.outro` (title, sub, feats), elección con `config.outro.version` o `?outro=v1|v2`. La escena 59,4 s muestra ahora la última palabra («CONTROL») y la marca queda en el cierre.
- **Miniatura**: el fotograma de 12 s (el que usa la miniatura) muestra la línea roja completa con el marco de pincel. `thumbnail-style.json` creado.
- **Demo completa**: `info.json` con `components` (intro, outro v1/v2 en grupo `outro`, 7 piezas) y `catalog`; `showcase/components.json` y `showcase/index.html` (galería: `?only=<componente>&p=<JSON>&aspect=`; en la lista se monta un solo reproductor por vez).

Verificación: 16:9 (341 instantes) y 9:16 (intro, 15,6 s, 23 s, 35,8 s, 50,5 s, outro), `?outro=v1|v2`, `?only=` (intro con título propio, outro v2 vertical, escena s10) y galería. Sin errores de página; solo los 404 de sondeo de `config.json` y `assets/lyrics-grunge-montage.config.json` que ya hacía el motor. El ensamblado del servidor da los mismos bytes que el verificado. Hojas de comparación solo en el equipo local (no se suben fotogramas de la referencia).

Sigue distinto: metraje de stock propio (no el del original); texto = letra real, no el texto mal transcrito del video; animaciones internas aproximadas a 0,2 s; collage final sin las miniaturas exactas del original; 9:16 adapta la composición horizontal (no recompuesto).

## Lo que no se cumplió (estado anterior, actualizado)
- **La réplica no es idéntica al video.** Replica estructura, orden, tiempos (0,2 s), colores, tipografías y tipos de movimiento de 53 tomas, pero:
  - El metraje del original (stock de terceros) no se usa: se rotan 6 clips Pexels, así que el fondo difiere en cada toma.
  - Tamaños de texto y trazos de tiza/pincel aproximados; varias escenas necesitan una segunda tanda de ajuste (tamaños, ritmo de palabras, grosor de pincel).
  - Cortes «scan» y manchas rojas simplificados (franjas desenfocadas, no contenido real desplazado).
  - Resumen final: collage generado con las frases de la canción, no las miniaturas del original.
  - La marca de cierre usa «NodeMotion» en lugar de la marca del original.
- Texto en pantalla: letra real (Whisper), no el texto mal transcrito del video, según la orden.
- No se renderizó ni se validó con HyperFrames. Catálogo y galería creados; falta el registro del motor compartido (`extract.py --extract`), que hará el integrador.
- Tokens y tiempo del orquestador: sin dato.

## 1. Consumo
Orquestador: claude-sonnet-5-5 (arranque con claude-haiku-5-5); sin delegación a Codex; tokens sin dato.

## 2. Búsquedas y descargas
Ninguna. Canción y clips salen del almacén compartido de lyrics-grunge (copiados dentro del servidor). No se copió el video ni el audio de la referencia.

## 3. Recursos
Ver CREDITS.md. Canción con derechos de terceros: solo comparación interna.

## 5. Puerta de calidad
1. Relleno: sin frases añadidas; todo el texto es la letra real. 2. Cifras: no aplica. 3. Medios: stock de ambiente (no hay material real del tema). 4. Texto: revisado en 16:9 en unos 50 instantes; hay textos pequeños frente a la referencia. 5. Miniaturas: estilo definido (`thumbnail-style.json`, tokens `grunge`); fotograma de 12 s revisado; no se generaron imágenes. 6. Créditos completos.

## 6. Decisiones y siguiente paso
- Motor propio (--new-design) porque la base genera escenas al azar y la referencia es un montaje fijo; motor base intacto.
- Usuario: confirmar ID `lyrics-grunge-montage` y nombre «Grunge Montaje»; autorizar (a) segunda tanda de ajuste fino, (b) render de validación HyperFrames, (c) 9:16 y catálogo showcase.

## 7. Archivos
~/.local/share/nexa-brief/profiles/profesional/sandbox/nodemotion/lyrics-grunge-montage/: index.html, player.js, assets/ (config.json con timeline, lyrics.json, song.mp3, media/graded), work/tools (timeline.py, build.py, spec.json, config.base.json), work/ref/ANALISIS.md, work/compare/comparacion-01.jpg.
Análisis en este equipo: docs/investigaciones/nodemotion/ANALISIS-letras-lyrics-grunge-montage-2026-11-16.md. Brief: sandbox/referencias/nodemotion/lyrics-grunge-montage/BRIEF.md.
