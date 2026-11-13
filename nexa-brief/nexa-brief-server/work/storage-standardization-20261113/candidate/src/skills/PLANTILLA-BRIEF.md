# Plantilla de brief para delegar una tarea

Copia esta estructura al delegar en Codex, Claude u otro agente. Un buen brief permite que el trabajador termine sin redescubrir nada. Ver `ORQUESTACION.md §3`.

```markdown
# <id-tarea>: <entregable en una frase> (<modelo> <esfuerzo>)

Rutas: repo `R=…`, servidor `S=$R/nexa-brief-server`, perfil `PF=…`, contenido `P=…`.
Lee antes: `src/skills/CALIDAD.md` (manda sobre todo) y, de la skill, solo <secciones concretas>.
Contexto ya resuelto: <decisiones tomadas, IDs existentes, resultado de la tarea anterior (`RESULT-….md`)>.
No repitas: <lo que ya está hecho>.

## Entregable
1. <paso concreto con comando o endpoint exacto>
2. <…>
Comprobación: <cómo se demuestra que está hecho: respuesta de la API, captura, test, comando>.

## Insumos editoriales (no los reescribas)
<datos, guion, criterios de medios, textos de marca ya decididos por el orquestador; o la ruta a sus JSON>

## Prohibido en esta tarea
<grabar, publicar, commit, tocar X, borrar Y, cambiar el diseño…> y los límites de `ORQUESTACION.md §7`.

## Terminado significa
El entregable comprobado, la puerta de calidad de `CALIDAD.md §7` respondida si aplica, el consumo registrado en `logs/usage.jsonl`. Nada de «base» o «pendiente» salvo bloqueo externo demostrado con el error exacto.

## Informe
`RESULT-<id-tarea>.md`: AL INICIO lo que no se cumplió; luego lo hecho con rutas e IDs, la comprobación, los tests y el consumo.
```

Consejos:
- Una tarea, un entregable, 15-40 minutos de trabajo. Encadena varias en lugar de un brief gigante.
- Pon dentro del brief todo lo que el orquestador ya averiguó (rutas, funciones, endpoints, IDs): es lo que más ahorra tokens.
- Tras la última tarea de una cadena, lanza una revisión adversarial con otro agente.
