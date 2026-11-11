# AGENTS.md · nexa-brief-server

Entrada para cualquier agente de IA (Codex, Claude Code…) que trabaje en este servidor.

## Atlas Cinemático (mapas 3D)

Para crear videos con **Atlas Cinemático / nodehistory-atlas**, empieza por
`src/templates/sandbox/nodehistory/_atlas/SKILL.md`. Descubre las entradas con
`produce.mjs catalog` y `example`; trabaja en una carpeta de episodio de producción.
Es distinto del diseño `atlas` 2D del explainer-kit. No leas ni copies el motor para montar un video.

## Atlas noticiero (resumen de noticias sobre globo 3D)

Para un video de **resumen de noticias / actualidad** (semanal o del día) con el estilo del demo `resumen-geopolitico-demo`, lee SOLO
`src/templates/sandbox/nodehistory/_atlas/noticiero/AGENTE.md`: voz, estilo del diálogo, estilo visual `original` y piezas están fijos; el video es solo datos.
Herramientas: `noticiero/tools/{nuevo,medios,voz,check}.py`. No leas ni copies el motor.

## Si te piden un VIDEO explicativo (NodeTech, NodeHistory, NodeEconomy…)

**Con un diseño que ya existe (el caso normal): `src/skills/explainer/produce/SKILL.md` y nada más.**
Es la vía rápida: carpeta de producción, qué leer (la hoja `src/templates/_tools/explainer-kit/designs/<diseño>/QUICK.md`, no el catálogo
ni el motor), comandos exactos y presupuesto de tokens. No se trabaja en `sandbox/`.

Solo para un diseño o plantilla NUEVA, una réplica de un video de referencia o tocar el motor (caro):
1. `src/templates/_tools/explainer-kit/guides/orquestacion.md`: quién hace qué y qué delegar.
2. `src/templates/_tools/explainer-kit/AGENTS.md`: el pipeline de 10 pasos completo.
3. `src/templates/sandbox/<categoría>/AGENTS.md`: lo aprendido en la casa de pruebas.

Qué modelo hace cada rol: `src/skills/models/roles.json` (el backend lo lee con `src/adapters/models/hub.py`).

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

Si el diseño declara estilos, prepara también cada estilo afectado con
`--estilo <id>` o todos con `--all-styles`. Las capturas sin estilo explícito no
sustituyen las capturas de estilos como Original o Dynamic News.

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


En perfiles de esquema v2/v3, los prototipos y referencias se guardan en `sandbox/`
del perfil activo y se promueven a su `productions/`; `data/` queda reservado
para JSON. No se deben buscar ni copiar prototipos de otro perfil. Las
herramientas y el punto de entrada `src/templates/sandbox/PROTOTIPO.md` siguen
perteneciendo al código compartido del repositorio. Al ejecutar directamente
`src/templates/_tools/sandbox/info.py` o `delegate.sh` para un perfil v2/v3,
exportá `NEXA_SANDBOX_DIR` con la ruta absoluta al `sandbox/` de ese perfil.

## Estilos y producción nativa por JSON

Para Mapas Satelitales (Documentary/Dynamic) y Atlas en Movimiento, consulta `docs/estilos-produccion.md`.
Descubre estilos con `/api/v1/showcase/designs/<id>/styles` y lee la guía corta `/production-guide?estilo=<id>`.
Consulta solo los contratos de las piezas elegidas con `?estilo=<id>&format=9x16`; no leer motores para
cada video. El creador acepta `estilo` y prepara el contexto privado del estilo elegido.
Mapas: `src/templates/sandbox/nodehistory/_mapas/QUICK.md`. Atlas conserva su generador y catálogo.

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
`docs/mapas-showcase.md`: los proyectos del perfil usan un solo motor y no se
promueven hasta resolver su integración de producción.

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

Plantillas → Sandbox lista todos los proyectos y abre solamente su video principal.
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
compartido. Es una excepción autorizada para muestras públicas de diseño; los
episodios privados y los videos posteriores quedan en el perfil. No moverla
manualmente ni saltar la validación. Usa «Pasar a producción» en los textos de
producto; `promote` se mantiene únicamente por compatibilidad de API.
