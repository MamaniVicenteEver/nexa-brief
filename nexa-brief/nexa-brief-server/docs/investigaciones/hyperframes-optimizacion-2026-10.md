# Guía: dejar una plantilla lista para grabar con nexa-brief-hyperframes

> **Para quién es este documento:** para el agente que va a continuar este trabajo.
> Es una guía cerrada: seguí los pasos en orden y no hagas nada que no esté acá.
> Si algo no encaja con lo que dice la guía, **pará y preguntale al usuario**.
>
> Última actualización: 2026-10-05. Directorio de trabajo: `nexa-brief/nexa-brief-server/`.

---

## 0. Propósito y reglas (leer antes de tocar nada)

**El objetivo es uno solo:** que cada plantilla de letras o promo se pueda grabar con
HyperFrames (motor `nexa-brief-hyperframes`) **con la letra sincronizada, sin
desfases ni lags, con la misma calidad o mejor y en el menor tiempo de render posible**.

### Prohibido (no tenés derecho a hacerlo, aunque parezca una mejora)

1. **No modificar nada visual de las plantillas:** colores, tipografías, tamaños,
   posiciones, animaciones, movimientos, tiempos de aparición, transiciones, textos,
   imágenes, videos (contenido o encuadre), efectos, filtros. Nada.
2. **No bajar la calidad:** no bajar resolución, fps, bitrate ni CRF. Tampoco recortar
   efectos, quitar partículas ni simplificar canvas/WebGL "para que vaya más rápido".
3. **No editar a mano el `index.html` de una plantilla.** Los únicos cambios permitidos
   en las plantillas son los que hacen las herramientas de `_tools/hyperframes/`
   (`optimize.py` y `reencode_media.py`).
4. **No tocar `data/canales/`.** Ahí están las cuentas reales del usuario.
5. **No publicar** en YouTube, Facebook ni TikTok. No llamar a endpoints de publicación.
6. **No hacer `git commit` ni `git push`.**
7. **No borrar `src/templates/_tools/hyperframes/media_originals/`.** Son los videos
   originales de stock y la única forma de revertir.
8. **No matar procesos que no lanzaste vos** (servidor del usuario, editor, etc.).
9. **No agregar una plantilla a la lista de habilitadas sin haber validado sus cuadros** (paso 5).
10. **No cambiar** `hyperframes_adapter.py`, `nb-hf-clock.js` ni `optimize.py`, salvo
    para agregar ids a la whitelist. Si creés que hay que cambiar el reloj o el
    adapter, describí el problema y preguntá primero.

### ⛔ Plantillas que NO tenés que procesar (categoría «En desarrollo»)

Estas 4 plantillas están en la categoría **«En desarrollo»** (`category_id: "in_progress"`
en `templates.json`). Su autor todavía las está puliendo. **No las proceses de ninguna forma:**
no corras `optimize.py`, `reencode_media.py` ni `render_demo.py` sobre ellas, no las saques
ni las agregues a la whitelist y no cambies su categoría. Da igual que ya estén optimizadas
o habilitadas: **dejalas exactamente como están.**

| Plantilla | template_id |
|---|---|
| Cristal Roto | lyrics-cristal |
| Letras Suaves | lyrics-suave |
| Bajo la Lluvia | lyrics-triste |
| Amor Impredecible | lyrics-amor-impredecible |

- `optimize.py` y `render_demo.py` **sin argumentos** ya saltean la categoría `in_progress`.
  Con el nombre explícito sí las procesan: **no lo hagas.**
- Si en el futuro aparece otra plantilla en `in_progress`, aplicale la misma regla.
- Solo el usuario puede sacar una plantilla de esa categoría.

### Qué sí podés hacer

- Correr las herramientas de `src/templates/_tools/hyperframes/`.
- Renderizar con `render_demo.py` y mirar los cuadros que genera.
- Agregar ids a `HF_VALIDATED_LYRICS_TEMPLATE_IDS` cuando una plantilla pasa la validación.
- Correr los tests.
- Escribir resultados en este documento (sección 3).

---

## 1. Resumen

- **Hay 29 plantillas en total** (23 de letras y 6 promos).
  - **29 están listas y habilitadas** para HyperFrames.
  - **No quedan plantillas pesadas pendientes** de la primera pasada.
- **Sin optimizar, la letra salía desfasada:** con `lyrics-romantic`, varios segundos
  atrasada. La causa es que las plantillas miden el tiempo con su propio reloj
  (`audio.currentTime`, `requestAnimationFrame`, timers, animaciones CSS), y la
  captura cuadro a cuadro de HyperFrames rompe ese reloj.
- **La solución es el reloj determinístico `nb-hf-clock.js`**, que `optimize.py`
  inyecta en cada plantilla. No cambia nada visual: solo ata el tiempo de la
  plantilla al tiempo del cuadro que se está capturando.
