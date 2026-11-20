# Receta para una futura prueba de Gemini

Preparación exclusivamente local. **No ejecutada: cero solicitudes y cero coste de generación nuevo.** No se verificaron por red nombres, disponibilidad, precio ni esquema actuales del proveedor. Este JSON es una receta editorial, no una petición lista para enviar.

[chunks-natural.json](chunks-natural.json) contiene siete bloques del guion, hechos y fechas sin cambios; m03 se reformula con oraciones de distinta longitud. No contiene etiquetas. Las frases tienen 4–13 palabras. La prueba futura puede limitarse a m03 y m04 (28 palabras; el audio de esta entrega conserva las 27 originales). Para evaluar continuidad, unir el texto de ambos bloques en una sola intervención, sin silencios insertados por bloque.

Dirección única (206 caracteres):

> Un hombre maduro cuenta un recuerdo difícil en español latinoamericano. Su voz tiene cansancio y una aspereza leve, pero sigue siendo clara y cercana. Habla con continuidad, sobrio y sin solemnidad teatral.

Algenib y Orus son las dos candidatas ya disponibles en el material local. Algenib tenía F0 mediana cercana a 92 Hz; permite comprobar si su textura funciona cuando se libera el ritmo. Orus rondaba 115 Hz, con mayor amplitud tonal; permite decidir si una voz más firme y menos grave se siente más conversada. Ninguna se recomienda por naturalidad: el usuario rechazó las cuatro muestras anteriores. El posproceso no determina cuál síntesis futura será mejor.

La referencia humana tiene mediana de hueco ASR de 180 ms, frente a 340–500 ms en estas síntesis (solo tres huecos ASR por voz). El detector acústico, una medida distinta, encuentra medianas de 508–575 ms en los cuatro MP3 previos. Las comas humanas con pausa rondan 140 ms y sus puntos 200 ms; no todas las comas generan silencio. Por eso se elimina el pedido de pausa antes de cada bloque y se usa puntuación corriente, sin asignar duración a cada frase. El perfil anterior incluía unas mil letras de instrucciones y fijaba 100–115 ppm. La dirección breve describe a quien habla y su relación con el recuerdo; no manda números de ritmo ni una actuación paso a paso.

Evitar `<long pause>`, `<short pause>`, marcas de respiración, «suspira» literal, números de ppm, saltos de volumen/tono por palabra y varios estilos acumulados. Tampoco imponer una pausa dramática en cada bloque: en estas muestras llegó a casi un segundo después de «Stanley». No exigir el ritmo humano de 214 ppm: el objetivo editorial de esta tarea es más reposado, 110–140 ppm, y debe medirse tras la síntesis.

Con autorización futura para generar, comprobar primero el esquema y voces vigentes del proveedor y que la ruta del kit realmente use `style`. El estudio local advierte que otra ruta construía el estilo desde el diseño e inyectaba un ritmo fijo; no reutilizarla sin revisar. Enviar texto y dirección por separado según ese esquema. Comparar las mismas frases, una voz por vez, sin posproceso inicial, a volumen igualado. Escuchar y medir pausas, nombres propios, continuidad y finales; solo después elegir voz y color. Esta entrega no importa ni ejecuta clientes de Gemini.

Base de decisiones: [diagnóstico](diagnostico.md), [mediciones](mediciones.json), [perfil previo](../voz-ref/perfiles-tts.json), [estudio humano](../voz-ref/VOZ-REFERENCIA.md). No se alteraron los guiones existentes ni sus anclas.
