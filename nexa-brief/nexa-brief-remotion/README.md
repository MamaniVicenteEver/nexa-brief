# nexa-brief-remotion

Proyecto Remotion (Node.js), independiente del resto del monorepo — tiene su propio
`package.json`, nunca se importa como código desde `nexa-brief-server`. La única
integración es un subproceso.

## Cómo se integra con el backend

Del lado de Python, `src/adapters/recorder/infrastructure/remotion_adapter.py`
(`nexa-brief-server`) es uno de los dos motores de grabación intercambiables detrás de
`RecorderPort` (el otro es Playwright + FFmpeg, el default para la mayoría de los niches —
ver `niches.json`, campo `recorder_engine`). Hoy solo el niche `lyrics_video_neon` usa Remotion.

`RemotionAdapter` arma el `Job` real (config, letras, assets), lo serializa a un JSON de
props, y dispara **un subproceso de Node** apuntando a esta carpeta —
`settings.remotion_project_dir` (en `nexa-brief-server/src/config/settings.py`) resuelve a
`../nexa-brief-remotion` desde el backend. Nunca hay `require()`/`import` cruzado entre
Python y este proyecto: el contrato es 100% línea de comandos + JSON por stdout.

```
Python (RemotionAdapter)
  → construye props.json (configData, lyricsData, audioSrc, bgSrc)
  → subprocess: node scripts/render-node.mjs --props=... --composition=... --output=...
       (o render-lambda.mjs si el target es AWS, ver abajo)
  → lee stdout línea por línea (JSON: progreso, done, error) para reportar estado al job
```

`index.js` (raíz del proyecto) es el entry point real de Remotion — define las
`Composition` (`NeonLetras`, `NeonLetrasVideo`, `StressTest`) e importa los componentes desde
`src/components/` (que a su vez usan `src/core/neon-timeline.js` +
`shared-timeline-utils.js`). Los `defaultProps` de `index.js` son solo para
`npm run dev` (Remotion Studio) — un job real del backend los reemplaza por completo vía
`--props`.

## Local vs. AWS Lambda

El motor de render es seleccionable sin tocar código, vía `settings.remotion_render_target`
(`"local"` por default, o `"aws"`):

| | Local | AWS Lambda |
|---|---|---|
| Script invocado | `scripts/render-node.mjs` | `scripts/render-lambda.mjs` |
| Dónde renderiza | Esta misma máquina (Chromium headless vía `@remotion/renderer`) | Función Lambda ya desplegada (`REMOTION_AWS_FUNCTION_NAME`), en paralelo por chunks |
| Código de la composición | Se lee del disco en cada render (siempre al día) | Corre contra un **bundle ya publicado en S3** (`REMOTION_AWS_SERVE_URL`, subido una sola vez con `scripts/lambda-deploy.sh`) — hay que re-desplegar el bundle si cambia el código de las composiciones |
| Credenciales | Ninguna | `REMOTION_AWS_ACCESS_KEY_ID`/`SECRET` en `.env` (de un usuario IAM propio, `remotion-user`, acotado solo a S3+Lambda de este proyecto) |

**Confirmado funcionando en producción real (verificado 2026-08-19):** se corrió un render de
prueba real de 15s contra la función Lambda ya desplegada — 450/450 frames, sin errores,
costo real ~$0.025 USD. El bundle de S3 (`sites/nexa-brief-neon-letras/`) sigue vigente y no
se ve afectado por cambios locales en este repo — solo cambia si se vuelve a correr
`lambda-deploy.sh`.

Los objetos de salida de cada render en S3 (`renders/<renderId>/...`) tienen una regla de
lifecycle que los autoborra a los 3 días (configurada en el bucket, no en este repo) — no
hace falta limpiarlos a mano.

## Qué pasa realmente en cada caso, paso a paso

