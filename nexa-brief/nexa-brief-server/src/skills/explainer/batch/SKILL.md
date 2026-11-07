---
name: nexa-content-batch
description: Prepara o agenda varios videos de Nexa Brief desde un chat, con categorías, diseños y duraciones independientes. Usa la cola persistente del servidor; deja los resultados en Preparación y los pedidos visibles en Programación.
---

# Preparación por lotes

Ejecuta en alfred-server, desde el directorio nexa-brief-server. Lee las instrucciones AGENTS.md del servidor. Para crear contenido con diseños existentes, el productor aplica ../produce/SKILL.md. Este flujo administra pedidos; no escribe guiones directamente ni crea otra cola por fuera del backend.

Convierte la petición en una lista JSON. Cada elemento admite category_path, design, topic, description, agent, minutes, narrative_id y title_level. Descubre las categorías/diseños existentes con los módulos core; no inventes IDs. El tema, estilo y categoría pueden variar entre elementos. Nunca pases auto_record ni datos de publicación: este flujo es solo preparación.

Ejemplo:
```json
[{"category_path":"node_tech","design":"rough","topic":"Cómo nació el código de barras","minutes":5},
 {"category_path":"node_history","design":"binary","topic":"El primer cable telegráfico transatlántico","minutes":5}]
```

Comandos desde el servidor:
```sh
.venv/bin/python -m src.core.explainer.batch_cli configure --parallel 2
.venv/bin/python -m src.core.explainer.batch_cli submit --file /ruta/pedido.json --parallel 2 --request-id identificador-estable-del-pedido
.venv/bin/python -m src.core.explainer.batch_cli status ID_LOTE
```

- El límite global empieza en 1 y admite 1–5. El límite por lote también empieza en 1 y nunca supera el global. Si el usuario solicita cuatro a la vez, configura explícitamente 4 y envía --parallel 4. Reducir el límite no corta los agentes que ya trabajan: se aplica al liberar turnos.
- Para programar añade `--at '2026-11-03T03:00' --timezone America/La_Paz`. Usa la fecha pedida por el usuario; no reutilices la del ejemplo. Si no hay zona explícita, usa America/La_Paz. El sistema guarda UTC y conserva la zona para mostrar el pedido. No confundas generación con los horarios de publicación.
- Conserva el mismo --request-id al reintentar el mismo pedido. Informa el batch_id, production_id, video_id y plan_item_id devueltos.
- submit solo guarda: el worker del servidor ejecuta incluso cuando se cierra el chat. Verifica `systemctl --user is-active nexa-content-worker` y consulta status. La API cede al worker independiente cuando está activo y sirve de respaldo; los leases evitan duplicados.
- Para retomar fallos después de corregir la causa: `.venv/bin/python -m src.core.explainer.batch_cli resume ID_LOTE`. Conserva IDs, historial y presupuesto del productor.
- Si el contenido ya existe y solo se corrigió su compatibilidad o validación, `batch_cli validate ID_LOTE` ejecuta las comprobaciones estrictas sin llamar al agente ni volver a generar voz. Rechaza audio que no corresponda al guion y storyboards vacíos; en esos casos usa Retomar.
- En este servidor los agentes comparten un turno para herramientas pesadas y esperan memoria suficiente. Concurrencia 5 es un techo de admisión, no una garantía de que cinco transcripciones puedan ejecutarse simultáneamente. No subas los límites de memoria ni los presupuestos del productor para ocultar un fallo.
- Los pedidos aparecen en /programacion, en el plan guardado; los videos terminados aparecen en Preparación. Un fallo queda visible y se retoma explícitamente, no se repite sin límite.
- Para pruebas autorizadas de 1–2 min usa short_test=true; es un perfil de validación, no cambia el mínimo habitual. Comprueba duración real del audio.
- No grabes, publiques ni borres resultados por inferencia. Para limpiar después de la aprobación del usuario: `batch_cli delete ID_LOTE --files`. Revisa primero que los IDs coincidan con los de la prueba. Conserva las métricas mientras el usuario las revisa.

Para una recurrencia nocturna, guarda cada ocurrencia con fecha explícita por ahora. No instales cron ni una automatización de Codex que duplique la cola; la configuración de recurrencias de la interfaz se ampliará por separado.
