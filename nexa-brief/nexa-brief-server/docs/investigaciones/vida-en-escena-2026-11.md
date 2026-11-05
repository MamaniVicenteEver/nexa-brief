# Vida en Escena — informe de entrega (2026-11-03)

Prototipo `sandbox/nodeaction/vida-en-escena` y motor compartido `sandbox/nodeaction/_vida`
(rutas relativas a `nexa-brief-server/src/templates/`). Plan y decisión: `vida-en-escena/PLAN.md`.
Análisis de referencias con marcas de tiempo: `sandbox/referencias/nodeaction/figuras/NOTAS.md`.

## 1. Decisión técnica

Motor 2D propio en Canvas (ES modules sin DOM). Una sola función pura `renderFrame(ctx, compilado, t)`
dibuja la previsualización (navegador) y la exportación (Node + `@napi-rs/canvas`). Los píxeles se
envían por stdin a ffmpeg, sin cuadros en disco.

- **Reutilizado de Nexa:** el método del rig de NodeAction (poses = objetivos + IK de 2 huesos, fase de
  la marcha = distancia), el contrato `__promo` y `_tools/player/bridge.js`, la voz Gemini y Whisper del
  explainer-kit (invocados, sin editar) y `src/adapters/image_gen` para las láminas.
- **Reutilizado del laboratorio** (`animation-lab/cartoon-road-march`): el contrato de cámara por datos
  (tipos de plano, objetivo por nombre, validación previa, seek puro, test de estados al retroceder). No
  se usó su renderer Three.js + HyperFrames. Motivos: personajes-tarjeta sin cara, habla ni objetos; render
  a ~20× tiempo real en 720p; constantes de historia dentro del código (`cast.ts`); 8,24 M tokens para
  3×15 s (99 553 sin caché).
- **Descartados:** ampliar Pizarra (poses fijas, solo 16:9, sin caminata ni visemas), HyperFrames como
  renderer (Chrome por cuadro cuando el motor ya es canvas puro) y Blender (estilo 2D plano; coste sin
  beneficio).

## 2. Qué quedó

| Pieza | Dónde |
|---|---|
| Rig, cara, 14 expresiones, 9 visemas, 7 manos, 5 vistas con giro continuo | `_vida/engine/rig`, `engine/face` |
| ~30 acciones con parámetros y capas (caminar, hablar por intención, escuchar, reaccionar, sentarse, dar/tomar/guardar/quitarse, comer, abrir, gestos, FX) | `_vida/engine/act`, `catalog.json` |
| Props con agarre y oclusión (incl. `counter` con `behind`) | `_vida/engine/props` |
| 5 escenarios por datos (lámina generada una vez + `set.json`) | `_vida/sets/*` |
| Cámara con director automático (contraplano, close en sustos, inserts, whip, dolly) y encuadre relativo a la escala | `_vida/engine/camera` |
| Transiciones de cuadro completo (cut, fade, wipe, dip-white) | `_vida/engine` |
| 4 personajes + heladero; 5 perfiles de voz | `_vida/characters`, `_vida/voices` |
| Contrato JSON (esquemas) + `validate`, `review` (métricas con `failed`), `mix`, `render`, `voice` | `_vida/schema`, `_vida/tools` |
| Guía para producir: `SKILL.md`; arquitectura y cómo añadir una acción: `VIDA.md` | `_vida/` |
| Tests | 81/81 en local y en alfred-server |

## 3. Resultados

| Entrega | Datos |
|---|---|
| Episodio «Un día cualquiera» | 2:07,98 · 1080×1920 · 30 fps · H.264 CRF 18 + AAC · 39 MB · 4 escenas, 125 acciones, 25 líneas · `vida-en-escena/render/un-dia-cualquiera.mp4` |
| Prueba corta | 14,5 s · `vida-en-escena/review/prueba-corta.mp4` |
| Variante «Heladería» | 30,3 s · set y personaje nuevos, otra historia, mismos clips aprobados · `vida-en-escena-heladeria/render/heladeria.mp4` |
| Métricas del episodio | pies en apoyo ≤ 0,41 px · boca abierta sin voz 0 % · determinismo 30/30 · error de agarre 0 px · sin solape de cabezas · subtítulos en zona segura |
| Paridad | navegador vs Node 0,05–0,12/255 (medida en el lienzo); MP4 decodificado vs lienzo ~1,0–1,1/255 |
| Render en local (8 núcleos) | 5 min 25 s para 2:08 en solitario (12,7 fps, CPU 282 %, RSS máx. 640 MB); 10 min 27 s compartiendo la máquina |

Evidencia: `vida-en-escena/review/` (hoja final, paridad, prueba corta, caminata antes/después),
`vida-en-escena/review/pulido/` (fade, sentados, comedor, cuchara), `_vida/review/` (hojas de
personajes, sentados, props, sets) y los informes de cada paso en `vida-en-escena/work/results/`.

## 4. Consumo (mediciones)

Tokens de Codex, total por tarea tal como lo informa la CLI (sin desglose de entrada y salida en las
tareas locales):

| Trabajo | Tareas | Tokens |
|---|---|---:|
| Motor: construir y mejorar | rig 256 430 · escena 236 374 · ajustes 217 360 · capacidades 204 572 · pulido 190 769 · encuadre 166 968 (Astra) · voces 124 942 · sets 53 918 (Sol) | 1 451 333 |
| Producir episodio con componentes existentes | montaje del episodio completo 142 346 (Sol); la tarea «capacidades» también adaptó el episodio | 142 346 (parcial) |
| Producir la variante con componentes existentes | variante 241 350 + corrección 119 970 (Luna) | 361 320 |

