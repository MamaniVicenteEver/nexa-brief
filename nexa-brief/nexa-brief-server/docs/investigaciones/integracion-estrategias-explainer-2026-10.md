# Integración de las estrategias de publicación en la producción de videos explainer

**Fecha:** 2026-10-12 · **Estado:** estudio y plan. No hay cambios de código.
**Aplica a:** NodeTech, NodeHistory, NodePolitics y NodeEconomy (motor explainer-kit). **NodeMotion no cambia.**
**Se apoya en:** `titulos-gancho-categorias-node-2026-10.md` (cómo escribir títulos que enganchan) y `paquete-publicacion-node-2026-10.md` + `.json` (miniatura, títulos por plataforma, descripción, agradecimiento, tags).

---

## Resumen

1. **Sí es posible, y hay un modelo probado dentro del mismo sistema.** NodeMotion ya maneja sus textos con **estrategias en archivos JSON**: `src/skills/output/copy/`. Un `active.json` elige la estrategia de cada plataforma, las estrategias se versionan (`_v1`, `_v2`) y el prompt de la IA se arma solo a partir de esos archivos. **Cambiar de estrategia es editar un nombre, sin tocar código ni reiniciar.** La propuesta es usar el mismo diseño para las categorías explainer.
2. **Hoy las reglas de los estudios no llegan a la IA.** Las reglas de título están escritas a mano dentro de `briefs.py` y contradicen los estudios (máximo 70 caracteres, miniatura de "3 o 4 palabras"). Los ejemplos de `niches.json` incluyen dos datos falsos, y la miniatura es un cuadro capturado del video.
3. **El cambio de fondo es repartir el trabajo.** La IA escribe *piezas* (3 títulos con su estrategia, frases de miniatura, gancho, reflexión, pregunta). El **código** arma la descripción por bloques, rota el agradecimiento, calcula los capítulos, pone fuentes y créditos, y **valida todo** contra las reglas de los archivos de estrategia.
4. **Los textos se escriben después del guion, no antes.** Hoy `publish.json` se escribe desde el brief, antes de que exista el guion. Por eso un título puede prometer algo que el video no cuenta (pasó con el Titanic).
5. **Plan en 7 fases**, cada una con pruebas. Las dos primeras no cambian ningún comportamiento: crean los archivos de estrategia y un validador que ya se puede correr sobre los 7 videos listos.

---

## 1. Cómo se maneja hoy

### 1.1 NodeMotion (el modelo a seguir)

```
src/skills/output/copy/
├── active.json            ← { "youtube": "yt_theme_question_v2", "tiktok": "…", "facebook": "…" }
├── voice.md               ← tono común
├── README.md              ← cómo crear o cambiar una estrategia
└── strategies/<id>.json   ← fields (piezas que escribe la IA, con instrucción, límites, ejemplos y "evitar"),
                              rotating (frases que rotan), output (plantillas que arman el texto final)
```

- `src/core/metadata/strategies.py` carga y **valida** los archivos. Rechaza placeholders desconocidos o idiomas faltantes, y los relee si cambian en disco, sin reiniciar.
- `copy_prompt.py` **genera el prompt** desde los archivos: agregar una estrategia no requiere tocar código.
- `copy_renderer.py` arma el texto final con plantillas y rota frases fijas de forma determinística por video.
- `scripts/preview_copy.py` prueba una estrategia sin generar un video, y `tests/unit/test_copy_strategies.py` valida todos los archivos.
- El id de la estrategia queda guardado en el job (`job.py → strategy`), lo que permite medir cuál funciona.

### 1.2 Categorías explainer (lo que hay hoy)

