# Estudio de modelos de voz (TTS) — Novita, Google AI Studio, Qwen

Consolidación de una investigación previa que ya existía en el repo, en `nexa-brief/html-templates-poc/production/06-voz-creation-cont/` — scripts Python que corrieron de verdad contra las 3 APIs y generaron audio real (no estimaciones). Este doc la resume para `nexa-academy`, con enlaces a las fuentes originales.

**Fuentes originales** (no mover, quedan ahí como el registro primario con los audios generados):
- `06-voz-creation-cont/README.md`, `COMPARATIVA-VOCES.md`, `test_voces.py`, `test_economia_novita.py` — Novita.
- `06-voz-creation-cont/gemini/ESTUDIO-MODELOS-GEMINI.md`, `test_tts_economia_gemini.py`, `gen_5_voces_produccion.py` — Google AI Studio / Gemini.
- `06-voz-creation-cont/qwen/` — Alibaba DashScope / Qwen3-TTS (opción bonus, no evaluada todavía para `nexa-academy`).

## 1. Novita AI — 3 motores probados, costos reales medidos

Auth: header `Authorization: Bearer {NOVITA_IA}` (variable de entorno separada de `GEMINI_API_KEY`). Base URL `https://api.novita.ai`.

| Motor | Endpoint | Precio | Costo real medido (~3 min narración) | Veredicto |
|---|---|---|---:|---|
| MiniMax Speech 2.8 **HD** | `/v3/minimax-speech-2.8-hd` | $100/1M car. | $0.246 | 🥇 La más natural — feedback real: "WAO increíble" (voz `Patient_Man`) |
| MiniMax Speech 2.8 **Turbo** | `/v3/minimax-speech-2.8-turbo` | $60/1M car. | $0.148 | 🥈 Casi igual calidad, 40% más barata |
| Fish Audio **S1** | `/v4beta/txt2speech` | $15/1M car. | $0.036 | 🥉 Decente, etiquetas de emoción inline `(serious)`, `(sighing)` |

**Detalles de request real (ver `test_economia_novita.py` para el código completo):**
- MiniMax: `{"text", "voice_setting": {"voice_id", "vol", "pitch", "speed", "emotion"}, "audio_setting": {"format":"mp3", "bitrate":128000, "sample_rate":32000, "channel":1}, "language_boost":"Spanish", "output_format":"hex"}` → respuesta con audio en hex en `data.audio`.
- Fish: `{"text", "model":"s1", "format":"mp3", "temperature":0.7, "top_p":0.7, "prosody":{"speed","volume"}}` → respuesta es el binario mp3 directo (no JSON).
- MiniMax soporta pausas dramáticas `<#0.5#>` (segundos) — confirmado que las respeta, verificado midiendo diferencia de duración.
- Voces graves/autoritarias de MiniMax ya probadas: `Deep_Voice_Man`, `Determined_Man`, `Imposing_Manner`, `Patient_Man`, `Elegant_Man`.

## 2. Google AI Studio / Gemini — 3 modelos TTS dedicados, confirmado contra la API real

Confirmado con `models?key=…` (no de memoria): solo hay 3 modelos que sirven para narración con voces prebuilt. Todos usan `:generateContent` con `responseModalities:["AUDIO"]`, devuelven PCM 16-bit/24kHz (hay que envolver en WAV a mano, no viene con contenedor).

| Modelo | Precio (in/out por 1M) | Batch (-50%) | Nota |
|---|---:|:---:|---|
| `gemini-2.5-flash-preview-tts` | ~$0.50 / ~$10 | ❌ | El económico |
| `gemini-2.5-pro-preview-tts` | ~$1.00 / ~$20 | ✅ | 🥇 El más natural |
| `gemini-3.1-flash-tts-preview` | ~$1.00 / ~$20 | ✅ | El más expresivo — **pero agotó su cuota diaria gratis en las pruebas reales** |

**Límite real confirmado**: free tier = 10 requests/día **por modelo** + límite por minuto. Para producción real hay que activar billing en el proyecto de Google AI Studio.

**30 voces prebuilt** (mismas en los 3 modelos, cambia calidad/expresividad por modelo — lista completa en `ESTUDIO-MODELOS-GEMINI.md`):
- Graves/maduras (narrador serio): `Charon`, `Algenib`, `Gacrux`, `Orus`, `Alnilam`, `Rasalgethi`.
- Cálidas/serenas: `Sulafat`, `Vindemiatrix`, `Achernar`, `Despina`.

