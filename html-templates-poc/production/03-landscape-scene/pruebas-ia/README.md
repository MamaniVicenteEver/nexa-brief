# pruebas-ia — verificación: fetch("config.json"), focal-cover sin bordes, texto sin desborde ni superposición

Evidencia de que `index.html` (motor estático, recién migrado a
`fetch("config.json")` — antes traía el `CONFIG` embebido con datos de una
imagen distinta a `jav2.png`) renderiza bien en los 2 formatos obligatorios
con la config de muestra (`config.json`, imagen `img/jav2.png`, haiku
"花は散り／名を覚えている／風ばかり").

## Método

1. Servir la carpeta con `python3 -m http.server` (obligatorio: `fetch()` se
   rompe por CORS en `file://`) y renderizar con Playwright + Chromium
   headless (`--disable-web-security`, `--autoplay-policy=no-user-gesture-required`
   — mismos flags que usa el recorder real en
   `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py`).
2. Capturar 2 viewports (1920×1080 = 16:9, 1080×1920 = 9:16) después de
   ~3.8s (tiempo suficiente para que las 15 letras del haiku terminen su
   fundido de entrada — a 170ms por letra + transición de 0.9s la última
   letra termina de aparecer recién a los ~3.4s).
3. Leer con JS, en cada captura: `getBoundingClientRect()` del fondo (`#bg`)
   contra el viewport (confirma cover real, sin bordes negros), de `#haiku`
   (confirma que no desborda), el texto/cantidad de `span.in` (confirma que
   las 15 letras terminaron de aparecer), y los `console`/`pageerror` del
   navegador.

## Resultado

| Captura | viewport | `#bg` cubre 100% del viewport | `#haiku` se sale del viewport | Letras visibles |
| --- | --- | --- | --- | --- |
| `carmine-desktop-1920x1080.png` | 1920×1080 | Sí (`left:-118px` a `right:1985px`, `top:-12px` a `bottom:1171px`) | No | 15/15 |
| `carmine-mobile-1080x1920.png` | 1080×1920 | Sí (`left:-1380px` a `right:2361px`, `top:-27px` a `bottom:2078px`) | No | 15/15 |

0 desbordes de fondo (siempre cubre de sobra el viewport en las 2 relaciones
de aspecto, incluso en 9:16 donde recorta ~44% del ancho original de la
imagen) y 0 desbordes del bloque de texto. El punto focal (`img.focal =
[860, 260]`, la torre principal de la pagoda) queda visible y centrado en
ambos formatos — confirmado visualmente: en 9:16 la torre ocupa el centro
del encuadre pese al recorte agresivo de los laterales.

**Por qué el fondo nunca deja bordes:** `layout()` calcula
`k = max(vw/img.w, vh/img.h) * pad` (cover real, nunca contain) y clampea el
desplazamiento para que el punto focal quede lo más centrado posible sin
que se lleguen a mostrar bordes — mismo patrón ya probado en
`01-image-bg`/`04-video-motion`.

**Por qué el texto no pisa la caligrafía pintada por el propio cuadro:** las
2 esquinas superiores de `jav2.png` tienen caracteres chinos pintados por el
artista + sellos rojos (verificado recortando esas regiones puntuales con
PIL, no a simple vista sobre la miniatura — ver `Example.md`, sección "Qué
cambió respecto al prompt original"). `calm_zone`/`text.xPct,yPct` (7.5, 9)
apunta al hueco angosto entre esa caligrafía y el primer templo, tomado del
`example/example1-carmine-haiku.html` ya validado a mano — confirmado en las
2 capturas que el texto cae ahí sin tocar ninguna de las 2 inscripciones.

Único warning de consola: 404 de `song.mp3` (asset de audio pendiente,
esperado — el motor cae al pulso simulado, `simulatedBpm: 86`) — no bloquea
el render. 0 errores de JavaScript (`pageerror`).

## Archivos de esta carpeta

- `carmine-desktop-1920x1080.png` / `carmine-mobile-1080x1920.png` —
  `config.json` tal cual (bioma "autumn", paleta roja/naranja tomada de
  `example/example1-carmine-haiku.html`).

## Cómo reproducir

```bash
cd html-templates/production/03-landscape-scene
python3 -m http.server 8103
# abrir http://localhost:8103/index.html
```

Con Playwright (mismo patrón que `verify_03.py` usado para estas capturas):
navegar a la URL, esperar ~3.8s, `page.screenshot()`, y leer
`getBoundingClientRect()` de `#bg` y `#haiku` contra `window.innerWidth/Height`
en 1920×1080 y 1080×1920.
