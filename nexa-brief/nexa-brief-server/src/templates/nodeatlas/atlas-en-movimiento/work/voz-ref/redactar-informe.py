"""Compone la entrega desde resultados reales; no sintetiza ni estima datos faltantes."""
import json,re
from pathlib import Path
R=Path(__file__).resolve().parent
a=json.loads((R/'analisis.json').read_text()); tr=json.loads((R/'transcripcion.json').read_text()); fx=json.loads((R/'prueba-fx-validacion.json').read_text()); prof=json.loads((R/'perfiles-tts.json').read_text())
t=a['tempo'];p=a['pauses'];f=a['pitch'];e=a['energy'];rough=a['roughness']; br=a['breaths']
def n(v,d=2):return f'{v:.{d}f}'.replace('.',',')
def st(x,unit=''):return f"{n(x['median'])}{unit} (p10–p90: {n(x['p10'])}–{n(x['p90'])}{unit}; n={x['n']})" if x['n'] else 'sin observaciones'
def time(s):return f'{int(s)//60:02d}:{s%60:05.2f}'
comma=p['by_punctuation']['coma']['pauses_ge120ms'];period=p['by_punctuation']['punto']['pauses_ge120ms']
low=round(t['total_wpm']*.95);high=round(t['total_wpm']*1.05)
A={'name':'referencia','voice_first':'Algenib','voice_direction':f"Narración oral en español, cercana y clara. Reproduce la organización temporal medida, sin imitar la identidad de una persona: {low}–{high} palabras por minuto sobre el relato con sus pausas internas. Articula con fluidez, acelera en enumeraciones y afloja antes de la idea decisiva. En las comas que realmente separan cláusulas, deja aproximadamente {round(comma.get('median',.18)*1000)} ms; al cerrar una oración, aproximadamente {round(period.get('median',.25)*1000)} ms. No conviertas cada coma en un silencio. Reserva uno o dos descansos mayores para giros del relato. Varía el tono en palabras importantes y deja caer las conclusiones, manteniendo las preguntas abiertas. La energía crece en la idea clave y vuelve a una voz cercana. Respira discretamente sin añadir suspiros dramáticos. No copies el texto de la referencia.", 'targets':{'total_narration_wpm':[low,high],'f0_median_hz_measured':f['hz']['median'],'f0_p10_p90_span_semitones':f['p10_p90_span_semitones'],'comma_pause_ms_conditional':round(comma.get('median',.18)*1000),'sentence_pause_ms_conditional':round(period.get('median',.25)*1000),'long_pauses_ge800ms_per_minute_measured':p['long_ge800ms_per_minute'],'speech_p90_p10_db_measured':e['speech_p90_p10_db']},'note':'La altura absoluta describe esta grabación, no una identidad que deba clonarse. Respiraciones: usar solo la tasa de candidatos como hipótesis, no como conteo confirmado.'}
prof={'A':A,'B':prof['B']};(R/'perfiles-tts.json').write_text(json.dumps(prof,ensure_ascii=False,indent=2))
lines=[f'''# Voz de referencia y dirección para Malvinas

Entrega local del 3 de noviembre de 2026. **Cero llamadas a Gemini o a cualquier API de pago.** Se completó Whisper large-v3 local, con CPU int8, tres hilos, palabras alineadas y VAD desactivado. Los procesos de trabajo se invocaron con `nice -n 15`, en secuencia para la transcripción, el análisis acústico y la prueba de audio.

## Qué archivo se estudió

`Picker_Rickmansworth_88_mp3.mp3`: **{n(a['duration_s'],3)} s**, estéreo, 44,1 kHz. SHA-256: `{a['sha256']}`. Aunque el nombre sugería inglés, el detector dio **español, {n(tr['language_probability']*100)} %**. El contenido transcrito comienza «Si te digo Obama…» y desarrolla un relato biográfico y político. No se atribuye identidad al hablante por el nombre del archivo, ni se verifica aquí la veracidad histórica de ese relato.

[Transcripción TXT](transcripcion.txt) · [JSON por palabra](transcripcion.json) · [medidas completas](analisis.json) · [series acústicas](series-acusticas.npz). El idioma tiene probabilidad de detección; no es una tasa de acierto del texto. Las probabilidades de palabra tienen mediana {n(a['transcription_qc']['word_probability']['median'],3)}. No hubo corrección por escucha. Los tramos 20,64–22,26 s («Neal»), 167,98–169,16 s («aún más») y 205,52–207,70 s («cocina») quedan señalados para revisión en [incidencias-transcripcion.json](incidencias-transcripcion.json); no se sustituyeron por conjeturas. Se conservaron en la transcripción original las {len(a['transcription_qc']['discarded_short_words'])} palabras de duración menor de 20 ms; se excluyeron de las estadísticas.

## Perfil medido

| medida | resultado real |
|---|---:|
| Palabras léxicas contadas por expresión regular | {t['lexical_words']} |
| Ritmo sobre archivo completo | **{n(t['total_wpm'])} ppm** |
| Tiempo de palabras ASR; articulación sobre esos intervalos | {n(t['asr_word_span_s'])} s; **{n(t['articulation_wpm_word_spans'])} ppm** |
| Tiempo sin huecos ≥120 ms ni márgenes; ritmo resultante | {n(t['speech_time_excluding_ge120ms_gaps_s'])} s; {n(t['wpm_excluding_ge120ms_gaps'])} ppm |
| Actividad RMS, método independiente | {n(t['acoustic_activity_s'])} s; {n(t['wpm_acoustic_activity'])} ppm |
| Longitud de oración por puntuación ASR | {st(t['sentence_word_length'],' palabras')} |
| Duración de oración | {st(t['sentence_duration_s'],' s')} |
| Longitud de cláusula, corte en coma o fin | {st(t['clause_word_length'],' palabras')} |
| Huecos ≥120 ms | {p['count']}; {n(p['per_minute'])}/min; {n(p['total_s'])} s acumulados |
| Duración de esos huecos | {st(p['duration_s'],' s')} |
| Pausas ≥800 ms | {n(p['long_ge800ms_per_minute'])}/min |
| F0 | **{st(f['hz'],' Hz')}** |
| F0 p10–p90 en semitonos, referencia 100 Hz | {n(f['semitones_relative_100hz']['p10'])}–{n(f['semitones_relative_100hz']['p90'])} st; amplitud **{n(f['p10_p90_span_semitones'])} st** |
| Cierres medidos | bajan {f['endings']['baja']}; suben {f['endings']['sube']}; estables {f['endings']['estable']} |
| RMS global; pico de muestra; crest factor | {n(e['full_rms_dbfs'])} dBFS; {n(e['sample_peak_dbfs'])} dBFS; {n(e['crest_db'])} dB |
| RMS de frames dentro de palabras | {st(e['speech_frames_dbfs'],' dBFS')} |
| Dinámica RMS p90−p10 de habla | **{n(e['speech_p90_p10_db'])} dB** |
| Respiraciones candidatas / confirmadas | {br['candidate_count']} ({n(br['candidates_per_minute'])}/min) / **sin conteo confirmado** |

El pico positivo de la fuente se midió sobre decodificación float de MP3: los transitorios superan 0 dBFS. Se conservó ese valor real, sin recortar ni normalizar antes del análisis; los picos de la prueba procesada se controlaron por separado.

El recuento léxico trata una cifra escrita como un token: no equivale siempre al número de palabras pronunciadas. Los tres tiempos de habla son aproximaciones diferentes; los intervalos ASR incluyen articulación sorda y pueden absorber pausas pequeñas. El umbral RMS independiente fue {n(a['method']['active_threshold_dbfs'])} dBFS, con cierre de huecos de unos 80 ms. No se presenta como VAD de referencia.

### Pausas, puntuación y cambios de idea

Se mide el hueco entre el final de una palabra y el comienzo de la siguiente, **no silencio acústico puro**: puede contener aire o ruido. La puntuación la infiere Whisper; la relación es descriptiva, no causal.

| límite anterior | todos los límites: mediana (p10–p90), s | solo pausas ≥120 ms: mediana (p10–p90), s |
|---|---:|---:|''']
for c,label in [('coma','coma'),('punto','punto / interrogación / exclamación'),('dos_puntos_o_punto_coma','dos puntos / punto y coma'),('sin_puntuacion','sin puntuación')]:
 d=p['by_punctuation'][c];lines.append(f"| {label} | {st(d['all_boundaries'])} | {st(d['pauses_ge120ms'])} |")
