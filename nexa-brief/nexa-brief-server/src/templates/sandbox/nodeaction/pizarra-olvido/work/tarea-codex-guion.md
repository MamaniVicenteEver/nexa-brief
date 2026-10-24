# Tarea para Codex · investigación + guion · "Por qué olvidas lo que estudias"

Sos el investigador y guionista. Claude (orquestador) revisa todo lo que entregues. NO generes voz,
NO renderices, NO hagas git commit, NO toques nada fuera de `src/templates/sandbox/nodeaction/pizarra-olvido/`.

## Contexto
- Es un video explicativo de PIZARRA (motor `sandbox/nodeaction/_pizarra/`, ver
  `sandbox/nodeaction/pizarra-demo/PLAN.md` y la referencia `sandbox/nuevos/ejmplo1/videoplayback.mp4`,
  "The English Narratives"): un monigote en el centro que cambia de pose y de cara, dibujos de línea negra
  simples (reloj, cerebro, libro, calendario, flechas, gráficos de barras/curva, bombilla, papeles…), texto
  negro tipeado palabra por palabra, títulos en arco ("EL HÁBITO DE 5 MINUTOS · PASO 1 — …"), rótulos verdes.
  Todo lo que digas tiene que poder DIBUJARSE así, sin fotos.
- Tono de la referencia: un profe cercano que habla de tú, con pasos prácticos numerados y un reto final.
- Leé antes: `src/templates/_tools/explainer-kit/guides/storytelling.md` (entero), `guides/voice.md`,
  `src/templates/_tools/explainer-kit/lengths.json`.

## Entregables (en la carpeta del video)
1. `PLAN.md`: §1 Pedido · §2 Tesis y emoción · §3 Investigación: tabla de **≥ 12 hechos**
   `| n | hecho | fuente (URL) | ¿se usa? |` (Ebbinghaus 1885 y su réplica de Murre y Dros 2015, efecto de
   espaciado, práctica de recuperación/testing effect — Roediger y Karpicke 2006 —, interleaving, sueño y
   consolidación; fuentes primarias o revisiones reconocidas) y lista "**No decimos**" (mitos: "solo usamos el
   10 % del cerebro", estilos de aprendizaje VAK, porcentajes inventados de la "pirámide del aprendizaje") ·
   §4 Título y gancho (3 opciones + elegido, ≤ 40 caracteres) · §5 Arco por capítulos.
2. `assets/script.json` formato `storytelling.md §5` con `target_minutes: 7`:
   - **7 minutos** a ~125 ppm: **830–950 palabras**, 24–32 segmentos de 15–45 palabras, 4–6 capítulos
     (problema → por qué pasa → 3 o 4 técnicas como PASO 1, PASO 2… → reto final), pico de intensidad en el 60–72 %.
   - Números en palabras. Tú latino neutro. Oraciones de 6–18 palabras. Ejemplos cotidianos (un examen, un idioma).
3. `work/inventario-pizarra.md`: por segmento, qué dibujos aparecen (objetos simples de línea), qué texto
   se tipea en pantalla (≤ 6 palabras), qué título en arco, qué pose/cara del monigote (pensar, señalar,
   asustarse, escribir, saludar, encogerse de hombros, celebrar) y si conviene otro personaje secundario
   (p. ej. "un estudiante" vs "el profe").
4. `publish.json` (formato de `src/templates/_tools/explainer-kit/guides/manifest.md`), sin emojis.

Al terminar, reportá: palabras, segmentos, capítulos, pico, y datos que no pudiste confirmar.
