# Dos sistemas nuevos

## Sistema 1  --  nexa-explainer

"Proposito "NARRATIVA": facilitar la creacion de videos bien desarrollados, con un alto nivel de produccion y quitar hora de ediccion para centrarse en las ideas y lo que da valor que quieren dar asu audiencia"

El punto de partida es un video grabado por el usuario, con la persona ubicada a un lado del cuadro 16:9 (por ahora se cubre ese caso puntual; otros encuadres quedan para una iteración posterior). A partir de ahí, el flujo corre en varias etapas encadenadas, con dos de ellas en paralelo:

1. **Agente analizador de encuadre.** Toma una captura del primer frame del video, mide el ancho útil de la imagen, calcula qué porcentaje del cuadro ocupa la persona y en qué posición está, y determina cuánto espacio libre queda disponible para subtítulos y gráficos. El resultado es un JSON con medidas y posiciones — la base para decidir después dónde entra cada elemento sin tapar al presentador. NO REQUIERE UN MODELO DE ALTO NIVEL — ES UNA EXTRACCIÓN ACOTADA A UN ESQUEMA FIJO.

2. **Transcripción en paralelo.** Mientras el agente anterior analiza el encuadre, el sistema ya empieza a transcribir el audio del video, con el mismo mecanismo de transcripción por palabra que hoy usa el sistema, entregando su propio JSON con el texto y los tiempos. NO ES UN AGENTE DE RAZONAMIENTO, ES UN MODELO DE TRANSCRIPCIÓN ESPECIALIZADO — NO APLICA LA MISMA EXIGENCIA.

3. **Selección de plantilla (identidad visual).** El sistema mantiene una librería propia de plantillas — paletas de color, tipografías, estilos — para que la IA nunca tenga que inventar diseño desde cero. Desde la interfaz, el usuario puede elegir una plantilla puntual o dejar la que corresponde por defecto; el sistema detecta si hubo selección manual y la respeta, o si no, resuelve una automáticamente más adelante. NO REQUIERE UN MODELO DE ALTO NIVEL — ES UNA DECISIÓN DE CONFIGURACIÓN, NO DE DISEÑO LIBRE.

4. **Agente estructurador de contenido.** Toma el JSON de la transcripción y arma un JSON estructurado con título, descripción y los puntos importantes de lo que se dijo, ordenados — la materia prima a partir de la cual después se decide qué gráficos sacar. **ESTE ES EL PUNTO CRÍTICO DE TODO EL FLUJO: REQUIERE UN MODELO DE ALTO NIVEL DE RAZONAMIENTO Y CRITERIO EDITORIAL** — si este agente elige mal qué es "importante", ningún paso posterior lo puede compensar.

5. **Agente de guion/timeline.** Analiza ese JSON estructurado y decide qué se va a mostrar y en qué momento exacto del video, produciendo un JSON completo con todo el texto y sus tiempos de entrada/salida. En esta etapa también se termina de resolver la plantilla (si el usuario no eligió una, el sistema elige una de la librería) y arma la configuración de esa plantilla — el mismo patrón de "config" que hoy ya se usa para los videos musicales. NO REQUIERE UN MODELO DE ALTO NIVEL SI EL PASO 4 YA DEJÓ BUEN MATERIAL — ES MAYORMENTE UN TRABAJO DE ORDENAR Y TEMPORIZAR, NO DE DECIDIR CONTENIDO.

6. **Generación del HTML/CSS.** Con la plantilla, su tipografía/colores base y la configuración de contenido y tiempos ya resueltos, el sistema llama a un agente adicional que arma el HTML/CSS/JS completo del panel de gráficos. NO REQUIERE UN MODELO DE ALTO NIVEL — ES GENERACIÓN DE CÓDIGO ACOTADA A UNA PLANTILLA YA DEFINIDA, NO DISEÑO LIBRE.

7. **Previsualización antes de grabar.** Antes de producir el archivo final, el sistema le muestra al usuario su propio video reproduciéndose con la plantilla ya superpuesta encima, en vivo — sin renderizar todavía. El usuario puede reproducirlo y revisarlo antes de confirmar.

8. **Ajuste por feedback, sin repetir todo desde cero.** Si el resultado no convence, el usuario no tiene que volver a grabar ni relanzar todo el proceso: hay un chat donde puede escribir qué no le gustó (por ejemplo, "ese título tapa mi cara" o "ese gráfico no va ahí"). Como el encuadre, la transcripción y el contenido estructurado ya están resueltos de los pasos anteriores, el agente que recibe ese comentario interviene únicamente sobre la plantilla/HTML ya generado: toma el feedback, el contexto de lo que ya existe y su rol, y rediseña puntualmente solo los elementos mencionados — no vuelve a correr el análisis de contenido. Recién con ese ajuste aplicado se vuelve a mostrar la previsualización, tantas veces como haga falta, hasta confirmar la grabación final. REQUIERE BUEN CRITERIO PARA INTERPRETAR UN COMENTARIO EN LENGUAJE LIBRE Y ACOTAR EL CAMBIO SOLO A LO PEDIDO, AUNQUE NO TAN ALTO COMO EL PASO 4 PORQUE PARTE DE TODO EL ANÁLISIS YA HECHO.

