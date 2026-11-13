# Curación de sonidos

Rol: `sound_curator`, respuesta estructurada por el Model Hub usando el mismo `AgentRunnerPort` de las tareas de imágenes. El agente se ejecuta en modo de solo lectura, con un esquema JSON que limita su salida a textos de catalogación.

## Recorrido

1. El orquestador busca primero recursos ya guardados y aprobados. Reutilizar un `asset_id` nunca vuelve a lanzar el agente ni descarga el audio.
2. Para un recurso externo nuevo, el adaptador busca y descarga, valida el archivo y mide duración/hash. URL, identificador y licencia proceden del proveedor; no se confían a una respuesta generativa.
3. `SoundMetadataPort.curate()` lanza un agente con el rol `sound_curator`. Su respuesta se valida con `output.schema.json` y el modelo del puerto.
4. El repositorio construye la fila canónica con mediciones y ficha editorial. Un externo nuevo queda `approval_status: pending`; un error operativo o JSON inválido bloquea el alta. No hay una ficha simulada ni aprobación automática de respaldo.
5. Una persona escucha y aprueba. Cada documental referencia el recurso por `asset_id` y conserva en un plan aparte su tiempo de entrada, fragmento, duración, volumen y fundidos.

## Propiedad de los datos

- Medidos/inmutables: hash SHA-256, duración real, formato; el servicio los calcula a partir del archivo descargado.
- Proveniencia: proveedor, ID, URL y licencia; se guardan junto a la fila canónica y no se reescriben por el agente.
- Editoriales: título, descripción, usos recomendados y etiquetas; son sugerencias validadas, editables por el usuario.
- Aprobación: la persona; no se infiere a partir de que el agente terminó correctamente.
- Por video: tiempos/fragmentos/ganancia; nunca se mezclan con la ficha del recurso reutilizable.

La tabla persistente usa el DataStore existente (`sound_assets` + archivos `sounds`), no una base de datos paralela. El JSON del sandbox `assets/audio-poc/sound-catalog.json` es un manifiesto de importación inicial de tres archivos ya aprobados por el usuario; no sustituye esa tabla.
