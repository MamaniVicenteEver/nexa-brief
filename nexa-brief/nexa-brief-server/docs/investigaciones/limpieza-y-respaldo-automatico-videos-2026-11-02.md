# Grabaciones futuras: limpieza y respaldo automático

Implementado el 2 de noviembre de 2026 en `alfred-server`. Activación del respaldo:
21:19, hora de Bolivia. El proyecto y los datos activos conservan sus ubicaciones.

## Comportamiento

1. La grabación trabaja en una carpeta temporal privada. Los motores HyperFrames,
   Playwright, Remotion y el renderizador del kit publican el MP4 después de terminar;
   un fallo conserva el video anterior y retira sus capturas y archivos parciales.
2. El gestor de subprocesos termina los procesos hijos en timeout, cancelación y
   cierre del CLI. Las capturas del kit se cierran también al recibir SIGTERM.
3. Biblioteca conserva los MP4 utilizables y sus datos en el perfil profesional
   de `.local`. Un trabajador independiente reconoce los trabajos terminados y
   guarda una tarea persistente de respaldo; no bloquea la API durante la copia.
4. Dentro de los 15 segundos siguientes comienza el respaldo al HDD. Incluye los
   formatos finales, miniatura, manifest, index, guion, audio, recursos, créditos y
   componentes compartidos necesarios disponibles. No copia frames, QA ni cachés.
5. La copia se verifica por tamaño y SHA-256 antes de publicar el paquete. Cada
   ID conserva una sola generación; un reintento no deja versiones acumuladas.
6. Si el HDD falta o su UUID no coincide, queda un error reintentable en `.local`.
   El video sigue funcionando y no se guarda un respaldo alternativo en el SSD.

El servicio del host cubre la API de desarrollo y Docker leyendo el mismo perfil.
El CLI directo emite un marcador durable al terminar todos los formatos completos;
la invocación desde la API lo suprime para evitar dos respaldos de la misma grabación.
Los previews siguen siendo previews y no disparan un respaldo completo.

Los temporales propios que queden tras SIGKILL/reinicio se reconocen por marcador,
prefijo, antigüedad y bloqueo. Se retiran después de diez minutos si están libres.
El sistema no borra carpetas genéricas `work/`, fuentes, audios o archivos ajenos.

## Ubicaciones

```text
~/.local/share/nexa-brief/profiles/profesional/
├── output/                         videos operativos de Biblioteca
└── data/video_backups/
    ├── activation.json             fecha inicial, conservada al reiniciar
    ├── queue.sqlite3               cola y estado por ID
    ├── events/                     último cierre CLI por proyecto
    └── status.json                 resumen y errores actuales

~/.local/mnt/nexa-backups/nexa-brief/
├── proyecto/, datos/, recuperacion/ respaldo consolidado anterior
└── producciones/
    ├── job-<hash-del-id>/           paquete vigente de cada video
    └── .generations/               contenido de esos paquetes
```

El HDD se identifica por UUID `6E2621FB2621C4C5`; las escrituras se anclan al
descriptor del montaje para impedir que un desmontaje redirija la copia al SSD.
El servicio `nexa-video-storage.service` está habilitado y tiene reinicio automático.
La configuración está en `~/.config/nexa-brief/video-storage.json`.

## Verificación

- Treinta pruebas integradas en el Python del servidor: procesos descendientes,
  cancelación, timeout, dos trabajos simultáneos, archivos anteriores conservados,
  HDD ausente/incorrecto, copia corrupta, reintento, revisión de fuentes, dos formatos,
  exclusión de QA y persistencia. Pruebas adicionales de restauración pasan localmente.
- Grabación real de un segundo, 30 FPS, con el motor del kit: MP4 de 462.219 bytes,
  ningún espacio de captura restante al terminar.
- Copia real al HDD con UUID comprobado, SHA-256 de los destinos, restauración de
  cuatro archivos y segundo sondeo sin una copia adicional. Se retiraron los medios,
  cola y paquete de esa prueba; no se añadió ningún video a la Biblioteca real.
- Se compiló la API y se comprobó su arranque. El primer intento usó el UID por
  defecto de Compose y no pudo leer el perfil; se corrigió al UID/GID 1000 que usa
  Make. Los scripts de compilación también toman ahora ese UID/GID por defecto. La API del host siguió disponible y no se cambiaron permisos de los datos.

No se ejecutó una nueva producción completa de varios minutos ni una publicación
en redes. Las pruebas de fallos de HyperFrames/Remotion usan procesos y adaptadores
simulados; la captura real comprobada corresponde al motor cuadro a cuadro del kit.
No puede evitarse una interrupción física mientras se escribe, pero los reintentos
y la limpieza al reiniciar acotan sus restos sin eliminar el video utilizable.

El crecimiento por videos finales y sus recursos es almacenamiento necesario.
Se evita la acumulación de capturas temporales, generaciones de reintentos e
imágenes Docker obsoletas; los comandos de compilación documentados aplican esa
última política. No se hicieron commits ni push.

Código y comandos de restauración: `scripts/video_storage/README.md`.

Estado final: API de Docker y web saludables, API del host disponible, página pública
HTTP 200 y servicio de respaldo activo y habilitado. SSD: aproximadamente 83,84 GB
usados tras retirar las imágenes intermedias de la actualización.
