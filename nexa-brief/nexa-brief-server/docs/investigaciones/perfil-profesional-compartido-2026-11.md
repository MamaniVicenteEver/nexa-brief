# Perfil Profesional: datos compartidos entre desarrollo y producción

Instalación: `alfred-server`. Fecha: 2 de noviembre de 2026.

## Ubicación y funcionamiento

El perfil **Profesional** está fuera del repositorio, en:

`/home/alfred/.local/share/nexa-brief/profiles/profesional/`

Ambas API y ambas webs usan este conjunto de datos. El modo de ejecución (`development` o `production`) conserva sus reglas de acceso y su código; el perfil selecciona los datos y los proveedores de almacenamiento. Una edición, eliminación o reconexión realizada en cualquiera de las dos aplicaciones afecta al mismo perfil. Desarrollo usa cuentas reales.

| Directorio | Contenido compartido |
| --- | --- |
| `data/` | Trabajos, borradores, colas, notificaciones, bibliotecas, historial y archivo de publicaciones |
| `output/` | Salidas, medios y archivos generados |
| `connections/` | Autorizaciones cifradas, canales y clave específica del puente TikTok |
| `web-data/` | Usuarios y solicitudes de acceso |
| `tiktok/` | Datos y perfiles existentes del servicio TikTok, conservados sin cambiar el formato ni Playwright |
| `config/` | Nichos, categorías y estilos de publicaciones |
| `profile.json` | Identidad del perfil y selección de proveedores; no contiene tokens |

Las plantillas y herramientas que son código siguen en `src/templates/`, ya compartido con Docker. Las rutas antiguas de datos ignoradas por Git son enlaces de compatibilidad hacia el perfil externo. El perfil, sus respaldos y sus credenciales no se incorporan a Git ni a las imágenes.

## Arranque y selección

Desde el checkout del servidor:

```bash
./scripts/start-docker.sh
./scripts/start-dev.sh
```

`make docker-up` crea o actualiza los contenedores con los montajes del perfil. `start-docker.sh` inicia los contenedores ya creados; después de cambiar de perfil hay que recrearlos con `make docker-up`. `make dev` inicia API y web de desarrollo. Detener desarrollo deja TikTok disponible para producción.

La selección explícita usa `NEXA_DATA_PROFILE` o una ruta absoluta `NEXA_PROFILE_DIR`. Ejemplo para preparar un conjunto **vacío e independiente**:

```bash
python3 scripts/storage-profile.py init pruebas --label Pruebas --tiktok-port 8101
NEXA_DATA_PROFILE=pruebas ./scripts/install-connections-service.sh
NEXA_DATA_PROFILE=pruebas make dev
```

La inicialización solo copia las definiciones de categorías y estilos. No importa cuentas, usuarios, trabajos ni medios de otro perfil. Un perfil nuevo requiere sus propias conexiones y usuarios; para usar TikTok también necesita configurar la clave del puente. Su puerto debe ser distinto si convive con el servicio Profesional. Un nombre de proveedor no instalado produce un error explícito.

Para seleccionar un perfil en ejecuciones directas de Python/Node que no pasan por Make:

```bash
python3 scripts/storage-profile.py activate profesional
```

El selector reside en `~/.config/nexa-brief/storage-profile.json`. Las variables explícitas prevalecen. Cambiar de perfil exige reiniciar los procesos afectados. No se conmuta un conjunto de datos durante un trabajo activo.

El servicio del perfil actual es:

```bash
systemctl --user status nexa-tiktok-profesional.service
```

El puente comprueba el identificador del perfil. La idempotencia de TikTok usa el perfil como espacio común para ambas API.

## Escrituras y procesos

Las colecciones JSON usan reemplazos atómicos, archivos temporales únicos y bloqueos `flock` entre procesos. El repositorio de publicaciones conserva sus versiones, bloqueo y comprobación de revisión. Los usuarios y las solicitudes de acceso usan una transacción con bloqueo compartido entre las dos webs. Los permisos del directorio web permiten escribir al usuario del host y al grupo adicional del contenedor.

Los trabajos de prototipos y producciones tienen un propietario reconocido por el sistema operativo; una API no recupera como interrumpido un trabajo que ejecuta la otra. El planificador también tiene un único propietario. La publicación automática continúa desactivada. Los eventos de ambas API se propagan mediante un registro acotado del perfil para actualizar las pantallas conectadas.

Esto está diseñado para procesos Linux del **mismo servidor y disco local**. Si las API se separan en máquinas, los bloqueos y el transporte de eventos deben sustituirse por mecanismos de base de datos y mensajería.

## Preparación para Supabase

El manifiesto separa cinco proveedores:

