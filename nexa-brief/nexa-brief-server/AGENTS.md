Para crear cualquier contenido empieza por el [índice](src/skills/README.md),
[CALIDAD.md](src/skills/CALIDAD.md) (estándar obligatorio) y
[ORQUESTACION.md](src/skills/ORQUESTACION.md) (roles, delegación, terminado e informe).

# AGENTS.md · nexa-brief-server

Entrada para cualquier agente de IA (Codex, Claude Code…) que trabaje en este servidor.

## Crear plantillas NodeMotion
Para crear o integrar un diseño reutilizable de letras o promos, lee primero
[la guía de autoría e integración](docs/nodemotion-template-authoring.md).
Define fuente compartida, componentes, recursos, catálogos, renderers y criterios de aceptación.
Es distinto de preparar videos de una plantilla existente.
Claude, Codex y otros agentes siguen los mismos contratos y los permisos de su ejecutor.

## Implementar idiomas en categorías o diseños existentes

Para habilitar o corregir ediciones multilingües de un diseño, empieza por
[la guía de implementación compartida](docs/investigaciones/estandar-implementacion-ediciones-multilingues-2026-11.md).
Su sección 2 indica qué partes leer según la tarea. Describe los contratos reales,
perfil, investigación, prompts, API, modal, recuperación y aceptación por diseño;
distingue el piloto `rough` de los motores que todavía necesitan integración.
No implementes un productor, API ni almacenamiento paralelo por categoría.
Para generar o recuperar una edición de un diseño ya habilitado, la entrada del
operador es `src/skills/editions/SKILL.md`; utiliza la misma API privada que la web.

## Elección de flujo de contenido

El índice común reúne los flujos de explicativos, Atlas, promociones, prototipos y lotes.
En Atlas Cinemático, descubre entradas con `produce.mjs catalog` y `example`; no
confundas el globo 3D con el diseño Atlas 2D. En el noticiero, la voz y el estilo
visual son los del diseño elegido. No copies motores para montar un video.
Los medios y la música se registran en el perfil y se reutilizan por ID.

## Reglas de este repo

- Los respaldos completos y de migración se guardan únicamente en el HDD montado
  y verificado por UUID; si no está disponible, detente sin crear otra copia en SSD.
  Aplica también a copias manuales de agentes. Consulta la política del AGENTS.md
  raíz y `docs/almacenamiento-respaldos-limpieza-2026-11.md`.
- Sin `git commit` ni `push` salvo que el humano lo pida.
- Nunca leas ni imprimas `.env`, `accounts.json`, `client_secret*.json`, `users.json` ni tokens.
- No publiques en redes ni grabes videos salvo pedido explícito ("solo preparación" = sin render).
- El servidor usa `uvicorn --reload` con `watchfiles` sobre `src/`, excluyendo `src/templates/`.
  Editar herramientas y motores de producción no debe reiniciar la API ni cortar transcripciones.
  Los cambios Python del backend fuera de esa carpeta sí lo reinician: revisá que no haya
  producciones, previsualizaciones, transcripciones ni grabaciones antes de editarlos. Si cambia una
  herramienta Python importada y cacheada por la API, reiniciá coordinadamente cuando termine el trabajo.

## Miniaturas de componentes en Showcase

Cuando crees o cambies componentes que se muestran en Showcase, comprueba sus
miniaturas y usa `scripts/generate_showcase_posters.py` para prepararlas; no abras
una animación por tarjeta ni actives una cola automática en el servidor. Desde la
raíz de `nexa-brief-server`, con la API y el perfil correctos activos:

```bash
.venv/bin/python scripts/generate_showcase_posters.py --design <id-del-diseño>
```

Antes de capturar, inventaría las miniaturas por ID de diseño, componente y
estilo: reutiliza las existentes y conserva sus bytes al cambiar rutas. Captura
solo las faltantes o inválidas del estilo solicitado con `--estilo <id>`.
Usa `--all-styles` únicamente si el alcance exige todos los estilos implementados.
Las capturas sin estilo explícito no sustituyen las de Original o Dynamic News.
Una verificación técnica o un traslado no inicia capturas.

Sin `--design` procesa los motores `_atlas` y `_mapas`; `--all` permite otros
diseños. Genera WebP 16:9 en la caché del perfil, toma el fotograma central y,
si está vacío, prueba otros instantes. Es secuencial y reanudable: revisa el
resumen de errores y verifica visualmente ejemplos. Opciones y uso en
`scripts/README.md`. La reproducción animada sigue bajo demanda.

## Resultados temporales de validación

