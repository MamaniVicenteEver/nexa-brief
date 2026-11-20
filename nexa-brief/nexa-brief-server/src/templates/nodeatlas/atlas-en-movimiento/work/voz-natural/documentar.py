"""Genera gráficas, diagnóstico, receta y entrega desde mediciones.json. Sin red."""
import os
os.environ.update(OPENBLAS_NUM_THREADS='1',OMP_NUM_THREADS='1',MPLCONFIGDIR='/tmp/voz-natural-matplotlib')
import sys
from pathlib import Path
sys.path.append(str(Path.home()/'.local/lib/python3.10/site-packages'))
import json,re,importlib.util
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

R=Path(__file__).resolve().parent;ROOT=R.parent.parent
spec=importlib.util.spec_from_file_location('humanizar',R/'humanizar.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
d=json.loads((R/'mediciones.json').read_text())
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'white'})

def save(name):
    plt.savefig(R/name,dpi=160,bbox_inches='tight');plt.close()

refasr=[g['duration'] for g in d['reference_asr']['events']]
refac=[g['seconds'] for g in d['reference_same_acoustic_method']['pauses']]
fig,axes=plt.subplots(1,3,figsize=(15,5))
sets=[refasr]+[[g['seconds'] for g in m['asr_gaps']] for m in d['originals'][::2]]
axes[0].boxplot(sets,tick_labels=['Humana\n(n=65)','Algenib\n(n=3)','Orus\n(n=3)'],showfliers=False)
for i,vals in enumerate(sets):axes[0].scatter(np.full(len(vals),i+1),vals,s=12,alpha=.45)
axes[0].set(title='Huecos entre palabras ASR',ylabel='Duración (s)',ylim=(0,1.05))
axes[0].text(.03,.97,'Humana: un evento de 2,84 s fuera de escala',transform=axes[0].transAxes,va='top',fontsize=8)
sets=[refac]+[[g['seconds'] for g in d['edits'][v]['source']['pauses']] for v in ['algenib','orus']]+[[g['seconds'] for g in m['pauses']] for m in d['humanized_clean']]
axes[1].boxplot(sets,tick_labels=['Humana\n(n=9)','Alg.\nantes','Orus\nantes','Alg.\ndespués','Orus\ndespués'],showfliers=False)
for i,vals in enumerate(sets):axes[1].scatter(np.full(len(vals),i+1),vals,s=10,alpha=.45)
axes[1].set(title='Silencio acústico: mismo detector',ylim=(0,1.05))
axes[1].text(.02,.97,'−40 dBFS, ≥120 ms; después sin respiración ni FX',transform=axes[1].transAxes,va='top',fontsize=8)
for vi,v in enumerate(['algenib','orus']):
    ps=d['edits'][v]['pauses']
    for i,g in enumerate(ps):
        y=vi*6+i
        axes[2].plot([g['seconds'],g['humanized_slot']['target_s']],[y,y],color=['#397b9b','#ac5a39'][vi])
        axes[2].scatter([g['seconds']],[y],marker='o',color='#777777',s=25)
        axes[2].scatter([g['humanized_slot']['target_s']],[y],marker='>',color='#18805c',s=40)
ps=[g for v in ['algenib','orus'] for g in d['edits'][v]['pauses']]
ys=[i for i in range(len(d['edits']['algenib']['pauses']))]+[6+i for i in range(len(d['edits']['orus']['pauses']))]
axes[2].set_yticks(ys,[('A ' if y<6 else 'O ')+g['after'] for y,g in zip(ys,ps)])
axes[2].set(title='Plan de edición: gris → verde',xlabel='Duración del hueco (s)',xlim=(0,1.05))
fig.suptitle('Pausas: separar tiempos ASR de silencio acústico',fontsize=15);fig.tight_layout()
save('pausas-comparacion.png')

