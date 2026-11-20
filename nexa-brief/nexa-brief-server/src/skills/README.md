# Skills de Nexa Brief: por dónde empezar

Punto de entrada de **cualquier agente** (Claude Code, Codex, otro) al que le piden crear contenido. Lee en este orden y nada más:

1. **`CALIDAD.md`**: el estándar que debe cumplir cualquier resultado. Manda sobre las demás guías.
2. **`ORQUESTACION.md`**: si diriges el trabajo (el humano te lo pidió a ti) o delegas partes. Si eres un trabajador con un brief, lee solo sus §4 y §7.
3. **La skill de tu pedido** (tabla de abajo) y, dentro de ella, solo lo que te indique (contrato de la plantilla o del diseño). No leas el código de motores ni plantillas salvo que la skill lo pida.
4. Para buscar y registrar medios, `MEDIOS.md`. Al delegar, **`PLANTILLA-BRIEF.md`**. Al entregar, **`PLANTILLA-INFORME.md`** (obligatorio).

| Te piden… | Skill | Notas |
|---|---|---|
| Un video explicativo con narración y un diseño existente (NodeTech, NodeHistory, NodeEconomy, NodePolitics…) | `explainer/produce/SKILL.md` | Diseños con estilos (Atlas, Mapas): la misma skill indica su ruta |
| Una edición de un video existente para otro idioma o mercado, conservando su investigación y componentes | `editions/SKILL.md` | Web y agente utilizan la misma API privada; preflight, creación, seguimiento y recuperación con checkpoints |
| Varios videos o preparación programada | `explainer/batch/SKILL.md` | Cola persistente, máximo cinco productores |
| Crear o integrar un diseño reutilizable NodeMotion (letras o promos) | [Autoría de plantillas](../../docs/nodemotion-template-authoring.md) | Motor compartido, demo, contratos y registro; no preparación de episodios |
| Una promo o video animado corto de texto sobre un tema, sin narración (equipo, marca, lugar, evento, producto o causa) | `nodemotion/promo/SKILL.md` y `../templates/_tools/nodemotion/promo/production/GUIDE.md` | Contratos por plantilla en `../templates/_tools/nodemotion/promo/production/templates/` |
| Un video con el estilo Imperio (mapa histórico, sol/rayos y archivo documental; distinto de Atlas en Movimiento) | `explainer/produce/SKILL.md` y `../templates/_tools/explainer-kit/guides/imperio-production.md` | Identidad cinematográfica, aperturas A/B/C, paletas históricas y plan musical compartidos |
| Un video con Atlas Cinemático (mapas 3D) | `../templates/nodeatlas/atlas-cinematico/_atlas/SKILL.md` | Episodio en producción del perfil |
| Un video con Atlas en Movimiento | `../templates/nodeatlas/atlas-en-movimiento/SKILL.md` | Un único motor compartido |
| Una plantilla o diseño **nuevo**, o una réplica de un video de referencia | Letras y promos NodeMotion: «Estándar vigente para plantillas NodeMotion nuevas» del AGENTS.md raíz. Otras categorías: `../templates/sandbox/PROTOTIPO.md` | Coste alto: estudio y motor |
| Publicaciones de imagen (Facebook, Instagram) | `image_posts/SKILL.md` | |
| Textos de publicación (títulos, descripción, miniaturas) | `explainer/strategies/` y `output/copy/` | Lo usa el backend; respeta CALIDAD §6 |
| Qué modelo hace cada rol | `models/roles.json` | Fuente única |

Si tu pedido no encaja en la tabla, aplica `CALIDAD.md` y `ORQUESTACION.md`, busca la skill más parecida y pregunta al humano antes de crear una ruta nueva.
