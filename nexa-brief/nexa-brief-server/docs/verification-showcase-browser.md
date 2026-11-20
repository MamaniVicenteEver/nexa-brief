# Ensayo local de showcase con Chromium

Se usó un perfil v1 temporal, inicializado con `--all --apply --confirm-ownership`, una API local y Chromium sin llamadas a modelos, publicación ni grabación. El navegador bloqueó solicitudes a hosts externos. El ensayo usó metadatos y motores presentes en el snapshot de código; no se abrió ni modificó el perfil real.

| Diseño y entrada | Antes | Después de promover | Recursos locales observados |
|---|---|---|---|
| Kit `rough.title` | HTTP 200; tres canvas visibles | Ya estaba en producción | Sin errores JavaScript de página ni respuestas HTTP de error; solicitud de Google Fonts bloqueada |
| Vida `characters.heladero` | HTTP 200; canvas visible | HTTP 200; canvas visible | Sin errores JavaScript de página ni respuestas HTTP de error |
| Cara a Cara `comparacion.dos-tarjetas` | HTTP 200; dos canvas visibles | HTTP 200; dos canvas visibles | Sin errores JavaScript de página ni respuestas HTTP de error; solicitud de Google Fonts bloqueada |
| Atlas Cinemático `atlas.highlight` | HTTP 200; dos canvas visibles | No verificado en Chromium | El snapshot no contiene la caché ignorada y el motor pidió numerosos recursos ausentes con HTTP 404. En la primera ejecución, dos JSON opcionales relativos al showcase también dieron 404. |

La visibilidad del canvas y el estado de red no demuestran fidelidad visual ni corrección de la animación. En particular, la vista de Atlas local no puede considerarse verificada. No se sustituyeron los recursos ausentes ni se simularon fotogramas; la ejecución de la página se interrumpió tras observar la carga fallida de la caché.

Como comprobación independiente y de solo lectura, en `alfred-server` se verificó que existen el archivo mundial PMTiles, los sprites, una fuente y teselas de satélite y terreno. Una solicitud HTTP `Range: bytes=0-0` a esos recursos y al HTML devolvió 206 con `Content-Range`; los JSON opcionales `showcase/assets/geo.resolved.json` y `showcase/assets/overlays.json` devolvieron 404. Esto confirma que los recursos comprobados están disponibles allí, pero no sustituye un ensayo visual completo del navegador en ese entorno.

Después de esa ejecución se ajustó el showcase para que use directamente los mismos valores vacíos que antes se aplicaban al fallar esos dos JSON opcionales. La ruta normal del motor conserva la carga de datos del episodio, y el showcase respeta una fuente de overlays o geometría explícita. Las 49 pruebas Node de Atlas pasaron, incluidos esos casos. El ensayo posterior con caché disponible se describe a continuación.

## Comprobación posterior en el servidor con caché real

Tras aplicar el código y preparar el catálogo del perfil, se abrió la API de desarrollo local de `alfred-server` con Chromium headless, en modo de solo lectura. Se bloquearon las solicitudes a hosts externos y los archivos de audio y vídeo; no se guardaron capturas ni medios. No se invocaron modelos, promoción, publicación ni grabación.

| Entrada de la API estándar | Resultado observado |
|---|---|
| Atlas Cinemático `atlas.highlight` | HTTP 200; dos canvas visibles, el principal con el píxel central opaco; el motor indicó cero recursos de mapa faltantes y `seek(3)` terminó correctamente. Se observaron 30 solicitudes de caché, ninguna respuesta HTTP local fallida ni error JavaScript. |
| Atlas Movimiento `air.bomber` | HTTP 200; inicialización en aproximadamente 5,9 segundos, canvas visible con el píxel central opaco, lista de recursos faltantes vacía y `seek(3)` correcto. No se observaron respuestas HTTP locales fallidas ni errores JavaScript. El texto de estado permaneció en «Preparando…» después de inicializar. |

No hubo solicitudes a hosts externos en estas dos vistas. La prueba confirma carga, dibujo observable y funcionamiento de seek para esas entradas concretas; no verifica fidelidad visual, todos los componentes, una grabación ni el resultado de promoción en el perfil real.
