import type { CategoryNode } from "@/features/categories";
import type { Niche } from "../types";

export interface NicheGroup {
  id: string;
  name: string;
  order: number;
  niches: Niche[];
}

/** Agrupa por metadata del catálogo, no por prefijos de IDs. */
export function groupNiches(niches: Niche[]): NicheGroup[] {
  const groups = new Map<string, NicheGroup>();
  for (const niche of niches) {
    const current = groups.get(niche.categoryId);
    if (current) {
      current.niches.push(niche);
      continue;
    }
    groups.set(niche.categoryId, {
      id: niche.categoryId,
      name: niche.categoryName,
      order: niche.categoryOrder,
      niches: [niche],
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      niches: [...group.niches].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
      ),
    }))
    .sort((a, b) => {
      return a.order - b.order || a.name.localeCompare(b.name);
    });
}

export interface NodeMenuSection {
  id: string;
  name: string;
  topic: string;
  /** "pipeline": sus nichos se eligen acá. "explainer_kit": abre el creador de video explicativo. */
  engine: CategoryNode["engine"];
  status: CategoryNode["status"];
  groups: NicheGroup[];
}

/** Menú por categorías NODE: NodeMotion con sus nichos agrupados por subcategoría
 * (Letras, Promos, …) y las categorías explainer como una sola entrada cada una.
 * Los nichos que no están en ninguna categoría van al final ("Otras"). */
export function groupByNodeCategories(niches: Niche[], tree: CategoryNode[]): NodeMenuSection[] {
  const byId = new Map(niches.map((n) => [n.id, n]));
  const used = new Set<string>();
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const niche = byId.get(id);
      if (!niche) return [];
      used.add(id);
      return [niche];
    });
  const sections: NodeMenuSection[] = tree.map((node) => {
    const own = pick(node.niches);
    const children = node.children.map((child, i) => ({
      id: child.path,
      name: child.displayName,
      order: i,
      niches: pick(child.niches),
    }));
    const groups = [
      ...(own.length ? [{ id: node.path, name: node.displayName, order: -1, niches: own }] : []),
      ...children,
    ].filter((g) => g.niches.length > 0);
    return {
      id: node.id,
      name: node.displayName,
      topic: node.topic,
      engine: node.engine,
      status: node.status,
      groups,
    };
  });
  const rest = niches.filter((n) => !used.has(n.id));
  if (rest.length) {
    const motion = sections.find((s) => s.engine === "pipeline");
    const others = groupNiches(rest).map((g) => ({ ...g, id: `otras-${g.id}` }));
    if (motion) motion.groups.push(...others);
  }
  return sections;
}
