# Tarea para Codex: terminar 2 réplicas Klickpin (sandbox NodeMotion)

> ## ⚠️ REGLA ABSOLUTA DEL USUARIO: CERO INVENCIÓN
> Cada plantilla **tiene que ser idéntica a su video de referencia**. **No inventes nada**: ni
> escenas, ni transiciones, ni efectos, ni colores, ni tipografías, ni composiciones, ni orden, ni
> ritmo que no estén en el mp4 de `assets/_ref/`. Lo único que cambia es el **contenido**: la canción,
> el texto (la letra o las frases) y los clips o fotos. Todo lo demás se copia del video, cuadro a cuadro.
> - Antes de construir cada escena, mirá los cuadros de la referencia en ese tramo (hojas de contacto
>   a 6–10 fps) y replicá exactamente lo que se ve: posición, tamaño, color, tipografía, timing y easing.
> - Si la canción es más larga que la referencia, **repetí las secuencias de la referencia** en el mismo
>   orden (ciclo), sin crear variantes nuevas.
> - Si en este documento o en el código que ya existe hay algo que **no** está en la referencia
>   (por ejemplo, algo que propuso Claude), **eliminalo o corregilo** para que coincida con el video.
> - Verificá con capturas lado a lado (referencia contra plantilla) en los mismos instantes y guardalas
>   en `<id>/_build/capturas/`.

> Lo empezó Claude el 2026-10-15. Leé antes `sandbox/nodemotion/AGENTS.md` (reglas de prototipo).
> **Límites:** escribí solo dentro de `sandbox/nodemotion/promo-fuerza-motivacion/` y
> `sandbox/nodemotion/lyrics-final-cut/`. Sin git commit/push, sin `data/canales/`, sin publicar,
> **sin renderizar mp4** (el usuario revisa primero por `index.html` en Live Server). No toques producción.

**Objetivo del usuario:** replicar **a la perfección** cada video de referencia (tipografías, colores,
transiciones, estilo, ritmo), solo cambiando el contenido (otra canción, otros clips o fotos).

Las referencias están en `<id>/assets/_ref/*.mp4`. Para estudiarlas, sacá hojas de contacto con
tiempos, por ejemplo:
`ffmpeg -ss 0 -t 5 -i ref.mp4 -vf "fps=6,scale=400:-1,drawtext=text='%{pts\:hms}':x=4:y=4:fontsize=14:fontcolor=yellow:box=1,tile=6x5" -frames:v 1 hoja.png`

Texturas: `_build/textures.py <carpeta>/tex fitness|grunge` genera máscaras PNG (blanco = opaco).
Se usan como `mask-image` sobre un div de color plano. Se pueden regenerar o ajustar.

---

## A) `promo-fuerza-motivacion/`: escrita por Claude, falta probarla y pulirla

- **Referencia:** `assets/_ref/klickpin-fitness-motivation (3).mp4` (19 s, 1280×720).
- **Canción:** la de `promo-dynamic` («Fuerza»), por pedido del usuario.
  - `song.mp3` dura 43,5 s y va a ~118 BPM, con un compás cada 2,53 s.
  - Los compases caen en 0 · 3,02 · 5,55 · 8,08 · 10,61 · 13,14 · 15,65 · 18,2 · 20,71 · 23,24 · 25,77 · 28,28 · 30,81 · 33,34 · 35,87 · 38,41. El cierre empieza en 41.
- **Guion:** `lyrics.json` es un guion de promo: un segmento = una escena = un compás. Las frases son de motivación en español.
- **Clips:** `media/*.mp4`, a 1280×720, 25 fps, GOP 5, mudos y con el grade frío ya horneado.
  - Vienen de Pixabay y de `promo-dynamic`.
  - Cada clip tiene un póster `.jpg`.
- **Créditos:** faltan los de Pixabay en `NOTAS.md`. Estos son los IDs, y la URL es `https://pixabay.com/videos/id-<ID>/`:

  | Archivo | ID de Pixabay |
  |---|---|
  | `boxer-dark` | 216568 |
  | `boxer-gloves` | 52101 |
  | `ropes-man` | 200657 |
  | `rope-woman` | 109413 |
  | `gym-woman` | 148208 |
  | `pulldown` | 135162 |
  | `barbell` | 148204 |

  `dyn-*` son clips de `promo-dynamic`; sus créditos están en `nodemotion/commercial/CREDITS.md`.
- **Motor:** `index.html` es autocontenido.
  - El único reloj es `audio.currentTime`, con `?t=SEG` para congelar un cuadro y `?debug=1` para ver el HUD.
  - `window.__fuerza.seek(t)` es el gancho de validación.
  - Hay un `<video>` por escena, que se destruye al salir.
  - El orden de tipos de escena y de medios está en `assets/config.json` → `scenes[]`.

**Cronología de la referencia** (lo que hay que imitar). Paleta: crema #F3F0EA, rojo #C8102E y negro #141418.

