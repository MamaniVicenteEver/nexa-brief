# PLAN — Vida en Escena (`nodeaction/vida-en-escena`)

Líder: Claude Opus 5.5 (arquitectura, contratos, revisión visual final). Trabajadores Codex vía
`~/codex/nexa-brief/run-model.sh`: `gpt-6-astra` xhigh (motor), `gpt-6.1-sol` high (voces, escenarios),
modelo económico para producir la variante (prueba de reutilización). Análisis de referencias:
`referencias/nodeaction/figuras/NOTAS.md`.

## 1. Decisión técnica

| Opción | Calidad demostrada para ESTA línea | Expresividad | Coste por episodio | Veredicto |
|---|---|---|---|---|
| Ampliar Pizarra (`_pizarra`) | poses fijas de pizarra, 16:9, sin caminar ni visemas | baja | bajo | no: limitaría el resultado |
| Rig de NodeAction (`_engine/rig.js`) | IK de 2 huesos, andares con fase = distancia (pies sin patinar), stickman de batalla | media (sin cara) | bajo | **se reutiliza el método** (IK + andar por distancia), no el dibujo |
| Laboratorio Three.js + HyperFrames | marcha de soldados-tarjeta en mundo 3D; sin cara, habla ni objetos | baja para diálogo | 20× tiempo real a 720p; 8,24 M tokens / 3×15 s | **se reutiliza el contrato de cámara** (tipos fixed/follow/dolly/move, validación, seek puro, tests de determinismo), no el renderer |
| HyperFrames como renderer | captura con navegador cuadro a cuadro | — | alto (Chrome por cuadro) | no hace falta: el motor es canvas 2D puro |
| Blender | 3D; el estilo es tinta plana 2D | — | muy alto | no justificado |
| **Motor 2D propio en canvas (elegido)** | se demuestra en la prueba corta | alta: cara, visemas, manos, objetos | render nativo Node + ffmpeg | **sí** |

Elegido: **motor híbrido 2D** `sandbox/nodeaction/_vida/`. Personajes vectoriales dibujados por código
(estilo tinta de las referencias: cabeza grande, línea gruesa uniforme, manos mitón) sobre un esqueleto
con IK; fondos = lámina ilustrada generada una vez con `src/adapters/image_gen` + capas vectoriales de
muebles/objetos con los que se interactúa (oclusión y puntos de agarre). La misma función pura
`renderFrame(ctx, ep, t)` dibuja la vista previa (navegador) y la exportación (Node + `@napi-rs/canvas`,
ambos Skia) → píxeles enviados por stdin a ffmpeg, sin JPEG intermedios.

Funciones: skills/docs (`_vida/VIDA.md`, `_vida/SKILL.md`) orientan al agente · motor (`_vida/engine/`)
interpreta datos · renderer (`_vida/tools/render.mjs` + ffmpeg) produce el MP4 · Nexa organiza la
plantilla en Sandbox (`vida-en-escena/info.json`, `index.html` genérico, `_tools/player/bridge.js`).

## 2. Estructura

```text
sandbox/nodeaction/_vida/              ← MOTOR COMPARTIDO (se registra en _tools/sandbox/engines.json)
  VIDA.md  SKILL.md  catalog.json      ← arquitectura · guía para producir episodios · catálogo
  schema/  episode|character|voice|set .schema.json
  engine/  core/ rig/ face/ act/ props/ sets/ camera/ fx/ ui/ render.js   (ES modules, sin DOM)
  characters/<id>.json  voices/<id>.json  sets/<id>/{set.json,plate.png}
  tools/   validate.mjs voice.mjs sync.mjs render.mjs review.mjs new-episode.mjs
  test/    determinismo, visemas, validación, pies
sandbox/nodeaction/vida-en-escena/     ← PROTOTIPO (episodio principal)
  index.html (genérico: carga config.json → episodio; contrato __promo)  info.json  PLAN.md
  assets/config.json  assets/episode.json  assets/audio/{lines/*.wav,dialogue.mp3}  assets/timing.json
  review/  (capturas seleccionadas)  work/ (briefs, logs, results)
sandbox/nodeaction/vida-en-escena-<variante>/   ← misma estructura, solo datos
```

Herramientas en Node (`.mjs`): uvicorn recarga con cualquier `.py` bajo `src/`. Voz y Whisper se
invocan con las herramientas existentes del explainer-kit (`narrate.py`, `transcribe.py`) sin editarlas.

## 3. Capas del personaje (separadas)

- `characters/<id>.json`: identidad y apariencia (cabeza, pelo, accesorios, ropa, colores, altura,
  `voice: <id>`). No contiene código.
