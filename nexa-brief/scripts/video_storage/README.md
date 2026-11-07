# Respaldo de videos y limpieza de temporales

Servicio del host `nexa-video-storage.service`. Detecta cada 15 segundos los videos
empaquetados/publicados del perfil compartido y los eventos de grabación completa
del CLI. Funciona para la API local y Docker sin montar el HDD dentro del contenedor.

Los MP4 operativos y los índices de Biblioteca permanecen en el perfil `.local`.
En v1, la cola y su estado están en `data/video_backups/{queue.sqlite3,status.json}`.
En v2, los eventos y el estado JSON permanecen en `data/video_backups/`, y la cola
SQLite está en `.system/runtime/video_backups/queue.sqlite3`. Los eventos v2
referencian producciones y renders del perfil; no duplican el MP4 operativo.
Si existe una cola v1 al seleccionar v2, el estado informa que requiere una
migración explícita; no se mueve ni se descarta automáticamente.
Una indisponibilidad del HDD deja el respaldo pendiente de reintento y no cambia
el resultado del video. El servicio comprueba el punto de montaje y su UUID real
antes de escribir y publicar; no crea copias de respaldo en el SSD.

Esta regla también se aplica a respaldos completos, copias de migración y copias
manuales hechas por agentes. El montaje configurado en este servidor es
`/home/alfred/.local/mnt/nexa-backups`, UUID `6E2621FB2621C4C5`. Una carpeta con ese
nombre en el SSD no sirve como destino: debe estar montado el volumen correcto.
Si falta, el respaldo queda pendiente y no se inventa una ruta local alternativa.
Los índices, colas y recibos pequeños de operación pueden seguir en el perfil;
no son un segundo respaldo de sus medios. Véase
[`almacenamiento-respaldos-limpieza-2026-11.md`](../../nexa-brief-server/docs/almacenamiento-respaldos-limpieza-2026-11.md).

Cada paquete del HDD contiene las salidas finales, fuentes, recursos y metadatos.
Excluye frames, capturas QA, directorios `work`, cachés y dependencias regenerables.
Conserva una generación por ID: los reintentos no multiplican paquetes. El CLI
directo actualiza el respaldo de ese proyecto; cada grabación de Biblioteca tiene
su propio ID. Los previews no producen un respaldo completo.

La ruta de cada paquete es `nexa-brief/producciones/job-<sha256-del-id>/`. Ese enlace
apunta a su única generación en `.generations/`. Los archivos iguales dentro del
paquete comparten bloques mediante enlaces duros; la copia operativa del SSD sigue
independiente. El manifest incluye el ID original, tamaños, SHA-256 y atributos.

```bash
# Estado y últimos errores; no muestra credenciales.
systemctl --user status nexa-video-storage.service
cat ~/.local/share/nexa-brief/profiles/profesional/data/video_backups/status.json

# Instalar/reponer el servicio de este servidor. Conserva configuración existente.
python3 scripts/video_storage/install_video_service.py

# Restaurar a una carpeta NUEVA; primero se comprueba cada archivo.
python3 scripts/video_storage/restore_video.py \
  /home/alfred/.local/mnt/nexa-backups/nexa-brief/producciones/job-ID \
  /home/alfred/Recuperacion/video

# Pruebas sin grabar ni publicar.
cd nexa-brief-server
.venv/bin/python -m pytest ../scripts/video_storage -q
```

Configuración del servidor: `~/.config/nexa-brief/video-storage.json`. Activación
persistida en `data/video_backups/activation.json`; no se vuelve a respaldar todo
el histórico al reiniciar. Los respaldos históricos consolidados siguen en sus
carpetas anteriores del mismo HDD y no se modifican.

Los motores usan un espacio temporal privado con marca de propiedad y bloqueo.
En éxito, fallo, timeout o cancelación se limpia y se detienen sus procesos hijos.
Tras una terminación abrupta, el servicio retira espacios propios huérfanos de más
de diez minutos cuyo bloqueo esté libre. No barre carpetas antiguas por nombre
genérico ni elimina recursos, audios o videos operativos. Un fallo eléctrico puede
dejar temporales hasta que el servicio vuelva a ejecutarse.

Usar los comandos Make o `scripts/docker-refresh.sh` para construir imágenes: pasan
el UID/GID del usuario y ejecutan la política de retención de Docker. La herramienta
de respaldo no cambia resolución, FPS, códec ni diseño de los videos.
