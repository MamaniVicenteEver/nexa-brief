# promo-pulse · diseño reproducible

Promo deportiva de alto impacto: metraje cinematográfico desaturado sobre negro,
palabra condensada en itálica color crema (Anton), palabra gigante en contorno
verde neón detrás, video enmarcado con sombra, texto calado con el video dentro,
medidores y esquinas verdes, frases cortas en itálica, rótulos fijos de esquina y
pie, y transiciones con zoom, desenfoque y barrido.
Duración del ejemplo: **100 s (1:40), 46 escenas**.

Guía común de la familia: [../../DESIGN.md](../../DESIGN.md). Miniaturas A/B:
[MINIATURAS.md](MINIATURAS.md).

## 1. Referencia

Video de Klickpin «Simple nature ideas…» (pin 499829258658599147, 36 s, 1280×720),
en `src/templates/sandbox/referencias/nodemotion/PROMO/`: opener deportivo
(«WARNING», «BEST», «PROJECT», «WORLD!!!», «CHAMPION», «SPORT», «NOW! EXTREME»,
«SPEED», «MOTIVATION», «HARD WORK», «RACE», «PERSEVERE», «TEAM» y cierre de marca).
Se replicó el lenguaje visual (colores muestreados: verde `#2BF51A`, crema
`#E3DDCB`). **No** se copiaron sus textos, su metraje, su música ni las marcas que
muestra (rótulo de esquina, crédito del pie y logotipo final): son campos de marca
propios y configurables.

## 2. Archivos y orquestador

```text
promo-pulse/
├── index.html            ← GENERADO por _tools/commercial/build/build.py (no editar)
├── player.js             ← orquestador (mismo contrato que promo-breaking)
├── components/
│   ├── kit.js            piezas compartidas + rótulos fijos (HUD) + parámetros de look
│   ├── transiciones.js   zoomBlur · whip · greenFlash · panels
│   ├── intro.js          intro (video enmarcado + palabra que golpea)
│   ├── escenas.js        full · framed · knockout · badge · split3 · marquee · counter
│   ├── outro-v1.js       Outro v1 (por defecto)
│   └── outro-v2.js       Outro v2
├── assets/
│   ├── config.json       GENERADO desde el spec
│   ├── lyrics.json       guion de 46 segmentos alineado a la música
│   ├── song.mp3          «Movement Proposition», Kevin MacLeod (CC BY 4.0), 100 s
│   ├── media/            18 clips 1280×720 25 fps + pósteres y variantes gradadas
│   └── ejemplos/         configuración de ejemplo (otra campaña)
├── galeria.html          vista aislada de cada componente en el motor real
├── DESIGN.md · MINIATURAS.md
```

Fuentes editables: `_tools/commercial/build/promo-pulse.spec.json` + `player.js` +
`components/`. Regenerar con `build.py promo-pulse` y comprobar con
`optimize.py --check promo-pulse`. El orquestador (carga de componentes,
validación, intro/outro, transiciones) está descrito en el DESIGN.md de
promo-breaking, sección 2: es el mismo archivo.

## 3. Componentes

Renglón 1 = palabra principal; renglón 2 = frase corta o palabra secundaria.
Parámetros comunes: `type`, `media`, `trans`.

