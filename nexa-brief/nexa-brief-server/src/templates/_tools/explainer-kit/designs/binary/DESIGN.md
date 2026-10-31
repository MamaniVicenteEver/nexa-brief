# Diseño `binary` · canal **NODEHISTORY**

> Historias que cambiaron el mundo, dibujadas con unos y ceros.

## Identidad

- **Todo es un solo campo de ~11.000 dígitos** (`0`, `1`, `·`) que viaja de una forma a la siguiente:
  la transición ES el estilo. Nada aparece "de la nada": se arma desde el polvo o desde la forma anterior.
- **Blanco sobre negro, sin color.** El "acento" es blanco pleno contra el gris de lo demás.
- Tipografía: Inter 900 (formas y letras grandes), JetBrains Mono (rótulos en etiquetas blancas,
  mayúsculas), Playfair Display itálica (nombres propios y años: el toque "histórico").
- Fotos: siempre B/N; los retratos se convierten en dígitos (`binary.portrait`), los lugares y
  objetos van dentro de un marco de glifos (`binary.frame`).
- Subtítulos karaoke abajo: la palabra que se dice en negrita blanca.

## Ritmo

- Planos de 3–6 s; las formas tardan ~1,1 s en armarse (`morph`), así que un plano de < 2 s no
  llega a leerse salvo letras grandes.
- Momentos de impacto: `binary.word` (cifra/fecha gigante), `binary.counter` (slot), `common.lyric`.
- Momentos bajos: `binary.floor`, `binary.tunnel`, retrato quieto.

## Componentes (líneas)

| archivo | línea | componentes |
|---|---|---|
| `shapes.js` | formas | title, word, portrait, icon, orbit, grid, chart, tunnel, rays, frame, bubble, floor |
| `ui.js` | diagramas | counter, cipher, rotors, timeline, versus, convoy |
| `extra.js` | revisados (IA / videos) | banknote, wall… |
| `outro.js` | cierre | outro (automático) |
| `icons.js` | siluetas para `icon:` | ver CATALOG.md |

## Qué funciona / qué no

- ✓ Siluetas llenas y simples (llave, manzana, candado). ✗ Detalles finos de < 2 celdas.
- ✓ Retratos frontales con fondo liso. ✗ Fotos de grupo o caras chicas como `portrait` (usar `frame`).
- ✓ Un texto corto por plano. ✗ Párrafos: para eso están los subtítulos.

## Reglas automáticas del diseño (design.json → defaults)

- **Clips**: `clip.layout = "frame"`, `clip.size = 0.92` → centrados, un poco más grandes que las fotos, rótulo
  debajo. En el storyboard no se pone `layout` ni `size`.
- **Duración mínima**: `minDur = {"common.clip": 6}` → el motor alarga el clip a 6 s y corre los beats siguientes.
  Bajar clips de 6–8 s.
- **Overlays**: `overlay = {"endWithScene": true, "min": 2.5, "max": 8}` → una marca sin `dur`/`until` desaparece
  cuando cambia la escena de debajo.
- **Bordes**: El fondo ya es `#000`, así que no hace falta degradar los bordes.
- Si hay que cambiar uno de estos criterios, se cambia aquí (design.json), nunca video por video.
