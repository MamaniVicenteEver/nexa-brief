# Miniaturas editables del estudio

Las plantillas que usan el flujo de borradores del estudio, incluidas las de NodeMotion y sus promociones comerciales, ofrecen dos opciones de miniatura. Cada opción tiene texto y diseño propios; la opción A es la inicial. El diseño se guarda como datos editables en `Draft.thumbnails.options`, junto con la selección. La vista previa usa un renderizador SVG compartido por la interfaz y la captura final, con colores y composición asociados a la plantilla.

Al preparar un borrador nuevo, la misma petición que genera los textos de publicación solicita también los textos de las dos opciones. Su consumo queda incluido en el registro existente de esa operación; las vistas previas y la selección no hacen llamadas a la IA. Los borradores y originales anteriores se adaptan con sus datos existentes, sin repetir la preparación.

En «Canción en la intro» se puede editar el texto de la opción seleccionada y abrir «Ver» para comparar ambas en tamaño mayor. La vista se actualiza en el navegador al escribir. Se guardan los cambios por opción; antes de grabar, la interfaz espera el guardado pendiente. La selección se utiliza también como texto de la intro del video generado.

`PUT /api/v1/drafts/{id}/thumbnails` guarda la elección. `PUT /api/v1/drafts/{id}/thumbnails/{option}` guarda texto y diseño. Consultar o editar estas opciones no captura imágenes. Durante la grabación se genera la imagen JPEG de la opción elegida, se asigna al artefacto del Job y se utiliza en la publicación. La captura ocupa la cola de trabajo pesado y cierra el navegador al finalizar o fallar. Si no puede generarse, la grabación informa el error en vez de publicar una imagen anterior.

Los archivos de producción y logs permanecen en la ubicación configurada del perfil activo. El manifiesto editable vive en el JSON del borrador; el consumo de generación de textos continúa en los registros de uso existentes. Los flujos independientes de Explainer y `/videos` tienen sus propias miniaturas y no utilizan este contrato de borradores.

Las cuentas para «Publicar al terminar» se agrupan por las categorías compartidas con Canales; la selección de una categoría incluye sus cuentas disponibles. La selección individual sigue disponible dentro de cada grupo.
