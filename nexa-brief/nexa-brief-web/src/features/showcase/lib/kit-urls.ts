import { ShowcasePreviewError } from "../api/showcase-repository";
import type { CatalogContext, Item, Source } from "../types";

export const KIT_BASE = "/api/v1/explainer/files/_tools/explainer-kit";
export const STAGE_URL = `${KIT_BASE}/showcase/stage.html`;
export function isolatedPosterUrl(
  designId: string | null,
  componentName: string,
  format: string,
  source?: Source,
): string | undefined {
  if (designId !== "imperio" || !["9x16", "16x9"].includes(format)) return;
  if (source) {
    const path = format === "9x16" ? source.preview9x16 : source.preview16x9;
    if (!path || !path.startsWith(`${source.video}/assets/components/previews/`)) return;
    try { return `/api/v1/explainer/files/${encodeRelativePath(path)}`; } catch { return; }
  }
  return `${KIT_BASE}/showcase/imperio-thumbs/${encodeURIComponent(componentName)}-${format}.jpg`;
}

/** Acepta solo rutas relativas literales; cada segmento se codifica al usarlo. */
export function encodeRelativePath(path: string): string {
  const parts = path.split("/");
  if (
    !path ||
    parts.some(
      (part) =>
        !part ||
        part.startsWith(".") ||
        /[%\\:?#]/.test(part) ||
        [...part].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    )
  ) {
    throw new Error("Ruta de archivo inválida");
  }
  return parts.map(encodeURIComponent).join("/");
}

export function validId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function commonScripts(designId: string, context: CatalogContext): string[] {
  const design = context.designs.find((entry) => entry.id === designId);
  if (!design || !validId(designId)) throw new Error("Diseño desconocido");
  const all = new Set<string>();
  for (const entry of context.designs) {
    for (const script of entry.scripts) {
      encodeRelativePath(script);
      if (script.startsWith("designs/common/") && script.endsWith(".js")) all.add(script);
    }
  }
  return [...all].filter((script) => !design.scripts.includes(script));
}

export function catalogUrl(designId: string, context: CatalogContext): string {
  const params = new URLSearchParams({ d: designId, catalog: "1" });
  for (const script of commonScripts(designId, context))
    params.append("js", `../${encodeRelativePath(script)}`);
  return `${STAGE_URL}?${params}`;
}

export function validVideoSource(video: string, source: string): boolean {
  try {
    encodeRelativePath(video);
    encodeRelativePath(source);
    return (
      video.split("/").length === 2 &&
      source.startsWith(`${video}/assets/components/`) &&
      source.endsWith(".js")
    );
  } catch {
    return false;
  }
}

export function buildPreviewUrl(
  item: Item,
  context: CatalogContext,
  mode: "card" | "modal",
): string {
  try {
    if (item.unavailableReason || !item.designId || !item.component.name)
      throw new Error(item.unavailableReason || "Entrada sin diseño");
    const params = new URLSearchParams({
      d: item.designId,
      c: item.component.name,
      solo: "",
      dur: "6",
      gallery: "",
    });
    if (item.designId === "imperio") {
      params.set("isolated", "1");
      if (item.component.name === "imperio.title") params.set("dur", "13");
      if (mode === "card") params.set("loop", "");
    }
    for (const script of commonScripts(item.designId, context))
      params.append("js", `../${encodeRelativePath(script)}`);
    if (item.source) {
      if (!item.source.source || !validVideoSource(item.source.video, item.source.source))
        throw new Error("Fuente de video inválida o ausente");
      params.append("js", `../../../${encodeRelativePath(item.source.source)}`);
      params.set("video", item.source.video);
    }
    if (mode === "modal") {
      params.set("controls", "1");
      params.set("clock", "synthetic");
    }
    return `${STAGE_URL}?${params}`;
  } catch (error) {
    throw new ShowcasePreviewError(
      error instanceof Error ? error.message : "Vista previa no disponible",
    );
  }
}
