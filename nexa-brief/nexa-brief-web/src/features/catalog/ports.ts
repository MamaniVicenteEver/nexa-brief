import type { CatalogAudience, CatalogPage, CatalogQuery, CatalogStudio } from "./types";

export interface CatalogClient {
  list(audience: CatalogAudience, query: CatalogQuery, signal?: AbortSignal): Promise<CatalogPage>;
  studio(id: string, signal?: AbortSignal): Promise<CatalogStudio>;
}
