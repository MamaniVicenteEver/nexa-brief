# Plantillas de Matemática

Esta carpeta contiene las plantillas visuales de Academy para explicar conceptos matemáticos mediante demostraciones guiadas.

## Plantillas previstas

- `chalkboard-solve`: pizarra de resolución paso a paso.
- `number-line-workshop`: cantidades, grupos y saltos sobre una línea numérica.
- `pythagoras-triangle`: explicación visual del triángulo rectángulo y la hipotenusa.

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

- La clase debe construir el razonamiento de forma visible y ordenada.
- Las fórmulas deben usar KaTeX, MathML o SVG local.
- El contenido debe separar teoría, ejemplo, comprobación y práctica.
- La operación actual debe quedar resaltada sin ocultar el contexto.
- Los subtítulos y el contenido visual deben compartir la misma línea de tiempo.
- Los colores, tipografías y transiciones se definen en `manifest.json`.

## Variables para el agente

Las plantillas pueden recibir `problem_statement`, `operation_tex`, `steps`, `reasoning`, `inverse_check`, `practice_prompt` y `caption_segments`.
