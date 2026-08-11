# 01 — Imagen con fondo (caso #1)

Imagen con fondo de 1 color, 2 (split), 4 (grid) o difuminado + un objeto al
medio (persona, auto...). El HTML crea la ilusión de que solo existe el objeto
(el fondo se funde con la página) y agrega letras cortas según las posiciones
del JSON. La imagen se mueve suave (respiración/deriva). Música acorde.

## Plantilla

- `index.html` — motor v7 (origen: `../../seamless/in-split.html`), 3 modos en
  un solo CONFIG: `solid` / `regions` (split-grid) / `blur` (difuminado).
  **Es estática**: nunca se regenera. Carga su CONFIG en runtime desde
  `config.json` (`fetch("config.json")`), en la misma carpeta. Incluye
  `keepOut` (zonas prohibidas para texto ya horneado en el arte, recorte
  "guillotina") y `typography` (4 combinaciones de fuente: `default` /
  `condensed` / `serif-display` / `black-rounded`, `default` = look de siempre).

## Contenido requerido para la muestra (pendiente — solo listado por ahora)

- [ ] `bg.jpg` — imagen de muestra (fondo plano/2/4 colores o difuminado, objeto al medio)
- [ ] `song.mp3` — música acorde al mood de la imagen
- [x] `config.json` — CONFIG externo que consume `index.html` (incluye
      `keepOut: []` y `typography: "default"` por defecto)

## Flujo de armado

imagen → Prompt 1 (visión) → JSON → Prompt 2 → `config.json` (se coloca junto
a `index.html`, `bg.jpg`, `song.mp3` — el HTML no se toca).
Prompts completos en `Example.md` (variante con detección de rotación +
config.json externo) y en `../../docs/ESTUDIO-FONDOS-COMPLEJOS.md` (v7 base).

## Estado

- [x] Plantilla refinada copiada
- [ ] Assets de muestra
- [ ] Verificado en 16:9 y 9:16
- [ ] Quitar/apagar restos de prueba del CONFIG