- Guardá capturas y comparaciones temporales en `work/results/` del proyecto (ignorado por Git) o en `/tmp/`. No uses `git add -f` para incluirlas.
- Al terminar la revisión, eliminá las capturas generadas que ya no hagan falta. Evitá acumular tandas de antes/después.
- Si un resultado debe conservarse como documentación, guardá un resumen breve fuera de `work/results/` y solo las imágenes necesarias, elegidas explícitamente.

## Perfiles de almacenamiento y sandbox

La raíz seleccionada es `NEXA_PROFILE_DIR`; consulta el valor efectivo del proceso
y el `profile.json` antes de escribir. En v2/v3 un proyecto de prueba va en
`$NEXA_PROFILE_DIR/sandbox/<categoría>/<id>` y una producción en
`$NEXA_PROFILE_DIR/productions/<categoría>/<id>`. La raíz `.env` configura la
selección por defecto; cambiarla requiere reiniciar coordinadamente los servicios
cuando no haya trabajos activos. No uses una ruta fija de otro perfil ni crees
proyectos privados bajo `src/templates/sandbox/`. Conserva y reconcilia copias
divergentes antes de mover, borrar o retirar archivos del índice de Git.


En perfiles de esquema v2/v3, todos los prototipos, pruebas y referencias se
crean en `sandbox/` del perfil activo. Al pasar a producción, una demo principal
validada va a `src/templates/<categoría>/<id>/` del repositorio; un episodio va
a `productions/<categoría>/<id>/` del perfil. `data/` queda reservado para JSON.
`src/templates/sandbox/` solo contiene motores compartidos experimentales,
herramientas y documentación; nunca proyectos históricos o pruebas. La norma
canónica y su aceptación están en `docs/ubicacion-demos-pruebas-episodios.md`. No se deben buscar ni copiar prototipos de otro perfil. Las
herramientas y el punto de entrada `src/templates/sandbox/PROTOTIPO.md` siguen
perteneciendo al código compartido del repositorio. Al ejecutar directamente
`src/templates/_tools/sandbox/info.py` o `delegate.sh` para un perfil v2/v3,
exportá `NEXA_SANDBOX_DIR` con la ruta absoluta al `sandbox/` de ese perfil.

## Estilos y producción nativa por JSON

Para Mapas Satelitales (Documentary/Dynamic) y Atlas en Movimiento, consulta `docs/estilos-produccion.md`.
Descubre estilos con `/api/v1/showcase/designs/<id>/styles` y lee la guía corta `/production-guide?estilo=<id>`.
Consulta solo los contratos de las piezas elegidas con `?estilo=<id>&format=9x16`; no leer motores para
cada video. El creador acepta `estilo` y prepara el contexto privado del estilo elegido.
Mapas: `src/templates/nodeatlas/mapas-satelitales/_mapas/QUICK.md`. Atlas conserva su generador y catálogo.

## Entrega de prototipos para pasar a producción

Excepción NodeMotion (letras y promos): la plantilla nueva sigue el «Estándar vigente para
plantillas NodeMotion nuevas» del AGENTS.md raíz (motor en `src/templates/nodemotion/<cat>/<id>/`,
prototipo en `productions/nodemotion/<cat>/<id>/` del perfil); no pasa por el Sandbox.
Para el resto de categorías, todo agente que cree una plantilla nueva debe seguir
`src/templates/sandbox/PROTOTIPO.md` y el contrato `src/templates/sandbox/PREPARAR-PRODUCCION.md`. Este define la identidad
de demo principal o episodio, archivos, rutas portables, catálogo y reporte de
pendientes. El ejecutor aislado recibe una copia del contrato, sin ampliar permisos.
El flujo técnico sin IA y la preparación editorial posterior están documentados
en `docs/pasar-a-produccion-disenos.md`; prevalecen sobre recetas históricas de traslado
manual o de exigir un paquete editorial para mover.

## Diseños reutilizables y Showcase

### Atlas en Movimiento: motor principal único (obligatorio)

El orquestador entrega JSON y medios; no crea, copia ni bifurca motores dentro de episodios.
La implementación única está en `src/templates/nodeatlas/atlas-en-movimiento/engine/` y la consumen
Showcase y los videos mediante la URL `bundled/nodeatlas/atlas-en-movimiento/engine/plano/plano.js`.
Cada componente nuevo se implementa en ese motor principal, declara parámetros/validación/demo y se
registra en Showcase. Variar tema, país o recorrido requiere datos, no otro componente ni otro generador.
El productor valida esta regla después del agente y antes de aceptar una escena; `tools/build_scene.py`
y `tools/check_episode.py` también la comprueban. Guía completa: `nodeatlas/atlas-en-movimiento/AGENTE.md`.
Una migración conserva los datos y se compara visualmente en ambos formatos antes de cambiar la entrada.

