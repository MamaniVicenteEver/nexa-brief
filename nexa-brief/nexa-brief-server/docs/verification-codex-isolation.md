# Verificación de Codex aislado — 5 de noviembre de 2026

En alfred-server se verificó Codex 0.164.0 con un proveedor Responses HTTP falso,
HOME y credenciales sintéticos. No se hicieron llamadas de inferencia. La política
aprobada está fijada por SHA-256 del wrapper, ejecutable nativo, código de política
y versión del kernel en `isolated_executor.py`. Cualquier cambio falla cerrado.

Las herramientas anunciadas fueron `exec_command`, `write_stdin`,
`request_user_input` y `view_image`. Se comprobaron lectura/escritura privada,
sesión sintética, symlinks, entorno, localhost, imágenes, apply_patch y procesos
interactivos: las operaciones externas al workspace se rechazaron y las escrituras
propias funcionaron. La consulta de solo lectura y el permiso de log propio se
ensayaron por separado. La política usa raíz denegada y entorno de herramientas
construido desde cero, sin red. No utiliza la opción legacy `-s` que sustituiría
los permisos. El harness conserva su ubicación normal de login fuera del alcance
de las herramientas, sin copiar sus credenciales al workspace.

Se desactivan hooks, aplicaciones, navegador, ordenador, multiagente, plugins,
goals y shell snapshots. Las skills requieren además desactivación por ruta de
manifiesto: se enumeran nombres sin leer contenidos, se rechazan symlinks y se
protegen `.agents` y `.codex` dentro del workspace. Se comprobaron seis solicitudes
con marcadores sintéticos: no se enviaron skills al proveedor; las herramientas no
pudieron modificar, renombrar, eliminar ni enlazar esos directorios protegidos.

El runner solo concede una producción o prototipo del perfil activo. Las consultas
usan un directorio temporal vacío y reciben sus entradas por el prompt; los
esquemas de respuesta se validan y copian a un temporal propio. No se concede el
repositorio, `data`, sesiones ni el HOME real. Los logs los escribe el supervisor.

Este ensayo no certifica una generación con suscripción real ni publicación en
redes. No protege contra un administrador u otro proceso confiable del mismo
usuario que cambie archivos globales después de la comprobación. El usuario del
host y el harness forman parte de la frontera de confianza; la política limita
las herramientas ofrecidas al modelo. El adapter de imágenes CLI y las rutas de
delegación legacy conservan su guarda y no se activan por esta verificación.