- **Las plantillas pesadas se colgaban** (timeout de 30 min o Chrome sin memoria) por dos razones:
  1. **Videos de stock con muy pocos keyframes** (2–3 cada 10 s): cada seek decodificaba
     hasta ~100 cuadros. Se arregló recodificando con keyframe cada 5 cuadros, sin
     pérdida visible (SSIM 0,996 / PSNR 50 dB) → `reencode_media.py`.
  2. **El reloj hacía seek de todos los videos en cada cuadro**, incluso los
     invisibles (escenas pre-armadas o ya pasadas). Se arregló sincronizando solo
     los videos visibles, más los que se dibujan en canvas/WebGL.
- **Con los dos arreglos, `lyrics-grunge` pasó:** antes no terminaba, ahora tarda
  13 min para 30 s en los dos formatos, y la letra sale sincronizada.
- **`lyrics-mixtas` pasó el primer estudio completo con el reloj actual:** 30 s en
  16:9 y 9:16, letra sincronizada, fondo en movimiento y audio presente.
- **El primer lote de 5 también pasó el estudio completo:** Ceniza, Lluvia Gris,
  Memoria Velada, Vacío y Promo Dynamic. Cada una tiene muestra de 30 s en 16:9 y
  9:16, audio, letra/CTA comprobados y fondo en movimiento. El audio fuente completo
  se conservó (74,89 s; 174,05 s; 235,81 s; 235,81 s; 43,52 s respectivamente).
- **Los 30 s son solo una muestra de validación:** el adapter recibe
  `duration_seconds` del trabajo de grabación y no deja la plantilla limitada a 30 s.
- **`promo-editorial` fue aprobada por revisión manual del usuario:** el corte editorial
  de la `D` de «ROUND» en 9:16 fue revisado y aceptado como parte del diseño.
- **Estado del repaso:**
  - El repaso histórico de las 14 plantillas habilitadas ya quedó completo; no quedan
    plantillas pendientes de esa revisión (ver sección 3.3).

---

## 2. Cómo funciona (lo mínimo que tenés que entender)

### 2.1 Piezas

| Pieza | Ruta | Qué hace |
|---|---|---|
| Adapter | `src/adapters/recorder/infrastructure/hyperframes_adapter.py` | Convierte el `index.html` en composición HyperFrames (`_prepare_generic_html`), lanza el CLI una vez por formato (16:9 y 9:16) y mezcla el audio. |
| Whitelist | mismo archivo, `HF_VALIDATED_LYRICS_TEMPLATE_IDS` | Solo las plantillas listadas acá ofrecen HyperFrames en la app (`supports_niche()`). |
| Reloj | `src/templates/_tools/hyperframes/runtime/nb-hf-clock.js` | Reloj virtual a 60 Hz. Solo se activa dentro del render: en el navegador normal y en la vista previa no hace nada. |
| Optimizador | `src/templates/_tools/hyperframes/optimize.py` | Inserta el reloj inline como primer `<script>`, después del `<meta charset>`, y reescribe `setTimeout`/`setInterval` a `__nbSetTimeout` y compañía. Es idempotente y reversible. |
| Recodificador | `src/templates/_tools/hyperframes/reencode_media.py` | Recodifica los videos de una plantilla con GOP corto, guardando antes los originales. |
| Render de validación | `src/templates/_tools/hyperframes/render_demo.py` | Renderiza 30 s del contenido por defecto en todos los formatos del nicho y genera cuadros de control. |
| Originales | `src/templates/_tools/hyperframes/media_originals/<template_id>/` | Copia de los videos de stock antes de recodificar. |
| Resultados | `output/hf-demo-<template_id>/` | `youtube_video.mp4`, `reels_video.mp4`, `check-16x9.png`, `check-9x16.png` y `result.json`. |
| Resultados anteriores | `output/hf-demo-prev/<carpeta>.json` | Tiempos con el reloj anterior, para comparar. |

### 2.2 Qué resuelve el reloj (para que no lo "arregles" de otra forma)

**HyperFrames captura en modo screenshot con tiempo virtual. Sin el reloj pasa esto:**
- el `<audio>` de la plantilla queda pausado;
- `requestAnimationFrame` corre a 30 Hz en vez de 60 (las cámaras con easing se mueven a la mitad de velocidad);
- `setTimeout` sigue en reloj de pared, unas 10 veces más lento que el video;
- cada worker arranca en t > 0 sin el estado acumulado de la plantilla.

**El reloj resuelve todo eso:**
- reproduce la plantilla desde t = 0 a 60 Hz fijos;
- virtualiza `performance.now`/`Date.now`, timers, `<audio>`/`<video>`, animaciones CSS/WAAPI y `AnalyserNode`;
- antes de cada captura espera fuentes, imágenes y el cuadro exacto de cada video visible.