fig,axes=plt.subplots(2,2,figsize=(14,7))
for vi,v in enumerate(['algenib','orus']):
    x=h.decode(ROOT/'work/voz/muestras'/f'malvinas-{v}.wav',16000)
    y=h.decode(R/f'{v}-humanizada-limpia.wav',16000)
    ax=axes[vi,0]
    ax.plot(np.arange(len(x))[::80]/16000,x[::80]+1,color='#868686',lw=.5,label='Original +1')
    ax.plot(np.arange(len(y))[::80]/16000,y[::80]-.25,color='#18805c',lw=.5,label='Humanizada −0,25')
    for g in d['edits'][v]['pauses']:ax.axvspan(g['start'],g['end'],color='#e6b67d',alpha=.3)
    ax.set(title=v.title()+': señal y huecos originales',xlabel='Segundos',ylabel='Amplitud, desplazada');ax.legend(fontsize=8)
    ax=axes[vi,1]
    for e in d['edits'][v]['splices']:
        t=e['join_start_s'];a=int((t-.008)*16000);b=int((t+.028)*16000)
        ax.plot((np.arange(a,b)/16000-t)*1000,y[a:b],lw=.7,label=e['after'])
    ax.axvspan(0,20,color='#18805c',alpha=.12)
    ax.set(title=v.title()+': uniones dentro del silencio',xlabel='Milisegundos desde inicio del fundido',ylabel='Amplitud');ax.legend(fontsize=8)
fig.tight_layout();save('control-uniones.png')

lines=['# Diagnóstico de las cuatro muestras anteriores','',
'Detector acústico: −40 dBFS, mínimo 120 ms, une eventos separados por ≤40 ms. Se excluyen los márgenes. '+
'La asociación a puntuación usa la proximidad del final de la palabra anterior (hasta 650 ms); no es una alineación fonética. '+
'Se conserva el tiempo ASR sin corregir. Los originales procesados mantienen prácticamente las mismas pausas.','',
'Referencia humana: ASR mediana 180 ms (coma 140 ms; punto 200 ms). '+
f"Con el mismo detector acústico usado aquí: n={len(refac)}, mediana {np.median(refac)*1000:.0f} ms, máximo {max(refac)*1000:.0f} ms. "+
'La medida ASR y la acústica se muestran por separado, sin equipararlas. El detector absoluto solo encuentra nueve silencios '+
'en la referencia, frente a 65 huecos ASR: un hueco entre palabras puede contener ruido o fondo y no cruzar −40 dBFS. '+
'Por ello no se interpreta la distribución acústica de una mezcla humana como una meta exacta para una voz seca.','',
'![Distribuciones y plan de edición](pausas-comparacion.png)','']
for m in d['originals']:
    lines += ['## '+Path(m['file']).name,'',
              '| Silencio acústico (s) | Duración (ms) | Contexto asociado | Desplazamiento desde fin ASR (ms) |',
              '|---|---:|---|---:|']
    for g in m['context_pauses']:
        off=f"{g['offset_from_asr_end_s']*1000:.0f}" if 'offset_from_asr_end_s' in g else 'no asignable'
        lines.append(f"| {g['start']:.3f}–{g['end']:.3f} | {g['seconds']*1000:.0f} | {g['after']} → {g['before']} ({g['punctuation']}) | {off} |")
    lines+=['','Huecos ASR ≥120 ms (aire y silencio pueden estar absorbidos en las palabras):','']
    for g in m['asr_gaps']:lines.append(f"- {g['start']:.2f}–{g['end']:.2f} s: {g['seconds']*1000:.0f} ms; {g['after']} → {g['before']}.")
    lines+=['']
lines+=['## Decisiones de edición','',
'Solo se acorta un intervalo si sobran al menos 25 ms. Objetivos máximos: coma 180 ms, punto ordinario 280 ms, '+
'hueco sin puntuación 140 ms. Se conserva hasta 550 ms antes de «Super Étendard», único cambio dramático. '+
'No se alargan huecos que ya eran menores. Los bordes acústicos mantienen al menos 45 ms intactos y el cruce de 20 ms está en el centro.','',
'El hueco de Algenib dentro del intervalo ASR de «alcanzan» es ambiguo: puede ser vacilación o consonante débil. '+
'Su centro de muy baja amplitud se acorta conservando ambos extremos; comprobar esa palabra al escuchar. '+
'Las métricas no garantizan integridad fonética ni naturalidad perceptual.','',
'![Señales y control de las uniones](control-uniones.png)']
(R/'diagnostico.md').write_text('\n'.join(lines)+'\n')

