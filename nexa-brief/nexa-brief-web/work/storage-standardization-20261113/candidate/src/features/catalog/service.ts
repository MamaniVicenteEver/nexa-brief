import { httpCatalogClient } from "./adapters/http-catalog";
import type { CatalogClient } from "./ports";
import type { CatalogAudience, CatalogQuery } from "./types";

export function createCatalogService(client: CatalogClient) {
  return {
    list: (audience: CatalogAudience, query: CatalogQuery, signal?: AbortSignal) =>
      client.list(audience, query, signal),
    studio: (id: string, signal?: AbortSignal) => client.studio(id, signal),
  };
}

// Frontend composition root; views depend on this service, never on fetch or API paths.
export const catalogService = createCatalogService(httpCatalogClient);
