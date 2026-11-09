import type { ExplainerVideo } from "@/features/explainer/types";
import type { SandboxFolder } from "@/features/sandbox/types";

/** Muestras explícitas del perfil: no se promueven ni duplican. */
export function sandboxDesignDemos(
  folders: SandboxFolder[],
  categoryId: string,
  videos: ExplainerVideo[],
  registeredDesigns: Array<{ id: string; name: string }> = [],
) {
  const represented = new Set(videos.filter((video) => video.demo).map((video) => video.design));
  const registered = new Map(registeredDesigns.map((design) => [design.id, design.name]));
  return folders
    .filter((folder) => folder.role === "projects")
    .flatMap((folder) => folder.items.map((item) => ({ item, categoryId: folder.categoryId })))
    .flatMap(({ item, categoryId: owner }) => {
      const designId = registered.has(item.id) ? item.id : item.design;
      const isRegisteredDemo = registered.has(item.id);
      const isSandboxDemo = owner === categoryId && item.demo && item.kind === "explainer_kit";
      if (!designId || represented.has(designId) || item.player === "none" || (!isRegisteredDemo && !isSandboxDemo)) return [];
      represented.add(designId);
      return [isRegisteredDemo ? { ...item, title: registered.get(item.id) ?? item.title, design: designId } : item];
    });
}
