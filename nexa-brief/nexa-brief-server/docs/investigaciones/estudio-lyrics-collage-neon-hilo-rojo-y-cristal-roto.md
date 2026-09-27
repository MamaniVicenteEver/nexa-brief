# Estudio de 3 plantillas de letras + nueva plantilla "Cristal Roto"

Fecha: 2026-09-24 · Carpeta: `src/templates/`

## 1. Qué comparten las tres (el contrato del motor)

Las tres siguen el mismo esqueleto, que la plantilla nueva respeta:

- `index.html` **estático** (nunca se regenera) + `config.json` como colección
  `{ activeId, configs: [ caso ] }`, con fallback `config.json` → `assets/config.json`
  → `DEFAULT_CONFIG` embebido.
- Letra 100% desde `lyrics.json` de Whisper (`segments[].words[]`), disparada por
  `audio.currentTime`. Outro por el **final real del audio** (`leadSec`), no por la letra.
- PRNG `mulberry32(seed)` para todo lo aleatorio.
- Intro/outro con la misma pieza gráfica (flyer / carpeta / cartel neón).
- Grano SVG + viñeta como capas CSS fijas.
- `prompts/config_mapper.md`: el LLM solo devuelve UN caso; el pipeline fuerza
  `audio.src`, `lyricsUrl`, `bg.src` e `id`.

## 2. Estudio de cada una

### LYRICS-letras-de-neon — "Letras de Neón"
- **Idea:** letreros de tubo neón (Monoton / Archivo Black con contorno) que se
  encienden con parpadeo `steps()`, en columnas escalonadas que avanzan en
  direcciones ponderadas (`left/down/up`); cámara que persigue la última palabra.
- **Fuerte:** estética inmediata y reconocible; glow con `text-shadow` en 5 capas;
  calle roja punteada + CRT + grano.
- **Débil:** todas las palabras son la misma "voz" → a los 2 minutos es monótono;
  el fondo es una foto fija con `bgBreath` (casi no se mueve); no hay "evento"
  grande que marque secciones. **Coste:** 2 FPS en headless sin GPU (el glow de
  `text-shadow` a ese tamaño es carísimo).

### LYRICS-hilo-rojo — "Hilo Rojo"
- **Idea:** muro de detective true-crime. Cada palabra es una evidencia (recorte
  mecanografiado, titular con cinta, marcador rojo, sello CONFIDENCIAL) unida a la
  anterior por un hilo rojo SVG con comba. Cámara con zoom, ángulo holandés y
  paneo-látigo; la evidencia vieja amarillea pero **se queda**: al final el muro
  entero es la canción.
- **Fuerte:** la mejor narrativa de las tres (acumulación con sentido), 4 voces
  tipográficas, cámara con carácter, 100% generativa (no necesita media). ~21 FPS.
- **Débil:** paleta y concepto muy de nicho (true-crime); sin media real; el hilo
  y las chinches son lo único que "conecta" — no hay un clímax visual.

### LYRICS-collage-callejero — "Collage Callejero"
- **Idea:** mural de recortes de papel urbano: 4 voces (póster a tijera, stencil,
  marcador sobre post-it, letra hueca) que entran por los lados con golpe de papel,
  agrupadas en escenas de 2-4 palabras que salen volando como corte de plano;
  figuras recortadas en B/N y un caption a máquina.
- **Fuerte:** es la única de las tres que usa **imágenes reales** (8 figuras PNG);
  los cortes de escena dan ritmo; `clip-path` rasgado aleatorio.
- **Débil:** el `config.json` ya trae claves (`figurePositionWeights`,
  `figureScenesMin/Max`) que el `index.html` principal no usa (solo las variantes
  `index-V1-*`); fondo de cuaderno plano; el movimiento es siempre lateral.

### Resumen comparativo

