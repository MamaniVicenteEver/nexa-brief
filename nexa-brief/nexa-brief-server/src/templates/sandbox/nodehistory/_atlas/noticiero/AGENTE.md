# AGENTE · Producir un video NOTICIERO (resumen de noticias sobre globo 3D)

> Punto de entrada único de la plantilla. Sirve para cualquier IA (Codex, Claude Code, Haiku) y para cualquier fecha o
> tema de actualidad. **El diseño está terminado y no se toca**: tú decides qué noticias se cuentan, con qué palabras,
> con qué imágenes y con qué piezas; el motor decide cómo se ve. Referencia de calidad: el demo
> `sandbox/nodepolitics/resumen-geopolitico-demo` del perfil `profesional` (14 segmentos, 2:34, 86 piezas de pantalla, 9 retratos de 5 personas, 3 fotos de apoyo). En el repo, su guion y su generador están en `plantilla/ejemplo-demo/`.
> Meta: que «crea el resumen de hoy, 10/11/2026» salga igual de bueno que el demo, sin leer el código del motor.

## 0. Lo que es FIJO (no se negocia ni se cambia por video)

| qué | valor fijo | dónde vive |
|---|---|---|
| **estilo visual** | `original` (por defecto). `dynamic-news` solo si el usuario lo pide en ese pedido | `scene.estilo` y `config.json → estilo`; `check.py` lo exige |
| **voz** | Gemini 3.8 Flash TTS · **Charon** · tono **aceleración** · intensidad 0.5 · ≈180 palabras/min · lead 0.6 s · tail 1.5 s | `noticiero/voz.json` (la copia el scaffold a `work/voice.json`) |
| **estilo del diálogo** | locutor de noticiero: tercera persona, frases con hecho + cifra + consecuencia, sin preguntas ni opiniones | `GUION.md` |
| **look del mapa** | `noticiero-globo` (globo satelital oscuro, sin estrellas), sin crédito técnico (`attribution:false`) | `scene.look` |
| **subtítulos** | Poppins 27, blancos, 4 palabras máx., abajo | `Escena.CAPTIONS` en `escena_lib.py` |
| **motor** | `nodehistory/_atlas` compartido: no se copia ni se edita para un video | — |

Cambiar cualquiera de esto exige una instrucción explícita del usuario para ese video. Un video nuevo es **solo datos**:
`assets/script.json`, `assets/scene.json` (lo genera `work/build_scene.py`) y las imágenes de `assets/media/`.

## 0b. Regla de oro: NO se copia el motor, NO se escribe código por video (menos código, menos tokens)

La idea de toda esta plantilla es **reducir el código al mínimo y no repetir nada**: un solo motor, un solo catálogo de piezas, y cada video es
**solo parámetros JSON**. Por eso:
- **Prohibido** copiar `_atlas/`, `hud.js`, `atlas.js`, `_proto/proto.js`, `vendor/`, datos geográficos o fuentes dentro de la carpeta del episodio, y editar su `index.html`
  (es un wrapper de 10 líneas que carga el motor compartido por ruta relativa). Tampoco HTML/JS/CSS propios ni un «mini motor» para una pieza.
- El video se compone **solo** con piezas del catálogo (`PIEZAS.md` + `MENU.md`) y se les pasan parámetros en `assets/scene.json` (que genera `work/build_scene.py`).
  Hasta la voz, el estilo y los colores se cambian por JSON (`hudTheme`, campos por pieza).
- Si falta una pieza o un campo: primero busca en `PIEZAS.md` una que sirva con otros parámetros; si de verdad no existe, **avísalo en el reporte** y propón crearla UNA vez en el
  motor compartido (con su entrada de catálogo y demo en el Showcase); nunca se resuelve con código dentro del episodio.
