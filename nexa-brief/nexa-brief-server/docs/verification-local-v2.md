# Verificación local del render v2

El 5 de noviembre de 2026 se ejecutó `render_promo.py` con un perfil sintético v2, Chromium y ffmpeg locales. La página, el JavaScript, la imagen SVG y el audio se cargaron desde `productions/nodetech/synthetic/`; el MP4 se escribió directamente bajo `renders/synthetic/check/`. No se llamó a modelos ni a publicadores. `ffprobe` informó un stream de video de 320 × 180, un stream de audio y 1,000 segundos de duración. La primera ejecución dentro del sandbox no pudo abrir el servidor HTTP local; se repitió fuera de él.

Para reproducir, usar un checkout de prueba sin archivos `.env` y sustituir las rutas de Python y Chrome por las locales. El directorio temporal contiene solo datos sintéticos y se elimina al finalizar. El servidor HTTP escucha únicamente en localhost.

```bash
SERVER=/ruta/al/checkout/nexa-brief-server
PYTHON=/ruta/al/venv/bin/python
CHROME=/ruta/a/chrome
[ ! -e "$SERVER/.env" ] && [ ! -e "$SERVER/../.env" ] || { echo 'Usa un checkout sin .env'; exit 1; }
TMPDIR_REVIEW=$(mktemp -d)
PROFILE="$TMPDIR_REVIEW/profile"
VIDEO="$PROFILE/productions/nodetech/synthetic"
mkdir -p "$VIDEO/assets" "$PROFILE/renders/synthetic/check" "$TMPDIR_REVIEW/config"
printf '%s\n' '{"schema_version":2,"id":"synthetic","providers":{}}' > "$PROFILE/profile.json"
printf '%s\n' '{"configs":[{"audio":{"src":"assets/song.mp3"}}]}' > "$VIDEO/assets/config.json"
printf '%s\n' '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#235a8a"/><circle cx="160" cy="90" r="55" fill="#ffd467"/></svg>' > "$VIDEO/assets/image.svg"
printf '%s\n' "window.__promo={scenes:()=>[{t1:1}],seek:async(t)=>{let im=document.getElementById('art');if(!im.complete||!im.naturalWidth)throw Error('image failed');document.body.style.opacity=String(0.5+t/2)}};" > "$VIDEO/assets/runtime.js"
printf '%s\n' '<!doctype html><html><body style="margin:0;background:#101827"><img id="art" src="assets/image.svg"><audio src="assets/song.mp3"></audio><script src="assets/runtime.js"></script></body></html>' > "$VIDEO/index.html"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i sine=frequency=440:duration=1 -c:a libmp3lame "$VIDEO/assets/song.mp3"
XDG_CONFIG_HOME="$TMPDIR_REVIEW/config" NEXA_PROFILE_DIR="$PROFILE" PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$CHROME" "$PYTHON" "$SERVER/src/templates/_tools/commercial/render_promo.py" productions/nodetech/synthetic/index.html "$PROFILE/renders/synthetic/check/synthetic.mp4" --fps 5 --size 320x180 --to 1 --workers 1
ffprobe -v error -show_entries stream=codec_type,width,height -show_entries format=duration -of json "$PROFILE/renders/synthetic/check/synthetic.mp4"
rm -rf "$TMPDIR_REVIEW"
```

Esta prueba cubre el servidor local y el render con archivos sintéticos. No verifica conectores externos, modelos, publicaciones ni la calidad o el rendimiento de un video de producción.

## API con perfil sintético v2

El 5 de noviembre de 2026 se inicializó un perfil v2 independiente en un
directorio temporal y se verificó el ciclo completo de arranque y apagado de la
aplicación FastAPI, con `APP_ENV=test`, publicación y automatismos desactivados,
sin clave de cifrado y con `HOME`, `XDG_CONFIG_HOME` y `NEXA_PROFILE_DIR`
aislados. El checkout de prueba no tenía archivos `.env`. El sandbox denegó la
creación de sockets IPv4, por lo que las peticiones se ejecutaron mediante
`httpx.ASGITransport` dentro del mismo proceso; no se verificó conectividad TCP
ni se contactaron servicios externos.

En el perfil recién creado, `GET /health`, `/api/v1/storage/profile`,
`/api/v1/content/catalog`, `/api/v1/explainer/videos`,
`/api/v1/explainer/designs?category=node_history`,
`/api/v1/explainer/sandbox`, `/api/v1/explainer/sandbox/components`,
`/api/v1/niches` y `/openapi.json` devolvieron 200. El perfil indicó el ID
sintético y `health` informó `auto_publishing: false`; se observaron diez
diseños para `node_history`, 36 nichos y ocho carpetas del sandbox. Un recurso
inexistente devolvió 404.