| | Neón | Hilo Rojo | Collage | **Cristal Roto (nuevo)** |
|---|---|---|---|---|
| Voces tipográficas | 2 | 4 | 4 (+caption) | 3 + mono |
| Media real | foto fija | no | figuras PNG | video + figuras + foto/video del nicho |
| Fondo en movimiento | leve | no | no | sí (5 mundos que cambian) |
| Evento "clímax" | no | flash de sello | corte de escena | **estallido del vidrio** |
| Acumulación con sentido | no | sí (muro) | no | sí (daño/grietas) |
| FPS headless sin GPU | ~2 | ~21 | ~19 | **~8-10** |

## 3. La nueva: LYRICS-cristal-roto — "Cristal Roto"

**Concepto:** la letra se pinta sobre una **lámina de vidrio** parada delante de un
**mundo** nocturno en movimiento. Toma lo mejor de las tres: la acumulación con
sentido de Hilo Rojo (las grietas se acumulan), las voces múltiples y el uso de
figuras de Collage, y el brillo nocturno de Neón — y agrega algo que ninguna tiene:
un **clímax físico** que rompe la pantalla.

### Voces (una por frase)
- **impacto** — Big Shoulders Display 900: la palabra cae desde 1.9× con separación
  RGB (magenta/cian) y **agrieta el vidrio** con una telaraña que crece desde el
  punto de impacto (rayos quebrados con ramas + anillos concéntricos + astillado
  blanco al centro) y sacude la cámara.
- **grabado** — Unbounded 900 como **vidrio esmerilado**: dentro de cada letra se ve
  el mundo desenfocado y lechoso, con bisel de luz y un barrido de brillo.
- **vaho** — Caveat Brush: la lámina se empaña (niebla con gotitas de condensación)
  y la frase se **escribe con el dedo** de izquierda a derecha; las letras chorrean.
- **mono** — JetBrains Mono espaciada para artista/feats en intro y outro.

### El estallido
Las grietas se acumulan entre frases (**daño**). Cuando el daño llega a
`damageMax`, o cada 2-4 frases, o en una frase de 1-2 palabras: golpe final
(telaraña enorme + destello + sacudida) y **70 ms después** se congela una foto
exacta de mundo+vidrio, se parte en celdas radiales desde el último golpe (rayos ×
anillos, bordes compartidos → sin huecos) y cada fragmento vuela con su pedazo de
foto, refractado y con destellos al girar:
- `estallido`: hacia la cámara (escala + perspectiva desde el centro).
- `derrumbe`: se desprende en cascada desde el impacto y cae por gravedad.
- `rafaga`: barrido lateral como un viento.

Detrás aparece un **mundo nuevo**. Con la canción de prueba: ~29 estallidos en
4:10 (uno cada ~8.6 s).

### Mundos (`worlds[]`, cambian en cada estallido)
- Generativos: `bokeh` (luces de ciudad + estelas de faros), `rayos` (haces de
  discoteca), `aurora` (bruma de color con polvo luminoso).
- Media: `video` (con `tint` que colorea la toma, `lights` que suma bokeh encima) e
  `image` (Ken Burns). Cualquier mundo acepta `figure` (PNG recortado a contraluz
  con halo de color); el texto se corre al otro lado de la figura.
- Si el pipeline inyecta `bg` (bg.jpg / bg.mp4), se **intercala** con los mundos
  generativos. Si un archivo falta, ese mundo cae a bokeh (probado).

### Detalles de motor
- Cámara con ángulo holandés, tilt 3D leve, zoom por frase, golpe de zoom al
  estallar, sacudida por palabra, y reflejos del vidrio que se mueven al revés
  (parallax).
- Energía: graves reales vía `AnalyserNode` (solo si el `AudioContext` corre, para
  no silenciar el audio) + pulso por palabra como fallback; el mundo respira.
- Todo determinista: la misma canción + config dan el mismo video; las animaciones
  de los fragmentos son funciones cerradas del tiempo (preparado para portar a
  Remotion, que renderiza cuadro a cuadro).
- Robusto a configs generadas por IA: merge profundo contra el default embebido.
- Dev: `?seek=SEG`, `?manual=1` + `window.__cristal.setTime(t)` (capturas cuadro a
  cuadro), `?debug=1` (overlay con frase/modo/mundo/FPS).
