import type { SandboxFolder, SandboxItem } from "../types";

const updatedTime = (item: SandboxItem) => (item.updatedAt ? Date.parse(item.updatedAt) : 0);

export function selectSandboxItems(folders: SandboxFolder[], folder: string): SandboxItem[] {
  const items = folders
    .filter((entry) => (folder === "all" ? entry.role !== "references" : entry.folder === folder))
    .flatMap((entry) => entry.items);
  return items.sort((left, right) => updatedTime(right) - updatedTime(left));
}

export function countSandboxItems(folders: SandboxFolder[]): number {
  return folders.reduce(
    (total, folder) => total + (folder.role === "references" ? 0 : folder.items.length),
    0,
  );
}

/** La muestra asociada a un diseño ya registrado se presenta en su categoría de producción. */
export function hideProductionDesignDemos(
  folders: SandboxFolder[],
  designs: Array<{ id: string; state: string }>,
): SandboxFolder[] {
  const productionIds = new Set(designs.filter((design) => design.state === "produccion").map((design) => design.id));
  return folders.map((folder) => folder.role === "references" ? folder : {
    ...folder,
    items: folder.items.filter((item) => !productionIds.has(item.id)),
  });
}
