# 06 — Voz para narración (test de voces con Novita AI)

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
