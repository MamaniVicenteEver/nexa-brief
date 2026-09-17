# Generar video real con HyperFrames en nichos + selector de motor (array de 3) en la web

Continuación de [`cola-aws-y-hyperframes-para-nexa-brief.md`](./cola-aws-y-hyperframes-para-nexa-brief.md), que ya dejó wireado `HyperframesAdapter` + `factory.py` en el backend (`recorder_engine="hyperframes"` es una opción válida a nivel de código, pero `_COMPOSITION_BY_TEMPLATE_ID` está vacío — ningún nicho puede usarla todavía).

Este documento responde a dos pedidos: (1) que HyperFrames genere video **de verdad** para al menos un nicho, y (2) que la web tenga un selector con **array de 3** (Remotion / HyperFrames / Playwright) para elegir el motor al crear un video. **Alcance: diagnóstico y plan, sin código nuevo** (salvo lo que ya se hizo en el estudio anterior).

---

## Resumen ejecutivo

- **El selector de motor en la web ya existe — para 2 opciones.** `RecorderEngineSection.tsx` en `nexa-brief-web` ya es un toggle Remotion/Playwright, con el mismo patrón de componente (array `as const` + botones) que se usa en 2 lugares más del mismo formulario. Extenderlo a 3 opciones es mecánico.
- **Pero mostrar la opción HyperFrames hoy garantiza un error en el 100% de los casos.** El toggle actual solo aparece cuando `niche.recorderEngine === "remotion"`, porque en ese caso ya se sabe con certeza que Remotion es válido para ese nicho. Ese razonamiento no traslada a HyperFrames: **ningún nicho la tiene como default**, y el frontend no tiene ningún dato para saber si algún nicho la soporta — porque hoy **ningún nicho la soporta** (`_COMPOSITION_BY_TEMPLATE_ID` vacío). Agregar el botón sin resolver esto sería una función que siempre falla con 400 — justo el tipo de implementación a medias que hay que evitar.
- **El verdadero trabajo pendiente es uno solo: portar una composición HyperFrames real para al menos un nicho**, con datos de contenido dinámicos por job (título, imagen de fondo, colores) en vez de las demos fijas de `movil`/`desktop`. Todo lo demás (selector web, exponer qué nichos soportan qué motor) es plomería directa una vez que eso exista.
- **Actualización 2026-09-17 — la pieza técnica que faltaba validar YA SE PROBÓ Y FUNCIONA.** El CLI instalado (`hyperframes` v0.8.3, dentro de `nexa-brief-hyperframes`) sí soporta `--variables-file` en `render` **local**, no solo en `lambda render` — dato que ni el README del proyecto ni el estudio anterior tenían bien (ver sección 3, reemplazada por completo con el resultado real del spike, incluyendo el comando exacto y una captura del frame renderizado).
- **Actualización 2026-09-17 (2) — `image_bg_portrait` YA GENERA VIDEO REAL con HyperFrames.** Se portó la composición completa (layout + ecualizador precalculado), se conectó en `_COMPOSITION_BY_TEMPLATE_ID`, y se probó de punta a punta con el `HyperframesAdapter` real (no un mock): mp4 1920×1080 con imagen de fondo real, texto dinámico, audio real muxeado y ecualizador reactivo. `supports_niche("image_bg_portrait")` ya da `True` — el único trabajo que queda de este documento es la UI (secciones 4-5), que ahora sí tiene un caso real para mostrar.

---

## 1. Nicho piloto recomendado para portar la primera composición HyperFrames

De los 16 nichos en `niches.json`, 10 usan `pipeline_type="config_driven_template"` con `recorder_engine="remotion"` (plantilla fija + `config.json` generado por IA) — son los candidatos naturales, porque HyperFrames necesita exactamente ese mismo contrato (plantilla fija que consume datos, no HTML libre).

De esos 10, **`image_bg_portrait`** (`template_id="01-image-bg"`) es el mejor piloto:

