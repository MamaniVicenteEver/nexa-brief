# Plantillas de Ciencias

Esta carpeta contiene las plantillas visuales de Academy para formular preguntas, probar hipótesis y explicar relaciones entre elementos de un sistema.

## Plantillas previstas

- `inquiry-lab`: pregunta, predicción, prueba y evidencia.
- `system-map`: entrada, transformación, circulación y resultado de un sistema.

## Estructura de cada plantilla

Cada plantilla debe tener su propia carpeta con:

```text
template-id/
├── index.html
├── styles.css
├── script.js
├── manifest.json
├── prompts/
└── assets/
```

## Reglas iniciales

- La observación debe preceder a la explicación.
- Una hipótesis debe poder comprobarse con una prueba visible.
- Las variables y los resultados deben distinguirse con claridad.
- Los diagramas, flechas e iconos deben explicar relaciones, no decorar.
- La conclusión debe volver a la evidencia observada.
- Los colores, tipografías y transiciones se definen en `manifest.json`.

## Variables para el agente

Las plantillas pueden recibir `question`, `prediction`, `variables`, `test_steps`, `evidence`, `explanation`, `system_nodes` y `caption_segments`.
