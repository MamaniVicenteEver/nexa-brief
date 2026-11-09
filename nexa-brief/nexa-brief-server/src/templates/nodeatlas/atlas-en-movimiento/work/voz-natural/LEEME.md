# Comparación local de voz y pausas

Ocho MP3 cortos, sin regeneración ni llamadas a servicios. **No puedo oír estos archivos: la decisión de naturalidad, edad y textura es tuya.** Las métricas sirven para controlar tiempos, volumen y uniones, no para elegir una voz ganadora.

Abrí [el reproductor local](index.html). Compará primero «originales / suave» con «humanizadas / suave» dentro de cada voz; después probá «media» para decidir cuánto color tolerás. Escuchá especialmente la continuidad en «Ascensión», «pista» y «alcanzan», el paso de «Stanley» a «Una bomba», y el aire antes de «Super Étendard». Todos los archivos de la matriz tienen una sola exhalación añadida, en el mismo límite verbal; ninguno tiene un suspiro extra.

| MP3 | Qué escuchar | Duración s | PPM archivo / narración | Pausas acústicas: n; mediana / máxima ms | F0 mediana Hz | LUFS | Pico dBTP |
|---|---|---:|---:|---:|---:|---:|---:|
| [algenib-pausas-originales-madurez-suave.mp3](algenib-pausas-originales-madurez-suave.mp3) | Huecos originales; color mínimo, sin bajar tono. | 15.680 | 103.3 / 107.3 | 6; 393 / 884 | 92.0 | -16.00 | -1.81 |
| [algenib-pausas-originales-madurez-media.mp3](algenib-pausas-originales-madurez-media.mp3) | Huecos originales; tono −1,2 st y algo más de cuerpo/textura. | 15.680 | 103.3 / 107.4 | 6; 325 / 898 | 87.6 | -15.99 | -1.82 |
| [algenib-pausas-humanizadas-madurez-suave.mp3](algenib-pausas-humanizadas-madurez-suave.mp3) | Continuidad tras acortar huecos; color mínimo, sin bajar tono. | 13.982 | 115.9 / 120.9 | 6; 162 / 239 | 92.1 | -16.00 | -1.82 |
| [algenib-pausas-humanizadas-madurez-media.mp3](algenib-pausas-humanizadas-madurez-media.mp3) | Continuidad tras acortar huecos; tono −1,2 st y algo más de cuerpo/textura. | 13.982 | 115.9 / 120.9 | 6; 169 / 253 | 88.2 | -16.00 | -1.82 |
| [orus-pausas-originales-madurez-suave.mp3](orus-pausas-originales-madurez-suave.mp3) | Huecos originales; color mínimo, sin bajar tono. | 14.440 | 112.2 / 116.1 | 4; 299 / 946 | 114.6 | -16.00 | -1.73 |
| [orus-pausas-originales-madurez-media.mp3](orus-pausas-originales-madurez-media.mp3) | Huecos originales; tono −1,2 st y algo más de cuerpo/textura. | 14.440 | 112.2 / 116.0 | 4; 302 / 943 | 107.9 | -16.01 | -1.59 |
| [orus-pausas-humanizadas-madurez-suave.mp3](orus-pausas-humanizadas-madurez-suave.mp3) | Continuidad tras acortar huecos; color mínimo, sin bajar tono. | 13.475 | 120.2 / 124.7 | 3; 226 / 277 | 115.0 | -15.95 | -1.69 |
| [orus-pausas-humanizadas-madurez-media.mp3](orus-pausas-humanizadas-madurez-media.mp3) | Continuidad tras acortar huecos; tono −1,2 st y algo más de cuerpo/textura. | 13.475 | 120.2 / 124.7 | 3; 229 / 276 | 108.2 | -15.99 | -1.70 |

PPM de narración: 27 palabras / intervalo acústico entre márgenes, **incluye pausas internas**. PPM de archivo incluye márgenes. F0: Praat AC, 60–400 Hz, paso 10 ms, sin corrección manual de octavas. Contraste 75–500 Hz y percentiles en JSON; textura/saturación pueden producir errores. La discrepancia entre estimadores llega al 14,6 % de los frames comunes en Algenib humanizada/media: la F0 orienta, no certifica la bajada percibida. El detector de pausas final es −40 dBFS y ≥120 ms; las respiraciones y las reflexiones pueden dividir o estrechar el silencio detectado. Para evaluar la edición, usar también la tabla limpia siguiente, sin respiración ni cadena, y el plan exacto en JSON.

