# Recursos por categoría y plantilla

## Contrato y flujo

Se conserva una sola familia de API: `/api/v1/library/{images|videos|music|sounds}`.
`GET` sin `category` devuelve el catálogo general; `?category=node_motion` devuelve
solo recursos con procedencia NodeMotion. También se reconocen el nombre NodeMotion
y el identificador de carpeta nodemotion. La búsqueda `q` se combina con el filtro.
Las categorías históricas de tema (`uploads`, `stock`, etc.) siguen siendo compatibles.

Cada registro nuevo contiene `media_type`, `category_id`, `category_name`,
`template_id`, `template_name` y `resource_origins`. Los nombres se resuelven desde
el catálogo del servidor, no desde texto enviado por el navegador. Las cargas
multipart aceptan `category` y `template_id`; un origen incompatible se rechaza
antes de guardar archivos. Una carga global sin contexto se conserva sin atribuir
a una categoría inventada.

Un mismo audio o recurso de stock puede pertenecer explícitamente a varios
contextos. La deduplicación conserva su archivo y añade una procedencia, sin
reemplazar la anterior. El filtro comprueba todas esas procedencias. La mezcla
concurrente usa la actualización condicional del puerto de datos.

La web usa `ResourceScopeProvider` para transmitir el contexto del Estudio a
búsqueda, canción, biblioteca, subida y stock. El formulario obtiene la categoría
principal de `requirements.resource_context`; la agrupación visual «letras» no
se confunde con la categoría propietaria NodeMotion. Antes de conocer el contexto
no se solicita una biblioteca general. Fuera del Estudio la consulta sigue siendo
general, o usa el filtro de categoría elegido en Recursos.

## Separación de responsabilidades

- Presentación: router de biblioteca, requisitos y contratos HTTP.
- Servicio: `core/library/asset_library.py`, procedencias y migración.
- Puerto de catálogo: `core/ports/resource_context_port.py`.
- Adaptador de catálogo: `adapters/library/resource_context.py`.
- Puertos de persistencia: `RecordCollection`, `DocumentStore`, `FileStorage`,
  definidos en `core/ports/data_port.py` y seleccionados por `core/data.py`.
- Adaptadores de persistencia: los existentes en `adapters/data/`.

El servicio no escribe ni conoce rutas JSON. El adaptador de datos seleccionado
decide cómo persistir registros y archivos. El perfil activo conserva su carpeta
`resources/`; no se trasladan medios ni se duplican los de las producciones.

Ejemplo de metadata:

```json
{
  "media_type": "video",
  "category_id": "node_motion",
  "category_name": "NodeMotion",
  "template_id": "lyrics-romantic",
  "template_name": "Carta de Amor",
  "resource_origins": [
    {
      "category_id": "node_motion",
      "category_name": "NodeMotion",
      "template_id": "lyrics-romantic",
      "template_name": "Carta de Amor"
    }
  ]
}
```

## Fondos de las plantillas de letras

Los espacios de fondo que solo declaraban imagen en Letras de Impacto, Carta de
amor, Suave y Triste ahora declaran `image|video`. Sus motores ya admitían ambos
tipos. Los selectores muestran ambas opciones y cada una permite subir archivos.
Los espacios que ya admitían video mantienen esa capacidad.

`with_selected_background` adapta una copia de la configuración para ese trabajo:
resuelve imagen o video y el nombre `bg.jpg` o `bg.mp4`. El generador fija también
`bg.type`, evitando procesar el video como imagen. No cambia el nicho compartido,
los HTML, las escenas, los efectos ni los medios originales de las demos.
Las composiciones que no declaran ningún espacio de medios conservan su contrato.

## Registros anteriores

Desde el servidor, con el perfil activo verificado:

```bash
.venv/bin/python -m scripts.migrate_resource_provenance
.venv/bin/python -m scripts.migrate_resource_provenance --apply
```

La primera operación solo informa cantidades. La segunda añade metadata usando
referencias comprobables de originales, borradores y configs archivadas, o una
categoría ya reconocible. Es reanudable y no mueve, borra ni modifica binarios.
Los recursos sin evidencia quedan sin atribución y siguen visibles en la consulta
general; no aparecen en NodeMotion por una suposición. Una migración repetida no
vuelve a modificar registros ya actualizados.

## Restricciones retiradas y compatibilidad

Se retira la restricción de solo imagen en los cuatro fondos mencionados y la
consulta global implícita dentro del Estudio. Se conserva la API existente, sus
identificadores, rutas de archivos, cachés de transcripción y compatibilidad con
registros antiguos. No se eliminan endpoints ni flujos ajenos a esta modificación.

Las verificaciones cubren aislamiento por categoría en los cuatro tipos de
recursos, metadata de subida, rechazo de origen inválido, deduplicación con varios
orígenes, migración idempotente y config final del fondo de video. Las pruebas de
interfaz comprueban los filtros y los parámetros de la carga.

## Validación en el servidor

- 67 pruebas de backend y 2 pruebas de interfaz aprobadas; TypeScript sin errores.
- API activa: requisitos de Letras de Impacto y Carta de Amor con `image|video`.
- Consulta filtrada NodeMotion: videos 0,155 s; imágenes 0,223 s; música 0,176 s.
  Consulta general de videos: 119 recursos en 1,306 s. Son mediciones puntuales.
- La optimización filtra antes de cargar detalles de producciones ajenas y reutiliza
  metadata dentro de la misma consulta; la caché no se conserva indefinidamente.
- Migración aplicada: 69 registros actualizados, 64 clasificados y 5 sin evidencia
  suficiente. Segunda ejecución sin actualizaciones pendientes; referencias a
  binarios comprobadas iguales antes y después.
- La recarga automática quedó esperando conexiones antiguas. Se comprobó ausencia
  de tareas activas y se liberó el proceso antiguo; la API volvió a responder.
- No se generaron grabaciones para validar este cambio. El navegador conectado no
  permitió la revisión visual de la sesión; las interacciones se verificaron con
  pruebas de componentes y el contrato/config de los fondos con pruebas de backend.