lines.append(f"\nComo proxy explícito de «entre ideas», fin de oración con hueco ≥600 ms: {st(p['between_ideas_proxy']['duration_s'],' s')}. No todo punto supone un cambio de idea. Las pausas más largas fueron:\n")
for g in p['longest'][:6]:lines.append(f"- {time(g['start'])}–{time(g['end'])}: **{n(g['duration'])} s**, entre «{g['after'].strip()}» y «{g['before'].strip()}».")
lines.append('\n### Ritmo a lo largo del relato\n\nVentanas fijas de 20 s; la última puede ser más corta. No son duraciones sintéticas de escenas.\n\n| tramo | ppm | segundos en pausas ≥120 ms |\n|---|---:|---:|')
for v in t['rhythm_20s']:lines.append(f"| {time(v['start'])}–{time(v['end'])} | {n(v['wpm'],1)} | {n(v['pause_seconds'])} |")
lines.append(f'''
### Tono, énfasis y control de octavas

Praat por autocorrelación, 60–400 Hz, paso 10 ms, umbral de sonoridad 0,5. Frames sonoros: {n(f['voiced_fraction']*100)} %. Una segunda estimación 75–500 Hz dio mediana {n(f['alternative_hz']['median'])} Hz; en {f['comparison_common_frames']} frames comunes, el desacuerdo mayor de nueve semitonos fue {n(f['octave_disagreement_fraction']*100)} %. Tras revisar las gráficas, se excluyeron {f['rejected_frames']} frames en ráfagas de hasta 350 ms que superaban una octava sobre la mediana sonora de ±1,5 s. Se conservaron la F0 cruda y todos los eventos excluidos, sin inventar valores de reemplazo. La mediana cruda fue {n(f['raw_hz']['median'])} Hz. No se multiplicó ni dividió toda la curva por dos. Los picos grises del panorama muestran lo rechazado. Esta depuración es heurística y no confirma por escucha cada error.

El cierre compara la mediana de los últimos 350 ms sonoros con los 350 ms anteriores; «baja/sube» exige ±0,75 st. Delta final: {st(f['final_delta_semitones'],' st')}. La frase interrogativa puede terminar arriba; no se impone un descenso a todas.

Los picos se cruzaron con palabras. El delta local es p90 de RMS de la palabra menos la mediana del habla en un contexto de ±1,5 s: un candidato a énfasis, no una prueba perceptual por sí solo. Se separaron {len(e['transient_word_candidates'])} palabras coincidentes con picos superiores al p99 de habla +6 dB (alrededor de 35,3–36,2 y 39,8–40,2 s), posibles transitorios de mezcla. No se borraron del audio ni se atribuyeron automáticamente a intención verbal.

| tiempo | palabra | RMS p90 dBFS | delta local dB | F0 mediana Hz |
|---|---|---:|---:|---:|''')
for w in e['emphasis_candidates'][:10]:lines.append(f"| {time(w['start'])} | {w['word'].strip()} | {n(w['rms_p90_dbfs'])} | +{n(w['local_energy_delta_db'])} | {n(w['f0_median_hz']) if w['f0_median_hz'] else 'sorda'} |")
lines.append(f'''
### Respiración y aspereza

Detector exploratorio: ráfagas aperiódicas de 100–600 ms dentro de los huecos, menos energéticas que el habla, pero superiores al piso de ruido, y antes del siguiente inicio léxico. Exige planitud espectral >0,06 y ausencia de F0. Puede confundir fricativas, ambiente o compresión con respiración; también puede perder una exhalación sonora. **{br['candidate_count']} candidatos no significa {br['candidate_count']} suspiros reales**. Si no aparecen candidatos, tampoco demuestra que el hablante no respire. Los eventos completos están en `analisis.json → breaths.events`.

| descriptor | resultado |
|---|---:|
| Jitter local, ventanas sonoras de 250–600 ms | {st(rough['jitter_local_pct'],' %')} |
| Shimmer local, mismas ventanas | {st(rough['shimmer_local_pct'],' %')} |
| HNR | {st(rough['hnr_db'],' dB')} |
| Inclinación de log-potencia 300–4000 Hz | {st(rough['spectral_slope_db_octave_voiced'],' dB/octava')} |
| Energía 2–5 kHz respecto de 80–7800 Hz, habla sonora | {st(rough['band_2_5khz_db_fraction_voiced'],' dB')} |

Jitter/shimmer/HNR describen una narración comprimida en MP3 y ventanas breves de habla conectada. No son mediciones clínicas ni equivalen automáticamente a «voz áspera». La inclinación también depende de vocales, micrófono, EQ y códec. No se recomienda elevar deliberadamente jitter o bajar HNR para simular edad.

## Ocho frases anotadas

Las palabras citadas provienen exclusivamente del audio entregado. Las anotaciones son inferencias acústicas, pendientes de escucha. «Aire» siempre se rotula como candidato; no se inventan suspiros donde no están confirmados.
''')
chosen=json.loads((R/'frases-seleccionadas.json').read_text())
for i,s in enumerate(chosen,1):
 ww=[w for w in a['word_features'] if s['start']<=w['start']<s['end']]
 peak=max(ww,key=lambda w:w['local_energy_delta_db'])
 gg=next((g for g in p['events'] if abs(g['start']-s['end'])<.025),None)
 breaths=[b for b in br['events'] if s['start']-.6<=b['start']<=s['end']]
 lines.append(f"{i}. **{time(s['start'])}–{time(s['end'])}** · «{s['text']}»\n   {s['words']} palabras, {n(s['wpm'],1)} ppm dentro de la frase. Pico candidato en **{peak['word'].strip()}**, {time(peak['start'])}, +{n(peak['local_energy_delta_db'])} dB respecto del contexto. Cierre {s.get('final_contour','no estimable')} {('('+n(s['final_delta_semitones'])+' st)') if 'final_delta_semitones' in s else '(sin delta calculable)'}. "+(f"Hueco posterior {n(gg['duration'])} s." if gg else 'No hay hueco posterior ≥120 ms.')+(f" Aire candidato en {', '.join(time(b['start']) for b in breaths)}." if breaths else ' Sin suspiro confirmado en este tramo.'))
