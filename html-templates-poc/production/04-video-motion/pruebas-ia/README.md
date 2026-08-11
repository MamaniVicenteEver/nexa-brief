# pruebas-ia — estudio v10 (04-video-motion)

Evidencia de la sesión que dejó este caso funcionando de punta a punta:
plantilla nueva (`index.html` estaba VACÍO), prompts v10 (`Example.md`),
script de captura (`capture_frame.py`) y verificación de los 4 videos de
prueba en los 2 únicos formatos que importan (16:9 y 9:16).

## Preguntas que se investigaron

1. ¿El motor v9 portado a `config.json` externo + tipografía + `anchorPreference`
   se comporta igual que el motor de referencia probado (`example/in-cap2rot.html`
   / `seamless/in-cap2.html`)?
2. ¿Qué debería devolver el Prompt 1 v10 para cada uno de los 4 videos locales
   (ground truth medido con PIL, independiente de cualquier JSON de visión)?
3. ¿El resultado renderizado cumple las reglas: sin costuras, letras nunca
   sobre sujeto/watermark/kanji, letterbox compuesto como horizontal,
   tipografía y ancla respetadas?

## Método

1. **Regresión del motor**: se sirvió todo `html-templates/` con
   `python3 -m http.server` y se renderizó con Playwright + Chromium headless
   (`--disable-web-security`, mismo flag que el recorder real de
   `src/adapters/recorder/infrastructure/playwright_ffmpeg_adapter.py`).
   Se compararon MÉTRICAS de layout por JS (rects de #txtL/#txtR, rect de
   #clip, transform del video, blur, fuentes) entre el `index.html` nuevo y
   `seamless/in-cap2.html` con el mismo CONFIG (§8.1 del estudio v9).
2. **Ground truth con PIL** sobre el primer fotograma real de cada video
   (`Image.getpixel`: promedios de parches en esquinas/zonas limpias, brillo
   máximo por fila/columna para letterbox y extensiones, cajas de
   watermark/kanji por umbral).
3. **Flujo v10 completo por video**: captura (`capture_frame.py`) → JSON de
   visión siguiendo el Prompt 1 v10 al pie de la letra (`vision-*.json`) →
   mapeo Prompt 2 → `config-*.json` → render en 1440×900 y 390×844.
4. **Chequeo de costuras**: delta máximo de canal cruzando el borde
   video↔página en las capturas de los casos `solid`, medido con PIL.

## Resultados

### 1. Regresión del motor — PASA

Con el CONFIG §8.1 (test2.mp4): rect del clip, transform del video, blur,
colores y fuentes **idénticos** al motor de referencia. Única diferencia:
con `keepOut` presente, el bloque de prioridad de zonas (portado del caso 01
v7.6) coloca RISE y SILENT como PAR en la misma zona (middle), donde el motor
viejo los repartía (SILENT arriba con fs 145 vs 141). Es el comportamiento
deseado del v7.6 — no una regresión.

### 2. Ground truth por video (PIL) y qué devolvió el flujo v10

| Video | Medido con PIL | JSON v10 (`vision-*.json`) | Render |
|---|---|---|---|
| test1.mp4 (720×1290) | Campo superior #16161D frío; **esquinas inferiores #929399/#9D9497** — la niebla del aura llega a los bordes; bbox de brillo>40 cubre todo el cuadro | `complex → blur` (ver hallazgo A), sujeto = personaje + aura, zona bottom full-width, `anchorPreference: middle` | AWAKEN/UNBOUND flanquean al medio; blur absorbe la niebla sin costura; móvil: par apilado arriba |
| test2.mp4 (720×1280) | Niebla #14181A–#667781 (complejo); watermark real y≈1243–1270 x≈170–545 → con margen 5% ≈ `[140,1210,580,1280]` (**valida la caja del estudio v9 §8.1**) | blur + keepOut watermark, `anchor: bottom` | RISE/SILENT como par (middle tras fallback); watermark 100% legible; móvil: par arriba (el carve eliminó la banda inferior) |
| test3.mp4 (720×1280) | Filas con contenido 287–849 (umbral 24) → content box del estudio `[0,280,720,880]` confirmado; negro genuino | solid #030303 + letterbox → composición landscape, `anchor: bottom` | Desktop: pieza horizontal sin barras, GAZE/STORM en las esquinas del diagonal; móvil: bandas arriba/abajo; **costura: delta máx 1** |
| video1.mp4 (748×418) | Espada horizontal y≈187–230 llegando a **x=0** (extensión fina); kanji "剣風凛" ≈ `[148,185,210,204]`; **sello "GIF" tenue en `[718,402,739,410]`** (hallazgo B); fondo #000000–#030304 | solid #020203; middle_zone con left_edge 0; 2 keepOut (kanji + sello); `typography: serif-display` | SWIFT/BLADE en zona top (bottom/middle fallan por la espada — correcto); serif sin desbordes; kanji y sello intactos; **costura: delta máx 1** |

### 3. Hallazgos

- **A — test1 contradice la tabla del estudio v9**: la tabla (§5 de
  `ESTUDIO-CAPTURA-UNICA.md`) sugería "solid casi-negro con envolvente
  generosa", pero la medición del primer fotograma real muestra la niebla
  clara (#93–#9D) tocando las esquinas inferiores: un relleno plano #16161C
  habría dejado un rectángulo visible abajo. La regla nueva del Prompt 1 v10
  (Layer A2: "si el aura/glow inunda el cuadro y toca los bordes → complex")
  sale de este caso. El render con blur confirma que era la decisión correcta.
- **B — watermark tenue detectado solo por medición**: el sello "GIF" de
  video1 (esquina inferior derecha, brillo máx 94/255) es casi invisible a
  simple vista sobre negro. La regla v10 de Layer D ("por tenue que sea, si se
  lee, cuenta") lo captura → keepOut `[706,394,748,418]`.
- **C — la caja del watermark de test2 del estudio v9 era correcta**: medida
  real `[170,1243,545,1270]` + margen 5% ≈ `[140,1210,580,1280]`. Sin el bug
  de subestimación multi-línea del caso 01 v7.5 (acá es una sola línea).
- **D — el JPEG de captura aplasta el negro-video**: `capture_frame.py -q:v 2`
  puede guardar #000000 donde el render H.264 real muestra ~#030303. Por eso
  la regla "video black #010104–#050508" del prompt se mantiene aunque la
  captura diga 0 puro (test3/video1).
- **E — costuras**: en los 2 casos `solid`, delta máximo de canal cruzando el
  borde video↔página = **1/255** en las 4 capturas verificadas. Invisible.

## Archivos de esta carpeta

- `*_f1.jpg` — primer fotograma real de cada video (salida de `capture_frame.py`).
- `vision-*.json` — el JSON de visión v10 de cada video (lo que debería
  devolver el Prompt 1; sirve de ejemplo few-shot y de caso de regresión).
- `config-*.json` — el `config.json` resultante del mapeo Prompt 2 de cada video.
- `*-desktop-1440x900.png` / `*-mobile-390x844.png` — render real de cada caso
  en 16:9 y 9:16 (Chromium headless).

## Cómo reproducir esto vos mismo

```bash
cd html-templates/production/04-video-motion
cp pruebas-ia/config-video1.json config.json   # o cualquier otro config-*.json
python3 -m http.server 8000
# abrir http://localhost:8000/index.html en el navegador
```

Los `src` de los configs apuntan a `example/test*.mp4` / `video/video1.mp4`
en rutas relativas a esta carpeta del caso — no hace falta copiar videos ni
tocar `index.html` en ningún caso. El `config.json` que queda en la raíz del
caso es la demo (test2). El 404 de `song.mp3` en consola es esperado hasta
que exista música de muestra — no bloquea el render.
