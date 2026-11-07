import type { CatalogContext, Component, Design, Item } from "../types";

/** Datos sintéticos compartidos por los tests de datos, grilla y player. */
export const designs: Design[] = [
  { id: "rough", family: "rough", name: "Prototipo", tagline: "Dibujado a mano", scripts: ["designs/common/text.js", "designs/rough/components/ui.js"] },
  { id: "nuevo", family: "otra-familia", name: "Nuevo", tagline: "Diseño de prueba", scripts: ["designs/common/clip.js"] },
];
export const context: CatalogContext = { designs };

export const component: Component = {
  name: "rough.tarjeta",
  summary: "Una tarjeta de ejemplo",
  layer: "overlay",
  tags: ["texto", "ámbito"],
  params: {
    contenido: { type: "object", default: { lineas: ["uno", 2, null] }, required: true, doc: "Contenido de prueba" },
    variante: { type: "custom", options: ["clara", 2, false, { id: "oscura" }, null], min: null, max: null },
  },
  example: { contenido: { lineas: ["ejemplo"] } },
};

// Las claves son prefijo + JSON.stringify de la tupla; no se unen con separadores.
export const designItem: Item = { key: 'design:["rough","rough.tarjeta"]', designId: "rough", component };
export const commonItem: Item = {
  key: 'design:["rough","common.text"]', designId: "rough",
  component: { name: "common.text", params: {} },
};
export const videoItem: Item = {
  key: 'video:["nodetech/ejemplo","nodetech/ejemplo/assets/components/tarjeta.js","rough.tarjeta"]',
  designId: "rough",
  component: { name: "rough.tarjeta", summary: "Entrada de biblioteca", params: {} },
  source: { video: "nodetech/ejemplo", source: "nodetech/ejemplo/assets/components/tarjeta.js", sheetExists: false, sourceSha256: null },
};
export const unavailableItem: Item = {
  key: 'video:["sandbox/ejemplo","","desconocido.tarjeta"]', designId: null,
  component: { name: "desconocido.tarjeta", params: {} },
  source: { video: "sandbox/ejemplo", source: null }, unavailableReason: "Diseño o fuente no disponible",
};

/** Envolturas de red representativas; el adaptador conserva sus DTO como privados. */
export const designIndexDto = { designs: ["rough", "nuevo"] };
export const designDtos = designs.map((design) => ({ ...design, topics: ["prueba"] }));
export const libraryDto = {
  version: 3,
  components: [
    { ...videoItem.component, video: videoItem.source?.video, source: videoItem.source?.source, sheet_exists: false, source_sha256: null },
    { ...unavailableItem.component, video: unavailableItem.source?.video, source: null },
  ],
};
export const catalogMessage = { type: "kit-design-catalog", design: "rough", components: [component, commonItem.component] };
export const playerComponentMessage = { type: "kit-stage-component", component };
