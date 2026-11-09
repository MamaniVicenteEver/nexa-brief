# GUION · cómo se genera el diálogo de un video de Atlas en Movimiento

> Vale para cualquier tema (guerra, suceso histórico, política, economía). Aquí no hay tema: hay un método.
> Lo lee quien escribe el guion (Codex `script`, Haiku 5.5 de respaldo, o el líder) y quien lo revisa.

## 1. Quién se encarga del diálogo y de qué fuentes sale

| pieza | quién / dónde |
|---|---|
| **la estrategia narrativa** (arco, actos, golpe, retención, pregunta final) | datos en `src/skills/explainer/strategies/narrative/<id>.json`. Por defecto `narrative_amarillista_v1` (default de todas las categorías en `_active.json`); alternativa sobria: `narrative_documental_v1`. Módulo: `src/core/explainer/narrative/` (README) |
| **quién escribe el guion** | rol `script` de `roles.json` (Codex; respaldo Haiku 5.5). Borradores de texto: `text_draft`; voces de personajes: `dialogue_draft` |
| **reglas de estilo del guion** | `src/templates/_tools/explainer-kit/guides/storytelling.md` §4–7 y el bloque `narrativa` del brief |
| **la categoría** (tono, hashtags, reglas de título) | `src/skills/explainer/categories/node_atlas.json` (y `node_history|node_politics|node_tech.json` si aplica) |
| **verificación** | `fact_check` (DeepSeek) contra el ledger; `kit.py check` valida la forma y `narrative_check.py` el orden de actos |
| **revisión final** | el líder, leyendo en voz alta antes de generar la voz |

Elegir estrategia: `assets/config.json → narrative_id`. Sin dato del usuario: política, guerra reciente o
sucesos controvertidos → `narrative_documental_v1`, o la amarillista con nivel de título **medio** y la
variante de arco (`arc_variant`) que la estrategia ofrezca para causas encadenadas o mitos; temas de impacto y curiosidad → amarillista, nivel alto, con los
límites de verdad de la estrategia (título verdadero, datos verificables, sin causalidad inventada).

## 2. Antes de escribir: el ángulo (todo en `work/briefs/angulo.md`)

1. **Pregunta central** del video, en una frase que un desconocido entienda ("¿Cuándo empezó realmente?").
2. **Nivel y emoción**: nivel de título, emoción dominante y secundaria.
3. **Arco** (`arc_variant`) y **golpe** (3 candidatos; elegir el que se prueba con datos).
4. **Personas** (3–6): quién decide, quién sufre, quién narra el hecho. Un video sin personas es un informe.
5. **Escenas**: 8–14 momentos concretos con lugar, fecha y algo que se vea (una columna, un documento, una votación,
   una explosión, una firma). El relato se cuenta de escena en escena, no de dato en dato.
6. **Pregunta final** que el espectador pueda contestar en comentarios.

## 3. Cómo suena un buen guion (criterios, con contraejemplo)

- **Abre con una escena o una contradicción, no con una definición.** Mal: "La guerra empezó antes de que el
  mundo mirara." Mejor: "Son las cuatro de la madrugada. Un presidente graba un mensaje en su teléfono. Lo que
  va a decir lo cambia todo… pero esa no fue la primera vez que se tocó esta frontera."
- **Frases ≤ 28 palabras, ritmo variado**: una frase corta cada 2–3 largas. Una cifra clave por tramo.
- **Cada segmento hace una cosa**: mueve el relato (pasa algo), explica (por qué) o abre una duda. Si solo
  informa, se funde con otro o se corta.
