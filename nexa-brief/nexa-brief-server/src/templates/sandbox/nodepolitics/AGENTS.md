# AGENTS.md · NodePolitics (política) — casa de pruebas

> **Antes que esto, leé `../EXPLAINER.md`** (motor, pipeline, errores ya vistos, diseños nuevos,
> checklist) y `../../_tools/explainer-kit/AGENTS.md` (el pipeline de 10 pasos completo).
> Acá está solo lo propio de política. Categoría `node_politics` · carpeta `nodepolitics` ·
> estrategia en `nexa-brief-server/niches.json → categories.node_politics.strategy` (la fuente manda si cambia).
> Estado 2026-10-10: `status: "empty"`, **ningún video todavía** (ni en producción ni acá) y ningún diseño propio.

## 1. Estrategia (de `niches.json`)

- **Público**: adultos hispanohablantes que quieren entender cómo se tomaron decisiones políticas que siguen pesando hoy.
- **Ángulo**: cómo se tomó **una decisión política concreta** y qué consecuencias tuvo, contado con hechos verificables.
- **Tono**: **neutral y firme: explica, no toma partido**.
- **Fórmulas de título**: `La decisión que dividió a {país}` · `Cómo {X} llegó al poder (y lo que vino después)` ·
  `Por qué {ley/hecho} sigue importando hoy` · `El voto que cambió {Y}`.
- **Ejemplos de título**: la estrategia no tiene todavía (`title_examples: []`). Cuando un título funcione, proponé sumarlo.
- **Temas sugeridos**: la Enmienda 19 y el voto femenino, el Plan Marshall, la caída de la Unión Soviética, Watergate.
- **Hashtags**: `#politica #historiapolitica #documental`.
- **Cadencia por defecto**: `alternate` (día por medio).
- **Reglas**: las 4 comunes (título verdadero, 40 caracteres, sin mayúsculas sostenidas/emojis, cifras en el guion) +
  - **Neutralidad**: no adjetivar a personas o partidos vivos; mostrar las posturas principales.
  - **Nada de política electoral en curso**: solo hechos cerrados con fuentes.

## 2. Reglas especiales (además de las del kit)

- **Hechos cerrados**: el punto crítico terminó y está documentado (fallos, votaciones, documentos desclasificados, investigaciones concluidas).
- **Posturas en sus propios términos**: si hubo dos bandos, cada uno con su argumento principal y su fuente. El guion no "gana" la discusión por nadie.
- **Verbos neutros** para personas vivas o partidos que existen ("votó", "declaró", "firmó"; no "traicionó", "logró por fin").
- **Citas solo textuales y con fuente** (actas, discursos grabados, documentos). Nada de citas reconstruidas.
- **Cifras electorales** de la fuente oficial (autoridad electoral, actas, archivo del parlamento), con fecha.
- La tesis del video es sobre **cómo funcionó la decisión** (mecanismo, consecuencia), no un juicio moral sobre un bando.
- En el reporte final (AGENTS.md del kit §6) agregá una línea: "neutralidad revisada: …".

## 3. Diseños que encajan (no hay propios: vale cualquiera de los 11)

| diseño | por qué | ojo |
|---|---|---|
| `enmienda` · EXPEDIENTE | pensado para historia política, justicia, leyes, derechos civiles, guerra fría (`enmienda.document`, `enmienda.map`, `enmienda.flag`, `enmienda.graph`, `enmienda.pictogram`) | estética de *13th* (cárcel, barrotes): no lo uses para temas donde eso sugiera una tesis que el video no sostiene |
| `periodico` · TITULARES | sucesos y política contados como titulares; los diarios de la época son la fuente | render más caro |
| `binary` · NODEHISTORY | el más probado; `binary.versus`, `binary.timeline`, `binary.grid`, icono `gavel`, `document`, `barrier` | sin color: la neutralidad visual es natural |
| `pelicula` / `cronica` | siglo XX, guerra fría, política (en sus `topics`) | archivo sepia / 3D oscuro |
| `rough` | decisiones explicadas como diagrama (`rough.choice`, `rough.flow`, `rough.compare`, bocetos `scales`, `flag`, `megaphone`, `papers`) | voz Sadaltager en vez de Charon |

