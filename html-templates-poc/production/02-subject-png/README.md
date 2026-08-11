# 02 — Imagen sin fondo / PNG (caso #2) — AURA

Solo el objeto (PNG con transparencia real). La IA **decide el fondo**
(colores fuertes, puros, profesionales) y centra el sujeto con UNA palabra
gigante detrás — máximo 1-2 palabras, nunca una frase — más levitación
suave, glow de piso y partículas. Estilo y tipografía calcados de
`example/example1-baki.html` y `example2-goku.html`.

## Plantilla

`index.html` — motor ESTÁTICO único, `fetch("config.json")` en runtime (igual
patrón que `../01-image-bg/`). **Un solo layout por ahora: sujeto y palabra
gigante centrados** (la variante side-split se probó y se sacó a pedido
explícito — ver `Example.md`, sección "Por qué se sacó side-split").

`config.json` (raíz, demo activa) usa `img/6.png`, paleta roja, palabra
"CURSED" con fill translúcido (estilo `example1-baki.html`).
`config2.json` usa `img/5.png`, paleta dorada, palabra "POWER" con fill casi
sólido (estilo `example2-goku.html`) — copiarlo sobre `config.json` para
previsualizar esa variante de color sin tocar `index.html`.

## Estructura de esta carpeta

- `index.html` — motor estático (Montserrat 900, radial de 3 tonos, palabra
  gigante centrada con auto-ajuste de tamaño para nunca desbordar el ancho
  de pantalla, sujeto en `luminosity`/`none`, glow, partículas, header de
  marca).
- `config.json` / `config2.json` — 2 configuraciones de muestra.
- `img/` — PNGs de sujeto con alfa real (`5.png`, `6.png`).
- `example/` — 3 piezas de referencia hechas a mano (standalone, no usan el
  motor): `example1-baki.html` y `example2-goku.html` son el molde exacto de
  estilo que `index.html` sigue; `example3-boombap.html` es una referencia
  de paleta/HUD distinta.
- `pruebas-ia/` — verificación real con Playwright headless en 16:9 y 9:16,
  confirmando que la palabra gigante nunca desborda. Ver `pruebas-ia/README.md`.
- `Example.md` — Prompt 1 (visión + dirección de arte) y Prompt 2
  (config.json-only), listos para copiar y pegar.

## Contenido requerido para una pieza nueva

- [x] `subject.png` — objeto SIN fondo, con alfa real (ya hay 2 de muestra en `img/`)
- [ ] `song.mp3` — música acorde (opcional — sin ella el motor usa un pulso simulado)
- [x] `config.json` apuntando a los archivos locales

## Nota del flujo

Conseguir PNG sin fondo por scraping es poco fiable (rembg no siempre da buen
resultado) → flujo preferido MANUAL: subir el PNG ya recortado por interfaz.
El JSON de visión devuelve medidas (del canal alfa), fondo decidido y la
palabra gigante. Prompts completos en `Example.md`.

## Estado

- [x] Motor único, estático, `config.json` externo (portado el mismo patrón
      que `01-image-bg`).
- [x] Un solo layout (centrado), calcado del estilo/tipografía de
      `example1-baki.html`/`example2-goku.html` — side-split sacado por ahora.
- [x] Palabra gigante con auto-ajuste de tamaño (mide `scrollWidth` real,
      nunca una fórmula adivinada) — verificado que no desborda en 16:9 ni 9:16.
- [x] Prompts de este caso en `Example.md` (corregido — antes tenía por error
      el contenido del caso `01-image-bg` pegado).
- [x] Assets de muestra (`img/5.png`, `img/6.png` + `config.json`/`config2.json`)
- [x] Verificado en 16:9 y 9:16 (`pruebas-ia/`)
- [ ] `song.mp3` de muestra (pendiente — el motor no lo necesita para verse bien,
      cae a pulso simulado a BPM configurable)
- [ ] Montserrat depende de Google Fonts (`@import`) — falta empaquetarla en
      local para grabar sin internet (mismo pendiente que el roadmap general,
      `../README.md` mejora #5)