- `engine/rig/`: esqueleto único (cadera, torso, cuello, cabeza, 2×[brazo, antebrazo, mano],
  2×[muslo, canilla, pie]); vistas `front`, `3q-left`, `3q-right`, `side-left`, `side-right` con giro
  interpolado; IK de 2 huesos para manos y pies.
- `engine/face/`: ojos (tamaño, pupila hacia un objetivo, párpados, parpadeo con semilla), cejas,
  bocas (expresiones) y visemas (`X` cerrada, `A`, `E`, `I`, `O`, `U`, `MBP`, `FV`, `L`).
- `engine/act/`: acciones con parámetros (sección 5). `engine/props/`: objetos con puntos de agarre.
- `engine/sets/`: lámina + capas + suelo/carriles + anclas (asientos, puerta, mesa).
- `engine/camera/`: encuadres y movimientos. `voices/<id>.json`: perfiles de voz.
- Episodio: solo contenido y composición.

## 4. Contrato de tiempos (audio primero)

1. `episode.json` define escenas → `steps` secuenciales. Un step es una **línea** (`say`), un
   **bloque de acción** con duración (`do`) o un grupo **paralelo**. Las acciones de fondo se anclan a
   líneas/palabras: `"@L07"`, `"@L07:end"`, `"@L07.examen"`, `"@L07+0.4"`.
2. `tools/voice.mjs` genera un clip por línea con el perfil del hablante (caché por hash de texto +
   perfil). Ante error NO cambia de voz ni de modelo: falla y lo informa.
3. `tools/sync.mjs` transcribe cada clip (Whisper real), mide energía RMS a 100 Hz y escribe
   `assets/timing.json`:
   ```json
   {"version":1,"fps":30,"lines":{"L07":{"speaker":"nico","clip":"audio/lines/L07.wav","dur":2.41,
     "words":[{"w":"hoy","s":0.12,"e":0.40}],"rms":[0.0,0.1],"rmsHz":100}}}
   ```
   (tiempos relativos al clip; la posición absoluta la calcula `compile`).
4. `engine/core/compile.js` = función pura `compile(episode, timing, catalog) → timeline` con tiempos
   absolutos. `tools/sync.mjs` usa esa misma función para mezclar `dialogue.mp3` (ffmpeg `adelay`).
   Vista previa, mezcla y render comparten el resultado.
5. Boca: visemas por grafemas del español repartidos en la duración de cada palabra de Whisper ×
   envolvente RMS; fuera de la voz, boca de la expresión (no se mueve). Subtítulos desde las palabras
   transcriptas de cada clip (no del texto del guion).

## 5. Acciones mínimas (bien hechas, no cientos)

`idle` (respiración + parpadeo), `talk` (gestos según `intent`: explain/ask/exclaim/deny), `listen`
(asentir, parpadeo, reacción leve), `look` (objetivo: personaje/objeto/cámara), `point`, `walk`
(a un punto/ancla; `speed`; pies apoyados, fase = distancia), `stop`, `turn`, `react`
(`surprise|laugh|shy|worry|annoyed|relief|shock`, `intensity`), `sit`/`stand` (ancla de asiento),
`pick`/`hold`/`give`/`put` (objeto, mano), `open` (puerta), `wave`, `highfive`, `eat`, `cross-arms`,
`hands-hips`. Cada una: parámetros con rango, duración mínima/por defecto, entrada/salida mezclables.
Capas: locomoción → cuerpo → brazos (I/D independientes) → cabeza/mirada → cara → boca.

## 6. Validación (`tools/validate.mjs`)

Referencias existentes (personajes, voces, acciones, objetos, sets, anclas), parámetros y rangos,
duraciones, recursos en disco, anclas resolubles, coherencia temporal, solapes incompatibles (dos
acciones en la misma capa, sentarse mientras camina, sostener con una mano ocupada), objetos con un
único dueño a la vez, personajes dentro del set, subtítulos dentro de la zona segura.

## 7. Calidad y pruebas

Prueba corta 10–15 s (diálogo + caminata + objeto) → comparación con v1 3–5 s, v2 0–2 s, v4 7–9 s →
correcciones → episodio completo ~2 min → variante breve hecha por un modelo económico solo con datos.
Métricas automáticas: deslizamiento de pies en apoyo (px), boca abierta en silencio (% cuadros),
determinismo (mismo t → mismo hash, seek aleatorio = secuencial), paridad navegador/Node (diff medio).

## 8. Recursos del servidor

4 núcleos, 11 GB RAM. Máximo 2–3 agentes a la vez y un solo render; medir CPU/RAM/tiempo del primer
render antes de paralelizar. Temporales en `work/` y `/tmp/vida-*`, borrados al terminar o fallar.
