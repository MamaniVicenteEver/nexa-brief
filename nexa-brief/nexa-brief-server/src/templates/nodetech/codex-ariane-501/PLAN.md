# PLAN · El número que desvió a Ariane 5

> Diseño: **rough (PROTOTIPO)**. Punto crítico: el overflow de una conversión de 64 bits a 16 bits a los 36,7 segundos de vuelo.

## 1. Pedido

- **Tema (lo que pidió la persona):** La explosión del primer Ariane 5 en 1996, causada por un error de software: un número que no cabía en el espacio donde querían guardarlo.
- **Público:** curiosos de 18–40 años en YouTube / Reels / TikTok, sin conocimientos previos.
- **Duración objetivo:** 3:00–4:30 (420–560 palabras).

## 2. Tesis y emoción

- **Punto crítico** (EL momento icónico alrededor del cual gira todo; un instante, una decisión, un error): A los 36,7 segundos, una variable relacionada con la velocidad horizontal desborda al convertirse de un número de coma flotante de 64 bits a un entero con signo de 16 bits.
- **Tesis en una frase** (lo que el espectador se lleva): Ariane 5 no cayó por un motor defectuoso: cayó porque software heredado mantuvo una función innecesaria, no protegió una conversión y convirtió una suposición vieja en una orden física.
- **Emoción dominante** (asombro / tensión / indignación / admiración / melancolía): asombro técnico que sube a vértigo y termina en una lección de ingeniería responsable.
- **Por qué importa HOY** (puente al presente, para el cierre): La redundancia no ayuda si todos los respaldos comparten el mismo supuesto; el software crítico debe probarse en el mundo real que va a gobernar.

## 3. Investigación (hechos verificados)

| # | hecho (fecha, cifra, nombre exacto) | fuente (URL) | ¿se usa? |
|---|---|---|---|
| 1 | El primer vuelo de Ariane 5 fue el 4 de junio de 1996 desde Kourou, Guayana Francesa. | https://www.esa.int/Newsroom/Press_Releases/Flight_501_failure-_first_information | sí |
| 2 | El vuelo fue normal hasta unos 36 segundos; los dos sistemas de referencia inercial fallaron casi simultáneamente. | https://www.esa.int/Newsroom/Press_Releases/Ariane_501_-_Presentation_of_Inquiry_Board_report | sí |
| 3 | El informe de la junta fija el primer fallo a H0 + 36,7 segundos y el segundo aproximadamente 0,05 segundos después. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 4 | El fallo ocurrió en una conversión de un valor de coma flotante de 64 bits a un entero con signo de 16 bits. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 5 | El valor era BH, “Horizontal Bias”, relacionado con la velocidad horizontal; superaba lo representable por un entero con signo de 16 bits. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 6 | La conversión no estaba protegida contra la excepción de operando; el procesador del sistema inercial se detuvo. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 7 | La rutina pertenecía a la función de alineación, útil antes del despegue, pero siguió operativa unos 40 segundos en vuelo. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 8 | Esa secuencia temporal provenía de un requisito de Ariane 4 y no era necesaria para Ariane 5. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 9 | Ariane 5 producía valores de velocidad horizontal considerablemente mayores que Ariane 4 en la parte inicial de la trayectoria. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 10 | Los dos sistemas inerciales usaban hardware y software idénticos, por eso la redundancia falló por la misma causa. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 11 | El sistema activo transmitió información de diagnóstico que la computadora de a bordo interpretó como datos de vuelo. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 12 | La computadora ordenó una gran corrección a las toberas de los propulsores y luego al motor Vulcain, para corregir una desviación que no existía. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 13 | El lanzador se desintegró a los 39 segundos por las fuerzas aerodinámicas; la autodestrucción se activó como estaba diseñada. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 14 | La carga llevaba los cuatro satélites Cluster de la ESA, destinados a estudiar interacciones entre la Tierra y el Sol. | https://www.esa.int/Newsroom/Press_Releases/Flight_501_failure-_first_information | sí |
| 15 | La junta concluyó que los ensayos no analizaron ni probaron adecuadamente el sistema inercial y el sistema completo de control de vuelo. | https://www.esa.int/Newsroom/Press_Releases/Ariane_501_-_Presentation_of_Inquiry_Board_report | sí |
| 16 | Una prueba con datos de trayectoria de Ariane 5 habría expuesto el mecanismo de fallo. | https://homepages.inf.ed.ac.uk/perdita/Book/ariane5rep.html | sí |
| 17 | Después se eliminó la alineación en vuelo, se revisó la gestión de excepciones y se dejaron de ejecutar funciones no usadas durante el vuelo. | https://www.esa.int/esapub/bulletin/bullet89/dalma89.htm | sí |

