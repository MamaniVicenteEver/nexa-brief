<!-- markdownlint-disable MD060 MD032 MD013 -->
# Comparativa de voces — Narración "Economía del siglo XIV" (~3 min)

Prueba con las 5 voces elegidas de **Novita**, narrando la misma historia (~3 min)
con las mejores configuraciones de cada motor (emoción por segmento, pausas
dramáticas y clímax serio en la Peste Negra). Incluye precios de **Alibaba (Qwen)**.

Audios generados en: [`output_economia/`](output_economia/) · Script: [`test_economia_novita.py`](test_economia_novita.py)

---

## 1. Tabla completa — lo que ejecutamos (costos reales)

| # | Voz | Modelo usado | Caracteres | Costo real (~3 min) | Proyección 10 min | Duración |
|---|-----|--------------|-----------:|--------------------:|------------------:|---------:|
| 01 | Deep_Voice_Man | MiniMax Speech 2.8 **HD** | 2.459 | **$0.246** | $0.85 | 187 s |
| 05 | Patient_Man | MiniMax Speech 2.8 **HD** | 2.459 | **$0.246** | $0.85 | 209 s |
| 04 | Imposing_Manner | MiniMax Speech 2.8 **HD** | 2.459 | **$0.246** | $0.85 | 186 s |
| 07 | Deep_Voice_Man | MiniMax Speech 2.8 **Turbo** | 2.459 | **$0.148** | $0.51 | 188 s |
| 08 | (voz por defecto) | **Fish Audio S1** | 2.380 | **$0.036** | $0.128 | 173 s |

> Referencia de costo por caracteres: ~850 caracteres = 1 minuto de audio.
> 3 min ≈ 2.550 car · 10 min ≈ 8.500 car.

---

## 2. Descripción de cada modelo y para qué es recomendado

| Modelo | Precio | Calidad | Qué es | Recomendado para |
|--------|-------:|---------|--------|------------------|
| **MiniMax 2.8 HD** | $100 / 1M | 🥇 La más alta | Voz muy natural y emotiva; control fino de emoción, **pausas `<#s#>`** y pitch | El video "de dinero", donde la voz engancha (historias, documentales serios) |
| **MiniMax 2.8 Turbo** | $60 / 1M | 🥈 Casi igual a HD | Prácticamente la misma calidad, **40% más barata** y más rápida | Producción en **volumen** con buena calidad |
| **Fish Audio S1** | $15 / 1M | 🥈 Muy buena | **Etiquetas inline** de emoción y suspiros `(serious) (sighing)`; 1 voz por defecto (sin clonar) | Volumen alto con **presupuesto mínimo** |
| **Qwen3-TTS-Flash (Alibaba)** | $13 / 1M (1M gratis) | 🥇 Top + control total | Diseño y **clonación** de voz; por API o local (GPU) | Si quieres **voz propia/clonada** y el precio más bajo |

---

## 3. Precios desde Alibaba (Qwen — DashScope / Model Studio)

Si en vez de Novita usas Qwen directo desde Alibaba:

| Modelo | Precio | 3 min (~2.550 car) | 10 min (~8.500 car) | Nota |
|--------|-------:|-------------------:|--------------------:|------|
| **qwen3-tts-flash** | ~$0.013 / 1.000 car ($13/1M) | ~**$0.033** | ~**$0.11** | **1.000.000 de caracteres GRATIS** para cuentas nuevas |

- Es de los **más baratos** (similar a Fish, más barato que MiniMax).
- Ventaja Qwen: **diseño y clonación de voz**; puede correr por API (Alibaba) o local (Colab/GPU).
- Desventaja: montar/gestionar la API de Alibaba vs. Novita que ya tienes andando.

---

## 4. Mejores configuraciones por modelo (para el mejor resultado)

**MiniMax (HD / Turbo):**
- `language_boost: "Spanish"` **siempre** (mejor pronunciación).
- **Emoción por segmento** (`calm`, `fluent`, `sad`, ...) para hacer un arco dramático.
- **Pausas dramáticas** con `<#0.5#>` (segundos) — verificado que Novita las respeta.
- `speed` 0.90–0.95 para tono documental; `pitch` negativo para más grave.

**Fish Audio S1:**
- **Etiquetas inline** al inicio de cada frase: `(serious)`, `(sad)`, `(sighing)` (suspiros),
  `(whispering)`, `(moved)`… (soporta +50 emociones/tonos).
- `temperature: 0.7`, `top_p: 0.7`; `speed` ~0.85 (lee más rápido que MiniMax).
- No usa `<#s#>`: las pausas salen de la puntuación (… , —).

**Qwen3-TTS (Alibaba/Colab):**
- Emoción y tono se dan en **lenguaje natural** en el campo `instruct`.
- **VoiceDesign** para inventar una voz; **VoiceClone** para copiar una (3 s).
- Para acento **mexicano neutro**: descríbelo en el `instruct` o usa una referencia en español.

---

## 5. Resultados / veredicto (tu opinión al escuchar)

Feedback previo (test corto en español):

- **05 Patient_Man (HD)** — 🤩 "WAO increíble" · candidata #1
- **01 Deep_Voice_Man (HD)** — 👍 "me gusta, para otro sector"
- **04 Imposing_Manner (HD)** — 👍 "también está bien"
- **08 Fish default** — 🙂 "decente"
- **07 Deep_Voice_Man (Turbo)** — comparación HD vs barato

Veredicto sobre la narración de economía (~3 min) — llenar al escuchar:

- **01 Deep_Voice_Man (HD)** — nota: ___
- **05 Patient_Man (HD)** — nota: ___
- **04 Imposing_Manner (HD)** — nota: ___
- **07 Deep_Voice_Man (Turbo)** — ¿se nota la diferencia con el 01 HD?: ___
- **08 Fish default** — ¿la calidad barata alcanza?: ___

**Decisión final (con quién me quedo):** ___

---

## 6. Recomendación rápida

- **Calidad máxima (voz que vende):** MiniMax 2.8 **HD** (05 Patient_Man o 01 Deep_Voice_Man).
- **Mejor relación calidad/precio en volumen:** MiniMax 2.8 **Turbo** (misma voz, ~40% menos).
- **Presupuesto mínimo:** **Fish** o **Qwen3-TTS-Flash** (ambos ~$0.03–0.04 por 3 min).
- **Voz propia/clonada mexicana neutra:** **Qwen3-TTS** (VoiceDesign / VoiceClone).
