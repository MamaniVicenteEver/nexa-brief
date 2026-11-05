# Voces de Vida en escena

Cada hablante tiene un perfil en `../voices/<id>.json`, validado contra
`../schema/voice.schema.json`. Son propuestas (`approved: false`); la prueba técnica
con TTS y Whisper no equivale a una aprobación auditiva humana.

| ID | Voz Gemini propuesta | Ritmo objetivo |
| --- | --- | --- |
| narrador | Gacrux | 145 ppm |
| tomas | Achird | 155 ppm |
| nico | Fenrir | 160 ppm |
| valeria | Leda | 150 ppm |
| mama | Sulafat | 140 ppm |

El modelo fijado en los cinco perfiles es `gemini-3.8-flash-tts`. La herramienta no
cambia voces ni modelos ante errores. Puck está reservado para Leo y se rechaza.
No modifica su perfil, Cara a Cara ni los servicios.

## Generar

Desde la raíz del repositorio:

```sh
node nexa-brief-server/src/templates/sandbox/nodeaction/_vida/tools/voice.mjs \
  nexa-brief-server/src/templates/sandbox/nodeaction/vida-en-escena
```

Solo dos líneas (respeta caché):

```sh
node nexa-brief-server/src/templates/sandbox/nodeaction/_vida/tools/voice.mjs \
  nexa-brief-server/src/templates/sandbox/nodeaction/vida-en-escena --only L05,L06
```

Para regenerarlas aunque no hayan cambiado, agregar `--force`. Sin `--only`,
`--force` regenera todas. Un ID desconocido u opción inválida falla antes de TTS.
La carpeta de prototipo se resuelve desde el directorio actual.

Se requiere Node, ffmpeg, ffprobe y el Python del servidor (`.venv/bin/python`),
con numpy, jsonschema, faster-whisper y `large-v3` ya disponible en la caché del kit.
Whisper usa solo archivos locales para evitar descargas y comprobaciones remotas. `VIDA_PYTHON` permite indicar otro
intérprete con esas dependencias. El kit obtiene sus credenciales existentes;
no se copian ni se muestran. La rotación cambia únicamente la clave, conservando
siempre la voz y el modelo. Su estado de cuota se guarda en
`assets/audio/gemini-quota.json`, separado del estado compartido del kit.
La cuota diaria se detecta en el cuerpo completo de HTTP 429 antes del truncado
del cliente. HTTP 402 por saldo agotado también permite rotar a las otras claves
configuradas; esa clave se omite únicamente durante la ejecución actual para que
una recarga pueda funcionar en la siguiente invocación. No modifica facturación.

## Crear o ajustar un perfil

1. Copiar un JSON de `voices/` con un ID nuevo; debe coincidir con `script[].who`
   y con el nombre del archivo. Los IDs usan minúsculas, números, guion o guion bajo.
2. Elegir una voz prebuilt diferente de las otras y de Puck. Mantener el mismo
   modelo explícito para todo el elenco; un cambio de modelo es una decisión
   deliberada de perfiles, nunca un fallback de ejecución.
3. Describir edad, carácter, timbre y energía en `direction`, incluyendo
   «español latinoamericano neutro» y «no imitar a personas reales».
4. Definir `pace` en palabras/minuto, `lead` y `tail` en segundos. El ritmo es
   una indicación expresiva, no una duración impuesta. `postprocess.tempo`
   usa `atempo` (0,5–2, conservando tono); `pitch_preserved` debe ser `true`.
   `lufs: -16` y `true_peak_db: -1.5` mantienen niveles comparables.
5. Dejar `approved: false` y generar una línea real con `--only` para comprobar
   disponibilidad, identidad declarada, duración, nivel y transcripción. Si una
   voz o modelo no está disponible, elegir el reemplazo explícitamente en el
   perfil y documentar la prueba fallida y la nueva elección.

Cambiar texto, emoción o cualquier campo del perfil invalida el hash de la línea.
El caché también verifica SHA-256 del WAV y versión del pipeline: un clip ausente
o alterado se regenera. Los aciertos se publican después de pasar QC.

