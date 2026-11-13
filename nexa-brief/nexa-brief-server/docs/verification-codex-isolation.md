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


## Revalidación del 13 de noviembre de 2026

Se añadió el build exacto del kernel `7.0.0-43-generic`, con los mismos hashes de
wrapper y binario nativo y política SHA-256
`4e928044aa32bbca7745a1a66e175fde558635005df9e9724640d2b7b8cf9706`.
La revisión del código y la reproducción independiente precedieron a su registro.
Los otros binarios, kernels y políticas continúan fallando cerrados.

La revalidación detectó y corrigió tres problemas: submontajes `.agents/.codex`
incompatibles con la consulta, dos skills incorporadas por el CLI que faltaban
por deshabilitar, y descendientes de herramientas PTY que sobrevivían al timeout.
El seguimiento usa identidades y pidfds tipados de libc, revisa los hijos de todos
los threads y libera sus descriptores. Estos helpers forman parte del hash.

La consulta `read_only` es exclusivamente **por prompt**: el host entrega todo el
contexto y copia el schema validado al runtime privado. No se acredita acceso a
archivos o imágenes del proyecto en ese alcance. Los callers actuales de promos
y texto son compatibles con esa condición. No se debe ampliar ese contrato sin
volver a comprobarlo.

Las matrices nativas con proveedor HTTP, perfil, HOME y credenciales sintéticos
cubrieron las cuatro herramientas anunciadas, rutas absolutas privadas,
symlinks/hardlinks, entorno, reglas/skills desactivadas, imágenes, escritura
privada y denegación de localhost. El runner real produjo JSON con schema y se
ensayó cierre normal, timeout y cancelación: no quedaron descendientes y el
proceso ajeno siguió vivo. En cuatro olas de diez hijos se observó la poda de
pidfds y ocho descriptores antes y después. El segundo revisor reprodujo runner
y tracker. Los tokens artificiales del proveedor falso se excluyen de cualquier
estudio de consumo.

Los artefactos de esta tarea se entregaron como `codex-isolation/` del estudio
PULSO: diff, scripts de reproducción, tres reportes JSON y revisión independiente.
Esta batería es específica del build y no equivale a una prueba de cuota,
acceso a un modelo ni inferencia real. La red se ensayó con localhost, no con
tráfico externo. El seguimiento periódico evita las fugas PTY demostradas, pero
no certifica daemons hostiles que se desprendan entre observaciones ni sustituye
contención de recursos. La muestra de recursos fue breve.