direction='Un hombre maduro cuenta un recuerdo difícil en español latinoamericano. Su voz tiene cansancio y una aspereza leve, pero sigue siendo clara y cercana. Habla con continuidad, sobrio y sin solemnidad teatral.'
assert len(direction)<=350
script=json.loads((ROOT/'assets/script.malvinas.json').read_text())
chunks=[dict(id=s['id'],text=s['text'],style=direction,source_facts=s['source_facts'],event_date=s['event_date']) for s in script['segments']]
chunks[2]['text']='Desde Ascensión, un Vulcan bombardea la pista de Stanley. Una bomba la daña. Pero no la inutiliza por completo.'
h.dump(R/'chunks-natural.json',chunks)
counts=[len(re.findall(r'\b\w+\b',s)) for c in chunks for s in re.split(r'[.!?]+',c['text']) if s.strip()]
sample=chunks[2]['text']+' '+chunks[3]['text'];nw=len(re.findall(r'\b\w+\b',sample))
recipe=f'''# Receta para una futura prueba de Gemini

Preparación exclusivamente local. **No ejecutada: cero solicitudes y cero coste de generación nuevo.** No se verificaron por red nombres, disponibilidad, precio ni esquema actuales del proveedor. Este JSON es una receta editorial, no una petición lista para enviar.

[chunks-natural.json](chunks-natural.json) contiene siete bloques del guion, hechos y fechas sin cambios; m03 se reformula con oraciones de distinta longitud. No contiene etiquetas. Las frases tienen {min(counts)}–{max(counts)} palabras. La prueba futura puede limitarse a m03 y m04 ({nw} palabras; el audio de esta entrega conserva las 27 originales). Para evaluar continuidad, unir el texto de ambos bloques en una sola intervención, sin silencios insertados por bloque.

Dirección única ({len(direction)} caracteres):

> {direction}

Algenib y Orus son las dos candidatas ya disponibles en el material local. Algenib tenía F0 mediana cercana a 92 Hz; permite comprobar si su textura funciona cuando se libera el ritmo. Orus rondaba 115 Hz, con mayor amplitud tonal; permite decidir si una voz más firme y menos grave se siente más conversada. Ninguna se recomienda por naturalidad: el usuario rechazó las cuatro muestras anteriores. El posproceso no determina cuál síntesis futura será mejor.

La referencia humana tiene mediana de hueco ASR de 180 ms, frente a 340–500 ms en estas síntesis (solo tres huecos ASR por voz). El detector acústico, una medida distinta, encuentra medianas de 508–575 ms en los cuatro MP3 previos. Las comas humanas con pausa rondan 140 ms y sus puntos 200 ms; no todas las comas generan silencio. Por eso se elimina el pedido de pausa antes de cada bloque y se usa puntuación corriente, sin asignar duración a cada frase. El perfil anterior incluía unas mil letras de instrucciones y fijaba 100–115 ppm. La dirección breve describe a quien habla y su relación con el recuerdo; no manda números de ritmo ni una actuación paso a paso.

Evitar `<long pause>`, `<short pause>`, marcas de respiración, «suspira» literal, números de ppm, saltos de volumen/tono por palabra y varios estilos acumulados. Tampoco imponer una pausa dramática en cada bloque: en estas muestras llegó a casi un segundo después de «Stanley». No exigir el ritmo humano de 214 ppm: el objetivo editorial de esta tarea es más reposado, 110–140 ppm, y debe medirse tras la síntesis.

Con autorización futura para generar, comprobar primero el esquema y voces vigentes del proveedor y que la ruta del kit realmente use `style`. El estudio local advierte que otra ruta construía el estilo desde el diseño e inyectaba un ritmo fijo; no reutilizarla sin revisar. Enviar texto y dirección por separado según ese esquema. Comparar las mismas frases, una voz por vez, sin posproceso inicial, a volumen igualado. Escuchar y medir pausas, nombres propios, continuidad y finales; solo después elegir voz y color. Esta entrega no importa ni ejecuta clientes de Gemini.

Base de decisiones: [diagnóstico](diagnostico.md), [mediciones](mediciones.json), [perfil previo](../voz-ref/perfiles-tts.json), [estudio humano](../voz-ref/VOZ-REFERENCIA.md). No se alteraron los guiones existentes ni sus anclas.
'''
(R/'receta-gemini.md').write_text(recipe)

