# Brief · voz-referencia (Sol 6.1 high) — ESTA MÁQUINA, sin gastar Gemini ni ninguna API de pago

## Pedido del usuario (literal)
«Estudia el tono, cómo habla y la manera en la cual habla; transcribir en esta máquina, luego obtener el texto, luego copiar un poco el tono, las pausas naturales, etc. Luego quiero otra voz un poco más ronca, que suene a hombre maduro,
un poco áspera, como si hubiera participado en miles de batallas, con suspiros naturales, manteniendo el tono, elevando la voz cuando lo necesite. Lo que busco es que las palabras resuenen en sus cabezas, que sea especial, que se sienta.»
Es para la narración de la variante «Malvinas 1982» (~56 s), que debe sonar distinta a las voces de siempre (Charon, Sadaltager).

## Entrada
`work/voz-ref/Picker_Rickmansworth_88_mp3.mp3` (3:31, estéreo 44,1 kHz; hablante de relato oral, probablemente en inglés: el idioma lo confirma Whisper). Se estudia COMO HABLA (ritmo, pausas, tono, energía, respiración), no se copia su texto.

## Qué hacer (todo local, `nice -n 15`, un proceso pesado a la vez)
1. **Transcribir** con faster-whisper `large-v3` (ya en caché local: `~/.cache/huggingface/hub/models--Systran--faster-whisper-large-v3`), `cpu_threads=3`, marcas de tiempo por palabra, sin VAD agresivo que borre respiraciones.
   Guarda `work/voz-ref/transcripcion.json` y `transcripcion.txt` (con idioma detectado y confianza). Usa el Python del proyecto: `~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -I` (tiene numpy, scipy y faster-whisper;
   si necesitas librosa o praat-parselmouth, créalos en un venv desechable en `/tmp`, no en el proyecto).
2. **Análisis acústico con números** (`work/voz-ref/analisis.json` + gráficas PNG): palabras por minuto sobre tiempo de habla y sobre tiempo total; distribución de pausas (≥120 ms) y su relación con la puntuación/cláusulas de la transcripción
   (duración típica tras coma, tras punto, entre ideas); longitud de frases; tono F0 (mediana, p10–p90 en semitonos, contorno al final de frase: baja o sube; momentos de énfasis); energía RMS y rango dinámico, picos de volumen = palabras enfatizadas;
   respiraciones y suspiros (ráfagas de baja energía de banda ancha de 100–600 ms antes de frases: cuántos por minuto y dónde caen); aspereza (jitter/shimmer/HNR si hay parselmouth, inclinación espectral y energía en 2–5 kHz como proxy); variación del ritmo a lo largo del relato (aceleraciones y pausas largas dramáticas).
3. **Informe `work/voz-ref/VOZ-REFERENCIA.md`** con: perfil medido y **objetivos numéricos**, 6–8 frases anotadas con marcas de tiempo (qué ocurre en cada una: pausa, énfasis, suspiro, bajada de tono), y gráficas.
4. **Dirección para TTS (español) con DOS perfiles**, lista para el kit (`_tools/explainer-kit/tools/narrate.py` en el servidor; léelo para ver qué marcas admite, p. ej. `<short pause>`, y `guides/voice.md`): 
   - **Perfil A «referencia»**: imita ritmo, pausas y energía del hablante medido (reglas de dónde poner pausas cortas/largas según los números).
   - **Perfil B «veterano áspero»** (el que se usará): voz masculina madura, grave y ronca, algo áspera, cansada pero firme, ritmo lento (~100–115 ppm), pausas largas antes de las cifras y de los momentos duros, **suspiros naturales** entre ideas, tono contenido que **sube y se endurece** en el momento clave
     y vuelve a bajar, sin teatralidad. Redacta el `voice_direction` en español, reglas de puntuación y de pausas para el guion (dónde `<short pause>`, puntos suspensivos, comas), y cuántas pausas largas por minuto.
   - **Voces candidatas de Gemini TTS** para B con su motivo: Algenib (descrita como áspera/gravelly), Gacrux (madura), y 1–2 más graves del catálogo (Alnilam, Orus, Sadaltager…); indica cuál probar primero y por qué. No llames a la API.
   - **Suspiros**: no escribas indicaciones entre paréntesis en el texto hablado (se leerían en voz alta). Comprueba qué marcas admite el modelo y, si no hay una fiable para suspirar, propón una **receta de posproceso local con ffmpeg** (mezcla de 4–6 respiraciones/suspiros CC0 muy bajos entre frases en los huecos medidos,
     EQ que realce graves y 2–4 kHz, saturación suave, pequeña sala) y deja un script `work/voz-ref/fx-veterano.sh` que la aplique a un WAV. Busca candidatos de respiración/suspiro en SFXMint con licencia CC0 (como hizo la tarea `sonido`, ver `work/sonido/` y `work/research/SONIDOS.md`) y anótalos con ID, duración y licencia; no los descargues si no hace falta.
5. **Prueba de la receta de posproceso** (sin Gemini): aplícala sobre un fragmento de 15–20 s del propio audio de referencia o sobre una voz ya generada del proyecto (`assets/song.mp3` del Golfo, tramo 0–20 s, es solo para comparar el efecto, NO se publica) y deja `work/voz-ref/prueba-fx-antes.mp3` y `prueba-fx-despues.mp3`.

## Archivos que puedes tocar
Solo `work/voz-ref/` y `work/results/voz-referencia.md` de tu copia (`~/aem-local/...`, es un espejo; se copia al servidor al terminar). Sin emojis. No imprimas ni leas claves.

## Entregable
Todo lo anterior + `work/results/voz-referencia.md` (resumen de números clave, qué se transcribió, decisiones, lo no verificado). Mira tus gráficas y corrige si algo no tiene sentido (por ejemplo, un F0 de octava errónea).