El código de la composición (`NeonLetras.js`/`NeonLetrasVideo.js`) nunca sabe en qué motor
está corriendo — llama a `resolveMediaSrc(audioSrc)` (`src/core/shared-timeline-utils.js:25`)
para resolver de dónde sale el audio/imagen, y esa función tiene una sola regla: **si el
string ya es una URL http(s), la usa tal cual; si es solo un nombre de archivo, lo resuelve
con `staticFile()` de Remotion** (que busca ese archivo dentro del `publicDir` activo). Todo
lo demás — cómo llegó a ser una URL o un nombre de archivo — pasa *antes*, en el script de
render, no en la composición.

**Local (`render-node.mjs`):**
1. El caller (Python o vos a mano) pasa `audioSrc: "song.mp3"` en `--props` — sigue siendo
   solo un nombre de archivo.
2. `--public-dir=test` (o el `output_dir` del job real) le dice a Remotion dónde buscar ese
   nombre. `staticFile('song.mp3')` lo encuentra ahí mismo, en disco.
3. Remotion abre Chromium headless, renderiza frame por frame leyendo ese archivo local
   directo del filesystem, y codifica el mp4 con FFmpeg — todo en la misma máquina, sin red.

**AWS Lambda (`render-lambda.mjs`):**
1. Lambda no tiene el filesystem de tu máquina — no existe ningún `test/song.mp3` al que
   pueda acceder.
2. Por eso `render-lambda.mjs`, ANTES de disparar el render, sube `song.mp3`/`bg.jpg` (los
   archivos de `--asset-dir`) al bucket S3 del proyecto (`uploadJobAsset()`,
   `nexa-brief-jobs/<jobId>/...`) y genera una **URL prefirmada** (válida 1 hora) para cada
   uno.
3. Reemplaza en el JSON de props el nombre de archivo por esa URL completa **antes** de
   invocar `renderMediaOnLambda()` — o sea, cuando la composición corre dentro de Lambda,
   `audioSrc` ya no es `"song.mp3"`, es
   `https://.../nexa-brief-jobs/<jobId>/song.mp3?X-Amz-Signature=...`.
4. `resolveMediaSrc()` detecta que es `http(s)` y la usa directo — nunca llama a
   `staticFile()`, así que nunca necesita saber que ese archivo vino de un upload.
5. Lambda invoca ~7-8 funciones en paralelo (una por chunk de frames, ver
   `--frames-per-lambda`), cada una descarga esa URL, renderiza su tramo, y Remotion los
   combina en un solo mp4 dentro de S3.
6. `render-lambda.mjs` hace polling a `getRenderProgress()` cada 4s hasta `done: true`, baja
   el resultado con `downloadMedia()`, y borra los objetos temporales que subió en el paso 2
   (best-effort, no bloqueante si falla el borrado).

En síntesis: el **código de la composición es idéntico** en ambos casos — lo único que cambia
es qué le llega en `audioSrc`/`bgSrc` (nombre de archivo local vs. URL firmada), y eso lo
decide por completo el script de render, no la composición ni `index.js`.

## Cómo probar cada motor a mano

Ambos toman los mismos `props` (JSON con `configData`, `lyricsData`, `audioSrc`, `bgSrc`) y
los mismos assets de `test/` (`song.mp3`, `bg.jpg`, `bg-video.mp4`) — la única diferencia real
es dónde corre el render.

### Local

```bash
npm run render -- \
  --props=test/config-props.json \
  --composition=NeonLetras \
  --output=out/prueba-local.mp4 \
  --public-dir=test
```

Si no existe `test/config-props.json`, armalo rápido a partir de los fixtures ya presentes:

```bash
node -e "
const fs = require('fs');
fs.writeFileSync('test/config-props.json', JSON.stringify({
  configData: require('./test/config.json'),
  lyricsData: require('./test/lyrics.json'),
  audioSrc: 'song.mp3',
  bgSrc: 'bg.jpg',
}, null, 2));
"
```

