# explainer-kit · fábrica de videos explicativos narrados

Motor + diseños + herramientas para producir en serie documentales cortos (3–4,5 min, 9:16 y
16:9) donde cada frase dibuja algo en el instante en que la voz lo dice.
**El kit no pertenece a ningún video**: los videos viven en `../<carpeta de categoría>/<id>/` (`nodetech/`, `nodehistory/`…).

- **¿Sos una IA o vas a producir un video?** → leé [`AGENTS.md`](AGENTS.md) (pipeline 1–10, roles, reglas).
- **¿Querés ver los componentes?** → `python3 -m http.server -d src/templates 8800` y abrí
  `http://127.0.0.1:8800/_tools/explainer-kit/showcase/`.
- **Lista de componentes con parámetros** → [`CATALOG.md`](CATALOG.md) (generado).

## Diseños (uno por canal)

| diseño | canal (provisional) | temas | estilo | voz |
|---|---|---|---|---|
| `binary` | **UNO CERO** | historia, personajes | todo con dígitos 0/1 que viajan de forma en forma | Charon |
| `rough` | **PROTOTIPO** | tecnología, innovación | dibujado a mano, lima / blanco / negro | Sadaltager |

Cada diseño = `designs/<id>/design.json` (nombre, canal, paleta, fuentes, voz, cierre "gracias por
ver / suscríbete", scripts) + `DESIGN.md` (estilo) + `components/`. Para agregar un diseño nuevo:
copiar una carpeta, cambiar el `design.json` y sumarlo a `designs/index.json`.

## Un video = datos

```text
<carpeta de categoría>/<id>/   ← src/templates/nodetech/, nodehistory/, …
├── index.html          ← 1 línea útil: carga engine/loader.js con data-design (no se edita)
├── PLAN.md             ← investigación, tesis, arco, gancho, mapa visual, medios (lo escribe la IA)
├── publish.json        ← títulos, descripción, tags (lo escribe la IA)
├── manifest.json       ← todo lo que se sabe del video (kit.py manifest)
├── assets/ config.json · script.json · song.mp3 · lyrics.json · storyboard.json · media/ + CREDITS.md
├── work/               ← partes de audio, control, hojas de revisión (no va a git)
└── render/             ← mp4 (no va a git)
```

## Herramientas (todas por `tools/kit.py`)

`new` → (PLAN + guion + medios a cargo de la IA) → `voice` → `transcribe` → (storyboard) → `check` →
`sheet` → `manifest` → `render`. Además: `tools/media.py` (buscar/bajar fotos con licencia),
`status`, `preview` (sin voz), `catalog`.

## Principios

- **Determinismo**: cada cuadro es función del tiempo (audio o `seek(t)`) → render cuadro a cuadro.
- **Gancho**: el título gigante se arma antes de la primera palabra.
- **La intensidad del guion manda el ritmo visual** (clímax: letras grandes; duelo: planos vacíos).
- **Un solo acento de color por plano.**
- **La documentación sale del código** (`Kit.register` → CATALOG.md y galería).

Historial de experimentos (estudio de voz, DeepSeek): `lab/`.

## Reproducción controlada (app) — `engine/player.js`

Con `?controls=1` el cargador suma `engine/player.js`, el control de reproducción **global** del
motor: play/pausa, ir a un segundo, ±N s y volumen, por el mismo protocolo postMessage
(`nexa-template-*`) que las plantillas de NodeMotion. Así el reproductor de la app (barra de
tiempo, pantalla completa, móvil/desktop) funciona igual con todos los diseños y videos.
En ese modo el reloj del motor es solo `audio.currentTime` y se sigue dibujando en pausa.
**Ningún diseño implementa controles propios**; el render cuadro a cuadro no usa este modo.
