# Layout de perfiles v3 — 5 de noviembre de 2026

## Estado real

El código admite v1, v2 y v3 sin convertir un perfil al arrancar. El 5 de noviembre
se instaló el código compatible en alfred-server y se compilaron API y web.
Profesional está seleccionado y migrado a **v3**. La transacción activa es
`80e897bb75294a7d847e86d3d355f716`. Se verificaron 447 identidades y 297
referencias a archivos existentes, sin pérdidas, y las cuatro raíces privadas
conservan sus identidades de dispositivo e inodo. `data/` solo contiene JSON.
El respaldo inicial de esta migración se creó temporalmente en
`/home/alfred/.local/share/nexa-brief/backups/profesional-v3-20261105`.
Esa ubicación en SSD no es válida para nuevos respaldos. Debe sustituirse por
un respaldo actualizado y verificado en el HDD antes de retirar la copia de
datos anterior. Su caché antigua de Next.js ya fue eliminada. El estado y la
política vigente están en
[almacenamiento-respaldos-limpieza-2026-11.md](almacenamiento-respaldos-limpieza-2026-11.md).
El perfil independiente `nuevo` existe en
`/home/alfred/.local/share/nexa-brief/profiles/nuevo`, con esquema v3 e instrucciones
por carpeta. No está seleccionado como perfil de los servicios. No recibió usuarios,
canales, publicaciones, archivos ni credenciales de Profesional.

La fábrica selecciona ejecutores aislados para Codex y Claude en v2/v3.
Sus binarios y dependencias están verificados en alfred-server; las pruebas nativas
usaron proveedores simulados, sin llamadas de inferencia. Codex está fijado por
binario, política y kernel; Claude ofrece herramientas de archivos sin Bash.
Las rutas legacy directas conservan sus guardas. Las versiones o alcances no
verificados responden `agent_isolation_unavailable`.
Véase [el diseño y sus límites](agent-isolation-design.md).

## Estructura vigente

```text
REPOSITORIO/nexa-brief-server/src/templates/
├── _tools/
│   ├── design-definitions/<design_id>/
│   │   ├── design.json             # identidad, motor, vistas y estado predeterminado
│   │   └── catalog.json            # entradas reutilizables, parámetros y ejemplos
│   ├── explainer-kit/              # motor y componentes compartidos existentes
│   └── sandbox/                    # herramientas de prototipos existentes
├── nodetech/muestras/              # ejemplos de componentes y video largo
└── sandbox/...                    # motores históricos referenciados, sin copiarlos

<perfil>/
├── profile.json                    # ID, versión de layout y proveedores seleccionados
├── AGENTS.md / CLAUDE.md            # entrada de trabajo y límites de este perfil
├── config/
│   ├── niches.json                 # categorías y configuración propia del producto
│   └── image-styles/               # estilos de imagen y fuentes predeterminados
├── data/
│   └── json/                       # únicamente registros JSON; sin medios ni locks
│       ├── videos.json             # videos, producciones, borradores y detalles por ID
│       ├── image-posts.json         # índice derivado de posts y sus revisiones
│       ├── publicaciones.json      # revisiones de publicación e idempotencia
│       ├── resources.json          # recursos, análisis, letras y aliases de archivos
│       ├── designs.json            # estado de Showcase de este perfil y snapshots
│       ├── jobs.json               # trabajos, eventos, prototipos y progreso
│       ├── logs.json               # referencias a ejecuciones y consumo por ID
│       ├── channels.json           # metadata de canales y categorías, sin credenciales
│       ├── schedule.json           # planificación y cola lógica de publicaciones
│       ├── notifications.json      # notificaciones
│       └── legacy.json             # metadata heredada conservada, si la hay
├── productions/
│   ├── AGENTS.md / CLAUDE.md
│   └── <categoría>/                # nodetech, nodehistory, nodepolitics, nodeeconomy,
│       ├── AGENTS.md / CLAUDE.md    # nodeaction, nodemotion, nodeatlas u otras del catálogo
│       └── <contenido_id>/
│           ├── PLAN.md
│           ├── manifest.json
│           ├── publish.json
│           ├── index.html
│           ├── assets/             # guion, storyboard, originales, audio y clips propios
│           └── work/results/test/  # capturas, scripts y revisión temporal agrupada
├── renders/
│   ├── AGENTS.md / CLAUDE.md
│   ├── videos/<categoría>/
│   │   ├── AGENTS.md / CLAUDE.md
│   │   └── <video_id>/<render_id>-<formato>/video.mp4
│   └── images/<categoría>/
│       ├── AGENTS.md / CLAUDE.md
│       └── <post_id>/<publication_id>/<asset_id>.jpg
├── resources/                      # archivos independientes, reutilizables por ID
│   ├── AGENTS.md / CLAUDE.md
│   ├── images/<asset_id>/<archivo>
│   ├── videos/<asset_id>/<archivo>
│   ├── audio/<asset_id>/<archivo>
│   ├── music/<asset_id>/<archivo>
│   └── sounds/<asset_id>/<archivo>
├── logs/                           # salidas reales y consumo; nunca sesiones ni tokens
│   └── AGENTS.md / CLAUDE.md
├── sandbox/
│   ├── AGENTS.md / CLAUDE.md
│   ├── <categoría>/                # instrucciones y pruebas de este perfil
│   └── referencias/<categoría>/    # referencias autorizadas del prototipo
└── .system/                        # estado técnico y privado gestionado por servicios
    ├── runtime/                    # locks, temporales, leases y cola técnica de backups
    ├── cache/                      # miniaturas y descargas regenerables
    ├── connections/                # conexiones y políticas de acceso; no datos creativos
    ├── web-data/                   # identidad y sesiones locales de la web
    ├── tiktok/                     # datos privados del servicio de conexión
    ├── browser-profiles/           # sesiones heredadas movidas de forma opaca, si existen
    └── migrations/<migration_id>/  # diario, staging y originales de recuperación
```