| Tiempo | Qué pasa |
|---|---|
| 0–1,0 s | **ESTAMPADO**. Sobre fondo crema, «GET MOTIVA…» entra letra por letra en rojo condensado (Anton) con textura grunge. Las letras se estiran en alto hasta llenar la pantalla, con aberración RGB cian/azul. Aparece una tarjeta de video con borde roto, chica y torcida, que crece. |
| 1,0–1,17 s | La tarjeta pasa a pantalla completa. |
| 1,17–3,0 s | **HOLD**: video a pantalla completa con el texto blanco pequeño centrado. «GET MOTIVATED» va en itálica extendida y entra desde la derecha cerrando el tracking. Hay un garabato rojo chico abajo a la izquierda. |
| 3,0–4,3 s | **MARCOS**. Sobre crema hay tarjetas de video rotas que tiemblan. Una caja de pincel rojo lleva el texto blanco anterior («GET MO»). Las letras rojas gigantes «MOTIVA» corren. Un marco de pincel negro rodea el video con el texto rojo «GET FIT» adentro, y después hace zoom a pantalla completa. |
| 4,3–6,2 s | Hold «GET FIT», recto y condensado, con espaciado. |
| 6,17–6,5 s | Goteo de barras rojas verticales sobre el video anterior. |
| 6,5–7,2 s | Fondo rojo con bloques de píxeles glitch (rosa y violeta). «ENERGIZES» aparece en 3 filas blancas, con letras que faltan y otras en rosa, y una tesela de video chica al centro. Un garabato negro de crayón la tacha. |
| 7,17–7,33 s | Fondo gris #4A4446 con el garabato sobre el video. |
| 7,5–8,0 s | Fondo rojo con una pincelada negra gigante que contiene el video, y la palabra blanca gigante «NERGIZES». |
| 8,0 s | La palabra gigante se encoge a tamaño hold sobre el video completo. |
| 10,0–10,4 s | **GIGANTE**. Un barrido de pincel rojo trae la palabra negra gigante «RGIZ» sobre rojo. Luego tiras de video rotas y la palabra «INSPIRE» enorme, negra y en itálica, cruzando. Pasa a video completo y la palabra gigante se va disolviendo. |
| 10,5–12,2 s | Hold «INSPIRES», en itálica. |
| 12,33–12,5 s | El video anterior se **pixela** y una pincelada negra horizontal lleva el texto rojo en itálica. |
| 12,67–13,5 s | Fondo rojo con pincel negro y el video en un rectángulo que se achica; luego fondo negro. |
| 13,67–14,8 s | Fondo rojo con «YOUR GOALS» en 3 filas negras extendidas (Archivo wdth 125, peso 900). Hay un video chico al centro con fantasma RGB y un barrido de pincel negro. |
| 14,8–15,6 s | Hold «YOUR GOALS». |
| 15,67 s | Destello crema. |
| 16,0–16,8 s | **TIZA**. Sobre fondo negro, la frase blanca extendida, en itálica y gigante, corre horizontalmente. Hay óvalos de tiza arriba, líneas de tiza finas, cruces rojas ✕ y un parche de papel crema con el video y un garabato negro encima. |
| 17,0 s | Fondo crema con el video en una tarjeta rota. Después, hold «KEEP INSPIRED» en itálica. |

**Qué falta en A:**
1. Abrirla y depurarla: no se probó todavía, puede tener errores de JS. Para servirla: `python3 -m http.server 8800 -d <carpeta>`.
2. Sacar capturas con Playwright en 1920×1080 y 540×960 con `?t=` en los momentos clave.
3. Comparar contra la hoja de la referencia y ajustar tamaños, tiempos y estilos hasta que se vea igual.
4. Escribir `NOTAS.md`: qué es, qué funciona, qué falta y los créditos.

## B) `lyrics-final-cut/`: falta escribirla entera

- **Referencia:** `assets/_ref/klickpin-grunge-opener (2).mp4` (13,4 s, 736×414), un opener grunge en blanco y negro con rojo.
- **Canción y letra:** `song.mp3` y `lyrics.json` copiados de `lyrics-caution`. Es un tema rap en inglés de 88,8 s.
  - La primera palabra cae en 4,34 s y la última en 87,72 s.
  - Para la intro: artista «Skrxlla», título «Caution».
- **Fotos:** `media/*.jpg` son 10 retratos de Pixabay ya pasados a blanco y negro de alto contraste, y cada uno tiene una variante `-rojo.jpg` en duotono rojo.

  | Archivo | ID de Pixabay |
  |---|---|
  | `perfil-hombre` | 7373140 |
  | `rostro-mujer` | 2303361 |
  | `manos-rostro` | 8004816 |
  | `risa-calvo` | 1868750 |
  | `gafas-vr` | 3460451 |
  | `traje` | 2911330 |
  | `perfil-mujer` | 4447229 |
  | `brazos-arriba` | 4017330 |
  | `modelo-saco` | 9532283 |
  | `sentado` | 814631 |

  La URL es `https://pixabay.com/photos/<slug>-<ID>/` y vale buscarla por ID.
