---
name: editions
description: Crear o recuperar una edición nativa de un video existente por idioma y mercado, desde la misma API privada que utiliza el modal web.
---

# Ediciones nativas de videos existentes

Esta guía corresponde al **agente operador** que recibe el pedido del humano.
El servidor dirige el trabajo y entrega al agente editorial un workspace aislado.
No ejecutes esta CLI desde ese workspace editorial ni amplíes sus permisos.

Lee `../CALIDAD.md` y `../ORQUESTACION.md`. Este flujo adapta la intención, el
gancho, los matices, el ritmo y las estrategias del mercado; conserva hechos,
cifras, nombres, atribuciones y grados de certeza. Reutiliza la investigación,
los medios aprobados y los componentes del video original. No hagas una nueva
investigación ni una traducción literal sin intención.

## Una única entrada para web y agentes

El modal web y la CLI llaman los mismos endpoints de localización. La CLI no
ejecuta otro productor, no abre datos del perfil y no genera voz por su cuenta.
Por defecto llama a `http://127.0.0.1:8000/api/v1`, dentro del servidor privado.
Usa `--api-url` **antes del subcomando** solamente si el operador ya proporcionó
otra dirección autorizada de su propia API. No publiques este proyecto, sus
documentos ni su contenido en servicios externos para compartirlos.

Desde la raíz del repositorio, ejecuta los comandos en Bash (el helper utiliza
`BASH_SOURCE`; no lo cargues directamente desde zsh). Prepara el entorno del
perfil con su helper:

```bash
bash
source scripts/profile-env.sh
cd nexa-brief-server
```

La selección efectiva sigue siendo la del proceso API: cambiar el entorno del
CLI no cambia un servidor ya iniciado. Consulta el catálogo privado de videos
(`GET /api/v1/explainer/videos`) para identificar el ID exacto; no deduzcas una
carpeta de otro perfil. Ejecuta el preflight y comprueba el ID de perfil, su
esquema y la revisión de la fuente antes de crear:

```bash
.venv/bin/python -m src.core.explainer.editions preflight VIDEO_ID --locale en-US
.venv/bin/python -m src.core.explainer.editions list VIDEO_ID
```

`es-419` es el original; inicialmente las ediciones disponibles son `en-US` y
`pt-BR`. Los alias `es`, `en` y `pt` se normalizan. Los mercados habilitados y la
identidad real se resuelven en el servidor, sin copiar configuración al CLI.
El preflight verifica requisitos locales y disponibilidad del ejecutor sin
llamar a modelos ni generar audio. `quota_verified: false` significa que no se
ha confirmado la cuota del proveedor; no anuncies que está garantizada.

## Crear, seguir y recuperar

Interpreta `next_action` antes de actuar:

| Acción | Operación del agente |
|---|---|
| `create` | Si `ready` es verdadero, crear la edición solicitada. Resolver primero los errores que liste el preflight. |
| `wait` | Conservar `job_id`; seguir ese trabajo. No crear otro ni reiniciar servicios. |
| `resume` | Usar el comando `resume` sobre el mismo trabajo compatible para aprovechar sus checkpoints. |
| `review` | Revisar la edición existente en el modal; la generación terminó y falta la revisión. |
| `ready` | Reutilizar la edición existente; no consumir otra generación. |

```bash
.venv/bin/python -m src.core.explainer.editions create VIDEO_ID --locale en-US --wait
.venv/bin/python -m src.core.explainer.editions status JOB_ID
.venv/bin/python -m src.core.explainer.editions status JOB_ID --wait --wait-timeout 1800
.venv/bin/python -m src.core.explainer.editions resume JOB_ID --wait
```

`create` siempre hace preflight. Si la edición existe, la reutiliza. Si hay un
trabajo activo, lo consulta; si hay uno recuperable, informa su ID y exige
`resume` explícito. Solo un pedido de **otra versión** justifica:

```bash
.venv/bin/python -m src.core.explainer.editions create VIDEO_ID --locale en-US --new-version --wait
```

Los resultados y el progreso son JSON. Se consulta cada tres segundos mientras
se usa `--wait`; no mantengas sondeos después de terminar. El timeout de espera
y `Ctrl+C` terminan el cliente, **no cancelan** el trabajo que ya aceptó la API.
Conserva `job_id` y consulta `status` antes de repetir una operación de pago. Si
la conexión se cortó antes de recibirlo, consulta `list` y `preflight` primero.
Códigos de salida: `0` operación correcta, `1` error o trabajo fallido, `2`
argumentos inválidos, `3` precondición pendiente, `124` espera agotada, `130`
interrupción local.

Si la API exige autenticación, utiliza el acceso privado autorizado que
proporcione el operador. No leas archivos de credenciales, tokens ni `.env`,
no los pegues en comandos y no desactives la autenticación para hacer funcionar
el CLI.

## Qué hace el servidor y qué debe revisar el operador

La API crea el contrato congelado de mercado, extrae la investigación y el
guion originales y llama al agente editorial aislado con los prompts de
`prompts/lead.md`, `prompts/task.md` y `prompts/output.schema.json`. Ese agente
entrega **únicamente** `edition.output.json`: diálogo adaptado, rótulos, frases
de anclaje y el paquete editorial A/B/C. El host valida el resultado, genera la
voz configurada, transcribe ese audio, ajusta los tiempos, reutiliza componentes
y medios, prepara las tres miniaturas y activa la revisión completa.

No cambies voces, modelos, tiempos ni parámetros técnicos desde el prompt para
resolver un fallo. No ejecutes herramientas TTS/STT manualmente, no edites
checkpoints, `active.json`, workspaces ni archivos del perfil para simular que
terminó. El servidor reutiliza pasos válidos al recuperar. Nunca uses Opus;
respeta la política de modelos configurada y registra el proveedor realmente
utilizado. La falta de cuota se resuelve como bloqueo del proveedor, no
ampliando permisos o cambiando de modelo por tu cuenta.

`completed` significa **generación terminada**, no aprobación editorial. Abre
el modal del video en el idioma correspondiente y revisa audio, subtítulos,
intención y matices, sincronización, tres miniaturas, títulos y textos de cada
red. Aprueba la edición en el estudio solo cuando el humano haya autorizado
esa revisión y el resultado cumpla la puerta de calidad. No des por aprobadas
ediciones futuras por una aprobación anterior de otro video o revisión.

Crear una edición no graba un MP4 ni publica en redes. Grabación y publicación
requieren su propio pedido explícito. Entrega el informe indicado por
`../PLANTILLA-INFORME.md`: idioma, revisión, estado, evidencias de revisión,
consumo registrado por la API y limitaciones verificadas. El CLI no añade
llamadas editoriales, TTS o transcripción fuera de las que dirige ese trabajo.

El comando histórico `show --production RUTA --locale ...` conserva su función
de inspección local del contrato y no crea una edición ni medios.
