# Orquestación de agentes en Nexa Brief

Para el agente que **dirige** un trabajo (Claude Code, Codex u otro) y para los agentes que reciben una parte. Léelo junto con `CALIDAD.md`. Las particularidades de cada familia (explicativos, promos, Atlas…) están en su skill; esto es lo común a todas.

## 1. Roles

| Rol | Quién | Qué hace | Qué no hace |
|---|---|---|---|
| **Orquestador** | El agente al que el humano le hizo el pedido | Entiende el pedido, decide el plan, hace o supervisa la investigación y el guion, delega lo mecánico, revisa con sus propios ojos y entrega el informe | No delega el criterio editorial ni la revisión final; no declara «listo» sin pasar la puerta de calidad |
| **Trabajador** | Codex, Claude u otro agente que recibe un brief | Ejecuta una parte acotada hasta su entregable, la prueba y escribe su resultado | No cambia el alcance, no deja trabajo «pendiente», no toca lo que el brief excluye |
| **Revisor** | Otro agente distinto del trabajador (o el orquestador) | Busca fallos con desconfianza y los corrige | No aprueba sin mirar capturas y datos |
| **Modelos de servicio** | Los que asigna `models/roles.json` (texto, voz, transcripción, copy) | Tareas concretas dentro del pipeline | — |

**Qué modelo para qué**: la fuente única es `src/skills/models/roles.json` (el backend la lee con `src/adapters/models/hub.py`). Política vigente del usuario: Codex `gpt-6.1-terra` con esfuerzo alto o máximo para investigación, guion, copy y trabajo real; Luna como alternativa según la política y el rol de `roles.json`; Claude solo como respaldo cuando Codex no esté disponible o agote cuota, si la sesión lo permite. Cambiar quién hace un rol = editar `roles.json`, no el código.

## 2. Lo que el orquestador hace siempre él mismo

Es el punto crítico de la calidad y no se delega a ciegas:
1. **Investigación y decisión editorial**: puede pedir búsquedas a un trabajador, pero lee las fuentes clave, decide qué datos entran, verifica la actualidad (CALIDAD §1) y firma el `research.json`.
2. **Guion o texto final**: puede pedir un borrador, pero lo reescribe hasta cumplir CALIDAD §2, línea por línea, escena por escena.
3. **Revisión con ojos**: hojas de contacto, miniaturas y textos de publicación, con las preguntas de CALIDAD §7.
4. **El informe final** al humano (`PLANTILLA-INFORME.md`).

## 3. Cómo partir el trabajo

Los trabajadores rinden mal con encargos enormes: tienden a entregar una «base» y parar (pasó cinco veces seguidas). Por eso:
- **Una tarea = un entregable verificable** (por ejemplo: «medios descargados y registrados, con hoja de contacto», «prototipo creado y preparado en la API»), pensada para 15-40 minutos.
- **Encadena** las tareas: cada una lee el resultado de la anterior. Tras la última, una **revisión adversarial** con otro agente.
- **El brief lleva el contexto ya resuelto**: rutas exactas, IDs, decisiones tomadas, la parte del contrato que necesita, qué está prohibido. El trabajador no debe redescubrir lo que el orquestador ya sabe. Usa `PLANTILLA-BRIEF.md`.
- **Lo editorial va hecho en el brief** (datos, guion, criterios de medios) y lo mecánico se delega (descargar, convertir, montar, crear el borrador, capturar, medir).
- Si un trabajador falla dos veces en lo mismo, el orquestador lee el código o el servicio implicado, encuentra el camino y lo escribe en el siguiente brief (caso real: el borrador del prototipo necesitaba registrar la música recortada y su letra en la biblioteca antes de `POST /drafts`).

## 4. Definición de terminado

Una tarea, y el trabajo entero, solo terminan cuando:
1. el entregable existe y se comprobó de verdad (por la API, en la web, con capturas), no solo «implementado»;
2. pasa la puerta de calidad de `CALIDAD.md §7`;
3. el registro de consumo está completo y el informe escrito.

**Prohibido entregar «base», «pendiente», «a implementar» o «incompleto» sin un bloqueo externo demostrado** (credencial ausente, servicio caído, proveedor sin resultados), con el error exacto. Un fallo propio se corrige, no se informa como límite.

## 5. Registro de consumo e informe

- Cada llamada a un modelo y cada búsqueda o descarga externa se registra en `logs/usage.jsonl` del contenido (proveedor, modelo, rol, paso, tokens de entrada, caché, salida y razonamiento cuando el proveedor los da, segundos, coste si se conoce). Lo desconocido es `null`, nunca 0.
- Los trabajadores Codex informan su total en el bloque final `tokens used` de su registro **cerrado**; se importa al terminar cada tarea.
- El orquestador entrega **siempre** el informe con `PLANTILLA-INFORME.md`, guardado como `INFORME.md` en la carpeta del contenido y resumido en el chat: por pasada (modelo, esfuerzo, qué hizo, minutos, tokens), modelos dentro del pipeline, búsquedas por proveedor, recursos usados con licencia, fuentes de los datos, respuestas de la puerta de calidad y estado.

## 6. Recursos y reutilización

- Medios, música y sonidos: una vez en `resources/<tipo>/<id>/` con `resource.json`, reutilizados por ID (CALIDAD §3).
- Investigación: `research.json` del contenido; un tema repetido parte de la investigación existente y solo añade lo nuevo, con fecha.
- Si un recurso se rechaza (marca, calidad), se marca en su ficha con el motivo y no se borra.

## 7. Límites de seguridad (todas las tareas)

- Sin grabar, publicar, hacer commit ni push salvo pedido explícito del humano.
- Sin leer ni imprimir `.env`, tokens, credenciales ni sesiones; sin tocar `data/canales/` ni datos de otros perfiles.
- Editar `.py` de `src/` fuera de `src/templates/` reinicia la API: antes comprueba que no haya producciones, previews, transcripciones ni grabaciones en curso.
- No cambies el diseño de una plantilla ni sus generadores para un contenido concreto.

## 8. Qué contar al humano

Al terminar: qué se hizo y dónde verlo (enlace o ruta), el informe resumido (tokens, modelos, tiempo), qué decisiones tomó el orquestador y por qué, lo que no se pudo cumplir (al principio, sin maquillar) y qué decisiones le tocan al humano.
