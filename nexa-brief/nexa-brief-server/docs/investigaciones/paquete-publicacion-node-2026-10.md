# Paquete de publicación NODE: miniatura, títulos, descripción y tags

**Fecha:** 2026-10-12 · **Estado:** estudio para revisar. No hay cambios de código.
**Continúa:** `titulos-gancho-categorias-node-2026-10.md` (fórmula ANCLA + TENSIÓN + DETALLE y las 10 estrategias de gancho).
**Archivo de datos:** `paquete-publicacion-node-2026-10.json` trae el paquete completo de los 7 videos listos: miniatura, 3 títulos de YouTube, Facebook, TikTok, descripción armada, tags y comentario fijado.

---

## Resumen

1. **Cada pieza trabaja en un momento distinto de la decisión del espectador, y por eso cada una tiene su propia estrategia.** La miniatura tiene que *detenerlo* (visión rápida). El título, *hacerle querer saber* (curiosidad). La descripción, *darle confianza y hacerlo sentir parte* (razonamiento y vínculo social). Los tags, *ayudar a la máquina a clasificar*.
2. **La miniatura actual no funciona en el celular.** Hoy es el primer cuadro del video: letras finas hechas de unos y ceros, sin imagen, y con un texto tan corto («1202», «NO CABÍA») que solo no dice de qué trata el video. Por eso cada video tiene **dos opciones**: **A, solo texto**, con una frase de 5–9 palabras que nombra el tema y deja una tensión; y **B, texto + imagen**, donde la imagen dice el tema y el texto (2–5 palabras) solo agrega la tensión. Cada opción forma pareja con uno de los 3 títulos.
3. **El agradecimiento de la descripción se diseñó con 3 hallazgos de investigación:** sentirse valorado aumenta la ayuda, nombrar una identidad ("eres de las personas que…") mueve más que pedir una acción, y un pedido único funciona mejor que cinco. Hay 4 variantes que rotan entre videos.
4. **Los tags importan poco para YouTube.** La propia plataforma dice que su papel en el descubrimiento es mínimo, salvo para errores de escritura comunes. Los 3 primeros hashtags de la descripción sí se ven arriba del título.
5. **Hay 4 cosas que resolver antes de publicar** (sección 7). Entre ellas: el nombre del canal en las descripciones (PROTOTIPO / UNO CERO frente a NodeTech / NodeHistory) y dos videos sin fuentes registradas.

---

## 1. Una aclaración sobre "las partes del cerebro"

El modelo popular de "cerebro reptiliano, límbico y racional" (MacLean) **está descartado por la neurociencia**: el cerebro no funciona en tres capas separadas. Por eso este estudio no habla de "el cerebro reptil", sino de **procesos mentales con evidencia**, cada uno con su momento:

| Pieza | Cuándo actúa | Proceso mental | Qué dice la evidencia | Qué tiene que lograr | Cómo se mide |
|---|---|---|---|---|---|
| **Miniatura** | Mientras la persona desliza, en menos de medio segundo | **Visión rápida y atención automática** | El cerebro puede reconocer el contenido de una imagen vista apenas 13 milisegundos (Potter, MIT, 2014). En experimentos de búsqueda visual, los rostros con emoción se detectan antes que otros estímulos. | Que **se detenga** | Impresiones y CTR |
| **Título** | 1–2 segundos, después de la miniatura | **Curiosidad y anticipación de recompensa** | La curiosidad activa regiones del cerebro ligadas a la anticipación de recompensa (núcleo caudado) y mejora la memoria de la respuesta (Kang et al., 2009; Gruber et al., 2014). | Que **quiera saber** | CTR |
| **Primeros 3 s** (TikTok, Reels) | Al aparecer en el feed | **Atención a lo nuevo** | En el feed no hay miniatura: el primer cuadro y la primera frase hacen su trabajo. | Que **no deslice** | % que ve completo |
| **Descripción** | Durante o después de ver; la abre quien se interesó | **Razonamiento y confianza** + **vínculo social** | Agradecer aumentó la ayuda posterior porque las personas se sintieron valoradas (Grant y Gino, 2010). Nombrar una identidad movió más que nombrar una acción (Bryan et al., 2011). | Que **confíe, se sienta parte y vuelva** | Suscriptores, comentarios, compartidos |
| **Tags y hashtags** | No los lee una persona: los usa el sistema | **Clasificación del algoritmo** | YouTube dice que los tags tienen un papel mínimo, salvo para errores de escritura comunes. | Que **la máquina entienda el tema** | Tráfico de búsqueda y de hashtag |

---

## 2. Miniatura

### 2.1 Diagnóstico

