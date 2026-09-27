# Catálogo físico de plantillas de Nexa Academy

## Objetivo

Nexa Academy necesita que las plantillas no vivan únicamente dentro del componente React. Cada plantilla debe ser una composición reutilizable que el backend pueda identificar, servir al frontend y entregar al motor HyperFrames.

## Estructura adoptada

```text
nexa-academy-server/src/templates/
├── mathematics/
│   └── academy-...-v1/
│       ├── index.html
│       ├── styles.css
│       ├── script.js
│       └── manifest.json
├── english/
├── history/
├── science/
└── templates.json
```

Cada composición declara una raíz HyperFrames con `data-composition-id`, `data-duration`, resolución 1920×1080 y clips con `data-start`, `data-duration` y `data-track-index`. Las animaciones iniciales usan Web Animations API con duración finita y quedan pausadas para que HyperFrames pueda hacer seek determinista.

## Plantillas publicadas

| Categoría | Plantillas |
|---|---|
| Matemática | Pizarra de resolución, Taller de línea numérica, Mapa del triángulo rectángulo |
| Inglés | Historia para hablar, Mesa de frases |
| Historia | Detectives de fuentes, Mapa de causas y cambios |
| Ciencias | Laboratorio de hipótesis, Mapa de un sistema |

## Fuente de verdad

`nexa-academy-server/src/templates/templates.json` mantiene el manifiesto físico de Academy. Conserva también el bloque histórico `templates` de Nexa Brief para no romper todavía las rutas antiguas.

El adaptador `src/academy/template_catalog.py` combina el manifiesto físico con los metadatos educativos existentes y entrega un catálogo plano de nueve plantillas. La plantilla de Pitágoras queda incorporada al backend, corrigiendo la diferencia que existía entre el frontend y el catálogo anterior.

## API para el frontend

- `GET /api/v1/academy/templates`
- `GET /api/v1/academy/templates?category_id=mathematics`
- `GET /api/v1/academy/templates/{template_id}/files/index.html`
- `GET /api/v1/academy/templates/{template_id}/files/styles.css`
- `GET /api/v1/academy/templates/{template_id}/files/script.js`
- `GET /api/v1/academy/templates/{template_id}/files/manifest.json`
- `GET /api/v1/academy/categories/{category_id}/readme`

El frontend conserva la previsualización interactiva del prototipo y consulta el catálogo del backend para mostrar los archivos HTML, CSS, JS y manifest de la plantilla seleccionada.

## Compatibilidad pendiente

Las carpetas `IMG-*` y `VIDEO-*` siguen en `src/templates` porque pertenecen al flujo heredado de Nexa Brief y todavía son utilizadas por `template_manifest.py`, `niches.py`, el pipeline config-driven y sus pruebas. Cuando ese flujo deje de ser necesario en Academy, se podrán mover a `src/templates/_legacy/nexa-brief/` y retirar sus rutas sin afectar el catálogo nuevo.

## Validación realizada

- Nueve plantillas físicas encontradas y sin archivos declarados faltantes.
- Catálogo HTTP devuelve cuatro categorías y nueve plantillas.
- HTML, CSS, JS y README responden con HTTP 200.
- `tests/unit/test_templates_router.py`: 9 pruebas pasadas.
- Ruff del backend: correcto.
- Biome y TypeScript del frontend: correctos.
