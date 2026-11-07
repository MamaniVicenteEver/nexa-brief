import { httpClient } from "@/infrastructure/api/http-client";

export type ShowcaseDesign = {
  id: string;
  name: string;
  category: string;
  state: "prueba" | "produccion";
  family: string;
  engine_id: string;
  description: string;
  revision: string;
  catalog_url: string;
  preview_url: string | null;
  promotable: boolean;
  promote_blocker: string | null;
  episodes: { id: string; title: string; design_id: string; preview_url: string | null }[];
};
export type ShowcaseEntry = {
  id: string;
  name: string;
  label: string;
  kind: "component" | "set" | "character" | "action" | "workflow";
  summary: string;
  tags: string[];
  family?: string;
  section?: "components" | "sprites" | "workflows";
  params: Record<string, unknown>;
  example: Record<string, unknown>;
  preview_url: string | null;
  preview_kind: "iframe" | "image" | "json";
  data?: unknown;
};
export type ShowcaseCatalog = {
  schema_version: number;
  design_id: string;
  revision: string;
  entries: ShowcaseEntry[];
  groups?: {
    id: string;
    label: string;
    families: string[];
    components: string[];
  }[];
};

// Solo rutas locales de la API, sin esquemas, hosts ni separadores alternativos.
export function safeShowcaseUrl(value: string | null | undefined): string | null {
  if (
    !value?.startsWith("/api/v1/") ||
    value.includes("\\") ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  )
    return null;
  try {
    const url = new URL(value, "https://showcase.invalid");
    if (url.origin !== "https://showcase.invalid" || !url.pathname.startsWith("/api/v1/"))
      return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export const standardShowcaseRepository = {
  designs: (signal?: AbortSignal) =>
    httpClient<{ schema_version: number; designs: ShowcaseDesign[] }>("/api/v1/showcase/designs", {
      signal,
    }),
  catalog: (id: string, signal?: AbortSignal) =>
    httpClient<ShowcaseCatalog>(`/api/v1/showcase/designs/${encodeURIComponent(id)}/catalog`, {
      signal,
    }),
  promote: (id: string) =>
    httpClient<ShowcaseDesign>(`/api/v1/showcase/designs/${encodeURIComponent(id)}/promote`, {
      method: "POST",
      timeoutMs: 120000,
    }),
};
