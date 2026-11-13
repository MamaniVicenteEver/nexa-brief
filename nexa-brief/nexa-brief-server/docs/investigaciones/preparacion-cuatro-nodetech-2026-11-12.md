# Preparación de cuatro videos NodeTech para ediciones por idioma

Guía para trasladar lo aprendido a otras categorías y diseños:
[estándar de implementación de ediciones multilingües](estandar-implementacion-ediciones-multilingues-2026-11.md).
Este informe conserva la evidencia y los pendientes concretos de los cuatro episodios.

Fecha: 2026-11-12. Trabajo realizado en el perfil `profesional` del servidor privado `alfred-server`.

## Estado editorial

La disponibilidad técnica para generar una edición no certifica la exactitud del guion ni las licencias de sus medios. Las ediciones nuevas requieren revisión humana de audio, textos, tiempos, fuentes, créditos y miniaturas antes de publicar.

| Video | Estado y pendientes relevantes |
|---|---|
| `vago-pero-emocionante` | Se prepararon tres miniaturas y se completaron referencias y créditos a partir de archivos existentes. Se creó una edición inglesa `en-US/rev-001`, pendiente de revisión. |
| `ia-despidos-programadores-amazon` | Se incorporaron contratos de idioma para los tres componentes propios que bloqueaban su adaptación. El preflight técnico pasa; sigue siendo necesaria la revisión editorial de las afirmaciones y los medios. |
| `apolo-1202` | La investigación original está vacía y se detectaron afirmaciones que requieren corrección en voz, textos y tiempos. No debe presentarse como verificado ni generar otra edición a partir de esas afirmaciones hasta corregir el original. |
| `codex-ariane-501` | Se preparó la miniatura C con un fragmento recuperado de un satélite, identificado como tal. Falta una imagen adecuada para la miniatura B. El archivo `launch.jpg` representa otro vuelo y ya había sido rechazado en la revisión del proyecto. No se sustituyó por una fotografía engañosa. |

## Apolo: hallazgos y fuentes

