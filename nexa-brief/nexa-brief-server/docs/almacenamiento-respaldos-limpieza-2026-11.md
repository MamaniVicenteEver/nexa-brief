# Almacenamiento, respaldos y limpieza — 5 de noviembre de 2026

**Estado más reciente, 6 de noviembre:** el respaldo actual y el histórico de
migración están verificados en el HDD cifrado. Se retiró el respaldo antiguo del
SSD y se recuperaron **19,6 GiB adicionales**. Las secciones de bloqueo y montaje
inicial describen estados anteriores; la operación completada y sus recibos
figuran al final. No queda la carpeta `~/.local/share/nexa-brief/backups/`.

**Actualización del 6 de noviembre:** se eliminó la copia experimental completa
`/home/alfred/codex/nexa-brief/wt-amarillista/` y sus cuatro lanzadores externos
obsoletos. Primero se retiró su `output/` verificado (6,24 GiB) y después el resto
de la copia (2,68 GiB adicionales): unos **8,92 GiB recuperados en total**.
El perfil vigente y el código principal se conservaron. Las dos operaciones y
sus recibos se detallan al final. Los inventarios anteriores son fotografías
previas a la eliminación; no usarlos como listas de borrado actuales.

## Política obligatoria

Los respaldos completos, históricos y de migración se guardan en el HDD de
respaldos. Nunca se almacenan en el SSD del sistema ni se crea una copia local
de emergencia cuando falta el HDD. Esta regla incluye copias manuales de agentes.
No confundir un respaldo con los originales operativos del perfil, sus índices,
los diarios de transacciones o pequeños recibos de mantenimiento.

El destino configurado es `/home/alfred/.local/mnt/nexa-backups`, en el volumen
`VideosImagenesOtros`, UUID `6E2621FB2621C4C5`. Antes de escribir se comprueba con
`findmnt --mountpoint` el montaje y UUID reales. No basta con que exista la carpeta.
El worker de videos ya aplica esta guarda, ancla las escrituras al descriptor
del montaje y rechaza un desmontaje o sustitución de volumen durante la copia.

Los respaldos se publican como completos únicamente después de comprobar su
integridad. Una copia nueva debe incluir el estado actual del perfil y el código
con cambios sin commit. Las credenciales se tratan como archivos opacos y privados;
no se muestran ni se imprimen. Un respaldo completo de recuperación es distinto
del paquete por video: este último excluye credenciales por diseño.

Excluir dependencias y cachés regenerables: `.venv`, `node_modules`, `.next`,
cachés de paquetes y cachés de pruebas. No excluir todos los `assets/`, `work/`
o `output/` por nombre: los árboles heredados pueden conservar fuentes o medios
referenciados en esas ubicaciones. Antes de descartarlos hay que resolver sus
referencias o preservar su contenido en el respaldo.

Solo después de verificar el sustituto se elimina el respaldo antiguo de datos.
Conservar en el SSD únicamente el recibo de verificación y el estado operativo
necesario. Los logs activos de DEV se trasladan fuera de la carpeta de respaldo
antes de retirarla; no se debe dejar un proceso escribiendo en un archivo borrado.

## Inventario actual y limpieza ejecutada

Las cifras del árbol anterior estaban desactualizadas. El perfil Profesional
migrado no tiene `output/` en su raíz. Antes de la limpieza de cachés se midieron:

| Ubicación | Tamaño asignado aproximado | Tratamiento |
| --- | ---: | --- |
| Perfil Profesional, completo | 17,4 GiB | Datos y archivos operativos; conservar |
| Respaldo inicial de migración en SSD | 22,3 GiB | Sustituir en HDD y después retirar |
| Caché Next.js guardada en ese respaldo | 2,74 GiB | Eliminada; es regenerable |
| Caché npm de descargas | 2,62 GiB | Limpiada; no se borraron `node_modules` |
| Caché Docker de construcción sin uso | 43,29 GB recuperados según Docker | Limpiada con `builder prune --all --keep-storage 5GB`; se conservaron imágenes y contenedores |
| Checkout experimental Amarillista | 8,9 GiB | Auditar duplicados y preservar código propio antes de retirar |
| Caché uv | 2,37 GiB | Regenerable; no se limpió en esta operación |
| Modelos Hugging Face | 2,95 GiB | Conservar para evitar perder modelos disponibles sin conexión |
| Navegadores Playwright | 1,29 GiB | Conservar los que usan render y validación |