| WAV fuente → WAV con pausas humanizadas, sin cadena | Duración s antes → después | PPM narración antes → después | Mediana pausa ms antes → después | Máxima ms antes → después |
|---|---:|---:|---:|---:|
| Algenib | 15.680 → 13.982 | 107.6 → 121.2 | 578 → 182 | 932 → 550 |
| Orus | 14.440 → 13.475 | 116.1 → 124.8 | 514 → 230 | 947 → 550 |


La diferencia de duración entre el WAV TTS y el MP3 «crudo» previo es real: la normalización anterior ya altera ligeramente el silencio medido. El nuevo proceso siempre parte del WAV original. No acelera la articulación ni altera las palabras de las muestras.

## Referencias anteriores

Las cuatro originales siguen intactas. Las copias WAV de esta carpeta solo igualan volumen a −16 LUFS; no se añaden otros MP3. Compararlas con la matriz permite separar el tratamiento anterior del nuevo. «Originales» en la matriz describe **las pausas**, no audio sin cadena.

| Original entregada | Copia igualada para escucha | LUFS anterior |
|---|---|---:|
| [malvinas-algenib.mp3](../voz/muestras/malvinas-algenib.mp3) | [WAV −16 LUFS](malvinas-algenib-referencia-16LUFS.wav) | -17.12 |
| [malvinas-algenib-fx.mp3](../voz/muestras/malvinas-algenib-fx.mp3) | [WAV −16 LUFS](malvinas-algenib-fx-referencia-16LUFS.wav) | -16.35 |
| [malvinas-orus.mp3](../voz/muestras/malvinas-orus.mp3) | [WAV −16 LUFS](malvinas-orus-referencia-16LUFS.wav) | -17.05 |
| [malvinas-orus-fx.mp3](../voz/muestras/malvinas-orus-fx.mp3) | [WAV −16 LUFS](malvinas-orus-fx-referencia-16LUFS.wav) | -16.43 |


## Receta aplicada y controles

Cruces de 20 ms en el centro de cada silencio que se reduce, con al menos 45 ms de protección por borde; no se recorta sobre el límite ASR. Objetivo coma 180 ms, punto 280 ms, hueco no puntuado 140 ms; única pausa mayor, hasta 550 ms, antes del ataque al Sheffield. Se conserva cualquier pausa que ya sea menor. Un piso de aire coloreado continuo a −68 dBFS antes de la cadena evita el cero digital: es ruido sintético muy bajo, **no una grabación de sala real**.

Rubber Band mantiene tempo=1 y `formant=preserved`: suave 0 st; media −1,2 st. Filtro de graves 65 Hz, realce a 150 Hz de +1/+2 dB y a 3,5 kHz de +0,7/+1,1 dB. Saturación paralela tanh de 8/16 %, con compensación de ganancia, para aproximar color de cinta, sin emular un equipo concreto. De-esser ligero i=0,12/0,20, máximo 0,20; reflexiones a 13 y 23 ms, ganancias 0,020/0,010 o 0,035/0,018. No es una simulación física de sala.

Un fragmento de exhalación de 180 ms, con fundidos de 25 ms, a −46 dBFS antes del master, centrado en el hueco previo a «Super Étendard». Fuente `exhale-02.wav`, CC0 según la ficha SFXMint ya guardada en [descargas](../voz-ref/sfx-descargas.json). Se evita el archivo «sigh»; no se añadió una inhalación. No se puede garantizar por métricas que el fragmento resulte discreto o no se perciba jadeante: comprobarlo por escucha. Los cues exactos, hash y ganancias están en JSON.

Master de dos pasadas, corrección tras codificar desde WAV y verificación del MP3 decodificado. Diferencia máxima de la matriz: **0.06 LU**. Margen de true peak de −2,5 dBTP en el normalizador antes de la corrección final; los picos reales medidos se indican arriba. Cero muestras recortadas. Mayor diferencia entre muestras en las uniones limpias: **-57.3 dBFS**. Se revisan además extremos de cada fundido, residual de la señal conservada y entorno final de cada unión en [validacion-uniones.json](validacion-uniones.json).

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
