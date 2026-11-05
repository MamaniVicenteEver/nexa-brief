# Análisis de referencias — figuras

Método: hojas de contacto a 1 fps de los 5 MP4 completos + tiras a 12 fps en 5 momentos
(caminata v2 0–2 s, susto v1 3,3–4,8 s, risa v4 7,3–8,7 s, corte v3 6,5–8,5 s, salto v5 6,6–7,8 s)
+ conteo de cuadros distintos (`mpdecimate`). No se escuchó el audio. "Observado" = visto en cuadros;
"supuesto" = inferencia.

| id | archivo (abreviado) | dur | fps | cuadros distintos | contenido |
|---|---|---|---|---|---|
| v1 | `…1108026314609003623…` | 10,0 s | 24 | 217/240 | dos amigos (gorra roja/camiseta amarilla; calvo/camiseta naranja), fondo beige liso, plano fijo |
| v2 | `…beach trip ideas…` (no listado en el encargo) | 20,0 s | 24 | 442/481 | pareja en recibidor ilustrado (puerta, planta, alfombra), intercambio de zapatillas/pantuflas |
| v3 | `…1070308667689831574…` | 31,7 s | 30 | 574/948 | gris, chico con gorra hacia atrás + otro con celular en sofá, subtítulos palabra a palabra |
| v4 | `…1108026314609003628…` | 10,0 s | 24 | 228/240 | mismos de v1: conversación, señalar, carcajada final con lágrimas |
| v5 | `…615726580353983687…` | 14,1 s | 30 | 219/422 | un personaje con cámara de fotos, salto, cartel final con texto persa |
| img | `image.png` 736×1104 | — | — | — | ficha: pelo castaño en punta, buzo blanco con capucha y cordones, manos en cadera, sonrisa ladeada |

## Diseño y proporciones (observado)
- Cabeza enorme y circular (≈ 30–35 % de la altura; ancho de cabeza ≈ 2× hombros). Contorno negro grueso
  y uniforme (≈ 1,2 % de la altura del personaje), relleno blanco o piel muy clara.
- Extremidades = una sola línea gruesa negra; manos tipo mitón negras; pies = óvalos negros o zapatillas
  dibujadas (v2). La ropa es la única masa de color (camiseta, buzo, vestido) con sombra suave plana (img).
- Vistas: frontal y 3/4 casi siempre; perfil en caminata y al girarse (v2 0–1 s). Las vistas 3/4 se
  logran desplazando ojos/boca hacia un lado del círculo (supuesto: no hay rig de cabeza en 3D).
- Identidad por pocos rasgos: gorra, pelo, lazo (chica v2), color de camiseta.

## Cara (observado)
- Ojos blancos grandes con pupila negra que se mueve hacia el interlocutor; tamaño cambia con la emoción
  (v1 4 s: ojos crecen al doble en el susto). Párpados a media altura para escepticismo (v1 3 s, v4 0–1 s).
- Cejas gruesas que cambian el ángulo (enojo v3 3–4 s, preocupación v2 5–6 s).
- Bocas: cerrada/sonrisa, abierta con dientes (grito v1 6 s), "O" (v1 4 s), sonrisa con dientes (v4 5 s),
  carcajada con lengua (v4 8 s). En v3 la boca cambia de forma casi en cada sílaba (tira 6,5–8,5 s).
- Extras: rubor (v2 11–12 s), lágrimas de risa (v4 8–9 s), líneas de susto (v1 4 s), "?" (v2 5–6 s),
  gotas de sudor (v5 3–4 s), destello de choque de manos (v2 19 s).

## Cuerpo, gestos y escucha (observado)
- Pose a pose con poses muy legibles: brazos abiertos de pregunta (v1 5 s, v3 0 s), manos a la cara
  (v1 6 s), señalar con el índice (v4 1 s), mano en la cadera (v2 12 s, img), brazos cruzados (v3 7 s).
- v3: entre poses hay un cuadro de "smear" (líneas de arrastre al cruzar los brazos, 6,83 s). Animado a
  2 cuadros (≈15 fps efectivos; 574 de 948 distintos). v1/v2/v4 casi todos los cuadros distintos
  (movimiento continuo, supuesto: interpolación o generación por IA).
