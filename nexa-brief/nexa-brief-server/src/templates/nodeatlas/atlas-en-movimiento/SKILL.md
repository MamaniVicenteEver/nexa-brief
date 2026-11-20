---
name: atlas-en-movimiento
description: Producir un video de mapas animados con Atlas en Movimiento sobre cualquier tema (guerra, suceso histórico, política, economía). Usar cuando se pida un video narrado con mapa, unidades, flechas, documentos, imágenes y cifras; cubre investigación, guion con plan visual, medios, voz, escena y auditorías. No graba MP4.
---

Antes: [CALIDAD.md](../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../skills/PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

# Atlas en Movimiento (skill)

Esta plantilla no tiene tema: el tema sale del pedido. Tiene más de 100 componentes (unidades, flechas, efectos,
territorios, documentos, imágenes, retratos, cifras); un video bueno los usa, no solo texto sobre un mapa.

**Motor único obligatorio:** el orquestador entrega JSON y medios. No crea ni copia `engine/`, componentes,
renderizadores o generadores en el episodio. Todo componente nuevo se desarrolla en el motor principal
`src/templates/nodeatlas/atlas-en-movimiento/engine/` y se registra en Showcase para todos los videos.
Un tema o recorrido diferente se expresa con parámetros del mismo componente. El host genera la entrada
que importa el motor compartido. `tools/check_episode.py <episodio>` debe aprobar antes de entregar.

1. Usa el recorrido por API de `explainer/produce/SKILL.md` §0: consulta estilos y production-guide,
   después solo QUICK y contratos de las piezas elegidas del contexto del host. Si no hay host,
   usa la API de Showcase equivalente; no leas el catálogo completo ni el código del motor.
2. Para escribir y planificar lee `GUION.md` §§2–6 y `MENU-VISUAL.md` §2. Cada segmento
   lleva hechos trazables y una pieza no textual. En guerras de control territorial conserva
   las zonas de cada bando durante el video; rotula posiciones aproximadas y verifica las fuentes.
3. Investiga y guarda `research.json` y `research.md`; registra medios y licencias conforme a
   `src/skills/MEDIOS.md`. Entrega guion, escena y medios en la producción del perfil.
4. El host se ocupa de voz/transcripción en el pipeline; usa los tiempos reales. Ejecuta el
   generador central `tools/build_scene.py <episodio>` y valida `tools/check_episode.py`,
   `tools/cobertura-audit.mjs`. La auditoría `work/escena/estilo-audit.mjs` del diseño
   lee datos de la demo, no del episodio nuevo: no cuenta como comprobación de este. Revisa
   manualmente choques de ranuras en ambos formatos; si se exige auditoría automática del
   episodio y no existe una compatible, registra el bloqueo sin declarar esa puerta aprobada.
   Comprueba teselas,
   hojas de 24 cuadros de ambos formatos, un tramo animado y miniaturas. Prepara el paquete
   editorial y verifica sus datos, fuentes y créditos. Conserva evidencia y consumo.
5. Entrega `INFORME.md` según la plantilla común; primero lo que falte. No grabes, publiques
   ni hagas commit salvo pedido explícito. Si faltan fuentes o medios, no declares listo.

Para casos manuales o diagnósticos consulta secciones concretas de `AGENTE.md`; su lista histórica
que exige catálogos completos no es el recorrido normal. Asignaciones y respaldos se consultan en
`src/skills/models/roles.json`; no se deducen de ejemplos históricos.
