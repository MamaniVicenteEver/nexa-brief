# PLAN - lyrics-hologram-worlds (Holograma Mundos)

Base: lyrics-hologram (Holograma). Variante nueva con motor propio (`--new-design`): la base no puede servir tal cual
porque su linea de tiempo es automatica (frases de Whisper + mazo ponderado) y la referencia exige un guion de escenas
fijo, escena por escena, con texto y tiempos del video. El motor base no se toca: se parte de una copia de su fuente
(player.js + components/) con registro propio `NexaPromo_lyrics_hologram_worlds`.

## Motor
1. `player.js`: modo `config.timeline[]` (linea de tiempo explicita). Cada escena declara t0, t1, tipo, fondo,
   palabras con tiempo absoluto y parametros. Sin `timeline` el motor se comporta como el base (mazo automatico).
2. `components/worlds.js` (nuevo): escena `compose`, definida por datos: lista de elementos (texto, contorno, caja,
   barra, medio, forma, columna repetida, emblema) con posicion normalizada, relleno (blanco, tinta, holo, contorno,
   tenue), entrada y tiempo. Permite replicar cada escena sin codigo por escena. Reutiliza `kit.js` (seda holo, texto
   holo, siluetas, rotulos, rombos).
3. Mundos de fondo ya existentes (void, holo, red, violet, pale) + `ice` (blanco hielo con grano) y `split` (rojo/negro).
4. Formas propias (SVG con relleno holo, sin arte ajeno): emblema, corona, dagas, diamante, balanza, copa, balon,
   placas, cadena. Sustituyen al arte de personajes, logotipos y tarjeta legal del original.
5. Tipografia: condensada ultra gruesa (Anton) en lugar de Bebas Neue; Archivo 125% itálica negra para la extendida;
   Noto Sans KR 900 para el coreano visible en el video.

## Datos
- `assets/song.mp3` y `assets/lyrics.json`: registro del perfil (upload-kda.mp3, 174,94 s; 71 segmentos Whisper). La
  letra Whisper no se usa para el texto en pantalla (tiene errores); se usa el texto visible en la referencia y
  `lyrics.json` queda como respaldo y metadato de sincronia.
- `assets/timeline.json` (generado de `work/tools/timeline.py`): ~90 escenas con tiempos medidos a 1 s sobre la
  referencia, afinadas por tramos.
- Medios: siluetas del registro de la demo Holograma (CREDITS.md de la base). Sin arte de personajes del original.

## Orden de trabajo
A. Proyecto, motor copiado, build local del HTML autocontenido (`work/tools/build.py`). [hecho: proyecto y copia]
B. `player.js` modo timeline + `worlds.js` (compose) + formas SVG.
C. `timeline.py` por tramos (0-24, 24-48, 48-72, 72-96, 96-120, 120-144, 144-175 s).
D. Capturas con `__promo.seek` en los mismos instantes de la referencia y comparacion por hoja de contacto, por tramos
   (no es render de video).
E. `info.json`, `DESIGN.md`, `showcase/components.json`, `CREDITS.md`, `INFORME.md`, `work/results/entrega-produccion.md`.

## No se hace
- No se renderiza video. No se registra en el catalogo ni se pasa a produccion. No se toca lyrics-hologram.
- Sin arte de personajes, logotipos ni tarjeta legal del original.