## Sistema 2   -- nexa-academy

"Proposito : "NARRATIVA": poder demogratizar la educacion en las fase inciales y que puedan competir con los los que tienen acceso a los mayor oportumidades en temas de educacion"
"Roadmap": se planea pruevas de concepto y en la primera fase todo los temas son faces iniciales de la educion inicial y primaria , segunda fase educacion secundaria y asi sucesivamente hasta llegar a la educacion universitaria y profesional"


El sistema funciona como una fábrica de contenido educativo por niveles, pensada primero para inglés pero con la misma lógica aplicable a otras materias (matemática, historia, etc.) cambiando únicamente de plantillas.

1. **Punto de entrada: planificación conversada del temario.** El usuario propone un tema (por ejemplo, "inglés") y lo discute con el sistema antes de que se genere nada — no es una elección automática sin intervención humana. REQUIERE UN MODELO DE ALTO NIVEL DE RAZONAMIENTO Y DISEÑO PEDAGÓGICO — es quien define la estructura que todo lo demás va a seguir.

2. **Plantillas por categoría/materia.** El sistema mantiene familias de plantillas separadas por tipo de contenido (inglés, matemática, historia, etc.), de forma que el diseño visual de cada materia quede resuelto de antemano y no dependa de que la IA lo invente lección por lección. NO REQUIERE UN MODELO DE ALTO NIVEL — ES CONFIGURACIÓN, NO DISEÑO LIBRE.

3. **Construcción del roadmap, organizado en fases.** Una vez acordado el tema, el sistema arma una propuesta de plan de estudio dividida en fases (por ejemplo, "inglés básico" como fase 1) — con un rango orientativo de 55 a 100 videos de entre 10 y 20 minutos cada uno (una referencia de escala a discutir y ajustar, no un número fijo). Cada lección del roadmap queda definida con un título y una descripción puntual. REQUIERE UN MODELO DE ALTO NIVEL — ES EL MISMO AGENTE DEL PUNTO 1, DECIDIENDO LA ESTRUCTURA COMPLETA.

4. **Selección del proveedor de voz.** Antes de generar contenido, se define qué motor de texto a voz se va a usar (a evaluar entre distintas opciones del mercado), ya que de esa elección depende buena parte del costo y la calidad final de cada lección. NO REQUIERE UN MODELO DE ALTO NIVEL — ES UNA DECISIÓN DE CONFIGURACIÓN, NO DE RAZONAMIENTO.

5. **Generación lección por lección, dentro de límites estrictos.** El sistema toma una lección del roadmap aprobado y trabaja únicamente con el título y la descripción que esa lección ya tiene definidos — el contenido que genera no puede salirse de ese alcance. Con ese contenido acotado arma el guion de la lección y lo envía al agente encargado de completar el video (narración, resaltado de texto y render). REQUIERE BUEN NIVEL DE RAZONAMIENTO, PARTICULARMENTE POR LA EXACTITUD DEL CONTENIDO EDUCATIVO — UN ERROR ACÁ NO SOLO SE VE MAL, ENSEÑA MAL.

6. **Prueba piloto y doble punto de control antes de seguir con la fase completa.** En vez de generar toda una fase de una sola vez, el sistema arranca generando solo el primer 10% de la fase 1, a modo de piloto. Antes de continuar con el resto, hay dos instancias de control, no una sola: una revisión manual mía sobre ese piloto, y además una revisión automática del propio sistema — que espera un período razonable (por ejemplo, una semana) desde que ese piloto quedó publicado, y con acceso a los datos reales (vistas, comentarios, retención) decide por sí mismo si conviene seguir generando el resto de la fase tal como está planteada, o si hace falta ajustar algo antes de continuar. NO REQUIERE UN MODELO DE ALTO NIVEL DE RAZONAMIENTO CREATIVO, PERO SÍ BUEN CRITERIO PARA INTERPRETAR MÉTRICAS REALES Y DECIDIR EN BASE A ESO, NO A INTUICIÓN.


## PRAMETROS 

TODO LOS SE ASE APRENDAN EN EL DESARROLLO DE ESOS SISTEMAS TIENE EL PROPOSITO DE EXPANDINOS EN DIFERNTES AREAS Y AUTOMATIZAR LA INFORMACION Y QUE PUEDA LLEGAR A TODAS LAS PERSONAS 


PROYECTOS FUTUTOS :## Sistema 1  --  nexa-explainer  TIENE EL POTENCIAL DE PASARLE VIDEOS ,ETC,ETC DE CUAL NICHO Y COMO ESTE DETECARA EL PRIEM FRMAE PODNRA , LA CAPA DE HTML,ETC,ETC,ETC PODRIAMOS ORIENTEAS EN UN FUTURO PARLE AUDIO NARE VIDEOS DE OTRO USER RECONER TLOS VIDEO ,ETC,ETC,ETS NICHCOS COMO , SUBIR LA MORAL DE  ,ETC REFLECIONES,ETC,ETC,,,, TIENE POTENCIAL EN UN FUTURO POR AHORA NOO