**Ya se usaron en producción de prueba** (`gen_5_voces_produccion.py`, narración de ~3min con arco emocional completo): `Charon`, `Gacrux`, `Vindemiatrix` (voz constante serena) y `Sadachbia`/`Iapetus`/`Orus`/`Sulafat` (voz que cambia por escena, arco dramático).

## 3. Qwen3-TTS (Alibaba DashScope) — bonus, no evaluado para nexa-academy todavía

El más barato de los 3 proveedores: ~$0.013/1.000 car. ($13/1M), **1.000.000 de caracteres gratis** para cuentas nuevas. Soporta diseño y clonación de voz (`VoiceDesign`/`VoiceClone`). Desventaja: hay que montar la API de Alibaba aparte (Novita/Gemini ya están integrados en el proyecto).

## 4. Conclusión para `nexa-academy` — qué cambió de lo ya implementado

`src/adapters/voice/infrastructure/gemini_tts_adapter.py` (ver `nexa-academy-server`) ya usaba `gemini-3.1-flash-tts-preview` con voz `Kore` por default — **corregido**:
- Voz default → `Gacrux` (madura/cálida, de la lista validada con narración real de ~3min), no `Kore` (nunca probada por el usuario).
- Modelo default → **`gemini-2.5-flash-preview-tts`**, no `2.5-pro-preview-tts` como se planeaba inicialmente. Al probar el adapter real (2026-09-19) con 10s de audio, `2.5-pro-preview-tts` devolvió `429 RESOURCE_EXHAUSTED` con **`limit: 0`** — no es que se agotó la cuota diaria por uso, es que esta cuenta no tiene NADA de cuota free-tier para ese modelo (necesita billing activado en el proyecto de Google AI Studio). `2.5-flash-preview-tts` sí respondió con audio real en la misma prueba, y además es el más barato de los 3 — queda como default hasta que se active billing, momento en el que `2.5-pro-preview-tts` (más natural) vuelve a ser la mejor opción.

## 5. `NovitaTTSAdapter` + `VoicePort` inyectado en el pipeline — hecho y probado con audio real

Implementado y verificado 2026-09-19, con el mismo texto de prueba (140 caracteres, ~10-12s) en los 4 motores:

| Motor | Duración real | Costo real | Resultado |
|---|---:|---:|---|
| Gemini `2.5-pro-preview-tts` | — | — | ❌ 429, cuota free-tier en 0 (necesita billing) |
| Gemini `2.5-flash-preview-tts` | 7.7s (texto más corto) | $0.0142 | ✅ WAV válido, pcm_s16le 24kHz |
| Novita MiniMax **HD** | 11.56s | $0.0140 | ✅ MP3 válido, 32kHz |
| Novita MiniMax **Turbo** | 11.41s | $0.0084 | ✅ MP3 válido, 32kHz |
| Novita Fish Audio **S1** | 11.55s | $0.0021 | ✅ MP3 válido, 44.1kHz |

Costo total de las 5 llamadas de prueba (incluida la que falló): **~$0.038**.

**Arquitectura final** (hexagonal + microkernel, como se pidió):
- `VoicePort` (`src/core/ports/voice_port.py`) — genérico, con `instruction`/`emotion` opcionales que cada adapter interpreta a su manera (Gemini antepone `instruction` al texto; Novita usa `emotion` directo en MiniMax y lo traduce a etiqueta inline en Fish).
- `style_templates.py` — plantillas con variables (`documental_serio`, `cercano_cotidiano`, `entusiasta_motivador`), `render_style(template_key, **variables)` devuelve `(instruction, emotion)` ya armados.
- `factory.py::get_voice_ai(provider=None, engine=None)` — transición entre Gemini/Novita, o entre los 3 motores de Novita, es un parámetro, no un cambio de código.
- `voice_narrator.py` — stage nuevo del pipeline (`JobStage.AUDIO_SYNTHESIZED`, entre `html_generator` y `video_recorder`), corre solo si hay `user_context` y todavía no hay `audio_path` resuelto — llena el hueco que `video_recorder.py` venía señalando desde la poda de dominio musical.
- Logs estructurados (`voice_synthesis_start/done/retry`) con provider/model/voice/duración/costo estimado, para poder comparar motores desde los logs sin escuchar cada audio.
