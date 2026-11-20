# Trazas de consumo de modelos

En los perfiles v2/v3 el detalle de producción y Sandbox está en `logs/` y las
referencias indexables en la colección `execution_logs` de `data`. La clave de
contenido incluye ámbito, categoría e identificador; no se debe identificar un
proyecto solo por su nombre. Nunca guardar prompts, respuestas ni credenciales
en la traza de consumo.

Cada llamada nueva debe registrar un `event_id` estable para reintentos de la
misma operación, proveedor, modelo, etapa, resultado y los tokens realmente
informados. `usage_known=false` identifica una llamada cuyo proveedor no informó
consumo; no significa consumo cero. Briefs previos a la creación del video usan
`usage_trace_id`; ese ID se conserva en el brief y se vincula en el índice al
crear la producción. El mismo brief puede vincularse a más de un video: no
sumar varias veces su traza al consolidar varios videos.

`GET /api/v1/content/usage/{scope}/{folder}/{id}` consulta Sandbox o producción;
`GET /api/v1/content/usage/video/{id}` resuelve un video no ambiguo y
`GET /api/v1/content/usage/design/{id}` agrupa proyectos y videos por diseño.
Las rutas requieren la autenticación interna habitual. Los valores históricos
se muestran como parciales: algunas llamadas anteriores nunca se registraron.
Si una estimación antigua puede solaparse con el ledger se conserva aparte y
no se suma. Los totales combinados sin desglose no se presentan como entrada.

El total incluye caché una vez. En Codex/OpenAI y DeepSeek el razonamiento es
parte de la salida; Gemini lo informa separado. La caché de Claude se informa
aparte de la entrada. Son tokens procesados, no una factura en dinero. Fuentes:
[OpenAI: razonamiento](https://developers.openai.com/api/docs/guides/reasoning),
[DeepSeek: uso](https://api-docs.deepseek.com/guides/responses_api/) y
[Gemini: metadatos de uso](https://ai.google.dev/api/generate-content).

Para referencias históricas, `python scripts/index_usage_history.py` muestra
un plan; `--apply` registra las referencias y recupera mediciones identificables
de intentos fallidos de prototipo v3. El script es repetible y no reescribe ni
desplaza archivos fuente. Ejecutarlo solo con el perfil correcto seleccionado.
Cuando existe el flujo de preparación editorial de Sandbox, también recupera
sus mediciones históricas y registra sus nuevos intentos en la misma estructura.
Un total ausente no se puede reconstruir ni atribuir a un modelo sin evidencia;
no inferir gasto a partir de una mención del proyecto en una sesión compartida.
