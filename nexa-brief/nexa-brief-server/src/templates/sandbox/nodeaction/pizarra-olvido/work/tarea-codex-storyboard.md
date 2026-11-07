# Tarea para Codex · storyboard del video "Por qué olvidas lo que estudias" (motor de pizarra)

Sos el director visual. Claude (orquestador) revisa y corrige (vos no podés abrir Chrome: Claude captura las hojas).
Solo podés escribir en `src/templates/sandbox/nodeaction/pizarra-olvido/` (assets/scene.json, assets/config.json,
index.html, work/). NO toques el motor (`../_pizarra/**`, `../../_proto/`). Sin git commit, sin render.

## Leé antes
1. `../_pizarra/ESCENA.md` (formato COMPLETO: planos, items, poses, caras, dibujos, intro, cierre) y
   `../_pizarra/PERSONAJES.md`. Son la ley. Los dibujos disponibles están en `../_pizarra/props.js` y
   `../_pizarra/props/estudio.js` (mirá los parámetros de cada uno en el código).
2. `PLAN.md`, `assets/script.json`, `work/inventario-pizarra.md`.
3. `assets/lyrics.json` — las anclas `"@palabra"` tienen que existir AHÍ (números en cifras, sin tildes).
   Palabra repetida → `#n` o una frase de 2–3 palabras única.
4. `../pizarra-demo/` (index.html + assets/scene.json) como ejemplo que funciona.
5. Cuadros de la referencia `src/templates/sandbox/nuevos/ejmplo1/videoplayback.mp4` (ffmpeg -ss … -frames:v 1):
   composición, aire, tamaño del personaje, títulos en arco al empezar cada paso.

## Qué entregar
- `index.html`: copia de `../pizarra-demo/index.html` + `<script src="../_pizarra/props/estudio.js"></script>` (después
  de props.js) + los characters que uses (antes de pizarra.js). Cambiá el `<title>`.
- `assets/config.json` como el de pizarra-demo (`audio.src = "assets/song.mp3"`, `lyricsUrl = "assets/lyrics.json"`).
- `assets/scene.json` completo (~7 min):
  - `"character": "nina"` (Inés es la protagonista en todo el video). Si en algún plano aparece "el profe"
    explicando un dato (Ebbinghaus, Roediger y Karpicke…), podés usar un segundo item `man` con id `profe` y
    `"cast": { "profe": { "character": "profe" } }`, pero sin abusar (≤ 6 planos).
  - `intro` v1: titular corto con `^x^` (p. ej. "POR QUÉ ^OLVIDAS^\nLO QUE ESTUDIAS"), kicker "Memoria · 4 pasos", dur 4–5.
    El primer plano empieza cuando termina la intro.
  - `outro` { channel "NODEACTION", handle "youtube.com/@nodeaction" }.
  - Un plano cada 4–10 s (≈ 50–80 planos), cada uno con: el personaje (h 700–800, a un costado, poses y caras
    que cambian con la voz) + 1–3 dibujos anclados a sus palabras + ≤ 6 palabras tipeadas (`type`) o un `label`.
  - Al empezar cada paso: plano con título en `arc` ("PASO 1 · DEJA ESPACIO") como la referencia ("THE 5-MINUTE
    HABIT / MINUTE 1 — LISTEN"). Rótulos verdes `script` para momentos clave ("El giro", "Tu reto").
  - Variá la composición: personaje a la izquierda, a la derecha, centrado y chico con dibujos grandes; no repitas
    el mismo esquema 3 planos seguidos. Usá `hold` para que sostenga libro/tarjeta/hoja.
- `work/storyboard-notas.md`: tabla plano → segmento, qué se ve.

## Verificación (sin Chrome)
- Validá el JSON y que TODAS las anclas existan en lyrics.json con un script de Python que replique la regla de
  `../../_proto/proto.js → makeTimer` (normalizar sin tildes/signos, buscar la secuencia, `#n`, `:end`, `+x`). 0 faltantes.
- Que cada `name` de prop exista en props.js o props/estudio.js, y cada pose/cara en `rig.js`.
- Reportá: cantidad de planos, personajes usados, anclas verificadas.
