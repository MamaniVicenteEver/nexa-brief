# Guía · medios (imágenes y video)

> **Diseño imperio:** leer [imperio-production.md](imperio-production.md) antes de planificar: video visible 8–16 s, fotografía 6–12 s y sonido de biblioteca en una capa sobre la voz continua. Es una política específica del estilo; los mapas/rótulos no son medios documentales y las demás familias conservan sus reglas.

Resultado de este paso: `assets/media/*.jpg` + `assets/media/CREDITS.md` (y PLAN.md §8 cumplido).
Herramienta: `tools/media.py` (busca, filtra licencias, baja, recodifica y anota créditos).

## 1. Cuántas y cuáles

- **Fotos según la duración** (`kit.py status`; 4–8 en 5 min, 8–16 en 10, 24–48 en 30): como máximo
  una cada ~25–35 s. El resto del video lo dibujan los componentes.
- Se usan para lo que un dibujo NO puede decir: **la cara del protagonista**, **el lugar real**,
  **el objeto real** y **el documento real**. Para conceptos (una idea, un número) va un componente.
- Orden de prioridad: 1) protagonista (retrato), 2) el lugar/objeto del punto crítico, 3) el
  momento del clímax si hay foto, 4) el antagonista o la contraparte, 5) el legado/hoy.

## 2. Qué foto sirve (por diseño)

| diseño | componente | foto ideal | evitar |
|---|---|---|---|
| binary | `binary.portrait` | retrato **frontal**, cara grande, **fondo liso** (el fondo se vuelve negro solo), buena luz | grupos, caras chicas, fondos con mucho detalle |
| binary | `binary.frame` | foto documental de lugar/objeto/multitud; se ve en B/N dentro de un marco de glifos | fotos con texto superpuesto o marcas de agua |
| rough | `rough.photo` | personas, máquinas, pantallas, lugares; se muestra B/N (o lima) con zoom lento; `focus:[x,y]` apunta al sujeto | imágenes muy oscuras o de baja resolución |

- Lado mayor **≥ 1000 px** (mejor ≥ 1400). El script recodifica a ≤ 1600 px.
- Nada de fotos con marcas de agua, collages, capturas de TV con logos, ni imágenes generadas con IA
  presentadas como reales.
- Personas reales: solo fotos documentales/publicas; nada que las ridiculice.

## 3. Dónde buscar (en este orden)

1. **Wikimedia Commons** (`media.py search "<consulta en inglés>"`): fotos históricas, retratos,
   NASA/ESA, archivos (Bundesarchiv, Library of Congress, US Navy…). Probar 2–4 consultas por
   imagen: nombre + año, lugar + evento, objeto + "museum".
2. **Archivos de dominio público** que suben a Commons: NASA, NOAA, US Army/Navy, Library of Congress.
3. **Pexels, Pixabay y Unsplash**: personas, lugares y objetos contemporáneos concretos cuando Commons
   no tiene una imagen adecuada. Nunca los uses para representar como documental a una persona histórica.

Licencias aceptadas: dominio público, CC0, CC BY, CC BY-SA, Pexels License, Pixabay Content License
y Unsplash License. **Rechazar**: NC
(no comercial), ND (sin derivadas), "fair use", "all rights reserved" o licencia dudosa.
Las CC BY/BY-SA exigen crédito: va en la descripción del video (manifest/publish.json).

## 4. Comandos

```bash
K=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K search "Schabowski press conference 1989"           # ✓ = licencia aceptada
.venv/bin/python $K get <video-id> "File:Bundesarchiv Bild 183-1989-1109-030, Berlin, Schabowski auf Pressekonferenz.jpg" schabowski.jpg
.venv/bin/python $K list <video-id>
```

Nombres de archivo: cortos, minúsculas, sin tildes ni espacios (`schabowski.jpg`, `muro-1961.jpg`).
En el storyboard se usan como `"src": "assets/media/schabowski.jpg"`.

## 5. Verificar ANTES de usar

- Mirar la imagen (un modelo con visión o una persona): ¿muestra lo que dice el guion? ¿la cara se
  ve? ¿no hay marcas? Si el agente no puede ver imágenes, lo declara en PLAN.md §10 como riesgo.