Las secciones adicionales aparecen al usarse. Los siete registros principales se
inicializan vacíos. No hay `_tools/`, `designs/` ni `output/` en la raíz del perfil
v3. La versión técnica del documento JSON (`schema_version: 1`) es independiente
de la versión del layout del perfil (`schema_version: 3`).

## Lectura, escritura y referencias

`JsonDataStore` selecciona el adapter según el manifiesto. En v3, los namespaces
del dominio comparten un archivo por sección con `collections` y `documents`.
Los servicios conservan sus operaciones CRUD por ID; no recorren carpetas de
medios para reconstruir cada pantalla. Las escrituras toman el bloqueo de la
sección y publican un archivo completo mediante reemplazo atómico, con revisión
y fsync. Los locks y temporales quedan en `.system/runtime`, fuera de `data/`.

`publicaciones.json` es la fuente de verdad de las revisiones de publicaciones
de imágenes y su idempotencia. `image-posts.json` es un índice regenerable, no
una segunda copia editable de cada publicación. Un cambio de nombre o categoría
no cambia el ID de video, post, recurso o publicación.

Los registros conservan claves de almacenamiento, hashes, tipo, procedencia y
relaciones por ID. El adapter traduce la clave al archivo del perfil y el servidor
produce la URL de lectura autorizada. No se debe usar una URL temporal o una ruta
absoluta del host como identidad del recurso. La vista Recursos consulta el tipo
y la ficha del recurso; los datos de una producción pueden referenciarse sin
copiar sus bytes. Una mudanza requiere actualizar la ubicación o el adapter y
conservar aliases cuando existan referencias históricas.

Las imágenes finales pertenecen a `renders/images`; los originales y entradas
del video pertenecen a `productions/.../assets`. Un recurso independiente vive
una sola vez en `resources`. El borrado desde la biblioteca comprueba referencias.

## Definiciones compartidas