lines.append('''
## Gráficas

![Panorama de energía, F0 y ritmo](01-panorama.png)

![Pausas, puntuación, F0 y energía](02-distribuciones.png)

![Ocho frases anotadas](03-frases.png)

## Dos perfiles listos para dirigir TTS

Los datos estructurados están en [perfiles-tts.json](perfiles-tts.json). Los rangos de B son objetivos editoriales; no resultados de una voz Gemini que aún no se generó.

### A · referencia
''')
lines.append('`voice_direction`:\n\n> '+A['voice_direction'])
lines.append(f'''

Objetivo total: **{low}–{high} ppm**; F0 descriptiva {n(f['hz']['median'])} Hz, rango p10–p90 {n(f['p10_p90_span_semitones'])} st; conservar el contraste RMS medido de {n(e['speech_p90_p10_db'])} dB, con tolerancia orientativa ±2 dB tras masterizar. Pausas largas ≥800 ms: referencia {n(p['long_ge800ms_per_minute'])}/min. Las comas cortas se resuelven con puntuación; `<short pause>` solo en una frontera que necesita aire, no en todas las comas. `<long pause>` únicamente en los giros con espacio real. No trasladar cada hueco ASR como si fuera una instrucción exacta.

### B · veterano áspero, perfil elegido

`voice_direction`:

> {prof['B']['voice_direction']}

| control posterior | objetivo B |
|---|---|
| Ritmo total del relato, incluidas pausas internas | **100–115 ppm** |
| Articulación orientativa, sin grandes huecos | 130–150 ppm; verificar después, no forzar |
| F0 mediana / amplitud p10–p90 | 90–115 Hz / 6–9 st, si la tesitura natural de la voz lo permite |
| Coma que separa cláusulas / fin de oración | 180–300 ms / 350–600 ms |
| Pausa larga | 700–1100 ms, **4–6 por minuto** |
| Aire entre ideas | 4–6 eventos/min de 180–550 ms; **solo 1–2 suspiros/min**, incluidos en ese total |
| Momento clave, una sola vez | +2–4 st y +2–3 dB durante 2–4 s; volver al nivel contenido |
| Entrega de audio | −16 LUFS, pico verdadero ≤−1,5 dBTP; comprobar después de MP3 |

Puntuación y colocación:

- Comas para sintaxis y respiración pequeña. No separar «de» de una fecha, ni un nombre de su apellido, ni una cifra de su unidad.
- Punto al cerrar cada idea. `<short pause>` después del punto cuando haga falta 350–600 ms, sin sumar otra marca automáticamente en el mismo lugar.
- `<long pause>` antes de la **frase completa** con una fecha decisiva o un hecho duro. En Malvinas: antes de m03, m04, m06 y m07; cuatro en unos 56 s, aproximadamente 4,3/min. No antes de cada número incidental.
- Puntos suspensivos solo para una vacilación deliberada, una o dos veces por minuto como máximo. No apilar `... <short pause> <long pause>`.
- Respirar en los huecos entre ideas; el suspiro no cae encima de «Sheffield», «alcanzado» o «se rinde». El cierre se apaga con firmeza, sin melodrama.
- Mantener las palabras habladas limpias: ninguna instrucción entre paréntesis. Los objetivos numéricos son criterios de medición, no duración garantizada de una etiqueta.

La [copia marcada del guion](guion-marcado-B.json) conserva las 104 palabras y siete bloques de `assets/script.malvinas.json`; cambia dirección, puntuación/marcas e intensidad. No se editó el original. Las respiraciones externas quedan en un manifest, no en texto que pudiera leerse en voz alta.

### Integración real con el kit

`narrate.py.mark()` pasa `<short pause>`, `<long pause>` y `<breath>`; no valida un repertorio cerrado de marcas. La [documentación de Gemini 3.8](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/prompting-guide) también admite `<sigh>` y `<exhales>`. Su soporte documentado no equivale a fiabilidad comprobada en estas voces: **no se hizo síntesis**. Con 3.1 deben revisarse las marcas de su guía heredada, que usa corchetes.

Hallazgo de integración: `chunks()` agrega 130 ppm incluso si el diseño pide otra cosa; 3.8 toma el estilo del diseño y no usa directamente `script.voice_direction`. El fallback `director_prompt()` sí lo usa, pero también añade 130. Por eso pasar solo `--voice Algenib` no configura B.

[preparar-kit.py](preparar-kit.py) extrae únicamente constantes y la función pura `mark()` mediante AST; no importa TTS, no lee claves y no llama a la red. Genera los chunks `text/style` para `tts.gemini_annotated` con la dirección elegida y sin 130 ppm. [kit-chunks-B.json](kit-chunks-B.json) es la preparación concreta revisable. Para generar en otra tarea autorizada: usar estos chunks directamente, o adaptar allí el constructor del kit para que respete `voice_direction` y el ritmo del perfil. No pasarlos otra vez por `chunks()` porque volvería a agregar la contradicción. No se modifica ningún lanzador ni script del servidor.

```bash
nice -n 15 python3 -I work/voz-ref/preparar-kit.py \\
  work/voz-ref/guion-marcado-B.json --perfil B --kit /ruta/explainer-kit
```

**Duración:** 104 palabras a 100–115 ppm totales ocupan 54,3–62,4 s, con pausas internas. Si además se conservan 1,2 s de apertura y 6 s de cierre del kit, son **61,5–69,6 s**. Para 56 s totales con ese margen quedan 48,8 s de relato: aproximadamente **81–94 palabras** a ese ritmo. Otra opción es conservar las 104 palabras y reducir lead/tail; 56 s de relato equivalen a 111,4 ppm. No prometer 56 s sin medir una generación real y no acelerar la locución para encajar.

### Voces candidatas para B

Los caracteres del catálogo vienen de la [lista oficial de Gemini](https://aistudio.google.com/docs/speech-generation#voices); género de la [tabla oficial de Google Cloud](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#voice_options). «Firme» no garantiza F0 grave.

| prioridad | voz | motivo y reserva |
|---|---|---|
| **1** | **Algenib** | Masculina; carácter áspero. Es la primera hipótesis para textura rugosa sin apoyarse en distorsión. Verificar dicción, edad percibida y registro grave con escucha. |
| **2** | **Orus** | Masculina y firme; alternativa para sostener autoridad contenida. El grado de ronquera deberá comprobarse. |
| 3 | Alnilam | Masculina y firme; otra alternativa de cuerpo y aplomo. La profundidad no está garantizada por la etiqueta. |
| Condicionada | Gacrux | Carácter maduro, pero catalogada **femenina**: se incluye por el pedido, no como segunda opción masculina. No gastar una prueba de B en ella antes de comprobar su encaje. |

Sadaltager queda fuera de la primera ronda porque se busca diferenciar esta variante de las voces habituales. No se escucharon nuevas muestras del catálogo ni se generaron pruebas TTS.

## Suspiros y receta local

No hay una etiqueta cuya naturalidad esté **verificada aquí**. La alternativa controlable es reservar huecos, obtener una buena voz base y mezclar 4–6 recortes discretos por minuto, de los cuales solo 1–2 sean suspiros perceptibles. Cinco posiciones orientativas para Malvinas se describen en [respiraciones-plantilla.json](respiraciones-plantilla.json), sin segundos inventados. Alinear con el WAV real y omitir un cue si la voz ya respiró.

### SFXMint: fichas verificadas

Duración del archivo completo; no confundir con el recorte de 100–600 ms. Todas las fichas siguientes declaran **CC0 1.0**. Son metadatos y descripciones del proveedor, no aprobación por escucha. Solo `exhale-02` y `sigh-03` se descargaron para probar la mezcla; sus hashes coinciden con las fichas. Evidencia en [sfxmint-fichas.json](sfxmint-fichas.json), [búsquedas](sfxmint-busquedas.json) y [registro de dos descargas](sfx-descargas.json).

| ID y ficha | duración | licencia | pertinencia |
|---|---:|---|---|''')
notes={'exhale-02':'Exhalación relajada; primer candidato para aire bajo y discreto.','deep-inhale-02':'Inspiración profunda; requiere recorte y evitar aspecto de ejercicio de meditación.','breathing-02':'Respiración nasal al dormir; contiene un silbido, poco apropiada para un veterano despierto.','sigh-03':'Suspiro suave y triste; candidato secundario, sin convertir el relato en llanto.','sigh-02':'Alivio; usar solo donde ese sentido tenga cabida, no en una pérdida.','sigh-08':'Impaciencia; probablemente descartar para hechos dolorosos.','sigh-01':'Descripción de mujer suspirando; poco compatible con continuidad masculina.','sigh-07':'Descripción masculina, pero exasperada y fuerte; puede sonar actuada.'}
for entry in json.loads((R/'sfxmint-fichas.json').read_text())['sounds']:
 d=entry.get('data',{})
 if d:lines.append(f"| [{d['slug']}](https://sfxmint.com/sounds/{d['slug']}) | {n(d['duration_ms']/1000,3)} s | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | {notes.get(d['slug'],'Revisar por escucha.')} |")
