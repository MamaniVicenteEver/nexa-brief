# Migración local de perfiles

El destino por defecto del flujo `--local-*` es ahora v3. Los detalles de rutas,
secciones JSON y estado de la activación real están en
[profile-layout-v3-2026-11.md](profile-layout-v3-2026-11.md). Los ejemplos y la
descripción restantes documentan el ensayo anterior v1→v2; para reproducirlo
añade `--target-version 2` al preparar. `--apply` es otro flujo heredado de
copias y no debe usarse como sustituto de la activación con diario.

El flujo local requiere detener todos los procesos y hosts que usan el perfil, incluidas aplicaciones, supervisores y tareas programadas. Trabaja con un perfil del mismo sistema de archivos y conserva una copia de seguridad independiente antes de empezar. Los ejemplos siguientes usan rutas ficticias; no se ha migrado ningún perfil real durante el ensayo de desarrollo.

Desde `nexa-brief-server`, sustituye las dos rutas por el perfil y por el directorio de plantillas cuyas producciones pertenecen a ese perfil:

```sh
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/plantillas --local-plan
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/plantillas --local-prepare --confirm-maintenance --confirm-templates-owned
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --local-activate --migration-id ID_DEVUELTO --confirm-maintenance
```

Si los JSON incluyen rutas de un checkout anterior cuya pertenencia al perfil se confirmó,
añade `--legacy-server-root /ruta/absoluta/nexa-brief-server` una vez por cada
raíz histórica al preparar. Se aceptan únicamente sus subárboles `output`,
`data` y `src/templates`; no se leen archivos del checkout histórico. Las rutas
externas no reconocidas siguen deteniendo la operación. Como excepción acotada,
las referencias externas de JSON de diagnóstico bajo `review`, `work/results` o
`work/.../camera-check*` se conservan como procedencia no resuelta y se registran
por hash en el diario; el migrador no las abre ni las trata como medios vivos.

Para comprobar identidades y referencias, captura antes de la activación un
baseline privado en `/tmp` con `scripts/verify-profile-migration.py --capture` y
los mismos flags `--legacy-server-root`; después ejecuta `--verify` con ese
archivo. El verificador informa por separado lo ya ausente y no inspecciona el
contenido de conexiones o sesiones. Consulta `--help` para los argumentos.

El plan solo cuenta archivos. La preparación copia y verifica contenido ordinario en `.system/migrations/<id>/staged`, reescribe las referencias JSON reconocidas y conserva intactos el manifiesto v1 y los orígenes. Las carpetas `muestras` no se importan. La confirmación de pertenencia abarca todas las categorías y sandbox seleccionadas: las plantillas de varios perfiles deben separarse antes. Fuera de la excepción de diagnóstico indicada, una ruta absoluta externa no reconocida o una colisión detiene la preparación. Archivos especiales y enlaces simbólicos no se admiten.

También prepara los catálogos y estilos de producto versionados que falten en `config/`, sin sustituir personalizaciones existentes. Los loaders y referencias de recursos heredados reconocidos se ajustan al namespace del perfil; las URL dinámicas construidas por código personalizado requieren revisión posterior. Los logs heredados de agentes van a `logs/agents/` y los logs explainer sin producción asociada a `logs/explainer/`.

`data/browser_profiles/` se trata como una sola carpeta opaca: no se enumeran, abren ni copian sus archivos. Su raíz se mueve por renombrado a `.system/browser-profiles/` durante la activación y regresa completa en un rollback. Se valida únicamente la raíz, no sus contenidos ni enlaces internos; mantén detenidos todos los navegadores y servicios antes de preparar y hasta completar la verificación.

La activación verifica el manifiesto, el staging y los datos originales; después mueve los archivos con un diario de recuperación y cambia `profile.json` al final. Los archivos no JSON salen de `data/`. Las conexiones, datos web y sesiones TikTok se renombran como carpetas opacas. La única excepción es `connections/channels.json`, metadata que se lee y fusiona por plataforma y alias en `data/canales/channels.json`, con prioridad a conexiones; si contiene campos privados, el migrador se detiene. Las credenciales no se abren ni copian. `output` pasa a `renders`. Los masters heredados `categoría/video/render/*.mp4` y formatos equivalentes se copian verificando su contenido a `renders/<video>/legacy-template` y se registran como grabaciones; las vistas previas van a `work/results/test/legacy-render` y las miniaturas a `assets/thumbnails`. Los videos con manifest o index propios pero sin producción registrada reciben una identidad estable y conservan su procedencia; no se programan ni publican. Un mismo ID en dos categorías detiene el plan por ambiguo. Se conservan los originales en las plantillas, por lo que pueden requerir espacio adicional. No se transfieren ni activan servicios externos.

Ante un fallo durante la activación, el migrador intenta revertir las operaciones registradas. Para recuperar una interrupción del proceso, o para volver al estado anterior antes de permitir escrituras v2, mantén todo detenido y ejecuta:

```sh
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --local-rollback --migration-id ID_DEVUELTO --confirm-maintenance --confirm-no-v2-writes
```

La confirmación significa que ningún proceso escribió en ninguna carpeta v2; el programa comprueba además cambios en `data`, pero no inspecciona el contenido de conexiones ni puede demostrar ausencia de escrituras en todas las demás carpetas. Si ya hubo escrituras, no uses rollback automático: conserva el perfil y restaura o concilia manualmente desde la copia independiente. El diario y el staging son privados y deben conservarse hasta terminar la validación; no los borres durante una recuperación. La migración requiere mantenimiento exclusivo también frente a procesos que no usan el bloqueo del migrador.

El flujo anterior `--apply` sigue siendo una preparación de copias, sin activar el layout v2. Este procedimiento tampoco habilita un backend aislado para agentes: deben respetarse los bloqueos de ejecución del perfil v2 hasta que exista dicho backend.
