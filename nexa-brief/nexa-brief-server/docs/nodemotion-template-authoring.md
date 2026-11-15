# Crear e integrar plantillas NodeMotion

Esta guía corresponde a crear **un diseño reutilizable** de letras o promociones. No es el flujo para preparar otro video de una plantilla existente. Es válida para Claude, Codex y otros agentes; el modelo elegido no cambia los contratos ni los permisos del ejecutor.

Lee primero las reglas del repositorio, `src/templates/AGENTS.md` y [la arquitectura](nodemotion-architecture.md). Para prototipos aplica también `src/templates/sandbox/PROTOTIPO.md` y `PREPARAR-PRODUCCION.md`.

## 1. Decidir el alcance

- Otro tema, canción, guion, medio o paleta admitida por un diseño: preparar datos del diseño existente; no crear motor ni ID nuevos.
- Composición, lenguaje visual o comportamiento reutilizable propio: crear una plantilla, con ID estable y contrato explícito.
- No cambiar otros diseños ni sus demos, colores, fuentes, tiempos, transiciones o movimientos para integrar uno nuevo. La apariencia del diseño encargado se define en su brief y se valida en ambos formatos.
- Usar nombres de carpetas, archivos y nuevos IDs en inglés, en minúsculas y con guiones donde corresponda. Mantener los IDs históricos y las URL públicas existentes.

## 2. Responsabilidades y ubicación

El **creador del prototipo** trabaja dentro de la carpeta asignada del Sandbox del perfil efectivo. Entrega diseño, datos de demostración, contratos y evidencia; no escribe registros de producción, no mueve carpetas manualmente y no presenta una integración pendiente como terminada. Si el ejecutor está aislado, respeta sus permisos: no sale de su carpeta ni ejecuta herramientas del repositorio por deducción de esta guía.

El **integrador del repositorio**, con alcance para modificar código compartido, registra y verifica el motor. Usa el servicio de preparación y paso a producción para el traslado y registro que ese servicio soporte. Si el informe deja pendiente el motor compartido NodeMotion, completa esa integración en código y repite la verificación; cambiar una tarjeta de categoría no integra el motor.

La fuente final queda organizada así (las rutas parten de `nexa-brief-server/`):

```text
src/core/nodemotion/
├── service.py                         # Fachada existente: proyectos, resolución y ejecución
├── factory.py                         # Selecciona lyrics o promo desde el manifiesto
├── shared/                            # Recursos, revisiones y ejecución comunes
├── lyrics/                            # Comportamiento exclusivo de letras
└── promo/                             # Guion, preparación, estrategias y aprobación de promos

src/templates/_tools/nodemotion/
├── AGENTS.md                          # Reglas de autoría e integración
├── shared/
│   ├── assemble.py                    # Ensambla la fuente y conserva revisiones
│   ├── discovery.py                   # Deriva contratos breves para agentes
│   └── resources/<sha256>.<ext>        # Medios de demo compartidos por contenido
├── lyrics/
│   ├── designs/lyrics-<name>/          # Fuente única del diseño
│   └── compiler/<family>/             # Solo si el diseño necesita compilador
└── promo/
    ├── designs/promo-<name>/           # Fuente única del diseño
    ├── compiler/                      # Compilación compartida, sin otro productor
    ├── tools/                         # Herramientas de preparación existentes
    └── production/
        ├── templates/<id>.json        # Contrato editorial/técnico de la promo
        ├── schemas/                   # Validación de datos
        └── prompts/                  # Prompts versionados; no copias por video

src/templates/nodemotion/
├── lyrics/lyrics-<name>/               # Demo pública registrada
└── commercial/promo-<name>/            # Demo pública registrada de promo
    ├── index.html                     # Entrada mínima, sin motor duplicado
    ├── assets/config.json             # Datos de demostración
    ├── info.json / DESIGN.md           # Identidad y reglas del diseño
    └── showcase/components.json       # Contratos de piezas, cuando existan

<profile>/sandbox/nodemotion/<id>/      # Prototipo privado y sus evidencias
<profile>/productions/nodemotion/<id>/  # Episodios: JSON y referencias, sin motor propio
```

Las carpetas `commercial`, las categorías públicas y otros identificadores existentes son contratos: no renombrarlos para ajustarlos a un término de la guía.