- Lee solo lo necesario: `AGENTE.md`, `GUION.md`, `INVESTIGACION.md` y `PIEZAS.md`/`MENU.md`. No abras el código del motor ni de las piezas.
- `python3 $N/tools/sin-copias.py $EP` lo comprueba (index.html idéntico al wrapper, cero archivos de código o de motor en el episodio) y **debe dar 0 errores** antes de entregar.

## 1. El pedido tipo y cómo se interpreta

«Crea el video de hoy (10/11/2026)» = un **resumen** de lo más importante del período, no una noticia suelta:
- **«El video de hoy» sin más = semanal** (por defecto, como el demo): ventana de 7 días que termina hoy, con la fecha de hoy en el título. Solo es diario si el usuario dice «del día»/«de las últimas horas»; dilo en el reporte, no preguntes.
- **Semanal**: ventana de 7 días que termina en la fecha pedida. Apertura «Este es el resumen
  geopolítico de la semana.» **Diario**: últimas 24–48 h, apertura «…del día.» y 6–9 noticias.
- 8–12 noticias (≈ 2:15–3:00 de audio, 400–520 palabras); lo más importante primero; 2–3 titulares breves al final.
- Fecha de hoy y zona horaria del usuario (América Latina): confirma qué día es con `date` y fija la ventana en fechas absolutas.
- Id de la carpeta: `resumen-AAAA-MM-DD` (diario: `resumen-dia-AAAA-MM-DD`); categoría `nodepolitics` salvo que el usuario diga otra.
- Formatos 9:16 y 16:9 salen del mismo JSON; no se hacen versiones aparte.
- No se graba MP4, no se publica, no se hace commit (salvo pedido explícito).

## 2. Quién hace qué (orquestación)

Fuente única de modelos: `src/skills/models/roles.json` y `noticiero/orquestacion.json`. El agente que recibe el pedido es el
**líder**: entiende, decide, delega, **revisa todo lo que vuelve** y firma. Prefiere delegar los trabajos largos a Codex.

| rol | quién (por defecto) | hace |
|---|---|---|
| **líder / productor** | el agente que recibió el pedido | PLAN, decisiones, revisión de cada entrega, `check.py`, reporte final |
| **investigación + guion + plan visual** | **Codex `gpt-6.1-terra`, esfuerzo `high`** (respaldo `claude-haiku-5-5` solo si Codex no está disponible) | `work/research/`, `assets/script.json`, lista de medios, plan visual (brief `briefs/BRIEF-noticiero-investigacion-guion.md`) |
| medios | líder o Codex | `tools/medios.py` descarga retratos/fotos con licencia y crédito |
| **escena** | líder (o Codex) | `work/build_scene.py` con `tools/escena_lib.py` |
| voz y tiempos | Gemini TTS + Whisper | `tools/voz.py` (perfil fijo) |
| **paquete de publicación** | **Codex `gpt-6.1-terra` alto**, en paralelo en cuanto existe `lyrics.json` | brief `briefs/BRIEF-noticiero-publicacion.md` |
| revisión visual | el líder, con sus ojos | cuadros en 9:16 y 16:9 |

Lanzar una tarea a Codex (en el servidor, donde está `~/codex/nexa-brief/`): copia el brief a `~/codex/nexa-brief/BRIEF-<tarea>.md`, sustituye `<ID>`/`<EP>`, añade la
tarea a `budgets.txt` y ejecuta `EXTRA_ROOT=$EP ~/codex/nexa-brief/run-model.sh gpt-6.1-terra high <tarea> nodepolitics/<id>` (el 4.º argumento `<carpeta>/<id>` registra el uso en el episodio). Si trabajas en la máquina local, conéctate por `ssh alfred-server`: Codex y las rutas son las del servidor. Si Codex falla (sin cuota,
límite, caída): **no entregues una versión reducida**; relanza el mismo brief con `claude-haiku-5-5` y anótalo al inicio del reporte.
Si tampoco hay Haiku, o el agente no tiene búsqueda web, detente y avisa: no rellenes con datos del demo ni inventes. Registra el modelo pedido, el real y el motivo del cambio.

