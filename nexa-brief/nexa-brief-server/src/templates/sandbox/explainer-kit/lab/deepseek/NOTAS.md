# Experimento: componentes escritos por DeepSeek V4.1 Flash

Fecha: 2026-10-06 · modelo `deepseek-flash` (thinking desactivado, igual que nexa-explainer) ·
temperatura 0.35 · ~8–15 s y ~2.000–2.800 tokens de salida por componente.

Se pidieron 3 componentes reales que el kit todavía no tenía. Cada ronda se probó en la galería
(9:16 y 16:9, tres instantes) y lo que falló se convirtió en una regla del prompt
(`component-author.md`). Las respuestas crudas de cada ronda están en `../ai-lab/<nombre>-vN.md`
y las hojas de capturas en `../ai-lab/*.png`.

| componente | pedido | v1 | v2 | v3 | v4 | v5 + reparación |
|---|---|---|---|---|---|---|
| `rough.load` | recipiente que se llena de tareas y desborda (1202) | se ve el recipiente, **los bloques nunca aparecen** | ✓ funciona; rótulos ilegibles sobre el rayado | más grande; rótulos desaparecen | ✓ buen tamaño; rótulos sobre rayado; choque con la cabecera | — |
| `rough.appclose` | teléfono que cierra una app y sigue vivo | **se rompe** (`ease(...)` como función); tarjetas fuera del teléfono | ✓ funciona; teléfono chico; tarjeta que sale queda visible | **textos gigantes** (size en px) | ✓ tamaños bien; las tarjetas suben por encima del borde | — |
| `binary.banknote` | billete de 50 con retrato en glifos | arma el billete; **retrato casi invisible** (umbral 0.42) | ✓ en 16:9 el retrato se reconoce; en 9:16 **gira** el billete y el texto | 9:16 horizontal pero diminuto | **se rompe** (trata la lista de puntos como arrays) | ✓ 9:16 apilado sin girar, 16:9 correcto; retrato algo tenue |

## Qué aprendimos (y quedó escrito en el prompt)

1. **La API tiene que decir lo que NO es obvio**, no lo que sí: los trazos de rough nacen invisibles
   (hay que llamar `R.draw`); `ease` es un objeto, no una función; los bocetos tienen márgenes
   dentro de su caja; `sample*` devuelve listas de objetos y `pack` arrays. Cada una de estas
   ambigüedades produjo un componente roto.
2. **Unidades explícitas en una tabla** (px vs u). Al agregar "texto mínimo 1.6·u" sin la tabla, el
   modelo empezó a pasar `size: u * 2.6` → textos 10 veces más grandes.
3. **Las reglas de composición tienen que ser medibles** ("≥ 60% del ancho en 9:16", "cabecera 12%"),
   no adjetivos ("que se vea bien"). Pedirle que escriba las cajas de cada texto en un comentario
   redujo los solapamientos.
4. **Cada regla nueva puede romper otra cosa** (v3 arregló tamaños y rompió unidades; v4 arregló
   unidades y rompió tipos). Un modelo "flash" no mantiene todas las restricciones a la vez de forma
   estable → la solución que escala NO es un prompt perfecto sino **prompt + validación + reparación**.
5. **El ciclo automático (`tools/ai_loop.py`)**: genera → `node --check` → lint de prohibidos
   (`Math.random`, `Date`, colores a mano, `size` en px) → ejecuta en la galería y junta los errores
   de consola → se los devuelve al modelo con su propio código ("corregí SOLO eso") → hasta N
   rondas → hoja de capturas. Con eso, los errores de ejecución se corrigen solos en 1 ronda; lo
   que queda para revisión con ojos es la estética (tamaño, legibilidad, choques).
6. Ningún componente de DeepSeek pasó directo a producción: los tres necesitan un retoque visual
   (rótulos fuera del rayado, límites del contenedor). Por eso viven en `components/ai/` y NO se
   cargan en los videos hasta que alguien los revise y los mueva a su familia.

## Cómo usarlo

```bash
# un componente nuevo con validación y reparación automática (desde nexa-brief-server/)
.venv/bin/python src/templates/sandbox/explainer-kit/tools/ai_loop.py rough.nombre "Creá rough.nombre: …" --repairs 2
# solo pedirlo (sin ciclo)
.venv/bin/python src/templates/sandbox/explainer-kit/tools/deepseek_component.py rough.nombre "Creá …" --tag v1
# mirarlo
.venv/bin/python src/templates/sandbox/explainer-kit/tools/shoot.py hoja.png rough.nombre --js components/ai/rough-nombre.js
```

Recomendación: para componentes **nuevos de una familia ya madura**, DeepSeek Flash + ciclo es
suficiente como primer borrador (≈ 10 s y centavos por intento). Para componentes que definen el
estilo (títulos, retratos, el campo binario) conviene un modelo más fuerte o escribirlos a mano.
