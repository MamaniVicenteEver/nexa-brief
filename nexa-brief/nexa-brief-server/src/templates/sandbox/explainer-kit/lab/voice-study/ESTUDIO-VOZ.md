# Estudio de voz · narración de los explainers (2026-10-06)

Objetivo: elegir la voz y la estrategia para narrar videos de ~3–4 min con cambios de emoción
(intriga → clímax → duelo → cierre), en español latino neutro, para miles de videos.

## Cómo se probó

- **Mismo texto para todos**: 3 segmentos del guion de Turing con tonos opuestos
  (s01 *intriga*, s09 *clímax*, s15 *duelo*; 104 palabras), con `<short pause>`.
- **Candidatas** (12 muestras en `audio/voice-study/`):
  - Gemini 3.8 Flash TTS (`interactions` + `speech_metadata.style` por fragmento): Gacrux, Charon,
    Orus, Algenib, Iapetus, Sadaltager, Schedar, Kore, Sulafat.
  - Gemini 3.8 Flash **Lite** TTS: Gacrux.
  - Novita MiniMax `speech-2.8-turbo`: Patient_Man, Deep_Voice_Man (las que usa nexa-explainer).
- **Métricas objetivas** (`tools/voice_study.py`, `metrics.json`):
  - palabras por minuto
  - f0 mediana (tono)
  - **rango tonal en semitonos** (expresividad: cuánto se mueve la voz entre emociones)
  - rango dinámico en dB
  - cantidad de pausas ≥ 0,35 s (respeta los `<pause>`)
  - **transcripción con Whisper large-v3**: ¿dijo exactamente el guion?

> No puedo escuchar audio: la elección se basa en métricas y en la transcripción. **Antes de
> producir en serie, escuchá las 12 muestras** (2 minutos) y confirmá o cambiá la voz en
> `tools/narrate.py --voice`.

## Resultados

| muestra | dur | ppm | f0 Hz | rango st | dyn dB | pausas | lectura |
|---|---|---|---|---|---|---|---|
| gem38-**charon** | 50,0 | 120 | 85 | **4,68** | 6,1 | 18 | ✓ exacta |
| gem38-schedar | 49,9 | 120 | 108 | **4,75** | **7,3** | 18 | ✗ **repitió "1940. 1940."** |
| gem38-sadaltager | 47,6 | 126 | 89 | 4,29 | 6,6 | 19 | ✓ exacta |
| gem38-algenib | 43,7 | 137 | 87 | 4,01 | 6,2 | 16 | ✓ exacta |
| gem38lite-gacrux | 48,2 | 125 | 111 | 4,01 | 5,9 | 14 | ✓ exacta |
| gem38-orus | 51,0 | 118 | 114 | 3,44 | 6,8 | **22** | ✓ exacta |
| gem38-sulafat (f) | 43,1 | 139 | 184 | 3,53 | 5,8 | 16 | ✓ exacta |
| gem38-kore (f) | 45,4 | 132 | 100* | 3,08 | 6,7 | 16 | ✓ exacta |
| gem38-iapetus | 42,2 | 142 | 119 | 2,96 | 6,5 | 12 | ✓ exacta |
| gem38-gacrux | 43,9 | 137 | 98 | 2,83 | 6,3 | 15 | ✓ exacta |
| novita-deep-voice-man | 45,1 | 133 | 114 | 2,85 | **4,0** | 12 | ✓ exacta |
| novita-patient-man | 53,4 | 112 | 112 | **2,80** | 5,0 | 14 | ✓ exacta |

(*) probable error de octava del detector de tono. El WER 0,13 que da la herramienta es igual
en todas: es solo que Whisper escribe "1940" en cifras; las 12 lecturas son correctas salvo la
repetición de Schedar.

## Conclusiones

1. **Gemini 3.8 > Novita para narración emocional.** Novita es la más plana (rango 2,8 st,
   dinámica 4–5 dB): suena igual en el clímax que en el duelo. Gemini con estilo por fragmento
   mueve la voz 4–4,7 st: la emoción del guion se escucha.
2. **Voz elegida para la serie *binario* (historia, personajes): `Charon`.**
   - Grave (85 Hz), con el rango tonal más amplio entre las voces confiables.
   - 120 ppm: ritmo de documental, ni lento ni apurado.
   - Respeta las pausas (18).
3. **Voz elegida para la serie *rough* (tecnología, innovación): `Sadaltager`.**
   - También grave (89 Hz) y expresiva (4,3 st).
   - Un poco más ágil (126 ppm), mejor para urgencia y tensión.
   - Una voz distinta por serie ayuda a que cada categoría tenga identidad propia.
4. **Descartada para producción: Schedar.** Es la más expresiva, pero repitió una frase. Ese
   es el riesgo típico de los modelos TTS generativos.
