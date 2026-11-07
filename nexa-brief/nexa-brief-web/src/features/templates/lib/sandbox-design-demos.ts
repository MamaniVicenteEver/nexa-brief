import type { ExplainerVideo } from "@/features/explainer/types";
import type { SandboxFolder } from "@/features/sandbox/types";

/** Muestras explícitas del perfil: no se promueven ni duplican. */
export function sandboxDesignDemos(
  folders: SandboxFolder[],
  categoryId: string,
  videos: ExplainerVideo[],
) {
  const represented = new Set(videos.filter((video) => video.demo).map((video) => video.design));
  return folders
    .filter((folder) => folder.role === "projects" && folder.categoryId === categoryId)
    .flatMap((folder) => folder.items)
    .filter(
      (item) =>
        item.demo &&
        item.kind === "explainer_kit" &&
        item.design &&
        !represented.has(item.design) &&
        item.player !== "none",
    );
}
