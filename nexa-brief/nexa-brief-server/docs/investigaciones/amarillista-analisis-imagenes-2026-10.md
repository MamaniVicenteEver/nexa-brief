# Estrategia amarillista y posts de imagen: análisis

La estrategia aporta una tensión comprensible y un giro verificable, útiles para un carrusel de cinco láminas.
La evidencia respalda la atención a la negatividad y la curiosidad, pero no demuestra que el arco completo retenga mejor.
Ocultar contexto esencial, exagerar amenazas y fabricar debate puede reducir confianza o distribución.
Conviene mostrar el hecho y su alcance desde la portada, devolver contexto pronto y evitar predicciones personales.
Una imagen única debe contener afirmación, matiz y fuente: no puede depender de una lámina posterior.
Los formatos de documento, antes/ahora, línea temporal, portada y gráfico se adaptan mejor al arco.
El motor actual solo admite una o cinco láminas; adaptar la narrativa es una propuesta, no una función existente.
Un piloto aleatorizado frente a documental debe medir alcance, interacción, abandono y confianza antes de adoptar el tono.

## 1. Estado actual y alcance del recuento

La configuración [`_active.json`](../../src/skills/explainer/strategies/narrative/_active.json) establece amarillista como predeterminada para todas las categorías. Su [JSON](../../src/skills/explainer/strategies/narrative/narrative_amarillista_v1.json) contiene nueve actos, dos de ellos no hablados: título y outro. La web presenta los siete hablados en este orden. Documental, en contraste, usa gancho con fecha/lugar y protagonista, contexto, subidas y bajadas, clímax, consecuencia y resolución; no exige esta secuencia de alarma y pregunta. Su [JSON](../../src/skills/explainer/strategies/narrative/narrative_documental_v1.json) tiene diez actos, incluido outro.

| Acto hablado | Qué solicita el JSON | Traslado propuesto a cinco láminas |
|---|---|---|
| Golpe | 1–2 frases, hecho o cifra más fuerte, «tú», sin fechas ni contexto; intensidad máxima. | 1: titular y alcance mínimo. |
| Miedo | Apilar hechos reales que empeoran, sin alivio, en segunda persona; terminar con una incógnita. | 2: riesgo concreto y acotado; no omitir condiciones esenciales. |
| El estudio | Prueba principal, fuente y fecha, detalle y caso humano; intensidad alta. | 2: evidencia y denominador; no inventar una persona. |
| El giro | Recuperar contexto omitido, sin burlarse del público. | 3: limitación o interpretación alternativa. |
| La verdad | Cuadro completo, resolver cada alarma y añadir antes/ahora histórico con cifras. | 3–4: conclusión y comparación si es pertinente y está sustentada. |
| Qué hacer | Dos o tres acciones o señales concretas, sin sermón. | 4: aplicación proporcionada; en historia puede ser una clave de lectura. |
| La pregunta | Una pregunta cercana con dos lados, mostrada en pantalla; máximo ocho palabras. | 5: conclusión y pregunta opcional que admita más de dos respuestas. |

El título es una apertura no hablada; el outro usa la voz del canal y queda fuera del guion. Los pesos son relativos, no tiempos. En carrusel se propone hacer visibles la fuente y los matices junto al dato relevante, incluso en portada si son esenciales. Siete láminas, una por acto, serían una alternativa editorial conceptual; no pasan hoy el validador de cinco láminas.

| Qué se cuenta | Cantidad | Criterio reproducible |
|---|---:|---|
| Actos | 9 | Siete hablados más título y outro no hablados. |
| Técnicas de `retention` | 5 | Cinco objetos con ID propio. |
| Reglas de título | 16 | Entradas de `title.levels.*.rules`: 2 básico + 2 medio + 4 alto + 8 negro. |
| Checks declarados | 5 | Cinco campos de `checks`, no cinco pruebas individuales. |
| **Total** | **35** | Suma de entradas heterogéneas; no es una puntuación de eficacia. |