| Pieza | Dónde se decide hoy | Problema |
|---|---|---|
| **Títulos, descripción, tags** | `SYSTEM_PROMPT` escrito a mano en `src/core/explainer/briefs.py` + `niches.json → categories.<id>.strategy` (`title_formulas`, `title_examples`, `rules`) | Las reglas viven en código: cambiarlas es editar Python. Dicen "máximo 70 caracteres" (el estudio dice 60) y no piden 3 títulos con estrategias distintas. Los ejemplos de `niches.json` incluyen "castigado por ganar" (Turing) y "error de 7 mil millones" (Ariane), que son falsos o no están en el guion |
| **Momento en que se escriben** | `generate_brief()` antes de producir; `producer.py` le dice al agente "publish.json ya tiene los textos; ajústalos solo si el guion cambia el ángulo" | Se escriben **antes** del guion. Ya existe `generate_publish_texts()`, que parte del guion real, pero no es el paso por defecto |
| **Paso 9 del agente** | `explainer-kit/AGENTS.md` + `guides/manifest.md` | El ejemplo de `publish.json` dice "Suscríbete a UNO CERO" y `thumbnail_text: "UN ERROR"`, contra la regla nueva de miniaturas |
| **Miniatura** | `tools/poster.py`: captura un cuadro del video (960×540) como `render/poster.jpg` | No es una miniatura diseñada: no tiene modos A/B ni texto propio, y `thumbnail_text` se escribe pero no se usa |
| **Imagen de miniatura** | `guides/media.md` elige fotos **para el video**, no para la miniatura | No aplica los 10 criterios de imagen (legible a 210 px, fiel, ícono…) |
| **Descripción** | Texto libre de la IA | Sin capítulos, sin bloque de fuentes fijo, sin agradecimiento estructurado; los créditos dependen de que la IA los copie bien |
| **Validación** | `YouTubeCopy` en `briefs.py`: recorta el título a 100 y los tags a 480 caracteres | No valida largo de título (60), palabras de miniatura, que la miniatura no repita su título, reglas de capítulos, fuentes vacías ni que las cifras estén en el guion |
| **Medición** | — | No se guarda qué estrategia se usó en cada video |

---

## 2. Principio de diseño: la estrategia son datos, no código

La misma línea para todas las categorías explainer, igual que NodeMotion:

1. **Cada estrategia es un archivo JSON versionado.** No se edita una estrategia ya usada en producción: se copia a `_v2` y se cambia la copia. Así siempre se puede volver atrás.
2. **Un `active.json` dice qué estrategia usa cada categoría para cada pieza.** Cambiar de estrategia es cambiar un nombre ahí.
3. **El prompt y las validaciones se generan desde los archivos.** Agregar una regla no toca Python.
4. **La IA escribe piezas; el código arma y valida.** Lo que se puede calcular no se le pide a la IA: capítulos, créditos, fuentes, rotación del agradecimiento, hashtags fijos.
5. **Cada video guarda los ids de las estrategias que usó**, para poder medir.
6. **Los archivos se releen cuando cambian**, sin reiniciar el servidor. Esto importa: tu uvicorn corre con `--reload`, y editar un `.py` corta las producciones en curso. Editar un JSON, no.

---

## 3. Estructura de archivos propuesta

```
src/skills/explainer/                         ← paralelo a src/skills/output/copy/ (NodeMotion)
├── README.md                                 ← cómo cambiar o crear una estrategia
├── voice.md                                  ← tono común: provocador sí, falso no; respeto en temas de muerte
├── active.json                               ← qué estrategia usa cada categoría para cada pieza
├── categories/
│   ├── node_tech.json                        ← perfil editorial: público, ángulo, tono, temas, hashtags fijos,
│   ├── node_history.json                        ejemplos de títulos (verificados), reglas propias
│   ├── node_politics.json
│   └── node_economy.json
└── strategies/
    ├── title/title_anchor_tension_v1.json    ← fórmula ANCLA+TENSIÓN+DETALLE, las 10 estrategias de gancho,
    │                                            3 títulos con emociones distintas, ≤ 60, lo clave en 40
    ├── thumbnail/thumb_two_modes_v1.json     ← modo A solo texto (5–9 palabras, ≤ 3 líneas de 18) y
    │                                            modo B texto + imagen (2–5 palabras); pareja con un título
    ├── image/image_criteria_v1.json          ← los 10 criterios de imagen y cómo registrar la evaluación
    ├── platforms/platforms_v1.json           ← Facebook (primera línea ≤ 125) y TikTok (texto 0–3 s, caption ≤ 150)
    ├── description/desc_nine_blocks_v1.json  ← los 9 bloques, su orden, sus límites y las reglas de capítulos
    ├── gratitude/gratitude_rotation_v1.json  ← G1–G4, límites éticos y cómo rotan
    └── tags/tags_minimal_v1.json             ← 10–13 tags, 3 hashtags de YouTube, 3–4 de TikTok, 2 de Facebook
```

**`active.json`** (por categoría, con un `_default` para no repetir):