No requiere credenciales ni `.env` — renderiza en esta misma máquina con Chromium headless.
Para una prueba corta (no esperar los ~250s reales de la canción de prueba), editá el
`audio_duration_sec` en ese JSON temporal a un valor bajo (ej. 15) antes de renderizar —
`calculateNeonMetadata` en `index.js` recalcula la duración del video a partir de ese campo.

### AWS Lambda

Requiere `.env` en esta carpeta con `REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`,
`REMOTION_AWS_REGION`, `REMOTION_AWS_FUNCTION_NAME`, `REMOTION_AWS_SERVE_URL` (ver
`.env.example`) — credenciales de `remotion-user`, un usuario IAM acotado solo a este bucket y
esta función Lambda.

```bash
npm run render:lambda -- \
  --props=test/config-props.json \
  --composition=NeonLetras \
  --output=out/prueba-lambda.mp4 \
  --asset-dir=test \
  --region=us-east-1 \
  --function-name=remotion-render-4-0-498-mem2048mb-disk2048mb-900sec \
  --serve-url="https://remotionlambda-useast1-t5y0wcmlss.s3.us-east-1.amazonaws.com/sites/nexa-brief-neon-letras/index.html" \
  --timeout-ms=180000
```

Diferencia clave con el local: acá `--asset-dir` (no `--public-dir`) apunta a la carpeta con
los archivos reales (`song.mp3`/`bg.jpg`), porque el script los sube a S3 y se los pasa a
Lambda como URL firmada — Lambda no tiene acceso al filesystem de esta máquina. Genera costo
real (fracciones de centavo por segundo de video de prueba, ver la tabla de arriba).

Si cambiaste código en `src/` o `index.js` y querés que Lambda lo vea, hay que re-publicar el
bundle primero: `bash scripts/lambda-deploy.sh` (solo la parte de "sites create", no hace
falta repetir el deploy de la función si no cambió la versión de Remotion).

---

# Benchmarks de render Remotion (histórico, local)

Dos composiciones en `index.js`:

- **StressTest**: partículas + texto neón, 5 min sintéticos (9000 frames @ 30fps). Sirve de referencia de carga "barata" (box-shadow/text-shadow, sin drop-shadow encadenado).
- **NeonLetras** (`test/NeonLetras.js`): el video-lírico real de "Hola Remix" (Dalex), portado desde `test/index.html` (que era HTML/JS interactivo con audio real + rAF, no renderizable por Remotion tal cual) a una composición determinista. Dura exactamente lo que dura `test/song.mp3`: **251.57s → 7547 frames @ 30fps**, audio incluido.

## Por qué NeonLetras es mucho más lento que StressTest

Mismo fps/crf/concurrency, pero NeonLetras tarda ~15x más que StressTest (9000 frames en ~3min) pese a tener menos elementos por frame (≤26 palabras vs 40 partículas). La causa: las palabras "outline" (línea, ~50% del total) encadenan hasta **3 `drop-shadow`** para el glow neón — mucho más caro de rasterizar en Chrome headless que el `box-shadow`/`text-shadow` que usa StressTest.

## Resultados de benchmark (2026-07-23, 8 núcleos, Intel Iris Xe integrada)

| Variante | concurrency | crf | Resultado | Tiempo real | Notas |
|---|---|---|---|---|---|
| A | 2 | 18 | no se dejó terminar | ETA ~44-45min | igual que StressTest pero con crf más bajo (más caro de codificar además de rasterizar) |
| B | 4 | 18 | sin probar todavía | — | pendiente |
| C | 1 | 18 | **falló** en frame 6367/7547 (84%) | 54m53s hasta el fallo | `TimeoutError` esperando el frame — la máquina estaba saturada por una clase de Teams corriendo en paralelo, no es un bug del código. Con `--timeout=120000` (default es 30000ms) esto no debería pasar. |
| **D** | **2** | **23** | ✅ **éxito — config recomendada** | **43m04s** (54% cpu prom.) | 73MB, calidad aprobada. Guardada en `scripts/render-neon-letras-final.sh`, **no modificar**. |

