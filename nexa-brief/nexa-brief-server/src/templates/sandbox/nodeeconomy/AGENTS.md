# AGENTS.md · NodeEconomy (economía) — casa de pruebas

> **Antes que esto, leé `../EXPLAINER.md`** (motor, pipeline, errores ya vistos, diseños nuevos,
> checklist) y `../../_tools/explainer-kit/AGENTS.md` (el pipeline de 10 pasos completo).
> Acá está solo lo propio de economía. Categoría `node_economy` · carpeta `nodeeconomy` ·
> estrategia en `nexa-brief-server/niches.json → categories.node_economy.strategy` (la fuente manda si cambia).
> Estado 2026-10-10: `status: "planned"`, **ningún video todavía** y ningún diseño propio
> (tiene asociado el nicho inactivo `economy_finance` del pipeline viejo; no se usa acá).

## 1. Estrategia (de `niches.json`)

- **Público**: hispanohablantes de 20 a 45 años que quieren entender el dinero sin tecnicismos.
- **Ángulo**: una crisis, una burbuja o una decisión económica **contada como historia**, con lo que enseña para hoy.
- **Tono**: claro, con tensión; **explica cada término la primera vez**.
- **Fórmulas de título**: `Cómo {X} perdió todo en un día` · `La crisis que nadie vio venir: {hecho}` ·
  `Por qué tu dinero vale menos que en {año}` · `La burbuja de {X}: de {subida} a {caída}`.
- **Ejemplos de título**: la estrategia no tiene todavía (`title_examples: []`).
- **Temas sugeridos**: la crisis de 2008, la burbuja de los tulipanes, el crac de 1929, la hiperinflación de Alemania en 1923, la burbuja puntocom.
- **Hashtags**: `#economia #finanzas #historiaeconomica #dinero`.
- **Cadencia por defecto**: `alternate`.
- **Reglas**: las 4 comunes + **nunca dar consejos de inversión personalizados**.

## 2. Reglas especiales (además de las del kit)

