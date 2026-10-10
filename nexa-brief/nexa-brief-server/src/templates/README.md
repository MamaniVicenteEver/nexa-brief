# Catálogo de plantillas

> **Antes de crear o modificar una plantilla, leé [AGENTS.md](AGENTS.md)**: estructura
> obligatoria, contrato con el pipeline, reglas para HyperFrames, herramientas de
> `_tools/` y el checklist de validación.

`templates.json` es la fuente de verdad del catálogo público. Define el
identificador lógico estable, la categoría, el nombre visible, las rutas del
template, los tags y los assets runtime que deben copiarse a un job.

El comportamiento ejecutable vive en `niches.json`: cada template activo tiene
un `template.template_id` que debe coincidir con una entrada de
`templates.json`. La API expone ambos conceptos desacoplados y agrega la
metadata de categoría para Plantillas, Crear video y Programación.

Estructura física:

```text
templates/
├── templates.json
├── lyrics/<template-id>/
├── commercial/<template-id>/
├── image/<template-id>/
├── video/<template-id>/
└── _tools/<family>/
```

Cada plantilla ejecutable debe tener, como mínimo:

```text
<category>/<template-id>/
├── index.html
└── assets/
    └── config.json
```

Para assets locales que el HTML necesita durante un render, se declaran rutas
relativas en `runtime_assets`. El generador las copia al output del job; no se
deben hardcodear rutas absolutas ni depender de la carpeta fuente en runtime.

Para agregar una plantilla:

1. Crear su carpeta dentro de la categoría correspondiente.
2. Registrar la entrada en `templates.json`.
3. Registrar un niche activo en `niches.json` con el mismo `template_id`.
4. Elegir `static_config: true` si se reutiliza el `assets/config.json` curado;
   en caso contrario, agregar `prompts/config_mapper.md`.
5. Verificar `GET /api/v1/templates`, `GET /api/v1/templates/categories` y
   `GET /api/v1/niches`.