intro='''# Comparación local de voz y pausas

Ocho MP3 cortos, sin regeneración ni llamadas a servicios. **No puedo oír estos archivos: la decisión de naturalidad, edad y textura es tuya.** Las métricas sirven para controlar tiempos, volumen y uniones, no para elegir una voz ganadora.

Abrí [el reproductor local](index.html). Compará primero «originales / suave» con «humanizadas / suave» dentro de cada voz; después probá «media» para decidir cuánto color tolerás. Escuchá especialmente la continuidad en «Ascensión», «pista» y «alcanzan», el paso de «Stanley» a «Una bomba», y el aire antes de «Super Étendard». Todos los archivos de la matriz tienen una sola exhalación añadida, en el mismo límite verbal; ninguno tiene un suspiro extra.

| MP3 | Qué escuchar | Duración s | PPM archivo / narración | Pausas acústicas: n; mediana / máxima ms | F0 mediana Hz | LUFS | Pico dBTP |
|---|---|---:|---:|---:|---:|---:|---:|
'''
rows=[]
for m in d['variants']:
    name=Path(m['file']).name
    what=('Huecos originales; ' if m['pause_mode']=='originales' else 'Continuidad tras acortar huecos; ')+('color mínimo, sin bajar tono.' if m['maturity']=='suave' else 'tono −1,2 st y algo más de cuerpo/textura.')
    p=m['pause_stats_s']
    rows.append(f"| [{name}]({name}) | {what} | {m['duration_s']:.3f} | {m['ppm_file']:.1f} / {m['ppm_narration']:.1f} | {p['n']}; {p['median']*1000:.0f} / {p['max']*1000:.0f} | {m['f0_hz']['median']:.1f} | {m['lufs']:.2f} | {m['true_peak_dbtp']:.2f} |")
tail=f'''

PPM de narración: 27 palabras / intervalo acústico entre márgenes, **incluye pausas internas**. PPM de archivo incluye márgenes. F0: Praat AC, 60–400 Hz, paso 10 ms, sin corrección manual de octavas. Contraste 75–500 Hz y percentiles en JSON; textura/saturación pueden producir errores. La discrepancia entre estimadores llega al 14,6 % de los frames comunes en Algenib humanizada/media: la F0 orienta, no certifica la bajada percibida. El detector de pausas final es −40 dBFS y ≥120 ms; las respiraciones y las reflexiones pueden dividir o estrechar el silencio detectado. Para evaluar la edición, usar también la tabla limpia siguiente, sin respiración ni cadena, y el plan exacto en JSON.

| WAV fuente → WAV con pausas humanizadas, sin cadena | Duración s antes → después | PPM narración antes → después | Mediana pausa ms antes → después | Máxima ms antes → después |
|---|---:|---:|---:|---:|
'''
for i,v in enumerate(['algenib','orus']):
    a=d['edits'][v]['source'];b=d['humanized_clean'][i]
    tail+=f"| {v.title()} | {a['duration_s']:.3f} → {b['duration_s']:.3f} | {a['ppm_narration']:.1f} → {b['ppm_narration']:.1f} | {a['pause_stats_s']['median']*1000:.0f} → {b['pause_stats_s']['median']*1000:.0f} | {a['pause_stats_s']['max']*1000:.0f} → {b['pause_stats_s']['max']*1000:.0f} |\n"
tail+='''

La diferencia de duración entre el WAV TTS y el MP3 «crudo» previo es real: la normalización anterior ya altera ligeramente el silencio medido. El nuevo proceso siempre parte del WAV original. No acelera la articulación ni altera las palabras de las muestras.

## Referencias anteriores

Las cuatro originales siguen intactas. Las copias WAV de esta carpeta solo igualan volumen a −16 LUFS; no se añaden otros MP3. Compararlas con la matriz permite separar el tratamiento anterior del nuevo. «Originales» en la matriz describe **las pausas**, no audio sin cadena.

| Original entregada | Copia igualada para escucha | LUFS anterior |
|---|---|---:|
'''
for m in d['originals']:
    name=Path(m['file']).name;norm=Path(name).stem+'-referencia-16LUFS.wav'
    tail+=f"| [{name}](../voz/muestras/{name}) | [WAV −16 LUFS]({norm}) | {m['lufs']:.2f} |\n"