El repositorio contiene 19 definiciones públicas: 15 del kit y Vida en Escena,
Cara a Cara, Atlas Cinemático y Atlas en Movimiento. No incluyen episodios ni
recursos privados del perfil. Los motores conservan sus ubicaciones; la ficha
los referencia. Promover un diseño en v3 cambia su estado en `designs.json` sin
mover ni duplicar el motor. Cada perfil mantiene su estado independiente.

La API común es `/api/v1/showcase/designs`. Para una tarea, consulta la ficha
asignada y solo la entrada `/catalog/<entry_id>` necesaria. Los bundles heredados
se comparan con la definición compartida antes de convertir su estado; una
personalización no reconocida detiene la migración para evitar perderla.

## Alta y migración

Desde la raíz del proyecto, `python scripts/storage-profile.py init <id>` crea
un perfil v3 vacío de forma atómica, con defaults públicos e instrucciones. Si
el destino existe, falla sin sustituirlo. El nombre y el puerto TikTok deben ser
únicos al operar servicios simultáneos. El alta no lo activa ni copia otro perfil.

Para preparar un perfil v1 existente, desde el servidor:

```sh
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/templates --local-plan
# Con todos sus escritores detenidos y copia de seguridad independiente:
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/templates --local-prepare --target-version 3 --confirm-maintenance --confirm-templates-owned
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --local-activate --migration-id ID_DEVUELTO --confirm-maintenance
```

La preparación conserva orígenes, hashes, aliases y un diario; no activa el layout.
La activación mueve por renombrado las carpetas privadas sin enumerar ni abrir
sesiones. Convierte los JSON en secciones, clasifica medios por tipo/categoría/ID,
conserva los archivos originales necesarios para recuperación y cambia el
manifiesto al final. Los metadatos históricos sin forma reconocida se preservan;
una referencia ausente no se sustituye por datos inventados. No borres los
originales ni el diario durante la comprobación. El rollback requiere que no haya
escrituras posteriores; la recuperación tras permitirlas necesita conciliación.

Después de activar, deben reiniciarse coordinadamente API, web, workers y
conexiones con rutas resueltas de nuevo. No basta editar `profile.json` en caliente.
La activación instala también las instrucciones de la raíz y conserva las
anteriores en el diario para restaurarlas al revertir.

## Verificación y límites

La regresión completa del servidor aprobó 1.716 pruebas con una omitida.
También se comprobaron preparación, activación y rollback sintéticos, aliases,
CRUD, idempotencia, separación de perfiles y render sintético con Chromium/FFmpeg.
La revisión previa de la web aprobó 226 pruebas, TypeScript y compilación.

La verificación posterior sobre Profesional real conservó 447/447 identidades y
297/297 referencias existentes. El baseline registró 46 referencias ya ausentes;
10 campos de categoría se clasificaron como metadatos semánticos por namespace y
puntero exactos. Diez referencias del antiguo output corresponden a dos trabajos
cuyos archivos ya faltaban. La cola local no contiene sus backups; el HDD de
respaldos está desmontado y no se comprobó si contiene paquetes recuperables.
No se inventaron archivos ni se cambiaron sus estados para ocultarlo.

Las vistas históricas usan exclusivamente medios del perfil activo; cuando falta
un medio requerido, el catálogo no presenta una vista previa disponible. No se
recurre a otro perfil ni a episodios privados del repositorio. Los ejemplos y
motores públicos mantienen su ubicación compartida.

El productor v3 entrega al agente únicamente su contexto público y delega al host
voz, transcripción y búsqueda de imágenes. Las solicitudes y selecciones de fotos
son JSON declarativos; el host descarga candidatas de proveedores conocidos,
verifica límites, redirecciones, selección y hashes, y guarda los créditos. La
selección cuenta dentro del presupuesto de llamadas existente. La mediación nueva
cubre fotos; clips automáticos e investigación factual externa no están
implementados por este broker. Una producción que los necesite debe aportar las
fuentes/medios o permanecer incompleta; no se presenta como lista por omitirlos.

