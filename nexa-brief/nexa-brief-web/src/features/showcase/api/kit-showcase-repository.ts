import {
  buildPreviewUrl,
  encodeRelativePath,
  KIT_BASE,
  validId,
  validVideoSource,
} from "../lib/kit-urls";
import type { CatalogContext, Component, Design, Item, Json, Param, Source } from "../types";
import { loadStageCatalog } from "./kit-stage-transport";
import type { ShowcaseRepository } from "./showcase-repository";

type ObjectValue = Record<string, unknown>;
function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function json(value: unknown): value is Json {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every(json)) ||
    (object(value) && Object.values(value).every(json))
  );
}
function optionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}
function parseComponent(value: unknown): Component {
  if (
    !object(value) ||
    typeof value.name !== "string" ||
    !value.name ||
    !optionalString(value.summary) ||
    !optionalString(value.layer) ||
    (value.tags !== undefined &&
      (!Array.isArray(value.tags) ||
        !value.tags.every((tag: unknown) => typeof tag === "string"))) ||
    !object(value.params)
  )
    throw new Error("Componente inválido");
  const params: Record<string, Param> = {};
  for (const [key, param] of Object.entries(value.params)) {
    if (
      !object(param) ||
      typeof param.type !== "string" ||
      (param.doc !== null && !optionalString(param.doc)) ||
      (param.required !== undefined && typeof param.required !== "boolean") ||
      (param.default !== undefined && !json(param.default)) ||
      (param.options !== undefined &&
        param.options !== null &&
        (!Array.isArray(param.options) || !param.options.every(json))) ||
      (param.min !== undefined &&
        param.min !== null &&
        (typeof param.min !== "number" || !Number.isFinite(param.min))) ||
      (param.max !== undefined &&
        param.max !== null &&
        (typeof param.max !== "number" || !Number.isFinite(param.max)))
    )
      throw new Error(`Parámetro inválido: ${key}`);
    params[key] = param as Param;
  }
  if (
    value.example !== undefined &&
    value.example !== null &&
    (!object(value.example) || !json(value.example))
  )
    throw new Error("Ejemplo inválido");
  return {
    name: value.name,
    params,
    ...(value.summary !== undefined && { summary: value.summary as string }),
    ...(value.layer !== undefined && { layer: value.layer as string }),
    ...(value.tags !== undefined && { tags: value.tags as string[] }),
    ...(value.example !== undefined && { example: value.example as Record<string, Json> | null }),
  };
}
async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${KIT_BASE}/${path}`, { cache: "no-cache", signal });
  if (!response.ok) throw new Error(`No se pudo cargar ${path} (HTTP ${response.status})`);
  return response.json();
}
function withKeys(items: Item[], tuples: unknown[][], kind: "design" | "video"): Item[] {
  const keys = tuples.map((tuple) => JSON.stringify(tuple));
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  if ([...counts.values()].some((count) => count > 1)) console.warn("Datos duplicados en showcase");
  return items.map((item, index) => ({
    ...item,
    key: `${kind}:${JSON.stringify((counts.get(keys[index]) ?? 0) > 1 ? [...tuples[index], index] : tuples[index])}`,
  }));
}
function parseDesign(value: unknown, id: string): Design {
  if (
    !object(value) ||
    value.id !== id ||
    typeof value.family !== "string" ||
    !value.family ||
    typeof value.name !== "string" ||
    typeof value.tagline !== "string" ||
    !Array.isArray(value.scripts) ||
    !value.scripts.every((script: unknown) => typeof script === "string")
  )
    throw new Error(`Diseño inválido: ${id}`);
  for (const script of value.scripts as string[]) {
    encodeRelativePath(script);
    if (!script.endsWith(".js")) throw new Error(`Script inválido: ${id}`);
  }
  return {
    id,
    family: value.family,
    name: value.name,
    tagline: value.tagline,
    scripts: value.scripts as string[],
  };
}
function sourceOf(value: ObjectValue): Source {
  if (
    typeof value.video !== "string" ||
    (value.source !== undefined && value.source !== null && typeof value.source !== "string") ||
    !optionalString(value.sheet) ||
    (value.sheet_exists !== undefined && typeof value.sheet_exists !== "boolean") ||
    !optionalString(value.source_sheet) ||
    !optionalString(value.preview_9x16) ||
    !optionalString(value.preview_16x9) ||
    (value.source_sha256 !== undefined &&
      value.source_sha256 !== null &&
      typeof value.source_sha256 !== "string")
  )
    throw new Error("Origen de biblioteca inválido");
  for (const path of [value.sheet, value.source_sheet, value.preview_9x16, value.preview_16x9])
    if (typeof path === "string") encodeRelativePath(path);
  return {
    video: value.video,
    source: value.source ?? null,
    ...(value.sheet !== undefined && { sheet: value.sheet as string }),
    ...(value.sheet_exists !== undefined && { sheetExists: value.sheet_exists as boolean }),
    ...(value.source_sheet !== undefined && { sourceSheet: value.source_sheet as string }),
    ...(value.preview_9x16 !== undefined && { preview9x16: value.preview_9x16 as string }),
    ...(value.preview_16x9 !== undefined && { preview16x9: value.preview_16x9 as string }),
    ...(value.source_sha256 !== undefined && {
      sourceSha256: value.source_sha256 as string | null,
    }),
  };
}
export class KitShowcaseRepository implements ShowcaseRepository {
  async getDesigns(signal?: AbortSignal): Promise<Design[]> {
    const index = await getJson("designs/index.json", signal);
    if (
      !object(index) ||
      !Array.isArray(index.designs) ||
      !index.designs.every((id: unknown) => typeof id === "string" && validId(id)) ||
      new Set(index.designs).size !== index.designs.length
    )
      throw new Error("Índice de diseños inválido");
    return Promise.all(
      index.designs.map(async (id: string) =>
        parseDesign(await getJson(`designs/${encodeURIComponent(id)}/design.json`, signal), id),
      ),
    );
  }
  async getLibrary(designs: Design[], signal?: AbortSignal): Promise<Item[]> {
    const data = await getJson("component-library.json", signal);
    if (!object(data) || !Array.isArray(data.components)) throw new Error("Biblioteca inválida");
    const items: Item[] = data.components.map((value: unknown) => {
      if (!object(value)) throw new Error("Entrada de biblioteca inválida");
      const component = parseComponent(value);
      const source = sourceOf(value);
      const prefix = component.name.split(".")[0];
      const exact = designs.find((design) => design.id === prefix);
      const families = designs.filter((design) => design.family === prefix);
      const design = exact ?? (families.length === 1 ? families[0] : undefined);
      const unavailableReason = !design
        ? "Diseño desconocido o ambiguo"
        : !source.source || !validVideoSource(source.video, source.source)
          ? "Fuente de video inválida o ausente"
          : undefined;
      return {
        key: "",
        designId: design?.id ?? null,
        component,
        source,
        ...(unavailableReason && { unavailableReason }),
      };
    });
    return withKeys(
      items,
      items.map(({ source, component }) => [source?.video, source?.source ?? "", component.name]),
      "video",
    );
  }
  async getCatalog(
    designId: string,
    context: CatalogContext,
    signal?: AbortSignal,
  ): Promise<Item[]> {
    const data = await loadStageCatalog(designId, context, signal);
    if (!Array.isArray(data)) throw new Error("Catálogo inválido");
    const items = data.map((value) => ({ key: "", designId, component: parseComponent(value) }));
    const nativeItems = withKeys(
      items,
      items.map(({ component }) => [designId, component.name]),
      "design",
    );
    if (designId !== "imperio") return nativeItems;
    const library = await this.getLibrary(context.designs, signal);
    // Estas dos piezas del video de Japón ya fueron promovidas al diseño.
    const promotedSource = "nodeatlas/japon-expansion-prueba/assets/components/japon.js";
    return [...nativeItems, ...library.filter(item =>
      item.designId === designId && !(item.source?.source === promotedSource &&
        ["imperio.campaign", "imperio.footage"].includes(item.component.name))
    )];
  }
  previewUrl(item: Item, context: CatalogContext, mode: "card" | "modal"): string {
    return buildPreviewUrl(item, context, mode);
  }
}