## Audio y tiempos

La herramienta importa `tts.py` en un trabajador temporal bajo
`/tmp/vida-voces-*`; se borra al terminar, fallar o recibir SIGINT/SIGTERM. No crea
Python bajo `src/` ni bytecode de los módulos importados. Invoca
`gemini_director` con la identidad del perfil y la emoción de la línea.

El postproceso conserva el tono, recorta silencios de los extremos (con margen
de consonantes de 40 ms) y elimina una región final aislada antes de normalizar
(ver «Ráfagas de cola»). Después agrega `lead`/`tail` y normaliza LUFS en dos pasadas. En frases muy cortas, si la medición final se aparta del objetivo, corrige
la ganancia con limitador de picos a 192 kHz y compensación de latencia, hasta tres pasadas
locales sin llamadas TTS. La salida es WAV PCM16 mono a 48 kHz.

Whisper usa el modelo del kit: `large-v3`, CPU int8, beam 5, VAD y tiempos por
palabra. Se carga una vez por ejecución. La transcripción cruda se compara contra
el guion sin distinguir mayúsculas, puntuación o tildes; los números se comparan
por su lectura en español. Se conservan las palabras reconocidas, sin sustituirlas
ni descartar extras para forzar un QC positivo. La limpieza de `transcribe.py`
no se aplica al QC porque puede reemplazar errores con palabras del guion.

Ante palabras faltantes, extras, tiempos inválidos, nivel fuera de tolerancia o
silencios interiores mayores de 1,2 s o `trailing_noise`, se regenera solo esa línea hasta dos veces
más (tres intentos totales), con idéntica voz/modelo. Las pausas largas solo se
aceptan en la posición de los puntos suspensivos del guion. Los fallos de API,
cuota o voz inválida se informan por línea con salida distinta de cero.

`assets/timing.json` conserva el contrato de PLAN §4: `version: 1`, `fps: 30`,
`lines.<id>` con `speaker`, `clip` relativo a `assets/`, `dur`, `words[{w,s,e}]`,
`rms`, `rmsHz: 100`, `text` y `qc`. Los tiempos son relativos al WAV; la RMS se
normaliza por el máximo del clip a 0–1. No contiene posiciones absolutas.
Con `--only` incluye también las otras líneas cuyo caché sigue siendo válido;
las pendientes o fallidas quedan fuera hasta generarse correctamente.

Cada `assets/audio/lines/<id>.json` guarda el hash, voz/modelo, perfil, emoción,
QC de cada intento, tiempo empleado y copia de sus tiempos. El registro
`assets/audio/voice-runs.jsonl` contiene duración total, aciertos de caché,
peticiones HTTP TTS reales (incluidos reintentos internos del cliente), generaciones,
reintentos por QC y errores. `tts_generations` cuenta intentos de síntesis; si el
cliente rota claves o reintenta HTTP, `tts_calls` puede ser mayor.

La herramienta no mezcla el diálogo ni modifica el episodio: esos pasos usan
el contrato de tiempos con las herramientas de sincronización. Whisper puede
confundir palabras de clips muy cortos y no verifica identidad auditiva, edad ni
calidad interpretativa; por eso los perfiles permanecen sin aprobación humana.


## Ráfagas de cola y medición sin red

En la reparación local del 2026-11-03, los 25 WAV existentes tenían una región
final de 130–150 ms, RMS de −9,25 a −7,92 dBFS, después de 220–1030 ms sin
actividad a −48 dBFS. El recorte por bordes retenía esa energía y `loudnorm` la
incluía en su cálculo. Whisper reconocía el texto, pero ese QC no detectaba ruido
sin palabras. No se dispone aquí del audio crudo para atribuir el origen a Gemini
con certeza; la presencia del defecto en los WAV finales sí está medida.