- El que escucha nunca está congelado: parpadea, entrecierra los ojos, cambia la boca, mueve las manos
  (v1 3,3–4,2 s; v4 4–6 s mientras el otro habla).
- Reacciones con todo el cuerpo: risa doblándose y rebotando (v4 8–9 s), salto con brazos arriba (v5 7 s),
  caída cómica al suelo (v1 9 s).

## Caminata y suelo (observado)
- v2 0–1 s: entra caminando de perfil, se quita una zapatilla pisando el talón: el pie de apoyo queda fijo
  en el suelo mientras el otro se mueve. Hay sombra de contacto (v5) o ninguna (v1).
- Se usan inserts de los pies (v2 7 s, 13 s) en vez de mostrar toda la mecánica.

## Interacción y objetos (observado)
- Cambio de zapatillas por pantuflas (v2), choque de manos con destello (v2 19 s), apoyar la mano en el
  hombro (v2 18 s), celular sostenido y mirado (v3 8–12 s), cámara sostenida con dos manos (v5 1–9 s).
- El objeto sigue a la mano en todo momento; en v5 la cámara gira para mostrar la pantalla.

## Escenarios, cámara y montaje (observado)
- Fondos: liso beige (v1/v4), blanco con sombra (v5), interior ilustrado plano en colores suaves sin
  tinta (v2), gris con sofá (v3). El personaje tiene más contraste que el fondo.
- v1/v4: plano fijo a dos. v2: plano a dos + inserts de detalle. v3: cámara muy cerrada con paneo
  rápido de un personaje al otro (7,6–8 s), punch-ins al que habla, siempre 9:16 y caras en el tercio
  superior. v5: un plano y un corte a cartel final.
- Subtítulos (v3): una palabra en mayúsculas, blanca con contorno, centrada en el tercio medio.

## Qué produce la sensación de calidad
1. Línea gruesa y uniforme + siluetas claras en cada pose. 2. Expresión facial que cambia con cada beat
(no solo la boca). 3. El que escucha reacciona. 4. Pausas: poses sostenidas con micro movimiento.
5. Exageración en los picos (ojos al doble, cuerpo doblado). 6. Cámara que acompaña al que habla.

## Reutilizable (para el motor)
- Personaje parametrizado (cabeza, pelo, accesorio, ropa, colores) con un solo esqueleto.
- Banco de expresiones (ojos, párpados, cejas, boca) y visemas; banco de poses de brazos; acciones.
- Glifos FX: líneas de susto, ?, !, sudor, rubor, lágrimas, destello, líneas de movimiento.
- Encuadres: a dos, medio, primer plano, insert de detalle, paneo entre hablantes.

## Laboratorio `animation-lab/cartoon-road-march` (revisado: archivos, salida MP4, Studio en :3039)
- Motor real: Three.js 0.187 + HyperFrames 0.9.6; personajes = tarjetas planas dibujadas en canvas
  colocadas en un mundo 3D con sombreado toon, tinta, bloom y desenfoque. Única acción: marchar.
- Parametrizado: solo la cámara (`assets/camera.json`: fixed/follow/dolly/move, validada, seek
  determinista con tests). Escenarios en `src/episodes/scenery.ts` (código). `src/style/cast.ts` tiene
  constantes propias de una historia (`HITS`, `SWING_T`, `PUSH0`).
- Original vs Migración: misma escena; Original = funciones de cámara anteriores (`camera/original.ts`),
  Migración = rig JSON. No cambia personajes ni acciones.
- Coste: render 10 s 720×1280 = 206,9 s (≈ 20× tiempo real, pico RSS 1,23 GiB). Tres episodios de 15 s:
  8 239 586 tokens totales, de los cuales 8 092 800 de entrada en caché, 99 553 sin caché y 47 233 de
  salida: el volumen lo explica la relectura de contexto grande en cada turno del agente.
- Sin caras animadas, sin habla, sin visemas, sin objetos sujetos, sin audio.
