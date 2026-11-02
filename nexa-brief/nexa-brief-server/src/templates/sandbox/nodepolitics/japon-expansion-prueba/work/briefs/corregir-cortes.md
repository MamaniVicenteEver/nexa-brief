# Brief de trabajo · eliminar los «cortes» al reproducir `japon-expansion-prueba`

Eres el agente que **corrige** el problema (no solo lo mide). Modelo: `gpt-6.1-sol`. Trabajas en el servidor, en
`~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/`. Todas las rutas de este brief son relativas a esa carpeta.

## Objetivo

El usuario reproduce la plantilla `sandbox/nodepolitics/japon-expansion-prueba` (video de 120 s, diseño `imperio`) en la app
(`https://dev-nexa-brief.everdev.space/es/plantillas?cat=sandbox`, local `http://127.0.0.1:3000/es/plantillas?cat=sandbox`) y **sigue notando «cortes»**:
parones, saltos, congelados, tramos negros o cambios bruscos. Hay que encontrarlos TODOS, entender su causa y corregirla **en el origen**.
Esto es la base de muchos videos futuros: se arregla en el motor, no con parches de este video.

**Los movimientos de cámara se quedan** (alejamiento de la apertura, empuje del plano de archivo, vuelos entre destinos). Lo que se
elimina son los cortes. **No quites movimientos ni cambies el aspecto**: la comprobación de píxeles por salto de tiempo (seek) debe seguir idéntica.

## Lo que ya se hizo (2026-11-01) — léelo antes de tocar nada

Documentado en `_tools/explainer-kit/designs/imperio/DESIGN.md` § «Fluidez de la reproducción». Resumen:

1. `_tools/explainer-kit/engine/kit.js`: `mediaClock()` suaviza `audio.currentTime` (que avanza a escalones de 15–60 ms). Gancho `window.__kitTrace` para perfilar.
2. `_tools/explainer-kit/designs/imperio/components/_imperio.js`: `requestIdleCallback` no corre nunca mientras la animación va a cada cuadro → ahora
   `idle(f)` usa `{ timeout: 60 }`; `IM.sliceWork()` avanza franjas de la cola tras cada cuadro; `lookAhead`/`lookBeats` precalientan llaves del atlas por tiempo
   (`WARM_MAX = 4`, las del plano siguiente son urgentes); `projRings` se reparte en trozos (`_ringsWork`, `IM.warmAtlas`); `IM.keyStats()` es diagnóstico.
3. `sandbox/nodepolitics/japon-expansion-prueba/assets/components/japon.js` (componentes `imperio.campaign` e `imperio.footage`): `mapWarm`, grises, precalentado por tiempo, video B/N a media resolución.
4. Resultado medido en el servidor (sin GPU): 62 s de reproducción de esta plantilla = 0 cuadros > 60 ms; `imperio-demo` 9 → 3 pausas.

**Lo que queda y NO está investigado** (empieza por aquí):

- **El reproductor real de la app.** La plantilla se ve en un `<iframe>` mismo origen dentro de `MediaPlayerModal`
  (`~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-web/src/shared/components/media/MediaPlayerModal.tsx`, protocolo en `_tools/player/bridge.js`,
  modo `?controls=1`). Un iframe del mismo origen **comparte el hilo principal** con la página padre: cada `nexa-template-time` (hasta 4 por segundo) hace
  `setTime` en React y puede re-renderizar el modal entero y causar un tirón en la animación. Hasta ahora SOLO se midió la página suelta, no dentro de la app.
- **La red.** El usuario entra por un túnel de Cloudflare. Mira qué se descarga durante la reproducción y cuándo: los 4 videos `assets/media/plate-*.mp4`
  (1–3 MB; en `?controls=1` el motor NO espera a que carguen: ver `PREVIEW_FIRST_FRAME` en `engine/kit.js`), `assets/song.mp3`, las banderas SVG, las fuentes
  remotas de Google Fonts (Fjalla One, Montserrat, Noto Sans JP) y el atlas del mundo. Un video que llega tarde aparece de golpe; un `seeked` lento congela el cuadro.