Los valores de imágenes y caché Docker se solapan: no sumarlos como ahorro
independiente. El ahorro real se contrasta con `df`. La auditoría por dispositivo
e inodo no encontró enlaces duros compartidos entre perfil, respaldo inicial y
plantillas del repositorio en esta revisión.

Después de la limpieza, `df -h /` pasó de aproximadamente **172 GiB usados a
130 GiB usados**, con **285 GiB disponibles**. npm quedó en unos 64 KiB y el
respaldo inicial restante ocupa **19,6 GiB**. Docker conservó 13 imágenes y los
cuatro contenedores; solo el túnel estaba ejecutándose. Su informe posterior
muestra 30,01 GB de imágenes y 19,74 GB de caché, con contabilidad compartida.
El límite solicitado de 5 GB no equivale a una garantía de tamaño para todo el
almacenamiento de Docker.

## Inventario de duplicados del 5 de noviembre, anterior a la retirada

Se compararon únicamente medios, por tamaño y SHA-256, contra los archivos de
`productions/`, `renders/`, `resources/` y `sandbox/` del perfil vigente:

| Árbol candidato | Medios idénticos encontrados en el perfil | Bytes lógicos coincidentes |
| --- | ---: | ---: |
| `wt-amarillista/nexa-brief-server/output/` | 847 de 847, incluidos 252 MP4 | 6.683.155.989, unos 6,22 GiB |
| Repositorio principal, `src/templates/` | 6.568 de 31.487, incluidos 293 MP4 | 10.268.406.752, unos 9,56 GiB |

Estos son candidatos, no una orden para eliminar sus carpetas completas. El
checkout Amarillista conserva código propio y archivos que no forman parte del
conteo de medios. Las plantillas también conservan motores y 1.981.756.616 bytes
de medios sin coincidencia. Incluso un medio idéntico puede seguir referenciado
por una URL heredada: comprobar consumidores y preservar el original canónico
antes de retirar su copia. El informe detallado de esta ejecución quedó en
`/tmp/nexa-media-duplicates-20261105.json` del servidor, como evidencia temporal
privada; no incluye contenido de credenciales.

No se borraron código, perfiles, registros de negocio, sesiones, renders,
originales, modelos, `.git`, entornos Python, imágenes Docker ni volúmenes.
No se arrancaron contenedores. DEV se comprobó mediante sus endpoints de salud.

## Sustitución del respaldo inicial: estado previo al montaje

Al revisar, el HDD estaba conectado y desmontado. Por eso no se ha creado un
respaldo nuevo en una carpeta vacía del SSD ni se ha eliminado la copia de datos
del respaldo inicial. El subdirectorio de caché Next.js sí se retiró por ser
regenerable. Falta crear y verificar el respaldo actualizado en el destino externo
confirmado y después retirar el resto del respaldo antiguo.

Se intentó montar `/dev/sdb3` mediante UDisks sin interacción. El sistema devolvió
`NotAuthorizedCanObtain`: requiere autorización de administrador. No fue un fallo
de la aplicación ni se introdujeron contraseñas. El usuario puede montar el destino
configurado desde su propia terminal de alfred-server:

```bash
sudo mount -t ntfs-3g -o uid=1000,gid=1000,umask=077 \
  /dev/disk/by-uuid/6E2621FB2621C4C5 /home/alfred/.local/mnt/nexa-backups
findmnt --mountpoint /home/alfred/.local/mnt/nexa-backups -o TARGET,UUID,FSTYPE
```