Hoy la miniatura es `render/poster.jpg`, que sale del primer cuadro del video. En el diseño binary es el título gigante dibujado con unos y ceros sobre negro, con una etiqueta pequeña de fecha.

- Sin imagen, sin rostro, sin objeto: no hay nada que la visión rápida reconozca en 13 ms.
- Las letras hechas de caracteres pierden contraste al achicarse; a 210 px se ven como textura gris.
- **El texto es demasiado corto para ir solo.** «1202», «NO CABÍA» o «37 SEGUNDOS» no dicen de qué trata el video: quien no lo conoce no entiende qué es 1202 ni qué no cabía, y sigue de largo.

**Propuesta de producción:** una miniatura propia de 1280×720, compuesta aparte del video, con la identidad del diseño (tipografía y color), y probada a 210 px antes de publicar.

### 2.2 Dos opciones por video

Cada video tiene dos miniaturas posibles. La diferencia es **quién dice de qué trata el video**: el texto o la imagen.

| | **Opción A · Solo texto** | **Opción B · Texto + imagen** |
|---|---|---|
| **Qué se ve** | Una frase grande con el estilo de la plantilla (tipografía, color, textura) y nada más | Una imagen del video (rostro, objeto o lugar) + un texto corto, acomodados según la plantilla |
| **Quién dice el tema** | **El texto.** Tiene que nombrar el tema (ancla) y dejar una tensión, todo en la misma frase | **La imagen.** El texto solo agrega la tensión |
| **Largo del texto** | **5–9 palabras**, en 2–3 líneas de 18 caracteres como máximo | **2–5 palabras** |
| **Palabra resaltada** | Una, en el color de acento: la que lleva la tensión | Opcional |
| **Qué tiene que pasar** | La persona lee la frase, entiende el tema, le queda una pregunta y **baja al título** para contestarla | La persona ve la imagen + el texto y **hace clic directo**, o lee el título y después hace clic |
| **Ejemplo (apolo-1202)** | LA COMPUTADORA / DEL APOLO 11 / **SE RINDIÓ** | Margaret Hamilton con la pila de su código + «ELLA LO PREVIÓ» |

**Por qué el texto solo tiene que ser más largo:** sin imagen, nada le dice al cerebro de qué trata el video. Una cifra o una palabra suelta («1202», «CONDENADO») abre una pregunta sin bordes, y una pregunta sin bordes no genera curiosidad: genera confusión (es la brecha de curiosidad del estudio anterior, sección 2). La frase completa le da al lector el tema **y** una pieza que falta.

**Por qué con imagen puede ser más corto:** la imagen se reconoce antes de leer y ya pone el tema (un cohete, la Luna, un rostro, el muro). El texto solo necesita agregar lo que la imagen no dice. Pero **no tan corto que la pareja imagen + texto quede ambigua**: «UN NÚMERO NO CABÍA» sobre un cohete se entiende; «NO CABÍA» sola, no tanto.

### 2.3 La miniatura y el título son una pareja

Cada opción de miniatura se diseña **junto con uno de los 3 títulos** de YouTube (el campo `par_con_titulo` del JSON):

- La miniatura **no repite** palabras del título: lo completa. El script de generación lo verifica.
- Entre los dos tienen que contar el **ANCLA + TENSIÓN + DETALLE** (fórmula del estudio anterior). Si la miniatura pone el ancla y la tensión, el título pone el detalle, y al revés.
- En *Test & Compare*, conviene probar cada miniatura con su título de pareja.

Ejemplo, codex-titanic:

```
Miniatura A:  TITANIC: / 1.178 LUGARES, / 706 SALVADOS     ← ancla + dos cifras que no cierran
Título A:     Había botes en el Titanic. Salieron medio vacíos   ← explica por qué no cierran
→ la persona quiere saber cómo pudo pasar → clic
```

### 2.4 Reglas para las dos opciones

| Regla | Por qué |
|---|---|
| **Prueba de los 3 segundos:** mostrar la miniatura sola, a 210 px, a alguien que no conoce el video. Tiene que poder decir de qué trata y querer saber algo más | Si no puede decir el tema, la opción A necesita más ancla o la opción B necesita otra imagen |
| **Contraste alto**, legible en modo claro y oscuro | En el celular se ve pequeña y sobre fondos variados |
| **Diseño binary: letras sólidas.** Los unos y ceros van como textura de fondo o de acento, no dentro de las letras | Las letras hechas de caracteres se vuelven gris a 210 px |
| **Identidad constante por canal** (misma tipografía, color y posición del texto) | Que la gente reconozca "el canal de NodeTech" sin leer el nombre |
| **Imagen: un solo foco y 3 elementos como máximo**, ocupando 40 % o más del cuadro | La visión rápida reconoce una cosa por vistazo |
| **Respeto en temas de muerte** | En Titanic y Turing, nada de imágenes de víctimas ni de la muerte |

