# promo-mono · Promo Mono

Promo de marca, servicio, causa o evento con **interfaz minimalista en blanco y negro**:
logotipo, botón de reproducir, tarjetas y metraje en semitono, palabra partida por
ventanas de video, lluvias de píldoras de texto, línea que se vuelve garabato, píldora
con pin, cifras que parpadean, patrón óptico, texto espaciado, móvil con chat, cupones,
campo de código y contacto final. 15 escenas, intro, 2 cierres y 4 transiciones propias,
todo elegido y parametrizado desde el JSON.

Complementa la [guía común de NodeMotion](../../DESIGN.md) y la
[guía de autoría](../../../../../docs/nodemotion-template-authoring.md). Creado el
2026-11-14 directamente en producción por instrucción del usuario.

## 1. Referencia

Anuncio de una app de transporte (60 s, 736×414) entregado por el usuario. Se analizó
cuadro a cuadro y se generalizó: la referencia estaba hecha para una sola marca; aquí
cada pieza recibe textos, medios y parámetros por datos. No se usan su marca, su
audio, sus textos ni sus clips. La demo usa una marca ficticia (**Rutalia**).

| Momento de la referencia | Componente |
|---|---|
| Logotipo centrado sobre negro | `intro`, `outroV1` |
| Botón ▶ y línea que crece | `playline` |
| Abanico de fotos en semitono | `cardfan` |
| «binge-watch» repetido con fotos en el hueco | `wordgrid` |
| Titular tecleado rodeado de chips «Let's go …» | `chips` (`mode: float`) |
| Chips que caen y se amontonan | `chips` (`mode: pile`) |
| «—— Let's go» y la línea que se vuelve garabato | `linetext` |
| Píldora con pin que se escribe | `pin` |
| Matriz de puntos que resuelve en metraje; subtítulos «– Let's go …»; icono de sonido o pausa | `footage` (`dotsIn`, `icon`, `style`) |
| Rejilla de dígitos que deja 50 % / 100 % / 30 % | `numbers` |
| Patrón óptico con botón de pausa | `pattern` |
| «W H E N  Y O U / S P O T  A» y «LET'S GO» apilado | `spaced` (`echo`) |
| Móvil punteado con burbujas de chat | `phonechat` |
| Cupones que vuelan + «Promo Code» | `coupon` |
| Móvil con el código y botones | `codeinput` |
| Móvil con número enorme | `contact` |

Añadidos para estandarizar: `headline` (titular genérico de reserva), `outroV2`
(chips que se apartan + píldora + marca) y las transiciones `dots`, `lineSweep`,
`blink`, `pillPop`.

## 2. Estructura

```text
src/templates/_tools/nodemotion/promo/
├── compiler/build/promo-mono.spec.json   spec: títulos, CSS, config por defecto y guion demo
├── compiler/build/mono.js                lista de componentes que carga el orquestador
├── compiler/build/component-player.js    orquestador COMPARTIDO de diseños por componentes (nuevo estándar)
└── designs/promo-mono/                    fuente única del motor (extraída; manifest, document, scripts, runtime)
src/templates/nodemotion/commercial/promo-mono/   demo
├── index.html, assets/config.json, assets/lyrics.json (guion), assets/song.mp3, assets/media/
├── components/  kit.js · transitions.js · intro.js · scenes.js · outro-v1.js · outro-v2.js
├── showcase/components.json (fuente de piezas) · showcase/index.html (galería)
└── info.json · thumbnail-style.json · CREDITS.md · DESIGN.md
```

El motor = `core.js` (núcleo común de promos: guion → escenas, medios, pistas
deterministas, transiciones del núcleo) + `component-player.js` (valida el config,
carga los componentes, decide intro/outro y transiciones) + `components/`. Para
regenerar: `.venv/bin/python src/templates/_tools/nodemotion/promo/compiler/build/build.py promo-mono`.

## 3. Componentes y parámetros

Todos leen sus **renglones** del segmento del guion (`lines`) y sus parámetros de
`config.scenes[i]` (valores fuera de rango → aviso en consola y valor corregido).
Catálogo completo con tipos, opciones y límites: `showcase/components.json`.

| Escena | Renglones | Parámetros (defecto) |
|---|---|---|
| `headline` | 1: titular · 2: bajada | `textIn` type\|rise\|pop\|fade\|wipe\|cut (type), `size` 0.5–1.6 (1), `underline` (false) |
| `playline` | 1: texto opcional | `lineLen` 0.05–0.6 (0.18), `icon` play\|pause\|pin, `size` 0.5–2 (1) |
| `cardfan` | 1: palabra detrás | `count` 3–10 (7), `spread` 4–20° (11), `cell` 3–14 (5) |
| `wordgrid` | 1: palabra (con «-» se parte ahí) | `rows` 3–7 (5), `grade` mono\|none, `split` auto\|hyphen\|middle |
| `chips` | 1: titular · 2+: chips (si hay ≥4) | `mode` float\|pile, `count` 4–60 (26), `emoticons` (true), `headline` (true) |
| `linetext` | 1: texto | `squiggle` (true), `lineLen` 0.1–0.6 (0.32) |
| `pin` | 1: texto de la píldora | `size` 0.5–2 (1), `outline` (true) |
| `footage` | 1: subtítulo | `style` dots\|squares\|gray, `cell` 3–20 (7), `dotsIn` (false), `icon` none\|bars\|pause\|play, `subtitle` dash\|plain\|none, `zoom` (true) |
| `numbers` | 1..n: cifras finales | `flicker` 0.05–0.4 s (0.12), `collapse` 0.2–0.9 (0.45) |
| `pattern` | — | `icon` pause\|play\|none, `cell` 20–120 (56), `speed` 0.2–4 (1.4) |
| `spaced` | 1..n: renglones | `tracking` 0.1–1.2 (0.7), `echo` 0–8 (0) |
| `phonechat` | 1..n: burbujas alternas | `dotted` (true), `squiggle` (false), `size` 0.5–1.2 (0.86) |
| `coupon` | 1: rótulo | `count` 2–8 (4) |
| `codeinput` | 1: código · 2, 3: botones | `ticket` (true), `size` 0.5–1.2 (0.8) |
| `contact` | 1: encabezado · 2+: número/contacto | `size` 0.6–1.3 (1.05), `brand` (true) |
| `intro` | `intro.title` / renglón 1 / `brand.name` | `size`, `sub` |
| `outroV1` | `outro.title`, `outro.cta` / `brand.cta`, `brand.url` | `size` |
| `outroV2` | chips + `outro.cta` + marca | `count` 6–40 (22) |

