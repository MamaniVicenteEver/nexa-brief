# PLAN · Lo que le contás a la IA no es privado: tus chats con ChatGPT y otros asistentes pueden terminar en un juicio

> Diseño: **rough (PROTOTIPO)**. Completar TODAS las secciones antes de escribir `assets/script.json`
> (guía: `../../explainer-kit/guides/storytelling.md`). Borrar las líneas de ayuda en cursiva.

## 1. Pedido

- **Tema (lo que pidió la persona):** privacidad de conversaciones con asistentes de IA y uso judicial de registros, con ChatGPT como caso documentado.
- **Público:** curiosos de 18–40 años en YouTube / Reels / TikTok, sin conocimientos previos.
- **Duración objetivo:** `target_minutes` de assets/script.json (rangos: `tools/lengths.py <min> --design <diseño>`).

## 2. Tesis y emoción

- **Punto crítico:** la orden de conservación de mayo de 2025 y la decisión posterior sobre la muestra de 20 millones.
- **Tesis:** privacidad, entrenamiento, borrado y privilegio legal son controles y conceptos diferentes.
- **Emoción dominante:** tensión, seguida de claridad práctica.
- **Por qué importa HOY:** las políticas y los controles afectan lo que se guarda y comparte cada vez que alguien utiliza un asistente.

## 3. Investigación (hechos verificados)

| # | hecho (fecha, cifra, nombre exacto) | fuente (URL) | ¿se usa? |
|---|---|---|---|
| 1–26 | Ver tabla documentada de investigación preliminar al final de este plan. | URLs y fechas en la tabla. | Sí |

- **Mitos o datos dudosos que NO vamos a decir:** toda conversación fue publicada; la retención general de 2025 continúa; el chat temporal se elimina inmediatamente; apagar entrenamiento borra el historial.
- **Cifras clave:** 20 millones de registros de una muestra específica, 30 días con excepciones; fuentes y fechas abajo.

## 4. Título y gancho

- **Opciones de título:** «ChatGPT guardó chats borrados por orden judicial»; «Veinte millones de chats ante un juez»; «Lo que cuentas a ChatGPT puede llegar a juicio».
- **Título provisional de apertura:** TUS CHATS ANTE UN JUEZ.
- **Antetítulo:** CHATGPT · PRIVACIDAD.
- **Primera frase:** «Una orden judicial puso veinte millones de chats como el tuyo en manos de una disputa legal».
- **Bucle abierto:** qué registros fueron conservados o revisados, quién tuvo acceso y qué cambian los ajustes.

## 5. Arco narrativo (curva de intensidad)

| acto | segmentos | intensidad | qué pasa | tono de voz |
|---|---|---|---|---|
| Golpe | s01 | 1.0 | Muestra judicial | alarma |
| Miedo | s02–s07 | 0.95 | Borrado, privilegio, enlaces | alarma |
| Estudio | s08–s11 | 0.8–0.85 | Orden Wang, Altman y caso Heppner documentado | tensión |
| Giro | s12–s14 | 0.6 | Conservar no es publicar; fin de la orden general | revelación |
| Verdad | s15–s41 | 0.6–0.65 | Muestra, retención, enlaces, precedente de correo, límites | explicativo |
| Qué hacer | s42–s44 | 0.6 | Ajustes, temporal y datos sensibles | explicativo |
| Pregunta | s45 | 0.5 | Límite personal | cercano |

## 6. Momentos de letra grande (cantidad según la duración: lengths.json)

| frase exacta del guion | por qué | palabra en acento |
|---|---|---|
| VEINTE MILLONES | Muestra judicial concreta | MILLONES |
| CONSERVAR NO ES PUBLICAR | Diferenciar operaciones | PUBLICAR |
| BORRAR NO ES INSTANTÁNEO | Plazo y excepciones | BORRAR |
| ENLACE NO ES PRIVADO | Alcance del enlace personal | ENLACE |
| ENTRENAMIENTO Y RETENCIÓN | Controles distintos | RETENCIÓN |
| CHAT TEMPORAL | Acción práctica | TEMPORAL |

## 7. Inventario visual y mapa visual

### 7a. Inventario visual (guides/components.md §6.1)

Objetos y mecanismos del tema que alguien que sabe del tema esperaría VER.