- **Mitos o datos dudosos que NO vamos a decir:** No diremos que “una línea de código” por sí sola explotó el cohete, ni que el entero “se dio vuelta” mágicamente. La cadena real incluye una función innecesaria, una conversión sin protección, dos unidades idénticas y datos de diagnóstico mal interpretados.
- **Cifras clave** (las que se convierten en momentos visuales): 4 de junio de 1996; 36,7 segundos; 0,05 segundos; 64 bits; 16 bits; unos 40 segundos; 39 segundos; 4 satélites Cluster; unos 4.000 metros de altitud al destruirse.

## 4. Título y gancho

- **Opciones de título** (3): “El número que desvió a Ariane 5”; “Cuando 16 bits no alcanzan”; “El error de los 37 segundos”.
- **Título elegido** (2–5 palabras, va GIGANTE en el primer cuadro; en 9:16 se parte en 2–4 renglones): EL NÚMERO QUE NO CABÍA.
- **Antetítulo / kicker** (protagonista · fecha): ARIANE 501 · 4 JUN 1996.
- **Primera frase de la narración** (fecha/lugar + algo imposible o una pregunta; < 12 palabras): “Cuatro de junio de mil novecientos noventa y seis. Kourou.”
- **Bucle abierto** (la pregunta que el espectador quiere ver respondida y que se cierra en el clímax): ¿Cómo puede un número equivocado hacer que un cohete se destruya?

## 5. Arco narrativo (curva de intensidad)

| acto | segmentos | intensidad | qué pasa | tono de voz |
|---|---|---|---|---|
| Gancho | s01 | 0.80 | Fecha, lugar y la promesa del número imposible. | suspenso |
| Contexto | s02–s04 | 0.55–0.65 | La arquitectura, la función heredada y el tiempo que sigue corriendo. | explicativo |
| Subida 1 (el problema crece) | s05–s06 | 0.70–0.72 | La trayectoria nueva empuja el número fuera de rango. | asombro / tensión |
| Bajada 1 (obstáculo, duda) | s07–s08 | 0.45–0.65 | Una metáfora simple revela por qué el respaldo también cae. | cercano / tensión |
| Subida 2 (la idea / el giro) | s09–s10 | 0.82–0.88 | Diagnóstico y datos falsos se convierten en una orden. | revelación / urgencia |
| **Clímax** | s11–s12 | 0.98–1.00 | El cohete corrige una desviación inexistente y se desintegra. | clímax |
| Caída (consecuencia, precio) | s13–s14 | 0.25–0.30 | Se pierden los satélites; la causa no fue el motor ni el clima. | peso / silencio |
| Resolución | s15–s16 | 0.50–0.65 | La investigación muestra qué prueba faltó y qué cambió. | reparación / reflexión |
| Cierre (vuelve al título) | s17 | 0.90 | Una cifra pequeña puede gobernar una máquina enorme. | cierre |

## 6. Momentos de letra grande (4–6)

| frase exacta del guion | por qué | palabra en acento |
|---|---|---|
| “Un número que no cabía desvió el cohete.” | Hace visible el gancho y el conflicto. | no cabía |
| “Sesenta y cuatro bits contra dieciséis.” | Resume el desajuste sin enseñar código ilegible. | dieciséis |
| “Dos sistemas. La misma caída.” | Convierte la redundancia compartida en un golpe. | misma |
| “Corrigió un giro que nunca ocurrió.” | Es el giro narrativo y la frase de clímax. | nunca |
| “El software gobernaba el mundo físico.” | Cierra con una consecuencia transferible. | físico |

## 7. Mapa visual (segmento → componentes del catálogo)

| seg | qué se dice (resumen) | componente(s) | medio (foto) |
|---|---|---|---|
| s01 | Despegue normal; aparece la promesa del número que no cabe. | `rough.title`, `rough.photo` | launch.jpg |
| s02 | A los 36 segundos fallan los dos sistemas inerciales. | `rough.tally`, `rough.flow` | — |
| s03 | Qué hace el sistema de referencia inercial. | `rough.icon` (chip), `rough.flow` | components.jpg |
| s04 | Una función de alineación heredada sigue activa en vuelo. | `rough.timeline`, `rough.icon` (clock) | — |
| s05 | Ariane 5 acelera horizontalmente más que Ariane 4. | `rough.compare`, `rough.gauge` | — |
| s06 | La conversión de 64 bits a 16 bits desborda. | `rough.load`, `common.punch` | — |
| s07 | Explicación cotidiana del casillero demasiado pequeño. | `rough.icon` (code), `rough.annotate` | — |
| s08 | La excepción detiene una unidad y luego la otra. | `rough.tally`, `rough.flow` | — |
| s09 | El diagnóstico llega a la computadora como si fueran datos. | `rough.flow`, `rough.annotate` | fragment.jpg |
| s10 | La computadora interpreta una inclinación inexistente. | `rough.choice`, `rough.icon` (warning) | — |
| s11 | Corrección física equivocada: el cohete gira. | `common.lyric`, `rough.annotate`, `rough.icon` (rocket) | launch.jpg |
| s12 | A los 39 segundos la estructura se desintegra y se activa la autodestrucción. | `rough.photo`, `common.flash`, `rough.gauge` | fragment.jpg |
| s13 | Los cuatro Cluster se pierden con el vuelo. | `rough.photo`, `common.punch` | fairing.jpg |
| s14 | Ni el clima ni los motores fueron la causa. | `rough.compare`, `rough.icon` (gear) | pad.jpg |
| s15 | Las pruebas no incluían la trayectoria real de Ariane 5. | `rough.timeline`, `rough.annotate` | — |
| s16 | Se corrigen alineación, excepciones y funciones innecesarias. | `rough.flow`, `rough.stack` | — |
| s17 | Callback: una máquina enorme gobernada por un número. | `rough.title`, `common.lyric` | — |