Crear el video SIEMPRE con `--folder sandbox/nodepolitics`: como la categoría no tiene diseños, sin
`--folder` `kit.py new` lo manda a la carpeta del diseño (nodehistory o nodetech).
Si se crea un diseño propio para política, seguí `../EXPLAINER.md` §5 y registralo en `categories.node_politics.designs`.

## 4. Buenos y malos temas

| bien (hecho cerrado, decisión concreta) | mal |
|---|---|
| El voto que dio el sufragio femenino (Enmienda 19, 1920) | cualquier elección, candidato o campaña en curso |
| El Plan Marshall: la decisión de financiar a ex enemigos | "quién tiene razón" en un conflicto abierto |
| La noche en que se disolvió la URSS (dic. 1991) | figuras vivas en actividad política, como protagonista a juzgar |
| Watergate: la cinta que obligó a renunciar | leyes en trámite, juicios sin sentencia firme |

## 5. Dónde investigar

- Documentos primarios: textos de leyes y enmiendas, actas parlamentarias, fallos judiciales, documentos
  desclasificados (National Archives, archivos nacionales de cada país), bibliotecas presidenciales.
- Library of Congress, Britannica, obras de historiadores reconocidos, prensa de referencia de la época.
- Para cada postura, una fuente que la represente en sus propios términos (anotala en PLAN §3).
- Fotos: Wikimedia Commons (LoC, archivos gubernamentales en dominio público). Personas: solo fotos
  documentales, nada que las ridiculice.

## 6. Ejemplo trabajado (idea de prueba)

```bash
K=src/templates/_tools/explainer-kit/tools/kit.py; M=src/templates/_tools/explainer-kit/tools/media.py
.venv/bin/python $K new enmienda enmienda-19-voto --title "El voto que cambió todo" --folder sandbox/nodepolitics
# PLAN.md: punto crítico = la votación de ratificación (decidilo investigando), posturas a favor/en contra con fuente
.venv/bin/python $M search "Nineteenth Amendment ratification 1920"
.venv/bin/python $K voice enmienda-19-voto
.venv/bin/python $K transcribe enmienda-19-voto
# storyboard: enmienda.title en t=0 (no introv1), enmienda.document / enmienda.word / enmienda.graph…
.venv/bin/python $K check enmienda-19-voto       # "0 common.lyric" es esperable en enmienda
.venv/bin/python $K sheet enmienda-19-voto --orient both
.venv/bin/python $K manifest enmienda-19-voto
```

En `assets/config.json` sobreescribí el cierre (`configs[0].outro.channel`/`handle`): por defecto dice
NODETECH (ver `../EXPLAINER.md` §4). Pedile al usuario el nombre y el handle reales del canal.

## 7. Lecciones de NodePolitics

- Todavía no hay videos: **el primero es también la prueba de la categoría**. Dejá acá qué diseño
  funcionó, cuánto tardó, qué título se eligió y cómo se resolvió la neutralidad.
- Lo heredado de History aplica igual (punto crítico, respeto, mitos anotados): ver `../nodehistory/AGENTS.md` §6.
- Al promover, la app lo pone en NodePolitics por la carpeta (`nodepolitics/`) aunque el diseño sea de
  NodeHistory (o por `category: "node_politics"` en el manifest, que manda).

## 8. Promover

`kit.py promote <id>` → crea `nodepolitics/<id>/` (la carpeta nace con el primer video), después
`kit.py poster <id>`. Checklist: `../EXPLAINER.md` §7 + §2 de este archivo (neutralidad revisada).

> Al terminar una prueba, sumá acá (§7) lo que funcionó y lo que no.
