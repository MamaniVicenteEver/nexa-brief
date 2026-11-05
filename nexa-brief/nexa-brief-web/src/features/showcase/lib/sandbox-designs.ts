import type { SandboxPrototype } from "../components/SandboxShowcase";

/** Solo agrupa los episodios que declaran explícitamente el mismo diseño. */
export function groupSandboxDesigns(items: SandboxPrototype[]): SandboxPrototype[] {
  const groups = new Map<string, SandboxPrototype[]>();
  for (const item of items) {
    const key = item.design ? `${item.folder}/${item.design}` : item.path;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].map((episodes) => {
    const primary = episodes.find((item) => item.id === item.design) ?? episodes[0];
    return episodes.length === 1
      ? primary
      : {
          ...primary,
          episodes: [primary, ...episodes.filter((item) => item !== primary)],
        };
  });
}
