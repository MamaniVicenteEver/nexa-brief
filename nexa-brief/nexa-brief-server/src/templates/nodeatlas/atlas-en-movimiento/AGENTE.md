# AGENTE · Producir un video con Atlas en Movimiento (cualquier tema)

> Punto de entrada único. Sirve para cualquier IA (Claude Code, Codex, Haiku, otra) y para cualquier tema:
> guerras, sucesos históricos, política, economía, geopolítica. **Esta plantilla no tiene tema.** El tema,
> los hechos y el ángulo salen del pedido y de la investigación. Lo que sí tiene es **más de 100 componentes**
> (unidades, flechas, efectos, imágenes, documentos, retratos, territorios, cifras) para contar cada hecho
> con algo que se ve y se mueve.
>
> Se usa de dos maneras, con las mismas reglas:
> 1. **Como skill**: un agente lee este archivo (o `SKILL.md`) y produce el video él mismo.
> 2. **Con un orquestador**: un agente líder (§2) reparte el trabajo en roles y revisa todo lo que vuelve.

## 0. La regla que lo resume

Un mapa con texto no es un video. **Cada hecho del guion se muestra con un componente que lo ilustra**:
una columna que avanza, una flecha, un documento, una foto con pie, un retrato, un territorio que cambia de
manos, un impacto, una cifra que sube. El texto (fecha, titular, subtítulos) acompaña; nunca es lo único.
Si una escena sale con 12 tipos de pieza y casi todos son texto, **está mal y no se entrega**.

> Nota: `src/skills/explainer/categories/node_atlas.json` trae anclas y reglas de ejemplo de un primer
> video; no limitan el tema. Úsalo para el tono y los hashtags (`#NodeAtlas`), no para elegir de qué se habla.

## 1. Qué leer (en este orden, y no más)

| # | archivo | para qué |
|---|---|---|
| 1 | este `AGENTE.md` | el proceso, los roles y las puertas de calidad |
| 2 | `GUION.md` | **cómo se genera el diálogo**: quién lo escribe, qué estrategia narrativa usa, cómo se piensa para imagen |
| 3 | `MENU-VISUAL.md` | qué componente usar para cada tipo de hecho (ofensiva, ocupación, tratado, ataque, cifra…) |
| 4 | `engine/tactico/animations/index.json` **completo** (109 piezas, una línea cada una) | saber qué existe; no se planea sin haberlo leído |
| 5 | `engine/tactico/animations/<nombre>.json` de **cada** pieza que vayas a usar (trae `example` para pegar) | parámetros y rangos |
| 6 | `engine/tactico/AGENTE.md` | reglas de ranuras de texto, estilos, errores ya vistos |
| 7 | `engine/tactico/ORQUESTACION.md` | cómo se reparten las ranuras cuando hay muchas piezas |

No leas `core.js`, `components/*.js` ni `plano.js`: el motor decide cómo se ve; tú decides qué se cuenta,
con qué pieza y cuándo. Si el pedido es de otra familia (letras, promos), no es este camino.

## 2. Quién hace qué (orquestación)

Fuente única: `src/skills/models/roles.json`. Cambiar quién hace un rol se hace allí, no en el código.

| rol | quién | hace |
|---|---|---|
| **líder / productor** | el agente que recibió el pedido (Claude Code, Codex…) | entiende el pedido, decide, delega, **revisa todo** y firma la entrega |
| investigación | Codex (`research`) | ledger de hechos con fuente y fecha |
| **guion / diálogo** | Codex (`script`, `text_draft`) | `assets/script.json` con plan visual por segmento (ver `GUION.md`) |
| storyboard / plan visual | Codex (`storyboard`) | el campo `plan` de cada segmento |
| medios | líder o Codex | descarga imágenes/documentos libres con crédito en `assets/media/` |
| verificación de hechos | DeepSeek (`fact_check`) | segunda lectura del guion contra el ledger |
| textos de publicación | DeepSeek (`copy_draft`) | títulos, descripción, miniaturas |
| voz | Gemini TTS | `narrate.py` |
| tiempos | Whisper large-v3 | `transcribe.py` |
| revisión visual | el líder, con sus ojos | hoja de contactos de 24 cuadros |

### Si Codex no responde (sin cuota, límite, caída)