5. **Respaldo cuando no queda cuota**: `gemini-3.8-flash-lite-tts` (Gacrux lite salió correcta,
   4 st). Novita queda como último recurso.

## Estrategia de generación (`tools/narrate.py`)

- **Una sola petición `interactions` por video.** La voz, la sala y el volumen salen idénticos de
  punta a punta. Si se cortara, se usa `--parts 2` y se pega con 0,35 s de silencio.
- **Estilo por segmento.** Cada segmento del guion lleva su `speech_metadata.style`, armado así:
  - una base común: narrador documental, latino neutro, sin imitar a nadie;
  - la dirección del tono (tabla `STYLE` en español);
  - la intensidad (muy baja … máxima) a partir del campo `intensity`.
- **Etiquetas de ritmo según el tono:**
  - `<short pause>` entre oraciones en los tonos lentos (intriga, peso, duelo, cierre…);
  - `<long pause>` antes de los giros (silencio, dolor contenido, duelo);
  - `<breath>` antes de clímax y urgencia;
  - nada en los tonos rápidos.
- **Guion escrito para el oído.** Los números van en palabras ("mil novecientos cuarenta") y las
  frases son cortas. Las cifras clave aparecen solas ("Millones de vidas.").
- **Control de calidad automático.** Whisper large-v3 transcribe y se compara contra el guion
  para detectar palabras que faltan o sobran (repeticiones como la de Schedar), y se registran la
  duración y las ppm en `song.qc.json`. Si falla, se regenera solo esa parte (`--only-part`).
- **Masterizado.**
  - 1,2 s de silencio al inicio: el título gigante se arma antes de la primera palabra.
  - 3 s al final: el cierre respira.
  - Loudness -16 LUFS (estándar de redes), 44,1 kHz y 192 kbps.
- **Cuota.** El plan gratuito de `gemini-3.8-flash-tts` permite 10 pedidos por día. Un video es
  1 pedido, más 1 de reintento si el control de calidad falla.

## Lo que pasó en producción (2026-10-06, plan gratuito)

- El estudio de voz consumió los 10 pedidos diarios de `gemini-3.8-flash-tts`.
- Esperé hasta las 00:00 UTC, cuando el primer 429 decía "retry in 27m", pero el siguiente
  intento respondió **"retry in 23h57m"**. Conclusión: en la práctica la ventana es de unas 24 h
  desde los primeros pedidos; no se reinicia a medianoche. **Para producir en serie hace falta el
  plan pago** (o separar el estudio de voz de la producción con un día de diferencia).
- Respaldo usado: **`gemini-3.8-flash-lite-tts`** (misma generación, cuota propia).
  - Con alta demanda devuelve **503** en los pedidos largos (~4,5 min de audio), pero acepta
    pedidos cortos.
  - Solución: `narrate.py --parts 3`, o sea 3 pedidos de ~1,5 min, misma voz, unidos con 0,35 s.
- `gemini-3.1-flash-tts-preview` no acepta `mime_type: audio/wav` en `interactions` (HTTP 400).
  Para usarlo habría que pedir PCM crudo.
- Cuando vuelva la cuota del modelo completo, se regenera con el mismo comando sin `--model`
  y se repite transcribe → check → render (los storyboards no cambian: las anclas son palabras).

### Narraciones finales (lo que quedó en `assets/song.mp3`)

| video | voz | modelo | partes | duración |
|---|---|---|---|---|
| Turing (binario) | Charon | 3.8 Flash **Lite** (partes 1–2) + 3.1 Flash TTS preview (parte 3, `generateContent` + prompt de director) | 3 | ~4:28 con silencios |
| Apolo (rough) | Sadaltager | 3.1 Flash TTS preview (`generateContent` + prompt de director) | 3 | ~3:53 con silencios |

- Entre las partes de Turing el tono medio queda en 107 / 108 / 99 Hz. La parte 3 es más grave,
  pero es el tramo de duelo, así que encaja con la dirección. La unión cae en un cambio de
  sección: "¿qué la diferencia de nosotros?" / "Años antes…". **Escuchar esa unión (~2:47).**
- Cuando vuelva la cuota del modelo completo, conviene regenerar las dos con
  `gemini-3.8-flash-tts` en un solo pedido (voz uniforme).

### Whisper también alucina (falso positivo del control de calidad)

El primer control marcó errores graves: partes repetidas, "un millón de pulgadas", "el código de
la vida" repetido. Al transcribir esos tramos aislados, **el audio estaba bien**: el que inventaba
era Whisper. Con `condition_on_previous_text=True` entra en bucle en audios largos.

La huella de esas alucinaciones son palabras de **duración cero** en racha
(`millón[82,48–82,48]`). Desde ahora `transcribe.py` y el control de `narrate.py` usan:

- `condition_on_previous_text=False` y VAD;
- transcripción por partes;
- descarte de las palabras de duración ~0.

Antes de cortar o regenerar audio, se verifica el tramo aislado.
