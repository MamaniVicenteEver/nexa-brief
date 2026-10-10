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
