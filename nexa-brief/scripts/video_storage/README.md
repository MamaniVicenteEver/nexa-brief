# Respaldo de videos y limpieza de temporales

Servicio del host `nexa-video-storage.service`. Detecta cada 15 segundos los videos
empaquetados/publicados del perfil compartido y los eventos de grabación completa
del CLI. Funciona para la API local y Docker sin montar el HDD dentro del contenedor.

Los MP4 operativos y los índices de Biblioteca permanecen en el perfil `.local`.
La cola y su estado están en `data/video_backups/{queue.sqlite3,status.json}`.
Una indisponibilidad del HDD deja el respaldo pendiente de reintento y no cambia
el resultado del video. El servicio comprueba el punto de montaje y su UUID real
antes de escribir y publicar; no crea copias de respaldo en el SSD.

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
