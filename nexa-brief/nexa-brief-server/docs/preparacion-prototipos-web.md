# Preparación editorial de prototipos desde la web

Esta primera etapa incorpora una cola persistente y serializada para preparar un
proyecto existente sin crear otro prototipo. El botón «Preparar con IA» recibe
solo los metadatos y archivos editoriales del proyecto seleccionado, crea un
espacio privado en `work/preparation/<run_id>/` y usa el ejecutor aislado del
perfil. La respuesta se almacena como una propuesta con título, descripción y
pendientes. La propuesta permanece pendiente de revisión; no cambia el estado de
publicación, no modifica `publish.json`, no graba, no mueve el proyecto y no
crea una demo en el repositorio.

La cola se registra por el puerto de datos, los logs reales quedan en `logs/`
y los consumos en el registro. Se muestra el diseño en Showcase al solicitar
la preparación, preservando su ID compartido. La recuperación detecta tareas
interrumpidas; el usuario puede reintentarlas desde la misma tarjeta.

La preparación editorial por sí sola no garantiza que un motor se pueda usar en
producción. Atlas, Vida y Cara a Cara conservan sus bloqueos hasta comprobar
sus rutas, recursos y renderizadores. La asignación automática de una única
demo por diseño necesita un catálogo de muestras común a todas las categorías
y no se implementa mediante copias silenciosas de datos del perfil.