El total sería 33 si se contaran solo los actos hablados. Los cuatro niveles no se suman otra vez a sus reglas. Se excluyen reglas del gancho, miniatura, imagen y pregunta, ejemplos, validaciones generales y verificaciones internas derivadas; una descomposición distinta produce otro total.

| Nivel | Regla y ejemplo del JSON |
|---|---|
| Básico | Alarma explicada y comprensible: «La IA ya está dejando sin trabajo a los programadores». |
| Medio | Segunda persona y consecuencia personal: «La IA te va a reemplazar (y ya empezó)». |
| Alto | Sentencia breve, amenaza directa permitida, hechos concretos reales, máximo 60 caracteres: «Te vas a quedar sin empleo». |
| Negro, por defecto | Palabra clave en mayúsculas, léxico visceral, sin condicional, curiosidad y pregunta de miedo; verificar alcance y causalidad, máximo 60 caracteres: «Amazon DESPIDIÓ a unos 250. ¿Eres el siguiente?». |

Estos son ejemplos del sistema, no afirmaciones que este estudio avale. En particular, una predicción absoluta sobre el empleo personal no queda probada por un caso o una proyección. La miniatura de video preferida es C, hasta seis palabras; eso no constituye una regla automática de ocho palabras para el motor de imagen.

### Qué se comprueba y qué queda en instrucciones

El [esquema](../../src/core/explainer/narrative/models.py) verifica estructura, tipos, IDs únicos y referencias a actos. El [prompt](../../src/core/explainer/narrative/prompts.py) pasa actos, gancho, técnicas, título, pregunta y ejemplos al estratega y al productor; pide intensidades por segmento y que las descripciones terminen en la pregunta. La narrativa documental no añade ese bloque a los prompts.

El [check del kit](../../src/templates/_tools/explainer-kit/tools/narrative_check.py) exige actos hablados conocidos y los cinco obligatorios —golpe, miedo, giro, verdad, pregunta—; revisa el orden de la **primera aparición** de los presentes, intensidad del primer segmento ≥ 0,9, pregunta final con hasta ocho palabras y signo final, y un beat `common.question` con texto normalizado y `until`. El comentario fijado se compara si existe. El [check del servidor](../../src/core/explainer/narrative/checks.py) compara la primera pregunta del comentario con la de pantalla, si corresponde. Las normalizaciones no son idénticas: el kit elimina acentos y el servidor usa `casefold` y palabras. No verifican semánticamente verdad, causalidad, contexto, caso humano, resolución de alarmas, cantidad de acciones, antes/ahora, tono o retención; tampoco garantizan que todos los segmentos de un acto no reaparezcan fuera de orden. Estudio y qué hacer están en el orden declarado pero no en los cinco obligatorios. La duración no se valida.

El [estudio original](estrategia-amarillista-2026-10.md) afirma que se comprueba un antes/ahora: este check narrativo solo comprueba la presencia del acto verdad. También presenta «cinco formas» de exagerar; el JSON añade una sexta, predicciones directas en segunda persona. El texto original sitúa la verdad en baja–media y qué hacer en baja; el JSON las fija en media. El original propone miedo sin contexto, pero sus ejemplos introducen fechas; el JSON prohíbe fechas solo en golpe. Sus ejemplos antiguos de despidos, títulos y causalidad incluyen datos señalados para confirmar o afirmaciones que el JSON actual intenta acotar. La supuesta validación de cifras contra guion no demuestra que una cifra sea verdadera: incluso una coincidencia textual requiere cotejo externo. El requisito de resolver después una alarma no evita que alguien vea solamente una portada engañosa.

## 2. Evidencia por acto y técnica

Las categorías siguientes se refieren al **mecanismo o resultado indicado**, no a una prueba de toda la receta en imágenes. «Sólida» requiere evidencia experimental pertinente; «mixta» incluye apoyo indirecto, limitado o resultados contrapuestos; «sin evidencia» significa que no se encontró una prueba fiable de la regla específica.

