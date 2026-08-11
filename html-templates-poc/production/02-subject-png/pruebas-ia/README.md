# pruebas-ia — verificación: motor centrado, palabra gigante nunca desborda

Evidencia de que `index.html` (motor estático, `fetch("config.json")`, layout
único centrado copiado del estilo de `example/example1-baki.html` /
`example2-goku.html`) renderiza bien en los 2 formatos obligatorios y, sobre
todo, de que la palabra gigante **nunca se sale del ancho de pantalla** —
ese fue el pedido explícito que motivó esta vuelta de verificación.

## Método

1. Servir la carpeta con `python3 -m http.server` (obligatorio: `fetch()` se
   rompe por CORS en `file://`) y renderizar con Playwright + Chromium headless
   (`--disable-web-security`, el mismo flag que usa el recorder real en
   `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py`).
2. Capturar 2 viewports (1920×1080 = 16:9, 1080×1920 = 9:16) para 2 configs
   con palabras de largo bien distinto: `config.json` ("CURSED", `img/6.png`)
   y `config2.json` ("POWER", `img/5.png`) — se probó copiando temporalmente
   `config2.json` sobre `config.json` y restaurando el original al final.
3. Leer con JS, en cada captura, `getBoundingClientRect()` y `scrollWidth`
   de `#giant` y `#charWrap`, y marcar si alguno se sale del viewport — no
   basta con mirar la imagen, se mide.

## Resultado

| Captura | viewport | `giant.scrollWidth` | `giant` se sale del viewport | `charWrap` se sale |
| --- | --- | --- | --- | --- |
| `cursed-desktop-1920x1080.png` | 1920×1080 | 1687px | No | No |
| `cursed-mobile-1080x1920.png` | 1080×1920 | 949px | No | No |
| `power-desktop-1920x1080.png` | 1920×1080 | 1826px | No | No |
| `power-mobile-1080x1920.png` | 1080×1920 | 1029px | No | No |

0 desbordes en las 4 combinaciones (2 palabras de largo distinto × 2
formatos). El sujeto (`#charWrap`) tampoco se sale en ningún caso — sigue
usando `fitSubject()` (acota por alto Y ancho a la vez), necesario porque
`img/6.png` es un cuadrado perfecto (1024×1024) y en 9:16 un escalado solo
por alto de viewport lo volvería más ancho que la pantalla.

**Por qué no puede desbordar, en cualquier palabra:** `fitGiantTitle()` no
usa una fórmula de "largo × constante" (frágil, depende de la fuente exacta)
— mide el `scrollWidth` YA renderizado del elemento real y reduce el
`font-size` con búsqueda binaria (20 iteraciones) hasta que entra en el 92%
del ancho de viewport. Esto es válido sea cual sea la fuente que termine
cargando (Montserrat vía Google Fonts, o el fallback local si no hay
internet) — el navegador mide, el código no adivina.

Único warning de consola: 404 de `song.mp3` (asset de audio pendiente,
esperado — el motor cae al pulso simulado) y el favicon — ninguno bloquea
el render.

## Archivos de esta carpeta

- `cursed-desktop-1920x1080.png` / `cursed-mobile-1080x1920.png` —
  `config.json` tal cual (`img/6.png`, paleta roja, fill translúcido tipo
  Baki — `rgba(0,0,0,0.28)`).
- `power-desktop-1920x1080.png` / `power-mobile-1080x1920.png` —
  `config2.json` (`img/5.png`, paleta dorada, fill casi sólido tipo Goku —
  `rgba(230,220,195,0.92)`).

## Historial: layout side-split (sacado del motor)

Una vuelta anterior de esta carpeta verificó un layout `side-split` (sujeto
a un costado + columna de palabras) que ya no existe en `index.html` — se
sacó a pedido explícito para igualar el estilo, siempre centrado, de
`example1-baki.html`/`example2-goku.html`. Se documenta acá solo por si se
retoma en el futuro: esa vuelta encontró y corrigió un bug real (una palabra
larga —"PRECISION"— se partía en 2 líneas en 9:16 porque el fontSize de la
columna de palabras se calculaba solo por alto de viewport, nunca por ancho
disponible). El fix de esta vuelta (`fitGiantTitle()` con medición real de
`scrollWidth`) es el mismo tipo de solución, generalizada — si side-split
vuelve, debería reusar el mismo enfoque de "medir, no adivinar" en vez de
una fórmula de ancho aparte.

## Cómo reproducir

```bash
cd html-templates/production/02-subject-png
python3 -m http.server 8000
# abrir http://localhost:8000/index.html            -> config.json (CURSED)
cp config2.json config.json   # hacer backup del original antes si lo querés conservar
# refrescar                                          -> config2.json (POWER)
```
