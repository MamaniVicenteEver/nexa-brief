# Diseño `rough` · canal **PROTOTIPO** (nombre provisional)

> Tecnología, innovación y creación, dibujadas a mano.

## Identidad

- **Todo se dibuja trazo a trazo** con rough.js (líneas temblorosas de marcador), con "hervor"
  (las líneas vibran a 6 fps como animación en papel). Fondo negro con cuadrícula de puntos.
- **Paleta**: negro `#0a0a0b`, blanco hueso `#ededea`, gris `#90918d` y **lima `#c8ff2e` SOLO para lo
  importante** (el dato, la opción elegida, la alarma). Si todo es lima, nada es importante.
- Tipografía: Inter 900 (títulos y letras grandes), JetBrains Mono (rótulos técnicos), Caveat
  (notas manuscritas en lima: comentarios, nombres, "¡aquí!").
- Fotos: B/N (o viradas a lima) dentro de un marco a mano con cintas, con zoom lento.

## Ritmo

- Cada plano se dibuja en 0,6–1,5 s y se borra con un fundido corto: planos de 3–6 s.
- Impacto: `common.punch` / `common.lyric` en lima, `rough.dsky`, `rough.choice` con ✓ en la palabra exacta.
- Bajos: un solo boceto en el centro, nota manuscrita.

## Componentes (líneas)

| archivo | línea | componentes |
|---|---|---|
| `shapes.js` | base | title, icon, photo, annotate (overlay) |
| `ui.js` | diagramas y dispositivos | flow, compare, stack, dsky, rope, gauge, descent, tally, choice, timeline |
| `extra.js` | revisados (IA / videos) | load, network, note, browser, counter… |
| `outro.js` | cierre | outro (automático) |
| `sketches.js` | bocetos para `icon:` | 85+ (ver CATALOG.md) |

## Qué funciona / qué no

- ✓ Diagramas de causa→efecto, comparaciones de escala, dispositivos dibujados.
- ✓ Texto dentro de cajas sin rayado; el rayado lima va detrás y tenue.
- ✗ Texto encima de un rayado fuerte. ✗ Más de un elemento lima por plano.
