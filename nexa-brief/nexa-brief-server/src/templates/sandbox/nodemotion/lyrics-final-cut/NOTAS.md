# Lyrics · Final Cut (prototipo)

Réplica del opener grunge de Klickpin (`assets/_ref/klickpin-grunge-opener (2).mp4`) aplicada a una letra.
La canción es Caution (`song.mp3` + `lyrics.json` de `lyrics-caution`). Reescrita por Claude el 2026-10-15 (reemplaza la versión de Codex).

## Cómo funciona
- **Reloj:** `audio.currentTime` es el único reloj. Para probar: `?t=SEG` congela un cuadro, `?debug=1` muestra el HUD y `window.__finalcut.seek(t)` sirve para las capturas.
- **Letra:**
  - las palabras de Whisper se agrupan en frases (`phrases`: hasta 7 palabras, 3,2 s o un hueco de 0,6 s);
  - cada frase es una **toma**, y las tomas siguen el orden de la referencia (`config.shots`, 12 tomas en ciclo);
  - dentro de la toma, el texto muestra el fragmento cantado (1–2 palabras), que entra con revelado desordenado y tracking que se cierra, y sale con letras sueltas que se apagan.
- **Palabra héroe:** es la palabra más larga de la frase que no es stopword. Va gigante en contorno o rellena, corre de fondo y alimenta la toma «stack».
- **Huecos instrumentales:** siguen el ciclo con tomas eco de ~1,2 s, solo con la palabra héroe, porque la referencia corta cada ~1 s.
- **Intro:** título y artista (`intro`). **Cierre:** «NEXA BRIEF» con estela y «SUSCRÍBETE» (`outro`).
- **Fondo fijo:** `tex/paper.jpg`, scanlines, micro-texto HUD y cruces que titilan.
- **Texturas:** `_build/textures.py tex grunge` genera las máscaras PNG blancas con alfa (la tela tramada es `hatch.jpg`).

## Tomas (orden de la referencia)
profile · profileRed · scribble · brush · stack · glitch · distort · strips · empty · duo · trail · giantFill

## Diferencias que quedan respecto de la referencia
- La referencia es un opener de 13 s con palabras sueltas. Acá la letra manda los cortes, así que algunas tomas duran más (1,5–3 s).
- En «distort», la referencia usa una foto en color. Acá todas las fotos van en blanco y negro.
- Las fotos son de Pixabay: algunos retratos tienen fondo oscuro y la referencia usa fondos claros.

## Créditos (Pixabay, licencia libre)
Todas las fotos son de Pixabay; se buscan por ID en pixabay.com.

| Archivo | ID | Autor |
|---|---|---|
| `perfil-hombre` | 7373140 | Pavan_gude |
| `rostro-mujer` | 2303361 | Engin_Akyurt |
| `manos-rostro` | 8004816 | Sunriseforever |
| `risa-calvo` | 1868750 | Pexels |
| `gafas-vr` | 3460451 | JESHOOTS-com |
| `traje` | 2911330 | RoyalAnwar |
| `perfil-mujer` | 4447229 | krivitskiy |
| `brazos-arriba` | 4017330 | 46173 |
| `modelo-saco` | 9532283 | _Mukula |
| `sentado` | 814631 | SJJP |