### 2.5 Criterios para la imagen de la opción B

En la opción B, la imagen es lo primero que el cerebro reconoce: decide si la persona se detiene. Tiene que cumplir dos trabajos a la vez: **decir de qué trata el video** y **ser fiel a lo que el video muestra**. Lo que la miniatura promete es lo que la persona espera ver; si no lo encuentra, se va, y YouTube mide justamente ese tiempo de visualización.

| # | Criterio | Qué revisar | Ejemplo que no pasa |
|---|---|---|---|
| 1 | **Fiel al video** | La persona, el objeto o el lugar aparece en el video o es exactamente lo que el video cuenta. Se puede recortar, subir el contraste o marcar con un círculo, sin cambiar el hecho | Los botes vacíos colgados en el Carpathia: estaban vacíos porque ya habían desembarcado, y sugerirían que salieron así del Titanic |
| 2 | **Reconocible a 210 px** (prueba de silueta) | Un solo sujeto que ocupe 40 % o más del cuadro, con silueta clara | El Ariane 5 de noche (un punto de luz); la nota de Schabowski (garabatos); la sala de la conferencia (gente diminuta) |
| 3 | **Dice el tema sin texto** | Un ícono que todos conocen le gana a un objeto técnico desconocido | El fragmento del Ariane: parece una caja en un museo |
| 4 | **Rostro o emoción, si hay** | Un rostro capta la mirada antes que un objeto; con expresión, mejor | — |
| 5 | **Imagen y texto se reparten el trabajo** | La imagen dice *de qué* trata y el texto *qué pasó*. El texto nunca describe lo que ya se ve | «UN COHETE» sobre la foto de un cohete |
| 6 | **Espacio limpio para el texto** | Recortar dejando un tercio libre (cielo, fondo oscuro) | — |
| 7 | **Tratamiento de la plantilla** | binary: blanco y negro de alto contraste; rough: contorno de trazo a mano y verde lima. La miniatura tiene que verse como el mismo video | — |
| 8 | **Limpia y con licencia** | Sin logos ni textos ajenos de fondo; crédito en la descripción si es CC BY-SA | La foto de Tim Berners-Lee: fondo rosa con logos de un evento |
| 9 | **Respeto** | Nada de víctimas ni de muerte | — |
| 10 | **Mejor del momento que de después** | Una foto posterior sirve para identificar a la persona; un objeto de la época cuenta mejor la historia | — |

**Evaluación de las candidatas** (revisadas en una hoja de contactos con todas las imágenes de cada video):

| Video | Imagen | Veredicto | Motivo |
|---|---|---|---|
| apolo-1202 | Pantalla DSKY | Débil | Objeto técnico que el público no reconoce; la pantalla está en blanco |
| | **Margaret Hamilton con la pila de su código** | ✅ Elegida | Foto icónica, rostro + objeto; aparece en el video |
| codex-ariane-501 | Despegue nocturno | ❌ | El cohete es un punto de luz a 210 px; además es otro vuelo (VA258), no el 501 |
| | Fragmento | ❌ | No se reconoce como cohete |
| | ⚠️ **Pendiente** | Conseguir | Foto diurna del Ariane 5 despegando o de la explosión del vuelo 501, con licencia verificada |
| nacimiento-ia-dartmouth | **John McCarthy** | ✅ Elegida | Rostro claro con expresión; es de años después, pero lo identifica |
| vago-pero-emocionante | Portada de la propuesta de 1989 | No disponible | No está entre los medios y la licencia (CERN) está sin verificar |
| | Tim Berners-Lee | ❌ | Fondo con logos y textos de un evento |
| | **La NeXT con su etiqueta «no la apaguen»** | ✅ Elegida | Objeto de la época con una nota escrita a mano; aparece en el video |
| codex-titanic | Bote salvavidas | ❌ | Se ve lleno y pequeño: contradice «sobraban lugares» |
| | Botes del Carpathia | ❌ | Sugeriría algo falso (criterio 1) |
| | **El Titanic de perfil** | ✅ Elegida | Ícono reconocible al instante |
| turing-enigma | **Retrato + Enigma** | ✅ Elegida | Rostro claro y máquina inconfundible |
| muro-de-berlin | Nota de Schabowski | ❌ | Garabatos a 210 px |
| | Conferencia de prensa | ❌ | Sala con personas diminutas |
| | **Joven con un martillo en un agujero del muro** | ✅ Elegida | Rostro, emoción, martillo y muro |
| | Multitud frente a la Puerta de Brandeburgo | Alternativa | Ícono fuerte |