- **Texturas:** `tex/` tiene:
  - `paper.jpg`, el fondo de cartón oscuro;
  - `hatch.jpg`, parches de tela tramada;
  - `torn.png`, el recorte de papel roto;
  - `vstroke.png` y `hstroke.png`, pinceladas blancas;
  - `blob.png`, una mancha de tinta;
  - `speckle.png`.

**Estilo de la referencia:**
- **Fondo:** gris carbón #2B2B2B con textura de cartón, parches tramados más oscuros, scanlines finas, micro-texto HUD y cruces «+» blancas que titilan.
- **Fotos:** retratos en blanco y negro sobre fondo claro, recortados con borde de papel roto, normalmente a la izquierda o al centro y ocupando toda la altura.
- **Texto principal:** chico o mediano, condensado (Oswald 500–600 o Bebas). Va en blanco («FINAL CUT») o en rojo #E3170A («TEMPLATE», «HYPE», «DISTORT», «ABSTRACT», «STUNNER»).
  - Entra con revelado de letras desordenado o tracking ancho que se cierra («F I N A L C U T»).
  - Sale con letras que se apagan sueltas.
- **Palabra gigante de fondo:** extendida y pesada (Archivo wdth 125, peso 900; «OPENER», «MULTIPURPOSE», «DESIGN»).
  - Suele ir en contorno blanco fino y a veces rellena de blanco.
  - Corre en horizontal a medio cuadro o en el borde inferior o superior.
- **Elementos de acento:**
  - garabatos rojos a mano que se dibujan (SVG `stroke-dasharray`) alrededor del texto o cruzando la foto;
  - pinceladas blancas verticales que barren;
  - tres barras blancas horizontales;
  - manchas de tinta que revelan;
  - cortes glitch en franjas horizontales;
  - eco o estela de la foto (2–3 copias desplazadas);
  - la palabra apilada 5 veces en contorno rojo vertical («STYLE»);
  - foto en duotono rojo con glitch («DISTORT»), y foto con trazos rojos sobre la cara;
  - foto repetida en 3 tiras rotas («ABSTRACT»).
- **Ritmo:** un corte cada ~0,8–1,2 s.
- **Cierre:** el logo («envato» en la referencia; usá «NEXA BRIEF» con «SUSCRÍBETE») con estela de copias, sobre el fondo con bloques negros, barrido de pincel y garabato rojo.

**Cómo adaptarlo a la letra** (patrones en `nodemotion/lyrics/lyrics-caution/index.html` y `_tools/commercial/build/core.js`):
- **Filtro de alucinaciones:** aplicá `lyricsFilter` (la sección 4.1 de AGENTS.md trae el ejemplo).
- **Frases:** agrupá en frases de 3,2 s como máximo, y cada frase es una composición distinta. Rotá un mazo de 8 layouts con semilla fija para que en 88 s no se repita.
- **Dentro de la frase:** el texto principal muestra el fragmento cantado (1–3 palabras) y cambia con cada fragmento, con revelado scramble.
- **Palabra de fondo:** la palabra héroe de la frase (no stopword, la más larga) va gigante en contorno.
- **Intro (0–4,34 s):** «CAUTION» con scramble, al estilo de «FINAL CUT».
- **Outro:** del final de la letra al final del audio.

**Contrato:**
- Sigue AGENTS.md §3: carga el config de `config.json` y, si no está, de `assets/config.json`.
  - El único reloj es `audio.currentTime`.
  - Hay que soportar `?t=` y `?debug=1`, y exponer `window.__finalcut.seek(t)`.
  - Las rutas son relativas y el config tiene `seed` y `description`.
- La plantilla tiene que funcionar en 16:9 y en 9:16.
- Para animar, preferí escribir `style` solo cuando cambia (como la función `S()` de `promo-fuerza-motivacion/index.html`) en vez de cientos de animaciones WAAPI.
- No le pongas filtros CSS en vivo a los videos.
- Para las fotos, el filtro `blur` o `contrast` se puede usar con moderación.

**Entregables de B:** `index.html`, `assets/config.json` y `NOTAS.md` con los créditos, más capturas de verificación guardadas en `<id>/_build/capturas/`.

## Al terminar
- Sumá lo aprendido a la sección 5 de `sandbox/nodemotion/AGENTS.md` (solo las lecciones, de forma breve).
- Reportá:
  - qué hiciste;
  - las URLs de prueba, como `http://127.0.0.1:5500/nexa-brief/nexa-brief-server/src/templates/sandbox/nodemotion/<id>/index.html` (Live Server del usuario);
  - qué quedó distinto de la referencia.
