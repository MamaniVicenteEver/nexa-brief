# Whisper como fuente de verdad para narración, subtítulos y lectura

Fecha: 2026-09-19

## Decisión

La propuesta es correcta y queda implementada: primero se genera el audio
final con el proveedor TTS elegido; después se transcribe ese archivo con
Whisper; finalmente el render recibe los tiempos medidos para subtítulos,
contenido central y animaciones de lectura.

El orden es importante. Si se transcribe el guion antes de sintetizarlo, no se
conocen las pausas, la velocidad real, las repeticiones ni los cambios que el
motor TTS pueda introducir. El audio ya generado debe ser la referencia única.

## Flujo implementado

```text
guion aprobado
  -> VoicePort / proveedor TTS
  -> song.mp3 normalizado
  -> FasterWhisperAdapter
  -> segmentos + palabras + duración real
  -> reading_cues pedagógicos
  -> plantilla HyperFrames
  -> video con audio, subtítulos y contenido central coordinados
```

## Cambios en Academy

### Puerto y adapter

`src/core/ports/lyrics_port.py` ahora acepta `vad_filter` como opción del
tipo de audio. `FasterWhisperAdapter` mantiene el contrato hexagonal y no
expone detalles de Whisper al pipeline.

- Música: `vad_filter=False`, para no cortar tramos cantados.
- Voz hablada: `vad_filter=True`, para identificar silencios entre frases.
- Modelo del piloto: `large-v3`.
- CPU del piloto: `int8`.

### Servicio de aplicación

`src/academy/transcription.py` añade:

- `transcribe_voiceover`, que registra inicio, fin, duración y cantidad de
  segmentos y palabras;
- `build_timing_payload`, que conserva la respuesta de Whisper y resuelve
  frases pedagógicas contra palabras reales;
- `write_timing_payload`, que persiste el JSON auditable.

### Pipeline

`src/modules/voice_narrator.py` ejecuta la transcripción después de guardar
`05d_narracion_tts.json`. Escribe
`05e_narracion_transcripcion.json`, agrega `transcript_path` a
`JobArtifacts` y deja en `audio_meta` el número de segmentos y la duración
medida. Si el job ya trae audio externo, el mismo stage también lo transcribe
si todavía no tiene `transcript_path`.

## Resultado real del piloto

Archivo de audio:

`nexa-academy/nexa-academy-hyperframes/assets/english-04-fish-30s.mp3`

Duración real: `26.122 s`.

Whisper encontró seis segmentos:

| Inicio | Fin | Uso en la plantilla |
|---:|---:|---|
| 0.000 | 2.920 | Subtítulo de introducción |
| 3.300 | 7.460 | Explicación de `HELLO` |
| 7.800 | 10.640 | Ejemplo de `HELLO` |
| 10.880 | 15.000 | Explicación de `GOOD MORNING` |
| 15.440 | 20.080 | Explicación de `GOOD EVENING` |
| 20.360 | 25.920 | Instrucción de práctica |

Las tarjetas centrales no se posicionan por una duración supuesta: se generan
desde el inicio de la palabra que Whisper encuentra:

| Contenido | Inicio | Fin |
|---|---:|---:|
| `HELLO` | 3.300 | 10.880 |
| `GOOD MORNING` | 10.880 | 15.440 |
| `GOOD EVENING` | 15.440 | 26.122 |

## Por qué resuelve el desfase

Antes, la composición dividía manualmente el texto en ocho ventanas. Eso
funcionaba al comienzo, pero acumulaba error cuando la voz hablaba más rápido,
introducía una pausa o cambiaba la duración de una frase. Ahora cada ventana
parte de las posiciones reales del audio. Si cambia el modelo, la voz, el
idioma o el ritmo, el siguiente job vuelve a producir su propio JSON y el
render se adapta.

## Límites y siguiente evolución

Whisper entrega una medición muy buena, pero todavía requiere revisión humana
cuando la pronunciación o un nombre propio sea ambiguo. El servicio conserva
la probabilidad de cada palabra para que QA pueda marcar palabras de baja
confianza. La siguiente mejora será generar automáticamente las variables y
los atributos `data-start`/`data-duration` de HyperFrames desde este JSON, en
vez de actualizar una plantilla de piloto manualmente.

El sistema queda preparado para añadir un resaltado palabra por palabra: los
timestamps ya están en `segments[].words[]`; solo falta que la composición
visual decida si muestra palabra, grupo de palabras o segmento completo.
