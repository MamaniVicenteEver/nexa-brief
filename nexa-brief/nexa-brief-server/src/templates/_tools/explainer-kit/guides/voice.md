# Guía · voz, transcripción y tiempos

Resultado: `assets/song.mp3` (narración masterizada), `assets/lyrics.json` (palabra → segundo) y
`work/narration.qc.json` (control). **No hace falta intervenir a mano**: el script ya trae la
dirección vocal; el agente solo ejecuta, lee el control y decide si aceptar.

## 1. Cómo funciona (automático)

`kit.py voice <id>` lee `script.json` + la sección `voice` de `designs/<diseño>/design.json`:

| qué | de dónde |
|---|---|
| voz | `voice.voice` del diseño (binary: **Charon**, rough: **Sadaltager**) o `"voice"` en script.json |
| modelos (en orden) | `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → `gemini-3.1-flash-tts-preview` |
| claves | `GEMINI_API_KEY`, `GEMINI_API_KEY1…6` de los `.env`; si una agota su cuota diaria se marca en `.state/` y se usa la siguiente |
| estilo por segmento | base del diseño + dirección del `tone` + intensidad (`tools/narrate.py`, tabla `STYLE`) |
| ritmo | `<short pause>` entre oraciones en tonos lentos, `<long pause>` antes de silencio/duelo, `<breath>` antes de clímax/urgencia |
| silencios | 1,2 s al inicio (se arma el título) y 6 s al final (cierre: gracias por ver / suscríbete) |
| volumen | -16 LUFS (estándar de redes), mp3 192 kbps |

Primero intenta **un solo pedido** (voz idéntica de punta a punta). Si el servidor falla, lo parte
en 3 y los une con 0,35 s. Cada intento cuenta para la cuota: no relanzar sin motivo.

## 2. Control de calidad (leer `work/narration.qc.json`)

- `faltan` / `sobran`: diferencias entre guion y lo que se escuchó (Whisper). Las diferencias de
  números (cifras vs palabras) ya se normalizan.
- `wpm` esperado: binary 115–130, rough 120–138.
- **Antes de regenerar, verificar**: Whisper también alucina (frases repetidas o inventadas en
  audios largos). Señales de alucinación de Whisper: palabras de duración ~0, texto sin sentido.
  Señal de error REAL del TTS: el mismo patrón de energía repetido (arranque en falso) o una frase
  que falta con un hueco de silencio. Para verificar un tramo: recortarlo con ffmpeg y
  transcribirlo aislado.
- Errores reales del TTS: si la frase correcta ya está en el audio (repetición), **cortar** con
  `tools/splice.py work/narration.wav work/narration.fix.wav --cut INICIO-FIN` y re-masterizar;
  si falta contenido, regenerar (`kit.py voice <id>`).

### Ritmo

En la primera tanda (2026-10-07) las voces salieron a 138–143 ppm, más rápido que el objetivo del
diseño (115–138). El estilo base de cada diseño ahora pide explícitamente el ritmo; si el control
marca `wpm` muy alto en un video importante, regenerar ese video.

## 3. Transcripción y tiempos

> **Duración**: Whisper large-v3 en CPU tarda ~1,5–3 min por minuto de audio (más si la máquina está
> ocupada). **No le pongas un `timeout` corto** y no lo reemplaces por tiempos sintéticos para
> "terminar": si tarda, se corre en segundo plano y se espera. Un storyboard anclado a tiempos
> sintéticos queda desincronizado con la voz real.

`kit.py transcribe <id>` → faster-whisper large-v3 con:
- el guion como guía (nombres propios bien escritos; corrige ortografía 1 a 1);
- `condition_on_previous_text=False` + VAD (evita bucles);
- descarte de palabras-fantasma (duración ~0) y ecos (palabra repetida ultracorta);
- **limpieza contra el guion**: las palabras que coinciden toman la grafía exacta del guion; las que
  Whisper agregó y no están en el guion ("sus sus", "un un", palabras sueltas) se descartan; los
  nombres partidos ("Bonn -Hommer -Strasse") se corrigen. Para relimpiar sin transcribir:
  `tools/transcribe.py --clean assets/lyrics.json assets/script.json`.

`lyrics.json` queda en formato Whisper: `segments[].words[] = {word, start, end}`. Los números
salen en **cifras** ("1989", "1202"): las anclas del storyboard se escriben así.

## 4. Sin voz todavía (o sin cuota)

`kit.py preview <id>` genera tiempos sintéticos + mp3 en silencio para diseñar el storyboard y
mirar la hoja de revisión. Después se reemplaza con la voz real y se re-valida (las anclas son
palabras, no segundos: el storyboard no cambia).

## 5. Elegir otra voz

Voces masculinas estudiadas (lab/voice-study/ESTUDIO-VOZ.md): Charon (grave, expresiva),
Sadaltager (grave, ágil), Algenib, Orus. Descartada: Schedar (repite frases). Para probar:
`kit.py voice <id> --voice Orus` en un video de prueba.