tail+=f'''

## Receta aplicada y controles

Cruces de 20 ms en el centro de cada silencio que se reduce, con al menos 45 ms de protección por borde; no se recorta sobre el límite ASR. Objetivo coma 180 ms, punto 280 ms, hueco no puntuado 140 ms; única pausa mayor, hasta 550 ms, antes del ataque al Sheffield. Se conserva cualquier pausa que ya sea menor. Un piso de aire coloreado continuo a −68 dBFS antes de la cadena evita el cero digital: es ruido sintético muy bajo, **no una grabación de sala real**.

Rubber Band mantiene tempo=1 y `formant=preserved`: suave 0 st; media −1,2 st. Filtro de graves 65 Hz, realce a 150 Hz de +1/+2 dB y a 3,5 kHz de +0,7/+1,1 dB. Saturación paralela tanh de 8/16 %, con compensación de ganancia, para aproximar color de cinta, sin emular un equipo concreto. De-esser ligero i=0,12/0,20, máximo 0,20; reflexiones a 13 y 23 ms, ganancias 0,020/0,010 o 0,035/0,018. No es una simulación física de sala.

Un fragmento de exhalación de 180 ms, con fundidos de 25 ms, a −46 dBFS antes del master, centrado en el hueco previo a «Super Étendard». Fuente `exhale-02.wav`, CC0 según la ficha SFXMint ya guardada en [descargas](../voz-ref/sfx-descargas.json). Se evita el archivo «sigh»; no se añadió una inhalación. No se puede garantizar por métricas que el fragmento resulte discreto o no se perciba jadeante: comprobarlo por escucha. Los cues exactos, hash y ganancias están en JSON.

Master de dos pasadas, corrección tras codificar desde WAV y verificación del MP3 decodificado. Diferencia máxima de la matriz: **{d['validation']['lufs_spread']:.2f} LU**. Margen de true peak de −2,5 dBTP en el normalizador antes de la corrección final; los picos reales medidos se indican arriba. Cero muestras recortadas. Mayor diferencia entre muestras en las uniones limpias: **{d['validation']['max_splice_delta_dbfs']:.1f} dBFS**. Se revisan además extremos de cada fundido, residual de la señal conservada y entorno final de cada unión en [validacion-uniones.json](validacion-uniones.json).

## Reproducir y ajustar

Desde la raíz de la plantilla:

```sh
nice -n 15 ~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -I work/voz-natural/humanizar.py
nice -n 15 ~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -I work/voz-natural/validar.py
nice -n 15 ~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -I work/voz-natural/documentar.py
```

`humanizar.py --help` permite modificar tono suave/media (0 a −2 st) y mezcla de saturación (0 a 0,30); al repetir sobrescribe solo los productos de esta carpeta. Dependencias locales reutilizadas: NumPy/SciPy del proyecto, Praat de `/tmp/vozref-venv/lib/python3.10/site-packages`, Matplotlib del sitio de usuario y FFmpeg 4.4.2. No hubo instalaciones ni descargas. Si se elimina ese venv temporal, habrá que restituir Praat para reproducir el análisis; los audios entregados no dependen de él para reproducirse.

Detalles: [diagnóstico y lista de pausas](diagnostico.md), [mediciones y recetas exactas](mediciones.json), [futura regeneración no ejecutada](receta-gemini.md), [chunks sin etiquetas](chunks-natural.json), [registro](proceso.log).

## Límites

No hay evaluación auditiva subjetiva ni nueva transcripción: se reutilizan las 27 palabras y los tiempos ASR existentes. Las muestras duran unos quince segundos y no validan un relato completo. El posproceso acorta huecos y añade color, pero no cambia intención, acento ni la prosodia interna ya sintetizada. Edad, aspereza agradable, respiración creíble, pronunciación y ausencia perceptual de cortes quedan para el usuario. No se extrapola la selección a un minuto ni se actualizan anclas de la narración.
'''
(R/'LEEME.md').write_text(intro+'\n'.join(rows)+tail)

html='''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voz natural: comparación</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px;background:#f8f8f5;color:#20272a}h1{font-size:28px}article{background:white;border:1px solid #dce1df;border-radius:10px;padding:16px;margin:14px 0}audio{width:100%}h2{font-size:18px}p{line-height:1.5}a{color:#24654e}</style><h1>Voz y pausas: ocho comparaciones</h1><p>Volumen igualado a −16 LUFS. Primero compará pausas originales y humanizadas con madurez suave; después probá la media. La naturalidad y el carácter de voz quedan para tu escucha.</p><p><a href="LEEME.md">Medidas y guía de escucha</a> · <a href="pausas-comparacion.png">Gráfica de pausas</a></p>'''
for m in d['variants']:
    name=Path(m['file']).name
    html+=f'<article><h2>{m["voice"].title()} · pausas {m["pause_mode"]} · madurez {m["maturity"]}</h2><audio controls preload="none" src="{name}"></audio><a href="{name}" download>Descargar MP3</a></article>'
