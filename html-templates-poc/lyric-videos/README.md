# whisper-test — transcripción de canciones a JSON con timestamps por palabra

`transcribe.py` toma un archivo de audio y genera un JSON con la letra
transcrita, con el tiempo exacto (segundo) de **cada palabra**. Ese JSON es
lo que consumen las plantillas `neon-letras*.html` de esta carpeta para
sincronizar el texto con la canción.

Usa [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (Whisper de
OpenAI, reimplementado para correr más rápido en CPU/GPU).

## Requisitos

Ya están instalados en el entorno virtual `.venv/` de esta carpeta — no hace
falta instalar nada para usarlo tal cual está. Si se arma desde cero:

```bash
uv venv
uv pip install faster-whisper
```

## Uso

```bash
# forma más simple — el nombre de salida se genera solo a partir del archivo
.venv/bin/python transcribe.py "cancion.mp3"

# nombre de salida controlado por vos: genera lyrics-kevin-kaarl.json
.venv/bin/python transcribe.py "cancion.mp3" --name kevin-kaarl

# ruta de salida explícita (ignora --name)
.venv/bin/python transcribe.py "Yasuha - Flyday Chinatown.mp3" -o lyrics-yasuha-flyday-chinatown.json
```


.venv/bin/python transcribe.py "cancion.mp3" -o salida-custom.json


Con `--name`/`-n` el archivo de salida siempre es `lyrics-<name>.json` — así
podés tener varias canciones transcritas en la misma carpeta sin que se
pisen entre sí y sabiendo cuál es cuál a simple vista:

```
lyrics-remix-hola.json
lyrics-kevin-kaarl-colapso.json
lyrics-bruses-dueles-tan-bien.json
```

Si no pasás `--name`, se genera un slug automático a partir del nombre del
archivo (normaliza acentos y hasta fuentes "elegantes" de redes sociales:
`𝙆𝙚𝙫𝙞𝙣 𝙆𝙖𝙖𝙧𝙡.mp3` → `lyrics-kevin-kaarl.json`).

### Otras opciones

| Flag | Para qué |
|---|---|
| `--model` | Tamaño del modelo: `tiny/base/small/medium/large-v3` (default `large-v3`, el más preciso) |
| `--device` | `cpu` o `cuda` si tenés GPU (default `cpu`) |
| `--compute-type` | `float32` (más preciso, default) o `int8` (más rápido, menos preciso) |
| `--vad` | Reactiva el filtro de detección de voz — **no usar para canciones**, ver abajo |
| `--language` | Código de idioma (default `es`) |

## Por qué está afinado así (y no con los valores por defecto)

Al transcribir la primera canción (`remix-hola.mp3`, 4:11 de duración) con
los parámetros por defecto, la transcripción se cortaba a los 3:05 — 66
segundos de letra real se perdían. Con los ajustes de este script, la
misma canción quedó cubierta de punta a punta (hueco final de 1.1s, solo
el fade-out).

La causa: el filtro **VAD** (Voice Activity Detection, detector de si hay
voz o silencio) viene afinado para **voz hablada**, no para **voz cantada**
sobre una base instrumental fuerte, con reverb o ad-libs. Clasificaba
tramos con voz real como "silencio" y los descartaba antes de que Whisper
los viera — incluso relajando sus parámetros. La solución fue **desactivar
el VAD por completo** (`vad_filter=False`, el default de este script) y
dejar que el propio modelo decida.

Por eso `--vad` existe como flag para **reactivarlo**: si algún día transcribís
un audio de voz hablada limpia (un podcast, una entrevista), el VAD sí ayuda
ahí y podés pasarlo. Para canciones, dejarlo desactivado (el default).

Otros ajustes menores: escalera de temperatura en vez de fija (reintenta a
otra temperatura si un pasaje difícil falla en vez de descartarlo),
`condition_on_previous_text=False` (un tramo raro no arrastra un error al
resto de la canción), y umbrales de silencio/alucinación relajados
(toleran coros repetidos y voz baja sin descartarlos).

## Formato de salida

```json
{
  "metadata": {
    "file": "cancion.mp3",
    "name": "kevin-kaarl-colapso",
    "language": "es",
    "audio_duration_sec": 251.6,
    "model": "large-v3",
    "compute_type": "float32",
    "vad_filter": false
  },
  "segments": [
    {
      "id": 1, "start": 3.24, "end": 8.22, "text": "...",
      "avg_logprob": -0.22, "no_speech_prob": 0.13,
      "words": [
        { "word": "...", "start": 3.24, "end": 3.76, "probability": 0.76 }
      ]
    }
  ]
}
```

`words[].start` es el timestamp que consumen las plantillas `neon-letras*.html`
para encender cada palabra en su momento exacto.

## Costo aproximado

Con `large-v3` + `float32` + sin VAD, una canción de ~4 minutos tarda
**~9-10 minutos** en transcribirse en CPU. Es más lento que los valores por
defecto (que usan `int8` + VAD activado), pero es lo que garantiza cobertura
completa y máxima precisión. Si el tiempo es un problema, probar
`--compute-type int8` primero para iterar rápido, y `float32` solo para la
pasada final.

## Notas

- El JSON generado contiene la letra transcrita de la canción — no lo subas
  a un repositorio público ni lo compartas si la canción tiene derechos de
  autor; es material de trabajo interno para sincronizar las plantillas.
- Si `transcribe.py` avisa "sigue quedando un hueco al final sin letra
  detectada", probá bajar `no_speech_threshold` a mano en el script, o
  revisar si ese tramo es genuinamente instrumental.