```jsonc
{
  "_default": {
    "title": "title_anchor_tension_v1",
    "thumbnail": "thumb_two_modes_v1",
    "image": "image_criteria_v1",
    "platforms": "platforms_v1",
    "description": "desc_nine_blocks_v1",
    "gratitude": "gratitude_rotation_v1",
    "tags": "tags_minimal_v1"
  },
  "node_politics": { "title": "title_anchor_tension_neutral_v1" }   // solo lo que cambia
}
```

**Ejemplo de un archivo de estrategia** (`thumbnail/thumb_two_modes_v1.json`, resumido):

```jsonc
{
  "id": "thumb_two_modes_v1",
  "piece": "thumbnail",
  "name": "Dos modos: solo texto y texto + imagen",
  "description": "A: la frase dice el tema y deja una tensión. B: la imagen dice el tema y el texto la tensión.",
  "fields": {
    "mode_a_lines": { "type": "list", "min_items": 2, "max_items": 3, "max_chars_per_item": 18,
                      "words": [5, 9],
                      "instruction": "Frase que nombre el tema (ancla) y deje una tensión; no repite el título de pareja.",
                      "examples": { "es": [["LA COMPUTADORA", "DEL APOLO 11", "SE RINDIÓ"]] },
                      "avoid":    { "es": [["1202"], ["NO CABÍA"]] } },
    "mode_a_highlight": { "type": "text", "instruction": "La palabra o frase de la tensión, que va en color de acento." },
    "mode_b_text": { "type": "text", "words": [2, 5],
                     "instruction": "Lo que la imagen no dice: qué pasó. No describe lo que se ve." },
    "pair_title":  { "type": "choice", "from": "title.options",
                     "instruction": "Qué título completa esta miniatura sin repetirla." }
  },
  "checks": ["no_repeat_pair_title", "numbers_in_script"]
}
```

**Qué pasa con `niches.json`:** queda solo con la estructura (árbol, carpeta, diseños, motor). El bloque `strategy` de cada categoría se muda a `skills/explainer/categories/<id>.json`, y `niches.json` guarda solo un puntero (`"strategy_profile": "node_tech"`). Mientras se migra, el cargador lee los dos, para no romper nada.

**NodeMotion:** no se toca. La estandarización es de **forma**: misma carpeta `src/skills/<dominio>/`, mismo `active.json`, versiones `_vN` y `README`. Más adelante, si conviene, los dos cargadores se pueden unificar en uno genérico. Eso queda fuera de este plan.

---

## 4. El contrato de salida: `publish.json` versión 2

El JSON del estudio de paquete (`paquete-publicacion-node-2026-10.json`) **ya es el formato**. Se agregan una versión, los ids de las estrategias usadas y los campos planos de hoy, para que el grabador y el publicador sigan funcionando sin cambios:

```jsonc
{
  "schema_version": 2,
  "strategies_used": { "title": "title_anchor_tension_v1", "thumbnail": "thumb_two_modes_v1", "gratitude": "G3_pertenencia", … },
  "thumbnail": { "opcion_a_solo_texto": { … }, "opcion_b_texto_imagen": { …, "evaluacion_de_imagenes": [ … ] }, "elegida": "A" },
  "titles": { "youtube": [ {opcion, texto, estrategia, emocion} ×3 ], "facebook": { … }, "tiktok": { … } },
  "description": { "blocks": { "gancho": "…", "contexto": "…", "capitulos": [ … ], "reflexion": "…", "pregunta": "…" },
                   "youtube": "…texto armado…", "facebook": "…" },
  "sources": [ … ],            // salen de PLAN.md §3
  "credits": [ … ],            // salen de assets/media/CREDITS.md
  "tags": { … },
  "pinned_comment": "…",

  // Compatibilidad: los campos de hoy, derivados de lo de arriba
  "youtube_title": "…(opción A)…", "youtube_description": "…", "youtube_tags": [ … ],
  "facebook_title": "…", "facebook_description": "…", "tiktok_caption": "…", "tiktok_hashtags": [ … ],
  "thumbnail_text": "…"
}
```

---

## 5. Dónde entra cada estrategia en el flujo del agente