| type | archivo | muestra | parámetros propios (defecto) |
|---|---|---|---|
| `intro` | intro.js | negro → video enmarcado que entra escalando, palabra gigante en contorno, titular que golpea, frase | `grade` cine, `giant` true, `frame` 1 (0.6–1.3), `textIn` slam, `motion` zoom, `blackSec` 0.25 (0–2) |
| `full` | escenas.js | video completo, palabra grande, medidor verde, frase, esquinas opcionales | `grade` cine, `motion` zoom, `textIn` slam, `pos` bl\|br\|center\|l\|r, `size` 1 (0.5–1.6), `meter` true, `brackets` false |
| `framed` | escenas.js | video enmarcado + palabra gigante en contorno detrás + palabra encima | `grade`, `motion`, `textIn`, `giant` true, `frame` 1 (0.5–1.3), `side` center\|left\|right, `textPos` center\|left\|right |
| `knockout` | escenas.js | palabra a todo el ancho calada con el video dentro, fondo oscurecido | `grade` dim, `motion`, `scaleFrom` 1.25 (1–2), `fill` 0.92 (0.5–1) |
| `badge` | escenas.js | renglón 1 en negro dentro de una caja verde + renglón 2 crema, sobre video enmarcado | `grade`, `motion`, `giant` true, `frame` 0.85 |
| `split3` | escenas.js | 2–4 columnas de video que entran alternadas + palabra | `grade`, `motion`, `textIn`, `panels` 3 (2–4) (usa `media[0..n-1]`) |
| `marquee` | escenas.js | bandas inclinadas del renglón 1 (crema sólido / contorno verde) que corren + renglón 2 en caja verde | `grade` dim, `motion`, `rows` 4 (3–6), `speed` 1 (0–2), `skew` −6 (−15–15) |
| `counter` | escenas.js | número entero del renglón 1 que cuenta (prefijo/sufijo: «100%») + medidor + frase + video enmarcado | `grade`, `motion`, `countSec` 1 (0.3–3), `side` left\|right — sin número se dibuja como `framed` |
| `outroV1` | outro-v1.js | video enmarcado, marca gigante en contorno, marca crema con punto verde, dirección en itálica, medidor, fundido | `grade`, `frame` 1.05, `fadeSec` 0.8 (0–3), `motion` |
| `outroV2` | outro-v2.js | filas inclinadas de la marca que corren + marca + caja verde `brand.cta` + dirección | `rows` 5 (3–8), `speed` 1, `skew` −8, `fadeSec` 0.7 |

Valores: `grade` cine\|dim\|none · `motion` zoom\|drift\|still ·
`textIn` slam\|rise\|wipe\|type\|fade\|cut.

**Rótulos fijos (HUD)**: `brand.corner` arriba a la derecha y `brand.footer` en el
pie, en todas las escenas (`hud.enabled: false` los quita; texto vacío = sin rótulo).

Kit (`kit.js`): `textIn`, `title`, `tagline`, `media`, `full`, `frame`,
`frameRect`, `giant`, `meter`, `brackets`, `knock`, `vignette`, `black`.

## 4. Intro, escenas, outros y miniaturas

- **Intro**: primera escena; texto `intro.title`/`intro.sub` o renglones del primer segmento.
- **Outro v1 / v2**: última escena; `outro.version` (`v1` por defecto) o `?outro=v2`.
  Texto: `outro.title` → renglón 1 → `brand.name`; `outro.cta` → renglón 2 →
  `brand.url`; caja verde del v2 = `brand.cta`.
- **Miniaturas A/B**: [MINIATURAS.md](MINIATURAS.md).

## 5. Animaciones y transiciones

Entradas: `slam` (golpe de escala con desenfoque), `rise`, `wipe` (se descubre de
izquierda a derecha), `type`, `fade`, `cut`. `anim.speed` (0.5–2), `anim.intensity` (0–2).

Movimientos: zoom lento del metraje (`motion`), palabra gigante en contorno que se
desplaza, video enmarcado que entra escalando, medidores que se llenan, esquinas
que parpadean, bandas que corren, columnas que entran, conteo de cifras.

| transición | efecto |
|---|---|
| `zoomBlur` | la escena llega con zoom, desenfoque y sobreexposición |
| `whip` | barrido horizontal con desenfoque de movimiento |
| `greenFlash` | destello verde con golpe de zoom |
| `panels` | tres columnas que se abren desde su centro |
| `cut` | corte seco |
| del motor | `fade`, `blur`, `flash`, `slice`, `wipeL`, `zoomIn`, `bars`, … |

## 6. Formato del JSON

| clave | tipo / opciones | defecto |
|---|---|---|
| `palette.green` · `cream` · `ink` | `#RRGGBB` | `#2BF51A` · `#E3DDCB` · `#0B0C0B` |
| `fonts.googleUrl` · `display` · `label` | URL y familias | Anton + Montserrat |
| `brand.name` · `url` · `cta` · `corner` · `footer` | texto | NEXA BRIEF · @nexabrief · SUSCRÍBETE · NEXA BRIEF · «Diseño y animación · NEXA BRIEF» |
| `media[]` | `{id, type, src, poster}` | 18 clips |
| `grades.cine` · `grades.dim` | `{type:"css", saturate, contrast, brightness}` | 0.7/1.12/0.86 · 0.55/1.05/0.42 |
| `look.giantOpacity` · `vignette` · `accents` · `frameShadow` | 0–1 · 0–1 · 0–2 · 0–1 | 0.9 · 0.6 · 1 · 0.6 |
| `anim.textIn` · `speed` · `intensity` | enum · 0.5–2 · 0–2 | slam · 1 · 1 |
| `intro.*` · `outro.*` | como promo-breaking | v1 · minSec 3.5 |
| `transition.overlapSec` · `duration` · `weights` | 0–1 · 0.1–1 · pesos | 0.45 · 0.4 · zoomBlur 3, whip 2, greenFlash 1, panels 1, cut 2 |
| `hud.enabled` | bool | true |
| `scenes[]` · `texture.grain` · `render.kbVideo` · `seed` | — | 46 escenas · 0.06 · false · 23 |

