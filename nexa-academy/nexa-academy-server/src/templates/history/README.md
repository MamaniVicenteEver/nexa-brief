# Plantillas de Historia

Esta carpeta contiene las plantillas visuales de Academy para analizar fuentes, ordenar acontecimientos y relacionar causas con consecuencias.

## Plantillas previstas

- `source-inquiry`: observación, preguntas, contexto e interpretación de una fuente.
- `cause-timeline`: línea de tiempo con condiciones, decisiones, respuestas y legado.

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

- Primero se muestra la evidencia y después la interpretación.
- Las fechas, personas, lugares y fuentes deben estar identificados.
- Las transiciones deben respetar el orden temporal y causal.
- El texto principal debe ser breve; los detalles pueden aparecer por capas.
- Toda conclusión debe distinguir entre evidencia observada e inferencia.
- Los colores, tipografías y transiciones se definen en `manifest.json`.

## Variables para el agente

Las plantillas pueden recibir `source_title`, `source_type`, `observation`, `questions`, `context`, `events`, `causes`, `effects` y `caption_segments`.
