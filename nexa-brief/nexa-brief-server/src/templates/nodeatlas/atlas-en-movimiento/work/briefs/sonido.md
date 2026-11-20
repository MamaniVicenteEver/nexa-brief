# Brief · sonido (Sol 6.1 xhigh)

Antes: `work/briefs/_comun.md`. Lee `PLAN.md` §6, `work/research/SONIDOS.md`, `src/adapters/sound_effects/` (solo lectura: proveedor
SFXMint, formato de asset) y `../nodeatlas/japon-expansion-prueba/assets/sound-design/*/plan.json` (cues y ducking, ya probado).
Objetivo: catálogo de sonidos con licencia, eventos de sonido en el JSON de la escena, sincronización en la vista previa y mezcla
offline que quede DENTRO del MP4 cuando se grabe (esa mezcla es un `mix.mp3`; el MP4 se hace después, no ahora).
Entregables:
1. `assets/sfx/*.mp3` (descarga los 14 candidatos CC0 de SONIDOS.md con el cliente/endpoint público de SFXMint; si hay que usar
   la biblioteca interna `/api/v1/library/sounds/...` y no está disponible, usa el archivo directo y deja el `asset_id` vacío) y
   `engine/tactico/sfx.json`: `id` estable (`naval-engine-low, ship-horn, helicopter, jet-pass, bomber-prop, bomber-jet, bomb-whistle,
   explosion-near, explosion-far, water-impact, missile-pass, torpedo, sonar-ping, industrial-hum, hit-soft, whoosh, riser,
   ui-tick`), archivo, duración, licencia, URL, `gain_db` por defecto, `fade_in/out`, `loop`, `source_in`. Sin hueco: si falta un sonido,
   propón el más cercano y márcalo `substitute:true`; los ids de `tactico-fx` y `tactico-unidades` son el contrato.
2. `engine/tactico/audio.js`: lee `scene.sound.cues` (+ cues derivadas de `Tactico.sfx()` de cada item) y reproduce con WebAudio
   sincronizado al reloj del motor (`__promo`/Proto): play, pausa, seek hacia atrás y adelante sin acumular fuentes, volumen, y el
   ducking contra la voz (`song.mp3`): -9 dB de efectos mientras la narración habla (por rangos de `lyrics.json`). Debe funcionar en
   la vista previa de la app (pestaña Sandbox) y no romper el reproductor.
3. `tools/mixdown.mjs` (Node): a partir de la escena y `assets/song.mp3` genera `assets/mix.mp3` con ffmpeg
   (`adelay/volume/afade/amix`, ducking con `sidechaincompress` o por rangos), cue a cue, y `assets/mix.plan.json` (lista final
   de cues con tiempos reales). Verificación: volumen integrado (LUFS ~ -16), sin clipping (pico ≤ -1 dBFS), duración = narración.
   Pruébalo con una escena de 30 s de ejemplo (`work/sonido/scene-sonido.json`) y deja `mix.test.mp3`.
4. `work/results/sonido.md`: tabla evento → sonido → gain, decisiones, qué suena mal por ser sustituto, y cómo se escucha en la vista previa.
Sin tocar `src/adapters/`.

## REANUDACIÓN Y RITMO (añadido el 2026-11-03; obligatorio)
- Esta tarea se interrumpió antes de terminar (se pausó el servidor por exceso de carga). **Revisa primero lo que ya existe** en tus
  carpetas y en tu log de trabajo previo (`work/logs/<tarea>.log` está vacío porque se reinició; mira los archivos). **Continúa y
  termina; no rehagas lo que ya funciona.**
- El servidor tiene 4 núcleos y 11 GB sin GPU, y se comparte. Trabaja con calma: ejecuta SIEMPRE los comandos pesados con
  `nice -n 15`; **un solo proceso pesado a la vez** (un Chromium O un Blender O un ffmpeg largo, nunca dos); Blender con
  `--threads 1`; Chromium con una sola página; espera a que termine cada prueba antes de lanzar otra; nada en paralelo.
- Si una prueba tarda minutos, espera: no es un fallo. Si el sistema te corta una prueba (SIGSTOP/SIGKILL externo por exceso de
  carga), vuelve a lanzarla más tarde, de una en una.
- Cierra siempre tus procesos hijos (Chromium, Blender) al terminar cada prueba para liberar RAM.