Comunes a cada slot: `media` (ids de `config.media`), `trans` (transición de entrada).

## 4. Animación, transiciones y aspecto global

- `anim.textIn` (type), `anim.speed` 0.5–2. Tecleo por carácter, pop con rebote, subidas.
- `transition.weights`: `cut`, `dots`, `lineSweep`, `blink`, `pillPop` + las del núcleo
  (`fade`, `blur`, `iris`, `wipeL/R/Up/Down`, `bars`, `flash`, `zoomIn`, `zoomOut`, `slice`).
  `transition.overlapSec` (0.3) y `duration` (0.32).
- `look.dotScale` 0.4–2.5 (1), `look.dotContrast` 0.5–2.5 (1.25), `look.chipScale` 0.6–1.6 (1), `look.stroke` 0.5–3 (1).
- `palette`: `bg`, `fg`, `muted`, `chip`, `chipText` (#RRGGBB). `fonts.googleUrl/display/label` (Inter).
- `chips`: lista de frases para las píldoras. `brand`: `name`, `cta`, `url`.
- `grades.mono` (duo): pregradado por `grade_media.py` al compilar.

### Semitono (`k.halftone`)
Muestrea el medio en una rejilla y escribe los puntos en un búfer de píxeles
(`putImageData`), con borde suave y sin trazados. El video sigue en el DOM debajo
para el reloj de HyperFrames. Mientras un video busca se reutiliza el último muestreo
y se redibuja al terminar la búsqueda. Medido en Chromium headless: 33–60 fps en
960×540, 540×960 y 1280×720 (antes de optimizar, 6–8 fps).

## 5. JSON

`assets/config.json` = `{ activeId, configs: [CASO] }`; `assets/lyrics.json` = guion
(un segmento = una escena; `lines` = renglones; `words` con sus tiempos).
Ejemplo de slot: `{"type": "footage", "media": ["horses"], "dotsIn": true, "icon": "bars", "trans": "dots"}`.
Ejemplo de segmento: `{"start": 21.18, "lines": ["¡Vamos, caballito!"], "words": [...]}`.

## 6. Qué cambia sin código

Textos (guion y `brand`), medios (`media` o el slot «Videos» de la app), orden y tipo
de escenas, parámetros por escena, transiciones, colores, fuente, chips, intro y
cierre (`outro.version` v1|v2 o `?outro=v2`). **Requiere código**: una escena o
transición nueva (registrar en `window.NexaPromo_promo_mono` desde `components/`).

## 7. Integración

- Catálogo `templates.json` → `promo-mono` (comercial, `static_config`, textos y slot de videos).
- Nicho `promo_video_mono` en `niches.json` del repo y del perfil `profesional`, en NodeMotion → promos.
- Fuente única en `_tools/nodemotion/promo/designs/promo-mono/` (extraída con `extract.py`); medios de demo por hash.
- Miniaturas: `design-tokens.json` (Inter Tight 800, fondo `bg`, texto `fg`) + `thumbnail-style.json`.
- **Pendiente**: preparación por chat de promos (`TEMPLATES` en `src/core/nodemotion/promo/prompts.py`,
  `PROMO_IDS` de la web, contrato `production/templates/promo-mono.json`, esquemas); validación HyperFrames.

## 8. Revisar en 16:9 y 9:16

Demo: `/api/v1/templates/promo-mono/showcase/` (tras reiniciar el backend). Galería:
`showcase/index.html?aspect=9:16` o `?only=mono.footage`. Depuración: `?t=SEG`, `?debug=1`, `?outro=v2`.

## 9. Recursos y licencias

- Música: «Funk Game Loop», Kevin MacLeod (incompetech.com), **CC BY 4.0** — atribución obligatoria al publicar.
- Videos: 10 clips de Pixabay (licencia de contenido de Pixabay), ver `CREDITS.md`.
- Fuente: Inter (SIL OFL 1.1, Google Fonts).

## 10. Pruebas y pendientes

Hechas: hojas de contacto completas 16:9 y 9:16; reproducción con audio y medición de
fps por escena; determinismo de DOM en 7 instantes; carga de los 6 componentes sin
avisos de validación; compilación real con `build.py` (gradación + reloj HyperFrames).
Pendientes: render HyperFrames, vista en la app tras reiniciar el backend, preparación
por chat, prueba de miniaturas A/B en un borrador real.