`postprocess()` mide bloques de 10 ms a −48 dBFS y une interrupciones de hasta
20 ms dentro de una región. Descarta una región **final**, menor de 400 ms,
separada de la anterior por al menos 120 ms sin actividad. Aplica una salida de
20 ms a la región anterior y retira la ráfaga antes de `loudnorm`. Es una regla de
energía, sin tiempos por ID: una palabra final muy corta tras una pausa podría
confundirse con un artefacto; el QC de palabras debe rechazar ese resultado.

Los tiempos de Whisper pueden ir adelantados respecto de la voz real: cortar al
fin de la última palabra trunca la sílaba final. La corrección local v2 usa una
única regla de **actividad conectada**: bloques de 10 ms con RMS >−48 dBFS,
uniendo huecos estrictamente menores de 150 ms. Con `we` = fin de la última
palabra, selecciona la región que contiene `we−100 ms`; si no existe, la primera
que empieza después de `we`. No hay tiempos ni límites de cola por ID. Si no
existe una región, el QC falla y la mezcla informa error.

`connected_activity()` del worker se usa tanto para la reparación local como
para `trailing_noise`; `connectedActivity()` exportada por `voice.mjs` aplica
la misma regla en el mezclador. Las pruebas contrastan ambos lenguajes, incluidos
huecos de 140/150 ms, selección posterior y actividad de más de 600 ms: esta
última se conserva y se señala para revisión humana, nunca se corta por duración.

`inspect()` añade `trailing_noise` (true indica fallo) y `trailing_noise_db`:
la máxima RMS de ventanas de 20 ms **después del fin de actividad conectada
+100 ms** debe ser menor de −45 dBFS. Usar el máximo evita diluir una ráfaga
con una cola larga de ceros. Sin palabras o sin actividad seleccionable, el
criterio falla. Participa en `qc.ok`, el bucle existente de tres intentos y la
validación del caché, sin cambiar voz/modelo. Una cola vocal real de 300 ms pasa;
una ráfaga aislada y un segmento sobrante tras 900 ms de silencio fallan.

La reparación de los 25 archivos existentes parte de los WAV y JSON originales,
conserva exactamente la cantidad de muestras y toda la actividad conectada sin
cambiar su amplitud. Conserva además 40 ms de cola natural, con fade de 15 ms al
final de esa cola; todo lo posterior se reemplaza por silencio digital. No se
aplica fade sobre la sílaba final. El sidecar solo actualiza `wav_sha256` y
`repair: {kept_until, removed: [[t0,t1],…], rule}`. `kept_until` es el final
conservado, incluida la cola; `removed` enumera las regiones activas eliminadas
(según bloques a −48 dBFS, puenteando huecos ≤20 ms para describir intervalos).
Sus QC, RMS y niveles históricos describen la generación original; las métricas
nuevas están en `vida-en-escena/review/audio/metricas.json`. No se reescribe
`timing.json`. L21 conserva voz hasta 1,24 s, y elimina el segmento ajeno al texto
de 2,1–3,13 s y la ráfaga posterior. En L06 también se retira actividad desconectada
a 2,89–3,21 s, además de la ráfaga, conforme a la misma regla.

`postprocess()` sigue con su regla de región final aislada <400 ms: antes de
Whisper no dispone de un ancla textual para aplicar la selección anterior.

La mezcla conserva `t0`, `t1` programado y la duración total. El recorte de audio
es solamente `min(duración real, trim.out explícito)`, con entrada de 10 ms y
salida de 25 ms. Se eliminó el recorte automático `we+350 ms`, que también podía
cortar voz real. `audio_t1` identifica el cierre efectivo del recurso; `t1`
sigue siendo el calendario del episodio. La normalización verifica LUFS y true
peak en el **MP3 decodificado**, con margen para la sobreoscilación del codificador.

