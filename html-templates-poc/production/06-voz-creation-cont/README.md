# 06 — Voz para narración (test de voces con Novita AI)

## Obama: pruebas de voces para llamada de atención

Todas las muestras de esta tabla narran la misma adaptación breve de la historia de Gene Manford, con un cierre dirigido al público. Son pruebas para escuchar timbres, sin asignarles categorías ni puntajes. La voz elegida para el audio completo de Obama es **Gemini Gacrux**, cuya muestra emocional con Gemini 3.1 se enlaza al final. El audio completo se generó con Gemini 2.5 Flash Preview TTS / Gacrux porque Gemini 3.1 respondió con límite de cuota (HTTP 429); no se debe asumir que suena idéntico a la muestra.

| Proveedor y voz | Modelo | Escuchar |
|---|---|---|
| Gemini Algenib | 3.1 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/gemini_llamada_accion_v1/01_algenib_grave_llamada_accion.wav) |
| Gemini Orus | 2.5 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/01_gemini_orus_firme.wav) |
| Gemini Alnilam | 2.5 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/02_gemini_alnilam_directa.wav) |
| Gemini Rasalgethi | 2.5 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/03_gemini_rasalgethi_documental.wav) |
| Gemini Sulafat | 3.1 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/gemini_llamada_accion_v1/03_sulafat_calida_llamada_accion.wav) |
| Gemini Vindemiatrix | 3.1 Flash TTS | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/04_gemini_vindemiatrix_reflexiva.wav) |
| Novita MiniMax Determined_Man | Speech 2.8 HD | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/05_minimax_determined_man_decidido.mp3) |
| Novita MiniMax Imposing_Manner | Speech 2.8 HD | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/06_minimax_imposing_manner_denuncia.mp3) |
| Novita MiniMax Elegant_Man | Speech 2.8 HD | [Audio](http://127.0.0.1:8766/emotion_tests/obama_voces_diferentes_v2/07_minimax_elegant_man_serio.mp3) |

También se conserva [Gemini Gacrux — muestra aprobada de 28 segundos](http://127.0.0.1:8766/emotion_tests/gemini31_gacrux_dolor.wav). **Algenib y Sulafat** gustaron como alternativas de timbre. Los enlaces `127.0.0.1` funcionan mientras el servidor local de muestras esté encendido en el puerto 8766; los archivos permanecen en `emotion_tests/`.

Prueba de **texto → audio** (sin clonar) para elegir la voz de narración de las
historias. Genera la misma narración de ~30s con varias voces y tonos, las
guarda como `.mp3` y tú decides cuál vale la pena.

## Qué usa

- **API:** Novita AI (token en `NOVITA_IA` del `.env` de la raíz).
- **Modelos probados:**
  - `MiniMax Speech 2.8 HD` ($100/1M car.) — máxima calidad + emoción + tono grave.
  - `MiniMax Speech 2.8 Turbo` ($60/1M car.) — para comparar calidad vs precio.
  - `Fish Audio S1` ($15/1M car.) — voz por defecto, muestra de referencia.
- **Voces graves/autoritarias** (MiniMax): `Deep_Voice_Man`, `Determined_Man`,
  `Imposing_Manner`, `Patient_Man`, `Elegant_Man`.

## Cómo correr

Desde la **raíz del repo** (ahí está el `.env`):

```bash
uv run python html-templates/production/06-voz-creation-cont/test_voces.py
```

Los audios quedan en `06-voz-creation-cont/output/`. Al final imprime una tabla
con estado, tiempo, tamaño y costo de cada voz.

## Personalizar

Todo se edita al inicio de `test_voces.py`:

- `TEXTO` — el guion a narrar (~75-85 palabras ≈ 30s).
- `TEST_CASES` — la lista de voces/tonos a probar (añade o quita filas).
- `SPEED` — velocidad (0.5–2; más lento = más solemne).
- `LANGUAGE_BOOST` — `"Spanish"` (si diera error, prueba `"auto"`).

## Costo

Cada corrida completa (~8 audios de 30s) cuesta **~$0.06** de tus créditos.
Es de una sola vez para elegir; luego se usa una sola voz por video (centavos).

## Siguiente paso

Cuando elijas la voz ganadora, se fija detrás de un `voice_port` +
`NovitaVoiceAdapter` en el pipeline (mismo patrón que `music_port`).

> Pendiente aparte (lo pediste): investigar cómo usar la plataforma de
> **Alibaba (DashScope / Model Studio)** para Qwen3-TTS, por si algún día se
> quiere self-host / API oficial.
