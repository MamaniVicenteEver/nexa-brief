export type PageSize = "all" | number;
export type CatalogAudience = "public" | "internal";
export type CatalogStudio =
  | { kind: "template"; template: import("@/features/templates/types").Template }
  | { kind: "demo"; video: import("@/features/explainer/types").ExplainerVideo };
export interface CatalogQuery {
  category?: string;
  page?: number;
  pageSize?: PageSize;
}
export interface CatalogEntry {
  id: string;
  source_id: string;
  kind: "template" | "demo";
  title: string;
  category_ids: string[];
  poster_url: string | null;
  orientation: "9:16" | "16:9" | "any";
  demo: boolean;
  design_id: string | null;
  playback: {
    engine_url: string | null;
    desktop_video_url: string | null;
    mobile_video_url: string | null;
    engine: "template" | "explainer";
  };
}
export interface CatalogPage {
  items: CatalogEntry[];
  categories: { id: string; name: string; status: string }[];
  total: number;
  page: number;
  page_size: PageSize;
  total_pages: number;
  category_counts: Record<string, number>;
}
