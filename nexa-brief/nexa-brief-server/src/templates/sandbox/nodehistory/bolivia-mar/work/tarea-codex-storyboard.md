# Tarea para Codex · storyboard del video "Cómo Bolivia perdió su mar" (motor de mapas)

Sos el director visual. Claude (orquestador) revisa y corrige. Solo podés escribir en
`src/templates/sandbox/nodehistory/bolivia-mar/` (assets/scene.json, assets/config.json, index.html, work/).
NO toques el motor (`../_mapas/*.js`, `../../_proto/`), ni otros videos. Sin git commit, sin render.

## Leé antes (en este orden)
1. `../_mapas/ESCENA.md` — formato COMPLETO de la escena (cámara, capas, lugares, intro, cierre). Es la ley.
2. `PLAN.md`, `assets/script.json`, `work/inventario-mapa.md` (qué se ve en cada segmento).
3. `assets/lyrics.json` — tiempos por palabra de Whisper: las anclas `"@palabra"` tienen que existir AHÍ
   (números en cifras: `"@1879"`, `"@24"`). Usá frases de 2–3 palabras cuando una palabra se repite.
4. `../fronteras-demo/` (index.html + assets/scene.json) como ejemplo que funciona.
5. Mirá cuadros de las referencias `src/templates/sandbox/nuevos/ejmplo2/*.mp4` (ffmpeg) — sobre todo el de
   Bolivia (`ssstik.io_1792680627623.mp4`): ESO es el estándar a replicar (cómo se marcan los países, ritmo de cámara).

## Qué entregar
- `index.html`: copia exacta de `../fronteras-demo/index.html` (solo cambia el `<title>`).
- `assets/config.json`: como el de fronteras-demo con `audio.src = "assets/song.mp3"`, `lyricsUrl = "assets/lyrics.json"`.
- `assets/scene.json` completo para TODO el video (~8 min):
  - `intro` v1 (titular ≤ 4 palabras por renglón con `^x^`, kicker "Guerra del Pacífico · 1879"), dur 4.5–5.5.
    Durante la intro la cámara vuela del mundo a Sudamérica y se pintan Bolivia, Chile y Perú en ráfaga.
  - `outro` { channel "NODEHISTORY", handle "youtube.com/@nodehistory" }.
  - `sat`: `[{ "src": "../_mapas/media/sat-sudamerica.jpg", "bounds": [-85, -50, -40, 0] }]` (recorte de detalle).
  - `regions` y `places` propios (litoral boliviano 1866/1874, Tarapacá, Arica, Tacna, paralelo 24 como línea…),
    reutilizando los nombres de `../_mapas/places.json` (no repitas coordenadas que ya están ahí).
  - Colores FIJOS para todo el video: Bolivia `#e3122a` (rojo), Chile `#1d4fff` (azul), Perú `#36d41a` (verde),
    Argentina `#8a1cff` (violeta), zonas en disputa/cedidas con `hatch`. Banderas `bo`, `cl`, `pe`.
  - Cámara: una key cada 3–8 s (≈ 70–110 keys), siempre `focus` con nombres; el vuelo es automático.
  - Capas: cada segmento muestra algo nuevo y anclado a su palabra clave (año → `year`; ciudad → `pin`;
    combate → `icon battle`; salitre → `icon mine`; puerto → `icon anchor`; avance → `arrow`; tratado →
    `big` o `label big`; frontera → `line`). Retirá con `out` lo que ya no se necesita (pantalla limpia: ≤ 6
    elementos vivos a la vez, sin contar los `fill` de fondo).
  - Respeto: nada de morbo; Abaroa con `pin`/`label`, sin dramatizar.
- `work/storyboard-notas.md`: tabla segmento → qué se ve, para la revisión.

## Verificación (obligatoria antes de terminar)
- Hoja de cuadros con Playwright (`.venv/bin/python`): serví `src/templates/` con `http.server`, abrí
  `sandbox/nodehistory/bolivia-mar/index.html?headless=1`, esperá `window.__promo`, y capturá 1 cuadro cada 6 s
  en 540×960 → `work/sheet-9x16.png` (y unos 8 cuadros en 960×540 → `work/sheet-16x9.png`).
- `await page.evaluate("window.__promo.missingAnchors()")` tiene que dar `[]`.
- **Mirá las hojas** y corregí: nada cortado, rótulos legibles, sin encimarse, la cámara encuadra lo que se nombra.
- Reportá: cantidad de keys/capas, anclas faltantes (0), y qué no pudiste resolver.
