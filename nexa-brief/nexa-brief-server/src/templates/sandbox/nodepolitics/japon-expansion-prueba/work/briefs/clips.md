# Brief de trabajo · clips de video de archivo

## Objetivo

Conseguir entre 8 y 10 clips de VIDEO MUDO, con licencia libre, para una prueba de la plantilla
`nodepolitics/japon-expansion-prueba`: un documental de 2 minutos sobre la expansión del Imperio
japonés (1868–1942). Los clips se mostrarán en blanco y negro, fundidos con un mapa, así que lo que
importa es el contenido histórico y que se vea nítido, no el color.

Temas buscados (uno o más clips por tema; el tema pesa más que la perfección):

1. Barcos de guerra japoneses o buques de la época navegando (Armada Imperial, 1900–1942).
2. Soldados japoneses desfilando o en campaña en los años 1930 (Manchuria, China).
3. Combates o ciudades de China en 1931–1937 (Mukden, Shanghái, Puente Marco Polo). NADA gráfico:
   sin cadáveres ni violencia explícita.
4. Aviones japoneses o portaaviones despegando (1940–1942).
5. Ataque a Pearl Harbor (archivo de la Marina de EE. UU., dominio público).
6. Tropas o buques en el Sudeste Asiático (Filipinas, Malaya, Singapur, Indias Orientales), 1941–42.
7. Respaldo atmosférico (solo si falta lo anterior): Tokio, el Pacífico, olas, bandera de Japón.
   Para estos puedes usar Pexels o Pixabay.

## Contexto mínimo a leer

- `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/_tools/explainer-kit/guides/media.md`
  (sección de clips de video, §6) y `python .../tools/media.py --help`.

## Archivos que puede tocar

- `assets/media/*.mp4` y `assets/media/CREDITS.md` (solo agregar líneas) de esta plantilla.
- `work/results/clips.md` (entregable).
- Temporales en `/tmp`.

## Cómo trabajar

Desde `nexa-brief-server/`:

```bash
K=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K search "Imperial Japanese Navy 1930s" --type video --source commons
.venv/bin/python $K search "Pearl Harbor attack" --type video --source commons
.venv/bin/python $K get japon-expansion-prueba "File:XXXX.webm" nombre.mp4 --start 5 --dur 10
```

- Nombres de archivo: `clip-<tema>-<n>.mp4`, en minúsculas, sin espacios (p. ej. `clip-armada-1.mp4`).
- Cada clip dura entre 8 y 12 s (usa `--dur`). Elige tramos con movimiento y sin textos ni sellos grandes
  encima si es posible.
- Solo dominio público, CC0, CC BY, CC BY-SA o licencia de Pexels/Pixabay. `media.py get` anota el crédito.
- Busca primero en Wikimedia Commons (`--source commons`): allí hay metraje de la Marina y el Ejército
  de EE. UU. y noticieros de dominio público. Prueba también búsquedas en inglés alternativas
  ("Japanese warship", "Japanese troops China 1937", "Shanghai 1937", "Mukden 1931", "Zero fighter",
  "Akagi", "aircraft carrier Pacific 1942", "Philippines 1941", "Singapore 1942", "Hong Kong 1941").
- Verifica cada clip con `ffprobe` (duración, resolución ≥ 480 px de lado corto, sin audio) y mira UN
  fotograma de cada uno (extráelo con ffmpeg a `/tmp` y ábrelo) para confirmar que muestra lo que dices.
  Si un clip no corresponde al tema, descártalo y bórralo.

## Entregable exacto

`work/results/clips.md` con una tabla: archivo | tema | qué se ve (1 línea) | duración | resolución |
fuente (URL) | licencia | autor | fecha o época del metraje | apto para (qué parte del relato). Además,
una sección "Faltan" con los temas sin cubrir. No inventes datos: copia la fuente y la licencia de
lo que devuelve `media.py`.

## Cómo verificar

- `ls -la assets/media/*.mp4` muestra los clips, cada uno > 300 KB.
- `ffprobe` de cada clip: sin pista de audio, duración 8–12 s.
- Cada archivo tiene su línea en `assets/media/CREDITS.md`.

## Prohibido

- No escribas fuera de `sandbox/nodepolitics/japon-expansion-prueba/`, excepto temporales en `/tmp`.
- No edites `delegate.sh` ni otros lanzadores mientras estén corriendo.
- No cambies plantillas publicadas ni herramientas compartidas. No toques `assets/storyboard.json`,
  `assets/script.json`, `assets/flags/` ni `assets/components/`.
- No descargues nada que no pase por `media.py get` (licencia y crédito automáticos).