- **Sin consejo de inversión**: nada de "comprá", "vendé", "tu dinero debería…", activos o productos
  recomendados, predicciones de precios. La lección para hoy es de **entendimiento** ("por eso existe el
  seguro de depósitos"), no una instrucción financiera.
- **Cifras con año y moneda**: toda cantidad dice de qué año es y en qué moneda; si la convertís a dólares
  de hoy, decí la fuente del ajuste por inflación. En el guion, en palabras; en PLAN §3, con URL.
- **Cada término técnico se explica la primera vez** con una imagen cotidiana (como pide `storytelling.md` §4
  para la jerga): "inflación" = "el mismo billete compra menos pan".
- **Un protagonista humano** (quien decidió, quien perdió, quien vio venir la crisis), no solo gráficos.
- **El dato que vende** (la caída, el precio absurdo, el número de quiebras) va en el gancho o en el clímax.
- Nada de mitos de manual sin verificar (la "tulipomanía" tiene versiones exageradas: separá lo documentado
  de lo popular en PLAN §3 "no se dice").

## 3. Diseños que encajan (no hay propios: vale cualquiera de los 11)

| diseño | por qué | componentes útiles |
|---|---|---|
| `binary` · NODEHISTORY | el más probado y el único con billete propio | `binary.banknote` (billete con retrato y valor), `binary.counter` (cifra que se arma), `binary.chart` (curva), `binary.word`, iconos `banknote`, `wheat`, `house`, `clock` |
| `rough` · PROTOTIPO | explicar mecanismos como diagrama | `rough.counter`, `rough.gauge` (sube/baja), `rough.compare` (escala por área), `rough.flow` (causa→efecto), `rough.tally`, `rough.choice`; bocetos `coin`, `scales`, `papers`, `warning` |
| `periodico` · TITULARES | crisis contadas por los diarios del día (1929, 2008) | `periodico.headline`, `periodico.article`, `periodico.quote` |
| `enmienda` · EXPEDIENTE | datos duros sobre negro | `enmienda.graph`, `enmienda.pictogram`, `enmienda.document` |
| `pelicula` · ARCHIVO 35 | crisis del siglo XX con años gigantes | `pelicula.year` |

Crear el video SIEMPRE con `--folder sandbox/nodeeconomy`: como la categoría no tiene diseños, sin
`--folder` `kit.py new` lo manda a la carpeta del diseño. Un diseño propio "de datos" (gráficos, billetes,
tickers) sería el candidato natural para economía: seguí `../EXPLAINER.md` §5 y registralo en
`categories.node_economy.designs`.

## 4. Buenos y malos temas

| bien (crisis/decisión con antes y después) | mal |
|---|---|
| El jueves negro de octubre de 1929 | "cómo invertir en bolsa", "las 5 acciones para 2027" |
| Alemania 1923: cuando un pan costaba miles de millones de marcos (verificar cifras) | criptomonedas o activos actuales con precio en movimiento |
| La quiebra de Lehman Brothers (sept. 2008) | "cómo hacerte rico", productos financieros con nombre comercial |
| La burbuja puntocom: de la euforia al estallido | política monetaria en curso presentada como opinión |

## 5. Dónde investigar

- Bancos centrales y organismos (Reserva Federal y su historia, Bundesbank, Banco de Inglaterra, FMI,
  Banco Mundial, BIS), series de datos oficiales (p. ej. FRED), informes de comisiones de investigación
  (la de la crisis financiera de 2008 en EE. UU.), NBER, historiadores económicos, prensa de referencia.
- Cifras en dos fuentes; anotá año, moneda y si son nominales o ajustadas.
- Fotos: Wikimedia Commons (archivos, billetes históricos en dominio público, fotos de época); Pexels solo
  para lo genérico moderno (monedas, pantallas de bolsa sin marcas).

## 6. Ejemplo trabajado (idea de prueba)

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new binary hiperinflacion-1923 --title "Cuando el dinero dejó de valer" --folder sandbox/nodeeconomy
# PLAN.md: punto crítico = un momento (un día, una decisión del Reichsbank…; decidilo investigando), cifras con fecha y fuente
.venv/bin/python $M search "German inflation 1923 banknotes"
.venv/bin/python $K voice hiperinflacion-1923
.venv/bin/python $K transcribe hiperinflacion-1923
# storyboard: binary.title en t=0, binary.banknote, binary.counter para la cifra imposible, binary.chart para la curva
.venv/bin/python $K check hiperinflacion-1923
.venv/bin/python $K sheet hiperinflacion-1923 --orient both
.venv/bin/python $K manifest hiperinflacion-1923
```

En `assets/config.json` sobreescribí el cierre (`configs[0].outro.channel`/`handle`): por defecto dice
NODETECH (ver `../EXPLAINER.md` §4). Pedile al usuario el nombre y el handle reales del canal.

## 7. Lecciones de NodeEconomy

- Todavía no hay videos: **el primero es también la prueba de la categoría**. Dejá acá qué diseño
  funcionó para mostrar cifras, cómo se leyeron los números grandes en la voz y qué título se eligió.
- Números enormes: en el guion van en palabras ("ciento cincuenta y nueve trillones"); Whisper los
  devuelve en cifras y las anclas se escriben así. Ojo: `kit.py preview` (tiempos sintéticos) deja los
  números en palabras como en el guion (`tools/fake_timing.py` no los convierte), así que con preview las
  anclas con cifras fallan; anclá en la palabra de al lado o corregilas después de la transcripción real.
- `binary.banknote` vino de DeepSeek (ver `../../_tools/explainer-kit/lab/deepseek/NOTAS.md`): en 9:16 el
  retrato quedaba algo tenue; mirá la hoja antes de apoyarte en él.
- Lo heredado de History y Tech aplica igual (punto crítico, protagonista, jerga traducida).

- 2026-10-15 · diseño **`dinero`** (réplica de la referencia Klickpin "MONEY" verde de esta carpeta): tipografía
  cinética, fotos en teal, plano verde, ojo de cerradura, ojos. Demo `dinero-demo` con la voz de
  `nodetech/nacimiento-ia-dartmouth` (sólo prueba visual). Revisión con hoja densa (3 fps) referencia vs render:
  el orden de planos ya coincidía; lo que faltaba estaba DENTRO de los componentes (giro 3D continuo y
  desenfoque de movimiento en `dinero.spin`, tono partido medido en `dinero.count` (sombras cálidas #753f1e, medios #798e85, luces menta #b1d6c6; `keep` 0,04), ojo de cerradura
  centrado sin alejarse, `dinero.outline` en minúsculas con dos palabras por renglón). Comparar siempre a
  ≥ 3 fps: a 1 fps parecían errores cosas que sí estaban en la referencia (la cortinilla verde de 2 s).

## 8. Promover

`kit.py promote <id>` → crea `nodeeconomy/<id>/` (la carpeta nace con el primer video), después
`kit.py poster <id>`. Checklist: `../EXPLAINER.md` §7 + §2 de este archivo (ningún consejo de inversión,
cifras con año y moneda).

> Al terminar una prueba, sumá acá (§7) lo que funcionó y lo que no.