- **Videos (`ctx.clip`, `syncClips` en `engine/kit.js`).** En vivo se hace `v.currentTime = want` si se desvía más de 0,3 s y `v.play()` / `v.pause()` según se pida cada cuadro:
  mira si al empezar un tramo de archivo hay salto, cuadro negro o congelado (`readyState`, `seeking`, `waiting`, `stalled`).
- **Cambios bruscos visuales** que se ven como «corte» aunque no haya pausa: saltos de nitidez cuando una llave del atlas pasa de la copia de reserva (`fallback`) a la
  llave nueva, cambios de gris al entrar/salir un tramo de archivo, rebotes de banderas, empalme entre `imperio.title` → `imperio.footage` (10,2 s) → `imperio.campaign` (19,8 s)
  → cierre automático (115,1 s), la primera pintura (el audio no debe sonar sobre un lienzo vacío), el texto que cambia al llegar las fuentes.
- Lo que sigue sin resolver en la base: ~100 ms al **primer uso** de un lienzo de llave grande (1830×1030) aunque ya esté completo; pausas en `imperio-demo` hacia 11,9 s y 48,2 s.

## Cómo medir (herramientas ya hechas)

En `sandbox/nodepolitics/japon-expansion-prueba/work/perf-tools/` hay scripts de Playwright (corre con
`~/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python`, Chromium headless con `--autoplay-policy=no-user-gesture-required`).
Léelos y reutilízalos; pueden necesitar ajustes:

- `_tools/explainer-kit/tools/perf_check.py <url> --secs 60 [--orig DIR]`: uniformidad del tiempo del motor y cuadros > 60 ms (compara con el motor anterior).
- `perf-tools/cpuprof2.py` + `cpuwin.py`: perfil de CPU de la reproducción y, para cada cuadro largo, las funciones que lo causan.
- `perf-tools/blitdbg.py`: `drawImage` lentos con su canvas de origen y nº de uso. `perf-tools/keytl2.py`: estado de la cola de llaves del atlas por segundo.
- `perf-tools/ctl.py`: modo `?controls=1` con play, seek y pausa por el protocolo del puente (`postMessage`). `perf-tools/regress2.py` y `ab.py`: regresión de píxeles y A/B contra el motor original.
- URL de la plantilla suelta: `http://127.0.0.1:8000/api/v1/explainer/files/sandbox/nodepolitics/japon-expansion-prueba/index.html` (añade `?controls=1` para el modo de la app).
- Para la app real: abre `http://127.0.0.1:3000/es/plantillas?cat=sandbox` con Playwright, entra con la cuenta de desarrollo documentada en
  `~/Projects/Git-Projects/nexa-brief/nexa-brief/README.md` (sección «Inicio rápido»), abre la plantilla y mide los cuadros DENTRO del iframe mientras el padre actualiza React.
  **No leas ni imprimas valores de `.env` ni claves.** Si no logras entrar sin ellas, usa una página envoltorio mismo origen que cargue el iframe y reciba
  los `postMessage` (`nexa-template-time`, `nexa-template-state`) haciendo trabajo equivalente, y dilo en el informe.
- Condiciones a probar: normal; CPU ×4 (`Emulation.setCPUThrottlingRate` por CDP); red limitada (`Network.emulateNetworkConditions`, p. ej. 10 Mb/s con 80 ms de latencia).
  Desde el servidor sin GPU los tiempos de dibujo son pesimistas: compara antes/después, no leas cifras absolutas.
- Conviene medir también **fluidez visual** sin depender del audio: seek determinista cada 1/30 s en tramos con movimiento (apertura 3–10 s, vuelo 20–30 s, tramos de archivo)
  y diferencia entre cuadros consecutivos, para detectar saltos de nitidez o de posición que la medición de tiempos no ve.

## Qué puedes tocar

- Esta plantilla completa (`sandbox/nodepolitics/japon-expansion-prueba/`): `assets/components/japon.js`, `assets/storyboard.json`, `assets/media/*` (si hay que recodificar un clip, conserva `-g 6 -keyint_min 6`),
  `info.json`, `PLAN.md`, `work/`.
- El motor, solo estos archivos: `_tools/explainer-kit/engine/kit.js`, `_tools/explainer-kit/engine/loader.js`,
  `_tools/explainer-kit/designs/imperio/components/*.js`, `_tools/player/bridge.js`. El usuario autorizó corregir el motor porque es la base de todos los videos.