- `requires_lyrics=False` — no necesita sincronía palabra-por-palabra (a diferencia de los 9 nichos `lyrics_video_*`), así que no arrastra la complejidad de mapear `lyrics.json` a keyframes.
- Ya tiene su equivalente Remotion portado (`ImageBg` en `_SINGLE_COMPOSITION_BY_TEMPLATE_ID`, `remotion_adapter.py:67`) — sirve como referencia 1:1 de qué datos consume la plantilla (imagen de fondo + texto), sin tener que inventar el contrato de contenido desde cero.
- Es conceptualmente el mismo tipo de composición que ya existe en `nexa-brief-hyperframes/src/desktop/` (título + fondo + CTA) — el trabajo de adaptar el patrón `core/config.js` + `components/*.js` que ya está ahí es más cercano a un ajuste que a una composición nueva desde cero.

**No recomendado como piloto**: cualquier `lyrics_video_*` — son 9 de los 10 nichos config-driven, pero todos requieren resolver primero cómo HyperFrames consume `lyrics.json` con timestamps por palabra, que es un problema aparte (mapeo de segmentos de texto a keyframes GSAP) y conviene resolverlo después de validar el mecanismo básico de props con el caso más simple.

---

## 2. Qué significa "portar" la composición, en términos concretos

Tomando como contrato de referencia lo que ya consume `RemotionAdapter` para `ImageBg` (`remotion_adapter.py:152-156`, props `configData` + `bgSrc`, más lo que `html_generator.py` ya deja en `output_dir/config.json`):

1. **La composición HyperFrames debe leer contenido variable, no tenerlo hardcodeado en `index.html`/`core/config.js`** (gap ya señalado en el estudio anterior, sección 3.3, punto 2) — título, subtítulo, CTA, nombre del archivo de imagen de fondo, paleta de color si el nicho la varía.
2. **Debe aceptar una ruta de imagen de fondo real** (el `bg_filename` que ya resuelve `resource_fetcher` y deja en `output_dir`), no un gradiente de ejemplo — la composición necesita un `<img>`/CSS `background-image` apuntando a un archivo que HyperFrames pueda resolver al momento del render (mismo tipo de problema que ya resolvió `nexa-render` con su sistema de assets remotos vía servidor loopback, aplicable acá si el archivo no está en el mismo directorio que la composición).
3. **`HyperframesAdapter.record()` tiene que escribir ese contenido en algún lado antes de invocar el CLI** — hoy el método no escribe ningún archivo de props (a diferencia de `RemotionAdapter`, que sí escribe `_remotion_props.json`), justamente porque no había ninguna composición que lo fuera a leer. Portar la composición implica también volver a `hyperframes_adapter.py` para agregar ese paso.

---

## 3. Validado: así recibe datos dinámicos una composición HyperFrames — con prueba real

**2026-09-17 — spike ejecutado y confirmado.** El README del proyecto y el estudio anterior de este mismo documento decían que `--variables`/`--variables-file` solo aplicaba a `lambda render` (AWS). Es **incorrecto** — corriendo `./node_modules/.bin/hyperframes render --help` directo contra el CLI instalado (`nexa-brief-hyperframes`, v0.8.3) aparece documentado también en `render` local:

```
--variables=<variables>            JSON object of variable values, merged over the
                                    composition's data-composition-variables defaults.
--variables-file=<variables_file>  Path to a JSON file with variable values.
```

Y `hyperframes docs compositions` documenta el mecanismo completo:

- `data-composition-variables` en el `<html>` raíz — un **array JSON de declaraciones** (`{id, type, label, default}`), define el schema de variables de esa composición.
- Dentro de cualquier script de la composición, `window.__hyperframes.getVariables()` devuelve el objeto ya resuelto (defaults declarados, sobreescritos por `--variables`/`--variables-file` en un render de nivel superior).

### La prueba

Se armó una composición mínima (fuera del repo, en el scratchpad de la sesión) con `data-composition-variables` declarando `title`, `subtitle`, `bgSrc`, `ink`, una imagen de fondo real (`bg.png`, la misma que usa hoy `IMG-retrato-impacto/assets/bg.png`) y un timeline GSAP simple (fade-in de título/subtítulo sobre la imagen). `hyperframes lint` pasó limpio (0 errores) después de corregir dos hallazgos reales del linter (faltaba `data-start="0"` en el elemento raíz; la fuente `Impact` no está en la lista de fuentes auto-resueltas del compilador — hay que usar `@font-face` explícito o quitarla del stack).

Comando de render, con un `job-vars.json` que pisa **todos** los defaults:

```bash
hyperframes render . --variables-file job-vars.json -o out.mp4 -q draft -w 2
# job-vars.json: {"title":"NEXA BRIEF","subtitle":"HYPERFRAMES","bgSrc":"bg.png","ink":"#7a1fff"}
```

