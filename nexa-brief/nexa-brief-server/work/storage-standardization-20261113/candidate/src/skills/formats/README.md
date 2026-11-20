# Formatos compartidos

`documental-largo` deriva de `explainer-kit/lengths.json`. Ese archivo conserva su contrato y todos sus lectores anteriores. Sin formato explícito siguen vigentes sus mínimos y sus formatos históricos.

`animado-corto`: 150–240 segundos, 180 por defecto, pasos de 15 segundos; animaciones sin fotografías, clips ni imágenes generadas, sin capítulos. La selección automática usa el umbral declarado en `selection`: menos de 240 segundos elige el corto. A 240 se selecciona el largo; para un corto de 240 hay que indicarlo explícitamente. Una duración incompatible se rechaza, nunca se alarga silenciosamente.

Las palabras se calculan con los wpm de la identidad y `words_margin`; segmentos y escenas con duración × densidad. Las escenas se mantienen entre unos 2,5 y 4 segundos. El núcleo valida capacidades del diseño y medios. `python -m src.core.explainer.editions show` permite inspeccionar el resultado sin producir audio.
