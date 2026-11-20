# Respaldo diario del proyecto y los perfiles

> **Pausado por privacidad · 6 de noviembre de 2026:** el temporizador está
> desactivado y el servicio tiene una condición que impide su inicio hasta que
> se verifique una política que excluya datos de cuentas y canales. La fuente
> configurada ahora es solamente el perfil profesional. Las instantáneas ya
> existentes todavía contienen datos sensibles; no se deben considerar
> depuradas. El resto de este documento describe la configuración histórica,
> no instrucciones para volver a activar el respaldo. Antes de activarlo hay
> que validar las exclusiones y tratar los respaldos históricos sin perder
> datos únicos.

Servicio del host `nexa-full-backup.service`, activado por
`nexa-full-backup.timer`. Es independiente de la app de chat y de Docker.
Horario inicial: **03:00 America/La_Paz**, aunque el servidor use UTC.
`Persistent=true` permite ejecutar una tarea pendiente cuando vuelve a activarse
el temporizador después de estar apagado.

## Qué se conserva

- Repositorio principal completo, incluidos `.git` y cambios sin commit.
- Todos los perfiles actuales y futuros de `.local/share/nexa-brief/profiles/`:
  registros, producciones, renders, recursos, instrucciones y conexiones.
- Configuración de `.config/nexa-brief/`, excepto la clave del propio respaldo.

Se excluyen dependencias, builds y cachés regenerables, `__pycache__`,
`.system/runtime`, `.system/cache` y `logs/runtime`. Se conservan los originales
de `assets/` y `work/`; no se borra ninguna fuente como parte del respaldo.
La configuración de Cloudflare está fuera de estos orígenes: no se lee ni copia
su token. Este respaldo cubre el proyecto y sus perfiles; no es una imagen del SO.

## Destino y funcionamiento

Configuración privada: `~/.config/nexa-brief/full-backup.json`.
Destino: volumen UUID `6E2621FB2621C4C5`, montado en
`~/.local/mnt/nexa-backups`, repositorio cifrado `nexa-brief/full-profile-backups`.
Se usa Restic 0.19.1, obtenido de su publicación oficial y verificado por SHA-256.

Restic reutiliza bloques existentes y lee de nuevo los archivos modificados.
`--skip-if-unchanged` evita otra instantánea si no cambió el contenido o sus
metadatos respecto al padre. No se mantienen copias completas independientes
por día. Las versiones verificadas anteriores se conservan; no hay poda
automática de históricos en esta primera configuración.

Antes de cualquier escritura se comprueban el montaje, el UUID y su identidad.
El proceso hereda un descriptor del volumen; el repositorio y la caché se abren
mediante ese descriptor. Si se desmonta, no se redirigen al SSD. Se rechazan
symlinks en las rutas de destino y se deja un mínimo de 2 GiB libres.
No se intenta montar, reparar ni formatear el disco desde la tarea programada.

Las instantáneas nuevas se marcan `pending`. Solo pasan a `verified` después de
comprobar que las fuentes permanecieron estables y ejecutar `restic check
--read-data`. Un árbol modificado durante la captura deja la ejecución fallida
y no se anuncia como punto de recuperación verificado. No se detienen los
servicios para forzar una copia; conviene un horario sin producciones activas.
La estabilidad se compara antes y después de copiar. Los cambios posteriores,
durante la lectura de verificación, corresponden al siguiente respaldo y no
invalidan la versión inmutable que ya quedó guardada.
Un reintento reutiliza los bloques existentes, pero crea un punto verificable
si todavía no hay ninguno aprobado; una instantánea `pending` no permite
anunciar una omisión sin cambios como respaldo verificado.

La clave está en `~/.config/nexa-brief/full-backup-password`, modo 0600. El
instalador la genera sin mostrarla y no la incluye dentro del respaldo que cifra.
El propietario debe conservar una copia privada de esa clave fuera del servidor
para poder recuperar el archivo cifrado si pierde el SSD. No pegarla en chats,
logs, Git ni comandos visibles.

## Uso

