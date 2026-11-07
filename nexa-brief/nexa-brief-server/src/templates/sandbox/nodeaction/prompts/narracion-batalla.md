Escribe la narración en off de un video corto de animación (unos 30 segundos de voz).

ESCENA: fondo blanco. Dos bandos de figuritas tipo stickman se enfrentan con pistolas de pintura.
El bando "Tinta" (negro, visor rosa) tiene un protagonista: una figura de melena negra que se llama Wick.
El bando "Color" son cinco figuras con cascos de colores (verde, naranja, cian, morado, amarillo).
Los dos compañeros de Wick caen durante la pelea. Wick salta, corre, se arrodilla y dispara;
derriba a los cinco de Color uno por uno y al final queda solo, de pie, con la pistola en alto.

ESTILO: narrador épico y con humor seco, como un tráiler de película de acción, español latinoamericano
neutro, frases cortas (5 a 14 palabras), nada de groserías, nada de violencia real (es pintura).

REQUISITOS OBLIGATORIOS (se usan para sincronizar la animación con la voz, deben aparecer EXACTAMENTE así,
en este orden y una sola vez cada una en todo el texto):
  1. la palabra "silencio" (al principio, cuando todos se apuntan)
  2. la palabra "primero" (cuando cae el primer rival)
  3. la palabra "segundo"
  4. la palabra "tercero"
  5. la palabra "cuarto"
  6. la palabra "último" (con tilde)
  7. la palabra "pie" (al final, cuando Wick queda de pie solo)
Deja al menos 2 oraciones entre "primero" y "último" que no sean solo números; que suene natural.
Entre 60 y 75 palabras en total.

Devuelve SOLO un objeto JSON con esta forma:
{"segments": [{"id": "s01", "tone": "<tono>", "intensity": <0..1>, "text": "<texto>"}, ...]}
con 5 a 7 segmentos. "tone" debe ser uno de: intriga, suspenso, tensión, tensión creciente, aceleración,
clímax, peso, silencio, revelación, cierre, complicidad. Números siempre en palabras.
