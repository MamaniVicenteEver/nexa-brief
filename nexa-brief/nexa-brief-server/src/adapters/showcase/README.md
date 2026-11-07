# Showcase y definiciones compartidas

En v1 y v2 el adaptador conserva sus rutas y bundles históricos. En v3 los contratos versionados viven en `src/templates/_tools/design-definitions/<id>/design.json` y `catalog.json`; los motores siguen en sus ubicaciones existentes. Los contratos no incluyen registros de episodios: las relaciones se resuelven a partir de producciones del perfil activo.

El estado local v3 usa la colección `showcase_designs`, en `data/json/designs.json`, con ID, estado, referencia de definición y revisión. La promoción modifica esa colección bajo coordinación del perfil; no mueve ni edita los contratos o motores compartidos. Una revisión que ya no coincide produce un conflicto hasta que se reconcilie explícitamente.

`python scripts/export-showcase-definitions.py` compara las definiciones con los catálogos públicos del repositorio; `--write` regenera los contratos versionados. `python scripts/reconcile-showcase-definitions.py --profile-dir /ruta/absoluta` muestra un plan de estados v3 e informa IDs desconocidos; `--apply` escribe los registros y conserva el índice anterior. El comando no borra ni mueve bundles. La migración de un perfil debe verificar los bundles personalizados antes de retirar archivos antiguos; la conversión pura de estados bloquea IDs desconocidos y duplicados.