**Cómo se arma el audio:**
- El audio que se oye en el MP4 es un `<audio id="nb-hf-mix" data-nb-hf-mix>` que agrega el adapter.
- El `<audio>` propio de la plantilla queda bajo el reloj y no se mezcla.
- Si una plantilla **no** tiene el reloj (falta la marca `data-nb-hf-clock`), ese
  audio no se agrega y el render falla con `audio_processing_failed (source_not_found)`.

### 2.3 Detalles del render que ya están resueltos (no los cambies)

- **`data-no-timeline` en la raíz:** sin esa marca, HyperFrames espera 45 s por worker
  un `window.__timelines` que estas plantillas no registran.
- **9:16:** se compone en 540×960 CSS px con `deviceScaleFactor` 2. La salida es un
  1080×1920 nativo, con la proporción de un celular real. Por eso el 9:16 suele
  tardar más que el 16:9. Es correcto.
- **El reloj va después del `<meta charset>`:** el navegador detecta la codificación
  en los primeros 1024 bytes, y un script de 30 KB antes rompía los acentos.
- **Timers:** `optimize.py` reescribe los timers de la plantilla a
  `__nbSetTimeout`/`__nbSetInterval`, porque no se pueden reemplazar globalmente
  (HyperFrames usa los nativos para sus propias esperas).

---

## 3. Estado de las 29 plantillas

### 3.1 Terminadas y habilitadas (29)

Render de 30 s de su contenido por defecto, 16:9 (1920×1080) y 9:16 (1080×1920),
con audio y la letra comprobada en los momentos disponibles. Tiempos en segundos de render.

| # | Plantilla (nombre en la app) | template_id | 16:9 | 9:16 | Reloj con que se validó |
|---|---|---|---|---|---|
| 1 | Letras de Neón | lyrics-neon | 182.7 | 278.1 | **actual** (2026-10-05) |
| 2 | Amor Impredecible ⛔ En desarrollo | lyrics-amor-impredecible | 162 | 185 | anterior — **no procesar** |
| 3 | Caution | lyrics-caution | 175.7 | 182.0 | **actual** (2026-10-05) |
| 4 | Collage Callejero | lyrics-collage | 117.9 | 160.7 | **actual** (2026-10-05) |
| 5 | Cristal Roto ⛔ En desarrollo | lyrics-cristal | 268 | 279 | anterior — **no procesar** |
| 6 | Hilo Rojo | lyrics-expediente | 111.2 | 155.5 | **actual** (2026-10-05) |
| 7 | Letras de Impacto | lyrics-impact | 132.2 | 145.8 | **actual** (2026-10-05) |
| 8 | Latido en Vivo | lyrics-latido | 170.0 | 321.0 | **actual** (2026-10-05) |
| 9 | Letras Caladas | lyrics-calado | 256.9 | 253.0 | **actual** (2026-10-05) |
| 10 | Manifiesto | lyrics-manifiesto | 95.8 | 125.2 | **actual** (2026-10-05) |
| 11 | Mirada Celeste | lyrics-mirada | 369.9 | 334.0 | **actual** (2026-10-05) |
| 12 | Viaje Nocturno | lyrics-night-journey | 157.6 | 209.6 | **actual** (2026-10-05) |
| 13 | Página Subrayada | lyrics-resaltado | 172.7 | 231.7 | **actual** (2026-10-05) |
| 14 | Carta de Amor | lyrics-romantic | 121.8 | 167.2 | **actual** (2026-10-05) |
| 15 | Stylish Kinetic | lyrics-stylish-kinetic | 74.3 | 79.8 | **actual** (2026-10-05) |
| 16 | Letras Suaves ⛔ En desarrollo | lyrics-suave | 103 | 185 | anterior — **no procesar** |
| 17 | Bajo la Lluvia ⛔ En desarrollo | lyrics-triste | 98 | 156 | anterior — **no procesar** |
| 18 | Promo Kinetic | promo-kinetic | 150.3 | 143.0 | **actual** (2026-10-05) |
| 19 | Grunge Rojo | lyrics-grunge | 414 | 385 | **actual** (con videos recodificados) |
| 20 | Escenas Mixtas | lyrics-mixtas | 240.7 | 223.8 | **actual** (2026-10-05) |
| 21 | Ceniza | lyrics-ceniza | 286.9 | 297.8 | **actual** (2026-10-05) |
| 22 | Lluvia Gris | lyrics-lluvia-gris | 356.6 | 344.9 | **actual** (2026-10-05) |
| 23 | Memoria Velada | lyrics-memoria | 267.0 | 323.2 | **actual** (2026-10-05) |
| 24 | Vacío | lyrics-vacio | 330.0 | 273.2 | **actual** (2026-10-05) |
| 25 | Promo Dynamic | promo-dynamic | 271.8 | 241.1 | **actual** (2026-10-05) |
| 26 | Promo Sports | promo-sports | 371.1 | 360.7 | **actual** (2026-10-05) |
| 27 | Promo Trendy | promo-trendy | 329.3 | 306.4 | **actual** (2026-10-05) |
| 28 | Promo Urban | promo-urban | 302.4 | 302.6 | **actual** (2026-10-05) |
| 29 | Promo Editorial | promo-editorial | 207.2 | 205.9 | **actual** (2026-10-05; corte editorial aceptado por el usuario) |