| objeto / mecanismo | planos que lo necesitan | ¿en el clímax? | componente del catálogo que lo dibuja | decisión (usar / crear `<familia>.<nombre>`) |
|---|---|---|---|---|
| Orden judicial | 4 | Sí | Ninguno específico | Aprobado `rough.legalWarrant` |
| Chat temporal y reloj | 3 | No | Ninguno específico | Aprobado `rough.temporaryChat` |
| Conversación con datos ocultos | 3 | Sí | Ninguno específico | Aprobado `rough.chatRedaction` |
| Calendario y archivo | 4 | Sí | Ninguno específico | Aprobado `rough.retentionCalendar` |

- Mínimo de componentes propios según la duración (1 · 2 · 3 · 4 para 5 · 10 · 15 · 30 min).
  Si el tema no tiene objetos propios, escribir "sin componentes propios: <motivo>".

### 7b. Mapa visual (segmento → componentes)

| seg | qué se dice (resumen) | componente(s) | medio (foto) |
|---|---|---|---|
| s01–s07 | Orden, retención, enlace | apertura y fotografías; sin iconos | preocupada.jpg, teléfono.jpg |
| s08–s20 | Tribunal, órdenes y muestra | `rough.legalWarrant` y `rough.chatRedaction`, al menos dos planos cada uno; fotos | tribunal.jpg, servidores.jpg |
| s21–s35 | Retención, entrenamiento, búsqueda | `rough.retentionCalendar` y `rough.temporaryChat`, al menos dos planos cada uno; fotografías | datos.jpg, teclado.jpg |
| s36–s45 | Correo, acciones y pregunta | línea de tiempo, controles, pregunta | oficina.jpg, portátil.jpg |

- **Componentes propios a crear** (de 7a): nombre, qué dibuja, params → se crean en
  `assets/components/` y se aprueban con `kit.py components` (guides/components.md §6) ANTES del storyboard.

## 8. Medios necesarios

| archivo (nombre corto) | qué tiene que mostrar | búsqueda sugerida | escena |
|---|---|---|---|
| preocupada.jpg | Mujer con teléfono, ilustrativa | worried woman phone | Miniatura y apertura |
| telefono.jpg, persona.jpg, hogar.jpg | Uso cotidiano del teléfono | woman smartphone | Vida privada |
| servidores.jpg, datos.jpg | Infraestructura digital ilustrativa | computer data center servers | Retención |
| tribunal.jpg | Tribunal neoyorquino ilustrativo, no el edificio del caso | courthouse new york | Proceso judicial |
| oficina.jpg, teclado.jpg, portatil.jpg | Trabajo con computadora | person laptop typing | Datos laborales |

## 9. Publicación (se copia a `publish.json`)

Sin emojis en ningún texto (títulos, descripciones, captions, comentario fijado).

- **Título provisional:** Veinte millones de chats ante un juez.
- **Descripción y capítulos:** pendiente de transcripción y tiempos reales del manifest.
- **Tags:** ChatGPT, privacidad, OpenAI, inteligencia artificial, datos personales, chats, tribunal, entrenamiento, chat temporal, enlaces compartidos, tecnología, NodeTech.
- **Texto TikTok/Reels:** Una orden judicial puso conversaciones de ChatGPT en una disputa legal. ¿Qué guardarías para ti?
- **Miniatura provisional:** TUS CHATS EN JUICIO; cifra atribuida a la muestra, imagen ilustrativa.

## 10. Riesgos y verificación

- Datos sensibles: ejemplos hipotéticos sin presentar a la persona fotografiada como afectada; no mostrar conversaciones privadas reales.
- Verificado dos veces: muestra de 20 millones, fechas y alcance en las órdenes judiciales y la declaración de OpenAI. Falta acceso directo a la declaración de Stuckey en X, que respondió 403.
- El fallo Heppner se refiere a documentos obtenidos de sus dispositivos y a ese litigio concreto; no demuestra que Anthropic los entregara ni fija una regla universal. La resolución del 09-03-2026 ordena producir otros lotes, pero no acredita por sí sola su entrega efectiva.

## Investigación preliminar · 30 de octubre de 2026

**Punto crítico:** una orden obligó a conservar chats, incluidos eliminados y temporales; otra decisión posterior trató una muestra distinta de 20 millones de conversaciones. **Tesis:** un chat no es público por defecto, pero privacidad, entrenamiento, borrado y privilegio legal son asuntos diferentes. Público general; 12 minutos. Tema dado por el usuario, sin candidatos alternativos.

Las fuentes de OpenAI expresan la postura de una parte en el litigio. Fecha de consulta de las páginas de ayuda: 30-10-2026.