`roles.json` declara un **respaldo `claude-haiku-5-5`** para los roles de Codex. `kit.py delegate` lo usa
solo cuando Codex falla y deja el cambio registrado (`work/delegate/*.fallback.jsonl`). Para el trabajo
largo (investigación, guion, plan visual) que se lanza fuera de `delegate`:

1. **Detecta** el fallo: la corrida termina sin entregables, o el log dice límite/cuota/usage limit.
2. **No sigas con una versión reducida.** No reemplaces la mitad del trabajo con atajos.
3. **Relanza el mismo brief** con Haiku 5.5 (`claude -p --model claude-haiku-5-5 …`, o `agent: "claude"`
   en `POST /api/v1/explainer/productions`). Los briefs ya son autosuficientes; no los resumas.
4. **Anótalo** al inicio del reporte final: qué rol cambió de modelo y por qué.
5. Haiku escribe borradores; **el líder revisa** guion, plan visual y medios con el mismo rigor.
6. Si tampoco hay Haiku, **detente y avisa al usuario**. Nunca entregues como "listo" un video armado con
   la mitad del flujo.

## 3. El proceso (con puertas)

Rutas relativas a la carpeta del episodio (`src/templates/nodehistory/<id>/` para producción; en pruebas,
`sandbox/<tema>/<id>/`). Herramientas en `tools/` de esta plantilla. **No grabes MP4. No hagas commit.**

| paso | qué | puerta (no se avanza sin esto) |
|---|---|---|
| 0 | **Entender el pedido**: tema, duración, formato, público. Completar lo que falte con valores por defecto y dejarlo en `PLAN.md` | pedido escrito en `PLAN.md` §1 |
| 1 | **Investigación** → `work/research/HECHOS.md` + `research.json` (ledger con ID, fecha, fuente, alcance) | ≥ 25 hechos para 7–8 min; cifras con dos fuentes |
| 2 | **Ángulo y estrategia narrativa** (`GUION.md` §2): nivel, arco, golpe, pregunta final | `work/briefs/angulo.md` |
| 3 | **Guion** `assets/script.json` por segmentos (`GUION.md`) | `kit.py check` y lectura en voz alta |
| 4 | **Plan visual por segmento** (`plan` dentro de cada segmento, `MENU-VISUAL.md`) | cada segmento con ≥ 1 pieza no textual; guion revisado por el líder |
| 5 | **Medios**: bajar y curar cada imagen/documento del plan → `assets/media/` + `assets/media/credits.json` | todos los `src` del plan existen y tienen crédito |
| 6 | **Voz** → `assets/song.mp3` (Gemini TTS, `_atlas/voice.json`) | `song.qc.json` sin omisiones; se escucha un tramo |
| 7 | **Transcripción** → `assets/lyrics.json` (Whisper) | tiempos reales, nunca estimados |
| 8 | **Escena**: `python3 tools/build_scene.py <episodio>` (generador universal) | sin segmentos sin plan |
| 9 | **Auditorías**: `node tools/cobertura-audit.mjs <episodio>` **y** `node work/escena/estilo-audit.mjs` | **cobertura OK y 0 choques**; las dos, no una |
| 10 | **Mapa**: teselas para cada zona/zoom de cámara (`_atlas/PRODUCIR.md` §5) | barrido de navegador sin teselas faltantes |
| 11 | **Revisión visual**: hoja de 24 cuadros en 9:16 y en 16:9 + un tramo animado | escribir en el resultado: tipos, imágenes, unidades, tramos sin movimiento |
| 12 | **Publicación en preparación**: `publish.json` v2, miniaturas, créditos; estado "en preparación" | `publishing check` |
| 13 | **Reporte final** (§7) | honesto, con lo que falta al inicio |

## 4. Cómo se ve un video bueno (referencia mínima)

- Duración de 7–8 min (≈ 1.000–1.150 palabras a 130 ppm): **≥ 14 tipos de componente** de **4 familias**
  (texto, mapa/marcas, movimiento/unidades, imagen/documento).
- Una imagen o documento cada ≤ 45 s; **ningún tramo de 20 s sin imagen ni movimiento**.
- Cada giro del relato tiene su pieza: la ofensiva avanza, la ocupación cambia el mapa, el tratado se ve
  firmado, la cifra sube, la persona aparece con su nombre y cargo.
