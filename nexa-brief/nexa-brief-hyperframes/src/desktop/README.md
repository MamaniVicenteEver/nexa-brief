# HyperFrames — POC desktop 16:9 (segunda composición)

Segunda prueba de concepto, complementaria a [`../movil/`](../movil/) (vertical 1080×1920,
estilo "news brief"). Esta usa **formato horizontal 1920×1080**, un **diseño distinto y más dinámico**
(transición con rebote elástico, contador numérico animado, barras de estadísticas), **15 segundos**, probada
en **local y en AWS Lambda, ambas a 30fps**. Todo lo documentado acá es resultado de comandos reales
ejecutados el 19/08/2026 — cero cifras inventadas.

Este proyecto vive dentro de `nexa-hyperframes/`, junto a su hermano `src/movil/` — ver el
[README raíz](../../README.md) para el mapa completo. Comparte con `movil/` la infraestructura de AWS
(`../../aws/`) y las credenciales (`../../.env`).

## Estructura

Misma arquitectura `core/ + components/ + index.js` que se adoptó en el POC vertical:

```
nexa-hyperframes/
├── .env                            # credenciales AWS compartidas
├── aws/                             # policy IAM, guía de deploy — compartidos
├── src/
│   ├── movil/                       # composición vertical hermana — ver src/movil/README.md
│   ├── desktop/                     # ESTE proyecto
│   │   ├── index.html                 # composición raíz, 1920×1080, 15s, 30fps
│   │   ├── core/config.js              # configuración central
│   │   ├── components/                  # 7 plantillas nuevas y distintas a las del POC vertical
│   │   │   ├── brand-mark.js             #   marca deslizándose desde arriba
│   │   │   ├── kinetic-text.js           #   texto con entrada slide-up + scale (más dinámico que un fade)
│   │   │   ├── counter-stat.js           #   contador numérico con escala creciente ("counting-dynamic-scale")
│   │   │   ├── elastic-push.js           #   transición: paneles que se empujan con rebote elástico
│   │   │   ├── growth-bars.js            #   barras de stat que crecen con stagger (scaleY, nunca height)
│   │   │   ├── cta-pulse.js              #   CTA con rebote de entrada + pulso en loop
│   │   │   └── flash-outro.js            #   destello + fundido a negro de cierre
│   │   └── index.js                      # orquestador
│   └── shared/                       # ver src/shared/README.md
└── out/desktop/
    ├── 30fps/
    │   ├── render-local.mp4           # render local real
    │   ├── snapshots/                 # contact-sheet + PNGs de verificación visual
    │   ├── lambda-render.log.txt
    │   └── render-lambda.mp4          # render real en AWS Lambda
    └── 60fps/                         # reservado — no se corrió todavía
```

Las plantillas de motion siguen las skills oficiales de HyperFrames (`hyperframes-animation`): transición
"elastic push" (catálogo `transitions/css-push.md`), contador `counting-dynamic-scale.md` y barras
`stat-bars-and-fills.md` — todas transform-only (`x`, `scale`, `scaleY`), nunca `width`/`height`/`top`/`left`
para movimiento espacial, como exige el contrato de `hyperframes-core`.

`npm run check`: **0 errores, 0 warnings, 28/28 checks de contraste WCAG AA.**

## Resultados reales

| Render | Resolución | FPS | Duración | Frames | Tiempo | Costo |
|---|---|---|---|---|---|---|
| **Local** (`--workers 4`) | 1920×1080 | 30 | 15.0s (confirmado con ffprobe) | 450/450 | **21.5s** de render interno | $0 |
| **AWS Lambda** (stack `hyperframes-poc`, memoria 2048MB) | 1920×1080 | 30 | 15.0s (confirmado con ffprobe) | 450/450 | 5:47 de wall-clock (mayormente reintentos por la cuota baja de concurrencia de la cuenta, no cómputo real) | **$0.0141** |

Ambos archivos están en `../../out/desktop/30fps/` y fueron verificados con `ffprobe` (duración, resolución y
fps exactos) y con `hyperframes snapshot` (verificación visual — ver
`../../out/desktop/30fps/snapshots/contact-sheet.jpg`).

### Nota sobre el render en Lambda

Se reutilizó el **mismo stack de AWS ya desplegado** desde `src/movil/` (`hyperframes-render` Lambda +
Step Functions) — no hizo falta un segundo `lambda deploy`, cada proyecto es un "site" distinto que se sube
al mismo motor de render. Esto confirma que, una vez desplegada la infraestructura una sola vez, cualquier
composición nueva del equipo puede renderizarse en Lambda sin costo ni trabajo de deploy adicional.

Dos ajustes necesarios para que funcionara desde este segundo proyecto (documentados por si se repite):
1. Instalar **tanto** `hyperframes` como `@hyperframes/aws-lambda` como devDependencies locales — el `import()`
   dinámico que hace el CLI para el SDK de AWS resuelve desde el mismo árbol de `node_modules`, así que
   ambos paquetes tienen que convivir ahí (no alcanza con `npx hyperframes@0.8.2` suelto).
2. Copiar el archivo de estado del stack (`.hyperframes/lambda-stack-hyperframes-poc.json`) desde
   `src/movil/` a este proyecto — cada proyecto busca ese archivo en su propia carpeta `.hyperframes/`.

## Comparación con la versión vertical

| | Vertical (`../movil/`) | Desktop (este POC) |
|---|---|---|
| Resolución | 1080×1920 | 1920×1080 |
| Duración | 15s / 30s (dos variantes probadas) | 15s |
| Estética | "News brief" — gradientes fríos, wipe de color | "Tech/stats" — contador animado, barras, transición con rebote |
| Transición | Wipe de color (`scaleX`) | Elastic push (`x` con rebote) |
| Render local 15s | 11.3–17.8s según config | 21.5s (4 workers) |
| Render Lambda | $0.0083 (30fps) / $0.0123 (60fps) | $0.0141 (30fps) |

Ambos formatos renderizan sin problema en la misma infraestructura (local y Lambda), reutilizando el patrón
`core/components/index.js` — confirma que ese patrón de organización escala a diseños y resoluciones
distintas sin reescribir el motor de render ni la infraestructura de AWS.