## 3. El proceso (puertas: no se avanza sin cumplirlas)

Rutas desde `nexa-brief-server/`. `N=src/templates/sandbox/nodehistory/_atlas/noticiero`. `EP` = carpeta del episodio.

| paso | qué | comando / entregable | puerta |
|---|---|---|---|
| 0 | Entender el pedido y crear la carpeta | `source ../scripts/profile-env.sh` y `python3 $N/tools/nuevo.py <id> --fecha AAAA-MM-DD --titulo "…" [--periodo dia]` → rellenar `EP/PLAN.md` §1 | pedido escrito en PLAN §1 |
| 1 | **Investigar** noticias de la ventana (`INVESTIGACION.md`) | `EP/work/research/HECHOS.md` + `research.json` (ledger) | 12–20 candidatas puntuadas, 8–12 elegidas; cada cifra con ≥ 2 fuentes y fecha |
| 2 | **Elegir y ordenar** noticias; **escribir el guion** (`GUION.md`) | `EP/assets/script.json` | 400–520 palabras; leído en voz alta; `check.py $EP --tarde` con 0 errores (solo mira el guion) |
| 3 | **Plan visual** por segmento (`MENU.md`) y **lista de medios** | `EP/work/plan-visual.md`, `EP/work/medios-necesarios.json` | cada segmento con ≥ 3 piezas no textuales; cada persona nombrada con retrato o silueta justificada |
| 4 | **Medios**: retratos, lugares, objetos | `python3 $N/tools/medios.py --buscar "…"` y `python3 $N/tools/medios.py $EP` | todo `src` del plan existe, con crédito; revisadas a ojo |
| 5 | **Voz** (gasta cuota: UNA vez, con el guion final) | `python3 $N/tools/voz.py $EP` (ensayo) → `--ejecutar --transcribir --silencio 7.2` | `song.qc.json`: voz Charon, ppm 150–200; se escucha un tramo |
| 6 | **Escena**: anclas a palabras reales | editar `EP/work/build_scene.py` y `python3 EP/work/build_scene.py` | se genera sin errores |
| 7 | **Validar** | `python3 $N/tools/check.py $EP` y `python3 $N/tools/sin-copias.py $EP` | **0 errores** en ambos; cada aviso corregido o justificado en PLAN §7 |
| 8 | **Mapa**: teselas para ambos formatos | `.venv/bin/python src/templates/_tools/atlas/atlas.py plan $EP/assets/scene.json --fetch --width 1080 --height 1920` y `--width 1920 --height 1080` | sin teselas faltantes |
| 9 | **Revisión visual**: 8–10 cuadros en 9:16 y 16:9 + un tramo animado (§6) | — | nada cortado, sin choques de texto, retratos correctos, mapa legible |
| 10 | **Paquete de publicación COMPLETO**: se **lanza** en el paso 5, en cuanto existe `lyrics.json` (en paralelo a los pasos 6–9) y se **cierra** aquí | brief de publicación (§7) | `publishing check` con 0 errores (comando en §7) |
| 11 | **Reporte final** (§8) | — | honesto, con lo que falta al inicio |

Cada video es propio: no se reutilizan la voz, el guion ni los datos de otro episodio (ni los del demo).

## 3b. Comandos listos (copiar y sustituir `<id>`)

