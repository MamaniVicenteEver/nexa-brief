export type ResourceSelection =
  | { mode: "auto" }
  | { mode: "upload"; file: File }
  | { mode: "library"; assetId: string };

/** Serializa una `ResourceSelection` a los campos multipart que el backend
 * espera (`{prefix}_file` o `{prefix}_asset_id`) — compartido entre el
 * servicio de preview de plantillas y, potencialmente, Crear Video. */
export function appendResourceSourceFields(
  formData: FormData,
  prefix: "image" | "music" | "video",
  selection: ResourceSelection | undefined,
): void {
  if (!selection || selection.mode === "auto") return;
  if (selection.mode === "upload") {
    formData.append(`${prefix}_file`, selection.file);
  } else {
    formData.append(`${prefix}_asset_id`, selection.assetId);
  }
}
