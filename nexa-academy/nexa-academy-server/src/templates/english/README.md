# Plantillas de Inglés

Esta carpeta contiene las plantillas visuales de Academy para enseñar inglés mediante situaciones, frases, pronunciación y práctica guiada.

## Plantillas previstas

- `story-journey`: conversación dentro de una situación cotidiana.
- `phrase-builder`: construcción progresiva de una oración.

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

- La situación comunicativa aparece antes que la explicación gramatical.
- Cada diálogo debe diferenciar claramente a la persona A y a la persona B.
- La frase hablada, la pronunciación y los subtítulos deben sincronizarse.
- La traducción y las notas deben apoyar la lectura sin saturar la pantalla.
- El cierre debe dejar una frase reutilizable para que el estudiante practique.
- Los colores, tipografías y transiciones se definen en `manifest.json`.

## Variables para el agente

Las plantillas pueden recibir `situation`, `characters`, `target_phrase`, `translation`, `usage_note`, `student_response` y `caption_segments`.
