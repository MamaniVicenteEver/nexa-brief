# Avatar 2D desde una imagen (`_avatar/`)

> Componente para usar UN personaje dibujado (una imagen PNG con fondo transparente) como avatar en
> miles de videos: habla con la voz, parpadea, respira, gira la cabeza, levanta las cejas y hace gestos
> con brazos y manos. Escrito el 2026-10-23, verificado contra `avatar.js`, `gestures.js`, `stage.js`.

## 1. La idea (por qué se ve igual a la imagen)

La imagen **no se redibuja**. `tools/build_avatar.py` la corta en capas siguiendo las líneas de tinta
(cuerpo, cabeza, brazo L, brazo R, mano L, mano R) y completa SOLO lo que queda tapado (cuello bajo la
cabeza, muñeca bajo el puño, contornos compartidos). Cada capa va sobre una malla fina con huesos
(WebGL2, como Live2D/Spine):

- **En reposo** la recomposición es la imagen original (verificado: diferencia media 0,08/255,
  máxima 10/255 por el suavizado del navegador; el constructor falla si pasa de 6/255 entre capas).
- **Brazos**: cada vértice gira una fracción del ángulo del hombro y del codo (mezcla de ángulos, no de
  matrices) → la manga conserva el grosor y el codo se pliega como tela.
- **Cara** (misma malla): parpadeo = el ojo se aplasta sobre el párpado (queda la línea de pestañas),
  cejas arriba/abajo/fruncidas, giro de cabeza con paralaje (los rasgos se corren más que el pelo),
  pelo que sigue a la cabeza con retraso.
- **Lo único dibujado en código** (mismo trazo negro y color de piel de la imagen): la boca abierta
  que habla (`drawMouth` en avatar.js) y las manos de gesto (`characters/<id>/hands/*.svg`). La boca
  cerrada y las manos en reposo son las de la imagen.

## 2. Archivos

```text
_avatar/
├── AVATAR.md            ← este archivo
├── index.html           ← ESTUDIO: botones de cada gesto + deslizadores de cada parámetro (abrir en el navegador)
├── avatar.js            ← motor: carga, mallas, huesos, cara, boca, manos dibujadas, WebGL, IK
├── gestures.js          ← pose = f(t): reposo, parpadeo, labios, gestos/expresiones del timeline
├── stage.js             ← motor de VIDEO (escena = datos) sobre ../../_proto/proto.js
├── tools/
│   ├── build_avatar.py  ← corta la imagen en capas + verificación de reposo (work/diff.png)
│   └── hands_svg.py     ← genera las manos de gesto desde rig.json → hands
└── characters/<id>/
    ├── source.png       ← la imagen original (NO se toca)
    ├── rig.json         ← cortes, huesos, capas, cara, manos (todo en px de source.png)
    ├── parts/*.png + parts.json   ← lo escribe build_avatar.py
    ├── hands/*.svg      ← lo escribe hands_svg.py
    └── work/            ← mapa de partes y diferencia (para mirar; no va a git)
```

Personajes: `chica` (suéter gris, pantalón gris, zapatillas; 1024×1536).

## 3. Usarlo en un video

Una escena = carpeta con `index.html` (igual al de `../avatar-demo/`, no se edita) + `assets/`:
`config.json` (sceneUrl, audio, lyricsUrl), `scene.json`, `song.mp3` (voz) y `lyrics.json` (Whisper).
Voz y tiempos por palabra: los mismos pasos 3–4 de `../AGENTS.md` §5 (narrate.py + transcribe.py).