### 3.2 Pendientes (0)

Las 29 plantillas de la primera pasada ya están habilitadas. Queda el repaso de las
plantillas validadas con el reloj anterior (sección 3.3).

| # | Plantilla | template_id | Videos | Estado |
|---|---|---|---|---|
| — | — | — | — | — |

### 3.3 Repaso obligatorio de las 18 validadas con el reloj anterior

El 2026-10-04 cambió `nb-hf-clock.js`: ahora sincroniza solo los videos visibles y
los que se dibujan en canvas. `optimize.py` ya aplicó la versión nueva a todas.
Las filas 1–18 de la tabla 3.1 **se validaron con la versión anterior**, así que hay
que volver a renderizarlas y validarlas (sección 4, pasos 4–5). Son **14**: las filas
1–18 **menos las 4 «En desarrollo»** (2, 5, 16 y 17), que no se repasan (sección 0).
Ya se revisaron las 14: `lyrics-neon`, `lyrics-caution`, `lyrics-collage`,
`lyrics-expediente`, `lyrics-impact`, `lyrics-latido`, `lyrics-calado`,
`lyrics-manifiesto`, `lyrics-mirada`, `lyrics-night-journey`, `lyrics-resaltado`,
`lyrics-romantic`, `lyrics-stylish-kinetic` y `promo-kinetic`. Quedan **0** por repasar.

- Si alguna falla, sacala de la whitelist y anotala en la sección 6.
- **Atención especial a Letras Caladas (`lyrics-calado`):** dibuja su video de fondo
  en un canvas con `drawImage`. El reloj nuevo lo detecta y lo sigue sincronizando,
  pero confirmá en los cuadros que **el fondo se mueve** (ver 5.3).

Los tiempos anteriores están en `output/hf-demo-prev/hf-demo-<id>.json`. Un tiempo
igual o menor que antes está bien. Si sube más de un 25 %, anotalo.

---

## 4. Procedimiento por plantilla (checklist)

Hacelo **para una plantilla por vez**, en este orden. Todos los comandos se corren desde
`nexa-brief/nexa-brief-server/`.

### Paso 1 — Comprobar que tenga nicho
```bash
PYTHONPATH=. .venv/bin/python -c "
from src.config.niche_config import list_all_niches
print([n.id for n in list_all_niches() if n.template and n.template.template_id=='<template_id>'])"
```
Si sale `[]`, **pará y preguntá.** Las 29 de este documento ya tienen nicho.

### Paso 2 — Videos con GOP corto (solo si la plantilla tiene `.mp4`/`.webm`/`.mov`)
```bash
.venv/bin/python src/templates/_tools/hyperframes/reencode_media.py <template_id>
```
- Si dice `· ya tiene GOP corto` para todos, no hace nada (las 11 pesadas ya están así).
- Los originales quedan en `media_originals/<template_id>/`. Para deshacer:
  `reencode_media.py --revert <template_id>`.
- **Control de calidad obligatorio** cuando recodifica algo nuevo, sobre al menos un video:
  ```bash
  ffmpeg -i <nuevo.mp4> -i src/templates/_tools/hyperframes/media_originals/<id>/<ruta>.mp4 \
    -lavfi "[0:v][1:v]ssim;[0:v][1:v]psnr" -f null - 2>&1 | grep -E "SSIM|PSNR"
  ```
  Tiene que dar **SSIM All ≥ 0,99 y PSNR ≥ 45 dB**. Si da menos, revertí y preguntá.
- Los videos pesan unas 4 veces más. Es esperado y aceptado (calidad primero).
- La herramienta quita la pista de audio de los videos: las plantillas los usan con
  `muted = true`. Si una plantilla nueva usara el sonido de un video, **no la corras: preguntá**.

### Paso 3 — Reloj al día
```bash
.venv/bin/python src/templates/_tools/hyperframes/optimize.py --check <template_id>
```
Si marca algo pendiente o desactualizado:
```bash
.venv/bin/python src/templates/_tools/hyperframes/optimize.py <template_id>
```
`optimize.py` solo actúa en las categorías `lyrics` y `commercial` (`HF_CATEGORIES`).

### Paso 4 — Render de validación (30 s)
```bash
PYTHONPATH=. nohup .venv/bin/python src/templates/_tools/hyperframes/render_demo.py \
  --seconds 30 <template_id> [<template_id> ...] > output/hf-demo-batch3.log 2>&1 &
```
- **Un solo lote a la vez.** Dos renders en paralelo se disputan la CPU, los tiempos
  dejan de servir y Chrome se queda sin memoria.
