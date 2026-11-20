import type { LibraryAsset } from "@/features/library/api/library-assets-service";
import type { RequirementText } from "@/features/templates/types";

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

function songTextKind(field: RequirementText): "title" | "artist" | null {
  const context = normalized(`${field.key} ${field.label}`);
  if (/(song|track|cancion|tema)/.test(context) && /(title|name|titulo|nombre)/.test(context)) {
    return "title";
  }
  if (/(artist|artista|interprete|performer)/.test(context)) return "artist";
  return null;
}

/** Vuelve a los textos declarados por la plantilla al quitar la canción. */
export function resetSongMetadataTextFields(
  fields: RequirementText[],
  values: Record<string, string>,
  replacement: "default" | "empty" = "default",
): Record<string, string> {
  const next = { ...values };
  for (const field of fields) {
    if (songTextKind(field)) next[field.key] = replacement === "empty" ? "" : (field.default ?? "");
  }
  return next;
}

/** Rellena solo los campos de canción; los textos de cierre siguen siendo los de la plantilla. */
export function updateSongMetadataTextFields(
  fields: RequirementText[],
  values: Record<string, string>,
  song: LibraryAsset,
): Record<string, string> {
  const next = { ...values };
  const title = song.name.trim() || song.title.split(" — ", 1)[0].trim();
  for (const field of fields) {
    const kind = songTextKind(field);
    if (kind === "title") next[field.key] = title;
    if (kind === "artist") next[field.key] = song.artist.trim();
  }
  return next;
}

/** Al reabrir un prototipo, completa valores vacíos o aún iguales al default;
 * conserva los campos que la persona ya personalizó. */
export function hydrateSongMetadataTextFields(
  fields: RequirementText[],
  values: Record<string, string>,
  song: LibraryAsset,
): Record<string, string> {
  const next = { ...values };
  const title = song.name.trim() || song.title.split(" — ", 1)[0].trim();
  for (const field of fields) {
    const kind = songTextKind(field);
    if (!kind) continue;
    const current = (values[field.key] ?? "").trim();
    const defaultValue = (field.default ?? "").trim();
    if (current && current !== defaultValue) continue;
    next[field.key] = kind === "title" ? title : song.artist.trim();
  }
  return next;
}
