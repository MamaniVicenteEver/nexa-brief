# AGENTS.md · nexa-brief-server

Entrada para cualquier agente de IA (Codex, Claude Code…) que trabaje en este servidor.

## Atlas Cinemático (mapas 3D)

Para crear videos con **Atlas Cinemático / nodehistory-atlas**, empieza por
`src/templates/sandbox/nodehistory/_atlas/SKILL.md`. Descubre las entradas con
`produce.mjs catalog` y `example`; trabaja en una carpeta de episodio de producción.
Es distinto del diseño `atlas` 2D del explainer-kit. No leas ni copies el motor para montar un video.

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
- El servidor corre `uvicorn --reload` sobre `src/`: editar cualquier `.py` bajo `src/` (también las
  herramientas del kit) lo reinicia y corta producciones, previsualizaciones y grabaciones en curso.
  Revisá que no haya nada corriendo antes de tocar código.

## Resultados temporales de validación

- Guardá capturas y comparaciones temporales en `work/results/` del proyecto (ignorado por Git) o en `/tmp/`. No uses `git add -f` para incluirlas.
- Al terminar la revisión, eliminá las capturas generadas que ya no hagan falta. Evitá acumular tandas de antes/después.
- Si un resultado debe conservarse como documentación, guardá un resumen breve fuera de `work/results/` y solo las imágenes necesarias, elegidas explícitamente.

## Perfiles de almacenamiento y sandbox

En perfiles de esquema v2/v3, los prototipos y referencias se guardan en `sandbox/`
del perfil activo y se promueven a su `productions/`; `data/` queda reservado
para JSON. No se deben buscar ni copiar prototipos de otro perfil. Las
herramientas y el punto de entrada `src/templates/sandbox/PROTOTIPO.md` siguen
perteneciendo al código compartido del repositorio. Al ejecutar directamente
`src/templates/_tools/sandbox/info.py` o `delegate.sh` para un perfil v2/v3,
exportá `NEXA_SANDBOX_DIR` con la ruta absoluta al `sandbox/` de ese perfil.

## Diseños reutilizables y Showcase

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
