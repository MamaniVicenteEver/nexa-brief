# Prototipos base de Historia y Ciencias v1

## Objetivo

Historia y Ciencias pasan a ser materias de primera clase dentro de Academy. Cada materia nace con dos prototipos reutilizables para que los futuros contenidos no se generen como pantallas aisladas, sino como clases con una intención pedagógica, una secuencia visual, una zona de subtítulos y variables aprobadas para los agentes.

La duración de revisión en la interfaz es de 30 segundos. Cada prototipo contiene cuatro momentos completos de clase; la misma receta puede extenderse a 60 segundos cuando el guion necesite más narración.

## Decisiones pedagógicas que guían los prototipos

### Historia

La primera familia trabaja con una fuente primaria: observar, preguntar, contextualizar e interpretar. La fuente no es un adorno; es el objeto que obliga a volver a la evidencia.

La segunda familia trabaja con procesos: condición, decisión, respuesta y legado. La línea de tiempo conserva la secuencia y muestra la relación de causa y consecuencia.

Estas decisiones toman como referencia la herramienta de análisis de fuentes de la Library of Congress, que organiza la observación, la reflexión y la pregunta, además de proponer guías separadas para fotografías, mapas, documentos, gráficos y otros formatos. [Library of Congress: Teacher’s Guides and Analysis Tool](https://www.loc.gov/programs/teachers/getting-started-with-primary-sources/guides/?reload=no) y [Analyzing Primary Sources](https://www.loc.gov/static/programs/teachers/getting-started-with-primary-sources/documents/Analyzing_Primary_Sources.pdf).

### Ciencias

La primera familia trabaja con indagación: pregunta, predicción, prueba y evidencia. La segunda trabaja con sistemas: entrada, transformación, circulación y sistema completo.

La estructura también aplica la rutina `See, Think, Wonder` de Project Zero como patrón para mirar un objeto, formular interpretaciones y abrir preguntas. [Project Zero: Thinking Routines](https://www.pz.harvard.edu/thinking-routines) y [See, Think, Wonder](https://pz.harvard.edu/resources/see-think-wonder).

En las cuatro familias se reserva un cierre breve para una pregunta, una práctica o una relación con el siguiente contenido. Esto sigue la recomendación de aprendizaje activo de Cornell: explicar el propósito, dividir las actividades en etapas y cerrar con una puesta en común o una comprobación. [Cornell Center for Teaching Innovation: Active Learning](https://teaching.cornell.edu/teaching-resources/active-collaborative-learning/active-learning).

## Catálogo de prototipos

| Materia | Prototipo | Secuencia | Visual principal |
| --- | --- | --- | --- |
| Historia | Detectives de fuentes | Observar → Preguntar → Contextualizar → Interpretar | Documento, fotografía, lupa y marcadores de evidencia |
| Historia | Mapa de causas y cambios | Condición → Decisión → Respuesta → Legado | Línea de tiempo y flechas de consecuencia |
| Ciencias | Laboratorio de hipótesis | Pregunta → Predicción → Prueba → Evidencia | Aparato simple, variable visible y gráfica |
| Ciencias | Mapa de un sistema | Entrada → Transformación → Circulación → Sistema completo | Nodos, conexiones, flujo y leyenda |

## Contrato común para futuros contenidos

Cada lección que use estas familias debe entregar:

1. `template_id` aprobado por el catálogo.
2. Objetivo observable y nivel de dificultad.
3. Cuatro escenas con `start`, `duration`, narración, texto central y subtítulo.
4. Una sola idea visual dominante por escena.
5. Evidencia, datos o fuentes registradas cuando el tema lo requiera.
6. Paleta, iconos, tipografía y transiciones tomadas del prototipo; el agente no puede inventar un lenguaje visual fuera del catálogo.
7. Zona segura inferior para subtítulos y zona central para el contenido que se está leyendo.
8. Cierre con práctica, pregunta de transferencia o conexión con la siguiente lección.

## Reglas visuales

- El escenario debe parecer un espacio de trabajo docente: archivo, laboratorio, mapa, diagrama o pizarra; no una secuencia de tarjetas promocionales.
- Los iconos son funcionales y reutilizables: la interfaz usa la biblioteca Lucide ya instalada para lupa, archivo, preguntas, mapa, ramas, laboratorio, gráfica, red y órbita. No se redibujan iconos básicos a mano.
- Las gráficas se construyen progresivamente y solo muestran datos que pertenezcan al guion aprobado.
- Las transiciones tienen una causa: revelar, conectar, comparar, comprobar o cerrar.
- El movimiento debe ser finito, determinista y apto para búsqueda temporal en HyperFrames; no se usan relojes de render ni bucles infinitos.
- Se conserva contraste, lectura a distancia y subtitulado legible. El audio y el texto deben poder entenderse también como canales separados.

## Estado de implementación

- Se agregaron `history` y `science` al catálogo de materias.
- Cada materia tiene dos plantillas en el catálogo visual del servidor.
- La galería pública acepta `/es/academy/history` y `/es/academy/science`.
- La página principal de Academy muestra las cuatro materias con iconografía propia.
- La previsualización mantiene cuatro fases, 30 segundos, pantalla completa del escenario y controles de pausa, adelanto y cierre.
- La planificación conversada obtiene las materias desde el catálogo y ya no está limitada a Inglés y Matemática.

## Siguiente etapa

El siguiente trabajo debe conectar estos prototipos con contenido real: elegir un nivel y tema, preparar una fuente o conjunto de datos, generar un guion aprobado, producir audio, obtener el timing de Whisper y renderizar un piloto de 30 o 60 segundos. Después se revisan exactitud, sincronización, contraste y comprensión antes de poner la lección en cola.