| Momento | Quién | Qué estrategia usa | Qué produce | Cambio respecto de hoy |
|---|---|---|---|---|
| **Brief** (antes de producir, botón "Generar textos") | Backend + IA | `categories/<id>`, `title` | Ángulo, gancho, esquema y **3 títulos provisionales** | Los títulos se marcan como provisionales: no van a `publish.json` |
| **Paso 2 · PLAN.md** | Agente | — | Hechos **con fuente** en PLAN §3 | Es obligatorio: alimenta el bloque de fuentes |
| **Paso 3 · Guion** | Agente | `platforms` (texto 0–3 s) | `script.json` | La primera frase del guion y el texto de 0–3 s de TikTok se piensan juntos |
| **Paso 3b · Medios** | Agente | `image` | Fotos del video **y 2–3 candidatas de miniatura** con su evaluación en PLAN §8 | Nuevo: elegir la imagen de la miniatura con los 10 criterios |
| **Paso 5 · Transcripción** | Herramienta | `description` (reglas de capítulos) | Tiempos de cada segmento | Los capítulos los **calcula el kit** alineando guion y Whisper, no la IA |
| **Paso 9 · Paquete de publicación** | **Backend + IA**, con el guion final | `title`, `thumbnail`, `platforms`, `description`, `gratitude`, `tags` | `publish.json` v2 | Se genera **después** del guion, con `generate_publish_texts()` como camino por defecto |
| **Paso 9b · Miniaturas** | Herramienta | `thumbnail`, `image` | `render/thumb-a.jpg`, `render/thumb-b.jpg` y una hoja de prueba a 210 px | Nuevo comando del kit con los dos modos |
| **Validación** | Herramienta | Todas (sus `checks`) | Errores o OK | Nuevo `kit.py check-publish` |
| **Revisión humana** | Tú, en la web | — | Eliges miniatura A o B y el título de *Test & Compare* | La web muestra el paquete completo |

**Recomendación sobre quién escribe el paquete:** el **backend**, no el agente. El agente produce el video (investigación, guion, medios, voz, storyboard) y deja las fuentes y las candidatas de imagen. El paquete lo genera el backend con las estrategias, cuando el agente termina. Hay tres razones:

- Las estrategias se aplican en **un solo lugar**, igual para Claude, Codex o DeepSeek.
- El backend puede **validar y reintentar** de forma determinística.
- El agente gasta menos contexto y tiene menos reglas que puede ignorar.

---

## 6. Qué hace la IA y qué hace el código

| Pieza | IA | Código |
|---|---|---|
| Títulos | Escribe 3, cada uno con estrategia (1–10) y emoción | Valida ≤ 60, emociones distintas, cifras presentes en el guion |
| Miniatura A | Escribe 2–3 líneas y la palabra resaltada | Valida 5–9 palabras, ≤ 18 por línea, que no repita su título de pareja |
| Miniatura B | Escribe el texto corto y elige la imagen entre las candidatas | Valida 2–5 palabras; la imagen tiene que existir en `assets/media/` y tener crédito |
| Facebook y TikTok | Primera línea, texto 0–3 s, caption | Valida largos |
| Descripción | Gancho, contexto, reflexión y pregunta | Arma los 9 bloques; inserta capítulos, agradecimiento rotado, fuentes, créditos y hashtags |
| Agradecimiento | — | Elige G1–G4 por rotación determinística por video (como NodeMotion) |
| Tags | Lista de tags del tema | Agrega los hashtags fijos de la categoría y valida cantidad y caracteres |
| Comentario fijado | Dato extra + pregunta | Antepone el agradecimiento |

**Verificación de cifras:** el guion escribe los números con palabras ("treinta y siete"), pero `lyrics.json` (Whisper) los tiene en dígitos. El validador compara cada cifra del título y de la miniatura con la transcripción. Así detecta automáticamente casos como el "7 mil millones" del Ariane.

Si la IA no cumple, el sistema le reenvía los errores concretos y le pide corregirlos, como ya hace NodeMotion con `build_retry_note`. Si vuelve a fallar, el video queda en "revisar textos", no se publica.

---

## 7. Cómo se cambia una estrategia (operación diaria)

1. Copiar `strategies/title/title_anchor_tension_v1.json` a `…_v2.json` y editar la copia (ejemplos, instrucción, límites).
2. En `active.json`, apuntar la categoría a `…_v2`. Puede ser solo una categoría (`node_history`) para probar.
3. Probar sin producir un video, sobre un video que ya existe:
   ```bash
   .venv/bin/python scripts/preview_explainer_copy.py muro-de-berlin --strategy title=title_anchor_tension_v2
   ```
4. Si un archivo tiene un error (campo desconocido, límite imposible), el cargador y el test lo rechazan con un mensaje claro.
5. Toma efecto en el próximo video, sin reiniciar el servidor.

Más adelante, la web puede mostrar en "Programación" o en cada categoría qué estrategia está activa. Primero de solo lectura; después, con un selector.

