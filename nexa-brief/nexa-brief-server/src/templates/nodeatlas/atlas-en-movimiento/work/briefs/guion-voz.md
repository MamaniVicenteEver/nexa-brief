# Brief · guion-voz (Sol 6.1 xhigh)

## Objetivo
Escribir el guion narrado y generar la voz y los tiempos por palabra del demo «La guerra de los petroleros (Golfo Pérsico,
1980–1988)», duración final entre 4:20 y 4:40 con voz, usando SOLO los hechos verificados de `work/research/`.

## Leer
`work/research/HECHOS.md` (incluye «No se dice»), `ESTRUCTURA.md` (7 bloques con duraciones y frases-ancla propuestas),
`work/results/investigar.md` (correcciones obligatorias), `../_proto/FABRICA.md` (pasos de voz), `../bolivia-mar/assets/script.json`
(formato de guion y `voice_direction` que ya funcionó), `../../../_tools/explainer-kit/guides/{storytelling.md,voice.md}`,
`../../../_tools/explainer-kit/tools/{narrate.py,transcribe.py}`.

## Archivos que puedes tocar
`atlas-en-movimiento/assets/` (script.json, lyrics.json, song.mp3, voice/), `work/voz/` y `work/results/`. Las herramientas del kit
se EJECUTAN, no se editan. No imprimas ni leas `.env` ni claves.

## Entregable
1. `assets/script.json` (formato del kit): 7 bloques de ESTRUCTURA.md, ~500–560 palabras, español latino con «tú» si interpela,
   números en palabras, oraciones de 6–18 palabras, sin citas inventadas, sin titulares atribuidos a medios, respeto con las víctimas
   (Stark: 37; Iran Air 655: incluir la opción sensible de ESTRUCTURA.md con el tratamiento sobrio que propone: SÍ entra, 290 personas,
   sin explosión ni sonido de recompensa), y cada evento visual con su frase-ancla reconocible por Whisper (cifras como se dicen).
   Cada fecha, cifra y nombre aparece en HECHOS.md; deja en `work/voz/trazabilidad.md` una tabla frase → fila de HECHOS.
2. Voz con la ruta que usa el kit (`tools/narrate.py` según FABRICA.md, voz Charon, dirección sobria de documental, ritmo ~120–130 ppm,
   lead 1,2 s, tail 6 s). Una sola petición (cuota Gemini); si falla por 503 el kit parte en 3. Control de calidad
   (`narration.qc.json`) sin faltantes ni sobrantes reales.
3. Transcripción Whisper (`tools/transcribe.py`): `assets/lyrics.json` con tiempos por palabra y `assets/song.mp3` (la narración).
   Sin `timeout` corto: ejecutar en segundo plano y esperar.
4. `work/voz/anclas.json`: para cada ancla de ESTRUCTURA.md (y las que añadas) la palabra exacta, `start`, `end` en segundos
   (comprobadas en lyrics.json) y el bloque; lista de los 7 tiempos de bloque reales (inicio/fin) para ajustar la escena.
5. Variante Malvinas (56 s): guion `assets/script.malvinas.json` + anclas SIN generar voz todavía (la voz se genera en otra tarea).
6. `work/results/guion-voz.md`: duración real, ppm, resultado del control, dudas editoriales, consumo de cuota.

## Aceptación
Duración con voz 4:20–4:40; 0 cifras sin fuente; anclas todas encontradas en lyrics.json; sin repeticiones de Whisper; el guion
respeta «No se dice» y las correcciones de `investigar.md`.