- Para seguirlo: `grep -E "^(▶|✓|✗)" output/hf-demo-batch3.log`.
- Cada plantilla deja `output/hf-demo-<id>/` (se sobrescribe si ya existía).
- El límite por formato es `HYPERFRAMES_RENDER_TIMEOUT_SECONDS` (1800 s por defecto).
  Solo para diagnosticar una plantilla podés anteponer
  `HYPERFRAMES_RENDER_TIMEOUT_SECONDS=3600` al comando. **No cambies el valor en `settings.py` ni en `.env`.**

### Paso 5 — Validar (sección 5). Si pasa → Paso 6. Si falla → sección 6.

### Paso 6 — Habilitar
Agregá el id a `HF_VALIDATED_LYRICS_TEMPLATE_IDS` en `hyperframes_adapter.py`:
- respetá el orden y el formato que ya tiene la lista;
- las promos van debajo del comentario `# commercial/ …`.

Después corré:
```bash
.venv/bin/python -m pytest tests -q
```
Tienen que pasar todos (eran 220 el 2026-10-05). Ojo:
`tests/unit/test_drafts.py::test_create_draft_rejects_unsupported_engine_400` busca una
plantilla de letras **sin** HyperFrames. Cuando estén habilitadas las 29, ese test va a
fallar con `StopIteration`. No es un bug: avisale al usuario y no saques plantillas de
la whitelist para que pase. Si el servidor del usuario está corriendo,
toma el cambio solo. En la app hay que cerrar y volver a abrir el modal de la plantilla
para ver la opción HyperFrames.

### Paso 7 — Documentar
Mové la fila de la sección 3.2 a la 3.1 con sus tiempos (`result.json` → `stats.pass_seconds`)
y anotá en la sección 6 cualquier dificultad nueva.

---

## 5. Cómo validar una plantilla (criterios de aprobación)

### 5.1 Archivos
```bash
python3 -c "import json;r=json.load(open('output/hf-demo-<id>/result.json'));print(r['stats'].get('pass_seconds'));print(r['checks']);[print(k,v['probe']) for k,v in r['files'].items()]"
```
- [ ] `16x9`: video de **1920×1080**, con stream de **audio** y duración **30.000000**.
- [ ] `9x16`: video de **1080×1920**, con audio y duración 30.000000.

### 5.2 Letra sincronizada (lo más importante)
Mirá `check-16x9.png` y `check-9x16.png`: son 4 cuadros en los momentos `checks[i].t`.
Para cada cuadro, buscá en `assets/lyrics.json` la palabra que se canta en ese `t`.

- [ ] **Pasa** si en pantalla está la palabra cantada, o la frase que la contiene.
- [ ] **Pasa** si la palabra aparece **hasta ~0,15 s antes** de cantarse. Algunas
  plantillas (Grunge, por ejemplo) muestran la siguiente palabra al terminar la
  anterior: es diseño.
- [ ] **Pasa** si la letra llega con un retraso que es parte del diseño de la plantilla.
  Para confirmarlo, el mismo retraso tiene que verse en el navegador con la vista
  previa normal. Ejemplo: Página Subrayada, ~0,5 s por su transición de página de 1,2 s.
- [ ] **Falla** si la palabra en pantalla corresponde a otra parte de la canción
  (más de ~0,5 s de diferencia sin explicación de diseño), si la letra se congela o si
  hay letra sobre silencio.
- [ ] Los dos formatos tienen que mostrar la **misma** palabra en cada `t`.

### 5.3 Fondo y movimiento
- [ ] El fondo de video **se mueve**. Para comprobarlo, sacá dos cuadros separados
  0,5 s y medí la diferencia:
  ```bash
  ffmpeg -v error -i output/hf-demo-<id>/youtube_video.mp4 -vf "select='eq(n\,300)+eq(n\,315)'" -vsync 0 /tmp/f%d.png
  ffmpeg -i /tmp/f1.png -i /tmp/f2.png -lavfi psnr -f null - 2>&1 | grep PSNR
  ```
  Si da PSNR "inf" o mayor que 60 dB, el fondo está congelado y **la plantilla falla**.
  Puede haber un falso positivo si en ese momento no hay video: probá con otro cuadro.
- [ ] No hay cuadros negros ni en blanco a mitad del clip. Excepción: Stylish Kinetic
  dura 18 s, así que su 4º control sale negro.
- [ ] Mirá el MP4 en tramos: las transiciones tienen que ser fluidas, sin saltos ni
  cuadros repetidos.

### 5.4 Nitidez 9:16
- [ ] El texto del 9:16 se ve igual de nítido que el del 16:9. Se renderiza con densidad 2x:
  si se ve borroso, algo cambió en el adapter. Pará y preguntá.

---

## 6. Dificultades encontradas: problema → causa → solución

### 6.1 Generales (afectan a todas)