**Estrategias de composición para la imagen:** T1 rostro + objeto (Turing + Enigma, Hamilton + su código), T2 objeto protagonista (la NeXT), T5 anotación a mano (la etiqueta de la NeXT encerrada en rojo), y un ícono a lo ancho con el texto en el cielo (el Titanic).

### 2.6 Las dos opciones de cada video

| Video | **A · Solo texto** (resaltado en negrita) | Pareja | **B · Texto + imagen** | Imagen | Pareja |
|---|---|---|---|---|---|
| apolo-1202 | LA COMPUTADORA / DEL APOLO 11 / **SE RINDIÓ** | Título A | ELLA LO PREVIÓ | Margaret Hamilton con la pila de su código | Título A |
| codex-ariane-501 | NO FUE EL MOTOR: / **UN NÚMERO** / DESTRUYÓ EL COHETE | Título B | UN NÚMERO NO CABÍA | ⚠️ Pendiente: Ariane 5 despegando de día o la explosión del 501 | Título A |
| nacimiento-ia-dartmouth | NOMBRARON / LA IA **ANTES** DE / QUE EXISTIERA | Título A | INVENTÓ LA PALABRA «IA» | John McCarthy | Título A |
| vago-pero-emocionante | PUDO COBRAR / POR **CADA PÁGINA** / DE INTERNET | Título B | TODA LA WEB VIVÍA AQUÍ | La NeXT con la etiqueta «no la apaguen» en un círculo rojo | Título A |
| codex-titanic | TITANIC: / 1.178 LUGARES, / **706 SALVADOS** | Título A | SOBRABAN LUGARES EN LOS BOTES | El Titanic de perfil | Título C |
| turing-enigma | EL CÓDIGO NAZI / CAMBIABA **CADA** / **MEDIANOCHE** | Título A | HÉROE… Y CONDENADO | Turing + Enigma | Título C |
| muro-de-berlin | **DOS PALABRAS** / SIN PERMISO / ABRIERON EL MURO | Título A | «DE INMEDIATO» | Joven con un martillo en un agujero del muro | Título B |

Los títulos de pareja son los de la sección 6 del estudio anterior (A, B o C). El JSON trae, para cada opción, el texto, las líneas, la palabra resaltada, la composición de la imagen y una explicación de por qué funciona la pareja.

**TikTok y Reels:** la portada es un cuadro del video vertical. Conviene elegir el cuadro donde aparece el texto de los primeros 3 segundos (sección 3), no el título en unos y ceros.

---

## 3. Títulos por plataforma

Cada plataforma muestra el título en un lugar distinto, y el mismo texto no sirve para las tres.

| | YouTube | Facebook | TikTok |
|---|---|---|---|
| **Dónde se ve** | Debajo de la miniatura, en búsqueda y en sugeridos | Título del video + primera línea del texto | No hay título: el **texto en pantalla de 0–3 s** y la caption |
| **Largo** | ≤ 60 caracteres (el resto se corta en el celular; máximo 100) | Primera línea ≤ 125 caracteres antes de "ver más" | Caption ≤ 150; se ven ~80–100 |
| **Estrategia** | ANCLA + TENSIÓN + DETALLE; 3 opciones para *Test & Compare* | El título que gane en YouTube + una primera línea que cuente el comienzo de la historia | Una frase que funcione sin sonido + una caption con el ancla al principio |
| **Emoción** | Curiosidad | Conversación (el público comenta y comparte más) | Sorpresa inmediata |

Los 3 títulos de YouTube de cada video, con su estrategia y emoción, están en la sección 6 del estudio anterior y en el JSON (`titulos.youtube`).

**Ejemplo completo (apolo-1202):**

- YouTube A: *La alarma que casi aborta la llegada a la Luna*
- Facebook, primera línea: *A 10 km de la Luna, la computadora del Apolo 11 mostró el error 1202. Houston tenía segundos para decidir.*
- TikTok, en pantalla: **QUEDABAN 30 SEGUNDOS** · caption: *La alarma que casi aborta el Apolo 11 🚀 Y la mujer que la había previsto. ¿La conocías?*

---

## 4. Descripción

### 4.1 Estructura: 9 bloques, cada uno con un trabajo