- Cámara que se mueve con intención (acercar al hecho, alejar para el contexto), no 22 vistas quietas.
- Los datos dudosos se rotulan ("posición aproximada", "cifra discutida"); nada visible sin ledger.
- Texto en ranuras: encabezado, titular o año, nota, transcripción. Una pieza por ranura a la vez.

## 5. Estilo, formato y estilos de texto

`estilo: "v4-atlas"` por defecto; `v2-mando`, `v3-cine`, `clasico` son alternativas (`engine/tactico/AGENTE.md §4`).
El formato (móvil 9:16 / escritorio 16:9) lo deduce el motor; la escena sirve para ambos. Verifica los dos.

## 6. Contrato de entrada del generador (`build_scene.py`)

`assets/script.json`:

```jsonc
{ "title": "...", "voice": "Charon", "language": "es",
  "escena": {                       // configuración global (opcional salvo `places`)
    "estilo": "v4-atlas",
    "center": [31.5, 49.0], "camara_inicial": {"center": [31.5,49.0], "zoom": 5.4},
    "intro": {"title": "...", "subtitle": "...", "kicker": "ATLAS EN MOVIMIENTO"},
    "outro": {"channel": "NODEHISTORY", "handle": "youtube.com/@..."},
    "places": {"Kyiv": [30.52, 50.45]},
    "territorios": [{"region":"UA","bando":"otro","opacity":0.8}, {"region":"RU","bando":"atacante","desde":"s07"}],
    "sonidos": []                   // cues de sound; la mezcla es otro paso
  },
  "segments": [ {
      "id": "s05", "tone": "...", "intensity": 0.8, "text": "...", "claim_ids": ["U05"],
      "plan": {
        "texto": {"fecha": "1 DIC 1991", "lugar": "UCRANIA", "titular": "Referéndum · 90 %", "nota": "...", "year": "1991", "salto": "..."},
        "camara": {"center": [31,49], "zoom": 6.5, "offset": 0},
        "componentes": [ {"tipo": "army.advance", "offset": 1.0, "dur": 8, "at": [...], "path": {...}, "flag": "RU"} ],
        "medios": [ {"tipo": "document.clip", "offset": 0.5, "dur": 9, "src": "assets/media/x.jpg", "caption": "...", "source": "...", "credit": "...", "side": "izq"} ]
      } } ] }
```

Los parámetros de `componentes` y `medios` son los del JSON de esa pieza (`animations/<tipo>.json`, campo
`example`). El generador copia cada pieza con su tipo real y marca `segment` para que la auditoría compruebe
el plan. Tiempos relativos al inicio de la frase (`offset`) → si la voz cambia, la escena se reacomoda.

## 7. Reporte final (siempre, y empieza por lo que falta)

1. **Lo que falta o salió reducido**, primero. Si Codex falló y entró Haiku, o faltan imágenes, se dice aquí.
2. Tema, duración, formato, estado ("en preparación", sin MP4).
3. Cobertura: tipos usados, familias, nº de imágenes/documentos, unidades, tramos sin movimiento (de
   `cobertura-audit`), choques de ranuras (de `estilo-audit`).
4. Qué se delegó, a qué modelo y qué se rehízo.
5. Rutas: guion, escena, hoja de contactos, créditos.
6. Qué debe mirar el usuario.

## 8. Lo que ya salió mal (no se repite)

- **Escena solo de texto.** Un video de 7,5 min con 12 tipos de pieza (59 de 63 eran texto), 0 imágenes y 1
  unidad pasó "0 choques" y se declaró listo. Ahora lo frena `cobertura-audit.mjs`.
- **`visual_cue` ignorado.** El guion pedía 21 documentos y 3 cambios de control; el generador no los
  implementaba. Ahora el `plan` es dato obligatorio y el audit compara plan contra escena.
- **Sin etapa de medios.** Nadie descargó imágenes; los documentos se omitieron en silencio. El paso 5 es obligatorio.
- **Codex sin cuota y el flujo siguió con la mitad.** Ver §2: respaldo Haiku 5.5, nunca versión reducida.
- **"Detalles menores" para fallas centrales.** El reporte dice primero lo que falta.
- **Guion como lista de hechos.** Ver `GUION.md`: un video se cuenta con escenas, personas y tensión.
- Países con rótulo en el mismo punto, rutas `work/…` en la escena, `bando` solo admite `atacante|otro`
  (`engine/tactico/AGENTE.md §7`).