**Resultado**: render exitoso en 22.7s (video de 6s, 1080×1920, calidad draft, 2 workers), `out.mp4` de 1.2MB. Se extrajo un frame en `t=2s` con `ffmpeg` para confirmar visualmente que el contenido dinámico se aplicó de verdad (no los defaults de la composición): título "NEXA BRIEF" y subtítulo "HYPERFRAMES" (ninguno de los dos es el default declarado, que era "IMPACTO"/"VISUAL"), color de texto violeta `#7a1fff` (no el default `#111111`), sobre la imagen de fondo real — los tres campos vinieron del `--variables-file`, confirmado visualmente frame a frame.

### Qué significa esto para el plan

Se cae por completo la necesidad de elegir entre las hipótesis (A)/(B) que planteaba la versión anterior de esta sección (fetch a un JSON local vs. generar el documento completo por job) — **hay un mecanismo oficial del CLI, más simple que ambas**: una composición HyperFrames se porta **una sola vez** (como ya pasa con la composición Remotion `ImageBg`), declara sus variables con `data-composition-variables`, y cada job solo necesita escribir un JSON chico de valores y pasarlo con `--variables-file` — exactamente el mismo patrón que ya usa `RemotionAdapter` hoy con `_remotion_props.json` (ver `remotion_adapter.py:200-201`). **Ya se actualizó `hyperframes_adapter.py`** para escribir ese archivo (`_hyperframes_variables.json`, a partir de `output_dir/config.json`) y pasarlo con `--variables-file` en ambos branches (local y AWS) — el wiring de datos ya no es hipotético, es código real, solo falta la composición que declare ese schema de variables (sección 1-2, sin cambios: sigue siendo el trabajo pendiente real).

No se probó (todavía) el branch AWS de `--variables-file` contra el stack `hyperframes-poc` — eso sí tiene costo real de Lambda/Step Functions y no hacía falta para despejar la incógnita de diseño, que era exclusivamente sobre el mecanismo de datos, igual en ambos branches según la documentación del CLI.

### 2026-09-17 (continuación) — composición piloto portada y funcionando de punta a punta