```bash
cd /home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server        # = nexa-brief-server/ (servidor)
source ../scripts/profile-env.sh                                                      # define NEXA_PROFILE_DIR (el perfil activo)
N=src/templates/sandbox/nodehistory/_atlas/noticiero; EP=$NEXA_PROFILE_DIR/sandbox/nodepolitics/<id>
python3 $N/tools/nuevo.py <id> --fecha 2026-11-10 --titulo "Resumen geopolítico (10 nov 2026)"        # paso 0
python3 $N/tools/check.py $EP --tarde                                                  # paso 2 (solo guion)
python3 $N/tools/medios.py --buscar "<consulta en inglés>" ; python3 $N/tools/medios.py $EP     # paso 4
python3 $N/tools/voz.py $EP ; python3 $N/tools/voz.py $EP --ejecutar --transcribir --silencio 7.2  # paso 5 (el 2.º gasta cuota)
python3 $EP/work/build_scene.py ; python3 $N/tools/check.py $EP ; python3 $N/tools/sin-copias.py $EP   # pasos 6–7
for WH in "1080 1920" "1920 1080"; do set -- $WH; .venv/bin/python src/templates/_tools/atlas/atlas.py plan $EP/assets/scene.json --fetch --width $1 --height $2; done   # paso 8
.venv/bin/python -m src.core.explainer.publishing check <id>                           # paso 10 (ver §7)
```
«Cierre» son dos cosas distintas: el **cierre visual** (`Escena(cierre=1|2)` en `build_scene.py`: 1 = globo girando con título, el del demo, por defecto) y el **silencio**
de 7.2 s que `voz.py --silencio` añade al audio para que dure lo que dura ese cierre.

## 4. Qué leer (en este orden, y no más)

| archivo (en `noticiero/`) | para qué |
|---|---|
| este `AGENTE.md` | proceso, roles, puertas |
| `GUION.md` | **cómo habla**: anatomía del diálogo del demo, longitudes, apertura/cierre, qué evitar |
| `INVESTIGACION.md` | cómo investigar noticias de una fecha y **qué imágenes necesita cada noticia** (retratos, lugares, empresas) y de dónde salen |
| `MENU.md` | **qué piezas existen**, campos clave y recetas «tipo de noticia → piezas» |
| `../HUD.md` | referencia completa de los campos del HUD (solo si MENU.md no alcanza) |
| `plantilla/ejemplo-demo/` | el guion y el generador reales del demo, para copiar el patrón |
| `QUICK.md` | **solo** si el usuario pide Dynamic News; describe piezas que Original no tiene |

**No leas** `hud.js`, `atlas.js`, `update.js` ni `_proto/proto.js`: el motor decide cómo se ve. `noticiero/estilos/dynamic-news.json`,
`style.mjs`, `hud.mjs`, `layout.mjs` son del otro estilo: no se usan salvo pedido.

## 5. Referencia mínima de calidad (medida en el demo)

| medida | demo | mínimo para entregar |
|---|---|---|
| segmentos / palabras | 14 / 470 | 8–16 / 400–520 |
| piezas HUD | 86 (≈ 6 por segmento) | ≥ 4 por segmento de media |
| resaltados de región | 17 | ≥ 1 por noticia con país/estado |
| arcos | 11 | los trayectos y ataques que cuenta el guion |
| retratos | 9 (6 personas) | uno por cada persona nombrada con cargo (o silueta, avisada) |
| fotos de apoyo | 3 | ≥ 1 por cada 3–4 noticias |
| cámara | 18 poses | una pose por noticia, con intención |
| tipos de pieza distintos | 10 de 11 | ≥ 7 |

**Regla de oro:** cada hecho del guion se ve (un país que se ilumina, una cifra que sube, una persona con nombre y cargo, un hemiciclo que
se llena, un arco que viaja). El texto (cintillo, nota) acompaña; nunca es lo único. `check.py` marca los segmentos sin pieza no textual.

**Reglas de pantalla** (las comprueba la revisión visual, no el validador): un `topic` por franja (`slot`) a la vez; el cintillo arriba a la
izquierda, los hemiciclos arriba (y≈.25), contadores en el centro-bajo (y≈.62), subtítulos abajo (y≈.9): no pongas piezas ahí.
Textos cortos (el cintillo más largo del demo tiene 37 caracteres). Datos dudosos rotulados como tales («aproximado»). Todo lo que aparece sale del ledger.