| # | Bloque | Qué hace | Proceso |
|---|---|---|---|
| 1 | **Gancho (2 líneas)** | Son las únicas visibles sin abrir la descripción. Repiten la tensión del título con otro dato. | Curiosidad |
| 2 | **Contexto** | 3–4 frases: qué vas a entender, con nombres y cifras del guion. | Razonamiento |
| 3 | **Capítulos** | Mapa del video. YouTube los muestra en la barra de reproducción. | Razonamiento (control) |
| 4 | **Reflexión** | La lección del video llevada a la vida del espectador. Es la parte de "conciencia" que pediste. | Reflexión personal |
| 5 | **Agradecimiento** | Una de las 4 variantes de la sección 4.2. | Vínculo social |
| 6 | **Pregunta** | Específica del tema, fácil de contestar. | Conversación |
| 7 | **Fuentes** | 2–3 fuentes primarias. Dan credibilidad y responden al "¿es verdad?". | Confianza |
| 8 | **Créditos de imágenes** | Obligatorios: las licencias CC BY-SA exigen atribución. | Cumplimiento |
| 9 | **3 hashtags** | Los 3 primeros aparecen arriba del título en YouTube. | Clasificación |

**Reglas de capítulos de YouTube:** el primero en 0:00, al menos 3, y cada uno de 10 segundos o más. Los tiempos del JSON salen de alinear el guion con la transcripción de Whisper, y el script de generación verificó estas reglas. Hay que confirmarlos contra el mp4 final, por si el render agrega algo al inicio.

### 4.2 El mensaje de agradecimiento

Todos los guiones ya terminan con un agradecimiento hablado ("Gracias por llegar hasta aquí… déjanos un like, suscríbete…"). El de la descripción **no lo repite**: lo lee quien abre la descripción, que suele ser alguien con interés. Por eso puede ser más personal.

**Principios usados:**

| Principio | Evidencia | Cómo se aplica |
|---|---|---|
| **Sentirse valorado** | En el estudio de Grant y Gino (2010), los recaudadores a quienes su director agradeció en persona hicieron más de 50 % más llamadas esa semana. El motor fue sentirse socialmente valorados. | Agradecer algo concreto: "por llegar hasta el final", "cada minuto que le dedicas". |
| **Identidad, no acción** | Bryan et al. (2011): preguntar por "ser votante" en vez de por "votar" aumentó la participación en dos elecciones reales. | "Eres de las personas que se quedan hasta el final de una historia." |
| **Reciprocidad** | Principio clásico de persuasión (Cialdini): quien recibe algo de valor tiende a devolverlo. No lo medimos en este estudio. | Primero lo que dimos (la historia, las fuentes), después el pedido. |
| **Un solo pedido** | Principio de diseño, sin estudio citado: cinco pedidos juntos (like, suscríbete, campana, comparte, comenta) compiten entre sí. | Cada variante pide una sola cosa. |
| **Impacto concreto** | Principio de diseño, sin estudio citado: explicar para qué sirve la ayuda la hace más fácil de dar. | "Ayuda a que YouTube lo muestre a más personas." |

**Las 4 variantes** (rotan entre videos, así ningún video repite el mismo texto):

| Variante | Mecanismo | Texto |
|---|---|---|
| **G1 · Identidad** | Identidad + valor del tiempo | Si llegaste hasta aquí, eres de las personas que se quedan hasta el final de una historia. Gracias de verdad. Cada minuto que le dedicas le dice a YouTube que estas historias valen la pena, y eso nos permite seguir investigando y contando la próxima. |
| **G2 · Reciprocidad** | Lo que dimos + un solo gesto | Gracias por ver el video completo. Cada historia la armamos con fuentes que puedes revisar abajo, y tu tiempo es lo que la hace posible. Si te dejó algo, un solo gesto ayuda muchísimo: compártelo con una persona a la que le encante {tema}. |
| **G3 · Pertenencia** | Comunidad + suscripción con beneficio | Gracias por quedarte. Esta comunidad la forma gente curiosa como tú, que prefiere entender a solo enterarse. Si quieres que sigamos, suscríbete: así la próxima historia te encuentra primero. |
| **G4 · Impacto** | Para qué sirve su apoyo | Gracias por llegar al final. Ver un video completo es la mejor forma de apoyarnos: ayuda a que YouTube lo muestre a más personas y nos permite seguir trayendo historias como esta. |

**Límites éticos (para que juegue con la emoción sin manipular):**

- **Nada de culpa:** nunca "si no te suscribes, este canal desaparece".
- **Nada falso:** no decir "días de investigación" si el video se produjo en horas, ni "somos un equipo pequeño" si no es así. Por eso G2 habla de *fuentes que puedes revisar*, algo verificable.
- **Nada de urgencia falsa:** nada de "solo hoy" ni "últimos lugares".
- **Respeto en temas de muerte:** en Titanic y Turing el tono es sobrio. La descripción de Turing no menciona su muerte; el video la cuenta con cuidado.