Para completar esa operación: verificar el volumen y espacio libre; comprobar
que no haya producciones activas; coordinar una copia consistente de los índices
y sesiones; copiar el perfil vigente y el repositorio con cambios a una carpeta
nueva del HDD, sin cachés ni dependencias; verificar archivos y restauración de
muestras; conservar un recibo pequeño en el perfil; trasladar el log activo de
DEV y retirar únicamente la ruta de respaldo antiguo que conste en el recibo.

## Revisión de Amarillista y consumidores de medios — 6 de noviembre

Esta revisión no elimina archivos ni aplica el parche experimental. El objetivo
es distinguir el contenido duplicado de las dependencias que siguen activas.
Se revisaron las notas, hashes y diferencias de código en `alfred-server`, el
catálogo de plantillas y el resolvedor de rutas vigente. No se consultaron
credenciales ni se ejecutaron modelos, renders o contenedores.

### Qué conserva Amarillista

`/home/alfred/codex/nexa-brief/wt-amarillista/` es una copia experimental antigua,
de unos 8,9 GiB en total. Los **6,22 GiB** corresponden exclusivamente a sus
medios dentro de `nexa-brief-server/output/`, con este desglose lógico:

| Tipo | Archivos | Bytes |
| --- | ---: | ---: |
| Videos MP4 históricos y pruebas de plantillas | 252 | 6.186.373.885 |
| Capturas PNG | 231 | 269.852.554 |
| Audios MP3 | 65 | 190.963.825 |
| Imágenes JPG | 292 | 32.181.766 |
| Audios M4A | 5 | 3.653.117 |
| Imágenes WebP | 2 | 130.842 |

Los 847 medios tienen equivalente por SHA-256 en el perfil vigente. Se volvió
a comprobar que todas las rutas de origen y destino del inventario existen
y conservan su tamaño. Esto permite plantear retirar esas copias de medios
sin retirar el código de la carpeta. Antes de una eliminación se debe repetir
el hash de cada par y comprobar que no haya trabajos usando la copia antigua.

El motor Amarillista ya existe en el proyecto principal: estrategia, entrada
offline, narrativa hilo, reparación, selección de fotos, contratos y pruebas.
De las **58 rutas del parche**, hoy hay **28 idénticas, 24 distintas y 6 ausentes
en la misma ruta**. El conteo anterior del 2 de noviembre ya no describe la
comparación actual. Las diferencias revisadas en `hilo_pipeline.py`,
`amarillista_hilo.py`, `render_post.py` y selección de fotos corresponden a
trazabilidad posterior; el código vigente también amplía formatos y exportación.
No se debe sobrescribirlo con la copia antigua.

Las seis rutas ausentes suman 17.834 bytes: dos archivos de pruebas de integración
y cuatro archivos provisionales de estilos Atlas, Dinero y Motion. También hay
una prueba de runner antigua ausente dentro de un archivo modificado. Se debe
conservar/revisar ese material y las notas antes de retirar la carpeta completa.
No se afirma equivalencia funcional de todo el checkout: la comparación de 58
rutas se limita al parche; la investigación anterior detectó otras divergencias.
La suite vigente de las cuatro pruebas unitarias Amarillista pasó **156 tests**
en la copia de trabajo local, con modelos simulados y persistencia temporal.

No se encontraron referencias literales a `wt-amarillista` en los scripts
operativos y unidades de usuario revisados, ni en los archivos permitidos de
contenido e índices del perfil. Los procesos DEV comprobados usan el repositorio
principal. Esto respalda que la copia antigua no es el motor activo; no cubre
enlaces externos ni cualquier script manual fuera del ámbito revisado.

### Qué significan los 9,56 GiB duplicados del repositorio

El inventario contiene 6.568 medios idénticos al perfil, mezclando episodios
antiguos, recursos de plantillas musicales y ejemplos compartidos. La clasificación
se obtuvo ejecutando el resolvedor actual con rutas explícitas del perfil v3,
sin cargar credenciales ni iniciar otra instancia de la aplicación:

| Grupo | Archivos | Bytes lógicos | Decisión |
| --- | ---: | ---: | --- |
| Contenido heredado fuera de las rutas compartidas | 4.214 | 7.698.419.817 | Candidato a retirada; revisar scripts y referencias directas antes de borrar |
| Assets de Atlas en Movimiento cuyo alias ya resuelve al perfil | 53 | 53.593.475 | Candidato a retirada de la copia del repositorio |
| Medios dentro de las 33 plantillas registradas | 547 | 2.309.764.438 | Conservar hasta separar fuentes de ejecución, previews y resultados antiguos |
| Medios alcanzables por rutas compartidas del repositorio | 1.754 | 206.629.022 | Conservar hasta revisar sus consumidores |

Los dos primeros grupos suman **7,22 GiB candidatos**. Los otros **2,34 GiB**
quedan retenidos para revisión: no se afirma que cada archivo sea indispensable,
pero contienen dependencias activas demostradas. Que exista una copia en un
perfil no sustituye automáticamente un recurso público de una plantilla;
otros perfiles nuevos también necesitan sus ejemplos compartidos.

Comprobaciones HTTP con lectura parcial de un byte en la API DEV:

- `templates/lyrics-caution/showcase/song.mp3`: 206, todavía servido desde
  la plantilla del repositorio. Eliminar ese MP3 deja sin música esa muestra.
- `explainer/files/_tools/explainer-kit/designs/dinero/samples/billete100.jpg`:
  206, muestra compartida que sigue usando el repositorio.
- `explainer/files/bundled/sandbox/nodehistory/atlas-en-movimiento/assets/media/A04.png`:
  206, el alias resuelve exclusivamente al sandbox del perfil.
- `explainer/files/productions/nodetech/programadores-nueva-era/assets/song.mp3`:
  206; su variante `bundled/nodetech/...` devuelve 404 por diseño en v3.

El generador también copia los `runtime_assets` declarados en `templates.json`
desde el repositorio a cada trabajo. Borrar sus clips o fondos puede dejar
trabajos nuevos sin medios aunque los videos ya terminados sigan reproduciéndose.
Para retirar esas copias hace falta cambiar primero el origen compartido y
validar muestras y generación; no apuntarlas al perfil Profesional como
dependencia global. Conservar los 1,85 GiB sin duplicado identificado y los
originales protegidos de `hyperframes/media_originals/`.

Evidencia temporal en el servidor: `/tmp/nexa-code-routes-audit-20261106.json` y
`/tmp/nexa-media-consumers-20261106.json`, junto al inventario de hashes del día 5.
Son metadatos de auditoría, no respaldos completos. La revisión de todos los
pares encontró cero rutas ausentes o tamaños cambiados; se repitieron los hashes
de ejemplos de los cuatro grupos. No se volvió a calcular el SHA-256 de los
7.415 pares completos en esta revisión y no se autoriza borrar solo por tamaño.

## Retirada del output de Amarillista — 6 de noviembre

El usuario autorizó revisar los archivos importantes, asegurar su conservación
en las producciones y eliminar después toda la carpeta
`/home/alfred/codex/nexa-brief/wt-amarillista/nexa-brief-server/output/`.

Se cotejaron por SHA-256 los 454 archivos auxiliares: todos tenían una copia
idéntica dentro de `profiles/profesional/productions/`, incluidos configuraciones,
letras, composiciones HTML, componentes JS, créditos, el script de render y los
registros antiguos. De ellos, 187 se clasificaron como fuentes importantes,
excluyendo logs y resultados compilados. No quedaron archivos sin equivalente
y no fue necesario mover, sobrescribir ni copiar producciones.

Inmediatamente antes de la retirada se verificaron de nuevo los 847 medios y
los 454 auxiliares completos: **1.301 de 1.301 archivos**, 6.693.533.447 bytes
lógicos. También se comprobaron rutas regulares sin symlinks, inventario exacto,
identidad y estabilidad de archivos, y ausencia de procesos con archivos abiertos
o directorio de trabajo dentro del output antiguo.

La carpeta se retiró primero mediante un renombrado en el mismo directorio. Con
la ruta original ya ausente se comprobaron DEV y los medios actuales; solo después
se eliminó el árbol retirado. Se volvió a comprobar la conservación de las copias
canónicas y la salud de la aplicación. La ruta original y el directorio temporal
de retirada ya no existen. El espacio libre aumentó 6.696.660.992 bytes, unos
**6,24 GiB**, medidos con `disk_usage` durante la operación.

