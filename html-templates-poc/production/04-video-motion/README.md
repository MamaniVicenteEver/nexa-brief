# 04 — Video con movimiento (caso #4)

Igual que el caso #1 pero con VIDEO en loop: objeto que se mueve sobre fondo
plano/estructurado. Se saca UNA captura del primer fotograma
(`capture_frame.py`) → la IA devuelve el JSON (con margen de movimiento +12%)
→ el HTML funde el video con la página y pone letras cortas que el sujeto
nunca toca. Soporta rotación en runtime (video vertical que en realidad es
horizontal) y letterbox (recorte al contenido real).

## Plantilla

- `index.html` — motor v9 captura única (origen: `example/in-cap2rot.html` /
  `../../seamless/in-cap2.html`): regiones/solid/blur + keepOut de texto
  incrustado + rotación + content box — MÁS las 3 mejoras portadas del caso 01:
  **`typography`** (4 tipografías: `default` / `condensed` / `serif-display` /
  `black-rounded`, con `measure()` sincronizado al CSS) y **`anchorPreference`**
  (zona preferida para el par de palabras, con fallback). Es ESTÁTICA: el motor
  nunca se regenera.
- **`config.json` = colección de casos** — un objeto
  `{ "activeId": "...", "configs": [ {caso}, ... ] }`. Cada caso tiene un `id`
  único + todo lo espacial (video/colors/bgMode/zones/subject/keepOut/texts/
  typography/anchorPreference) + `audio`, `intro`, `outro` y `description`
  (branding/SEO). Para PROBAR un caso, en `index.html` cambiá
  `const ACTIVE_ID = "test2";` por el id que quieras (`test1` / `test3` /
  `video1` / ...). Para agregar un caso, pegá el objeto que devuelve el Prompt 2
  dentro de `configs` — el HTML no se toca.
  - `description`, `intro` y `outro` son metadata (marketing/SEO, intro/salida
    del video): quedan listos en cada caso pero el motor aún NO los renderiza.
    Lo único de esa parte que sí se usa hoy es `audio.src` (alimenta el
    ecualizador).
- `capture_frame.py` — paso 0 del pipeline: primer fotograma + metadatos
  (w/h/fps/duración) listos para pegar en el Prompt 1.

## Contenido de la muestra

- [x] `config.json` — demo apuntando a `example/test2.mp4` (blur + watermark)
- [x] Videos de prueba: `example/test1-3.mp4` + `video/video1.mp4` (4 casos
      distintos: aura envolvente, niebla+watermark, letterbox→horizontal,
      apaisado+espada+kanji)
- [ ] `song.mp3` — música acorde (el 404 en consola es esperado; no bloquea)

## Flujo de armado

video → `python3 capture_frame.py video.mp4` (captura + metadatos) →
**Prompt 1 v10** (visión) → JSON → **Prompt 2 v10** → `config.json` (SOLO el
JSON — el HTML no se toca jamás).

Prompts completos y casos a probar en **`Example.md`** (v10 = v9 de
`../../docs/ESTUDIO-CAPTURA-UNICA.md` + los fixes v7.3–v7.6 de
`../01-image-bg/Example.md`). El flujo multi-fotograma para movimientos
amplios sigue en `../../docs/ESTUDIO-VIDEO.md`.

A diferencia del caso 01, acá NUNCA se rota el archivo: la rotación es un
campo del config (`video.rotation`) que el motor aplica en runtime con CSS.

## Estado

- [x] Plantilla refinada creada (motor v9 + config externo + tipografía + ancla)
- [x] Regresión del motor contra la referencia probada (`seamless/in-cap2.html`)
- [x] Verificado en 16:9 (1440×900) y 9:16 (390×844) con los 4 videos —
      capturas, JSONs de visión, configs y hallazgos en `pruebas-ia/`
- [x] Costuras medidas con PIL: delta máx 1/255 en los casos solid
- [ ] `song.mp3` de muestra (única pieza pendiente)
