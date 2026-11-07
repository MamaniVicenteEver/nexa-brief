# Personajes de la pizarra (intercambiables)

El entorno de la pizarra NO cambia (fondo, trazo, texto, dibujos). Lo que cambia es el **personaje**.
Cada personaje es un archivo `characters/<id>.js` que solo DIBUJA; el esqueleto, las poses y las caras
son comunes (`rig.js`), así que cualquier personaje hace todas las poses sin código extra.

## Elegirlo en una escena (`assets/scene.json`)

```jsonc
"character": "profe",                       // el de todo el video (por defecto "palito")
"look": { "colors": { "fill": "#ffffff" } }, // retoques globales (opcional)
"cast": {                                   // por id de item "man" (pisa lo anterior)
  "m":   { "character": "profe" },
  "est": { "character": "nina", "look": { "colors": { "accent": "#d2453a" } } }
}
```
Un item `{ "type": "man", "id": "est", … }` usa `cast.est`; también puede traer `"character"` propio.
Y cargar el archivo en el `index.html` del video: `<script src="../_pizarra/characters/<id>.js"></script>`
(antes de `pizarra.js`).

## Contrato

```js
window.Pizarra.characters.<id> = {
  name: "Nombre visible",
  scale: { head: 1, tube: 1, height: 1 },   // opcional: cabeza, grosor de miembros, altura
  draw(g, J, o) { … },
};
```
- `J` (px): `hip`, `neck`, `sh` (hombros), `armR`/`armL` = `[codo, mano]`, `legR`/`legL` = `[rodilla, pie]`,
  `head = { x, y, r, tilt }`, `h` = altura total. `R` = mano derecha en PANTALLA.
- `o`: `lw` (grosor de línea), `tube` (ancho de miembro), `ink` (#151515), `bg` (#efefef), `face`
  (expresión: smile · grin · worried · shock · think · talk), `t`, `P` (pose actual), `look` (de la escena),
  `lookX`, y los colores de `look.colors` (`fill`, `skin`, `shoe`, `accent`, …).
- Helpers de `Pizarra.rig` (usalos, no copies código): `tubes(g, J, o, extra?)` silueta de doble trazo
  (extra = más polilíneas con el mismo trazo, p. ej. un bastón), `feet`, `hands`, `waveLines`,
  `headCircle(g, J, o, (g, r) => { pelo, accesorios, R.face(...) })` (dibuja en el marco rotado de la cabeza),
  `face(g, cx, cy, r, kind, t, lw)`, `line`, `curve`, `circle`.
- Reglas: mismo lenguaje que la referencia (línea negra limpia, relleno del color del fondo, sin sombras ni
  degradados), determinista (todo desde `o.t`), legible desde 300 px de alto, sin texto ni marcas.
- **Orden de capas (obligatorio)**: lo de ATRÁS (mochila, pelo largo, capa) → `tubes(g, J, o, [], ["legs", "torso"])` →
  ROPA → `tubes(g, J, o, [], ["arms"])` → `hands`/`feet` → cabeza. Así los brazos quedan siempre delante de la ropa.
- Ropa: se dibuja ENTRE el cuerpo y los brazos (falda = trapecio desde la cadera; corbata = rombo bajo el cuello;
  saco = polígono hombros→cadera), con `o.ink` y relleno `o.bg` o `look.colors.fill`.

## Personajes disponibles
| id | qué es |
|---|---|
| `palito` | el monigote de la referencia (por defecto) |
| `profe` | docente con pelo corto al costado, anteojos redondos, bigote, corbata y saco abierto |
| `nina` | estudiante con flequillo, coleta que se balancea y falda trapecio |
| `abuelo` | abuelo calvo con pelo en las sienes, barba corta y anteojos; admite `look.cane: true` |
| `nino` | niño de menor estatura, con cabeza grande, gorra con visera y mochila |
| `obrera` | trabajadora con casco de seguridad, pelo recogido y overol con tirantes |