| Acto | Evaluación y alcance de la evidencia |
|---|---|
| Golpe | **Con evidencia sólida** para clics en titulares negativos: Robertson y colegas analizaron 22.743 experimentos de titulares Upworthy; una palabra negativa adicional se asoció con un aumento relativo del 2,3 % en CTR para un titular promedio. No demuestra miedo, retención ni resultados en carruseles [2]. |
| Miedo | **Evidencia mixta**: negatividad y brecha de información pueden atraer [1, 2]; sin evidencia encontrada de que apilar amenazas sin alivio durante el primer tramo mejore retención o confianza. |
| El estudio | **Evidencia mixta**: prueba y atribución permiten comprobar el hecho; sin evidencia encontrada de que una fuente con caso humano en esta posición cause mayor retención. Una fuente nombrada tampoco prueba que el contenido la represente fielmente. |
| El giro | **Evidencia mixta**: cerrar una brecha responde a curiosidad [1], pero sin evidencia encontrada de que retrasar contexto correctivo hasta este acto mejore confianza o comprensión frente a darlo antes. |
| La verdad | **Sin evidencia** de que sea óptimo exigir siempre una comparación histórica numérica o asignarle la mayor parte. Comparaciones incompatibles pueden distorsionar; verificar población, unidad y período. |
| Qué hacer | **Sin evidencia** de que exactamente dos o tres acciones eleven retención en este formato. Su utilidad depende de que sean aplicables y se desprendan del hecho. |
| La pregunta | **Evidencia mixta**: YouTube permite invitar a comentar [8], pero sin evidencia encontrada de que dos opciones o repetir la pregunta en el comentario produzcan mejor conversación. Una falsa dicotomía puede estrechar el debate. |

| Técnica | Regla y ejemplo resumido del JSON | Evidencia |
|---|---|---|
| Revelación postergada | En miedo, ampliar el drama antes de responder; memo y recortes antes del dato de jóvenes. | **Mixta**: la brecha de conocimiento puede despertar curiosidad [1]; sin evidencia encontrada para retrasar la respuesta en carruseles. Ocultar información crucial puede ser clickbait [5]. |
| Lista de peligro | Encadenar señales verificables; menos vacantes y tareas automatizadas, sin atribuirles causalidad. | **Sin evidencia** de que una lista de señales incremente la retención; las señales por sí solas no prueban un riesgo individual. |
| Microbucles | Resolver una duda y abrir otra cada uno o dos minutos; aclarar el memo y preguntar por empleo juvenil. | **Mixta**: coherente con curiosidad [1], sin evidencia encontrada para esa frecuencia ni para carruseles. |
| Pregunta tramposa | Formular el miedo sin inventar hechos: «¿Eres tú el siguiente?». | **Mixta**: puede crear curiosidad [1], pero también insinuar un peligro personal no demostrado; sin evidencia encontrada de ventaja sostenible. |
| Conexión oculta | Pistas parciales, luego vínculo y límites: memo y recortes sin atribuirlos a IA. | **Mixta**: curiosidad plausible [1]; presentar hechos juntos puede sugerir una causalidad inexistente antes de aclararla. Sin evidencia encontrada de mejora de confianza. |

Loewenstein [1] propone una teoría de la curiosidad como percepción de una brecha; no prueba que cualquier vacío deliberado funcione. Robertson [2] estudió titulares de un editor y clics, no guardados o fidelidad; el 2,3 % es relativo, no puntos porcentuales. Un experimento encontró menor credibilidad y calidad percibidas con clickbait [3], mientras otro no encontró efecto en confianza general en medios [4]. Son resultados dependientes de estímulo y medida; no prueban un desgaste acumulado universal. YouTube recomienda observar caídas y finalización en curvas de retención [9]; son herramientas de diagnóstico, no datos que validen estos cinco recursos. Sin evidencia encontrada de un efecto causal general de esta receta sobre retención de imágenes en Meta.

## 3. Reglas de distribución y riesgos