Ejemplo (completo en `assets/ejemplos/campana-ejemplo.json`):

```json
{
  "activeId": "running",
  "configs": [{
    "id": "running",
    "palette": { "green": "#FF2E63", "cream": "#F4F1EA", "ink": "#08080A" },
    "brand": { "name": "CIUDAD 10K", "url": "ciudad10k.org", "cta": "INSCRÍBETE", "corner": "CIUDAD 10K", "footer": "Carrera popular · 2027" },
    "look": { "accents": 1.5 },
    "outro": { "version": "v2", "title": "CIUDAD 10K", "cta": "ciudad10k.org" },
    "scenes": [
      { "type": "intro", "media": ["runners"] },
      { "type": "full", "media": ["stride"], "pos": "br", "brackets": true, "trans": "whip" },
      { "type": "knockout", "media": ["sprint"], "trans": "zoomBlur" },
      { "type": "counter", "media": ["runners"], "countSec": 1.5, "trans": "panels" },
      { "type": "outro", "media": ["stride"] }
    ]
  }]
}
```

## 7. Cambiar contenido sin tocar código

Textos: guion + `brand.*` (en la app: «Marca», «Dirección», «Llamada», «Rótulo de
esquina», «Pie»). Medios: `media[]` / slot `clips` (1–18 videos). Aspecto:
`palette`, `fonts`, `grades`, `look`, `anim`, `transition`. Orden y selección:
`scenes[]`, `intro.enabled`, `outro.*`, `hud.enabled`. Variación: `seed`.

## 8. Qué requiere código

Tipos de escena, transiciones o entradas nuevos; otra forma de marco o de máscara;
logotipo gráfico de marca (el cierre usa texto + punto verde; un logo de terceros
requiere autorización y un componente nuevo). Se agregan en `components/` sin
tocar los existentes.

## 9. Integración

Igual que promo-breaking: catálogo `promo-pulse` (`runtime_assets`: `assets/media`,
`components`), nicho `promo_video_pulse` (repo + perfil), `TEMPLATES`, contrato
`skills/nodemotion/promo/templates/promo-pulse.json`, esquema `build-pulse.json`,
enum del brief, `PROMO_IDS` de la web. Ciclo de 46 escenas (64–110 s con segmentos
de 1,4–2,4 s). HyperFrames: reloj ✓, videos GOP 5; **sin validar** con render.

## 10. Revisar en 16:9 y 9:16

`index.html?t=SEG`, `?debug=1`, `?outro=v2`; en la app: Plantillas → Comerciales y
promociones → **Promo Pulse**; `galeria.html` para cada componente.

## 11. Recursos y permisos

- Clips: 12 de Pixabay (Pixabay Content License) + 6 de Pexels reutilizados de
  promo-sports (ya acreditados). Lista en `../CREDITS.md`.
- Música: «Movement Proposition», Kevin MacLeod, CC BY 4.0 (atribución obligatoria).
- Fuentes: Anton y Montserrat (SIL OFL 1.1); Anton local para miniaturas.
- La itálica de Anton es sintética (la familia no trae itálica), igual en video y miniaturas.

## 12. Pruebas y pendientes

Igual que promo-breaking (ver su sección 12). Momentos equivalentes: «WARNING» ↔
intro «ATENCIÓN»; «BEST» ↔ `framed` «LO MEJOR»; «NOW! EXTREME» ↔ `badge` «¡YA! /
EXTREMO»; «CHAMPION» ↔ `full` «CAMPEÓN»; «SPORT» con esquinas ↔ `full` «DEPORTE»;
«MOTIVATION»/«TEAM» ↔ `knockout`; tres paneles de motos ↔ `split3`; «PERSEVERE» ↔
`framed` «PERSEVERA»; cierre de marca ↔ Outro v1.