---

## 8. Medición

- `publish.json → strategies_used` y el registro del job guardan los ids.
- Con eso se arma una tabla por estrategia: CTR, retención y suscriptores por cada 1.000 vistas (YouTube Analytics), y compartidos (TikTok, Facebook).
- *Test & Compare* sigue siendo manual en YouTube Studio: la API pública no lo ofrece. El paquete deja los 3 títulos y las 2 miniaturas listos para cargar.

---

## 9. Plan por fases

| Fase | Entregable | Cambia comportamiento | Verificación |
|---|---|---|---|
| **1** | `src/skills/explainer/` con `active.json`, `voice.md`, `categories/` (perfiles migrados desde `niches.json`, sin los ejemplos falsos) y las 7 estrategias v1 escritas desde los dos estudios. Cargador con caché por fecha de archivo, igual que NodeMotion | No | Test que carga y valida todos los archivos; test que rechaza un archivo roto |
| **2** | Esquema `publish.json` v2 + validador `check-publish` (largos, palabras, pareja, capítulos, fuentes, cifras contra Whisper) | No (solo informa) | Correrlo sobre los 7 videos listos: el JSON del estudio debe pasar y los `publish.json` actuales deben mostrar sus problemas |
| **3** | Generador del paquete en el backend: prompt generado desde las estrategias, piezas de la IA + armado por código + reintento con errores. `generate_publish_texts()` pasa a ser el paso por defecto **después** del guion | Sí | Tests con IA falsa: piezas válidas → paquete válido; piezas inválidas → reintento → error claro. Prueba real con un video ya producido |
| **4** | Agente: `AGENTS.md` (pasos 3b y 9), `guides/manifest.md` (ejemplo v2, sin "UNO CERO"), `guides/media.md` (sección de miniatura con los 10 criterios), y el prompt de `producer.py` | Sí | Una producción de prueba en `sandbox/nodehistory/`; revisar que PLAN §8 traiga candidatas evaluadas |
| **5** | `kit.py thumbnail <id> --modo texto\|imagen`: compone 1280×720 con el estilo del diseño y genera la hoja a 210 px. `poster.py` sigue para las tarjetas de la web | Sí | Miniaturas de los 7 videos; prueba de los 3 segundos con alguien que no conoce los videos |
| **6** | Web: en el modal del video, el paquete completo (3 títulos, miniatura A y B, descripción, tags) para elegir y editar antes de publicar. Vista de estrategias activas por categoría | Sí | Prueba en el navegador; publicar en privado un video de prueba |
| **7** | Medición: ids de estrategia en el registro de publicación y tabla por estrategia | Sí | Tabla con datos de 2 semanas |

**Orden recomendado:** 1 → 2 → 3, y después 4 y 5 en paralelo, luego 6 y 7. Las fases 1 y 2 se pueden hacer sin riesgo para las producciones en curso.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Editar `.py` con `--reload` corta producciones en curso | Las estrategias son JSON con caché por fecha de archivo: cambiarlas no reinicia nada. Los cambios de código de las fases 3–6, en momentos sin producciones |
| El agente tiene permisos acotados (solo `kit.py` y `media.py` con comandos exactos) | Todo comando nuevo (`thumbnail`, `check-publish`) se suma a la lista del prompt de `producer.py`; no se abren permisos generales |
| La IA ignora reglas | Validación por código + reintento con errores concretos; si vuelve a fallar, no se publica |
| Dos lugares escribiendo `publish.json` (agente y backend) | El backend es el único dueño del paquete; el agente solo deja fuentes y candidatas |
| Videos viejos con `publish.json` v1 | Campos de compatibilidad; `check-publish` los marca para regenerar |
| Demasiadas estrategias activas a la vez | Una por pieza y por categoría; las pruebas, de a una variable |

---

## 11. Decisiones para ti

1. **¿El backend genera el paquete después del guion** (recomendado), o prefieres que lo siga escribiendo el agente en el paso 9?
2. **¿Mudamos el perfil editorial** (`strategy`) de `niches.json` a `src/skills/explainer/categories/`? Recomendado, para que `niches.json` quede solo con la estructura.
3. **Nombre de los canales** en descripciones y comentario fijado: ¿NodeTech y NodeHistory, o PROTOTIPO y UNO CERO?
4. **Unificar más adelante** el cargador de NodeMotion y el de explainer en uno solo (misma forma ya desde la fase 1), ¿sí o no?
