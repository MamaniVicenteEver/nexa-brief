> PLANTILLA de brief (paso 1–3 de AGENTE.md). Copiar a `~/codex/nexa-brief/BRIEF-<ID>-guion.md`, sustituir `<ID>`, `<EP>`, `<FECHA>`, `<PERIODO>`, `<N>` y lanzar:
> `EXTRA_ROOT=<EP> ~/codex/nexa-brief/run-model.sh gpt-6.1-terra high <ID>-guion nodepolitics/<ID>` (añadir la tarea a budgets.txt). Si Codex no está disponible: `claude-haiku-5-5` (roles.json),
> nunca una versión reducida. El líder revisa la salida a ojo antes de seguir.

# Tarea <ID>-guion · investigación + guion + plan visual + lista de medios (Codex Terra 6.1, esfuerzo alto)

Episodio: `EP=<EP>` (tienes permiso de escritura SOLO en `$EP`; no toques nada más). Sin voz, sin render, sin MP4, sin commit, sin publicar.
Servidor del repo: `S=/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server`; plantilla: `N=$S/src/templates/sandbox/nodehistory/_atlas/noticiero`.

## Problema
Hay que preparar el **resumen de noticias del <PERIODO> que termina el <FECHA>** (hoy es <FECHA>) con el estilo fijo del noticiero:
8–12 noticias (diario: 6–9), 400–520 palabras, voz de locutor (Charon, tono aceleración, ≈180 palabras por minuto). Todo hecho, cifra, nombre y cargo
debe salir de fuentes verificadas de la ventana, **no** del demo `resumen-geopolitico-demo` (sus datos son de otra semana y no están verificados).

## Lee, en este orden (y no más)
1. `$N/AGENTE.md` (§0 fijo, §1 pedido, §5 referencia mínima), `$N/GUION.md`, `$N/INVESTIGACION.md`, `$N/MENU.md`.
2. El demo como modelo de calidad y de formato: `$N/plantilla/ejemplo-demo/script.demo.json` y `build_scene.demo.py` (solo el patrón; no copies sus noticias).
3. `$EP/PLAN.md` (pedido). No leas `hud.js`, `atlas.js` ni el motor.

## Entregables (todo dentro de `$EP`)
1. `work/research/noticias.md`: 12–20 candidatas con puntaje, las elegidas en orden y las descartadas con motivo.
2. `work/research/HECHOS.md` + `research.json`: el ledger de `INVESTIGACION.md` §2. Cifra = ≥ 2 fuentes o una oficial; cargo vigente verificado en la fecha; atribución; lo provisional marcado.
3. `assets/script.json`: formato de `GUION.md` §4 (`tone:"aceleración"`, `intensity:0.5`, `voice:"Charon"`, `claim_ids`, `plan`). Apertura fija, noticias de mayor a menor peso, «Y para finalizar, aquí van otros titulares.»
   y 2–3 breves al final, sin despedida ni preguntas. Cifras en dígitos. Segmentos ≤ 70 palabras. 400–520 palabras en total.
4. `work/plan-visual.md`: por segmento, las piezas de `MENU.md` (recetas de §2), con el ancla de entrada/salida como palabra del propio segmento, y la cámara de cada noticia.
5. `work/medios-necesarios.json`: formato de `INVESTIGACION.md` §3 (retratos de cada persona nombrada con cargo, fotos de los lugares clave, banderas, logos si la empresa es el sujeto).
   Para cada una busca con `python3 $N/tools/medios.py --buscar "<consulta>"` y apunta el título exacto de Commons (el más reciente y frontal). No descargues: lo hace el líder.
6. `work/results/<ID>-guion.md`: informe.

## Validación (obligatoria)
- `python3 $N/tools/check.py $EP --tarde` hasta **0 errores** (solo valida el guion; avisos: explícalos).
- Lee el guion en voz alta (mentalmente) y cuenta palabras; ajusta.

## Informe
AL INICIO lo que no pudiste cumplir o verificar (cifras con una sola fuente, personas sin foto libre, datos que cambiaron durante la ventana, partes del plan que el menú no cubre).
Luego: noticias elegidas y orden, número de palabras y duración estimada (palabras / 180 min), qué modelo usaste, y la salida del `check`.
Si no puedes cumplir algo (sin acceso a la web, sin fuentes), dilo al inicio y detente: no rellenes con datos del demo ni inventes cifras.