## Scripts

- `scripts/render-stress-test.sh` — rerun de la config ya validada de StressTest, para comparar en igualdad de condiciones.
- `scripts/render-neon-letras.sh` — **de pruebas**, crf=18 concurrency=2 (variante A). Usalo para seguir experimentando.
- `scripts/render-neon-letras-final.sh` — **la config ganadora (variante D), no tocar.** Es el respaldo de un resultado ya bueno.

## Sobre recuperar un render que falló a mitad de camino

No hay forma de retomarlo: Remotion no guarda un video utilizable hasta que termina el encoding final, así que un fallo al 84% no deja nada aprovechable. Dos mitigaciones para el futuro:

1. **`--timeout=120000`** (o más) en vez del default de 30000ms — evita que un pico de carga externo (como una videollamada) tire abajo un render de 40+ minutos por un solo frame lento. Ya está en `render-neon-letras-final.sh`.
2. **Renderizar por tramos** (`--frames=0-3999`, luego `--frames=4000-7546`) a archivos separados y unirlos con `ffmpeg -f concat` al final — si un tramo falla, solo se rehace ese tramo, no las 7547 frames. No implementado todavía; es la opción si los renders largos siguen fallando.



❯ time npx remotion render index.js NeonLetras out/neon-letras-crf23.mp4 --concurrency=2 --codec=h264 --crf=23 --overwrite

Bundled code         ━━━━━━━━━━━━━━━━━━ 2631ms
Composition          NeonLetras
Codec                h264
Output               out/neon-letras-crf23.mp4
Concurrency          2x
Rendered frames      ━━━━━━━━━━━━━━━━━━ 2568826ms
Downloaded assets    ━━━━━━━━━━━━━━━━━━    1 file
Encoded video        ━━━━━━━━━━━━━━━━━━ 10343ms
+                    out/neon-letras-crf23.mp4 73 MB
npx remotion render index.js NeonLetras out/neon-letras-crf23.mp4   --crf=23   1394,59s user 18,45s system 54% cpu 43:04,49 total
❯


❯ time npx remotion render index.js NeonLetras out/neon-letras-gpu.mp4 --concurrency=2 --codec=h264 --crf=23 --timeout=120000 --gl=angle --overwrite

Bundled code         ━━━━━━━━━━━━━━━━━━ 3554ms
Composition          NeonLetras
Codec                h264
Output               out/neon-letras-gpu.mp4
Concurrency          2x
Rendered frames      ━━━━━━━━━━━━━━━━━━ 2966958ms
Downloaded assets    ━━━━━━━━━━━━━━━━━━    1 file
Encoded video        ━━━━━━━━━━━━━━━━━━ 10571ms
+                    out/neon-letras-gpu.mp4 73 MB
npx remotion render index.js NeonLetras out/neon-letras-gpu.mp4  --codec=h264  1462,72s user 29,28s system 49% cpu 49:44,68 total


❯ time npx remotion render index.js NeonLetrasVideo out/neon-letras-video-final.mp4 --concurrency=2 --codec=h264 --crf=23 --timeout=120000 --overwrite

Bundled code         ━━━━━━━━━━━━━━━━━━ 2559ms
Composition          NeonLetrasVideo
Codec                h264
Output               out/neon-letras-video-final.mp4
Concurrency          2x
Rendered frames      ━━━━━━━━━━━━━━━━━━ 7326654ms
Downloaded assets    ━━━━━━━━━━━━━━━━━━    1 file
Encoded video        ━━━━━━━━━━━━━━━━━━ 11026ms
+                    out/neon-letras-video-final.mp4 136.1 MB
npx remotion render index.js NeonLetrasVideo out/neon-letras-video-final.mp4   2125,62s user 25,30s system 29% cpu 2:02:22,89 total