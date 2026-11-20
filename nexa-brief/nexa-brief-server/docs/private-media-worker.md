# Private Media Worker en Nexa Brief

Nexa puede procesar transcripciones y renders HyperFrames localmente o mediante un worker privado. Los contratos del pipeline siguen siendo `LyricsTranscriptionPort` y `RecorderPort`. El cliente remoto envía audio o un proyecto HyperFrames autocontenido, consulta la cola y descarga el resultado; no se conecta directamente a Redis.

## Selección de proveedor

La API lee configuración del entorno y, opcionalmente, de `~/.config/private-media-worker/nexa-media.env` del usuario que ejecuta Nexa. Las variables de entorno explícitas prevalecen sobre los archivos. Para usar el VPS:

```dotenv
NEXA_MEDIA_PROVIDER=vps
NEXA_PRIVATE_MEDIA_URL=http://100.109.214.103:8765
NEXA_PRIVATE_MEDIA_TOKEN_FILE=/home/alfred/.config/private-media-worker/api-token
```

Cambiar `NEXA_MEDIA_PROVIDER` a `local` vuelve a los adaptadores locales. Reinicia la API cuando no haya trabajos activos; una configuración modificada no cambia el entorno de un proceso ya iniciado. `NEXA_TRANSCRIPTION_PROVIDER` y `NEXA_RENDER_PROVIDER` son overrides opcionales (`local` o `vps`) y prevalecen sobre el valor global. Sin estas variables se conserva la selección anterior, incluido AWS. Un `render_target` explícito del trabajo tiene prioridad.

La selección de destino no cambia el motor del nicho: para enviar video al worker, el motor efectivo debe ser HyperFrames y la plantilla debe ser compatible. Remotion y Playwright conservan sus motores. La detección de idioma independiente usa todavía el detector local; la transcripción VPS sí respeta el idioma explícito.

## Red, privacidad y errores

Solo Alfred puede acceder a la API de la VPS a través de Tailscale; el token se conserva en un archivo privado fuera del repositorio. El cliente bloquea destinos públicos y proxies heredados del entorno. No hay fallback automático a otro proveedor. Los errores de autenticación, cola llena, corte de red, límites y expiración se notifican sin registrar el contenido del audio o video. No se reenvía una subida si se desconoce si fue aceptada.

Cada trabajo conserva sus entradas en tmpfs mientras está en cola o procesándose. Al finalizar, Nexa descarga y confirma el resultado; el worker elimina entonces archivos y estado. Si no se confirma, el resultado caduca a los 270 segundos y un limpiador independiente lo revisa cada 10 segundos. El ledger persistente contiene únicamente metadatos. Hay que mantener swap desactivado. Si Redis permanece inaccesible, el limpiador elimina tras 270 segundos los directorios antiguos sin bloqueo activo; una tarea que estuviera en cola puede fallar al recuperarse Redis.

La cancelación de Nexa se solicita al worker; este detiene el proceso y luego limpia. Si la red se cae, la solicitud puede no llegar: el worker aplica sus propios límites y limpieza. Los jobs remotos tienen identificadores propios que aparecen en los logs de Nexa.

## Capacidad y operación

En la VPS actual hay una tarea activa como máximo, cuatro hilos de Whisper, cuatro workers de render y `CPUQuota=360%` sobre cuatro CPU virtuales. La cola mantiene trabajos pendientes y la admisión limita su número. El orden entre perfiles distintos se aproxima por tiempo de llegada en los lotes de Redis; no se promete un orden estricto si una tarea no tiene memoria suficiente para iniciarse. Cuatro workers de video pueden aumentar la memoria consumida: revisa las métricas y ajusta la configuración si cambia el hardware.

Los proyectos HyperFrames deben llevar sus recursos locales: el render corre sin red. El empaquetador incorpora algunas fuentes y GSAP disponibles en Nexa y rechaza dependencias externas reconocibles que no pueda resolver. Las URLs construidas dinámicamente por JavaScript necesitan revisión adicional.