| # | Problema | Causa | Solución |
|---|---|---|---|
| G1 | Letra desfasada, varios segundos atrasada (probado con `lyrics-romantic` el 2026-09-25) | La plantilla usa su propio reloj, y la captura de HyperFrames lo frena | Reloj `nb-hf-clock.js` inyectado por `optimize.py`. Mientras no estuviera validada, la plantilla quedaba fuera de la whitelist. |
| G2 | Video sin letra | El adapter no copiaba `lyrics.json` a la carpeta de render | Ya lo copia |
| G3 | Video vertical cuando se pedía 16:9 | HyperFrames usa 1080×1920 por defecto si la raíz no declara tamaño | `_prepare_generic_html` pone `data-width`/`data-height` por formato |
| G4 | 45 s de espera muerta por worker | El engine esperaba un `window.__timelines` que las plantillas no registran | `data-no-timeline` en la raíz |
| G5 | Acentos rotos | El script del reloj iba antes del `<meta charset>` | `optimize.py` lo inserta después del charset |
| G6 | Animaciones de cámara a mitad de velocidad | El shim de HyperFrames da un rAF por cuadro (30 Hz) | El reloj corre a 60 Hz fijos |
| G7 | Las pruebas de validación se perdieron | Se guardaron en `/tmp`, que se borró al reiniciar | `render_demo.py` guarda todo en `output/hf-demo-<id>/`. **Nunca guardes evidencia en /tmp.** |
| G8 | Ninguna plantilla de letras mostraba HyperFrames en la app | La whitelist estaba vacía | Se habilitan una por una al validarlas (paso 6) |
| G9 | 4 plantillas tristes no aparecían en Crear video y un test fallaba | No tenían nicho | Se crearon `lyrics_video_ceniza`, `_lluvia_gris`, `_memoria` y `_vacio` en `niches.json` |
| G10 | `audio_processing_failed (source_not_found)` en las promos | `optimize.py` solo aplicaba el reloj a `lyrics`, y sin reloj no se agrega el audio de mezcla | `HF_CATEGORIES = {"lyrics", "commercial"}` |
| G11 | Timeout de 30 min en las plantillas con muchos videos | (a) Videos con 2–3 keyframes cada 10 s, así que cada seek decodificaba ~100 cuadros. (b) El reloj hacía seek y esperaba `seeked` de **todos** los videos en cada cuadro, incluso los invisibles. HyperFrames no detecta estos videos creados por JS (`videoCount 0`), así que no los pre-extrae. | (a) `reencode_media.py`: GOP 5, CRF 12 slow, SSIM 0,996. (b) `syncVideos()` solo sincroniza los videos visibles y los usados en `drawImage`/`texImage2D`. |
| G12 | Se acumula RAM y los renders siguientes fallan con "Target closed" | Quedan procesos `chrome-headless-shell` huérfanos de renders fallidos | Cerralos (sección 7) antes de reintentar |
| G13 | El shell se mataba a sí mismo (exit 144) | `pkill -f`/`pgrep -f` con un patrón que también aparecía en la línea de comando del propio shell | Usá `pkill -x chrome-headless` (nombre exacto del proceso) |
| G14 | Todos los ids llegaban como un solo argumento ("sin nicho") | zsh no separa `$IDS` | Escribí los ids literales o usá `${=IDS}` en zsh |

### 6.2 Por plantilla

