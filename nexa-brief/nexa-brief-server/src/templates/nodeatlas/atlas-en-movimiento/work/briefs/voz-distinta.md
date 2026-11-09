# Brief · voz-distinta (Sol 6.1 high) — SERVIDOR; EXACTAMENTE 2 peticiones de Gemini

## Pedido del usuario (literal, resumido)
La mezcla `assets/mix.mp3` del demo (voz **Charon** + 15 efectos) **le gusta y es la base: nos quedamos con ella**. Pero esa voz ya la escuchó mucho y quiere **distinguirse un poco**: buscar **otras 2 voces bien usadas, con LA MISMA NATURALIDAD**, algo más diferentes, humanas, normales, **sin exagerar nada**
(nada de «ronca de mil batallas», sin suspiros teatrales, sin pausas forzadas). Generar **2 muestras de ~15 s**. Si no lo convencen, se queda con Charon.
Tenía que «leer las investigaciones»: léelas, pero ojo con la conclusión que ya probamos mal: las muestras de Malvinas (`work/voz/muestras/`, `work/voz-natural/diagnostico.md`) sonaron forzadas porque se mandaron etiquetas `<long pause>` y un guion de actuación de ~1000 caracteres para 2–3 frases.

## Qué hace natural a la voz del demo (verifícalo tú)
Se generó con el pipeline estándar del kit en **UNA petición de 24 segmentos y 616 palabras** (`work/voz/narrate.log`, `peticiones.json`), con el `tone` de cada segmento (`assets/script.json`: «intriga», «tensión», «explicativo»…), un `delivery_note` corto
(«Documental sobrio, español latino neutro. Ritmo de ciento veinticinco palabras por minuto…») y el `voice_direction` global corto. Pausas entre ideas de ~0,2–0,3 s. Mide el audio aprobado (`assets/song.mp3` + `assets/lyrics.json`) y usa esas medidas
(ppm, mediana y máximo de pausas, F0, rango dinámico) como **referencia de naturalidad objetivo**.

## Qué hacer
1. **Elige las 2 voces** (varones, naturales para documental histórico en español) con razones breves: **Orus** (el usuario escuchó `orus-pausas-humanizadas-madurez-suave.mp3` y fue lo más cercano a lo que busca) y **una segunda** distinta de Charon, Algenib y Schedar (descartadas) y distinta de Sadaltager (ya usada en NodeTech): evalúa Rasalgethi, Iapetus, Alnilam, Achird, Algieba con los descriptores
   oficiales de Gemini TTS y `_tools/explainer-kit/guides/voice.md`; no hagas ninguna llamada para explorar.
2. **Texto de la muestra**: los primeros segmentos del demo (`s01`, y `s02` si hace falta) hasta ~15 s de audio, **mismo texto, mismo `tone` y mismo `delivery_note` que el original**, para comparar de tú a tú con Charon. Prepara el guion de muestra recortado (`work/voz/distinta/script.muestra.json`).
3. **Genera con el kit estándar** (`_tools/explainer-kit/tools/narrate.py`, ver `_proto/FABRICA.md`) con SOLO `--voice` cambiado. **Sin etiquetas extra, sin prompt largo, sin posproceso de madurez/saturación/suspiros.** Lo único permitido tras generar: igualar volumen a −16 LUFS para comparar justo.
4. **Extrae la referencia Charon** del audio aprobado: el tramo de `assets/song.mp3` que dice el mismo texto (usa las marcas por palabra de `lyrics.json`), `charon-referencia.mp3` a −16 LUFS.
5. **Mide** las 3 muestras: ppm, pausas (n, mediana, máximo, vs. referencia), F0 mediana y rango, LUFS, pico; Whisper local para confirmar que el texto es íntegro. `LEEME.md` con qué escuchar y tu recomendación razonada SIN imponerla (no puedes oír).
Salida en `work/voz/distinta/`: `orus.mp3`, `<segunda-voz>.mp3`, `charon-referencia.mp3`, `LEEME.md`, `mediciones.json`, `consumo.json`.

## LÍMITE DE GASTO (obligatorio, Gemini cobra por petición)
**Exactamente 2 peticiones de TTS** (una por voz), de ~15 s, **cero reintentos, cero regeneraciones, cero pruebas de exploración**. Si una falla, informa y NO repitas. No imprimas ni leas claves. No generes la narración completa de ninguna variante. Registra cada petición en `consumo.json`.

## Archivos que puedes tocar
`work/voz/distinta/` y `work/results/voz-distinta.md`. Nada más (el demo y `assets/mix.mp3` quedan intactos). Ritmo: un proceso a la vez, `nice -n 15`.