- **Microbucles**: cada 60–90 s se resuelve una duda y se abre otra ("lo que firmaron ese día importa por lo que
  *no* decía").
- **Personas con nombre y cargo en el momento de decidir**, no en una lista.
- **Concreto antes que abstracto**: "tres columnas blindadas cruzaron el río", no "se produjeron movimientos".
- **Sin muletillas de IA** ("es importante señalar", "en conclusión"), sin descargos repetidos. La cautela va en
  *una* frase donde el dato es disputado, y en el rótulo en pantalla ("cifra discutida").
- **Una idea de imagen por frase**: si no puedes imaginar qué se ve mientras se dice, reescribe la frase.
- **Cierre**: vuelve a la escena de apertura con un significado nuevo y termina con la pregunta.

## 4. Longitud y estructura

7–8 min ≈ 1.000–1.150 palabras (130 ppm) ≈ 32–38 segmentos de 25–40 palabras. Reparte los actos según los
pesos de la estrategia (`weight`: apertura, primer_tramo, corto, medio, mayor_parte, cierre). Sin segundos fijos:
los tiempos salen de la voz.

## 5. Formato de `assets/script.json` (con plan visual obligatorio)

Cada segmento:

```jsonc
{ "id": "s14", "act": "...", "tone": "tenso", "intensity": 0.8,
  "text": "Frases para ser dichas. Números como se leen: «dos mil catorce».",
  "claim_ids": ["U12","U13"],            // hechos del ledger que usa (todo dato visible sale de ahí)
  "loop": "abre|cierra|ninguno",         // microbucle
  "plan": {                               // QUÉ SE VE mientras se dice (MENU-VISUAL.md)
    "texto":      {"fecha": "...", "lugar": "...", "titular": "...", "nota": "...", "year": "..."},
    "camara":     {"center": [lon,lat], "zoom": 6.5},
    "componentes":[ {"tipo": "army.advance", "offset": 1.0, "dur": 8, "...": "parámetros de la pieza"} ],
    "medios":     [ {"tipo": "document.clip", "src": "assets/media/...", "caption": "...", "source": "...", "credit": "..."} ] } }
```

Reglas del plan:
- **Todo segmento lleva al menos una pieza no textual** (unidad, flecha, territorio, efecto, imagen, documento, retrato, cifra).
- **Al menos 1 de cada 3 segmentos lleva imagen/documento/retrato** si el video dura más de 5 min; si no hay archivo
  libre del hecho, usa un mapa histórico, un documento ilustrativo marcado como tal o una ficha de la persona.
- **Nunca pongas un dato visible que no esté en `claim_ids`.** Una posición aproximada se rotula como tal.
- Los medios se listan en `assets/media/credits.json` con URL de origen, licencia y autor; el plan solo
  referencia archivos que ya existen (paso 5 del proceso).
- Para un hecho sin pieza obvia, mira `MENU-VISUAL.md §2` (traducción de hechos abstractos a imagen).

## 6. Revisión del guion antes de la voz (el líder)

1. Lee en voz alta: ¿suena a persona o a informe? Si es informe, reescribe los tramos planos.
2. ¿Cada segmento tiene plan con pieza no textual? ¿Hay tramos largos (≈ 20 s, 2 segmentos seguidos) sin
   imagen ni movimiento? Se cuenta a mano aquí; la comprobación automática es `cobertura-audit.mjs` (paso 9).
3. `fact_check` contra el ledger; corregir lo grave.
4. Cifras, fechas y nombres con la ortografía que el TTS leerá bien; deletrear siglas difíciles.
5. Duración estimada = palabras / 130 (min); ajustar al pedido.

## 7. Plantilla de encargo para el agente que escribe el guion

```
Rol: guionista (script). Lee GUION.md y AGENTE.md de la plantilla atlas-en-movimiento.
Tema: <tema>  · Duración: <N> min · Estrategia: <narrative_id> · Nivel de título: <nivel>
Entregables: angulo.md (§2), assets/script.json (§5) con plan visual por segmento (MENU-VISUAL.md),
lista de medios necesarios con dónde conseguirlos, y resultado en work/results/<id>-guion.md.
Reglas: un video se cuenta con escenas y personas; cero datos fuera del ledger; ≥ 1 pieza no textual por
segmento; sin descargos repetidos; lee el guion en voz alta antes de entregar.
Si esto no puede cumplirse (sin cuota, sin fuentes), dilo al inicio de tu respuesta y detente.
```