**Facebook.** Meta declara que reduce titulares que ocultan información o exageran, y advierte que la distribución de quienes recurren al clickbait puede bajar [5]. También desciende publicaciones que manipulan explícitamente votos, comentarios o compartidos, como «comenta SÍ»; distingue pedidos de ayuda, consejos o recomendaciones [6]. Una pregunta relevante no es automáticamente cebo. El diseño de negro que oculta quién o qué y el montaje de hechos sin relación explicada pueden coincidir con los criterios de clickbait aunque cada frase aislada sea verdadera. «La pregunta» se acerca al cebo si se convierte en una instrucción mecánica para inflar comentarios; la repetición y un binario forzado aumentan ese riesgo editorial, sin que exista una sanción automática demostrada para toda pregunta.

**Instagram.** Las directrices de recomendaciones de Meta abarcan Facebook e Instagram: contenido permitido puede no ser elegible para recomendaciones y alcanzar menos personas que no siguen la cuenta [7]. No se debe extrapolar automáticamente a Instagram cada señal específica documentada para el feed de Facebook; sin evidencia encontrada de un umbral público que penalice toda pregunta binaria o palabra en mayúsculas en carruseles. La elegibilidad no garantiza alcance. Revisar el estado de la cuenta y las guías vigentes antes de publicar [7].

**YouTube.** Su política prohíbe manipulación artificial, coerción o engaño para obtener interacción y contenido cuyo único fin sea incentivarla; permite pedir comentarios, likes y suscripciones [8]. También desaconseja títulos y miniaturas engañosos, sensacionalistas o que tergiversan el video; su sistema considera respuesta y satisfacción, no solo clics [9, 10]. Algunas infracciones pueden causar retirada o sanciones [8]; la reducción de recomendaciones y la retirada son mecanismos distintos. La traducción a posts de imagen es una inferencia editorial, no una regla específica de YouTube para el motor local.

## 4. Aplicación a imágenes y formatos

El [motor](../../src/core/image_posts/MOTOR.md) tiene `cifra_que_frena` y `prueba_a_la_vista` de una imagen, y `hilo_guardable` de cinco. El [validador](../../src/core/image_posts/validate.py) exige 1 o 5 láminas según plantilla, 4:5, orden, referencias de hechos por lámina y por rol factual, medios y límites; comprueba presencia y coherencia de referencias, no la verdad semántica de las afirmaciones. El flujo requiere hechos aprobados en PLAN y URL en `publish.json`. La galería es un catálogo de 13 maquetas, no evidencia de que los 13 formatos estén implementados como estrategias del motor.

Para cinco láminas: portada con hecho verificable y alcance; riesgo y prueba; giro y limitación; verdad y aplicación; conclusión con pregunta opcional. Evitar reservar la respuesta indispensable para el final. En una imagen única sobreviven golpe, prueba y giro en una misma unidad; verdad se condensa en un matiz, qué hacer y pregunta solo si caben sin desplazar fuente o legibilidad. Miedo acumulativo y microbucles no son necesarios.

Una portada de unas ocho palabras es una pauta propuesta, no un límite del sistema. Para el mismo hecho, ejemplos editoriales con fuente METR [11]: básico «Un estudio midió más tiempo al programar con IA»; medio «Tu herramienta de IA puede requerir más tiempo»; alto «Más tiempo con IA en un ensayo limitado»; negro adaptado «IA: más TIEMPO en un ensayo de programación». Conservan incertidumbre y alcance; negro se aparta deliberadamente de la prohibición de condicionales y de la pregunta tramposa si estas impiden precisión. Ocho palabras no sustituyen el límite de 60 caracteres del título de video; verificar ambos si se reutiliza. Ninguno debe insinuar que toda IA retrasa a todos.

