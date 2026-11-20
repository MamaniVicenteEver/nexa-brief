import type { LibraryAsset } from "@/features/library/api/library-assets-service";

/** Campos que «Completar datos» exige. El género es opcional: muchas fuentes no lo traen. */
export const MUSIC_COMPLETION_FIELDS = ["artist", "description", "tags"] as const;

export type MusicCompletionField = (typeof MUSIC_COMPLETION_FIELDS)[number];

/** Qué le falta a la ficha de una canción. Lista vacía = datos completos. */
export function missingMusicFields(
  asset: Pick<LibraryAsset, "artist" | "description" | "tags">,
): MusicCompletionField[] {
  const filled: Record<MusicCompletionField, boolean> = {
    artist: asset.artist.trim() !== "",
    description: asset.description.trim() !== "",
    tags: asset.tags.length > 0,
  };
  return MUSIC_COMPLETION_FIELDS.filter((field) => !filled[field]);
}
