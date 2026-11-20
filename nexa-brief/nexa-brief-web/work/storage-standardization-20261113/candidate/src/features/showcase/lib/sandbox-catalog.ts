import { resolveApiUrl } from "@/infrastructure/api/http-client";

export type SandboxCatalog = {
  base?: string;
  components: string;
  sprites?: string;
  spritesLabel?: string;
  spritesDir?: string;
  sheet?: string;
  gallery: string;
  production?: string;
  workflows?: string;
  thumbs?: string;
  animations?: string;
  defaultTab?: "prototype" | "library";
  previewReady?: boolean;
  tabs?: CatalogTab[];
};

export type CatalogTab = { id: string; label: string; families: string[]; components?: string[] };
export type CatalogThumbs = Record<string, string>;

export function inCatalogTab(item: CatalogComponent, tab: CatalogTab): boolean {
  return (
    tab.components?.includes(item.name) === true ||
    tab.families.includes(componentFamily(item)) ||
    tab.families.includes(item.name.split(".")[0])
  );
}

export function readThumbs(value: unknown): CatalogThumbs {
  if (!record(value)) throw new Error("El mapa de miniaturas tiene un formato inválido.");
  for (const file of Object.values(value)) {
    if (typeof file !== "string") throw new Error("Ruta de miniatura inválida.");
    prototypeFileUrl("", file);
  }
  return value as CatalogThumbs;
}

export function thumbnailUrl(path: string, catalog: SandboxCatalog, file: string): string {
  const directory = catalog.thumbs?.split("/").slice(0, -1).join("/");
  return catalogFileUrl(path, catalog, directory ? `${directory}/${file}` : file);
}

export function componentPosterUrl(
  path: string,
  catalog: SandboxCatalog,
  item: CatalogComponent,
  background: "white" | "dark" | "checker",
  thumbs?: CatalogThumbs | null,
): string | undefined {
  if (background === "white" && thumbs?.[item.name])
    return thumbnailUrl(path, catalog, thumbs[item.name]);
  if (item.preview?.poster) return catalogFileUrl(path, catalog, item.preview.poster);
  if (thumbs?.[item.name]) return thumbnailUrl(path, catalog, thumbs[item.name]);
  if (catalog.thumbs) {
    // Algunos nombres contienen caracteres que no son rutas válidas. La miniatura
    // declarada se usará cuando termine de cargar el índice; no interrumpir la biblioteca.
    try {
      return thumbnailUrl(path, catalog, `${item.name}.jpg`);
    } catch {
      return undefined;
    }
  }
}

export type CatalogParam = {
  type?: string;
  required?: boolean;
  default?: unknown;
  doc?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  values?: unknown[];
  range?: unknown;
};

export type CatalogComponent = {
  name: string;
  kind?: "json";
  audio?: string;
  captions?: string;
  summary?: string;
  family?: string;
  target?: string;
  insert?: string;
  layer?: number;
  states?: string[];
  params?: Record<string, CatalogParam>;
  used_by?: string[];
  demo?: unknown;
  description?: string;
  file?: string;
  preview?: {
    bg: "white" | "dark" | "checker";
    poster?: string;
    autoplay?: boolean;
    static?: boolean;
  };
};

export type CatalogProduction = {
  title: string;
  summary?: string;
  status?: string;
  entrypoint?: string;
  catalog?: string;
  capabilities?: { title: string; description?: string }[];
  inputs?: { name: string; description?: string; required?: boolean }[];
  steps?: { title: string; description?: string; command?: string }[];
  limitations?: string[];
  agent_prompt?: string;
  documents?: { label: string; path: string }[];
};

export type CatalogWorkflows = {
  title: string;
  summary?: string;
  cards: {
    id: string;
    title: string;
    summary?: string;
    inputs?: string[];
    steps?: string[];
    documents?: { label: string; path: string }[];
  }[];
};

export type CatalogVoiceSample = {
  file: string;
  text?: string;
  source?: string;
  captions?: string;
};