Se portó `image_bg_portrait` (`01-image-bg`) completo: `nexa-brief-hyperframes/src/image-bg-portrait/index.html`, calcado de `IMG-retrato-impacto/index.html` (mismo motor de layout `fitH/fitW/fitV/bestFit/place`, ya puro), con el ecualizador reemplazado por magnitudes precalculadas (`hyperframes_adapter.py`'s `hyperframes_audio.py`, FFT vía `ffmpeg`+`numpy`, aproximando `AnalyserNode` con sus defaults de Web Audio API). `HyperframesAdapter.record()` ahora arma un directorio `_hyperframes_site/` efímero por job (copia de la composición + assets reales + duración sustituida) y `_COMPOSITION_BY_TEMPLATE_ID["01-image-bg"]` ya apunta a esa composición — `supports_niche(image_bg_portrait)` da `True`.

**Probado con el adapter real** (no un spike aislado): `config.json` con texto distinto al default ("NEXA"/"BRIEF"), imagen de fondo real, audio real de 8s → mp4 1920×1080 con video+audio (AAC) y ecualizador visiblemente distinto entre frames (confirmado extrayendo 2 frames y comparando). `youtube_video.mp4` y `reels_video.mp4` (hardlink) se generan correctamente, `_hyperframes_site/` se limpia solo al terminar.

**Dos bugs reales encontrados y corregidos en el camino** (ninguno era hipotético, los tres golpearon en el primer intento):

1. **`-q=high` no es válido** — los flags cortos (`-o`, `-w`, `-q`) del CLI no aceptan `=valor`, solo los largos (`--quality=`, `--workers=`, `--output=`). `RemotionAdapter` ya usaba forma larga; `HyperframesAdapter` se corrigió para hacer lo mismo.
2. **El audio quedaba mudo sin ningún error** — `<audio src="">` con el `src` real asignado por JS (`el.src = vars.audioSrc`) funciona para lo que se VE en pantalla (igual que la imagen de fondo, que sí "funcionaba" así), pero el paso de "compile" del CLI (el mismo que resuelve fuentes e inlinea el script de GSAP) descubre los assets de media leyendo el HTML estático, **antes** de correr ningún script — `hyperframes lint` lo marca explícito (`media_missing_src`). Mismo problema de fondo que `data-duration` (sección 3): todo lo que el compilador necesita pre-procesar (duración, fuentes de media) tiene que estar en el HTML tal cual queda en disco, no seteado en runtime. Contenido puro (texto, colores, arrays) sí puede venir por `getVariables()` porque no requiere pre-extracción. Se resolvió sustituyendo `{{BG_SRC}}`/`{{AUDIO_SRC}}` como placeholders de texto, mismo mecanismo que `{{DURATION}}`.
3. **`overlapping_clips_same_track`** — dos clips con el mismo `data-track-index` y el mismo rango de tiempo (0 a duration) se marcan como error de lint aunque nunca se muestren juntos en pantalla (mutuamente excluyentes por `bgMode`); cada clip necesita su propio track index aunque comparta z-index visual en CSS.

**Regla general para portar la próxima composición** (útil para cualquier `template_id` futuro, no solo este): todo lo que el CLI necesita antes de ejecutar JS (duración del root, `src` de cualquier `<img>`/`<audio>`/`<video>`) va como placeholder de texto sustituido en el HTML por el adapter; todo lo demás (contenido variable: texto, números, colores, arrays/objetos anidados aunque no estén declarados en `data-composition-variables`) puede viajar por `--variables-file` + `getVariables()` sin problema.

---

## 4. Backend: exponer qué motores soporta cada nicho (prerrequisito del selector web)

Hallazgo del reporte de UI: **el frontend hoy no tiene ningún dato para saber, por nicho, si HyperFrames (o incluso Remotion) es una opción válida más allá del default** — `GET /api/v1/niches` devuelve un único `recorder_engine` (el default), no una lista de motores soportados. El toggle actual esquiva el problema mostrándose solo cuando el default ya es Remotion.

Para que el selector de 3 opciones tenga sentido (y no ofrezca combinaciones que sabemos que van a fallar), hace falta:

- Agregar `supported_engines: list[str]` a `NicheResponse` (`nexa-brief-server/src/presentation/api/schemas/niche_schema.py`) y calcularlo en `niches.py::_to_response()`:
  ```python
  supported_engines = ["playwright"]  # universal, nunca falla
  if remotion_adapter.supports_niche(n):
      supported_engines.append("remotion")
  if hyperframes_adapter.supports_niche(n):
      supported_engines.append("hyperframes")
  ```
- Esto no requiere ningún cambio en los adaptadores — `supports_niche()` ya existe en ambos (`remotion_adapter.py`, `hyperframes_adapter.py`) y es exactamente la misma función que ya usa `_validate_recorder_engine_override` en `videos.py`. Es reusar el mismo cálculo, expuesto por API en vez de quedar solo del lado del rechazo en el submit.

---

## 5. Frontend: extender el toggle a array de 3

Con el punto 4 resuelto, la extensión de `RecorderEngineSection.tsx` (reportada en detalle arriba) es mecánica y de bajo riesgo — no inventa ningún patrón nuevo:

- Cambiar el gate `if (niche?.recorderEngine !== "remotion") return null` por algo basado en `niche.supportedEngines` (el nuevo campo del punto 4), y renderizar el toggle si `supportedEngines.length > 1` (no tiene sentido mostrar un selector de una sola opción).
- Extender el array `(["remotion", "playwright"] as const)` a `(["remotion", "hyperframes", "playwright"] as const)`, filtrando por los que estén en `niche.supportedEngines` — así el botón de HyperFrames solo aparece para el/los nichos que de verdad la soportan (inicialmente, solo el nicho piloto de la sección 1, una vez portado).
- `schema.ts`: `recorderEngineOverride: z.enum(["remotion", "hyperframes", "playwright"]).optional()` — cambio de una línea, reportado ya en el punto 2 del reporte de UI.
- `messages/es.json` / `messages/en.json`: agregar `engineHyperframes`/`hintHyperframes` al bloque `createVideo.recorderEngineSection`, mismas claves que ya existen para Remotion/Playwright.
- `SummaryCard.tsx`: hoy no muestra `recorderEngineOverride` en el resumen (solo `renderTarget`) — gap preexistente, conviene cerrarlo de paso ya que se está tocando esta sección, para que el resumen final muestre el motor elegido.

No hace falta agregar `RadioGroup` de Radix ni ningún componente nuevo — el patrón de botones + `cn()` que ya se usa en `DurationSection`/`RenderTargetSection`/`RecorderEngineSection` escala tal cual a 3 opciones.

---

## 6. Orden de trabajo recomendado

No conviene implementar el selector web antes de tener al menos un nicho real soportado — mostraría una opción que siempre falla. Orden actualizado:

1. ~~**Spike de validación**~~ — **hecho** (sección 3).
2. ~~**Portar la composición piloto**~~ — **hecho** (sección 3, "composición piloto portada y funcionando de punta a punta"): `image_bg_portrait` ya genera mp4 real, incluyendo el ecualizador (magnitudes precalculadas en Python, `hyperframes_audio.py`).
3. ~~**Sumar la entrada real a `_COMPOSITION_BY_TEMPLATE_ID`**~~ — **hecho**: `"01-image-bg": "src/image-bg-portrait"`, `supports_niche()` da `True`.
4. ~~**Backend — `supported_engines` en `/niches`**~~ — **hecho** (sección 4): `NicheResponse.supported_engines` calculado en `niches.py::_supported_engines()` (mismo cálculo que ya usaba `_validate_recorder_engine_override`, ahora también expuesto por API). Verificado con `TestClient` real contra `GET /api/v1/niches`: `image_bg_portrait` devuelve `["playwright","remotion","hyperframes"]`, el resto de los nichos `["playwright","remotion"]` o `["playwright"]`.
5. ~~**Frontend — selector de 3 opciones**~~ — **hecho** (sección 5): `RecorderEngineSection.tsx` ahora itera `niche.supportedEngines` en vez de asumir 2 opciones fijas, gateado por `supportedEngines.length > 1` (antes: `recorderEngine !== "remotion"`). `RenderTargetSection.tsx` actualizado para aceptar motor efectivo `"hyperframes"` además de `"remotion"`. `SummaryCard.tsx` ahora muestra el motor elegido (gap que había quedado señalado en la primera versión de este documento). `schema.ts`/`types.ts`/`niches-service.ts` extendidos con el tercer valor y el nuevo campo `supportedEngines`. i18n (es/en) con `engineHyperframes`/`hintHyperframes`/`rowEngine`. Verificado con `biome lint` + `tsc --noEmit` (proyecto completo) sin errores.

**Plan de este documento completo, de punta a punta** (composición real + backend + frontend), verificado con tests reales en cada capa (CLI, `HyperframesAdapter` real, `pytest` del backend, `TestClient` contra `/niches`, `tsc`/`biome` del frontend) — no queda ningún paso hipotético.

### Hallazgo nuevo sobre el paso 2: el ecualizador en vivo no es portable tal cual

`IMG-retrato-impacto/index.html` (el template Playwright actual de `01-image-bg`) dibuja el ecualizador con un `AnalyserNode` de Web Audio API **en tiempo real** (`analyser.getByteFrequencyData()` dentro de un loop `requestAnimationFrame`) — depende de que el audio esté sonando de verdad en el momento de la captura. Eso es exactamente lo que HyperFrames (como Remotion) NO puede usar: el render es determinista y seekable (captura frame por frame en cualquier orden), no una grabación en vivo.

La versión ya portada a Remotion (`nexa-brief-remotion/src/components/ImageBg.js:26-58`) ya resolvió este mismo problema — reemplazó el `AnalyserNode` en vivo por `@remotion/media-utils` (`useAudioData` + `visualizeAudio`), que analiza el archivo de audio **offline** y devuelve las magnitudes de banda para cualquier frame dado, de forma determinista. HyperFrames no tiene un paquete equivalente a `@remotion/media-utils` — para portar el ecualizador hace falta precalcular las magnitudes por frame (por ejemplo, con `numpy`/FFT sobre el `song.mp3` del job, en Python, ya que `nexa-brief-server` ya procesa audio para otras cosas) y **hornear ese array como una variable más** (`--variables-file`) que la composición HyperFrames lea con `getVariables()` en vez de analizar audio en vivo — mismo mecanismo ya validado en la sección 3, aplicado a un dato más grande (un array de magnitudes por frame en vez de un string).

Los pasos 4-5 son la parte "fácil" que ya reportó la investigación de UI, pero no tiene sentido adelantarlos sin el resto.