Comprobaciones antes, durante y después: API `/health` y web `/plantillas`
respondieron 200; las lecturas parciales de música de la plantilla Lyrics Caution
y de la producción Programadores Nueva Era respondieron 206. No hubo reinicios,
llamadas a modelos, renders, publicaciones, commits ni arranque de contenedores.
En esta primera fase se conservó el resto de `wt-amarillista/`; su retirada
posterior completa está documentada en la sección siguiente.
Los medios candidatos del repositorio y el respaldo antiguo no se eliminaron
como parte de esta operación.

Recibo operativo con los 1.301 pares de rutas, hashes y comprobaciones:
`/home/alfred/.local/share/nexa-brief/profiles/profesional/logs/maintenance/amarillista-output-20261106-dd0247d1b0964c4ab2a18977b0ef76df.json`.
Operación `dd0247d1b0964c4ab2a18977b0ef76df`, estado `complete`. El recibo contiene
metadatos de verificación, sin contenido de archivos ni credenciales. No es un
respaldo de medios; los originales operativos siguen en el perfil vigente.

## Retirada completa del checkout experimental — 6 de noviembre

El usuario pidió eliminar la réplica completa y no conservar residuos de código
muerto. Se revisó la carpeta restante: no era un worktree registrado por Git,
no tenía procesos usándola y no se encontraron referencias desde los scripts
operativos, servicios de usuario o contenidos del perfil revisados. Sus 725
medios de plantillas, fuentes y biblioteca coincidieron por SHA-256 con archivos
del perfil vigente o del repositorio principal; no quedó ninguno sin equivalente
dentro de ese ámbito. No se afirma que toda la copia fuera idéntica: se descartaron
deliberadamente los parches, versiones divergentes, pruebas y resultados del
experimento obsoleto, sin instalarlos en el código actual.

Se retiró el árbol completo, con **4.375 archivos regulares y 3 enlaces simbólicos**.
El borrado no siguió esos enlaces. La carpeta original y la carpeta temporal de
retirada ya no existen. El espacio libre aumentó **2.878.070.784 bytes**, unos
**2,68 GiB adicionales**; sumado al output retirado antes, son 9.574.731.776 bytes,
aproximadamente **8,92 GiB**. No se creó una copia histórica en el SSD.

También se comprobaron y eliminaron cuatro lanzadores sin procesos activos,
ubicados en `/home/alfred/codex/nexa-brief/`, que dependían del experimento:
`render-ab.sh`, `render-cierre.sh`, `render-final.sh` y `texto-hilo.sh`. Se conservaron
los demás scripts. Los nombres y hashes de estos cuatro están en el recibo.

Antes de purgar se probaron API, Plantillas, Showcase y una lectura parcial de
música con la carpeta original ya retirada. Las mismas comprobaciones posteriores
respondieron 200/206. Los hashes del motor y estrategias de imágenes del proyecto
principal permanecieron iguales. La regresión local específica de Amarillista,
con persistencia temporal y modelos simulados, aprobó nuevamente **156 tests**.
No hubo reinicios de servicios, generación, publicación ni arranque de Docker.

Recibo operativo de la retirada completa:
`/home/alfred/.local/share/nexa-brief/profiles/profesional/logs/maintenance/amarillista-worktree-20261106-5eecedc331a44f308b283f271694cf29.json`.
Operación `5eecedc331a44f308b283f271694cf29`, estado `complete`; retirada de los
cuatro lanzadores también `complete`. El recibo conserva metadatos, hashes y
comprobaciones; no contiene una copia del código descartado ni credenciales.

## Preparación del respaldo diario y bloqueo inicial — 6 de noviembre