Las pruebas no certifican inferencia con suscripción real ni publicación en redes.
Las instrucciones Markdown y los permisos 0700 no sustituyen la política de
herramientas del ejecutor; el host y el harness siguen siendo confiables.

## Cierre de operación en DEV

Se repararon 20 claves de `content_resources` que aún conservaban la ubicación
anterior; sus archivos existían y los aliases registraban el destino. La
reconciliación mantuvo los IDs, verificó hash y conteo, tomó el mismo lock de la
sección y guardó un respaldo antes del reemplazo atómico. La resolución también
acepta los aliases exactos para compatibilidad; futuras migraciones escriben las
claves canónicas directamente.

La comprobación HTTP cubrió los 145 recursos de biblioteca (13 imágenes, 34
canciones, 95 videos/clips y 3 sonidos), todos con respuesta parcial 206. De 20
streams de trabajos, 16 respondieron y cuatro devolvieron 404: son los formatos
YouTube/Reels de `8364343a` y `ab8098d6`, cuyos archivos ya estaban ausentes en el
baseline. Hay 9 trabajos, 7 producciones, 35 borradores, 19 diseños compartidos y
938 entradas de catálogo; 31 vistas previas representativas respondieron 200.

Chromium confirmó estado listo y contenido en Vida en Escena, Cara a Cara y Atlas
en Movimiento. Rough mostró su contenido textual. Atlas Cinemático alcanzó
`__atlasPreview` con `missing: []`, dos canvas y HTTP 206 para PMTiles; necesitó
una espera extendida y su captura agotó el tiempo disponible, así que no se
certifica fluidez ni revisión visual completa de ese motor 3D.

La última corrida completa de servidor aprobó 1.716 pruebas y omitió una. Después
se aprobaron 91 pruebas de producción/aislamiento y 23 de recursos/migración para
las correcciones finales. TypeScript, Biome y el cargador de configuración de Next
validaron la raíz explícita de Turbopack. Se apartó reversiblemente `.next/dev`
antes del nuevo arranque; Showcase compiló inicialmente en unos 15 segundos y las
siguientes páginas respondieron en aproximadamente 1–2 segundos. Sin una sesión
real, las páginas privadas redirigen a login, que respondió 200; no se simuló una
sesión autenticada para esa comprobación.

DEV usa API 8000, web 3000 y la conexión TikTok 8100. Los servicios del host que
estaban activos se restauraron y los procesos de edición pausados para la copia
se reanudaron. Los contenedores API/web continúan detenidos por instrucción del
usuario; no se construyeron ni arrancaron durante esta operación. El perfil
`nuevo` sigue sin datos creativos, cuentas ni publicaciones de Profesional;
contiene únicamente las 19 definiciones públicas iniciales en su estado propio.

Supabase permanece pendiente. Los puertos separan servicios y persistencia,
pero no se ha activado ni probado un adapter Supabase. Credenciales, sesiones,
membresías y recursos binarios requieren políticas distintas; no se deben subir
perfiles completos de Chromium como objetos de una tabla. La futura transición
está documentada en [future-supabase.md](future-supabase.md).

### Navegación de los catálogos en Showcase

El contrato público admite `entries[].family`, `entries[].section`
(`components`, `sprites` o `workflows`) y `groups[]` con `id`, `label`,
`families` y `components` (nombres nativos). Cada diseño debe declarar las
familias y grupos que necesita para filtrar su biblioteca. Las etiquetas
existentes también siguen disponibles como categorías. La interfaz combina
botones de tipo, categorías y búsqueda; reinicia los filtros al cambiar de
diseño y muestra un contador por grupo.

El adapter `catalog_navigation.py` recupera las familias y pestañas omitidas
en la exportación inicial de los cuatro diseños nativos, leyendo únicamente
sus metadatos públicos del repositorio. No modifica IDs, revisiones, ejemplos,
episodios ni archivos del perfil. Los 15 diseños del kit conservan sus etiquetas.
No se necesita otra migración de Profesional para restaurar estos filtros.
