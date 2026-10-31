# AGENTS.md · NodeHistory (historia) — casa de pruebas

> **Antes que esto, leé `../EXPLAINER.md`** (motor, pipeline, errores ya vistos, diseños nuevos,
> checklist) y `../../_tools/explainer-kit/AGENTS.md` (el pipeline de 10 pasos completo).
> Acá está solo lo propio de historia. Categoría `node_history` · carpeta `nodehistory` ·
> estrategia en `nexa-brief-server/niches.json → categories.node_history.strategy` (la fuente manda si cambia).

## 1. Estrategia (de `niches.json`, 2026-10-10)

- **Público**: hispanohablantes de 18 a 55 años que disfrutan historias reales contadas como un thriller.
- **Ángulo**: **un solo momento decisivo** (una noche, una decisión, un error), no una biografía completa.
- **Tono**: tensión contenida, **respeto por las víctimas, sin morbo**.
- **Fórmulas de título**: `La noche que {hecho}` · `{N} segundos que {consecuencia}` ·
  `Nadie le creyó a {persona}… hasta que {hecho}` · `El error que {consecuencia}` · `Por qué {hecho} pudo no pasar nunca`.
- **Ejemplos**: "La conferencia de prensa que derribó el Muro de Berlín" · "Titanic: los 37 segundos que
  dejaron tantos botes vacíos" · "El hombre que rompió Enigma y fue castigado por ganar".
- **Temas sugeridos**: caída del Muro ✓ (hecho), Turing y Enigma ✓ (hecho), crisis de los misiles en Cuba,
  Chernóbil: la noche del reactor 4, el día que Pompeya desapareció, la carrera al Polo Sur.
- **Hashtags**: `#historia #documental #historiareal #sabiasque`.
- **Reglas**: las 4 comunes (título verdadero, 40 caracteres, sin mayúsculas sostenidas/emojis, cifras en
  el guion) + **muertes y guerras con respeto, sin morbo ni imágenes explícitas**.

## 2. Diseños (10 propios)

| diseño · canal | va bien con (`topics` del design.json) | ojo |
|---|---|---|
| `binary` · NODEHISTORY | historia, personajes, biografías, momentos decisivos, guerras, ciencia histórica | el probado: 3 videos reales. Retratos frontales con fondo liso para `binary.portrait` |
| `enmienda` · EXPEDIENTE | historia política, derechos civiles, justicia, leyes, guerra fría, protestas, crímenes de Estado | B/N documental (ref. *13th*). Sin `common.lyric`: su golpe es `enmienda.word` |
| `pelicula` · ARCHIVO 35 | guerras, siglo XX, política, biografías, efemérides, inventos antiguos | sepia + años gigantes; letra grande = `pelicula.quote` |
| `periodico` · TITULARES | crónica, periodismo, sucesos, efemérides, política, ciudades | letra grande = `periodico.quote`; 0,3–1,8 s/cuadro de render |
| `carta` · CARTA | biografías, siglo XX, memoria, familias, archivo | sin letra grande a propósito (`carta.title`/`carta.proyecto`) |
| `acuarela` · TINTA | líneas de tiempo, efemérides, guerras, biografías | papel gris, rojo ladrillo solo para fechas/título |
| `cronica` · CRÓNICA | siglo XX, ciudades, política, guerras, archivo | 3D oscuro con DOF; `year` ≤ 12 caracteres |
| `collage` · HEMEROTECA | aniversarios, conmemoraciones, países, instituciones | recortes de archivo (ref. Arab Revolt) |
| `grunge` · CRUDO | rebeldía, protestas, música, cultura urbana, contracultura | una palabra por plano; letra grande = `grunge.stamp` |
| `pop` · DUOTONO | cultura, historia reciente, diseño, música, deporte | menta/violeta; fotos con zonas oscuras para el texto |

Leé el `DESIGN.md` del diseño elegido antes del storyboard (parámetros, límites y ejemplos).
**Los 9 diseños nuevos (todos menos binary) todavía no tienen un video real**, solo la demo: el primero
que hagas con uno es una prueba del diseño también. Sus `*.introv1/introv2` no pasan `check` como
primer beat (exige `*.title`): abrí con `<diseño>.title`. Todos usan voz Charon.

## 3. Buenos y malos temas

| bien | mal |
|---|---|
| La conferencia de prensa que abrió el Muro (9 nov 1989) | "La historia de Alemania en el siglo XX" |
| Los minutos entre el iceberg y los botes (Titanic) | detalle gráfico de muertes, imágenes de cadáveres |
| La noche del reactor 4 (Chernóbil) | teorías conspirativas, "lo que no te cuentan" sin fuentes |
| Turing: el código imposible y el castigo | conflictos armados en curso, fechas recientes aún en disputa |

## 4. Dónde investigar

- Archivos nacionales y museos (Bundesarchiv, Library of Congress, National Archives, museos del tema),
  informes oficiales (las investigaciones británica y estadounidense del Titanic que usó Codex), prensa
  reconocida de la época, enciclopedias (Britannica) y obras de historiadores.
- Separar **mitos** (anotarlos en PLAN §3 como "no se dice"), y aclarar cifras que no coinciden entre fuentes.
- Fotos: Wikimedia Commons (Bundesarchiv, LoC, US Navy…), consultas en inglés con nombre + año.
  Revisá el pie de foto en Commons (a veces trae fecha/lugar erróneos).

## 5. Ejemplo trabajado (idea de prueba)

