import type { Design, Item, Selection } from "../types";

export function resolveSelection(selection: Selection, designs: Design[]): Selection {
  if (selection.kind === "videos" || designs.some((design) => design.id === selection.id)) {
    return selection;
  }
  return { kind: "design", id: designs[0]?.id ?? "" };
}

/** No modifica ni colapsa entradas; conserva el orden relativo de cada grupo. */
export function filterItems(
  items: Item[],
  selection: Selection,
  designs: Design[],
  query: string,
): Item[] {
  const family =
    selection.kind === "design"
      ? designs.find((design) => design.id === selection.id)?.family
      : undefined;
  const needle = query.toLowerCase();

  return items
    .filter((item) => {
      const component = item.component;
      const belongs =
        selection.kind === "videos" ||
        (family !== undefined &&
          (component.name.startsWith(`${family}.`) || component.name.startsWith("common.")));
      const text = `${component.name} ${component.summary ?? ""} ${(component.tags ?? []).join(" ")} ${item.source?.video ?? ""}`;
      return belongs && text.toLowerCase().includes(needle);
    })
    .sort(
      (a, b) =>
        Number(a.component.name.startsWith("common.")) -
        Number(b.component.name.startsWith("common.")),
    );
}
