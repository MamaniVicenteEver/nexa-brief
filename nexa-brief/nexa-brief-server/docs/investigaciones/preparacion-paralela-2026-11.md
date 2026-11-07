# Preparación paralela y programada

Entradas: el API existente conserva su productor; el chat utiliza `src/skills/explainer/batch/SKILL.md` y `python -m src.core.explainer.batch_cli`. No hay nuevos formularios ni endpoints públicos.

## Límites

- Global: 1 de fábrica, configurable persistentemente con `configure --parallel N`. Máximo deliberado en `src/config/production_limits.py`: 5. El cambio de capacidad no cancela agentes activos.
- Por lote: 1 de fábrica; `submit --parallel N`. Capacidad efectiva = mínimo del límite global y el del lote. Diez pedidos con capacidad cuatro avanzan como máximo cuatro a la vez.
- Admisión: `EXPLAINER_MAX_PENDING_PRODUCTIONS`, 100 por defecto. Rechaza el exceso antes de aceptar el lote. No limita los registros históricos terminados.
- Herramientas pesadas: voz con su QC Whisper, transcripción, componentes, hojas y portada comparten un solo lease. El razonamiento de distintos agentes puede continuar mientras esperan sus herramientas.
- El render sigue con sus controles existentes; los lotes de preparación nunca solicitan render ni publicación, y el prerecord automático los omite.

## Persistencia y coordinación

Las colecciones lógicas `explainer_runtime`, `explainer_batches`, `explainer_productions` y `content_plan` pasan por DataStore. Los slots y la propiedad de cada producción usan locks del kernel en el DATA_DIR común. CLI, API de desarrollo y API actualizada de Docker deben apuntar al mismo perfil para coordinarse.

El mecanismo es para procesos de **una máquina con filesystem compartido**. Escalar a varias máquinas requiere reemplazar este adaptador de leases por coordinación de base de datos o broker; aumentar el número de procesos no crea coordinación distribuida.

Una producción encolada persiste y se despacha al vencer `not_before`. Una producción interrumpida durante ejecución queda fallida para Retomar, con huella de fase y presupuesto del productor vigente. No se repiten automáticamente llamadas ambiguas a modelos.

El lote se admite antes de arrancar ningún video; una admisión incompleta se revierte al iniciar un worker. Se conserva el request_id para evitar duplicar un pedido reenviado desde el chat.

## Horarios y vista existente

`--at` acepta ISO 8601 y `--timezone` una zona IANA (por defecto America/La_Paz). Se convierte a UTC, se conserva la zona y se añade un ítem por video al plan guardado de Programación con su producción vinculada. Es **hora de preparación**, no una orden de publicación.

El worker se ejecuta independientemente del interruptor de publicación y de las credenciales de redes. Instalar `deploy/nexa-content-worker.service` como servicio de usuario y habilitarlo. También se despacha durante el lifespan de la API actualizada, con propiedad compartida que evita duplicados.

La programación implementada es por fecha concreta. Las recurrencias editoriales se expresan por ocurrencias explícitas hasta ampliar su interfaz; no hay una nueva UI de recurrencias.

## Pruebas y eliminación

`short_test=true`, minutes 1–2, usa un perfil específico en lengths.json y mantiene la duración mínima habitual del resto. No se graba MP4: la revisión usa el HTML vivo con voz y storyboard. Los IDs del lote, producción, video y plan permiten consultar y eliminar exclusivamente los resultados de esa tanda después de su aprobación.

`batch_cli delete ID --files` requiere que ninguna tarea del lote tenga propietario, comprueba production_id en el manifest y elimina los directorios de preparación, logs y filas del lote. No debe borrar medios o estados compartidos de otros videos ni promete borrar registros externos de proveedores.


## Hallazgo del ensayo real y protección de memoria

La primera prueba descubrió dos contratos editoriales omitidos (act en documental y paquete preliminar estricto). Se corrigieron las instrucciones y la lectura de miniaturas en borrador; los validadores siguen activos.

El segundo intento expuso una ruta de transcripción en primer plano que llama directamente a worker y no pasa por __main__. El lease se trasladó a worker para cubrir ambos modos, con prueba de regresión específica. Antes de corregirlo coincidieron dos Whisper y el kernel terminó el servicio por OOM; se conservaron los archivos y los pedidos quedaron interrumpidos para retomar explícitamente.

El presupuesto de audio espera por defecto 5120 MiB disponibles y el visual 1024 MiB, configurables mediante EXPLAINER_AUDIO_MIN_AVAILABLE_MIB y EXPLAINER_VISUAL_MIN_AVAILABLE_MIB. El servicio independiente tiene MemoryHigh=5G, MemoryMax=6G y MemorySwapMax=512M; estos límites se revisan al cambiar de hardware. El dispatcher de la API cede al servicio independiente para evitar que una recarga web interrumpa nuevos lotes.

La huella de audio se calcula sobre texto y dirección vocal, con JSON canónico y versión audio-v1. Cambiar capítulos, actos o subtítulos no repite TTS/Whisper. Los marcadores anteriores se migran cuando el archivo original sigue intacto; un cambio hablado sigue invalidando voz y transcripción. La prueba cubre ambos casos y la migración sin repetir voz válida.

Se corrigió también el registro del cierre de NodeEconomy y el reconocimiento de intros con imagen de diseños registrados como Dinero. Se reutiliza el cierre genérico existente de Charon, sin inventar cuentas sociales ni generar otra voz. Las reglas estrictas de imagen, guion y publicación siguen activas.

`batch_cli validate ID` permite revalidar contenido existente después de una corrección de compatibilidad: exige guion, storyboard no vacío, audio/transcripción y huella vigente; no invoca al agente ni repite voz. `resume` sigue siendo la operación para continuar contenido incompleto. El ensayo dejó los tres preparados y restauró la capacidad global a 1; el máximo 5 todavía no tiene una prueba de carga real de cinco producciones.