```json
{
  "records": "json",
  "publications": "json",
  "credentials": "encrypted_json",
  "users": "json",
  "media": "filesystem"
}
```

Hay puntos de composición para registrar adaptadores por dominio: `adapters/data/provider_registry.py`, las fábricas de registros y publicaciones, `adapters/publishing/credential_factory.py` y los repositorios de autenticación de la web. Las credenciales de cliente se consultan mediante un método público del almacén, sin depender de su estructura JSON interna.

**Supabase no está conectado todavía.** El futuro cambio necesita implementar el adaptador, esquema, migración, permisos y verificación de cifrado. No basta con cambiar el nombre en el manifiesto. Se podrá migrar primero usuarios y credenciales, manteniendo archivos grandes en disco; el perfil seguirá identificando el conjunto de datos.

## Respaldo y reversión

La migración se hizo con los escritores detenidos. Se conservaron copias completas de producción y los directorios originales de desarrollo en el respaldo externo `backups/professional-migration-20261102T172920Z/`, junto a un informe de conteos. Las colecciones se unieron por sus claves; los registros modificados se resolvieron por fecha y los originales de ambos lados siguen archivados. Para un mismo correo, la cuenta de producción conservó sus datos de acceso. Las rutas absolutas de los registros operativos se adaptaron al perfil externo.

Los volúmenes antiguos de Docker permanecen disponibles. Las imágenes anteriores tienen la etiqueta `before-professional-profile-20261102`; el código anterior está en `.runtime/backups/source-before-professional-20261102T172457Z/`.

Para revertir: detener ambas API/web y TikTok sin trabajos activos; respaldar primero el perfil vigente; restaurar código, directorios/montajes y servicio anteriores; volver a comprobar las cuatro aplicaciones. No ejecutar `docker compose down -v` ni restaurar automáticamente un respaldo antiguo después de nuevas publicaciones o reconexiones.

## Resultado comprobado

- Ambas API devolvieron el perfil `profesional`, las mismas **24 conexiones** (7 YouTube, 3 TikTok, 8 Facebook y 6 Instagram) y los mismos **3 posts de NodeTech**, con sus 5 revisiones/registros conservados.
- Se conservaron 6 trabajos, 35 borradores, 4 producciones, 4 prototipos, 19 entradas de cola y 28 registros de videos publicados. Son datos compartidos, incluidos los fallidos anteriores.
- Los 2.906 archivos de salida presentes en ambos entornos fueron idénticos por SHA-256. Se conservaron también los 4 exclusivos de desarrollo. Se archivaron las versiones originales de 13 registros que diferían y se adaptaron 35 JSON con rutas antiguas.
- Se sirvieron las imágenes existentes de ambos posts con portada en ambas API. El tercer post ya figuraba como fallido y sin portada; se preservó así.
- Una escritura temporal del host fue leída y modificada desde Docker, y su resultado fue leído en el host. El documento de comprobación y su bloqueo se eliminaron al terminar.
- Los archivos de usuarios del host y del contenedor web tienen idéntico contenido, comprobado sin mostrar sus datos. La prueba de concurrencia de Node conservó las 40 escrituras de dos procesos sobre un directorio temporal.
- API y web de desarrollo y producción respondieron correctamente. El navegador mostró los tres posts con sus portadas disponibles y **Datos: Profesional**. Producción conserva su pantalla de acceso habitual; no se alteró el login para probarla.
- TikTok respondió con `profile_id=profesional`, cero trabajos activos y un trabajo anterior pendiente de revisión. Rechazó correctamente la consulta con otro perfil. No se publicó ni renderizó contenido real durante la migración.
- Validación automatizada principal: 393 pruebas backend y 65 web aprobadas; también pasaron 7 pruebas del servicio TikTok, TypeScript, construcción de Docker, configuración de Compose y las comprobaciones de concurrencia. La revisión final añadió y aprobó pruebas de cancelación de tareas y exclusión de archivos de bloqueo de la biblioteca.
- En una comprobación adicional pasaron 48 pruebas y fallaron 2 expectativas antiguas de categorías: NodePolitics ya tiene diseños y NodeMotion incluye `fase_de_pruebas`. Se reprodujeron ambas diferencias con el código anterior a esta intervención; se conservaron las categorías reales. También permanece un aviso previo de lint sobre una variable `agent` sin usar en `producer.py`.

Los scripts de arranque comprobaron que el perfil solicitado coincide con los servicios existentes y rechazaron reutilizar otro conjunto de datos. Se verificó también el bloqueo de propiedad entre host y contenedor, y el envío en vivo de un evento temporal a los WebSocket de ambas API; el evento se retiró del registro al terminar. La sincronización global de la web se inicia después de obtener una sesión autenticada, evitando intentos de conexión desde el login.