Retirar artefactos cambia el nivel integrado: normalizar toda la voz de nuevo
puede subir la sílaba más de 0,5 dB aunque el WAV reparado sea idéntico. En mezclas
sin ambiente, el mezclador conserva además el RMS del WAV fuente en
`[we, fin de actividad]` mediante ganancia local suave: rampa de entrada de
50 ms **antes** de `we`, ganancia constante sobre la sílaba y retorno durante
los 40 ms de cola. No acorta audio ni cambia tiempos. Tras codificar, verifica
`final_syllable_rms_delta_db` (±0,5 dB), −16 LUFS ±0,5 y TP ≤−1,5 dB. Si hace
falta reajusta la ganancia del cuerpo y vuelve a proteger las sílabas desde PCM,
sin encadenar recodificaciones MP3 entre iteraciones. Si no cumple, informa error.
Las mezclas con ambiente mantienen el camino habitual de normalización, pues
la energía del ambiente no permite atribuir el RMS final solo a la voz.

`dialogue.mix.json` incluye por línea `last_word` y `connected_activity_end`
(en segundos del WAV fuente). El nombre histórico `tail_db_after_last_word`
se conserva por compatibilidad, pero ahora mide la máxima RMS de ventanas de
20 ms **desde el fin de actividad conectada hasta la siguiente línea o el fin
de la mezcla**. `non_speech_loud_windows` cuenta ventanas >−35 dBFS solamente
en esos tramos posteriores (y antes de la primera línea). No usa los huecos
entre palabras de Whisper para etiquetar ruido: sus tiempos adelantados daban
falsos positivos sobre voz real. La cola natural de 40 ms se incluye en estas
mediciones, sin esconder actividad aislada posterior. La referencia acústica
se obtiene del WAV fuente antes de normalizar; no se desplaza por la ganancia.

`boundary_jump` es el mayor salto de muestra en ±5 ms de `t0`, fin de actividad
+40 ms, `audio_t1` y `t1`. Si hay ambiente también se cuenta y queda marcado
`metrics_definition.ambient_included`. −240 dBFS representa silencio digital o
ausencia de muestras. Para la aceptación de la reparación, se comprueba aparte
la cola desde **fin de actividad+60 ms** hasta la siguiente línea en el MP3,
además de comparar el RMS de la sílaba entre `we` y el fin acústico con el original.

Si reaparece el ruido:

1. Respaldar los WAV y sus JSON; medir actividad conectada y cotejar el texto.
   No regenerar ni llamar a TTS sin autorización y saldo.
2. Revisar la forma de onda y escuchar original y reparación. Whisper no garantiza
   alineación exacta. No silenciar automáticamente energía vocal entre palabras.
3. Comprobar `repair`, SHA-256, muestras, conservación RMS de la sílaba final,
   silencio desde actividad+60 ms, LUFS, true peak del MP3 y saltos de límite.
   Actividad conectada más de 600 ms posterior a `we` se conserva para revisión.
4. Ejecutar las pruebas locales, sin TTS ni descargas:

   ```sh
   cd nexa-brief-server/src/templates/sandbox/nodeaction/_vida
   node --test
   ```

`test/audio.test.mjs` usa WAV sintéticos y ffmpeg local: comprueba ráfagas,
eliminación antes de normalizar, QC con texto correcto y colas vocales reales,
paridad de actividad, recortes explícitos, métricas y duraciones. Importar
`voice.mjs` desde pruebas no ejecuta su CLI ni inicializa el cliente TTS.

## Chasquido inicial

Los 25 WAV originales también contienen un impulso fuerte de 5 ms en
0,100–0,105 s, después del `lead`, con picos de 0,568–0,846. El fade de entrada
de 10 ms de la mezcla no lo alcanza. El recorte por energía lo conserva y puede
sesgar la normalización. Sin los crudos, su origen en la síntesis es una hipótesis.
Whisper marca la primera palabra a 0: ese tiempo tampoco sirve como inicio acústico.

`leading_click()` y su equivalente JS `leadingActivity()` usan bloques contiguos
de 5 ms con RMS >−48 dBFS. Un candidato es una primera región menor de 40 ms,
con RMS >−35 dBFS, seguida de otra región. Solo se elimina automáticamente si
el hueco hasta la siguiente región es ≥80 ms. La comprobación de intensidad
protege señales tenues: en L19, tras quitar el clic fuerte, hay una región de
5 ms a −46,71 dBFS con 110 ms hasta la siguiente actividad. No debe confundirse
con otro clic ni borrarse al ejecutar el detector otra vez.