lines.append(f'''

### Cómo aplicar los efectos

[fx-veterano.sh](fx-veterano.sh) acepta un WAV y un manifest opcional de respiraciones. Usa solo ffmpeg/ffprobe y Python estándar. EQ: filtro de graves bajo 70 Hz, +2,2 dB alrededor de 150 Hz, +1,2 dB en 3 kHz, corte sobre 7,5 kHz. Saturación suave `tanh` de factor 1,10. Sala breve con dos reflexiones de 29/43 ms a 3,5/2 %. Mezcla sin normalización automática de entradas; fundidos de aire de 35/80 ms. Sonoridad a −16 LUFS mediante dos pasadas y duración recortada a la entrada, sin estirar ni desplazar palabras.

El manifest fija `file`, `start`, `source_start`, `duration` y `target_rms_dbfs`. El script mide el RMS de cada recorte tras filtrarlo y ajusta su nivel, en lugar de asumir que todos los SFX vienen al mismo volumen. Punto de partida: unos 22 dB por debajo del RMS de la voz antes del master; ajustar luego por escucha. Inspiraciones y suspiros siempre dentro del hueco, con al menos 60 ms de margen respecto de palabras. No añadir un suspiro a cada frase.

```bash
bash work/voz-ref/fx-veterano.sh voz.wav voz-fx.wav respiraciones.json
# Sin manifest: aplica solo EQ, saturación, sala y master.
bash work/voz-ref/fx-veterano.sh voz.wav voz-fx.mp3
```

Los efectos dan color; **no crean una edad, un género o una ronquera natural** si la voz base no los tiene. No se baja el pitch artificialmente. No usar jitter ni ruido continuo como sustituto de interpretación.

## Prueba de 20 segundos, realizada

[Antes MP3](prueba-fx-antes.mp3) · [Después MP3](prueba-fx-despues.mp3) · [WAV procesado](prueba-fx-despues.wav) · [validación](prueba-fx-validacion.json).

Fuente: segundos **190–210** del archivo de referencia, únicamente para comparar, **no publicar**. Antes y después se masterizaron por separado y se igualó la sonoridad atenuando la versión más fuerte, sin aumentar picos. El master apunta a −16 LUFS; el límite de pico dejó esta prueba cerca de −17 LUFS, según la medición real de la tabla. Dos recortes CC0 equivalen a seis respiraciones por minuto: exhalación de 180 ms en 7,515 s del fragmento (197,515 s del original), dentro de 197,32–197,76 s; recorte de suspiro de 220 ms en 17,90 s (207,90 s), dentro de 207,70–208,20 s. Ambas ventanas tienen RMS al menos 8 dB inferior a la mediana de habla durante todo el recorte; no se usaron solo los huecos de Whisper. No se alargó el fragmento ni se superpusieron con palabras ASR. Los recortes parten de 0,90 s de `exhale-02` y 0,17 s de `sigh-03`, alrededor de los picos informados por el proveedor; **pendientes de escucha**.

| medición después de decodificar los MP3 | antes | después |
|---|---:|---:|
| Sonoridad integrada | {fx['before']['input_i']} LUFS | {fx['after']['input_i']} LUFS |
| Pico verdadero medido por loudnorm | {fx['before']['input_tp']} dBTP | {fx['after']['input_tp']} dBTP |
| LRA | {fx['before']['input_lra']} LU | {fx['after']['input_lra']} LU |
| Duración PCM decodificada | {n(fx['audio']['before']['decoded_duration_s'],3)} s | {n(fx['audio']['after']['decoded_duration_s'],3)} s |
| Muestras con amplitud ≥1 | {fx['audio']['before']['clipped_samples']} | {fx['audio']['after']['clipped_samples']} |
| Banda 80–250 / 500–1500 Hz | {n(fx['audio']['before']['low_80_250_to_mid_500_1500_db'])} dB | {n(fx['audio']['after']['low_80_250_to_mid_500_1500_db'])} dB |
| Banda 2–4 kHz / 500–1500 Hz | {n(fx['audio']['before']['presence_2000_4000_to_mid_500_1500_db'])} dB | {n(fx['audio']['after']['presence_2000_4000_to_mid_500_1500_db'])} dB |

![Comparación de energía y color espectral](04-prueba-fx.png)

La diferencia integrada final fue {n(fx['integrated_loudness_difference_lu'])} LU. Se atenuó el antes {n(-fx['comparison_gain_db']['before'])} dB para igualar la comparación. La prueba verifica ejecución, duración, mezcla y señal; no prueba que el resultado parezca un veterano ni que los suspiros encajen emocionalmente. Eso necesita escucha humana y una futura muestra de la voz candidata.

## Reproducibilidad y límites

1. `transcribir.py`: Python del proyecto con `-I`, modelo en caché local y `HF_HUB_OFFLINE=1`. Transcripción completada en {n(tr['elapsed_seconds'],1)} s, sin VAD. No editarlo mientras corre.
2. Análisis después de terminar Whisper: `/tmp/vozref-venv/bin/python work/voz-ref/analizar.py` con numpy/scipy/matplotlib locales y praat-parselmouth 0.4.7 en el venv desechable. Las fórmulas y eventos están guardados.
3. Prueba después del análisis: `/tmp/vozref-venv/bin/python work/voz-ref/probar-fx.py`. Requiere las dos descargas ya verificadas; no realiza red. Invocar ambos con `nice -n 15`, uno por vez.
4. `preparar-kit.py` solo produce datos de dirección; no sintetiza. Se validó que conserva palabras, IDs, siete bloques y fuentes del guion original, sin la instrucción fija de 130 ppm.

No se hizo clonación de identidad, generación TTS, escucha humana, validación histórica del relato de referencia ni publicación. No hay voz final de Malvinas, tiempos definitivos de sus anclas ni garantía de comportamiento de una marca. No se modificaron lanzadores, motor, assets originales ni herramientas del servidor. Las fuentes externas y el comportamiento real del kit están documentados en [FUENTES.md](FUENTES.md).
''')
(R/'VOZ-REFERENCIA.md').write_text('\n'.join(lines)+'\n')
summary=f'''# Entrega · voz de referencia

Estudio local completo sobre `Picker_Rickmansworth_88_mp3.mp3` ({n(a['duration_s'],2)} s). Whisper large-v3 detectó **español ({n(tr['language_probability']*100)} %)**: un relato sobre Obama; el nombre del archivo no acredita hablante ni idioma. Se guardaron [transcripción TXT](../voz-ref/transcripcion.txt) y [JSON por palabra](../voz-ref/transcripcion.json). Cero llamadas a Gemini o APIs de pago, sin lectura de claves.

Medidas principales:

- **{t['lexical_words']} palabras; {n(t['total_wpm'])} ppm totales; {n(t['articulation_wpm_word_spans'])} ppm sobre intervalos de palabras.**
- {p['count']} huecos ≥120 ms; mediana {n(p['duration_s']['median'])} s. Tras coma, mediana condicional {n(comma['median'])} s; tras fin de oración {n(period['median'])} s.
- **F0 mediana {n(f['hz']['median'])} Hz**, p10–p90 {n(f['hz']['p10'])}–{n(f['hz']['p90'])} Hz ({n(f['p10_p90_span_semitones'])} st). Contraste de octavas documentado.
- RMS global {n(e['full_rms_dbfs'])} dBFS; dinámica RMS de habla p90−p10 {n(e['speech_p90_p10_db'])} dB. Jitter, shimmer, HNR y proxies espectrales en [analisis.json](../voz-ref/analisis.json).
- {br['candidate_count']} respiraciones candidatas ({n(br['candidates_per_minute'])}/min), **sin confirmación por escucha**; no equivalen a suspiros comprobados.

[Informe completo, ocho frases anotadas y cuatro gráficas](../voz-ref/VOZ-REFERENCIA.md). [Perfiles A/B estructurados](../voz-ref/perfiles-tts.json): A reproduce organización temporal y energía; B busca voz masculina madura y áspera, **100–115 ppm**, cuatro a seis pausas largas por minuto y aire discreto. Probar primero **Algenib**, después **Orus**. Gacrux es madura pero el catálogo oficial la marca femenina; no es la segunda opción para B. No se generó ninguna de ellas.

El kit agrega 130 ppm y su ruta 3.8 no toma directamente `script.voice_direction`. Se entregan [guion marcado B](../voz-ref/guion-marcado-B.json), [preparador sin API](../voz-ref/preparar-kit.py) y [chunks listos](../voz-ref/kit-chunks-B.json) para evitar esa contradicción, sin editar el kit. Conservan las 104 palabras, siete bloques y fuentes originales. Con lead/tail del kit, 104 palabras al ritmo B darían **61,5–69,6 s**, no 56 s; reducir silencios de apertura/cierre o acortar el texto antes de sintetizar.

[fx-veterano.sh](../voz-ref/fx-veterano.sh) aplica EQ, saturación suave, sala breve, respiraciones opcionales en huecos medidos y master en dos pasadas. Prueba local de 20 s terminada: [antes](../voz-ref/prueba-fx-antes.mp3) y [después](../voz-ref/prueba-fx-despues.mp3), **{fx['before']['input_i']} / {fx['after']['input_i']} LUFS**, picos {fx['before']['input_tp']} / {fx['after']['input_tp']} dBTP, cero muestras recortadas y 20 s decodificados. Dos SFX CC0 descargados para esa prueba, con hashes verificados; los otros seis candidatos quedaron en metadatos. [Fichas y procedencia](../voz-ref/FUENTES.md), [manifest de prueba](../voz-ref/respiraciones-prueba.json) y [validación](../voz-ref/prueba-fx-validacion.json).

**Pendiente:** escucha humana de transcripción, eventos respiratorios, recortes y efecto; comprobar el carácter de las voces candidatas y las marcas en una síntesis futura autorizada. Los objetivos de B son dirección, no resultados medidos de Gemini. La prueba de referencia es solo comparativa y **no se publica**. No se alteraron lanzadores, scripts en ejecución, assets originales ni herramientas del servidor.
'''
(R.parent/'results'/'voz-referencia.md').write_text(summary)
print('Informe y entrega final escritos desde mediciones reales.')
