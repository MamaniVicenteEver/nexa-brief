import type { ShowcaseCatalog, ShowcaseEntry } from "../api/standard-showcase-repository";

export const entryTypeLabels = {
  component: "Componentes",
  sprite: "Sprites",
  character: "Personajes",
  set: "Escenarios",
  action: "Acciones",
  workflow: "Guías",
} as const;
export type EntryType = keyof typeof entryTypeLabels;
export type CatalogFilter = { id: string; label: string; entryIds: Set<string> };

const commonTags = [
  "texto",
  "text",
  "título",
  "títulos",
  "tarjetas",
  "cards",
  "foto",
  "imagen",
  "imágenes",
  "video",
  "vídeo",
  "clip",
  "datos",
  "intro",
  "cierre",
];

const familyLabels: Record<string, string> = {
  actions: "Acciones",
  characters: "Personajes",
  sets: "Escenarios",
  expressions: "Expresiones",
  visemes: "Bocas",
  hands: "Manos",
  outfits: "Vestuario",
  hair: "Cabello",
  props: "Objetos",
  shots: "Planos",
  sceneTransitions: "Transiciones",
  castModes: "Reparto",
  initialState: "Estado inicial",
  ui: "Interfaz",
  fx: "Efectos",
  debug: "Diagnóstico",
  animacion: "Animación",
  aperturas: "Aperturas",
  camara: "Cámara",
  cierres: "Cierres",
  datos: "Datos",
  imagenes: "Imágenes",
  mapa: "Mapa",
  mapas: "Mapas",
  rotulos: "Rótulos",
  rutas: "Rutas",
  territorios: "Territorios",
  voz: "Voz",
  carrier: "Portaaviones",
  warship: "Buques de guerra",
  cargo: "Cargueros",
  submarine: "Submarinos",
  air: "Aviación",
};

export function entryType(entry: ShowcaseEntry): EntryType {
  // Older catalogues predate section; their stable sprite IDs still identify them.
  if (entry.section === "sprites" || entry.id.startsWith("sprite-")) return "sprite";
  return entry.section === "workflows" ? "workflow" : entry.kind;
}

/** Preserve each design's own tabs, then expose families/tags not covered by them. */
export function catalogFilters(catalog: ShowcaseCatalog | undefined, entries: ShowcaseEntry[]) {
  const filters: CatalogFilter[] = [];
  const covered = new Set<string>();
  for (const group of catalog?.groups ?? []) {
    const members = entries.filter(
      (entry) =>
        group.components.includes(entry.name) ||
        group.families.includes(entry.family ?? "") ||
        group.families.includes(entry.name.split(".")[0]),
    );
    if (!members.length) continue;
    const entryIds = new Set(members.map((entry) => entry.id));
    for (const id of entryIds) covered.add(id);
    filters.push({ id: `group:${group.id}`, label: group.label, entryIds });
  }
  const families = [...new Set(entries.map((entry) => entry.family).filter(Boolean))].sort();
  for (const family of families) {
    if (!family) continue;
    const members = entries.filter((entry) => entry.family === family);
    if (members.every((entry) => covered.has(entry.id))) continue;
    filters.push({
      id: `family:${family}`,
      label: familyLabels[family] ?? family.replaceAll("_", " "),
      entryIds: new Set(members.map((entry) => entry.id)),
    });
  }
  const tags = [...new Set(entries.flatMap((entry) => entry.tags ?? []))].sort((a, b) => {
    const rank = (tag: string) => {
      const position = commonTags.indexOf(tag.toLocaleLowerCase());
      return position < 0 ? commonTags.length : position;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  for (const tag of tags) {
    filters.push({
      id: `tag:${tag}`,
      label: tag,
      entryIds: new Set(
        entries.filter((entry) => entry.tags?.includes(tag)).map((entry) => entry.id),
      ),
    });
  }
  return filters;
}
