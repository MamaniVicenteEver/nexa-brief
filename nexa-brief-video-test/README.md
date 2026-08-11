# nexa-brief-video-test — benchmarks de render Remotion

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