- **Componentes que FALTAN:** ninguno. `load`, `flow`, `compare`, `stack`, `choice`, `annotate`, `tally`, `gauge` y `rough.title` cubren el overflow, la redundancia y la cadena causa → efecto.

- **Componentes que FALTAN** (si un concepto clave no tiene buen componente): nombre propuesto,
  qué dibuja, params → se crean siguiendo `guides/components.md` ANTES del storyboard.

## 8. Medios necesarios

| archivo (nombre corto) | qué tiene que mostrar | búsqueda sugerida | escena |
|---|---|---|---|
| launch.jpg | Lanzamiento moderno de Ariane 5; se etiqueta como Ariane 5, no como imagen del vuelo 501. | “Ariane 5 launch Guyane” | s01 / s11 |
| pad.jpg | Plataforma ELA-3 del Centro Espacial Guayanés. | “Ariane 5 launch pad” | s14 |
| fragment.jpg | Fragmento recuperado de la estructura de un satélite de Ariane 501. | “Ariane 501 Fragment” | s09 / s12 |
| components.jpg | Componentes electrónicos de Ariane 5, para introducir la capa física del sistema. | “Belgian components for the Ariane 5 rocket” | s03 |
| fairing.jpg | Ensayo de carenado de Ariane 5, usado para representar la carga y el entorno del lanzamiento. | “Ariane 5 Payload Fairing Test” | s13 |

## 9. Publicación (se copia a `publish.json`)

- **Título YouTube** (≤ 70 caracteres, con gancho): Ariane 5: el número que no cabía y desvió un cohete.
- **Descripción** (3 párrafos: gancho, contexto, CTA + créditos de imágenes): Treinta y siete segundos después del despegue, el primer Ariane 5 perdió el control. No falló un motor: una conversión de datos llevó un número demasiado grande a un espacio demasiado pequeño.

  Este video reconstruye cómo una función heredada de Ariane 4, dos sistemas idénticos y una prueba que no representaba la trayectoria real convirtieron un error de software en una orden física.

  Suscríbete a PROTOTIPO para más historias de tecnología e innovación.

  IMÁGENES: ver `assets/media/CREDITS.md`.
- **Tags** (12–18): Ariane 5, Ariane 501, error de software, overflow, integer overflow, ingeniería de software, ESA, cohetes, tecnología, fallos de sistemas, software crítico, Kourou, informática, historia de la tecnología, PROTOTIPO.
- **Texto TikTok/Reels** (1–2 frases + pregunta): Un número de 64 bits no cabía en un entero de 16. Dos sistemas fallaron por la misma causa y el cohete corrigió un giro que nunca ocurrió.
- **Texto de miniatura** (≤ 4 palabras): NO CABÍA.

## 10. Riesgos y verificación

- Datos sensibles (muertes, delitos, salud): Se describe una pérdida material y técnica sin sensacionalismo ni atribuir culpa individual. Se distingue el dato comprobado de la simplificación pedagógica “un número que no cabía”.
- Qué se verificó dos veces: Cronología y cadena causal con el informe de la Junta de Investigación; causa del overflow, rutina heredada, redundancia y pruebas con el informe técnico transcrito; fecha, lugar y cuatro satélites Cluster con comunicados de ESA. Las fotos de lanzamiento moderno se marcarán como ilustrativas cuando no sean del vuelo 501.
- QA del storyboard: `kit.py check` pasa sin errores: 43 beats, 213,6 s, 504 palabras y 4 momentos `common.lyric`. Las planillas 9:16 y 16:9 fueron revisadas visualmente; los overlays de anotación tienen duración local para no invadir escenas posteriores. Quedan avisos menores de duración en título y planos explicativos, intencionales para el estilo `rough`.
- Control de voz/transcripción: la narración real está en `assets/song.mp3` (213,55 s, tres partes TTS). El modelo de transcripción real no terminó dentro del tiempo operativo; `assets/lyrics.json` usa tiempos sintéticos recalibrados a 213,58 s y conserva `metadata.fake: true`. Antes de publicar, reemplazarlo por una transcripción real y repetir `check`/sheet.