- Revisar la descripción del archivo en Commons: fecha y lugar correctos (los archivos a veces
  traen pies de foto erróneos).

## 6. Clips de video (`common.clip`)

Antes de buscar cada recurso, escribí en PLAN §8 la frase `at`, el sujeto concreto que debe verse en `shows` y al menos dos consultas para `query`; copialos al beat después de la transcripción. La primera palabra concreta de cada consulta debe nombrar al sujeto (por ejemplo, `judge` o `court`). `media.py search-concept "juez en audiencia" --query "judge in courtroom hearing" --query "judge presiding hearing"` busca varias formulaciones en Pexels, Pixabay y Commons. Revisá miniaturas y fuente; la puntuación ordena candidatos, no confirma visualmente su contenido. Si no aparece un clip relevante, usá una foto relevante con movimiento lento. Reusá solo si ayuda a visualizar esa frase. Tras mirar la hoja, completá `media_review` en cada beat con foto/clip; si el beat combina foto y video, usá un objeto con una frase por ruta (`{"assets/media/foto.jpg":"Se ve…", "assets/media/clip.mp4":"Se ve…"}`). El manifest registra un renglón por medio. Los límites de relleno están en `media-relevance.json`.

En producciones nuevas, distribuí fotos y clips por todos los actos: `kit.py check` bloquea huecos
mayores de 75 s. Con política v5, la foto prefiere 5–10 s (error < 4 o > 12) y el video 8–16 s
(error < 8 o > 18); cada archivo se usa como máximo dos veces. Mantené cada foto varios segundos
con el movimiento lento del componente. En videos de 8 min o más incluí dos tramos de video reales
de ≥ 12 s; el check permite combinar clips y splits. Las políticas anteriores conservan sus límites.

Unos segundos de metraje real donde el movimiento cuenta algo que una foto no: un cohete que
despega, una multitud que avanza, una fábrica, una audiencia en el tribunal. No
reemplazan a las fotos de personas (un retrato sigue siendo foto) ni a los diagramas.

**Cuándo**: 2–8 por cada 13 min (`lengths.json → per_minute.clips`; `kit.py check` avisa), en los
momentos clave del arco: la apertura de un capítulo, el punto crítico, el cierre. Nunca dos seguidos.

**Dónde buscar** (`tools/media.py`, mismas licencias que las fotos):
```bash
M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $M search "rocket launch" --type video --source commons   # NASA, archivos históricos (PD / CC)
.venv/bin/python $M search-concept "abogado con documentos" --query "lawyer reviewing legal documents" --query "attorney with paperwork"  # Pexels, Pixabay y Commons
```
**Bajar y preparar** (un nombre `.mp4` = clip):
```bash
.venv/bin/python $M get <video-id> pixabay-video:198890 abogado-documentos.mp4 --start 2 --dur 15
.venv/bin/python $M get <video-id> "File:Apollo 11 launch….ogv" lanzamiento.mp4 --start 30 --dur 12
```
Recorta (`--start`, `--dur` ≤ 20 s), quita el audio, pasa a H.264 30 fps con lado máximo 1920 y un
keyframe cada 6 cuadros (así el render salta al cuadro exacto rápido) y anota el crédito en
`CREDITS.md`. La descarga original nunca se guarda en el video (es un dato no confiable: solo la lee ffmpeg).

**En el storyboard**:
```json
{ "at": "ante el juez", "shows": "juez preside una audiencia", "query": "judge presiding courtroom hearing",
  "media_review": "Se ve una persona con toga en el estrado; audiencia no verificable en este cuadro",
  "use": "common.clip", "params": { "src": "assets/media/juez.mp4", "caption": "Audiencia judicial", "sub": "PEXELS" } }
```
- `layout` y `size`: para el apoyo preferido de video completo con texto, poné `layout: "full"`
  y `caption` ligado a la frase narrada. Elegí `textSide` para dejar libre el foco y usá
  `textColor: "mix"` con `accentWords` o `^marcas^` para destacar una palabra. Para foto en cuadro,
  poné `layout: "frame"`; `auto` sigue el diseño (`binary` y `rough`: marco centrado al 92 %).
