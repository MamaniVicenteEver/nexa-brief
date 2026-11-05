# Brief · escena-completa (Astra xhigh) — EL ENTREGABLE PRINCIPAL

## Objetivo
Armar `assets/scene.json`: el demo «La guerra de los petroleros (Golfo Pérsico, 1980–1988)» de **262,84 s (4:22)**, vertical 1080x1920 a
30 fps, usando TODA la biblioteca táctica y la voz ya generada. Es la prueba de que el motor funciona: territorios con bandera en los dos
modos, unidades en movimiento, **portaaviones Enterprise con escoltas y salidas de aviones**, barcos mercantes y de guerra con estados
(tocado/ardiendo/hundido), ataques, economía, retratos y prensa con crédito, intro y cierre, cámara coordinada y sonido. Sin grabar MP4.

## Leer (en este orden)
1. `engine/tactico/CONTRATO.md`, `engine/tactico/README.md`, `engine/tactico/components.json` (68 componentes: nombres y parámetros) y
   `engine/tactico/PORTAAVIONES.md`.
2. `work/research/ESTRUCTURA.md` (7 bloques y decisiones de representación RESUELTAS), `work/research/HECHOS.md` (coordenadas y fuentes),
   `work/results/investigar.md` (correcciones obligatorias y límites), `work/results/guion-voz.md`.
3. `work/voz/anclas.json` (**tiempos reales** de los 7 bloques y 54 anclas con `start/end`), `assets/script.json`, `assets/lyrics.json`.
4. `REFERENCIAS.md` (matriz de las 5 referencias) y `PLAN.md` §5 (JSON del portaaviones).
5. `work/tactico/scene-*.json` (escenas demo de cada familia: ejemplos de uso real), `assets/media/credits.json`, `engine/tactico/sfx.json`.

## Archivos que puedes tocar
`assets/scene.json` (nuevo, el episodio), `assets/config.json`, `index.html` del prototipo (para cargar `engine/plano/plano.js` en lugar de
`../_atlas/atlas.js`; el HTML actual es de la escena provisional de 20 s: reemplazarla), `assets/mix.*` (re-mezclar con la escena), `work/escena/`,
`work/results/escena-completa.md`, `REFERENCIAS.md` (solo la matriz). NO toques `engine/` (si falta algo, descríbelo en el RESULT con el diff).
Si necesitas un dato (p. ej. waypoints marítimos), calcúlalo con `validate.mjs`; las rutas marítimas NO deben cruzar tierra.

## Qué debe contener (checklist de aceptación)
- Los 7 bloques de ESTRUCTURA con los tiempos medidos de `anclas.json` (`scene_start/scene_end`), cada evento visual en su **frase-ancla**
  (`@palabra` resueltas con `lyrics.json`): números en el ancla como los dijo Whisper (ver `validacion-anclas.json`).
- Bloque 1: Bridgeton (`naval.cargo` tanker, bandera EE. UU.) con 3 escoltas (`naval.group`: Fox, Kidd, Crommelin) y mina (`fx.impact` agua +
  estado `hit`, nunca `sunk`), cámara `follow`.
- Bloque 2: Irak/Irán con `territory.flag` (UN país en `fill`, otro en `marker`, comprobar ambos modos), `unit.advance`/`unit.retreat`,
  `front.line` aproximado con rótulo «aproximado», Abadán `site.refinery`, año 1982, Jorramchar. Retratos con cargo y fecha reales (HECHOS).
- Bloque 3: `site.port` Kharg, `route.sea`/`route.lanes`, `money.flow` sin cifra, `arrow.flow`; rótulo «rutas esquemáticas».
- Bloque 4: ataques a terminales (`air.jet`+`trail.contrail`, Kharg `hit`), Stark (`naval.warship`, dos `strike.missile`, `editorial.press` con la foto A01 y su crédito).
- Bloque 5: reabanderamiento (`flag.marker` en DOS mercantes), convoy cruzando Ormuz, Iran Ajr y helicópteros (1 observador + 2 de ataque desde Jarrett), `callout.photo` con la foto del 22 sep.
- Bloque 6: **Enterprise `naval.carrier` variante supercarrier FUERA del Golfo con escoltas**, `air.launch` de A-6, Sassan/Sirri `site.platform` bajo ataque,
  Sahand y Joshan `hit→burning→sunk`, Sabalan `hit` y detenida (NO hundida), Samuel B. Roberts con su mina. Pico visual ~03:05–03:14 sin celebración del daño.
- Bloque 7: resolución 598 (`editorial.press` A09, fechado 20 jul 1987), Iran Air 655 con el tratamiento sobrio de ESTRUCTURA (ruta civil discreta, **sin explosión ni sonido de recompensa**),
  alto el fuego 20 ago 1988, mapa quieto y cierre `outro.channel` (últimos 8 s) con `intro.title` al inicio (≤6 s).
- Cámara: sin saltos; velocidades de pantalla y tiempos de viaje medidos (`work/escena/camara.json`: máx. px/s y duración por vuelo); usa `follow`, `zoomThrough` y `reframe`;
  alterna planos quietos y movimientos rápidos con desenfoque como las refs (ref5 0:26–0:29).
- Sin emojis, sin citas ni titulares inventados, cada cifra/fecha en HECHOS; respeto con las víctimas.
- Sonido: eventos derivados de los componentes más `sound.cues` explícitos; regenerar `assets/mix.mp3` con `tools/mixdown.mjs`; -16 LUFS, pico ≤ -1 dBFS, duración = 262,84 s.
- Validación: `node engine/tactico/tools/validate.mjs assets/scene.json` con **0 errores**; seek fuera de orden estable en 8 instantes; `missingTiles` listado en
  `work/escena/teselas-faltantes.json` (Claude las descarga después; tú NO descargues).
- Matriz de `REFERENCIAS.md` completa: ref + instante → componente → momento del demo (t en s) → comprobación, para las 5 referencias (incluida la 5 con el portaaviones).

## Revisión visual (obligatoria; tú mismo)
Hoja de 36 cuadros (cada ~7 s) en 9:16 + tira a 10 fps del bloque 6 (Enterprise y despegues) y del bloque 1; `work/escena/hojas/`. MIRA las hojas y corrige: elementos tapados por rótulos,
textos cortados, unidades fuera de cuadro, rótulos ilegibles a 1080 px, efectos tapando cifras. Deja en el RESULT una tabla por bloque: qué se ve, qué corregiste, qué queda dudoso.

## Ritmo
Pruebas pesadas con `nice -n 15`, UNA página de Chromium, una prueba a la vez. Precarga del barrido puede tardar minutos: espera. No grabes MP4.
