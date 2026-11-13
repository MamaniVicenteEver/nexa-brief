import type { CatalogContext, Design, Item } from "../types";

/** Puerto de datos: las implementaciones respetan AbortSignal y no cachean errores como éxitos. */
export interface ShowcaseRepository {
  getDesigns(signal?: AbortSignal): Promise<Design[]>;
  getLibrary(designs: Design[], signal?: AbortSignal): Promise<Item[]>;
  getCatalog(designId: string, context: CatalogContext, signal?: AbortSignal): Promise<Item[]>;
  /** No realiza I/O; lanza ShowcasePreviewError si la entrada no admite preview. */
  previewUrl(item: Item, context: CatalogContext, mode: "card" | "modal"): string;
}

/** Error recuperable al construir una URL de preview para una entrada inválida. */
export class ShowcasePreviewError extends Error {
  readonly code = "SHOWCASE_PREVIEW_UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShowcasePreviewError";
  }
}