- Antes de editar un archivo del motor, su estado actual ya está respaldado en `sandbox/nodepolitics/japon-expansion-prueba/work/engine-backup/pre-sol/` y el original en `work/engine-backup/*.orig`.
- **NO edites** la app web (`nexa-brief-web/`) ni el backend (`src/`): si la causa está allí (por ejemplo, re-renders del modal), deja la propuesta como parche en
  `work/proposals/*.patch` con la explicación y la medición que la justifica. La web corre en modo desarrollo: un cambio roto la rompería al instante para todos.
- No toques otras plantillas, `niches.json`, `templates.json`, `.env`, ni lanzadores (`*.sh`) que estén ejecutándose. Sin `git commit`/`push`. No reinicies la API ni la web.
  Hay otros procesos Codex en el servidor que NO son tuyos: no mates procesos ajenos.

## Reglas de calidad

- Cada cambio del motor debe ser **causal** (con evidencia medida de qué corte quita) y **general** (vale para todos los diseños/videos), no un parche para este video.
- No cambies cómo se ve ningún cuadro: corre la regresión por seek del `imperio-demo` y de esta plantilla (16:9 y 9:16) antes y después; las capturas por seek deben ser idénticas
  (el original ya difiere consigo mismo en los planos con foto 14, 31 y 48,5 s del demo por carga asíncrona de la foto: eso es ruido previo, no lo cuentes como regresión).
- `kit.py check japon-expansion-prueba` y `kit.py check imperio-demo` deben seguir en OK. `pytest -q -k "explainer or kit or imperio or sandbox or prototype or template"`: las únicas 2 fallas permitidas son
  `test_list_templates` y `test_list_template_categories` (categorías `testing` / `in_progress`, ajenas a esto).
- El modo `?controls=1` debe seguir funcionando: pausa exacta, buscar en pausa exacto, adelantar/retroceder en marcha resincroniza (usa `perf-tools/ctl.py`).
- Sin `Math.random`, `Date` ni relojes en el dibujo de componentes (determinismo del seek); colores solo derivados de `IM.COL` (el control de componentes prohíbe `#hex` y `rgba(` en el código).
- Un cambio que no mejore lo medido se revierte. No dejes código muerto ni instrumentación encendida por defecto (los ganchos de diagnóstico solo actúan si alguien los pide).

## Criterio de éxito

Sobre 120 s de reproducción de esta plantilla, en tres condiciones (normal, CPU ×4, red limitada) y en dos entornos (página suelta y dentro de la app o su envoltorio):

- Ningún cuadro de más de 100 ms y como máximo 1 cuadro de más de 50 ms por minuto en la condición normal.
- La desviación de la velocidad del tiempo del motor ≤ 0,05 (ver `perf_check.py`) y ningún cuadro negro, congelado ni salto de nitidez perceptible al entrar los tramos de archivo.
- Si algo no se puede arreglar (límite del navegador o de la app), documenta exactamente qué es, por qué, y propón la mitigación.

## Entregable exacto

`work/results/corregir-cortes.md` con:

1. Tabla de **cortes encontrados**: segundo del video, tipo (pausa / congelado / negro / salto visual), causa raíz, evidencia (cifras, perfil), y si quedó **corregido**.
2. Lista de **cambios hechos** (archivo y línea, qué hacía antes y qué hace ahora) y de **propuestas** para la app web (parches en `work/proposals/`).
3. Medidas **antes y después** en las condiciones de arriba (tabla), con el comando exacto para repetirlas.
4. Resultado de las comprobaciones: regresión de píxeles, `kit.py check`, `pytest`, modo `?controls=1`.
5. Riesgos, lo que queda y qué debería vigilar quien haga el próximo video.

Actualiza también `designs/imperio/DESIGN.md` § «Fluidez de la reproducción» con lo nuevo y sube la herramienta que hayas creado a `_tools/explainer-kit/tools/` solo si es reutilizable.
Escribe en español neutro. Si no puedes continuar (infraestructura, cuota, disco), guarda lo hecho, deja el informe parcial y di qué falta.
