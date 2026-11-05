# Imperio: reutilizar las piezas del video

El punto de entrada es **[catalog.json](catalog.json)**, un índice de este diseño. Cada pieza enlaza su contrato en `contracts/<nombre>.json`: entradas, tipos, unidades, valores por defecto y ejemplo. Basta leer el índice y el contrato elegido; no hay que leer ni copiar el motor, el catálogo global o `japon.js`.

Para consultar por terminal desde esta carpeta:

```sh
node tools/components.mjs list
node tools/components.mjs describe imperio.country
node tools/components.mjs example imperio.arrow
```

Copiar el ejemplo al storyboard y cambiar datos. [recipes.json](recipes.json) incluye fecha sobre mapa, campaña de dos destinos, ciudad, archipiélago, archivo y cierre v2. `imperio.campaign` combina las piezas en una sola cámara con `parts`; las piezas geográficas individuales son planos `main` con mapa. `imperio.date` y `imperio.caption` son overlays. Los tiempos son relativos al beat o anclas `@palabra`; las coordenadas son WGS84 **[longitud, latitud]**, nunca píxeles. Las cámaras usan `[lon,lat,span,giro]` o `País*k`.

Para destinos de campaña, `flag: f1` selecciona el archivo declarado en `f1`. Las imágenes y los clips se pasan como rutas del episodio (`assets/flags`, `assets/media`), con sus licencias. No inventar una bandera histórica a partir del nombre actual de un país. Los polígonos se pasan en `region.poly`; `region.within` permite recortarlos dentro de otro país; los archipiélagos admiten `region.dots`. Un nombre de país no representa automáticamente sus fronteras históricas.

Después de montar un episodio: `kit.py check <id>`, revisión visual en ambos formatos y reglas de [imperio-production.md](../../guides/imperio-production.md). La voz, transcripción y sonido conservan el flujo existente. La preparación de esta biblioteca no genera otra narración ni otro render. El cierre `imperio.outro` muestra un mundo completo ligero que se aleja; `bg` admite `world` y `dark`, y los tiempos de like, suscripción, campana y apoyo se pasan en JSON. `imperio.outrov2` conserva su composición.

## Qué se extrajo y de dónde

Se revisó el video `nodeatlas/japon-expansion-prueba/render/japon-expansion-prueba-16x9.mp4`, su storyboard y sus componentes originales:

| Pieza visible | Ejemplo en el video | Componente reutilizable |
|---|---|---|
| Sol, rayos, barcos y título original | Apertura, primeros 10 s | `sun`, `rays`, `ships`, `native`, `title` |
| Título condensado con fecha | Meiji · 1868, hacia 15 s | `word` |
| Año blanco y subrayado | 1905, 1914, 1931, 1937, 1940–41, 1942 | `date` |
| Bandera circular y país | Sajalín, Corea e islas del Pacífico | `flag`, `country` |
| Flechas de avance | Campaña, de 25 s en adelante | `arrow`, `campaign` |
| Países, regiones e islas resaltadas | Corea, Manchuria y archipiélagos | `territory` |
| Puntos y nombres de ciudades | Pekín, Shanghái, Singapur, Aleutianas | `city` |
| Video/foto B/N, fundido y pie | Archivo durante la campaña | `footage`, `archive`, `caption`, `campaign.plates` |
| Rosa de los vientos | Primer archivo | `compass` |

Los nombres de la tabla llevan el prefijo `imperio.`. Son **23 entradas**: también se conservan los mapas, haces de expansión, intros y cierres propios del diseño, incluido `outrov2` solicitado. Algunos son composiciones completas y otros exponen piezas internas; no son 23 animaciones nuevas. `country`, `flag`, `city`, `arrow` y `territory` llaman al mismo renderizador de `campaign`; `date`/`caption` usan sus mismas funciones; `sun`/`rays`/`ships`/`compass` reutilizan `imperio.map`.

También se revisó `nodepolitics/imperio-demo`: su storyboard usa `imperio.title`, `imperio.word`, `imperio.archive`, `imperio.map`, `imperio.expansion`, `common.flash` y `common.lyric`. Los dos últimos son compartidos y se muestran aquí porque aparecen en ese video. Los demás `common.*` que no se identificaron en estos dos videos siguen fuera de esta selección. Las 23 piezas del diseño más esas dos compartidas forman 25 entradas iniciales.

## Componentes de futuros videos

Después de crear un componente propio, ejecutar `kit.py components <id>`: los componentes sin errores se registran automáticamente en la biblioteca con su origen, entradas JSON, ejemplo y fotogramas aislados 9:16 y 16:9. El showcase de Imperio los incorpora sin modificar su lista manual. El control sigue requiriendo revisar la hoja y el resultado visual; si una miniatura falla, se informa y se puede reproducir la animación. Los catálogos de pruebas `sandbox` no se publican en la biblioteca de producciones. La vista aislada es solo para el showcase; el video mantiene el mapa y las coordenadas. El componente debe declarar un `example` representativo y medios del episodio como rutas `assets/...`.

## Mantener el catálogo

La fuente visual compartida está en `components/campaign.js` y `components/elements.js`. El archivo histórico del episodio se conserva para compatibilidad y comparación; los nuevos episodios reciben las piezas por el diseño y no necesitan copiarlo.

1. Actualizar el registro de componentes y `design.json.showcase.components` si corresponde.
2. Regenerar el catálogo global con `kit.py catalog`.
3. Ejecutar desde `nexa-brief-server/`:

```sh
node src/templates/_tools/explainer-kit/designs/imperio/tools/components.mjs build src/templates/_tools/explainer-kit/catalog.json
```

Esto genera el índice, los contratos y `QUICK.md` de Imperio. No editarlos a mano. Los tipos internos de destinos, cámaras y medios se mantienen en `input-types.json`; validarlos contra los ejemplos y las recetas.

El showcase muestra fotogramas reales y carga la animación al pulsar reproducir. Omite el atlas físico mediante su adaptador aislado: **en producción el mapa sigue presente y se usan las mismas coordenadas**. No copiar ese adaptador a un video. Al cambiar un ejemplo, regenerar sus dos miniaturas y el manifiesto `showcase/imperio-thumbs/index.json`.
