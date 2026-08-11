# Pruebas de concepto — Voces de Qwen (para Google Colab)

Probar los mejores modelos de voz **open source de Qwen** narrando *La caída de
Constantinopla (1453)* con emociones (solemne → tensión → miedo → alegría →
tragedia), para ver si de verdad valen la pena frente a lo que ya tenemos.

## Los modelos de voz de Qwen — más nuevos, fechas y funciones

| Modelo | Fecha | Qué trae de nuevo |
| --- | --- | --- |
| **Qwen-TTS** | ~jun 2025 | Primer TTS de Qwen. Solo por API (DashScope). Multivoz básico. |
| **Qwen3-TTS-Flash** | ~sep 2025 | Versión rápida por API: baja latencia, multi-timbre, dialectos chinos. |
| **Qwen3-Omni** | ~sep 2025 | Modelo omnimodal (texto/imagen/audio/voz). Habla con emoción, pero no es un TTS puro. |
| **Qwen3-TTS (0.6B / 1.7B)** ⭐ | **22 ene 2026** | **El más nuevo y el que probamos.** Open source (Apache 2.0), corre local en GPU. |
| — DashScope añadió Qwen3-TTS por API | feb 2026 | Ya se puede consumir por la API oficial de Alibaba también. |

### Qwen3-TTS (lo nuevo del 22-ene-2026) — sus 3 MODOS

Lo que la gente llama "los 3 mejores modelos de Qwen" son en realidad **los 3
modos** de este modelo (por eso el script prueba los 3):

1. **CustomVoice** — 9 voces prediseñadas de alta calidad + **control de emoción
   y tono** por instrucción en lenguaje natural. (Voces de hombre graves:
   `Uncle_Fu`, `Ryan`, `Aiden`.)
2. **VoiceDesign** — **diseña una voz nueva desde una descripción** de texto
   ("voz masculina grave, épica, de documental").
3. **VoiceClone** — **clona cualquier voz con 3 segundos** de audio de referencia.

**Otras funciones nuevas:** 10 idiomas (incluye **español**), entrenado con +5
millones de horas, latencia de 97 ms, control de ritmo/emoción según el texto,
y el 1.7B tiene **más control emocional** que el 0.6B.

## Cómo correr en Google Colab (pasos REALES, ya probados)

1. Abre [colab.research.google.com](https://colab.research.google.com) → **Nuevo cuaderno**.
2. **Entorno de ejecución → Cambiar tipo de entorno → GPU (T4).**
   ⚠️ Obligatorio: sin GPU, PyTorch sale en modo `+cpu` y **nada** funciona.
3. Verifica con `!nvidia-smi` que aparezca la **Tesla T4**.
4. Pega la **CELDA A** de [`qwen3_tts_colab.py`](qwen3_tts_colab.py) → instala qwen-tts
   sin romper el torch de Colab. Debe imprimir `GPU_disponible=True`.
5. Pega la **CELDA B** → genera las 4 narraciones (descarga modelos ~10 min la
   1ª vez) y baja un `.zip`.

> **Lecciones aprendidas** (los 3 errores que ya resolvimos):
>
> 1. Usar **GPU** de verdad, o torch queda en `+cpu` (`Torch not compiled with CUDA`).
> 2. Instalar qwen-tts con **`--no-deps`** para que NO pise el torch-CUDA de Colab.
> 3. Instalar el paquete **Python `sox`** además del binario apt (qwen_tts hace `import sox`).

## Lo que ejecutamos — los 4 audios y en qué se diferencian

Los 4 narran la MISMA historia con el MISMO arco emocional; lo que cambia es
**cómo se crea la voz**:

| # | Archivo | Modo (técnica) | Modelo usado (HuggingFace) | Voz | Qué lo hace distinto |
|---|---|---|---|---|---|
| 1 | `modo1_customvoice_Uncle_Fu.wav` | CustomVoice | `Qwen3-TTS-12Hz-1.7B-CustomVoice` | Uncle_Fu (grave, maduro) | Voz **de catálogo** + emoción por instrucción |
| 2 | `modo1_customvoice_Ryan.wav` | CustomVoice | `Qwen3-TTS-12Hz-1.7B-CustomVoice` | Ryan (potente, con ritmo) | **Igual que #1 pero otra voz** (para comparar) |
| 3 | `modo2_voicedesign_epico.wav` | VoiceDesign | `Qwen3-TTS-12Hz-1.7B-VoiceDesign` | *inventada* | La IA **crea la voz** desde una descripción de texto |
| 4 | `modo3_voiceclone.wav` | VoiceClone | `Qwen3-TTS-12Hz-1.7B-Base` | *clonada* | **Copia el timbre** de un audio de referencia (3s) |

Resumen: **#1 y #2 = elegir · #3 = diseñar · #4 = copiar.**
Cada narración dura ~1.5–2 min con el arco emocional (solemne → tensión → miedo
→ alegría → tragedia).

## Resultados finales — mi veredicto (llenar tras escuchar)

Puntúa cada uno del 1 al 5 tras escucharlo (naturalidad · emoción · acento español · ¿sirve?):

- **#1 Uncle_Fu** — naturalidad ( ) · emoción ( ) · español ( ) · ¿sirve? ( )
- **#2 Ryan** — naturalidad ( ) · emoción ( ) · español ( ) · ¿sirve? ( )
- **#3 VoiceDesign** — naturalidad ( ) · emoción ( ) · español ( ) · ¿sirve? ( )
- **#4 VoiceClone** — naturalidad ( ) · emoción ( ) · español ( ) · ¿sirve? ( )

**Modelos usados (IDs completos):**

- `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`
- `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`
- `Qwen/Qwen3-TTS-12Hz-1.7B-Base`
- Tokenizer: `Qwen/Qwen3-TTS-Tokenizer-12Hz`

## Personalizar (todo arriba del script)

- `SEGMENTS` — los textos y la emoción de cada momento.
- `CUSTOM_VOICE_SPEAKERS` — qué voces probar.
- `VOICE_DESIGN_DESC` — cómo quieres que suene la voz diseñada.
- `REF_AUDIO` / `REF_TEXT` — para clonar **en español**, sube tu propio `.wav`
  y pon el texto exacto que dice.
- `SIZE` — `"1.7B"` (mejor) o `"0.6B"` (más rápido).

## Notas técnicas

- **Gratis:** Apache 2.0 → uso comercial y monetización OK.
- **flash-attn** es opcional (tarda en compilar); el script usa `sdpa`, que ya
  viene en PyTorch y funciona en la T4 de Colab.
- Si una voz no suena natural en español, el modo **VoiceDesign** o **VoiceClone**
  con una referencia en español suele dar el mejor acento.

## Comparación honesta que buscamos

- Novita (Fish/MiniMax) = **API, sin GPU, centavos por video, cero setup**.
- Qwen3-TTS = **gratis, local, control total (diseño + clonación)**, pero
  **necesita GPU** (Colab la presta gratis para probar).

El objetivo de esta prueba: escuchar si hay "diferencia abismal" real que
justifique montar Qwen, o si con Novita ya basta para producir.