En una segunda ejecución se registraron un video, metadatos y un recurso
sintéticos: el video y el archivo devolvieron 200, una petición `Range` devolvió
206 con los bytes esperados y `/docs` devolvió 200. El catálogo y OpenAPI
respondieron 200. Se comprobaron el apagado del lifespan y que todos los archivos
bajo `data/` terminaban en `.json`. El perfil temporal se eliminó después de la
prueba. No se ejecutaron modelos, grabaciones, publicaciones ni conectores.

**Límite:** esta verificación no habilita la ejecución de agentes CLI en v2.
Su guardia rechaza el lanzamiento mientras no exista un backend de aislamiento
verificado; las guías del perfil no son una barrera de seguridad.

## NodeMotion: reanudación y render sintético

Se verificaron 14 pruebas dirigidas de NodeMotion, empaquetado y ciclo de vida de los grabadores, y cuatro pruebas legacy de drafts con el adaptador de texto sustituido por un doble. Cubren la separación entre composición, `assets/`, logs y renders; la vista previa de recursos; la reanudación de trabajos antiguos y nuevos; y las entradas y salidas separadas de los tres adaptadores de grabación.

Además, se reanudó un job sintético serializado desde `HTML_GENERATED` y se ejecutó el pipeline real con Playwright, Chromium y ffmpeg locales, sin modelos ni publicación. El HTML estaba en la raíz de producción y el audio, el video de fondo, el JavaScript y la configuración en `assets/`. El job terminó en `packaged`, con sus recursos y grabación indexados y el archivo final bajo `renders/`. `ffprobe` detectó video de 320 × 180 y audio; un píxel rojo del resultado confirmó que se cargó el video de fondo sintético. La duración observada del archivo fue 2,24 segundos. Chromium registró un único 404 de recurso no identificado; el video y el audio sí se verificaron. El perfil temporal se eliminó tras la prueba.

## Migración y grabación sintética

El 5 de noviembre de 2026 se preparó y activó un perfil v1 sintético nuevo sin directorio `config/`, usando la migración local y sin añadir defaults manualmente. Tras la activación, peticiones ASGI de la composición migrada, su loader y el SVG referenciado por el storyboard devolvieron 200. La grabación de Explainer usó Chromium y ffmpeg reales mediante un runner de prueba limitado a 320 × 180, 5 fps y un segundo; terminó en `done`, con referencia al log y recurso de video indexado bajo `renders/`. `ffprobe` confirmó una duración de 1,000 segundos, video de 320 × 180 y una pista de audio. Se comprobó que los archivos bajo `data/` eran JSON y se eliminó el perfil temporal. No se ejecutaron modelos, conectores ni publicaciones.

## Showcase en navegador con perfil sintético

El 5 de noviembre de 2026 se probó el componente React de Showcase con Chromium, CSS Tailwind compilado y una API local real conectada a un perfil v2 temporal. Un harness Vite sustituyó únicamente las secciones de muestras y biblioteca heredada; la autorización interna se reemplazó solo en el servidor de ensayo. El perfil recibió Vida mediante el bootstrap local con confirmación de propiedad.

En escritorio de 1440 px, los marcos 9:16 y 16:9 midieron 270 × 480 y 640 × 360 px. En móvil de 390 px midieron 270 × 480 y 316 × 177,75 px. Se detectó un desbordamiento por un hash largo de revisión en la cabecera; se retiró ese detalle interno y el ancho de documento medido quedó en 390 px. El componente Vida cargó un canvas de 1080 × 1920 con píxeles no transparentes; Kit cargó su escenario y canvas. La prueba no verificó seek ni comparó visualmente cada motor.

La promoción de Vida movió la carpeta del perfil de prueba a producción y conservó ID, URL del catálogo y de la vista del componente e IDs de episodios. El listado actualizado mostró producción. No se observaron errores HTTP de recursos ni excepciones de página durante ese recorrido; el navegador advirtió que un iframe con scripts y mismo origen no es una barrera de aislamiento. No se publicaron ni grabaron videos y se eliminaron los archivos temporales.

## Web y mezcla de sonido

La suite completa de Vitest terminó con 207 pruebas aprobadas. TypeScript y
Biome sobre los archivos modificados pasaron, y `next build --webpack` produjo
la aplicación. La compilación predeterminada con Turbopack rechazó el enlace de
dependencias externo del checkout temporal; no se atribuyó a la aplicación.
La revisión visual con datos sintéticos cubrió filtros y diálogo de muestras
en escritorio y móvil, sin desbordamiento. La carga de sus archivos se comprobó
en pruebas HTTP independientes; no se grabó el ejemplo largo de 90 segundos.

Se corrigió el limitador de efectos para FFmpeg 4.4.2 local, que no admite
`alimiter:latency`. Una señal sintética comprobó que se conserva la posición,
el inicio y el final del efecto, además de la continuidad de la narración y la
duración de la mezcla. No se repitió esta comprobación en FFmpeg moderno ni en
el servidor de producción.