## 3. Contrato del motor

Dentro de `designs/<id>/`:

```text
manifest.json       # ID, familia, demo, documento, fragmentos y alias
document.html       # Estructura del documento; no datos de una campaña particular
scripts/            # Bloques JS ordenados del documento
styles/             # Estilos del documento
runtime/            # JS, CSS, fuentes, SVG u otras piezas externas del diseño
contract.json       # Referencias a fuentes de verdad e inputs del diseño
QUICK.md            # Índice breve generado para agentes
catalog.json        # Índice de piezas generado
contracts/          # Fichas de piezas generadas
revisions/          # Revisiones inmutables administradas por el motor
```

- `manifest.json` debe seguir el esquema real que consume `shared/assemble.py`: `schema_version`, `design_id`, `family` (`lyrics` o `promo`), `demo_folder`, `document`, `fragments`, `runtime_aliases` y metadatos de integridad. No inventar campos que ningún consumidor lea.
- Cada marcador de fragmento aparece una sola vez. Conservar orden de scripts, ámbito de variables y dependencias. Separar código no autoriza cambiar su ejecución.
- `runtime_aliases` relaciona una URL del diseño con el archivo fuente correspondiente; no crear otra implementación en la demo para satisfacer una URL antigua.
- Los medios de demo se resuelven con `demo_resource_aliases`. No colocar música o clips dentro de `runtime/` para eludir Recursos.
- Configuración, letra o guion se reciben como datos. No codificar en JS la canción, equipo, campaña o archivo particular de la demostración.
- Reutilizar piezas comunes solo cuando su contrato y apariencia sean compatibles. Una coincidencia visual aproximada no justifica modificar una pieza existente utilizada por otros diseños.
- Usar `assemble()`/el resolvedor y las APIs de actualización existentes. Para diseños ya registrados y salida de compilador, `update_engine()` conserva la revisión anterior; no escribir encima de una entrada mínima de demo.
- No borrar, editar ni fabricar revisiones históricas. Si se cambia runtime externo, conservar también la revisión anterior antes de publicarlo: actualizar solo HTML no reemplaza esa obligación.
- No añadir un productor, servidor de archivos, grabador o API independiente por plantilla. El motor debe funcionar con los servicios compartidos.

## 4. Datos, recursos y comportamiento

**Letras:** la transcripción musical es un recurso inmutable compartido; los episodios referencian música y transcripción. Una letra de demo es un ejemplo de datos, no código del motor.

**Promos:** el guion y la línea temporal pertenecen a la campaña. El archivo canónico es `timeline.json`; `lyrics.json` puede mantenerse como URL de compatibilidad donde lo exige el reproductor. Nunca guardar un guion de promo en la caché de transcripción de una canción. Las estrategias editoriales, de diálogos, escenas, investigación o preparación pertenecen a `src/core/nodemotion/promo/`; las transiciones visuales pertenecen al diseño compartido. Declarar límites de líneas, palabras, duración, slots y escenas en sus contratos.

**Medios:** referenciar Recursos por ID y hash. Si se usa una versión preparada, conservar su `variant_file` y hash, sin sustituirla por el original. Los pósteres se comparten mediante el servicio; no generar otra copia en cada episodio. Los medios de la demo se consolidan en el almacén por hash y se registran en Recursos sin copiar sus bytes al preparar episodios.

**Ejecución:** preview y grabación usan el mismo resolvedor. La grabación materializa un export temporal; el episodio no conserva `index.html`, scripts, fuentes ni copias de música. Cada ejecución fija una revisión del motor. No usar rutas absolutas del ordenador, IP locales, rutas de otro perfil o enlaces simbólicos para resolver dependencias.

**Reloj:** respetar el reloj HyperFrames y el protocolo de reproducción/seek utilizado por las plantillas. No introducir un segundo reloj que avance distinto en preview y captura. Comprobar carga de fuentes y medios, cambios de aspecto, audio y fin de reproducción. No declarar soporte Remotion sin una composición y sus verificaciones reales; el soporte de un renderer no se deduce del nombre de la familia.

## 5. Integración de un diseño