| Galería 01–13 | Encaje con el arco | Razón |
|---|---|---|
| 01 Foto icónica + una línea | Bajo | Buena entrada visual, poco espacio para prueba y matiz. |
| 02 Documento real con lupa | Alto | Muestra prueba y permite aclarar su alcance. |
| 03 Antes vs. ahora | Alto | Comparación clara si medidas y períodos son compatibles. |
| 04 Anatomía con etiquetas | Medio | Útil para explicar mecanismo; no exige miedo. |
| 05 Frase célebre con retrato | Bajo | Cita aislada limita el giro y exige atribución exacta. |
| 06 Un día como hoy | Medio | Fecha y contexto favorecen historia; menos apto para amenaza actual. |
| 07 Línea de tiempo en carrusel | Alto | Distribuye problema, desarrollo y resolución sin confundir cronología. |
| 08 Portada editorial | Alto | Titular y contexto abren una historia con espacio para matiz. |
| 09 Comparación que no cabe en la cabeza | Medio | Contraste puede ilustrar giro, pero una analogía exagerada distorsiona. |
| 10 Gráfico de datos | Alto | Prueba, denominador y límites visibles; no manipular escalas. |
| 11 Formato tuit | Medio | Resume tensión, pero el espacio y apariencia de cita exigen cuidado. |
| 12 Imagen asombrosa con escala | Bajo | Sirve al asombro visual; no necesita alarma artificial. |
| 13 Adivina qué es | Medio | La revelación encaja; no pedir «comenta» como requisito para saber. |

Esta clasificación es juicio editorial sobre [galería y ejemplos](../../../nexa-brief-web/public/ejemplos-posts/index.html), no medición de rendimiento.

### Ejemplo completo: NodeTech, cinco láminas

1. **Portada:** «Un ensayo encontró más tiempo al programar con IA». En 2025, METR estudió tareas de desarrolladores experimentados en sus propios proyectos [11].
2. **Prueba:** «16 desarrolladores completaron 246 tareas». Al permitir herramientas de IA de principios de 2025, las tareas tomaron un 19 % más de tiempo en promedio [11].
3. **Giro:** «No es una sentencia sobre toda la IA». El resultado describe esas herramientas, personas y tareas; no demuestra que cualquier programador sea más lento [11].
4. **Aplicación:** «Mide tu propio trabajo». Compara tareas similares con y sin ayuda, incluye revisión y registra el tiempo; es una propuesta práctica, no un resultado del ensayo.
5. **Cierre:** «El beneficio depende del contexto». ¿En qué tareas te ayuda más? Fuente: METR, ensayo de 2025 [11].

### Ejemplo completo: NodeHistory, cinco láminas

1. **Portada:** «Una alarma apareció durante el descenso del Apolo 11». El 20 de julio de 1969, la tripulación recibió el código 1202 [12, 13].
2. **Prueba:** «La computadora estaba sobrecargada». El informe de la misión registra cinco alarmas de programa durante el descenso motorizado [12].
3. **Giro:** «La alarma no obligaba por sí sola a abortar». Las alarmas eran intermitentes, la navegación funcionaba y el control autorizó continuar [12].
4. **La verdad:** «El sistema conservó tareas prioritarias». El software estaba preparado para atender las tareas de mayor prioridad bajo sobrecarga; el módulo aterrizó [12, 13].
5. **Cierre:** «Una alerta necesita contexto para interpretarse». ¿Qué aprendemos de preparar fallos? Fuentes: informe de misión y archivo histórico de NASA [12, 13].

En ambos ejemplos, los números entre corchetes remiten a las fuentes al final de este estudio; en una publicación real habría que incluir una referencia visible y un enlace accesible. La pregunta final no condiciona el acceso a la respuesta. Ninguno intenta forzar un antes/ahora numérico sin datos comparables.

## 5. Recomendación y experimento

Adoptar hecho concreto, tensión proporcionada, prueba atribuida, giro temprano y conclusión útil. Evitar amenazas personales categóricas, falsa causalidad, contexto correctivo escondido, léxico visceral obligatorio y solicitudes mecánicas de comentario. Un ejemplo real no justifica prometer que el lector sufrirá el mismo desenlace. Revisar tanto el texto de portada aislado como cada lámina y el conjunto: las personas pueden no completar el carrusel. Para la imagen única, publicar únicamente si afirmación, matiz y fuente caben juntos.