export type CatalogSprite = {
  characterFile?: string;
  poses?: { name: string; file: string }[];
  voiceSample?: CatalogVoiceSample;
  name: string;
  file: string;
  variant?: string;
  relativeLength?: number;
  states?: string[] | Record<string, unknown>;
  anchor?: unknown;
  bow?: unknown;
  base?: string;
  family?: string;
  state?: string;
  livery?: unknown;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Las rutas de archivo son relativas al prototipo o a una base explícita del sandbox.
export function prototypeFileUrl(path: string, file: string): string {
  const parts = file.split("/").filter(Boolean);
  if (
    !parts.length ||
    file.startsWith("/") ||
    parts.some((part) => part === "." || part === ".." || /[:\\?#%]/.test(part))
  ) {
    throw new Error("Ruta de catálogo inválida.");
  }
  return resolveApiUrl(
    `/api/v1/explainer/files/${[...path.split("/"), ...parts].map(encodeURIComponent).join("/")}`,
  );
}

export function catalogBasePath(path: string, catalog?: SandboxCatalog | null): string {
  if (catalog?.base === undefined) return path;
  if (typeof catalog.base !== "string" || !catalog.base.startsWith("sandbox/"))
    throw new Error("La base del catálogo debe estar dentro de sandbox/.");
  prototypeFileUrl("", catalog.base);
  return catalog.base;
}

export function catalogFileUrl(path: string, catalog: SandboxCatalog, file: string): string {
  return prototypeFileUrl(catalogBasePath(path, catalog), file);
}

export function readCatalog(value: unknown): SandboxCatalog | null {
  if (!record(value) || !value.catalog) return null;
  const catalog = value.catalog;
  if (
    !record(catalog) ||
    !["components", "gallery"].every((key) => typeof catalog[key] === "string" && catalog[key])
  ) {
    throw new Error("La declaración del catálogo está incompleta.");
  }
  if (
    catalog.defaultTab !== undefined &&
    !["prototype", "library"].includes(String(catalog.defaultTab))
  )
    throw new Error("Pestaña inicial inválida.");
  if (catalog.previewReady !== undefined && typeof catalog.previewReady !== "boolean")
    throw new Error("Confirmación de vista previa inválida.");
  catalogBasePath("", catalog as SandboxCatalog);
  if (
    catalog.spritesLabel !== undefined &&
    (typeof catalog.spritesLabel !== "string" || !catalog.spritesLabel.trim())
  )
    throw new Error("Etiqueta de sprites inválida.");
  if (catalog.sprites !== undefined && catalog.spritesDir === undefined) {
    throw new Error("El catálogo de sprites requiere su directorio de archivos.");
  }
  for (const key of [
    "components",
    "sprites",
    "spritesDir",
    "gallery",
    "sheet",
    "thumbs",
    "production",
    "workflows",
    "animations",
  ]) {
    if (catalog[key] !== undefined) {
      if (typeof catalog[key] !== "string") throw new Error("Ruta de catálogo inválida.");
      prototypeFileUrl("", catalog[key]);
    }
  }
  if (catalog.tabs !== undefined) {
    const ids = new Set(["prototype", "library", "sprites", "production", "workflows"]);
    if (!Array.isArray(catalog.tabs)) throw new Error("Pestañas de catálogo inválidas.");
    for (const tab of catalog.tabs) {
      if (
        !record(tab) ||
        typeof tab.id !== "string" ||
        !/^[a-z][a-z0-9-]*$/.test(tab.id) ||
        ids.has(tab.id) ||
        typeof tab.label !== "string" ||
        !tab.label.trim() ||
        !Array.isArray(tab.families) ||
        !tab.families.every((f) => typeof f === "string") ||
        (tab.components !== undefined &&
          (!Array.isArray(tab.components) || !tab.components.every((c) => typeof c === "string")))
      ) {
        throw new Error("Pestañas de catálogo inválidas.");
      }
      ids.add(tab.id);
    }
  }
  return catalog as SandboxCatalog;
}

export function readComponents(value: unknown): CatalogComponent[] {
  const items = record(value) ? value.components : value;
  if (
    !Array.isArray(items) ||
    !items.every((item) => record(item) && typeof item.name === "string")
  ) {
    throw new Error("El catálogo de componentes tiene un formato inválido.");
  }
  for (const item of items) {
    for (const field of ["audio", "captions"] as const) {
      if (item[field] !== undefined) {
        if (typeof item[field] !== "string")
          throw new Error("Ruta de audio o subtítulos inválida.");
        prototypeFileUrl("", item[field]);
      }
    }
  }
  return items as CatalogComponent[];
}

export function readProduction(value: unknown): CatalogProduction {
  if (!record(value) || typeof value.title !== "string" || !value.title.trim()) {
    throw new Error("La guía de producción tiene un formato inválido.");
  }
  for (const key of ["summary", "status", "entrypoint", "catalog", "agent_prompt"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new Error("La guía de producción tiene un formato inválido.");
    }
  }
  for (const key of ["entrypoint", "catalog"]) {
    if (value[key] !== undefined) prototypeFileUrl("", value[key] as string);
  }
  const groups = [
    ["capabilities", "title", ["description"]],
    ["inputs", "name", ["description"]],
    ["steps", "title", ["description", "command"]],
    ["documents", "label", ["path"]],
  ] as const;
  for (const [key, required, strings] of groups) {
    const entries = value[key];
    if (entries === undefined) continue;
    if (
      !Array.isArray(entries) ||
      !entries.every(
        (entry) =>
          record(entry) &&
          typeof entry[required] === "string" &&
          entry[required].trim() &&
          strings.every(
            (field) => entry[field] === undefined || typeof entry[field] === "string",
          ) &&
          (key !== "inputs" ||
            entry.required === undefined ||
            typeof entry.required === "boolean") &&
          (key !== "documents" || typeof entry.path === "string"),
      )
    ) {
      throw new Error("La guía de producción tiene un formato inválido.");
    }
    if (key === "documents") {
      for (const entry of entries) prototypeFileUrl("", (entry as Record<string, string>).path);
    }
  }
  if (
    value.limitations !== undefined &&
    (!Array.isArray(value.limitations) ||
      !value.limitations.every((item) => typeof item === "string"))
  ) {
    throw new Error("La guía de producción tiene un formato inválido.");
  }
  return value as CatalogProduction;
}

export function readWorkflows(value: unknown): CatalogWorkflows {
  const invalid = () => {
    throw new Error("Las guías tienen un formato inválido.");
  };
  if (
    !record(value) ||
    typeof value.title !== "string" ||
    !value.title.trim() ||
    (value.summary !== undefined && typeof value.summary !== "string") ||
    !Array.isArray(value.cards)
  )
    return invalid();
  const ids = new Set<string>();
  for (const card of value.cards) {
    if (
      !record(card) ||
      typeof card.id !== "string" ||
      !/^[a-z][a-z0-9-]*$/.test(card.id) ||
      ids.has(card.id) ||
      typeof card.title !== "string" ||
      !card.title.trim() ||
      (card.summary !== undefined && typeof card.summary !== "string")
    )
      return invalid();
    ids.add(card.id);
    for (const key of ["inputs", "steps"]) {
      if (
        card[key] !== undefined &&
        (!Array.isArray(card[key]) ||
          !(card[key] as unknown[]).every((item) => typeof item === "string"))
      )
        return invalid();
    }
    if (card.documents !== undefined) {
      if (!Array.isArray(card.documents)) return invalid();
      for (const document of card.documents) {
        if (
          !record(document) ||
          typeof document.label !== "string" ||
          !document.label.trim() ||
          typeof document.path !== "string"
        )
          return invalid();
        prototypeFileUrl("", document.path);
      }
    }
  }
  return value as CatalogWorkflows;
}

export function componentFamily(component: CatalogComponent): string {
  return component.family || component.name.split(".")[0];
}

export function readSprites(value: unknown): CatalogSprite[] {
  const items = record(value) && value.sprites !== undefined ? value.sprites : value;
  if (!record(items) && !Array.isArray(items))
    throw new Error("El catálogo de sprites tiene un formato inválido.");
  return Object.entries(items).map(([key, item]) => {
    if (!record(item) || typeof (item.file ?? item.src) !== "string")
      throw new Error("Hay un sprite sin archivo en el catálogo.");
    prototypeFileUrl("", (item.file ?? item.src) as string);
    if (item.characterFile !== undefined) {
      if (typeof item.characterFile !== "string") throw new Error("Ficha de personaje inválida.");
      prototypeFileUrl("", item.characterFile);
    }
    if (item.poses !== undefined) {
      if (!Array.isArray(item.poses) || !item.poses.length) throw new Error("Poses inválidas.");
      for (const pose of item.poses) {
        if (
          !record(pose) ||
          typeof pose.name !== "string" ||
          !pose.name.trim() ||
          typeof pose.file !== "string"
        )
          throw new Error("Pose inválida.");
        prototypeFileUrl("", pose.file);
      }
    }
    if (item.voiceSample !== undefined) {
      if (
        !record(item.voiceSample) ||
        typeof item.voiceSample.file !== "string" ||
        !item.voiceSample.file.startsWith("sandbox/") ||
        (item.voiceSample.text !== undefined && typeof item.voiceSample.text !== "string") ||
        (item.voiceSample.source !== undefined && typeof item.voiceSample.source !== "string")
      )
        throw new Error("Muestra de voz inválida.");
      prototypeFileUrl("", item.voiceSample.file);
      if (item.voiceSample.captions !== undefined) {
        if (
          typeof item.voiceSample.captions !== "string" ||
          !item.voiceSample.captions.startsWith("sandbox/")
        )
          throw new Error("Subtítulos inválidos.");
        prototypeFileUrl("", item.voiceSample.captions);
      }
    }
    return {
      ...Object.fromEntries(
        [
          "anchor",
          "bow",
          "base",
          "family",
          "state",
          "livery",
          "characterFile",
          "voiceSample",
          "poses",
        ]
          .filter((key) => item[key] !== undefined)
          .map((key) => [key, item[key]]),
      ),
      name: String(item.name ?? item.id ?? key),
      file: (item.file ?? item.src) as string,
      variant: typeof item.variant === "string" ? item.variant : undefined,
      relativeLength:
        typeof (item.relativeLength ?? item.length_relative) === "number"
          ? ((item.relativeLength ?? item.length_relative) as number)
          : undefined,
      states: item.states as CatalogSprite["states"],
    };
  });
}

export function catalogValue(value: unknown): string {
  return value === undefined
    ? "Sin definir"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
}

export function galleryUrl(
  path: string,
  catalog: SandboxCatalog,
  name: string,
  format: string,
  bg: "white" | "dark" | "checker" = "white",
): string {
  const params = new URLSearchParams({
    only: name,
    bg,
    autoplay: "1",
    loop: "1",
    bare: "1",
    aspect: format === "9x16" ? "9x16" : "16x9",
  });
  return `${catalogFileUrl(path, catalog, catalog.gallery)}?${params}`;
}

export function readAnimations(value: unknown): CatalogComponent[] {
  if (!record(value) || !Array.isArray(value.animations))
    throw new Error("Índice de animaciones inválido.");
  return value.animations.map((item: unknown) => {
    if (
      !record(item) ||
      typeof item.name !== "string" ||
      typeof item.description !== "string" ||
      typeof item.file !== "string"
    )
      throw new Error("Ficha de animación inválida.");
    prototypeFileUrl("", item.file);
    if (!record(item.preview) || !["white", "dark", "checker"].includes(String(item.preview.bg)))
      throw new Error("Fondo de animación inválido.");
    return { ...item, summary: item.description } as CatalogComponent;
  });
}
