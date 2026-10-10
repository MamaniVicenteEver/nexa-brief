# Plantillas tristes (lyrics-lluvia-gris · lyrics-memoria · lyrics-ceniza · lyrics-vacio)

Generadas con el núcleo común `_tools/commercial/build/core.js` + `build/sad-common.js`
(utilidades compartidas: metraje con movimiento lento, niebla, lluvia, partículas,
revelados y destrucción de letras) + el archivo de escenas de cada una
(`lluvia.js`, `memoria.js`, `ceniza.js`, `vacio.js`).

Los HTML se GENERAN — no editar `lyrics/<id>/index.html` a mano:

    python3 _tools/commercial/build/build.py lyrics-lluvia-gris lyrics-memoria lyrics-ceniza lyrics-vacio

Cada plantilla: `index.html` + `assets/config.json` (paleta, grados, media, mazo de
escenas `layouts`, transiciones) + `assets/lyrics.json` (Whisper) + `assets/song.mp3`
+ `assets/media/` (6 clips de Pexels, ver `CREDITS.md`, con variantes pre-gradadas).

Transiciones reales entre escenas: `config.transition.overlapSec` mantiene viva la
escena anterior debajo de la nueva; `transition.weights` sortea el tipo (fade, blur,
iris, wipe*, bars, rain, burn, ink, flash, zoomIn/Out, slice). Un tipo fijo por
escena: `layouts.<tipo>.trans`. Clips preferidos por escena: `layouts.<tipo>.media`.

Render fluido (recomendado, son plantillas pesadas): cuadro a cuadro

    python3 _tools/commercial/render_promo.py lyrics/lyrics-ceniza/index.html out.mp4 --workers 4