El volumen `VideosImagenesOtros`, UUID `6E2621FB2621C4C5`, está conectado pero
no monta. El intento del propietario con `ntfs-3g` informó diferencia entre
`$MFTMirr` y `$MFT`, registro 3, y error de entrada/salida. No se forzó un montaje
ni se escribió una reparación. La cuenta SSH no tiene lectura directa del
dispositivo ni sudo no interactivo: los intentos de diagnóstico `ntfsfix -n` y
SMART no pudieron ejecutarse por falta de autenticación administrativa. Por eso
no se ha descartado un problema físico ni se afirma que baste una reparación
lógica. La comprobación de NTFS debe completarla el propietario/administrador;
la [documentación de chkdsk](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/chkdsk)
describe la comprobación y reparación en Windows con `/f`.

El respaldo antiguo restante ocupa **19,584 GiB**, 45.674 archivos en la medición
previa al traslado de su log. Continúa en el SSD porque todavía no existe un
sustituto verificado en el HDD. El árbol citado por el usuario era anterior a la
limpieza: `wt-amarillista/` ya no existe y su directorio padre
`/home/alfred/codex/nexa-brief/` ocupa aproximadamente 0,504 GiB de otros archivos.

Se instaló `nexa-full-backup.timer`, habilitado y activo a las **03:00
America/La_Paz**. El servidor usa UTC; la próxima ejecución comprobada es el
7 de noviembre a las 07:00 UTC, equivalente a las 03:00 de Bolivia. La unidad
`nexa-full-backup.service` usa los scripts de `scripts/profile_backups/` sin
depender de un chat, contenedor o sesión SSH. No se arrancó Docker ni se
reiniciaron API, web o workers.

Se instaló Restic 0.19.1 desde su publicación oficial con verificación SHA-256
del archivo distribuido:
`f415415624dcc452f2a02b8c33641791a8c6d6d3b65bbb3543fcf9a25151585c`.
El respaldo cifrado contempla el repositorio, todos los perfiles y la
configuración de Nexa Brief. Excluye dependencias, cachés y runtime regenerable;
conserva fuentes y cambios sin commit. La clave se generó de manera privada,
modo 0600, sin imprimirse. No se copia el token externo de Cloudflare.

Los datos y la caché de Restic están anclados a un descriptor del HDD. Se
verifican montaje, UUID, identidad y ausencia de symlinks antes de escribir.
Restic reutiliza bloques y evita otra instantánea sin cambios. Los nuevos puntos
de recuperación se verifican con lectura de datos y estabilidad de los orígenes
antes de marcarse `verified`; no hay poda automática de históricos. El único
estado local nuevo está en `~/.local/state/nexa-brief/full-backup/status.json`.

**Pruebas:** siete aprobadas en el servidor con datos sintéticos. Cubren disco
ausente, UUID incorrecto, redirección por symlink, permisos de clave, exclusión de
runtime, fuente modificada, respaldo incremental, omisión sin cambios y
restauración real. Una ejecución controlada con la configuración real devolvió
75 y `status: blocked`, `HDD mount unavailable`; la carpeta de montaje permaneció
vacía. **No existe todavía una primera copia real en el HDD.**

El log de DEV que mantenía archivos abiertos en el respaldo antiguo se movió
por renombrado a
`profiles/profesional/logs/runtime/dev-20261106.log`, conservando dispositivo e
inodo. Sus procesos siguieron escribiendo sin reiniciar. El respaldo diario
no importa ni elimina automáticamente el archivo histórico antiguo: falta
recuperar el HDD, completar y verificar el respaldo actual y revisar/importar
el histórico antes de retirar esos 19,6 GiB del SSD.

Operación, alcance, clave de recuperación y comandos:
[`scripts/profile_backups/README.md`](../../scripts/profile_backups/README.md).

## Migración al HDD completada — 6 de noviembre

El propietario compartió SMART `PASSED`, temperatura de 33 °C y cero sectores
reasignados, pendientes o irrecuperables en esa lectura. Primero ejecutó
`ntfsfix -n`, una simulación; después aplicó `ntfsfix` sin `-n`. La reparación
básica procesó la partición correctamente y permitió montarla con `ntfs-3g`.
Se comprobó `/dev/sdb3` en el punto configurado con el UUID correcto. El intento
posterior de montarlo otra vez devolvió apertura exclusiva porque ya estaba
montado y el respaldo se encontraba trabajando; no se forzó otro montaje.
Existe una entrada persistente del UUID en `/etc/fstab`; no se reinició el host
para probarla. No se afirma una comprobación completa del sistema NTFS en Windows.

