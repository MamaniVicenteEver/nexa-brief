# Brief · plano-rendimiento (Astra xhigh)

## Objetivo
`work/results/base-medicion.md` mostró que Atlas plano promedia 335 ms/cuadro (objetivo ≤150) y que los cuadros con desenfoque de
movimiento (4 muestras) promedian 677 ms (p95 1.244 ms). Hay que bajarlo SIN reducir calidad perceptible ni determinismo, y
cerrar los 128 faltantes de teselas del benchmark. El demo de 4:30 se exportará cuadro a cuadro: cada ms cuenta (8.100 cuadros).

## Leer
`work/results/base-medicion.md` (entero), `engine/plano/*` (README, plano.js, tiles.js, blur.js, territories.js, view.js),
`work/bench/` (bench.py.txt, scene-bench.json, results/metrics.json y series por cuadro), `engine/tactico/CONTRATO.md` §2
(los GANCHOS `tactico` en plano.js DEBEN conservarse tal cual; `c.tactico.draw` por muestra y `key(t)` en `stillKey`).

## Archivos que puedes tocar
`engine/plano/*`, `engine/looks/tactico.json`, `work/bench/*`, `work/results/plano-rendimiento.md`. Nada más. Otra tarea
(`tactico-core`) trabaja en `engine/tactico/` a la vez: no la toques.

## Qué probar (decide con medidas, en este orden de interés)
1. Dónde se va el tiempo por cuadro (perfilado por fase: tiles, territorios Path2D, tinte, look, blur, lectura de píxeles).
2. Desenfoque: en lugar de redibujar el mapa entero 4 veces, dibujar el mapa UNA vez en un lienzo intermedio a la pose final y
   aproximar el barrido con transformaciones afines (traslación/zoom/rotación) del bitmap ya compuesto, o acumular menos
   muestras cuando el desplazamiento es pequeño (umbral por píxeles de movimiento real, no por velocidad de cámara); comparar
   con la referencia de 4 muestras por diferencia de píxeles (PSNR/SSIM) y dejar la métrica en el informe. Conservar el modo
   exacto como `motionBlur.mode:"exact"` y usar el rápido por defecto solo si la diferencia visual es imperceptible.
3. Territorios: cachear los Path2D rellenos por país en un mapa raster por nivel de zoom entero y reutilizarlo con matriz afín;
   evitar rellenos multiply/screen/overlay completos por cuadro si la geometría no cambió.
4. Teselas: reducir `drawImage` repetidos (compositor por mosaicos, caché de la gradación) y la transición cruzada solo cuando hace falta.
5. Lectura de píxeles y `willReadFrequently`: evaluar quitar lo que obliga a sincronizar la GPU virtual.
Meta: media ≤150 ms/cuadro a 1080×1920 en SwiftShader en el recorrido de 25 s; p95 ≤350 ms; sin aumentar el tiempo de precarga
más de 2×. Si no se alcanza, informa cuánto se logró y qué falta, con datos.

## Teselas faltantes
`work/bench/missing-tiles.json` lista 128 teselas. No puedes escribir en `_atlas/cache`. Prepara el comando exacto de
`_tools/atlas/atlas.py fetch` (o plan --fetch) para que Claude lo ejecute, y verifica con `--dry`/estimación cuántos bytes son.

## Entregable
Código en `engine/plano/`, `work/bench/bench.py.txt` actualizado, nuevas métricas (`results/metrics-v2.json`) y capturas de
comparación antes/después (hoja de 12 + tira del vuelo), hashes de seek fuera de orden (5/5), `node --test` del _atlas
(23/23) y las pruebas propias en verde. `work/results/plano-rendimiento.md` con tabla antes/después por fase.

## Aceptación
Mismo aspecto (diferencia media RGBA documentada), determinismo 5/5, 0 errores de consola, ganchos `tactico` intactos
(`grep tactico engine/plano/plano.js`), y la guía de promoción a `_atlas/plano/` actualizada en el README.

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