```jsonc
{
  "seed": 5,                                    // otra semilla = otra agenda de parpadeos
  "avatar": { "character": "chica", "x": 0.5, "portraitX": 0.5, "shot": "full", "flip": false },
  "background": { "type": "color", "color": "#f3f1ee", "shadow": true },   // | image {src, dim}
  "captions": { "enabled": true, "maxWords": 4 },
  "talk": { "enabled": true, "amp": 0.9 },      // labios con la voz (por defecto sí)
  "idle": 1,                                    // cuánto respira/se balancea (0 = quieta)
  "labels": false,                              // true = rótulo con el gesto activo (para revisar)
  "camera": [                                   // planos: full (entera) · medium (cintura) · close (hombros)
    { "t": "@matemático", "shot": "medium", "x": 0.42, "smooth": 1.2 },
    { "t": 20, "shot": "close", "cut": true },  // cut = corte seco
    { "t": "@final", "shot": "full", "portrait": { "x": 0.5 } }
  ],
  "timeline": [
    { "t": 0.1, "do": "saludar", "side": "R", "dur": 2.8 },
    { "t": "@Enigma-0.5", "do": "senalar", "side": "R" },
    { "t": "@cero", "do": "guino", "side": "L" }
  ]
}
```

- Tiempos: número o `"@palabra"` (`"@dos palabras"`, `#2`, `:end`, `+0.3`/`-0.5`), igual que el resto de
  NodeAction. Para que el gesto llegue CON la palabra, adelantarlo 0,3–0,5 s (`"@palabra-0.4"`).
- `side`: lado de **pantalla** (`L` izquierda, `R` derecha). `dur` / `in` / `out` pisan los del gesto.
- Los gestos se pueden superponer (una expresión mientras saluda); el último en empezar manda en lo
  que comparten.
- Responsive: el mismo HTML se graba en 1920×1080 y 1080×1920 (los planos tienen medidas por orientación).
- Ver en vivo: `python3 -m http.server -d src/templates 8800` → `http://127.0.0.1:8800/sandbox/nodeaction/avatar-demo/`
- Cuadros: `tools/frame.py avatar-demo 12.5 [--orient 9x16]`. Grabar: `render_promo.py` (§5 paso 7 de `../AGENTS.md`).

## 4. Gestos (`do`, en español o en inglés)

| español | inglés | qué hace |
|---|---|---|
| `saludar` | `wave` | brazo arriba, mano abierta con dedos separados, vaivén |
| `senalar` | `point` | brazo extendido al costado, índice; mira hacia allá |
| `idea` | `idea` | índice arriba junto a la cara, cejas arriba |
| `contar` | `count` | índice arriba marcando el ritmo |
| `presentar` | `present` | palma abierta hacia el costado ("esto es…") |
| `explicar` | `explain` | las dos palmas delante del pecho, al ritmo; asiente |
| `pensar` | `think` | índice bajo el mentón (IK), otro brazo cruzado con puño, ceño |
| `pulgar` | `thumbsup` | pulgar arriba con un golpecito |
| `encoger` | `shrug` | "no sé": antebrazos afuera, palmas abiertas, cejas arriba |
| `bienvenida` | `welcome` | brazos abiertos, dedos separados |
| `alto` | `stop` | palma al frente, dedos arriba |
| `cintura` | `hip` | puño a la cintura |
| `si` · `no` | `nod` · `shake` | asentir · negar con la cabeza |
| `inclinar` · `mirar` | `tilt` (`deg`) · `look` (`to` −1..1) | inclinar la cabeza · mirar a un lado |
| `sonreir` · `feliz` | `smile` · `happy` | ojos entrecerrados, cejas; feliz abre la boca |
| `sorpresa` · `triste` · `enojo` | `surprise` · `sad` · `angry` | cejas, boca en "o", cabeza |
| `guino` | `wink` | guiña un ojo (`side`) |

## 5. La pose (para gestos nuevos o el estudio)

```js
{ lean, breathe, sway,                      // cuerpo (°)
  head: { tilt, turn, nod }, hairLag,       // tilt ° (+ horario) · turn −1..1 (+ mira a la derecha) · nod −1..1 (+ baja)
  eyes: { blink, L, R },                    // 0..1 (L/R = guiño)
  brows: { L, R, knit },                    // −1..1 arriba/abajo · knit + fruncido, − cejas tristes
  mouth: { open, wide, round },             // 0..1 (cerrada = la boca original)
  arms: { L: { up, bend, wrist, hand, handK }, R: {…} } }
// up   + = el brazo se abre hacia afuera/arriba (90 = horizontal)
// bend + = el antebrazo sigue girando hacia arriba (saludar), − = cruza por delante del cuerpo
// wrist+ = la mano gira hacia afuera · hand: rest | open | spread | point | fist | thumb · handK 0..1 (fundido)
```