| # | Hecho, fecha y alcance | Fuente | Uso |
|---|---|---|---|
| 1 | Una orden obligó a conservar registros que se habrían eliminado, incluidos chats de consumo eliminados y temporales. | [Orden judicial, 13-05-2025](https://cases.justia.com/federal/district-courts/new-york/nysdce/1%3A2023cv11195/612697/551/0.pdf); [OpenAI, 05-06-2025, actualizado 22-10-2025](https://openai.com/index/response-to-nyt-data-demands/) | Sí |
| 2 | La obligación general de retención indefinida terminó el 26-09-2025, según OpenAI. | [OpenAI, 22-10-2025](https://openai.com/index/response-to-nyt-data-demands/) | Sí |
| 3 | OpenAI dijo que guardaría un conjunto histórico limitado de abril–septiembre de 2025. | [OpenAI, 22-10-2025](https://openai.com/index/response-to-nyt-data-demands/) | Sí |
| 4 | El contenido retenido bajo la primera orden no se compartía automáticamente con el Times. | [OpenAI, 05-06-2025](https://openai.com/index/response-to-nyt-data-demands/) | Sí |
| 5 | OpenAI describió acceso limitado y auditado de personal legal y de seguridad a ese conjunto. | [OpenAI, 05-06-2025](https://openai.com/index/response-to-nyt-data-demands/) | Sí |
| 6 | Una orden posterior trató la producción de una muestra de 20 millones de registros de conversaciones de usuarios. La jueza Ona Wang la mantuvo el 02-12-2025 y el juez Sidney Stein confirmó la decisión el 05-01-2026. | [Orden de Wang, 02-12-2025](https://cases.justia.com/federal/district-courts/new-york/nysdce/1%3A2023cv08292/606655/812/0.pdf); [orden de Stein, 05-01-2026](https://cdn.arstechnica.net/wp-content/uploads/2026/01/NYT-v-OpenAI-Order-1-5-26.pdf) | Sí |
| 7 | La muestra de consumo fue seleccionada de conversaciones entre diciembre de 2022 y noviembre de 2024, según OpenAI. | [OpenAI, 12-11-2025](https://openai.com/index/fighting-nyt-user-privacy-invasion/) | Sí |
| 8 | Enterprise, Edu, Business y API no estaban incluidos en esa muestra concreta, según OpenAI. | [OpenAI, 12-11-2025](https://openai.com/index/fighting-nyt-user-privacy-invasion/) | Sí |
| 9 | El 16-12-2025 OpenAI dijo que daba acceso a datos desidentificados bajo controles. | [OpenAI, actualización 16-12-2025](https://openai.com/new-york-times/) | Sí |
| 10 | Una actualización posterior indica que el juez resolvió la apelación y OpenAI cumplió la orden; no equivale a publicación general. | [OpenAI, consulta 30-10-2026](https://openai.com/new-york-times/) | Sí |
| 11 | La desidentificación intenta retirar o enmascarar identificadores; no implica imposibilidad de reidentificación. | [OpenAI, 16-12-2025](https://openai.com/new-york-times/) | Sí |
| 12 | El 23-07-2025 Altman advirtió que las conversaciones con IA no tenían el mismo privilegio legal que ciertas conversaciones profesionales. No es una regla universal para todos los países. | [Entrevista original con Theo Von, 23-07-2025](https://www.youtube.com/watch?v=aYn8VKW6vXA&t=2579s); [transcripción](https://fight.fudgie.org/search/show/tpw/episode/20250723_Wed) | Sí |
| 13 | Los chats ordinarios y archivados permanecen hasta su eliminación o una política aplicable. | [OpenAI, retención, consulta 30-10-2026](https://help.openai.com/en/articles/8983778-what-is-temporary-chat) | Sí |
| 14 | Al borrar, se programa la eliminación dentro de 30 días con excepciones legales, de seguridad o para datos ya desidentificados. | [OpenAI, retención](https://help.openai.com/en/articles/8983778-what-is-temporary-chat) | Sí |
| 15 | Un chat temporal no aparece en el historial salvo que se guarde. | [OpenAI, chat temporal](https://help.openai.com/en/articles/8914046-temporary-chat-faq) | Sí |
| 16 | OpenAI puede conservar una copia temporal hasta 30 días por seguridad; guardarlo lo convierte en chat ordinario. | [OpenAI, chat temporal](https://help.openai.com/en/articles/8914046-temporary-chat-faq) | Sí |
| 17 | Mientras siga siendo temporal, el chat no se usa para mejorar modelos, según OpenAI. | [OpenAI, chat temporal](https://help.openai.com/en/articles/8914046-temporary-chat-faq) | Sí |
| 18 | Desactivar «Mejorar el modelo para todos» no borra los chats. | [OpenAI, controles](https://help.openai.com/en/articles/7730893-data-controls-faq) | Sí |
| 19 | Al enviar feedback, OpenAI indica que la conversación asociada puede usarse para entrenamiento incluso con esa opción desactivada. | [OpenAI, controles](https://help.openai.com/en/articles/7730893-data-controls-faq) | Sí |
| 20 | Business, Enterprise, Edu y API no entrenan por defecto con entradas y salidas; pueden existir políticas del espacio. | [OpenAI, controles](https://help.openai.com/en/articles/7730893-data-controls-faq) | Sí |
| 21 | En una cuenta personal, cualquiera con el enlace compartido puede abrirlo; borrarlo no borra copias guardadas por otros. | [OpenAI, enlaces compartidos](https://help.openai.com/en/articles/7925741-sharing-conversations-and-scheduled-tasks-in-chatgpt) | Sí |
| 22 | El 31-07-2025 OpenAI retiró una opción experimental para indexar chats compartidos que requería selección; no se indexaron todos los chats privados. | [Declaración original de Dane Stuckey, 31-07-2025](https://x.com/cryps1s/status/1951041845938499669), acceso directo bloqueado; [declaración reproducida](https://simonwillison.net/2025/Aug/3/privacy-design/); [observación independiente](https://techcrunch.com/2025/07/31/your-public-chatgpt-queries-are-getting-indexed-by-google-and-other-search-engines/) | Sí; verificar el original directamente antes de publicación |
| 23 | Un correo del 09-03-2001 fue admitido como prueba en el juicio Skilling el 14-02-2006. | [Departamento de Justicia de EE. UU., exhibit 004511](https://www.justice.gov/archive/enron/exhibit/02-14/index.htm) | Sí |
| 24 | En EE. UU. OpenAI describe condiciones para recibir requerimientos civiles válidos; no es una entrega automática a cualquier solicitante. | [OpenAI, 24-04-2026](https://openai.com/policies/civil-user-data-requests/) | Sí |
| 25 | Una acción de un GPT que envía información a terceros queda sujeta a la política de ese destinatario. | [OpenAI, chat temporal](https://help.openai.com/en/articles/8914046-temporary-chat-faq) | Sí |
| 26 | Memoria y entrenamiento son ajustes diferentes. | [OpenAI, controles](https://help.openai.com/en/articles/7730893-data-controls-faq) | Sí |
| 27 | En Gemini, los chats temporales y los realizados con «Keep Activity» desactivado se conservan en la cuenta 72 horas; los temporales no se usan para entrenar. Hay tratamientos adicionales si se envía feedback. | [Google, centro de privacidad de Gemini, consulta 30-10-2026](https://support.google.com/gemini/answer/13594961?hl=en) | Contexto adicional; no se atribuye esta regla a ChatGPT |
| 28 | Anthropic indica que los usuarios de Claude de consumo pueden autorizar el uso de sus chats para mejorar el modelo, con excepciones específicas de seguridad y participación voluntaria. | [Anthropic, uso de datos para entrenamiento, consulta 30-10-2026](https://privacy.anthropic.com/en/articles/10023580-is-my-data-used-for-model-training) | Contexto adicional; no se atribuye esta regla a ChatGPT |
| 29 | OpenAI indica que personal autorizado y proveedores sujetos a obligaciones pueden acceder al contenido cuando sea necesario para seguridad, soporte, asuntos legales o mejora del modelo salvo exclusión de entrenamiento. | [OpenAI, manejo de datos de consumo, consulta 30-10-2026](https://help.openai.com/en/articles/7039943-how-openai-handles-data-in-consumer-services) | Sí, s35 |
| 30 | El 17-02-2026 el juez Jed Rakoff explicó que documentos creados por Bradley Heppner con Claude por iniciativa propia y obtenidos de sus dispositivos no gozaban en ese caso de privilegio abogado-cliente ni protección de producto del trabajo; señaló que la intervención previa de un abogado podría cambiar el análisis. | [Resolución judicial original, 17-02-2026](https://storage.courtlistener.com/recap/gov.uscourts.nysd.652137/gov.uscourts.nysd.652137.27.0.pdf); [reproducción legible](https://www.hrlegalist.com/wp-content/uploads/sites/4/2026/03/1-United-States-v.-Heppner.pdf) | Sí |
| 31 | El 09-03-2026 Wang ordenó producir otros dos lotes, de 78 millones y 10 millones de registros, acordando un protocolo de desidentificación y privacidad; la orden no prueba por sí sola que ya se hayan entregado. | [Orden judicial, 09-03-2026](https://law.justia.com/cases/federal/district-courts/new-york/nysdce/1%3A2023cv08292/606655/1098/) | Sí |

Mitos a evitar: que todos los chats fueron publicados; que la orden general de conservación sigue vigente; que desactivar entrenamiento elimina el historial; que temporal significa borrado instantáneo; que todos los países tienen el mismo privilegio legal; que la muestra histórica y el conjunto de abril–septiembre son el mismo lote. La investigación se centra en OpenAI, no generalizar a otros proveedores.

Comparación histórica: correo de 2001 admitido en juicio en 2006 frente a la muestra de 20 millones en 2025; no presentar esas cifras como tasas o cantidades equivalentes. La cifra de 20 millones figura tanto en el escrito judicial como en la página de OpenAI.

La orden de Stein de enero de 2026 agrega un matiz esencial: OpenAI había propuesto una muestra de 20 millones frente al pedido de 120 millones; después se opuso a entregar la muestra completa y propuso búsquedas más restringidas. La jueza sostuvo que correspondía producir la muestra desidentificada. La fuente de OpenAI presenta su posición y no sustituye la resolución judicial.

**Títulos propuestos:** «ChatGPT guardó chats borrados por orden judicial»; «Veinte millones de chats ante un juez»; «Lo que cuentas a ChatGPT puede llegar a juicio». El gancho debe aclarar que la muestra no demuestra que el chat de cada espectador fuera seleccionado.

**Arco:** golpe y miedo sobre retención, muestra y enlaces; estudio de la orden; giro que separa conservar, acceder y publicar; verdad con fechas, límites y precedente de correo; acciones concretas; pregunta personal.

Fotos ilustrativas requeridas: persona con teléfono, teclado, servidores, tribunal, expedientes, correo, buscador y privacidad; mínimo nueve, con licencia y créditos. La miniatura no debe insinuar que la persona retratada es usuaria afectada.

**Pendiente:** verificar directamente la declaración original de Stuckey (X respondió 403); el host debe regenerar voz y transcripción sincronizadas con el guion actualizado. Luego corresponde el storyboard con los cuatro componentes aprobados, la hoja visual, los capítulos y la construcción y validación del paquete de publicación. Se añadió documentación primaria de Google y Anthropic como contexto. La retención, el acceso y los controles de privacidad pueden cambiar; revisar antes de publicar. Dos series iniciales fueron retiradas tras no pasar la rúbrica; la tercera y sus sustitutos lograron cuatro componentes aprobados, documentados en `work/components/review.md`.

### Revisión chats-mejoras · 30 octubre 2026

- Storyboard reconstruido con las anclas de la transcripción vigente: 79 planos, 23 tipos de componente, máximo seis usos por tipo. Se priorizó limitar las repeticiones y sostener las imágenes; por eso el control avisa que hay menos planos y menos momentos `common.lyric` que su recomendación genérica. Los dos `common.clip` duran 12,9 y 11,2 segundos por pedido expreso, por encima de la recomendación genérica de ocho. Las fotos repetidas funcionan como retornos visuales; ninguna se usa más de dos veces.
- Se revisaron las hojas 16:9 y 9:16, las capturas de miniatura y las capturas del final. Pregunta anclada antes de «Gracias por llegar hasta aquí»; el outro del canal empieza en 689,15 s y termina con el audio en 702,22 s. Los clips y la miniatura también se revisaron en ambos formatos.
- La miniatura C usa imagen fotográfica conceptual generada por IA: chat y mazo; no documenta un juicio real. La banda roja muestra la cifra de 20 millones, relativa a la muestra judicial, explicada en el video y la descripción.
- En la captura, el 404 informado corresponde al primer intento de `config.json`; la carga alternativa `assets/config.json` responde 200. Ambos clips y la imagen cargan con 200.
- QC existente de la voz regenerada: 147 ppm y WER aproximado 0,011. La transcripción incluye anomalías («2020 CELS», «120 veinte millones»); conviene escuchar esos pasajes antes de publicar. No se regeneró ni alteró la voz.
