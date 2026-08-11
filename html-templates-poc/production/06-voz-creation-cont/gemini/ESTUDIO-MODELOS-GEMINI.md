<!-- markdownlint-disable MD013 MD033 -->
# Estudio — Modelos de Gemini para voz / audio

> Objetivo: saber **qué modelos de Gemini existen** para generar voz (TTS) y audio, y
> cuáles sirven para nuestras narraciones. Listado real obtenido de la API con nuestra
> `GEMINI_API_KEY` (endpoint `models?key=…`), no de memoria.

---

## 1. Respuesta corta

- Para **narración TTS** (texto → voz, con las 30 voces y control de estilo por prompt)
  **solo hay 3 modelos dedicados**. Son los que ya conocíamos. **No hay más.**
- Gemini **sí** tiene **otros modelos que producen/entienden audio**, pero son para
  **otros usos** (voz conversacional en tiempo real, música, video con audio), no para
  generar el archivo de narración con las voces prebuilt.

---

## 2. Los 3 modelos TTS dedicados (lo que sirve para nuestras narraciones)

Todos usan `:generateContent` con `responseModalities:["AUDIO"]`, las **mismas 30 voces**
prebuilt, single/multi-speaker y el estilo se da por prompt. Salida PCM 16-bit / 24 kHz.

| Modelo | Calidad / carácter | Precio* (in / out por 1M tokens) | Batch** | Nota |
|---|---|---|---|---|
| `gemini-2.5-flash-preview-tts` | 🥈 buena, rápida y barata | ~$0.50 / ~$10 | ❌ No | La opción económica para volumen |
| `gemini-2.5-pro-preview-tts` | 🥇 la más **natural** | ~$1.00 / ~$20 | ✅ Sí | Mejor para voz serena y emotiva |
| `gemini-3.1-flash-tts-preview` | 🥇 la más **nueva/expresiva** | ~$1.00 / ~$20 | ✅ Sí | Mejor para cambios de emoción por escena |

\* Precios de referencia (modelos *preview*; confirmar en la página oficial de pricing).
\** `batchGenerateContent` = modo **batch asíncrono, ~50% más barato**; lo soportan pro-tts y 3.1-tts, **no** el flash-tts.

**Conclusión del estudio:** para lo nuestro (narración con voz serena o cambiante),
la elección es entre estos 3. `2.5-pro-preview-tts` para la voz **más natural** y
`3.1-flash-tts-preview` para la **más expresiva**; `2.5-flash-preview-tts` si prima el precio.

---

## 3. Otros modelos con audio (NO son TTS de narración — solo para contexto)

Aparecen en la key, pero **no** generan el `.wav` de narración con las 30 voces:

| Modelo(s) | Qué es | Para qué serviría |
|---|---|---|
| `gemini-2.5-flash-native-audio-latest` / `-preview-09-2025` / `-preview-12-2025` | **Audio nativo (Live API)**, `bidiGenerateContent` | **Voz conversacional en tiempo real** (agente que habla y escucha en streaming). No es para generar un archivo de narración. |
| `gemini-3.1-flash-live-preview` | **Live** (streaming bidireccional) | Conversación de voz en vivo, baja latencia. |
| `gemini-3.5-live-translate-preview` | **Live + traducción** | Traducción de voz en tiempo real. |
| `gemini-omni-flash-preview` | Modelo **omni** (multimodal) | Entrada/salida multimodal; no es TTS controlable con voces. |
| `lyria-3-clip-preview` / `lyria-3-pro-preview` | **Música** (Lyria) | **Música de fondo** generada, no voz hablada. Útil para el score del video, no para narrar. |
| `veo-3.1-generate-preview` / `-fast` / `-lite` | **Video** (Veo) con audio | Generar video con audio; otro pipeline. |

> Es decir: si algún día se quiere un **agente de voz en vivo** → los `native-audio`/`live`.
> Si se quiere **música de fondo** → Lyria. Para **narrar historias** → los 3 TTS de arriba.

---

## 4. Las 30 voces prebuilt (iguales en los 3 modelos TTS)

Se seleccionan con `prebuiltVoiceConfig.voiceName`. El carácter es el mismo modelo a modelo;
cambia la calidad/expresividad según el modelo.

| Voz | Carácter | Voz | Carácter | Voz | Carácter |
|---|---|---|---|---|---|
| Zephyr | brillante | Puck | animada | Charon | informativa/grave |
| Kore | firme | Fenrir | excitable | Leda | juvenil |
| Orus | firme | Aoede | ligera | Callirrhoe | relajada |
| Autonoe | brillante | Enceladus | susurrante | Iapetus | clara |
| Umbriel | tranquila | Algieba | suave | Despina | suave |
| Erinome | clara | Algenib | rasposa/grave | Rasalgethi | informativa |
| Laomedeia | animada | Achernar | suave | Alnilam | firme |
| Schedar | pareja/neutra | **Gacrux** | **madura** | Pulcherrima | directa |
| Achird | amistosa | Zubenelgenubi | casual | **Vindemiatrix** | **gentil** |
| Sadachbia | vivaz | Sadaltager | docta | **Sulafat** | **cálida** |

> **Graves/maduras** (buenas para narrador serio): Charon, Algenib, Gacrux, Orus, Alnilam, Rasalgethi.
> **Cálidas/serenas**: Sulafat, Vindemiatrix, Achernar, Despina.

---

## 5. Límites: free tier vs billing

- **Free tier (lo que tenemos hoy):** **10 requests por día y por modelo** + límite por
  minuto (RPM) bajo. Confirmado en la práctica: el `3.1-flash-tts` **agotó su cuota diaria**
  con las pruebas, y `2.5-pro-tts` ya aplicaba espera por minuto.
- **Para producción:** hay que **activar billing** en el proyecto de Google AI Studio →
  sube a miles de requests/día y habilita **batch** (50% más barato) en pro-tts y 3.1-tts.

---

## 6. Recomendación del estudio

1. **Voz de narración** → decidir entre `gemini-2.5-pro-preview-tts` (más natural) y
   `gemini-3.1-flash-tts-preview` (más expresiva). `2.5-flash-preview-tts` solo si prima el costo.
2. **Producción** → activar **billing**; usar **batch** en los modelos que lo soportan.
3. **Música de fondo** (aparte) → Lyria 3. **Voz en vivo** (si algún día) → native-audio / live.
4. Las **30 voces son las mismas** en los 3 TTS: elegir voz por carácter y modelo por calidad/precio.
