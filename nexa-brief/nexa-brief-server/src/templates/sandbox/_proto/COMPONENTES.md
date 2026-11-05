# Componentes de prototipo (Sandbox): elegir outro v1/v2, mostrar u ocultar partes

Contrato comun entre el prototipo (JSON), el motor compartido (`_proto/proto.js`), la API y el visor web. Reutiliza la API de produccion `POST /api/v1/explainer/component-previews` (la que usa hoy el panel de paquete de publicacion): se le pasa el componente o los componentes a usar y devuelve la URL de la vista previa. Para videos del kit sigue funcionando exactamente igual; el alcance `sandbox` la extiende a prototipos del Sandbox.

## 1. Declaracion: `components` en el info.json del prototipo
```json
"components": [
  { "name": "atlas.outrov1", "label": "Outro v1", "summary": "Tierra grande, giro rapido.", "group": "outro", "default": true, "params": {} },
  { "name": "atlas.outrov2", "label": "Outro v2", "summary": "Tierra abajo, titulo arriba, giro lento.", "group": "outro", "params": {} },
  { "name": "atlas.fichas", "label": "Fichas con foto", "summary": "Fotos y paneles sobre el mapa.", "default": true, "params": {} }
]
```
- `name`: igual que en el kit, `^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$`; unico en el prototipo. `id` = parte tras el punto.
- `label` (max 60), `summary` (max 200): espanol, sin emojis. Maximo 16 componentes.
- `group` (opcional, `^[a-z][a-z0-9-]*$`): los componentes de un mismo grupo son mutuamente excluyentes y SIEMPRE hay exactamente uno activo (el `default: true` del grupo; cada grupo con exactamente un default). Sin `group` = componente opcional (interruptor): activo si `default: true` o si se lista.
- `params` (opcional): mismo esquema que el kit (`{clave: {type: "string"|"number"|"boolean", default, doc?, required?, options?, min?, max?}}`); el valor llega al motor.

## 2. Seleccion (URL de la previsualizacion del prototipo)
Parametros: `c=<name>` repetible (componentes activos), `cx=1` (opcional: seleccion EXPLICITA: los interruptores no listados quedan apagados; sin `cx` los interruptores siguen su `default` y `c` solo cambia grupos), `p=<JSON>` = `{"<name>": {param: valor}}` (max 8 KB). Ejemplo: `index.html?controls=1&c=atlas.outrov2&cx=1&c=atlas.fichas`. Un `c` desconocido o dos del mismo grupo: se ignora el segundo/desconocido (`console.warn`).

## 3. Aplicacion en la escena (JSON), resuelta UNA vez al cargar, antes de entregarla al motor del prototipo
- `when` en cualquier objeto que sea ELEMENTO de un arreglo (a cualquier profundidad): `"when": {"outro": "outrov2"}` (grupo -> id de componente activo; acepta arreglo de ids) o `"when": {"fichas": true}` (interruptor, por `id`). Varias claves = AND. Si no se cumple el elemento se elimina; si se cumple se conserva sin la clave `when`. Nombre de grupo/componente no declarado: `console.error` y el elemento se conserva.
- `$by` como VALOR: `{"$by": "outro", "outrov1": 30, "outrov2": 33, "default": 30}` se reemplaza por la rama del componente activo del grupo (o `on`/`off` para interruptores). Falta la rama: usa `default`; si tampoco, `console.error` y primera rama. Las ramas pueden ser cualquier JSON y se resuelven recursivamente.
- `$param`: `{"$param": "atlas.outrov2.titulo"}` = valor del parametro (o su default declarado).
- La resolucion es una funcion pura `resolveComponents(scene, declared, selection)`, no muta la entrada. El motor del prototipo recibe la escena ya resuelta.
- `window.__promo.components = { declared, active: [names], params }` para depurar y para el grabador. Si `info.json` no existe o no declara `components`, nada cambia (comportamiento actual).

Detalles del motor: las entradas invalidas o repetidas se omiten con advertencia; si un grupo no tiene exactamente un default valido, se omite todo el grupo. Se aceptan hasta 16 entradas validas. `p` se mide en bytes UTF-8 despues de decodificar la URL; si es invalido, no es un objeto o excede 8 KB, se ignora con advertencia. El motor usa los parametros declarados y sus defaults; la validacion de valores recibidos corresponde a la API. Si una condicion mezcla una clave desconocida con otra falsa, se conserva el elemento y se informa el error. En `$by` desconocido se informa el error y se usa `default` o la primera rama; un `$param` no declarado informa error y se resuelve como `undefined`.

## 4. API: `POST /api/v1/explainer/component-previews` ampliada
Item nuevo (retrocompatible, `extra=forbid` se mantiene): `scope: "kit" | "sandbox"` (def. `kit`) y, solo para `sandbox`, `components: list[str]` (max 16; componentes adicionales activos; si viene, la seleccion es explicita -> `cx=1`). Para `sandbox`: `video_id` = id del prototipo (carpeta `sandbox/<categoria>/<id>`; se resuelve con el catalogo del Sandbox, y si hay mas de una categoria con ese id, error claro); `component` debe estar declarado en su `info.json`; `params` se valida contra el esquema declarado (tipos, options, min/max, desconocidos rechazados) y las imagenes con `_check_image_sources`; `time_seconds`/`duration_seconds` se ignoran. Respuesta: `{key, video_id, design: "", component, preview_url}` con `preview_url` = `/api/v1/explainer/files/sandbox/<categoria>/<id>/index.html?controls=1&c=...&cx=1&p=...`. Errores: `ComponentPreviewError` -> 400 con mensaje en espanol, igual que hoy.
`GET /api/v1/explainer/sandbox/{folder}/{id}/info` incluye `components` (validado como en 1; invalidos se omiten con advertencia, nunca rompen el listado) y cada item del listado `has_components: bool`.

## 5. Visor del Sandbox
Si el prototipo declara componentes, la previsualizacion muestra una seccion «Componentes»: un selector segmentado por grupo (p. ej. «Cierre: Outro v1 | Outro v2») y un interruptor por componente opcional. Cada cambio pide la URL con `requestComponentPreviews` (mismo servicio que el panel de publicacion, con `scope: "sandbox"`) y recarga el iframe. La eleccion se recuerda por prototipo en el navegador (localStorage con try/catch). Sin emojis en la UI.