- **Duración**: el clip se ve completo, mínimo `design.json → defaults.minDur["common.clip"]` segundos
  (binary y rough: 8 s). Si la voz pasa enseguida al beat siguiente, el MOTOR alarga el clip y corre
  los beats que caían dentro (`engine/kit.js → resolveBeats`); no hace falta `dur` ni `offset` a mano.
  Para videos nuevos de ≥ 8 min, prepará dos tramos de video de **≥ 12 s**. La política v5
  prefiere **8–16 s** por video; la recomendación histórica de 12–18 s queda para políticas anteriores.
- `start` y `rate` (0,5 = cámara lenta): el clip tiene que durar `start + duración del beat × rate`;
  si no alcanza, usá `loop` o reducí `rate`; `check` bloquea el cuadro congelado.
- `tone`: `design` (el tratamiento de color del diseño, `design.json → defaults.clip.filter`) o `color`.
- El clip es mudo: la voz manda. Si el texto del clip se lee, que no compita con los subtítulos.

**Revisar**: `kit.py sheet <id>` muestra el cuadro del clip en su segundo; para verlo en movimiento,
`kit.py render <id> --seconds N` (preview) o el modal de la app.

**Cómo funciona** (para quien toque el motor): `engine/kit.js` acepta parámetros `type:"video"`, los
precarga, y `ctx.clip(src, segundo)` devuelve el `<video>` para dibujarlo como una imagen. En vivo el
clip corre y se corrige si se desfasa; en capturas y en el render cuadro a cuadro (`__promo.seek`)
salta al cuadro exacto y espera el `seeked` antes de capturar. Un diseño nuevo solo declara
`defaults.clip` (`filter`, `frame`, `dim`, `layout`, `size`) y, si quiere clips con duración mínima,
`defaults.minDur: {"common.clip": 8}` en su design.json, y suma `designs/common/clip.js` a `scripts`.

## 7. Logos de marcas e instituciones

El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. `common.logo` está obsoleto. Usá el parámetro `logo` del componente visual; `logoName` permite fallback de texto, `logoPos` y `logoSize` ajustan la ubicación. Conservá forma y colores; `logoInvert` da una versión clara sobre fondos oscuros. La licencia del archivo no concede derechos sobre la marca; verificá las restricciones de Commons.

```bash
M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $M logo-search "OpenAI logo 2025"
.venv/bin/python $M logo-get <video-id> "File:OpenAI logo 2025 (wordmark).svg" openai.svg
```

Elegí el archivo oficial correcto en Wikimedia Commons. `logo-search` prioriza SVG; `logo-get` rechaza PNG opaco y recorta los márgenes transparentes. Guarda en `assets/media/logos/` y acredita en `assets/media/CREDITS.md`. Si no hay archivo confiable, usá solo `logoName`. No inventes logos.

```json
{ "at": "OpenAI", "use": "rough.photo", "params": {
  "src": "assets/media/openai-sede.jpg", "caption": "OpenAI",
  "logo": "assets/media/logos/openai.svg", "logoName": "OpenAI" } }
```

## Split de texto con video

Además de los clips completos con `common.clip`, `rough.introv2` permite un titular grande junto a un MP4 local mudo, fundido con el fondo; `binary.introv2` ofrece el mismo reparto con el video convertido a glifos. Ejemplo de beat:

```json
{"t": 42, "dur": 8, "use": "rough.introv2", "params": {
  "text": "UNA LLAMADA\nURGENTE", "video": "assets/media/llamada.mp4",
  "poster": "assets/media/llamada.jpg", "start": 2, "rate": 1, "loop": true, "focus": "xMaxYMid"
}}
```

`poster` (o `src`) es respaldo; `focus` usa posiciones SVG. En binary se usan `focusX` y `focusY` entre 0 y 1. El clip sigue el reloj del beat y permanece mudo. Todo beat con video dura ≥ 8 s; para videos de ≥ 8 min, incluí al menos dos tramos de ≥ 12 s entre clips y splits. Si el archivo es corto, activá `loop` o reducí `rate`; no congeles el cuadro final.