html+='<h2>Referencias anteriores, volumen igualado</h2>'
for m in d['originals']:
    name=Path(m['file']).stem+'-referencia-16LUFS.wav'
    html+=f'<article><h2>{Path(m["file"]).stem}</h2><audio controls preload="none" src="{name}"></audio></article>'
html+='</html>'; (R/'index.html').write_text(html)

result='''# Voz natural: entrega completa

Se generaron localmente **ocho MP3**: Algenib/Orus × pausas originales/humanizadas × madurez suave/media. Cero llamadas a Gemini u otras APIs, cero descargas. Las muestras originales se conservaron y verificaron por SHA-256.

[Reproductor con las ocho variantes](../voz-natural/index.html) · [Guía de escucha y tabla completa](../voz-natural/LEEME.md).

| WAV original → humanizado sin cadena | Duración s | PPM de narración | Mediana / máxima de pausas ms |
|---|---:|---:|---:|
'''
for i,v in enumerate(['algenib','orus']):
    a=d['edits'][v]['source'];b=d['humanized_clean'][i]
    result+=f"| {v.title()} | {a['duration_s']:.2f} → {b['duration_s']:.2f} | {a['ppm_narration']:.1f} → {b['ppm_narration']:.1f} | {a['pause_stats_s']['median']*1000:.0f}/{a['pause_stats_s']['max']*1000:.0f} → {b['pause_stats_s']['median']*1000:.0f}/{b['pause_stats_s']['max']*1000:.0f} |\n"
result+=f'''

Se midieron las cuatro muestras previas y se documentó cada pausa con su contexto de puntuación y el desfase respecto de Whisper. La referencia humana tiene huecos ASR de mediana 180 ms; se separó esa medida del silencio acústico y se volvió a medir la referencia con el mismo detector. [Diagnóstico y listas](../voz-natural/diagnostico.md) · [Gráfica](../voz-natural/pausas-comparacion.png).

El script [humanizar.py](../voz-natural/humanizar.py) acorta el centro de los silencios con cruces de 20 ms, protege al menos 45 ms por borde y mantiene aire continuo muy bajo. Conserva una sola pausa mayor, antes de «Super Étendard». Las cadenas ofrecen 0/−1,2 semitonos con formantes preservados, EQ discreta, saturación ajustable, de-esser, reflexiones cortas y una exhalación CC0 de 180 ms por muestra. No se acelera la articulación. Hay cuatro copias WAV de las referencias anteriores a −16 LUFS, además de enlaces a sus originales intactas.

Los ocho MP3 se verificaron tras decodificarlos: objetivo −16 LUFS, diferencia máxima **{d['validation']['lufs_spread']:.2f} LU**, cero muestras recortadas y picos controlados. Las tasas humanizadas quedan en 110–140 ppm. Las uniones limpias tienen saltos máximos de **{d['validation']['max_splice_delta_dbfs']:.1f} dBFS**. Se inspeccionaron las dos gráficas y el control del entorno de las uniones finales; [mediciones](../voz-natural/mediciones.json), [validación de uniones](../voz-natural/validacion-uniones.json) y [registro](../voz-natural/proceso.log) permiten revisar el proceso.

La futura regeneración queda preparada, **sin ejecutarla**, en [receta-gemini.md](../voz-natural/receta-gemini.md) y [chunks-natural.json](../voz-natural/chunks-natural.json): siete bloques con puntuación natural, frases de longitud variada, dirección única breve y motivos medidos para volver a comparar Algenib/Orus. El texto futuro de m03 se reformula; los MP3 actuales conservan las 27 palabras originales.

No puedo oír: no se certifican naturalidad, edad, aspereza agradable, pronunciación ni ausencia perceptual de cortes o jadeos. El hueco dentro del intervalo ASR de «alcanzan» en Algenib requiere atención al escuchar. Las métricas y las gráficas no sustituyen esa decisión. Se reutilizaron transcripciones locales; no hay nueva alineación fonética. No se modificaron lanzadores, scripts en ejecución, guiones, anclas ni archivos fuera de `work/voz-natural/` y esta entrega. Audio procesado en secuencia con `nice -n 15`, hilos limitados y sin nuevos paquetes; QA y documentación se ejecutaron con un máximo de dos procesos de trabajo simultáneos.
'''
(ROOT/'work/results/voz-natural.md').write_text(result)
print('Documentación y gráficas generadas.')