| Plantilla | Problema | Causa | Solución / veredicto |
|---|---|---|---|
| Letras de Neón | Primera plantilla probada | — | Validada: "baila" a 5 s, "el dembow" a 12 s, "a estremecer" a 20 s, "para que" a 28 s |
| Caution | Parecía que faltaban palabras | Por diseño muestra solo la palabra acentuada de cada frase | Validada |
| Hilo Rojo (expediente) | Solo 2 controles | La canción empieza a cantar a los 15 s | Validada con 2 controles |
| Cristal Roto | Lenta | Efecto de vidrio en canvas, pesado por diseño | Validada. No se simplificó el efecto. |
| Letras Caladas | Falló en el primer lote | El nicho pide `bg.mp4` y `render_demo.py` copiaba una imagen | `render_demo.py` copia un archivo del tipo que pide el nicho. **Dibuja el video en canvas: revisá que el fondo se mueva con el reloj nuevo.** |
| Mirada Celeste | Parecía que el fondo estaba congelado | Movimiento lento por diseño | Medí la diferencia en la zona de la mano (12–60 de diferencia entre cuadros): no estaba congelado. Validada. |
| Página Subrayada | El resaltado llega ~0,5 s después de la palabra | La transición de página de 1,2 s es diseño de la plantilla (pasa igual en el navegador) | Validada sin cambios |
| Carta de Amor | El usuario no veía la opción HyperFrames | Todavía no estaba validada ni en la whitelist | Validada y habilitada. Hay que cerrar y volver a abrir el modal. |
| Stylish Kinetic | 4º cuadro de control negro | La plantilla es un clip de 18 s, sin letra después de los 17 s | Validada, no es falla |
| Promo Kinetic | `audio_processing_failed` | G10 | Validada después de aplicar el reloj |
| Grunge Rojo | Timeout de 30 min; con 6 s seguía colgado | G11 (a) y (b) | Con los dos arreglos: 414 s y 385 s. Muestra cada palabra ~0,1 s antes (diseño). Validada. |
| Ceniza | Timeout de 30 min | G11 (18 videos) | Videos recodificados y reloj nuevo: **validada** el 2026-10-05; 286.9 s en 16:9 y 297.8 s en 9:16. |
| Escenas Mixtas | Mismo patrón que Grunge (muchos videos por JS) | G11 | Con videos ya recodificados y reloj nuevo: **validada** el 2026-10-05; 240.7 s en 16:9 y 223.8 s en 9:16. |
| Lluvia Gris | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 356.6 s en 16:9 y 344.9 s en 9:16. PSNR de movimiento: 24.91–27.19 dB. |
| Memoria Velada | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 267.0 s en 16:9 y 323.2 s en 9:16. PSNR de movimiento: 19.78–26.33 dB. |
| Vacío | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 330.0 s en 16:9 y 273.2 s en 9:16. PSNR de movimiento: 33.79–46.81 dB. |
| Promo Dynamic | Mismo patrón que Grunge (6 videos por JS) | G11 | **Validada** el 2026-10-05; 271.8 s en 16:9 y 241.1 s en 9:16. CTA legible; PSNR de movimiento: 12.89–23.06 dB. |
| Promo Editorial | Mismo patrón que Grunge (12 videos por JS) | G11 | Render técnico: 207.2 s en 16:9 y 205.9 s en 9:16. **Validada**; el corte editorial de «FINAL ROUND» fue revisado y aceptado por el usuario. |
| Promo Sports | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 371.1 s en 16:9 y 360.7 s en 9:16. Audio fuente 23.95 s; la muestra de 30 s tiene silencio después del final de la canción. PSNR de movimiento: 11.16–32.64 dB. |
| Promo Trendy | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 329.3 s en 16:9 y 306.4 s en 9:16. Audio fuente 26.38 s; la muestra de 30 s conserva la canción completa. PSNR de movimiento: 8.59–43.61 dB. |
| Promo Urban | Mismo patrón que Grunge (18 videos por JS) | G11 | **Validada** el 2026-10-05; 302.4 s en 16:9 y 302.6 s en 9:16. Audio fuente 33.85 s. PSNR de movimiento: 18.44–22.36 dB. |

### 6.3 Repaso Lote 3 — 2026-10-05

Las cinco plantillas ya habilitadas fueron renderizadas de nuevo durante 30 s en
16:9 y 9:16. Todas conservaron audio AAC, resolución exacta, duración de 30 s,
letra sincronizada con los controles disponibles y movimiento entre cuadros. No se
modificaron las plantillas ni sus assets.

| Plantilla | 16:9 / 9:16 (s) | Controles de letra comprobados | Movimiento (PSNR entre cuadros) | Veredicto |
|---|---:|---|---:|---|
| Letras de Neón (`lyrics-neon`) | 182.7 / 278.1 | `baila`, `y`, `estremecer`, `más` | 13.16–26.01 dB | **Aprobada** |
| Caution (`lyrics-caution`) | 175.7 / 182.0 | `hear`, `walking`, `reimagined`, `I'ma` | 1.06–20.93 dB | **Aprobada** |
| Collage Callejero (`lyrics-collage`) | 117.9 / 160.7 | `baila`, `y`, `estremecer`, `más` | 18.48–50.80 dB | **Aprobada** |
| Hilo Rojo (`lyrics-expediente`) | 111.2 / 155.5 | `真`, `Chin` (la canción entra tarde) | 18.20–24.92 dB | **Aprobada** |
| Letras de Impacto (`lyrics-impact`) | 132.2 / 145.8 | `baila`, `y`, `estremecer`, `más` | 11.77–25.29 dB | **Aprobada** |

### 6.4 Repaso Lote 4 — 2026-10-05

Las siguientes cinco plantillas ya habilitadas fueron renderizadas nuevamente durante
30 s en 16:9 y 9:16. Todas conservaron audio AAC, resolución exacta, duración de 30 s,
letra sincronizada con los controles disponibles y movimiento entre cuadros. No se
modificaron las plantillas ni sus assets.

| Plantilla | 16:9 / 9:16 (s) | Controles de letra comprobados | Movimiento (PSNR entre cuadros) | Veredicto |
|---|---:|---|---:|---|
| Latido en Vivo (`lyrics-latido`) | 170.0 / 321.0 | `han`, `triste`, `finales`, `triste` | 24.00–32.33 dB | **Aprobada** |
| Letras Caladas (`lyrics-calado`) | 256.9 / 253.0 | `que`, `mejor,` | 20.98–23.70 dB; fondo canvas en movimiento | **Aprobada** |
| Manifiesto (`lyrics-manifiesto`) | 95.8 / 125.2 | `que`, `mejor,` | 24.19–55.31 dB | **Aprobada** |
| Mirada Celeste (`lyrics-mirada`) | 369.9 / 334.0 | `baila`, `y`, `estremecer`, `más` | 19.50–32.37 dB | **Aprobada** |
| Viaje Nocturno (`lyrics-night-journey`) | 157.6 / 209.6 | `baila`, `y`, `estremecer`, `más` | 26.62–38.99 dB | **Aprobada** |