```sh
# Instalar o cambiar el horario; conserva la configuración de destinos existente.
python3 scripts/profile_backups/install.py --at 03:00

# Ver la siguiente ejecución y el último estado; no muestra credenciales.
systemctl --user list-timers nexa-full-backup.timer
cat ~/.local/state/nexa-brief/full-backup/status.json

# Ejecutar después de confirmar que el HDD correcto está montado.
systemctl --user start nexa-full-backup.service

# Pruebas con archivos sintéticos, sin perfiles reales ni reparación de discos.
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s scripts/profile_backups -p 'test_*.py' -v
```

Solo el pequeño estado y el bloqueo de ejecución se guardan en
`~/.local/state/nexa-brief/full-backup/`. La caché y los bytes de respaldo van al
HDD. Un fallo de montaje devuelve 75 y publica `status: blocked`, sin copia local
alternativa. Los mensajes de estado no incluyen el output crudo de Restic ni
contenido de credenciales.
Al comenzar una ejecución se publica `status: running`; así no se confunde un
fallo antiguo con el respaldo que está trabajando.

## Primera migración del respaldo antiguo: completada el 6 de noviembre

El propietario ejecutó la reparación básica `ntfsfix` tras el diagnóstico de
`$MFTMirr`, y montó el UUID configurado con `ntfs-3g`. La lectura SMART compartida
indicó `PASSED`, sin sectores reasignados, pendientes o irrecuperables en esa
comprobación. Se verificaron el montaje real y las escrituras en el HDD.

El respaldo actual procesó **72.289 archivos** y quedó verificado a las
11:57 UTC (07:57 de Bolivia), con instantánea
`c42a8e1536459efa7b59e3254b5cb97af0ddaa12d1836466da3d3404ef0c813a`.

El histórico se preservó por separado bajo el host
`alfred-legacy-profesional-v3-20261105`, dentro del mismo repositorio cifrado.
Su instantánea verificada es
`0a5e407992a053bcf99ea4186e3e42980ff582962aa35fa6d458bbae4b1e5d30`.
Se cotejaron **44.683 nodos**, incluidos **40.822 archivos regulares** y
20.498.792.368 bytes de fuentes, datos y medios; se excluyeron dependencias y
cachés regenerables. No es un origen que se copie diariamente.

Se restauraron al HDD tres muestras públicas del histórico y dos del respaldo
actual, con SHA-256 idéntico al de los originales. Después de verificar cobertura,
estabilidad y ausencia de procesos usando la carpeta antigua, se retiraron
`~/.local/share/nexa-brief/backups/profesional-v3-20261105/` y su padre vacío.
El espacio libre del SSD aumentó **21.044.158.464 bytes, unos 19,6 GiB**.
API, Plantillas y Showcase respondieron 200 después; el medio de producción
comprobado respondió 206. El log de DEV sigue en `profiles/profesional/logs/runtime/`.

Recibo, con IDs de recuperación, cobertura y hashes de las cinco restauraciones:

- HDD: `nexa-brief/receipts/hdd-full-backup-20261106-327961ab-770e-47a4-8dc4-758b03304554.json`.
- Perfil: `logs/maintenance/hdd-full-backup-20261106-327961ab-770e-47a4-8dc4-758b03304554.json`.

Diez pruebas de respaldo aprobadas con datos sintéticos y Restic real, y Ruff sin
errores. Se corrigió el reintento de una copia `pending`, el estado `running` y
la distinción entre cambios durante la captura y cambios posteriores durante
la verificación. Los puntos fallidos previos no se anuncian como `verified`.
No hubo reinicios de la aplicación ni arranque de contenedores.
Mantener la política de
[`almacenamiento-respaldos-limpieza-2026-11.md`](../../nexa-brief-server/docs/almacenamiento-respaldos-limpieza-2026-11.md).

Fuentes técnicas: [respaldo y omisión sin cambios](https://restic.readthedocs.io/en/stable/040_backup.html),
[verificación de repositorios](https://restic.readthedocs.io/en/stable/045_working_with_repos.html),
[temporizadores systemd](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html),
[comprobación NTFS en Windows](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/chkdsk).