### 4.3 Comentario fijado

El comentario fijado se ve más que la descripción. El JSON trae uno por video con tres partes: gracias, un dato que no entró en el título y una pregunta que invita a proponer el próximo tema. Las respuestas sirven además para decidir qué videos hacer.

### 4.4 Facebook

Más corta: el gancho, la reflexión, la pregunta y 2 hashtags (`descripcion.facebook` en el JSON). En Facebook la conversación pesa más que el clic.

---

## 5. Tags y hashtags

| Tipo | Qué hacen de verdad | Regla |
|---|---|---|
| **Tags de YouTube** (campo oculto) | Papel mínimo en el descubrimiento, según YouTube. Ayudan cuando el tema se escribe mal a menudo. | 10–13 tags: el tema principal, sus variantes, el nombre en inglés y errores comunes (ej. "Apollo 11", "Tim Berners Lee", "Titanik"). Máximo 500 caracteres; ninguno de los 7 pasa de 235. |
| **Hashtags en la descripción de YouTube** | Los 3 primeros se ven arriba del título y llevan a una página del hashtag. Con más de 60, YouTube los ignora todos. | Exactamente 3: tema, personaje o evento, y canal (#NodeTech / #NodeHistory). |
| **Hashtags de TikTok** | TikTok funciona como buscador: ayudan a clasificar. | 3–4: tema, nicho, categoría y `#sabiasque`. Nunca `#fyp` ni `#viral`. |
| **Hashtags de Facebook** | Poco peso; lo que importa son las palabras clave del texto. | 2: tema y categoría. |

No conviene pegar listas de tags en la descripción: además de no ayudar, puede verse como spam.

---

## 6. Los 7 videos, resumidos

| Video | Canal | Miniatura A (solo texto) | Título YouTube (opción A) | TikTok, 0–3 s | Agradecimiento | Hashtags YouTube |
|---|---|---|---|---|---|---|
| apolo-1202 | NodeTech | LA COMPUTADORA DEL APOLO 11 SE RINDIÓ | La alarma que casi aborta la llegada a la Luna | QUEDABAN 30 SEGUNDOS | G1 Identidad | #Apolo11 #MargaretHamilton #NodeTech |
| codex-ariane-501 | NodeTech | NO FUE EL MOTOR: UN NÚMERO DESTRUYÓ EL COHETE | Un solo número destruyó un cohete en 39 segundos | TODO IBA BIEN HASTA EL SEGUNDO 37 | G2 Reciprocidad | #Ariane5 #ErrorDeSoftware #NodeTech |
| nacimiento-ia-dartmouth | NodeTech | NOMBRARON LA IA ANTES DE QUE EXISTIERA | Creyeron que en 2 meses harían pensar a una máquina | 2 MESES PARA CREAR LA IA | G3 Pertenencia | #InteligenciaArtificial #HistoriaDeLaIA #NodeTech |
| vago-pero-emocionante | NodeTech | PUDO COBRAR POR CADA PÁGINA DE INTERNET | Su jefe llamó «vaga» a la idea que creó la Web | SU JEFE ESCRIBIÓ: «VAGO» | G4 Impacto | #WorldWideWeb #TimBernersLee #NodeTech |
| codex-titanic | NodeHistory | TITANIC: 1.178 LUGARES, 706 SALVADOS | Había botes en el Titanic. Salieron medio vacíos | HABÍA BOTES | G1 Identidad | #Titanic #HistoriaReal #NodeHistory |
| turing-enigma | NodeHistory | EL CÓDIGO NAZI CAMBIABA CADA MEDIANOCHE | Ayudó a ganar la guerra y su país lo condenó | EL CÓDIGO CAMBIABA CADA MEDIANOCHE | G2 Reciprocidad | #AlanTuring #Enigma #NodeHistory |
| muro-de-berlin | NodeHistory | DOS PALABRAS SIN PERMISO ABRIERON EL MURO | La conferencia de prensa que derribó el Muro de Berlín | DOS PALABRAS ABRIERON EL MURO | G3 Pertenencia | #MuroDeBerlín #HistoriaReal #NodeHistory |

Las 9 demos del diseño (acuarela, carta, collage, cronica, enmienda, grunge, pelicula, periodico, pop) cuentan el mismo guion del Muro de Berlín y no tienen paquete propio. Publicar varias se vería como contenido repetido.

Todas las cifras de títulos, miniaturas y descripciones salen del guion de cada video.

---

## 7. Qué resolver antes de publicar

| # | Pendiente | Dónde | Por qué importa |
|---|---|---|---|
| 1 | **Nombre del canal.** Las descripciones actuales dicen "Suscríbete a PROTOTIPO" o "a UNO CERO"; el JSON usa NodeTech y NodeHistory. | `publish.json` de cada video | El espectador tiene que leer el mismo nombre que ve en el canal. ¿Cuál es el nombre real de cada canal? |
| 2 | **Fuentes faltantes** en apolo-1202 y turing-enigma (sus PLAN.md no tienen enlaces) | `PLAN.md` | Un video de historia sin fuentes pierde credibilidad y el bloque 7 queda vacío. |
| 3 | **Imagen nueva para la miniatura B** del Ariane 5: despegue de día o la explosión del vuelo 501 | codex-ariane-501 | Las dos imágenes actuales no pasan la prueba de 210 px. Si es de la ESA, hay que verificar la licencia. Sin ella, ese video usa la opción A (solo texto). |
| 4 | **Confirmar los capítulos contra el mp4 final** | los 7 videos | Los tiempos salen del audio; si el render agrega una intro, se corren. |

---

## 8. Cómo leer el JSON

```jsonc
{
  "mensajes_de_agradecimiento": { "G1_identidad": "…", "G2_reciprocidad": "…", "G3_pertenencia": "…", "G4_impacto": "…" },
  "criterios_imagen_opcion_b": [ "1. Fiel al video…", "2. Reconocible a 210 px…", … ],   // los 10 criterios de la sección 2.5
  "videos": [{
    "video_id": "apolo-1202", "canal": "NodeTech", "duracion": "3:53",
    "titulo_actual": "…",                               // para comparar
    "miniatura": {
      "estilo_plantilla": "rough · trazo a mano, verde lima sobre negro",
      "opcion_a_solo_texto": {
        "modo": "solo_texto", "lineas": ["LA COMPUTADORA", "DEL APOLO 11", "SE RINDIÓ"], "texto": "…",
        "resaltar": "SE RINDIÓ", "par_con_titulo": "A · La alarma que casi aborta…", "por_que": "…", "parte_del_cerebro": "…"
      },
      "opcion_b_texto_imagen": {
        "modo": "texto_imagen", "imagen": "assets/media/hamilton.jpg …", "composicion": "…",
        "texto": "ELLA LO PREVIÓ", "par_con_titulo": "A · La alarma que casi aborta…", "por_que": "…", "parte_del_cerebro": "…",
        "evaluacion_de_imagenes": [ { "imagen": "dsky.jpg", "veredicto": "débil", "motivo": "…" }, … ]
      }
    },
    "titulos": {
      "youtube": [ { "opcion": "A", "texto": "…", "estrategia": "…", "emocion": "…" }, … ],  // 3 para Test & Compare
      "facebook": { "titulo": "…", "primera_linea": "…" },
      "tiktok":   { "texto_pantalla_0_3s": "…", "caption": "…" }
    },
    "descripcion": {
      "youtube": "…",                         // texto completo, listo para pegar
      "youtube_visible_antes_de_mas": "…",    // los primeros 150 caracteres
      "facebook": "…",
      "mensaje_agradecimiento_usado": "G1_identidad"
    },
    "tags": { "youtube": [ … ], "youtube_caracteres": 204, "tiktok_hashtags": [ … ], "facebook_hashtags": [ … ] },
    "comentario_fijado": "…"
  }]
}
```

---

## 9. Cómo medir

Igual que en el estudio anterior: *Test & Compare* en YouTube con los 3 títulos y, en otra prueba, la miniatura A (solo texto) contra la B (texto + imagen), cada una con su título de pareja. Después de 8–10 videos se ve cuál de los dos modos rinde más en cada canal. YouTube elige por tiempo de visualización y la prueba dura hasta 2 semanas. **Una variable por prueba**: si cambian título y miniatura a la vez, no se sabe cuál funcionó. Para el agradecimiento, comparar suscriptores por cada 1.000 vistas entre las variantes G1–G4 después de 8–10 videos con cada una.

---

## 10. Qué cambiaría en el sistema (propuesta, no implementado)

| Cambio | Dónde | Efecto |
|---|---|---|
| Ampliar `publish.json` con `thumbnail` (estrategia, imagen, texto, variante B), 3 títulos de YouTube con estrategia, `facebook`, `tiktok_screen_text`, bloques de la descripción, variante de agradecimiento y comentario fijado | `publish.json` de cada video + generador de textos | El JSON de este estudio pasa a ser el formato real. |
| Componer la miniatura 1280×720 aparte del primer cuadro, en **dos modos**: solo texto (frase de 5–9 palabras con el estilo de la plantilla) y texto + imagen (la plantilla acomoda la imagen y un texto de 2–5 palabras). Con una prueba a 210 px | `kit.py poster` (o un comando `thumbnail` con `--modo texto|imagen`) | Miniatura legible en el celular y las dos opciones listas para probar. |
| Generar los capítulos desde la alineación guion ↔ Whisper y validar las reglas de YouTube | Producción del explainer | Capítulos exactos sin hacerlos a mano. |
| Rotar automáticamente G1–G4 y guardar cuál se usó | Generador de descripción | Permite medir qué agradecimiento convierte más. |
| Validar antes de publicar: títulos ≤ 60, primera línea de Facebook ≤ 125, caption ≤ 150, tags ≤ 500, fuentes no vacías, miniatura A de 5–9 palabras, miniatura B de 2–5, y que ninguna repita su título de pareja | Antes de publicar | Lo que hoy hizo a mano el script de este estudio. |

---

## Fuentes

- [MIT News — el cerebro identifica imágenes vistas 13 milisegundos (Potter, 2014)](https://news.mit.edu/2014/in-the-blink-of-an-eye-0116)
- [ScienceDaily — el mismo estudio](https://www.sciencedaily.com/releases/2014/01/140116091145.htm)
- [Calvo y Nummenmaa (2008) — detección de expresiones faciales en búsqueda visual (PDF)](https://emotion.utu.fi/wp-content/uploads/2016/11/Calvo_Nummenmaa_JEPGen_08.pdf)
- [Karolinska Institutet — cómo la emoción facial captura la atención visual](https://openarchive.ki.se/articles/thesis/The_face_of_wrath_how_facial_emotion_captures_visual_attention/26924734/1)
- [Kang et al. (2009), "The Wick in the Candle of Learning" — curiosidad, circuito de recompensa y memoria](https://neuroecon.berkeley.edu/papers/papers_files/Kang_PsychSci_2009.html)
- [Gruber, Gelman y Ranganath (2014), curiosidad y memoria (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4252494/)
- [Harvard Gazette — el poder de un "gracias" (Grant y Gino, 2010)](https://news.harvard.edu/gazette/story/2013/03/the-pow)
- [Stanford GSB — la gratitud, un regalo que sigue dando](https://www.gsb.stanford.edu/insights/frank-flynn-gratitude-gift-keeps-giving)
- [Psychology Today — el poder de un simple gracias del jefe](https://www.psychologytoday.com/ca/blog/work-matters/201008/the-power-of-a-simple-thank-you-from-the-boss)
- [Bryan, Walton, Rogers y Dweck (2011), "Motivating voter turnout by invoking the self", PNAS (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3150938)
- [Stanford SPARQ — "No solo votes, sé votante"](https://sparq.stanford.edu/solutions/dont-just-vote-be-voter)
- [Wikipedia — el cerebro triuno y por qué se descartó](https://en.wikipedia.org/wiki/Triune_brain)
- [BBC Science Focus — la mentira del "cerebro de lagarto"](https://www.sciencefocus.com/the-human-body/the-lizard-brain-lie)
- [ScienceAlert — no tienes un "cerebro de lagarto"](https://www.sciencealert.com/you-dont-actually-have-a-lizard-brain-evolutionary-study-reveals)
- [Clipchamp — guía de tags de YouTube (cita de YouTube sobre su papel mínimo)](https://clipchamp.com/en/blog/youtube-tags-ultimate-guide/)
- [Yoast — cuántos tags usar en YouTube](https://yoast.com/youtube-tags/)
- [Ahrefs — tags de YouTube](https://ahrefs.com/blog/youtube-tags)
- [Storyblocks — cómo agregar capítulos en YouTube](https://www.storyblocks.com/resources/tutorials/how-to-add-chapters-to-youtube-video)
- [Dickinson College Media Center — capítulos de YouTube (2026)](https://blogs.dickinson.edu/mediacenter/2026/01/12/youtube-adding-video-chapters/)
- [RecurPost — límites de caracteres y hashtags en TikTok](https://recurpost.com/tiktok-scheduler/tiktok-character-limits-and-hashtags/)
- [TypeCount — límite de la caption de TikTok en 2026](https://typecount.com/blog/tiktok-caption-character-limit)

**Sobre la evidencia:** los estudios de rostros son de laboratorio (búsqueda visual), no de miniaturas de YouTube. Los de curiosidad usaron preguntas de trivia. Los de gratitud e identidad se hicieron con recaudadores y votantes, no con espectadores. Son la mejor base disponible para *diseñar* cada pieza; la prueba de que funciona en tus canales es *Test & Compare* y la medición de la sección 9.
