# Tarea para Codex · paquete de dibujos "estudio" para la pizarra

Claude (orquestador) revisa lo que entregues. Solo podés escribir: `src/templates/sandbox/nodeaction/_pizarra/props/estudio.js`
(NUEVO), la lista de dibujos de `src/templates/sandbox/nodeaction/_pizarra/ESCENA.md` (agregar una línea con el paquete)
y `src/templates/sandbox/nodeaction/_pizarra/tareas/`. NO modifiques `props.js`, `rig.js`, `pizarra.js` ni los personajes.
Sin git commit.

Leé `props.js` (formato: `Pizarra.props.<nombre> = (g, s, p, t, k)`, dibujado centrado en (0,0), `s` = tamaño,
`p` = parámetros del item, `k._t0` = cuándo apareció) y copiá su estilo exacto: línea negra `#151515`, relleno
blanco `#fff` o del fondo, grosor ≈ `s * 0.02–0.03`, sin sombras ni degradados, todo determinista desde `t`.
Mirá la referencia `src/templates/sandbox/nuevos/ejmplo1/videoplayback.mp4` (cuadros con ffmpeg) para el nivel de
detalle: simple, limpio, reconocible al instante.

El archivo empieza igual que props.js (lee `window.Pizarra.rig` y `Proto.U`) y hace
`Object.assign(window.Pizarra.props, { … })`.

## Dibujos (nombre · parámetros · animación propia si la tiene)
- `exam` · `q` (texto de la pregunta, corto) · hoja con encabezado, líneas y una casilla de respuesta vacía.
- `book` · `open` (bool), `title` · libro cerrado (tapa con lomo) o abierto (dos páginas con líneas).
- `card` · `text`, `back` (texto del dorso), `flipAt` (s desde que aparece: gira y muestra el dorso) · tarjeta de estudio.
- `brain` · `glow` (bool: rayitas alrededor que laten) · cerebro de línea con circunvoluciones simples.
- `eye` · ojo abierto con pestañas; parpadea cada ~3 s (determinista).
- `hourglass` · arena que baja con el tiempo desde que aparece (`dur`).
- `curve` · `points` (n puntos), `draw` (s en dibujarse), `flat` (0..1 cuánto se aplana), `labels` (bool: ejes "tiempo" y
  "recuerdo") · curva del olvido: baja rápido y se aplana; ejes en L; puntos sobre la curva que aparecen en orden.
- `calendar` · `days` (7), `marks` [índices con círculo], `markAt` (s entre marcas) · semana en grilla, círculos a mano.
- `bubble` · `text`, `kind` (`speech` | `thought`), `tail` (`left` | `right`) · globo con texto DM Sans 700.
- `magnifier` · lupa (se balancea suave).
- `plant` · planta en maceta con sol y flechitas (fotosíntesis esquemática).
- `puzzle` · `pieces` (3), `joinAt` (s) · piezas separadas que se juntan y encajan.
- `star` · estrella de 5 puntas que hace "pop" con rayitas.
- `bed` · cama de perfil con almohada y "Z z z" que suben.
- `moon` · luna creciente con estrellitas.
- `syllables` · `items` (["DAX","BUP","ZOL"]) · tira de casillas con sílabas.
- `percent` · `text` ("%"), `strike` (s: aparece tachado con una línea roja `#d2453a`).
- `scientist` · perfil de un investigador del siglo XIX: barba, anteojos (busto, mirando a la derecha).
- `columns` · `left`, `right` (títulos) · dos columnas con línea divisoria y un título cada una.
- `pile` · `n`, `split` (0..1 animable con `splitAt`) · una pila alta de hojas que se separa en tres pilas chicas.

## Verificación (obligatoria)
Hacé `tareas/props-test.html` (estructura de `../pizarra-demo/index.html`, cargando proto, rig, props.js,
props/estudio.js, characters/palito.js y pizarra.js) con una escena propia (`tareas/props-test/`, sin audio) que muestre
TODOS los dibujos (nuevos y viejos) en grilla con su nombre (`label`). Capturá con Playwright
(`.venv/bin/python`, `window.__promo.seek(t)`) `tareas/props-sheet.png` en 2–3 instantes para ver las animaciones.
**Mirala** y corregí. Reportá la lista final.
