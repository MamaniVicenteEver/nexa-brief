# Cara a Cara — comparaciones verticales

Referencia: dos capturas aportadas por el usuario, inspiradas en una comparación NASA/URSS con avatar ilustrado sobre blanco. Los textos de las capturas son referencias visuales, no instrucciones operativas.

Objetivo: plantilla nueva y reutilizable del Sandbox para videos cortos móviles 9:16, duración configurable 60–240 s. Muestra navegable de aproximadamente un minuto. NO grabar ni exportar MP4; no publicar en redes.

Diseño: cuatro franjas: (1) comparación con una o dos columnas, nombres e imágenes de sujetos y destacado según narración; (2) fotos o clips de apoyo intercambiables; (3) subtítulos sincronizados con voz; (4) presentador ilustrado que cambia de pose y admite sustituir personaje. Fondo blanco, negro y acento amarillo; diseño sencillo, legible, márgenes seguros para móvil.

Reutilizar: reproductor/tiempo/controles de sandbox/_proto, imágenes/poses de prueba-avatar-comparacion y adaptador existente src/adapters/image_gen. Añadir composición opt-in a _pizarra sin alterar plantillas existentes. Nunca copiar un motor entero dentro del prototipo.

Voz: NUEVA, amistosa, agradable, identidad consistente, español latinoamericano claro; distinta de Charon/documental de Node. Propuesta inicial Puck, personaje narrador Leo, tono conversacional curioso y cálido.

Muestra: NASA/Estados Unidos frente a programa espacial soviético. Distinguir primeras órbitas soviéticas y primer alunizaje tripulado estadounidense. Verificar hechos con fuentes primarias NASA; no inventar ganador universal ni cifras. Aproximadamente 130–145 palabras.

Entregables: PLAN.md antes de implementar, assets/config.json, scene.json, overlays.json, script/lyrics/song, info.json completo, instrucciones de reutilización, validación con navegador y pocas capturas temporales (limpiar al finalizar).