## 6. Cómo mirar el resultado sin grabar

- Vista previa viva: `http://<servidor>:3000/api/v1/explainer/files/sandbox/<categoria>/<id>/index.html` (`?t=<segundos>` congela un cuadro).
- Con teselas nuevas, el primer cuadro tarda 1–2 min (Chromium con SwiftShader); el siguiente va rápido. Mira ambos formatos
  (ventana vertical ≈ 540×960 y horizontal 1280×720).
- Revisa a ojo: nada cortado por el borde ni por los subtítulos; ninguna pieza encima de otra; retratos con cara visible; el territorio
  resaltado es el correcto; el cintillo cambia con cada noticia. Anota en PLAN §7 tipos usados y tramos sin movimiento.
- Un tramo animado: 10–20 s alrededor de una noticia con hemiciclo o arcos (`?t=` en 5–6 valores consecutivos).
- Por pedido del usuario, no se generan capturas, miniaturas ni grabaciones definitivas hasta que él lo diga.

## 7. Paquete de publicación (no se deja para el final)

Cuando exista `lyrics.json`, lanza en paralelo el brief `briefs/BRIEF-noticiero-publicacion.md` con Terra 6.1 alto: miniaturas A/B/C, 3 títulos de
YouTube, Facebook y TikTok, descripción con capítulos por noticia (tiempos reales de `lyrics.json`), fuentes, créditos de las imágenes, tags y
comentario fijado, con la estrategia amarillista v1 y la categoría `node_politics`. Exige `.venv/bin/python -m src.core.explainer.publishing check <id>` con 0 errores (si no encuentra el episodio porque el sandbox no está registrado en el perfil, dilo al inicio del reporte; no lo registres tú). Sin emojis.
No ejecutes `build` (cambia la apertura y borra renders): lo decide el usuario.

## 8. Reporte final (formato)

1. **Qué falta o no se pudo verificar** (primero). 2. Modelo pedido / real por rol y motivo de cualquier respaldo.
3. Noticias elegidas (una línea cada una) y las que se descartaron y por qué. 4. Salida de `check.py` y qué se hizo con cada aviso.
5. Medios: cuáles, licencias, personas sin foto. 6. Duración, ppm, WER. 7. Qué se miró a ojo en 9:16 y 16:9. 8. Estado: «en preparación».

## 9. Errores ya vistos (del demo)

| síntoma | causa | arreglo |
|---|---|---|
| dos cintillos encimados | dos `topic` con el mismo `slot` a la vez | cada `topic` lleva `out` = ancla del siguiente; `check.py` lo avisa |
| el demo tenía dos casos (3 NOV / DESDE EL 3 DE ENERO; 5 NOV / CÁMARA DE DIPUTADOS) | slot repetido | ver `check.py` sobre el demo |
| hemiciclo hecho una mancha | `radius` grande con muchos `seats` | `dot` < 1 y `radius` coherente con `seats` (435 → radius 160, rows 11) |
| retrato sin foto sale como silueta | no hay imagen libre reciente | `medios.py --buscar` con otra consulta; si no, silueta y avisar |
| polígonos propios (Sahara) no calzan con la costa en vista inclinada | geometría ilustrativa | preferir regiones del dataset; rotular «aproximado» |
| ancla no encontrada | cifra o nombre escrito distinto al de `lyrics.json` | las cifras van como dígitos en el guion y el ancla igual (`@250`) |
| voz fuera de rango (ppm) | Gemini | aceptable 150–200 ppm y WER ≤ 0.2; regenerar (cuesta cuota) solo si ppm < 140 o > 210, WER > 0.25 o faltan palabras reales en `song.qc.json` (los números en dígitos que Whisper escribe como cifras no cuentan) |
| el servidor no recarga | uvicorn sin `watchfiles` | reiniciar el API solo con permiso y sin producciones activas |