**Piloto:** 40 posts originales, 20 por variante, organizados en 20 pares temáticos comparables y repartidos entre NodeTech y NodeHistory. En cada par asignar al azar cuál tema recibe amarillista moderado y cuál documental; alternar aleatoriamente el orden y franjas comparables. Mantener plataforma, cuenta, número de láminas, calidad de fuentes, extensión, estilo, presupuesto y ventana de medición constantes. Cada post aparece una sola vez; no publicar dos versiones del mismo post al mismo público. Aleatorizar dentro de categoría y período reduce, pero no elimina, diferencias entre temas. Registrar cambios de distribución o promoción y no mezclar plataformas en el análisis principal.

Predefinir como resultado principal **compartidos por 1.000 cuentas alcanzadas** a los siete días; secundarios: guardados y comentarios por 1.000 alcanzadas, alcance absoluto, y personas que dejan de seguir por 1.000 alcanzadas cuando la plataforma ofrezca atribución por publicación. Si solo existe pérdida agregada por cuenta y día, registrarla como señal contextual, sin atribuirla a un post. Añadir valoración manual ciega de comentarios de desconfianza y de calidad de conversación, con criterios fijados antes; si hay datos fiables, registrar avance por lámina. Comparar medias por variante y diferencias por pares/categoría, con intervalos de incertidumbre; documentar denominadores, resultados faltantes y no descartar posts de bajo alcance. Cuarenta posts son un piloto de viabilidad, no un tamaño calculado con potencia: un resultado incierto no demuestra equivalencia. No aumentar el tono si suben compartidos mientras aumentan desconfianza o abandono; decidir el umbral aceptable antes de publicar.

## Fuentes externas

1. [Loewenstein, The Psychology of Curiosity (1994)](https://www.cmu.edu/dietrich/sds/docs/loewenstein/PsychofCuriosity.pdf), revisión y teoría de la brecha de información.
2. [Robertson et al., Negativity drives online news consumption (2023)](https://www.nature.com/articles/s41562-023-01538-4), experimentos de titulares de Upworthy.
3. [Aggregation, Clickbait and Their Effect on Perceptions of Journalistic Credibility and Quality (2019)](https://www.tandfonline.com/doi/abs/10.1080/17512786.2019.1628658), dos experimentos sobre percepción.
4. [(Null) Effects of Clickbait Headlines on Polarization, Trust, and Learning (2020)](https://academic.oup.com/poq/article-abstract/84/1/49/5827235), resultados nulos para confianza general en medios.
5. [Meta, New Updates to Reduce Clickbait Headlines (2017)](https://about.fb.com/news/2017/05/news-feed-fyi-new-updates-to-reduce-clickbait-headlines/), criterios y distribución en Facebook.
6. [Meta, Fighting Engagement Bait on Facebook (2017)](https://about.fb.com/news/2017/12/news-feed-fyi-fighting-engagement-bait-on-facebook/), cebo de interacción y excepciones.
7. [Meta, Recommendation Guidelines](https://about.fb.com/news/2020/08/recommendation-guidelines/), elegibilidad de recomendaciones en sus aplicaciones.
8. [YouTube, Fake engagement policy](https://support.google.com/youtube/answer/3399767?hl=en), interacción permitida y prohibida.
9. [YouTube, Performance FAQ](https://support.google.com/youtube/answer/141805?hl=en), títulos, miniaturas, distribución y retención.
10. [YouTube, Content performance for recommendations](https://support.google.com/youtube/answer/16559650?hl=en), atractivo, interacción y satisfacción.
11. [METR, Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity](https://metr.org/Early_2025_AI_Experienced_OS_Devs_Study-paper.pdf), ensayo y límites.
12. [NASA, Apollo 11 Mission Report, secciones 4 y 13](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf), alarmas y decisión de continuar.
13. [NASA, Apollo 11 Lunar Surface Journal: Program Alarms](https://nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.1201-fm.html), prioridades del software.