- Láminas: 5 generaciones con `image_gen` (~65 s cada una; el adaptador informa tokens por imagen, que
  no se sumaron aquí).
- TTS: 69 llamadas HTTP y 20 reintentos por QC para 25 clips (ver `work/results/vida-voces.md`).
- Claude (líder): no se midió desde la sesión; queda fuera de estas cifras.

No hay porcentaje de ahorro: la variante es más corta y reutiliza audio, así que no es comparable con
el episodio principal. Sí se observa que producir con componentes existentes no tocó código del motor.

## 5. Límites y pendientes

1. **Previsualización en la app:** `/api/v1/explainer/files` no sirve `_vida` (404) porque no figura en
   `SANDBOX_SHARED_DIRS` (`src/presentation/api/routers/explainer.py:88`). Basta agregar `"_vida"`, pero
   eso recarga uvicorn: queda pendiente de tu autorización. Los dos prototipos ya aparecen en el listado.
2. **Voces:** L07, L23 y N04 no se generaron porque las claves de Gemini devuelven HTTP 402 (saldo
   prepago agotado). El episodio usa gestos mudos en su lugar; los puntos de inserción están en
   `work/results/vida-episodio.md`. Los perfiles tienen `approved: false`: nadie los escuchó todavía.
3. **Visemas:** salen de los grafemas del español más la energía RMS, sobre tiempos por palabra de
   Whisper. No hay alineación fonética real; las consonantes rápidas se aproximan.
4. **Frente a las referencias:** las expresiones son más sutiles en planos medios; no hay smear frames
   (v3) ni animación a 2 cuadros; el escorzo de un brazo hacia la cámara es limitado (rig 2D); las
   láminas son sobrias y algo suaves en primer plano (ampliación ~2×).
5. **Métricas automáticas:** detectan errores técnicos y de composición, pero no juzgan la actuación. La
   variante pasó la primera revisión con planos pobres: hace falta mirar la hoja siempre.
6. **Comedor:** las piernas de los sentados todavía cruzan el travesaño de la silla en algunos ángulos.

## 6. Actualización (2026-11-03, tarde): ruido de audio y encuadre por pantalla

**Ruido al final de cada línea.** Causa: el audio crudo de Gemini termina con una ráfaga de ~150 ms (≈ −8 dBFS), separada de la voz por 0,2–1 s de silencio. `voice.mjs` recortaba bordes solo por energía, la conservaba y la normalizaba con la voz; el control con Whisper no la ve. L21 traía además un segmento sobrante (2,1–3,1 s). Reparación local sin TTS y sin cambiar duraciones: se conserva la actividad conectada a la última palabra y se borra lo posterior. Los tiempos de Whisper van adelantados entre 0,05 y 0,35 s respecto de la voz real: una primera reparación cortaba por esos tiempos y comía sílabas finales (corregida). `voice.mjs` ahora descarta la ráfaga y tiene el QC `trailing_noise`; `mix.mjs` mide la cola. Originales en `/tmp/vida-audio-originales/` (se pierden al reiniciar). Informes: `vida-en-escena/work/results/vida-audio.md` y `vida-qa-audio.md` (verificación independiente).
**Sin comprobar por escucha:** nadie ha oído el resultado. Hay 3 impulsos a ~0,10 s del inicio de L04, L06 y L20, presentes también en los WAV originales, que hay que escuchar.

**Encuadre.** El 9:16 recortaba personajes (Nico a los 30 s). Ahora `framing:"fit"` (por defecto) mantiene completos a todos los actores en planos no `close`/`insert`; el reproductor elige por aspecto de ventana: landscape 1920×1080 (pestaña Desktop) o portrait 1080×1920 más alejado (pestaña Móvil), `?view=landscape|portrait|auto`; `render.mjs --view/--framing`. Ambos episodios pasan las dos vistas sin recortes; 106 tests. Informe: `vida-vista.md`. MP4: `render/un-dia-cualquiera.mp4` (9:16) y `-16x9.mp4`, `heladeria.mp4` y `-16x9.mp4`.
Tokens Codex: audio 113 514 + 1.ª pasada (Sol 6.1 high); vista 234 856 (Sol 6.1 xhigh); verificación (Terra 6.1 high) sin medir.

**Cámara (Astra high) y cierre de audio.** Motor de cámara por JSON (`_vida/docs/CAMARA.md`): encuadre con envolvente y anticipación, perfiles de jerk mínimo con límites de velocidad, `push/pull/drift/track/reveal`, director por intención; p99 de velocidad de zoom 4,71→0,22 oct/s (principal vertical), inversiones 180→0, 134 pruebas. Pendiente conocido: `dissolve` no mezcla imágenes. Audio: además de la ráfaga final había un chasquido de inicio en los 25 clips (0,100 s) y un clic extra en L16 (0,30 s); L21 perdió un tramo vocal (2,1–3,2 s, no está en el guion) a decisión del humano (pares en `review/audio/escuchar/`). Tokens Codex: cámara ~213 183 (Astra high), audio 113 514 + ~? (Sol 6.1 high), verificaciones Terra 6.1 high sin medir.
