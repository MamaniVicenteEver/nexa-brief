# Guía · medios (imágenes y, más adelante, video)

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
3. **Pexels** (`--source pexels`): solo para imágenes genéricas modernas (servidores, ciudad,
   teclado). Nunca para personas históricas.

Licencias aceptadas: dominio público, CC0, CC BY, CC BY-SA, Pexels License. **Rechazar**: NC
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

Unos segundos de metraje real donde el movimiento cuenta algo que una foto no: un cohete que
despega, una multitud que avanza, servidores con luces, una fábrica, una ciudad de noche. No
reemplazan a las fotos de personas (un retrato sigue siendo foto) ni a los diagramas.

**Cuándo**: 2–8 por cada 13 min (`lengths.json → per_minute.clips`; `kit.py check` avisa), en los
momentos clave del arco: la apertura de un capítulo, el punto crítico, el cierre. Nunca dos seguidos.

**Dónde buscar** (`tools/media.py`, mismas licencias que las fotos):
```bash
M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $M search "rocket launch" --type video --source commons   # NASA, archivos históricos (PD / CC)
.venv/bin/python $M search "server room" --type video --source pixabay      # genérico moderno (Pixabay License)
.venv/bin/python $M search "office team" --type video --source pexels       # requiere PEXELS_API_KEY válida
```
**Bajar y preparar** (un nombre `.mp4` = clip):
```bash
.venv/bin/python $M get <video-id> pixabay-video:380334 servidores.mp4 --start 2 --dur 6
.venv/bin/python $M get <video-id> "File:Apollo 11 launch….ogv" lanzamiento.mp4 --start 30 --dur 8
```
Recorta (`--start`, `--dur` ≤ 20 s), quita el audio, pasa a H.264 30 fps con lado máximo 1920 y un
keyframe cada 6 cuadros (así el render salta al cuadro exacto rápido) y anota el crédito en
`CREDITS.md`. La descarga original nunca se guarda en el video (es un dato no confiable: solo la lee ffmpeg).

**En el storyboard**:
```json
{ "at": "miles de servidores", "use": "common.clip",
  "params": { "src": "assets/media/servidores.mp4", "caption": "Un centro de datos", "sub": "PIXABAY" } }
```
- `layout` y `size`: **no los pongas** (quedan en `auto`). Los decide el diseño en
  `design.json → defaults.clip.layout/size` (binary y rough: `frame` centrado al 92%, como las fotos,
  con el rótulo debajo del marco). Solo fijalos si un clip concreto lo necesita de verdad.
- **Duración**: el clip se ve completo, mínimo `design.json → defaults.minDur["common.clip"]` segundos
  (binary y rough: 6 s). Si la voz pasa enseguida al beat siguiente, el MOTOR alarga el clip y corre
  los beats que caían dentro (`engine/kit.js → resolveBeats`); no hace falta `dur` ni `offset` a mano.
  Por eso bajá clips de **6–8 s** (`--dur 8`).
- `start` y `rate` (0,5 = cámara lenta): el clip tiene que durar `start + duración del beat × rate`;
  si no alcanza, `check` avisa y se congela el último cuadro.
- `tone`: `design` (el tratamiento de color del diseño, `design.json → defaults.clip.filter`) o `color`.
- El clip es mudo: la voz manda. Si el texto del clip se lee, que no compita con los subtítulos.

**Revisar**: `kit.py sheet <id>` muestra el cuadro del clip en su segundo; para verlo en movimiento,
`kit.py render <id> --seconds N` (preview) o el modal de la app.

**Cómo funciona** (para quien toque el motor): `engine/kit.js` acepta parámetros `type:"video"`, los
precarga, y `ctx.clip(src, segundo)` devuelve el `<video>` para dibujarlo como una imagen. En vivo el
clip corre y se corrige si se desfasa; en capturas y en el render cuadro a cuadro (`__promo.seek`)
salta al cuadro exacto y espera el `seeked` antes de capturar. Un diseño nuevo solo declara
`defaults.clip` (`filter`, `frame`, `dim`, `layout`, `size`) y, si quiere clips con duración mínima,
`defaults.minDur: {"common.clip": 6}` en su design.json, y suma `designs/common/clip.js` a `scripts`.