### 6.5 Repaso final — 2026-10-05

Las cuatro plantillas restantes del repaso histórico fueron renderizadas nuevamente
durante 30 s en 16:9 y 9:16. Todas conservaron audio AAC, resolución exacta, duración
de 30 s, letra/CTA sincronizado y movimiento donde corresponde. No se modificaron las
plantillas ni sus assets.

| Plantilla | 16:9 / 9:16 (s) | Controles comprobados | Movimiento (PSNR entre cuadros) | Veredicto |
|---|---:|---|---:|---|
| Página Subrayada (`lyrics-resaltado`) | 172.7 / 231.7 | `han`, `triste`, `finales`, `triste` | 15.64–27.73 dB | **Aprobada** |
| Carta de Amor (`lyrics-romantic`) | 121.8 / 167.2 | `han`, `triste`, `finales`, `triste` | 19.56–26.61 dB | **Aprobada** |
| Stylish Kinetic (`lyrics-stylish-kinetic`) | 74.3 / 79.8 | `from`, `to`, `out` | 19.27 dB; negro final intencional | **Aprobada** |
| Promo Kinetic (`promo-kinetic`) | 150.3 / 143.0 | `WOW`, `GIRANDO`, `ESCALA`, `RUPTURA` | 7.87–70.18 dB; movimiento confirmado | **Aprobada** |

**Sin dificultades** (pasaron al primer render): Amor Impredecible, Collage Callejero,
Letras de Impacto, Latido en Vivo, Manifiesto, Viaje Nocturno, Letras Suaves y Bajo la Lluvia.

---

## 7. Operación segura

- **Antes de cada lote**, confirmá que no quede Chrome de un render anterior:
  ```bash
  pgrep -x chrome-headless | wc -l      # tiene que dar 0
  pkill -x chrome-headless              # solo si hay huérfanos y no hay ningún render tuyo corriendo
  ```
  No uses `pkill -f` con patrones largos (G13). Para cortar un lote tuyo, matá su PID
  y el de sus hijos (`pgrep -P <pid>`).
- **Un render a la vez.** Para medir tiempos, que no haya otro trabajo pesado en la máquina.
- **No borres** `output/hf-demo-*` de las plantillas ya validadas: son la evidencia.
- El render usa `node_modules/.bin/hyperframes` directo, nunca `npx`, para evitar
  ~170 s de overhead. No cambies eso.

---

## 8. Si una plantilla falla: qué hacer y qué NO hacer

1. **Timeout o "Target closed":**
   - Cerrá los Chrome huérfanos.
   - Confirmá los pasos 2 y 3 (`reencode_media.py` sin videos de GOP largo y `optimize.py --check` en verde).
   - Reintentá **solo esa plantilla** con `--seconds 6` y `HYPERFRAMES_RENDER_TIMEOUT_SECONDS=3600` para medir.
   - Si 6 s tardan más de ~25 s de render por segundo de video, **pará y reportá**
     el tiempo y la salida del log. No toques el reloj.
2. **Desfase de letra:** no la habilites. Comparala con la vista previa del navegador.
   Si en el navegador va bien y en HyperFrames no, reportá los `t`, la palabra esperada
   y la que se ve. **No muevas tiempos en la plantilla ni en `lyrics.json`.**
3. **Fondo congelado o cuadros negros:** no la habilites. Reportá en qué segundos pasa.
4. **Sin audio o `audio_processing_failed`:** revisá que el `index.html` tenga la marca
   `data-nb-hf-clock` (paso 3).
5. **Nunca** "arregles" bajando calidad, quitando efectos, cambiando CSS/JS de la
   plantilla o reduciendo la duración del render.

---

## 9. Orden exacto para retomar

1. `pgrep -x chrome-headless | wc -l` → 0.
2. `optimize.py --check` sin argumentos: todas las de `lyrics/` y `commercial/` al día.
   Las 4 «En desarrollo» no aparecen en la salida, y es correcto (sección 0).
3. El repaso histórico de las 14 plantillas de la sección 3.3 quedó completado en
   cinco lotes. No incluye las 4 «En desarrollo», que siguen fuera del proceso.
6. `pytest tests -q` en verde.
7. Actualizá las secciones 3 y 6, y dale al usuario una tabla con:
   - plantilla;
   - ✓/✗;
   - tiempos 16:9 y 9:16;
   - rutas `output/hf-demo-<id>/youtube_video.mp4` y `reels_video.mp4`.