1. **Brief e identidad.** Definir familia, ID, propósito, formatos, inputs, piezas, escenas, restricciones y renderer soportado. Para una demo principal de diseño nuevo declarar `is_new_design: true` en el contrato de Sandbox; para un episodio no utilizar esa marca.
2. **Prototipo.** Entregar la composición dentro del Sandbox autorizado con `info.json`, configuración válida y medios trazables. Añadir `DESIGN.md` y contratos de componentes. Una demo aislada aún puede necesitar su composición autocontenida para la verificación de Sandbox; esto no es la estructura final del motor ni una receta para copiarlo a episodios.
3. **Preparación y registro.** Ejecutar el flujo existente de verificación/paso a producción. Respetar sus pendientes técnicos. El catálogo público de plantillas tiene su fuente en `src/templates/templates.json`; el integrador debe verificar la entrada generada y sus rutas. Si una integración de código necesita modificar esa fuente, hacerlo como cambio revisable y validado, nunca editar el estado del perfil para simular un registro. `niches.json` describe el comportamiento del pipeline y no sustituye el catálogo público.
4. **Fuente compartida.** Integrar `designs/<id>/` y una demo de datos con entrada mínima. Para incorporar una composición registrada todavía autocontenida, la herramienta existente `extract.py --extract <id>` realiza la extracción inicial y comprueba equivalencia antes de retirar la implementación de la demo. Usarla solo sobre el ID revisado y la composición autorizada: no ejecutarla globalmente ni usarla para sobrescribir motores ya registrados. Si la composición contiene dependencias externas no contempladas por el extractor, inventariarlas, registrarlas y verificar su resolución; no asumir que la extracción las encontró todas.
5. **Recursos de demo.** Inventariar solo este diseño con `plan_demo_resources(templates_root, [design_id])` del módulo `src/core/nodemotion/shared/bundled.py`, revisar el plan y aplicarlo mediante `apply_demo_resource_plan`. La API y la CLI existen; se ejecutan con el perfil/rutas efectivos y las reglas del repositorio. No reconstruir manualmente las claves hash o alias. Conservar los originales hasta verificar sus reemplazos.
6. **Inputs y familia.** Confirmar que catálogo, configuración, prompts de configuración y estrategia del proyecto describen los mismos inputs y nombres de medios. No añadir otro tipo de familia a la factoría para una variante visual que sigue siendo lyrics o promo.
7. **Preparación editorial, si se ofrece.** Una promo no queda habilitada para preparación por chat solo por aparecer en el catálogo. Revisar `src/core/nodemotion/promo/prompts.py` (lista `TEMPLATES`), contrato de producción, esquemas, validaciones del builder/pipeline, descubrimiento y estrategias necesarias. Añadir soporte explícito y pruebas, o declarar esa capacidad pendiente. No falsear un ID conocido para pasar validaciones. Si cambia un prompt ya utilizado, crear versión y referencia con hash; no modificar la versión fijada por campañas existentes.
8. **Descubrimiento y Showcase.** Los contratos deben permitir elegir piezas sin leer todo el motor. Documentar parámetros, tipos, valores por defecto, opciones, límites, ejemplo mínimo y diferencias 16:9/9:16. Actualizar fuentes de verdad (`showcase/components.json`, metadata de diseño o contrato de producción) y regenerar los índices; no editar solo `contracts/*.json`. Mantener las reglas de visibilidad del perfil: una demo registrada no autoriza activar todos los proyectos en Showcase.
9. **Pruebas y entrega.** Completar los criterios siguientes antes de declarar integrada la plantilla. Si el entorno no permite una prueba, registrar la limitación; no afirmar que pasó.

**Referencias, variantes y nombres.** Una referencia o ejemplo es una guía: se parte de la base aprobada y se adapta a la canción, el texto y el tiempo pedidos. No se copia literal ni se mezclan dos diseños en uno. Una variante declara su base en `REPORT.md` y tiene su propio `id` y `display_name`. Los nombres visibles son únicos en `templates.json` (mayúsculas y espacios no cuentan); el catálogo rechaza duplicados. Convención: el id es `<familia>-<cambio>` y el nombre visible conserva la base de la familia y termina con la palabra del cambio.

## 6. Herramientas existentes y límites

Desde la raíz del servidor, sustituyendo `<id>` por el diseño encargado:

