# Brief · voz-malvinas (Sol 6.1 high) — SERVIDOR; máximo 2 muestras de Gemini; NO generar la voz completa

## Objetivo
Dejar lista la voz «única» de la variante Malvinas 1982 (~56 s): un **veterano áspero y maduro**, que haga resonar las palabras. El estudio de la voz de referencia ya está hecho:
lee `work/voz-ref/VOZ-REFERENCIA.md` (perfil medido, perfil B «veterano áspero», marcas de pausa, voces candidatas, receta de posproceso `work/voz-ref/fx-veterano.sh`), `work/results/voz-referencia.md`,
`assets/script.malvinas.json` y `work/voz/anclas.malvinas.json`, `work/research/HECHOS.md` (filas de Malvinas), `work/results/guion-voz.md`, y en el kit `_tools/explainer-kit/tools/narrate.py` y `guides/voice.md`.

## Límite de gasto (obligatorio): Gemini cobra por petición
- **Como máximo 2 peticiones de TTS en total**, ambas CORTAS (≤ 20 s de audio, un fragmento de 2–3 frases de Malvinas con el mismo texto), una con la voz candidata nº 1 y otra con la nº 2 del informe, ambas con el perfil B.
- **Prohibido generar la narración completa** (eso lo decide el usuario tras escuchar). Cero reintentos automáticos: si una petición falla, informa y no repitas. No toques ni imprimas claves (el kit las rota solo).
- Registra cada petición en `work/voz/muestras/consumo.json` (voz, modelo, segundos, estado).

## Hacer
1. Crea `assets/script.malvinas.vet.json` (NO sobrescribas `script.malvinas.json`): mismo contenido histórico verificado (sin inventar cifras ni citas, respeto con las víctimas), con la puntuación y las marcas de pausa de la guía del perfil B y el `voice_direction` de la guía.
   Cada frase con sus anclas reconocibles. Conserva 7 bloques y ~104 palabras (≈ 56 s al ritmo del perfil B; ajusta el texto si el ritmo lento lo alarga, y di la duración estimada).
2. Genera las 2 muestras cortas con `tools/narrate.py` (mira su uso en `_proto/FABRICA.md`), guarda `work/voz/muestras/malvinas-<voz>.wav` y `.mp3`.
3. Aplica la receta local `fx-veterano.sh` (ffmpeg, sin coste) a cada muestra: `malvinas-<voz>-fx.mp3`. Así hay 4 audios para comparar: dos voces × crudo/procesado.
4. Mide en cada muestra (local): ppm, pausas, rango de tono y volumen integrado, y compáralos con los objetivos del perfil B.
5. `work/voz/muestras/LEEME.md` con qué escuchar en cada archivo, tus medidas y tu recomendación razonada (sin imponer): voz + crudo o procesado.

## Archivos que puedes tocar
`assets/script.malvinas.vet.json`, `work/voz/muestras/`, `work/results/voz-malvinas.md`. Nada más.

## Entregable
Los 4 audios + LEEME + `work/results/voz-malvinas.md` (peticiones realizadas = máximo 2, resultado, qué falta). Ritmo: un proceso a la vez, `nice -n 15`.