Para el diseño compartido Mapas Satelitales y sus ejemplos aislados, consulta
`docs/mapas-showcase.md`. Los proyectos del perfil usan un solo motor; el informe
técnico del servicio determina su compatibilidad y destino. No uses una nota
histórica de esa guía para omitir o sustituir la verificación vigente.

Los diseños usan un ID estable y el contrato de `/api/v1/showcase/designs` en
prueba y producción. Consulta solo la ficha asignada y
`/api/v1/showcase/designs/<id>/catalog/<entry_id>` para sus parámetros y ejemplo.
La estructura y adopción del legado están en
`docs/estandar-disenos-showcase-2026-11.md`. Promueve mediante el servicio;
no renombres bundles ni muevas sus episodios manualmente. Las definiciones
de v3 están en `src/templates/_tools/design-definitions/<id>/`: no se crean
`designs/` ni `sandbox/designs/` dentro de un perfil v3. Su estado por perfil
vive en `data/json/designs.json` y se modifica mediante el servicio. Las carpetas
del perfil contienen sus propias instrucciones, no copias del motor.
Consulta `docs/profile-layout-v3-2026-11.md` para las rutas vigentes; el documento
anterior de Showcase describe también el almacenamiento heredado v1/v2.

Plantillas → Sandbox lista los proyectos de prueba y abre solamente su video principal.
Las categorías de producción muestran la demo principal registrada desde el
repositorio y episodios de producción; no incorporan demos de Sandbox como fallback.
Los proyectos nuevos aparecen en Showcase solo cuando el usuario activa
«Mostrar componentes en Showcase». No actives todos ni alteres los diseños ya
registrados. La elección es local a cada perfil y pasa por el servicio y el puerto
de datos; no copies motores ni crees `sandbox/designs/`. Contrato y flujo:
`docs/sandbox-showcase-visibility-2026-11.md`.

En v2/v3 usa exclusivamente la factoría de agentes y sus ejecutores aislados
verificados. Las rutas legacy directas conservan sus guardas; no las elimines
para activar un perfil. Consulta `docs/agent-isolation-design.md`.

## Preferencia editorial de modelos

Guiones, diálogos, títulos y descripciones: Codex con `gpt-6.1-terra` y esfuerzo `high` por defecto; Luna (`gpt-6-luna`, máximo soportado por el adaptador CLI) es la alternativa Codex. Claude queda al final por indisponibilidad o cuota de Codex; un texto deficiente se corrige y no justifica cambiar de proveedor. Aplicar `src/skills/models/roles.json`, conservar aislamiento y registrar el modelo realmente usado. No generar voz ni render cuando el pedido sea solo revisar diálogos.

## Pasar demos principales a producción

El flujo de la interfaz y API está en `docs/pasar-a-produccion-disenos.md`.
Una demo principal explícitamente validada se incorpora completa al repositorio
bajo `src/templates/<categoría>/<id>/`, conservando el ID de Showcase y el motor
compartido. La carpeta canónica tiene nombre estable sin fecha. El motor usado
en producción debe tener raíz compartida de producción, conservando `engine_id`
y declarando `engine_root`; mover solo el video o cambiar únicamente la pestaña
de Showcase no satisface esta regla. Es una excepción autorizada para muestras
públicas de diseño; los episodios privados y los videos posteriores quedan en el perfil. No moverla
manualmente ni saltar la validación. Usa «Pasar a producción» en los textos de
producto; `promote` se mantiene únicamente por compatibilidad de API.


## Promos: chat y flujo compartido

Para Editorial, Sports, Dynamic, Kinetic, Trendy, Urban, Breaking, Pulse y Mono, un pedido de plantilla
y tema se inicia desde el chat de la app o con `chat.py create`; ambas entradas
usan la misma API e historial. Sigue [OPERATE.md](src/templates/_tools/nodemotion/promo/production/OPERATE.md), [QUALITY.md](src/templates/_tools/nodemotion/promo/production/QUALITY.md) y [GUIDE.md](src/templates/_tools/nodemotion/promo/production/GUIDE.md) para consultar estado,
enviar correcciones y revisar consumo. La calidad automática es técnica: la
persona revisa fuentes, imágenes, licencias y composición, y solo ella aprueba
la revisión vigente. Aprobar no inicia grabación ni publicación.

Usa los roles de `src/skills/models/roles.json`: Codex `gpt-6.1-terra` high por
defecto y Claude `claude-sonnet-5-5` medium como alternativa seleccionable.
La disponibilidad no demuestra cuota, que es `unknown` si no se informa. El
servicio utiliza los prompts centrales fijados por versión y hash y las
herramientas compartidas; cada video conserva datos, resultados, referencias y
evidencias, sin copiar prompts editables ni motores. No crees otro productor.
El registro incluye uso conocido y deja lo desconocido en `null`.
