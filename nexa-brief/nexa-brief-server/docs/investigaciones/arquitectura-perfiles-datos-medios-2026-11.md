# Investigación: perfiles, datos y medios de Nexa Brief

Documento de diseño. La separación local v2, las muestras y el migrador ya
tienen implementación y pruebas; el perfil real sigue sin migrar y Supabase
continúa siendo futuro. El estado de entrega y sus límites se mantienen en
[refactor-status-2026-11-05.md](../refactor-status-2026-11-05.md). Los apartados
siguientes conservan la distribución objetivo, incluida la transición remota.

## Ubicación de los motores

`_tools/` no es una carpeta adicional en el perfil ni una octava sección de datos. Ya existe dentro del código, en `nexa-brief-server/src/templates/_tools/`, y ahí permanecen los motores y herramientas compartidas. Por ejemplo, `explainer-kit` contiene su motor, diseños y componentes. El perfil solo necesita referencias a los IDs y versiones que usa; no necesita otra copia de `_tools/`.

```text
REPOSITORIO
nexa-brief-server/src/templates/
├── _tools/                         # motores y herramientas del código
│   └── explainer-kit/
│       ├── engine/
│       ├── designs/
│       ├── tools/
│       └── showcase/
├── nodetech/muestras/               # ejemplos explícitos de componentes y video largo
└── ...                              # demás categorías y plantillas
```

Las muestras se consultan desde Plantillas y Showcase. Los motores experimentales
que actualmente viven en `sandbox/` no se trasladan automáticamente: cada uno
debe revisarse antes de integrarlo en `_tools/`.

## Perfil: estructura propuesta

```text
~/.local/share/nexa-brief/profiles/<perfil-id>/
├── profile.json                     # identidad/configuración técnica del perfil
├── AGENTS.md / CLAUDE.md            # guías breves, sin secretos
├── data/                            # JSON local y referencias que deban quedar locales
├── logs/                            # logs reales y consumo de agentes/modelos
├── productions/<categoría>/<video-id>/
│   ├── PLAN.md, index.html, manifest.json, publish.json
│   ├── assets/                      # guion, audio, imágenes, clips y otros insumos
│   └── work/                        # trabajo y revisión
├── renders/<video-id>/<grabación-id>/ # videos terminados y formatos
├── resources/<tipo>/<recurso-id>/   # archivos subidos sin video asociado
├── sandbox/<categoría>/             # pruebas y prototipos
└── .system/                         # propuesta: estado técnico y datos locales privados
    ├── runtime/                     # bloqueos y estado de procesos
    ├── cache/                       # vistas previas y cachés
    ├── browser-profiles/            # perfiles activos del navegador
    ├── connections/                 # conexiones que todavía requieran soporte local
    └── tiktok/                      # datos locales del servicio
```

Este es un esquema conceptual: los nombres internos y la migración necesitan validación. No presupone que se pueda eliminar `output/` o mover sesiones activas sin adaptar y probar los servicios. La información de cada log debe enlazarse mediante un ID desde el registro correspondiente. El detalle y consumo quedan locales; el costo solo se informa cuando el proveedor lo entrega o es una estimación identificada.

## Datos en Supabase y datos locales

La intención es que Supabase almacene los datos de las secciones y los datos sensibles de cuenta que se decida migrar, mientras gran parte de los archivos y el trabajo sigan locales. Es una distribución objetivo, no una afirmación de que ya esté configurada.

| Información | Destino propuesto |
| --- | --- |
| Perfiles, membresías y permisos | Supabase, con autenticación y controles por perfil. |
| Registros de videos, detalles, relaciones, trabajos y estados | Supabase. Las respuestas de la API pueden ser objetos JSON. |
| Índices de recursos, plantillas, motores, diseños y componentes | Supabase o índices generados; definir la fuente de verdad de cada catálogo para no duplicar ediciones. |
| Canales, programación, cola, publicaciones, borradores y notificaciones | Supabase, con migración y controles propios de cada sección. |
| Datos sensibles de cuentas y conexiones | Objetivo: almacenamiento protegido en Supabase cuando exista implementación, cifrado, permisos mínimos, gestión de claves y restauración verificados. No entregar credenciales a agentes ni navegadores. |
| Producciones, sus medios y archivos de trabajo | Local en `productions/`. |
| Videos terminados y sus versiones | Local en `renders/`. |
| Medios subidos independientemente | Local en `resources/`; cada recurso tiene ID y registro. |
| Logs, consumo y ejecuciones de prototipos | Local, con referencias por ID cuando haga falta. |
| Sandbox, cachés, bloqueos y perfiles activos de navegador | Local; mantener aislados los datos sensibles de las sesiones. Un respaldo cifrado de sesión es una posibilidad a evaluar, no un reemplazo automático del perfil activo. |

Supabase usa PostgreSQL; permite almacenar objetos JSON, pero no es una base NoSQL pura. Si Supabase es la fuente principal de un dato, los JSON locales que lo representen deben ser exportaciones o cachés controladas, no una segunda fuente editable. Los archivos grandes permanecen locales por ahora y Supabase guarda sus referencias, no sus bytes.

## Identidades y acceso a archivos

Cada video, recurso, grabación, trabajo, publicación y log debe tener un ID estable. Un video se relaciona con sus recursos, grabaciones, publicaciones y logs por ID. La API resuelve la ubicación real de un recurso y entrega una URL autorizada a la web; no se depende únicamente de guardar URLs públicas o temporales. Esto facilita un futuro CDN sin cambiar la identidad del recurso.

Recursos muestra música, imágenes, clips y sonidos consultando sus registros, tanto si el archivo está en `productions/.../assets/` como si fue subido a `resources/`. Showcase consulta el catálogo de componentes y usa el motor del repositorio para ejecutarlos; el JSON no sustituye el código del componente. Plantillas y motores deben conservar una fuente de verdad clara para evitar catálogos contradictorios.

Cuando varios videos usen un recurso, su borrado debe comprobar referencias para no romper los demás. Las grabaciones deben conservar identidad y versiones independientes.

## Condiciones para la refactorización

1. Inventariar los datos, referencias y rutas actuales sin imprimir secretos.
2. Definir acceso por perfil, IDs, propiedad de recursos, comportamiento de borrado y fuente de verdad.
3. Adaptar catálogo, vistas previas, Recursos, Showcase, grabación, Biblioteca, borradores, publicación y cola. El código actual todavía usa rutas de `src/templates/`, `data/` y `output/`.
4. Implementar proveedores de Supabase y probar autorización entre perfiles; una clave privilegiada no debe quedar al alcance del agente ni del navegador. El adaptador no está implementado solo por existir el contrato de almacenamiento.
5. Probar con un perfil vacío y una copia de datos; garantizar coordinación atómica de la cola entre procesos.
6. Respaldar y verificar archivos y registros, migrar por etapas, conservar rutas antiguas hasta comprobar reproducción, publicaciones y recuperación, y contar con un procedimiento de reversión.

No eliminar ni mover perfiles de navegador, credenciales, cachés o `video_backups/` sin identificar su uso y comprobar la recuperación. Las instrucciones en Markdown orientan al agente, pero el aislamiento real de datos requiere permisos del sistema y servicios con acceso limitado.