`remove_leading_click()` sustituye por ceros desde la muestra 0 hasta el final
del clic +3 ms. No recorta ni desplaza muestras. La reparación existente de
colas permanece intacta. Los sidecars solo actualizan `wav_sha256` y añaden a
`repair` los campos `leading_click_removed` y `leading_rule`. En `postprocess()`
se aplica la misma función después de `atempo`, antes del recorte por bordes y
antes de medir `loudnorm`. La duración de los WAV existentes se conserva;
el recorte habitual de bordes sigue formando parte de futuras generaciones.

En `inspect()`, `leading_click` indica fallo de QC si el candidato es eliminable
por esa regla. Participa en `qc.ok`, reintentos y comprobación del caché.
`leading_click_candidate` y `leading_click_gap_ms` también informan candidatos
con hueco <80 ms: se conservan íntegros para no cortar consonantes cercanas.
Una voz inmediata o una región inicial de ≥40 ms tampoco se silencia.

En las mediciones estrictas de esta sesión, L21 es una excepción: tiene un
hueco de 70 ms hasta una señal de solo 10 ms a −46,00 dBFS. La voz fuerte llega
más tarde. No cumple los ≥80 ms literales; no se debe reducir ese límite global
para forzar la aceptación. El informe registra la resolución de este caso.

El mezclador añade `leading_energy_before_voice_db`, RMS integral en dBFS desde
el inicio de la línea hasta la primera región de voz. Se obtiene del WAV fuente, nunca de la primera
palabra de Whisper: bloques de 5 ms a −48 dBFS, unidos con huecos estrictamente
menores de 80 ms, con al menos 60 ms de actividad acumulada. El intervalo
puede incluir señales tenues y huecos del habla, sin silenciar ninguna muestra.
Contar actividad acumulada evita llamar voz a 5 ms de clic más 10 ms de señal
tenue separados por 70 ms, aunque su anchura total supere 60 ms.

`start_clicks` se calcula sobre el MP3 final decodificado: ventanas de 4 ms,
paso de una muestra (1/48000 s), energía media de cuadrados >30 veces la energía media de los
30 ms previos, RMS >−48 dBFS y >40 % de energía estrictamente sobre 4 kHz en la
DFT rectangular unilateral. Se excluyen las ventanas que intersectan una región
de voz de ≥60 ms: regiones anteriores, con ≥60 ms de actividad acumulada y huecos <80 ms,
medidas en el WAV fuente. Así una consonante corta seguida del cuerpo vocal
no se etiqueta como clic aislado. El comienzo nunca se toma de Whisper. En la función de detección sin líneas fuente, se usan
regiones de 5 ms a −48 dBFS, puenteando huecos ≤20 ms.

La resolución de muestra evita perder impulsos muy breves por la fase de
una grilla de 1 ms: en N03 esa grilla daba fracción espectral <40 %, mientras
una ventana desplazada una muestra supera 98 %. La DFT usa tablas
trigonométricas precalculadas, sin aproximar la ventana.

El piso absoluto evita llamar clic a una variación microscópica de silencio
MP3 o a errores de suma numérica. `start_click_details` registra tiempos, RMS,
razón de energías y fracción espectral; se cuentan ventanas, no eventos distintos.
El objetivo es cero. Una mezcla con ambiente se mide igualmente y declara
`ambient_included`; no se ocultan transitorios externos a la voz.

Las pruebas locales cubren eliminación antes de normalizar, voz inmediata,
huecos de 75/80/100 ms, duración inicial de 40 ms, igualdad exacta posterior,
paridad Python/JS, QC y detección espectral en MP3/PCM. Si reaparece: conservar
originales, medir primero, revisar candidatos cercanos sin silenciarlos, ejecutar
`node --test` y comprobar las tres mezclas. La validación numérica no sustituye
la escucha humana.