- Responsive 16:9 y 9:16 verificado con capturas.

### Archivos
```
LYRICS-cristal-roto/
├── index.html                 motor estático
├── assets/
│   ├── config.json            caso demo ("Hola" — Dalex)
│   ├── song.mp3, lyrics.json  misma canción de prueba que Viaje Nocturno
│   ├── humo.mp4               humo en loop (copiado de Mirada Celeste)
│   └── figures/figura-0{1,2,3}.png  recortes de Collage (recortados + cuantizados, ~660 KB)
└── prompts/config_mapper.md   prompt del Config Mapper (solo mundos generativos)
```
Registrado en `templates.json` como `lyrics-cristal` (sin nicho en `niches.json`
todavía, igual que Collage Callejero).

## 4. Pendientes / riesgos

- **Rendimiento en grabación Playwright en vivo:** ~8-10 FPS en headless sin GPU
  (ya optimizado desde 4-5: mundo a 0.6× de resolución, tinte horneado, vaho a media
  resolución, grietas solo si existen). Es más rápido que Neón (2), Viaje Nocturno
  (2.3) y Caladas (4.3) en el mismo entorno, pero para 30 FPS reales hace falta GPU
  o el **port a Remotion** (el camino de producción de los nichos de letras).
- Para activarla en el pipeline falta un nicho en `niches.json`
  (`template_id: "lyrics-cristal"`, `required_config_keys` = las claves top-level
  del caso, `media_src_filename: "bg.jpg"` si se quiere foto de fondo).
- `?seek=` en tiempo real necesita un servidor con soporte de Range (el de
  `python3 -m http.server` no lo tiene); en `?manual=1` funciona siempre.

## 5. Estudio de color → variante `index1.html` (paleta "noche cálida")

**Problema detectado en `index.html`:** 4 tonos neón saturados compitiendo en el
mismo cuadro (magenta `#FF2E88`, cian `#35E0FF`, violeta `#8A5CFF`, ámbar
`#FFB347`) sobre fondos morados, texto blanco puro, y un acento de letra
**global**: el magenta/cian caía igual sobre humo rojo, rayos azules o la piel
cálida de las figuras. Resultado: la letra no pertenece al entorno.

**Criterios aplicados**
1. Una familia análoga cálida y desaturada (ámbar, cobre, terracota, champán,
   vino) para casi todos los mundos → los estallidos cambian de escena sin saltos
   bruscos de tono.
2. Un solo mundo frío (rayos en azul acero) como contrapunto, con acento de texto
   cálido (complementario suave) para que no se vuelva monocromo.
3. Texto marfil (`#F4EDE4`) en vez de blanco puro; halos y separación RGB más
   suaves y del color del mundo.
4. El acento de las letras sale del **mundo activo** (`accent` / `accent2` / `text`
   por mundo) — única lógica nueva, solo de color.
5. Figuras con grade cálido (`saturate(0.7) sepia(0.22)`) y halo del tono del
   mundo, para que piel y ropa entren en la paleta.
6. Fondos casi negros con sesgo de color (nunca morado plano), para que el vidrio
   y las grietas sigan leyéndose.

| Mundo | Fondo | Luces / tinte | Acento letra |
|---|---|---|---|
| Bokeh ámbar + figura | `#0A0605 → #1D130F` | ámbar, terracota, champán, ciruela apagada | `#F0B36E` |
| Humo cobre | video tintado `#A8684C` | luces ámbar/champán | `#F2C08C` |
| Rayos azul acero + figura | `#05070A → #0F1822` | acero, niebla azul, arena | `#E6C49A` (cálido) |
| Aurora vino y cobre | `#080506 → #170C11` | vino, cobre, ciruela, arena | `#EAA88E` |
| Humo brasa + silueta | video tintado `#8C3F33` | ámbar, terracota | `#F0BE85` |

Archivos: `index1.html` (copia de `index.html` con solo cambios de color) y
`assets/config1.json` (mismo caso, paleta nueva). `index1.html` busca primero
`config1.json`, después el `config.json` normal. `index.html` y `config.json`
quedan intactos.