Gesto nuevo (en `gestures.js`, sirve para todos los videos):
```js
G.miGesto = { dur: 2, in: 0.4, out: 0.45, apply(P, τ, k, a, S) {
  armTo(P, a.side || "R", { up: 40, bend: 90, wrist: 0, hand: "open" }, k);   // por ángulos
  reach(P, S, "R", [520, 420], 180, k, "point");          // o por IK: muñeca a un punto de la imagen, mano a 180° (dedos arriba)
  mix(P.brows, "L", 0.5, k);                              // cara / cabeza
} };
```
Probarlo en el estudio (`_avatar/index.html`, aparece solo como botón) antes de usarlo en una escena.
Límites de un brazo dibujado colgando: `up` hasta ~90 y `bend` ±150 se ven bien; más allá la manga se estira.

## 6. Mano de gesto nueva

En `rig.json → hands.spec.<forma>`: palma (`palm`, path SVG) + dedos `[x, y, ancho, largo, ángulo, "curl"?]`
(mano izquierda de pantalla, palma a cámara, dedos hacia abajo, pulgar hacia afuera; la derecha es el
espejo) y `thumb`. Agregar el nombre a `hands.shapes` y correr
`python3 _avatar/tools/hands_svg.py chica`. Mirarla en el estudio (selector "mano L/R").

## 7. Personaje nuevo (otra imagen)

1. `characters/<id>/source.png`: personaje de frente, de pie, brazos colgando SEPARADOS o tocando
   apenas el cuerpo, fondo transparente, ≥ 1500 px de alto (los primeros planos amplían ~2×).
2. `rig.json` (copiar el de `chica` y medir sobre la imagen): `cuts` (línea de corte de cada brazo que
   siga la tinta del costado del torso, cuello, semillas de regiones), `bones` (hombro, codo, muñeca,
   cabeza), `face` (centro, ojos con su párpado, cejas, boca, mentón), `hands` (colores de tinta y piel).
3. `python3 _avatar/tools/build_avatar.py <id>` → mirar `work/partmap.png` (cada parte de un color)
   y que la diferencia de reposo sea ≤ 6/255.
4. `python3 _avatar/tools/hands_svg.py <id>` y probar todos los gestos en el estudio (`?c=<id>`).

## 8. Lecciones

- 2026-10-23 · primer avatar (`chica`) desde una imagen generada. Cortar por regiones de relleno
  separadas por tinta + asignar cada píxel de tinta al relleno más cercano sigue las líneas del dibujo;
  donde no hay línea (hombro caído del suéter) se corta con una polilínea y la manga queda fija al
  torso cerca del corte (`pin`), si no el balanceo deja ver una línea.
- El alfa de la imagen trae ruido casi invisible (≤ 12/255) en todo el lienzo: se limpia o los recortes
  miden el lienzo entero.
- Píxeles de tinta en el corte cuyo relleno más cercano está del otro lado quedaban como huecos en la
  línea del brazo (se veía el fondo punteado al moverse) → todo lo que está del lado del brazo es del brazo.
- Las líneas que comparten brazo y cuerpo van en LAS DOS capas; y el cuerpo se extiende 3 px bajo el
  brazo: si no, al ampliar aparecen costuras.
- En la imagen el brazo TOCA el cuerpo: en reposo solo puede moverse hacia adentro (hacia afuera abre
  una rendija al fondo). En los gestos grandes la separación es correcta.
- Mezclar matrices (LBS) achica la manga al levantar el brazo (colapso) → mezcla de ángulos por vértice.
- Una mano que gira "hacia atrás" queda tapada por la manga (va debajo del puño): que siga al antebrazo.
- Parpadeo por aplastamiento: aplastar al 10 % (no a 0) para que quede la línea de pestañas.