```sh
# Inspección de integridad de un diseño ya registrado; no crea contenido.
.venv/bin/python src/templates/_tools/nodemotion/shared/extract.py --check <id>

# Regenerar descubrimiento desde metadata y contratos de ese diseño.
.venv/bin/python src/templates/_tools/nodemotion/shared/refresh_catalogs.py <id>

# Extracción inicial de una composición registrada, después del registro y revisión.
.venv/bin/python src/templates/_tools/nodemotion/shared/extract.py --extract <id>
```

La CLI `extract.py --extract` crea la fuente de un diseño que aún no está registrado en el ensamblador; para uno registrado verifica la extracción existente, no actúa como un asistente de alta completo. No existe un comando único que garantice alta, renderer, chat y promoción: verificar cada integración descrita arriba.

La extracción expone `split_document`, `thin_entry` y comprobaciones de hashes; no copiar hashes de otra plantilla para conseguir una comprobación verde. Si el motor se crea directamente por componentes, integrar el manifiesto conforme al ensamblador y conservar una referencia verificable de su salida inicial. Revisar también el índice global `_tools/nodemotion/catalog.json`: `refresh_catalogs.py <id>` regenera las fichas del diseño, no garantiza por sí solo actualizar todos los índices globales.

Las carpetas de compilador `build/` contienen código fuente y specs, no basura generada. Están exceptuadas por `_tools/nodemotion/.gitignore`; verificar que Git incluya los archivos nuevos. No borrar compiladores después de generar el motor. No ejecutar un build que cambie escenas o medios de diseños ajenos para comprobar que este funciona.

## 7. Criterios de aceptación

- ID/familia/demo coherentes; `registered(id)`, `assemble(id)` y congelación de revisión funcionan.
- Catálogo público y resolución del diseño reconocen la entrada; las rutas de datos, runtime, fuentes y medios responden sin dependencias del Sandbox ni de otra máquina.
- Documento y runtime de la referencia aprobada conservan sus bytes al extraer; comprobar errores del navegador y que no falten medios/fuentes.
- Preview en 16:9 y 9:16, reproducción, seek, intro/outro y transición de escenas verificados según los formatos realmente soportados. No reducir resolución, fps, efectos o calidad para hacer pasar una prueba.
- Un proyecto de prueba con datos propios usa el motor y Recursos compartidos; no crea otra implementación persistente ni copias de medios. La finalidad de ese proyecto es verificar la integración del diseño.
- Configuración o línea temporal inválidas fallan explícitamente; rutas externas, traversal, referencias privadas y recursos de hash incorrecto no se sirven.
- Los contratos selectivos se consultan por catálogo/componente y coinciden con los valores que el motor acepta. No presentar defaults observados como límites validados.
- Si se modifica un motor existente, una ejecución con revisión fijada sigue resolviendo sus bytes anteriores.
- Una captura o render real requiere autorización y permisos del ejecutor. Si se autoriza, probar el renderer anunciado y revisar el resultado; si no, dejar esa validación pendiente. No grabar ni publicar solo por completar el checklist.
- Ejecución de pruebas pertinentes, sin cambiar diseños existentes ni debilitar sus aserciones para obtener verde. La suite general puede tener fallos previos: comparar los IDs y explicar las regresiones.

Las pruebas existentes de `test_nodemotion_engines.py`, `test_nodemotion_execution.py`, `test_nodemotion_http.py`, `test_nodemotion_integration_contracts.py` y los contratos de promo orientan la selección. Añadir pruebas del comportamiento propio del diseño y sus inputs; no depender solo de un contador fijo de plantillas.

## 8. Entrega del agente

Entregar un `REPORT.md` con ID, familia, propósito, archivos fuente, demo, componentes/contratos, integración de catálogo, renderer y preparación editorial; recursos y licencias; pruebas ejecutadas con resultado real; comparaciones visuales; pendientes y capacidades no soportadas. Indicar qué revisa la persona y las rutas exactas. No declarar terminado un diseño que solo aparece como tarjeta o cuyo motor continúa copiado dentro de la demo/episodios.

La arquitectura de referencia y sus límites medidos están en [arquitectura](nodemotion-architecture.md) y [validación](nodemotion-validation.md). Esta guía define cómo trabajar; no es una orden de generar contenido, renderizar, publicar ni modificar permisos.