El primer intento detectó una actualización de conexiones durante la captura.
Se mantuvo `pending`, conservando los bloques para reutilizarlos. Se corrigieron
dos problemas del wrapper: el estado antiguo ahora se reemplaza por `running`
al comenzar, y un reintento sin padre verificado crea un punto que pueda aprobarse.
También se delimitó la estabilidad al período de adquisición, antes y después
de copiar. Un cambio posterior en el origen mientras se lee el HDD no modifica
la instantánea inmutable ya adquirida; se conserva para el siguiente respaldo.
La lectura completa de integridad sigue siendo obligatoria para publicar `verified`.

El respaldo actual terminó correctamente, con **72.289 archivos procesados**:

`c42a8e1536459efa7b59e3254b5cb97af0ddaa12d1836466da3d3404ef0c813a`

El histórico se respaldó de forma independiente dentro del mismo repositorio,
bajo `alfred-legacy-profesional-v3-20261105`, reutilizando bloques coincidentes:

`0a5e407992a053bcf99ea4186e3e42980ff582962aa35fa6d458bbae4b1e5d30`

Se cotejó el inventario completo de sus **44.683 nodos**, incluidos 40.822 archivos
regulares y 20.498.792.368 bytes retenidos. Las exclusiones afectaron a dependencias
y cachés regenerables. La integridad se comprobó con lectura de los datos.
Se restauraron al HDD tres muestras públicas del histórico y dos del respaldo
actual (código y audio); sus SHA-256 coincidieron con los de los originales.
Los datos de conexiones y credenciales se copiaron de forma opaca y cifrada;
no se mostraron sus contenidos ni se leyó la clave de recuperación desde el agente.

Antes de retirar el origen se confirmaron ambos IDs con etiqueta `verified`,
identidad de dispositivo/inodo, estabilidad del inventario y ausencia de
descriptores/directorios de trabajo de procesos dentro del árbol antiguo.
La búsqueda de la ruta absoluta antigua en el código operativo revisado no
encontró dependencias. Se renombró el origen en el mismo dispositivo y se
comprobó otra vez su inventario antes de la eliminación sin seguir symlinks.

Se retiraron el respaldo antiguo y su padre vacío. El incremento de espacio libre
medido fue **21.044.158.464 bytes, unos 19,6 GiB**. `df -h` pasó a mostrar unos
**101 GiB usados y 313 GiB disponibles** en el SSD. El HDD mostraba 39 GiB usados
y 425 GiB disponibles; esas cifras incluyen los archivos anteriores del volumen.
No se retiraron medios del repositorio ni originales operativos del perfil.

API `/health`, web `/plantillas` y `/showcase` respondieron 200 antes y después;
una lectura de un byte del audio de la producción vigente respondió 206.
Diez pruebas específicas de respaldo y recuperación pasaron con datos sintéticos
y Restic real; Ruff no encontró errores. Se conservaron las aplicaciones en
ejecución y no se arrancaron contenedores. El temporizador diario continúa
habilitado a las **03:00 de Bolivia**, sin respaldo alternativo en el SSD si falta
el HDD. La clave de recuperación debe conservarse privadamente fuera del servidor.

Recibos de la operación `327961ab-770e-47a4-8dc4-758b03304554`, estado `complete`:

- HDD: `nexa-brief/receipts/hdd-full-backup-20261106-327961ab-770e-47a4-8dc4-758b03304554.json`.
- Perfil Profesional: `logs/maintenance/hdd-full-backup-20261106-327961ab-770e-47a4-8dc4-758b03304554.json`.

Conservan IDs, cobertura, hashes públicos de restauración y la medición de espacio;
no contienen una copia de datos privados ni de la clave de cifrado.
