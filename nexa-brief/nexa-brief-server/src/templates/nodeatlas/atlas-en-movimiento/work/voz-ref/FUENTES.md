# Fuentes y alcance de verificación

Consulta: 3 de noviembre de 2026. Cero solicitudes de generación, cero servicios de transcripción remota, dos descargas de SFX CC0 para probar la inserción (exhale-02 y sigh-03), con hashes verificados; los otros seis quedaron como metadatos. La descarga del paquete abierto praat-parselmouth se hizo en un venv desechable de `/tmp`.

- [Gemini API, generación de voz](https://aistudio.google.com/docs/speech-generation): catálogo de caracteres vocales y separación entre `speech_metadata.style` y eventos puntuales.
- [Google Cloud, guía de dirección de Gemini TTS](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/prompting-guide): Gemini 3.8 documenta `<short pause>`, `<long pause>`, `<breath>`, `<sigh>` y `<exhales>`. No garantiza una duración exacta para cada etiqueta. Para 3.1, la documentación heredada usa etiquetas entre corchetes; no trasladar automáticamente las mismas marcas entre modelos.
- [Google Cloud, voces de Gemini TTS](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#voice_options): Algenib, Alnilam y Orus figuran como masculinas; Gacrux figura como femenina. El carácter «Mature» de Gacrux no demuestra una voz masculina grave.
- [SFXMint](https://sfxmint.com/): consultas públicas de metadatos `GET /api/v1/search` y `GET /api/v1/sounds/{slug}`. Respuestas completas en `sfxmint-busquedas.json` y `sfxmint-fichas.json`; algunas consultas tuvieron errores de DNS o timeout, conservados en evidencia. La ficha individual se obtuvo para todos los candidatos de la tabla final.
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): licencia declarada por SFXMint, sin auditoría independiente del origen de cada sonido.

Archivos locales leídos, sin modificarlos:

`~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/src/templates/_tools/explainer-kit/tools/narrate.py`, `tools/tts.py` y `guides/voice.md`. Se revisó su código; no se ejecutaron sus clientes ni se abrieron archivos de claves. También `assets/script.malvinas.json`, `work/voz/anclas.malvinas.json`, `work/results/guion-voz.md` y `work/research/SONIDOS.md`.

El kit admite las marcas mediante texto literal: `mark()` inserta pausas y respiraciones y el cliente envía el texto. Eso demuestra paso de marcas, no que cada síntesis vaya a realizarlas correctamente. `voice_direction` solo entra directamente en el fallback director de 3.1; la ruta 3.8 construye estilos desde el diseño. Ambas rutas agregan 130 ppm. `preparar-kit.py` produce chunks locales sin esa contradicción y sin importar clientes TTS.