El original dice que la computadora «se rindió», que Garman estaba junto a Bales y que hubo cinco alarmas 1202. Las fuentes de NASA describen la recuperación de tareas esenciales tras los reinicios, sitúan a Garman en una sala de apoyo y registran cinco alarmas de los tipos 1201 y 1202. La posición del radar y la explicación causal requieren expresarse con cuidado. Véanse el [informe de la misión](https://www.nasa.gov/wp-content/uploads/static/apollo50th/pdf/A11_MissionReport.pdf), la [entrevista a Jack Garman](https://www.nasa.gov/wp-content/uploads/2025/07/garmanjr-3-27-01.pdf) y la [cronología de NASA](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11i_Timeline.htm).

No basta con corregir `script.json`: la narración ya grabada, su transcripción, los anclajes, los textos de pantalla y algunas miniaturas quedarían desincronizados. Debe prepararse una revisión aislada, regenerar o editar voz, volver a transcribir, sincronizar y revisar los dos formatos antes de activar un reemplazo. La imagen `core-rope.jpg` representa un equipo de prueba en una exhibición; su uso requiere descripción y atribución correctas.

Se dejó un borrador aislado en `apolo-1202/work/results/test/propuesta-historica-2026-11-12/`, con cambios propuestos para nueve segmentos y sus referencias. Es una base de trabajo: necesita cotejo, voz nueva, sincronización y revisión completa; no sustituye al video original.

## Ariane: imagen

La ESA identifica una [fotografía del lanzamiento 501](https://www.esa.int/ESA_Multimedia/Images/1998/01/Launch_of_Ariane_501), con crédito ESA/CNES y licencia estándar. Las [condiciones de la ESA](https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website?img=1) distinguen el uso editorial del comercial y advierten sobre derechos de terceros. Debe comprobarse su disponibilidad para el uso concreto antes de incorporarla. Una fotografía NASA de otro Ariane 5 no es una imagen del vuelo 501 y solo serviría como ilustración claramente identificada, si cumple los criterios visuales y de derechos.

## Prueba inglesa

Se creó desde el botón del navegador una sola edición de `vago-pero-emocionante`, trabajo `feee2696ce744a93955119bd0320d13d`. Un fallo de sincronización detectó que el cierre utilizaba el tiempo del original y recortaba el audio inglés. Se corrigió el flujo y se reanudó el mismo trabajo con los puntos guardados de agente, voz y transcripción. El resultado contiene 489 palabras de narración, dura aproximadamente 3:28 y conserva la revisión pendiente.

La revisión automática detectó dos anclajes calculados de forma proporcional y una posible despedida duplicada. También pide comprobar un detalle del guion original sobre un lápiz. La transcripción reconoce el apellido Sendall con otra grafía; es necesario escuchar la pronunciación. Estas observaciones no equivalen a una aprobación editorial.

La edición se comprobó en el modal de escritorio y móvil; las tres miniaturas se capturaron a 1280×720 y el panel se midió sin desplazamiento horizontal en anchos de 384 y 300 píxeles. No se solicitó grabar, aprobar ni publicar el video.

La miniatura B se recompuso con saltos de línea para que su texto sea legible, sin cambiar palabras ni imagen. La edición conserva tres fuentes y cinco créditos de la producción original; la descripción efectiva en inglés los incluye y ocupa 2234 bytes. La versión española también presenta esas referencias en su descripción efectiva. Se comprobó que las ediciones EN y PT aprobadas anteriormente de otro video conservan su aprobación.

Una comprobación posterior de los sellos de caché detectó que las tres miniaturas de cada una de esas ediciones anteriores EN y PT figuran como desactualizadas; las tres de la nueva edición EN de la Web están vigentes. Las miniaturas anteriores no se regeneraron ni se modificaron. La selección de una apertura puede provocar la regeneración de su captura desactualizada, por lo que este punto debe revisarse antes de modificar las ediciones aprobadas.

## Cambios de infraestructura y validación

- Los originales sin formato declarado se adaptan como documental existente y usan su duración registrada, sin imponer el diseño corto a material que contiene fotografías.
- Se declararon los campos localizables de `rough.layoffMail`, `rough.codeReview` y `rough.careerLadder`, y se detectan valores de texto por defecto y componentes personalizados divergentes.
- El cierre de una edición usa la voz y los tiempos de esa edición; no recorta la narración con tiempos del original. Se conserva un aviso si el guion ya contiene una despedida similar.
- El contador `rough.counter` respeta el idioma y conserva el formato español anterior por defecto.
- El preflight exige una pista de investigación y entrega al agente fuentes y documentos editoriales permitidos, tratándolos como datos y no como instrucciones. La presencia de una fuente no prueba la veracidad de una afirmación.
- Las descripciones efectivas de ES y las ediciones nativas incluyen fuentes y créditos sin duplicarlos; se verifica el límite de 5000 bytes UTF-8 de YouTube. Los cambios de metadatos relevantes requieren revisión de la edición afectada.
- Las tarjetas y el grabador consultan los errores del paquete original antes de considerarlo publicable. Se puede conservar la posibilidad de grabar una previsualización sin confundirla con la autorización para publicar.
- Las nuevas miniaturas B de ediciones `rough` y `binary` reciben saltos de línea cuando se necesitan, respetando las palabras y los cortes manuales.
- La comprobación final ejecutó 331 pruebas de edición, recuperación, formatos, localización, publicación, investigación y regresión del cierre: todas pasaron. Se observó una advertencia de deprecación de Starlette/httpx. La prueba del modal no registró errores de consola ni respuestas fallidas; una comprobación posterior de la pantalla de acceso tampoco reprodujo el aviso de sesión observado durante la navegación inicial.

## Costes observados

La ejecución editorial utilizó el proveedor configurado `claude-sonnet-5-5`; no se utilizó Opus. Sus dos registros de uso indican un coste de lista de aproximadamente USD 0,85 en total. La voz se generó con `gemini-3.8-flash-tts`; su coste efectivo no está disponible en esos registros. No se dispone del coste completo de la prueba ni de una factura confirmada.