Tema de la estrategia: "Chernóbil: la noche del reactor 4". Probar además un diseño nuevo en video real.

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new pelicula chernobil-reactor-4 --title "La noche del reactor 4" --folder sandbox/nodehistory
# PLAN.md: punto crítico (la prueba de seguridad, minuto a minuto), mitos a evitar, víctimas con respeto
.venv/bin/python $M search "Chernobyl nuclear power plant 1986"
.venv/bin/python $K voice chernobil-reactor-4
.venv/bin/python $K transcribe chernobil-reactor-4
# storyboard: pelicula.title en t=0 (no introv1), pelicula.year para horas/fechas, pelicula.quote para 4–6 frases
.venv/bin/python $K check chernobil-reactor-4      # "0 common.lyric" es esperable en pelicula
.venv/bin/python $K sheet chernobil-reactor-4 --orient both
.venv/bin/python $K manifest chernobil-reactor-4
```

## 6. Lecciones de NodeHistory

- **Hay 12 videos en producción: 3 reales** (`turing-enigma`, `muro-de-berlin`, `codex-titanic`, todos
  binary) **+ 9 demos** (`<diseño>-demo`, `demo: true`) que son **el mismo guion del Muro de Berlín**
  con 7 fotos repetidas. No publiques más de uno de esa serie (riesgo "contenido no auténtico") ni copies
  su práctica de repetir fotos: en un video real `check` lo marca y hay que justificarlo.
- Para un tema nuevo, imitá el nivel de `turing-enigma` (arco con duelo y reparación) y `muro-de-berlin`
  (clímax 1.0 en s09 de 17, urgencia → alivio).
- **Titanic (Codex)**: buena investigación, pero tono de informe, unidades en yardas, una frase con la
  lógica invertida, `waves` usado como agua (son ondas de radio: hay icono `water`), foto del iceberg 2
  veces y barco 3, 7 letras grandes. Y su fórmula "37 segundos" ya está usada: no la repitas.
- Nombres extranjeros: Whisper los parte ("Bornholmer Strasse" → "bonhomme estrase"); la limpieza contra el
  guion los arregla, pero escribí en el guion los difíciles como se leen.
- `muro-de-berlin` salió con la voz en 3 partes (503) a 138 ppm, en el borde alto de binary (115–130).
- **Canal en el cierre**: los diseños traen `outro.channel = "NODETECH"` por defecto. En historia, sobreescribí
  en `assets/config.json` del video (`configs[0].outro.channel` y `handle`; ver `../EXPLAINER.md` §4) con el
  nombre que confirme el usuario. Los manifests de `turing-enigma` y `codex-titanic` todavía dicen `UNO CERO`
  (nombre viejo de binary, hoy NODEHISTORY).
- Si un tema es de agua/mar: `binary.convoy` es lo más cercano; no hay más componentes de barcos.

## 7. Promover

`kit.py promote <id>` → `nodehistory/<id>/` (exige `status: listo`), después `kit.py poster <id>`.
Checklist: `../EXPLAINER.md` §7, más: respeto en temas de muertes revisado en guion, fotos y textos.

> Al terminar una prueba, sumá acá (§6) lo que funcionó y lo que no.

## 8. Prototipo de mapas satelitales (2026-10-22)

- `fronteras-demo/` + motor propio `_mapas/mapas.js` (réplica de `../referencias/nodehistory/mapas-con-banderas/`, 3 videos 9:16):
  satélite NASA Blue Marble pasado a Mercator, países con color + borde neón, rayado, flechas, banderas,
  año, subtítulos amarillos y cámara que viaja. Escena = solo datos (`assets/scene.json`); ver su `PLAN.md`.
  Voz/texto reutilizados del Muro (0–58 s). Es prototipo: si se aprueba, pasarlo a diseño del explainer-kit
  (componentes `mapa.*`) en vez de mantener un motor aparte.
- Blue Marble de diciembre trae nieve en Europa: usar julio (`world.topo.bathy.200407`). El servidor de
  NASA corta la descarga del tile de 90 MB: reanudar con `curl -r <bytes>-` en bucle.
- Rellenos: `multiply` (color aclarado) + `screen` + `overlay` deja ver el relieve como la referencia.
  En zoom muy cercano dentro de un país, sacar su relleno (si no, la pantalla queda de un solo color).
- Polígonos propios (corte de un país, Berlín Oeste) se proyectan punto a punto y se recortan con el
  clip del canvas: así no importa el sentido de giro (d3 invierte polígonos esféricos mal orientados).
- Mismo reproductor que la pizarra: tiempo desde `audio.currentTime`, botón ▶ si el navegador bloquea el
  autoplay (antes corría mudo y se quedaba en el último cuadro, Leipzig).
- 2026-10-23 · **Motor de mapas modular** (`_mapas/`: geo, camera, layers, flags, places.json, mapas.js) sobre el
  núcleo `../_proto/proto.js` (intro, cierre, subtítulos más abajo, reproductor). Formato: `_mapas/ESCENA.md`.
  Video completo `bolivia-mar/` (8:01, Codex guion + storyboard, Claude revisión). Fábrica: `../_proto/FABRICA.md`.
  Lugares por nombre (303 + 240 alias), 148 banderas, cámara con vuelo van Wijk (aleja y acerca sola),
  regiones `poly` recortadas contra la tierra y `within` un país. Satélite: `_mapas/media/sat-{world,europa,sudamerica}.jpg`
  (para otra región: `_mapas/tareas/sat.py` sobre un tile Blue Marble de julio).
