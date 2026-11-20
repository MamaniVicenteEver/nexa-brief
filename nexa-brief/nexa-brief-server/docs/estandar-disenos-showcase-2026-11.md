# Estándar de diseños y Showcase

La ubicación de bundles descrita aquí corresponde a v1/v2. En v3 se usan las
definiciones compartidas del repositorio y un estado JSON por perfil, sin mover
carpetas al promover. Consulta [el layout v3](profile-layout-v3-2026-11.md).

Un diseño es reutilizable; un episodio es una producción concreta. La API de
Showcase reúne los diseños en prueba y producción con el mismo contrato. El
estado determina la ubicación del bundle, no el formato del catálogo ni el
reproductor que utiliza. La implementación permanece local; no usa Supabase.

## Estructura por perfil

```text
<perfil>/
├── data/showcase/
│   ├── designs.json                     # índice de bundles propios, sin binarios
│   └── legacy-source.json               # confirmación explícita de propiedad v1
├── sandbox/designs/<categoría>/<id>/     # estado prueba
│   ├── design.json                      # identidad, categoría y revisión
│   ├── catalog.json                     # componentes y demás entradas estándar
│   ├── showcase.html                    # entrada de vista previa
│   ├── AGENTS.md / CLAUDE.md             # instrucciones específicas del diseño
│   ├── components/
│   ├── assets/
│   ├── sets/
│   ├── characters/
│   └── preview/
├── designs/<categoría>/<id>/             # mismo bundle al pasar a producción
├── productions/<categoría>/<video-id>/   # guion, audio y recursos del episodio
└── .system/runtime/showcase/             # exclusión y diario de recuperación
```

La categoría, por ejemplo `nodeaction`, no cambia al promover. El ID y la
revisión de contenido tampoco cambian por un movimiento. Los motores compartidos
continúan en el repositorio; los adapters heredados los referencian y conservan
los recursos existentes. No se copian los motores, audios, sprites ni renders
para presentar una ficha en el nuevo catálogo. Los diseños integrados del kit
son código compartido de solo lectura y se presentan en producción.

Los perfiles nuevos incluyen las carpetas e instrucciones de diseños. El
bootstrap agrega guías de raíces, categorías y bundles sin leer ni reemplazar
las guías que el propietario haya personalizado.

## API común

| Operación | Ruta relativa a `/api/v1` |
| --- | --- |
| Diseños, estados y relaciones | `GET /showcase/designs` |
| Ficha de un diseño | `GET /showcase/designs/<id>` |
| Catálogo | `GET /showcase/designs/<id>/catalog` |
| Contrato de una sola entrada | `GET /showcase/designs/<id>/catalog/<entry_id>` |
| Vista previa estable | `GET /showcase/designs/<id>/preview?entry=<entry_id>&format=9x16` |
| Archivos propios del bundle | `GET /showcase/designs/<id>/files/<ruta>` |
| Pasar a producción | `POST /showcase/designs/<id>/promote` |

La ficha incluye ID, nombre, categoría, estado, familia, motor, revisión,
disponibilidad de promoción y episodios relacionados. Cada entrada conserva ID,
tipo, descripción, etiquetas, parámetros, ejemplo y vista previa. Los tipos son
`component`, `set`, `character`, `action` y `workflow`. Las URLs públicas se
resuelven por identidad; no se entrega al navegador una ruta absoluta del host.

El agente puede consultar una sola entrada para trabajar con sus parámetros y
ejemplo sin leer todos los motores ni transmitir un catálogo completo. Las
fuentes de verdad del código permanecen en sus motores; las fichas son índices
o adapters derivados, no otra copia editable del motor.

## Promoción y compatibilidad

La operación valida el contrato y los archivos antes del movimiento. Usa
exclusión entre procesos y un diario para recuperar una interrupción o revertir
un fallo. El índice se escribe atómicamente. Repetir la solicitud de un bundle
ya promovido devuelve su estado actual. Los diseños integrados no se modifican.

Se mueve únicamente el bundle reutilizable. Los episodios conservan su ID,
guion, tiempos, audio y render. Vida en Escena, por ejemplo, conserva el diseño
`vida-en-escena` y los episodios `un-dia-cualquiera` y
`vida-en-escena-heladeria`, aunque el nombre de la carpeta del primero sea otro.
Las URLs de consulta del diseño y de sus entradas siguen siendo las mismas.

La migración de almacenamiento v1→v2 conserva un sandbox propio existente y
sus bundles mediante movimientos registrados. Rechaza colisiones antes de
activar; los diseños ya promovidos en `designs/` permanecen en su ubicación.
Esto no activa ni migra por sí solo ningún perfil real.

## Adopción del legado

El plan no modifica archivos. Desde `nexa-brief-server`:

```sh
python scripts/standardize-designs.py --profile-dir /ruta/perfil --all --confirm-ownership
python scripts/standardize-designs.py --profile-dir /ruta/perfil --all --apply --confirm-ownership
```

`--confirm-ownership` afirma que el material seleccionado pertenece al perfil;
no sustituye la autorización de usuarios de una futura implementación remota.
El bootstrap no cambia estados de diseño a producción por su cuenta ni activa
publicaciones. Las demos que usan un diseño integrado se agrupan con él.

Un perfil vacío no descubre episodios privados del repositorio. El inventario
heredado v1 requiere una marca de propiedad explícita; v2 consulta solamente
sus propios episodios. El namespace compartido admite motores y muestras
declaradas, no un acceso general a los videos del perfil antiguo.

Los candidatos incompletos permanecen visibles con diagnóstico y promoción
bloqueada. No se inventan componentes para rellenar el catálogo. La preparación
del Atlas Cinemático comprueba sus recursos locales de mapa: una copia de código
sin esas cachés no demuestra que su vista previa funcione. Atlas en Movimiento
usa su motor original y una galería estable en `preview/tactico/`; la carpeta
temporal `work/` continúa protegida. Las variaciones del motor no se sustituyen
silenciosamente por otra versión visual.

## Verificación

La comprobación de la interfaz, sus formatos y una promoción real con datos
sintéticos está documentada en [verification-local-v2.md](verification-local-v2.md).
La suite completa del servidor terminó con **1.596 aprobadas y una omitida**.
Después del último ajuste del bootstrap pasaron otras **38 pruebas dirigidas**
(incluyen casos repetidos de la suite). La web terminó con **213 aprobadas**;
TypeScript, Biome y la compilación local de Next con Webpack también pasaron.
Las 49 pruebas Node del motor Atlas cubrieron las opciones del showcase.
Un estado HTTP 200 del HTML no basta para confirmar que los componentes y sus
recursos se hayan cargado; los ensayos de navegador y sus límites están en
[verification-showcase-browser.md](verification-showcase-browser.md).

## Aplicación al perfil Profesional

El 5 de noviembre de 2026 se aplicó el código a `alfred-server`, comprobando
primero hashes de los archivos y ausencia de trabajos activos. Se respaldaron
los archivos sustituidos en `/tmp/nexa-showcase-release-20261105/backup` y se
conservaron los cambios ajenos del repositorio. El worker de contenido se
detuvo durante la copia y se volvió a iniciar después.

El bootstrap creó cuatro bundles propios en estado `prueba`:

| Diseño | Entradas estándar | Episodios declarados |
| --- | ---: | ---: |
| `vida-en-escena` | 125 | 2 |
| `cara-a-cara` | 55 | 0 |
| `atlas-cinematico` | 36 | 0 |
| `atlas-en-movimiento` | 360 | 0 |

Atlas en Movimiento incluye 91 componentes y 269 sprites; no son 360
animaciones distintas. Los 15 diseños integrados permanecen en producción y
seis candidatos heredados muestran su bloqueo por falta de catálogo o por ser
una plantilla de pipeline sin catálogo de componentes. No se promovieron por
decisión automática ni se inventaron contratos para ellos.

El perfil conserva `schema_version: 1`. Esta adopción del estándar no activa
la migración de almacenamiento v2, no mueve cuentas ni sesiones y no conecta
Supabase. La promoción completa se ensayó con perfiles temporales; el estado
de los diseños reales queda a elección del propietario.

Se reconstruyeron las imágenes API y web y se recrearon solamente esos dos
servicios de Docker, sin eliminar volúmenes. La primera construcción web agotó
el tiempo de conexión al registro de paquetes; el reintento con red del host
terminó correctamente. Las imágenes anteriores quedaron etiquetadas como
`nexa-brief-api:before-showcase-20261105` y
`nexa-brief-web:before-showcase-20261105` para recuperación.

Las API en puertos 8000 y 8002 informaron salud correcta y publicación
automática desactivada. Ambas entregaron los mismos 25 diseños; se comprobaron
catálogos, consulta de una entrada y HTML de vista previa con HTTP 200 para
Rough y los cuatro bundles adoptados. Las web de 3000 y 3002 devolvieron 200
en `/api/health` y redirección de autenticación en `/showcase`. El worker de
contenido quedó activo. Las comprobaciones visuales remotas cubren entradas
concretas de Atlas y no una comparación exhaustiva de todos los componentes.

Ruff pasó sobre el módulo estándar, sus pruebas y los módulos de migración
revisados. La comprobación amplia también detectó avisos de estilo ya presentes
en herramientas heredadas; no se considera limpio el lint global del proyecto.
