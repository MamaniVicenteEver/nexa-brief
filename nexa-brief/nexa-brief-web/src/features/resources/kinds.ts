import type { LibraryAssetKind } from "@/features/library/api/library-assets-service";

/** El Estudio habla en singular ("image") y la API en plural ("images"):
 * se aceptan ambos y se normaliza acá, en un solo lugar. */
export type ResourceKind = "music" | "image" | "video" | LibraryAssetKind;

export function toApiKind(kind: ResourceKind): LibraryAssetKind {
  if (kind === "image") return "images";
  if (kind === "video") return "videos";
  return kind;
}

/** Qué acepta el input de archivo por tipo (el backend valida igual: 415). */
export const ACCEPT_BY_KIND: Record<LibraryAssetKind, string> = {
  images: "image/*",
  music: "audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac",
  videos: "video/*,.mp4,.mov,.webm,.mkv",
};

export function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
